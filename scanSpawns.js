const yaml = require('js-yaml'); // read config
const csv = require('csv'); // write capped accounts
const fs = require('fs'); // import fs, to read configs and write dumps
const Promise = require('bluebird'); // replace js Promise.
const moment = require('moment'); // moment.js, to manipulate time.
const winston = require('winston'); // logger. 
const schedule = require('node-schedule'); // scheduler, used to schedule scans.
const nedb = require('nedb'); // database (mongodb api)
const lib = require('pogobuf'); // pogobuf lib, only used here for refreshing tokens
const _ = require('lodash'); // lodash, swiss army knife.
const {S2: s2} = require('s2-geometry');  // s2 geometry, to get cell id, lat lng, etc.
const cp = require('child_process'); // cp, for forking process (workers)
const ipc = require('node-ipc'); // ipc, for sub_process communication
const getCell = require('./lib/getCell'); // local lib to get all the cells.
const geopoint = require('geopoint'); // to measure lat long 1 and lat long 2's distance.
const captcha = require('./lib/captcha'); // captcha library

// END REQUIRE

let config; // config file stub, will read at main
let workers; // account file stub, will read at main

// setup Logger.
const logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)(),
    new (winston.transports.File)({ filename: 'log.log' })
  ]
});

// setup worker db.
const worker_db = new nedb(); 

const all_cells = {}; // all the cells contained in each of the cell files

// caching current file

let current_cell_file; // name of the current cell file.
let current_cells_toscan; // a cache of the cells in the file that have not been scanned. (pending_toscan)
let current_round; // indicates what round the program is in now.
let found = [];

// setting up ipc

ipc.config.id = 'Controller';
ipc.config.retry = 3000;
ipc.config.silent = true;

ipc.serve();

// read all the files.
// check if cell_files/ exists, if not mkdir.

function readthefile() { 
  return new Promise((resolve, reject) => {
    // get all files in the cell_file directory
    fs.readdir('./cell_files/', (err, files) => {
      if (err) {
        // for each file parse cells and put it in all_cells.
        files.forEach(file => {
          let read = JSON.parse(fs.readFileSync(`./cell_files/${file}`).toString());
          all_cells[file] = read; // all_cells[file_name] contains the cells (in array)
          // Object.keys(obj)
        });
        resolve();
      } else {
        reject(err);
      }
    });
  });
}

// refreshes token.

function refreshToken(worker) {
  let Auth;

  // check for account type.

  switch (worker.type) {
  case 'ptc':
    Auth = new lib.PTCLogin();
    break;
  case 'google':
    Auth = new lib.GoogleLogin();
    break;
  default:
    logger.error(`Unknown account type ${worker.type}, will remove from Database.`, {username: worker.username});
    worker_db.remove({username: worker.username});
    break;
  }

  // Get worker's token.
  Auth.login(worker.username, worker.password)

    .then(token => {

      logger.info(`Token.`, {username: worker.username, token: token});
      worker_db.update({username: worker.username}, {$set:{token: token}}, {});

    }, err => {

      logger.error(`Get token failed, will remove from Database.`, {err: err, username: worker.username});
      worker_db.remove({username: worker.username});

    });
}

function scan(cell, prevCell=0) {
  // remove the cell from "toscan", so when next scan for the worker is initiated, the app will not select cells that have already been scanned.

  current_cells_toscan.pop(current_cells_toscan.indexOf(cell));

  logger.info('Scan initiated.');

  // get current timestamp

  const now = moment().unix();
  
  // set interval, if no worker is available, which should be impossible, then wait for 1 sec and try to query again.

  const interval = setInterval(() => {

    // find worker that is not working.
    // if this is the first round of scanning, then it would return all the workers. 
    // else, because prevCell, it would only get the workers that scanned prevCell previously, which ideally should only return 1 docs.
    
    worker_db.find({working: false, cell: prevCell, $not: {token: ''}}, function(err, docs) {
      // here it randomly get 1 worker from the docs. (if prevCell, then it would always get the only document in the array.)
      let AvailableWorker = _.sample(docs);
      
      if (AvailableWorker != undefined && AvailableWorker.token != undefined) {
        
        logger.info('Worker found.');
        
        // fork the worker, sends cell data and worker data.

        const fork = cp.fork(`./lib/scan_worker.js`);
        fork.send({cell:cell, worker:AvailableWorker});
        
        // updates the worker_db that, the worker is working, last scan timestamp, and the cell it is scanning.

        worker_db.update({username: AvailableWorker.username}, {$set:{working:true, last_scan_unix: now, cell: cell}});

        clearInterval(interval);
      } else {
        logger.info('No Worker available. Will retry in 1 sec.');
      }
    });
  },1000);
}

function main() {
  // initialize all workers
  try {
    config = yaml.safeLoad(fs.readFileSync('./config.yaml')); // read config.
  } catch (err) {
    logger.error('Config not accessible / does not exist.');
  } finally {
    process.exit(1);
  }

  try {
    workers = yaml.safeLoad(fs.readFileSync('./accounts.yaml')); // read worker
  } catch (err) {
    logger.error('Accounts.yaml not accessible / does not exist. (Have you done csv2yaml.js yet?)');
  } finally {
    process.exit(1);
  }

  // TODO: separate locations from config.yaml as well, detect accounts.csv and auto convert for user.
  
  Promise.each(workers, worker => {
    // insert to database
    worker_db.insert(worker);
  })

  .then(() => {
    // more initialization on workers.
    worker_db.update({}, {$set:{token: "", working: false, last_scan_unix: 0, cell: 0}}, {});
  })

  .then(() => {
    // update token for every worker.
    worker_db.find({}, (err, docs) => {
      docs.forEach(worker => {
        refreshToken(worker);
      });
    });
  })

  .then(() => {
    // make the folder if not exists
    fs.access('./cell_files/', fs.constants.W_OK, err => {
      if (err) {
        fs.mkdirSync('./cell_files/');
      }
    });
    fs.access('./result/', fs.constants.W_OK, err => {
      if (err) {
        fs.mkdirSync('./result/');
      }
    });
  })

  .then(() => {
    if (config.generated) {
      return getCell.main(config.areas);
    } else {
      return getCell.main({location: config.non_generated});
    }
  })

  .then(() => {
    return readthefile();  // read all the files first, to ensure everything is loaded.
  })
  
  .then(() => {
    logger.info("Program started.");

    // set the current file that the program is scanning to the first file.
    current_cell_file = all_cells[_.head(Object.keys(all_cells))];

    current_cells_toscan = all_cells[current_cell_file];

    // get the first n cells. where n = num of workers.

    const first_cells = _.chunk(all_cells[current_cell_file], workers.length);
    
    // for each cell in the n cells, pass them to scan function.

    first_cells[0].forEach(first_cell => {
      scan(first_cell); // initiate scan
    });
  });
}

function schedule_next_scan(scanned_cell) {
  let unscanned_cells = []; // cache of current_cells_toscan, processed.

  // get latlng of scanned_cell, then init new geopoint instance of it

  const scanned_cell_latlng = s2.idToLatLng(scanned_cell);
  const scanned_cell_geo = new geopoint(scanned_cell_latlng.lat, scanned_cell_latlng.lng);

  // for each cells to scan, get the distance from the scanned_cell to the unscanned_cell.
  if (current_cells_toscan.length != 0) {

    Promise.each(current_cells_toscan, unscanned_cell => {
      const unscanned_cell_latlng = s2.idToLatLng(unscanned_cell);
      const unscanned_cell_geo = new geopoint(unscanned_cell_latlng.lat, unscanned_cell_latlng.lng);

      unscanned_cells.push({cell: scanned_cell, dist: scanned_cell_geo.distanceTo(unscanned_cell_geo, true) * 1000});
    })
    
    .then(() => {
      // sort them by distance.
      return _.sortBy(unscanned_cells, obj => {
        return obj.dist;
      });
    })
    
    .then(sorted => {
      const next_cell = sorted[0];
      // scan the next cell. (should schedule by calculating distance.)
      // time = distance / speed.
      const time = next_cell.dist / config.travelling_speed;
      const next = moment().add(time, "s");
      return schedule.scheduleJob(next.toDate(), scan.bind(null, next_cell.cell, scanned_cell));
    });
  } else {
    switch (current_round == config.round) {
    case true: 
      dumper(); // function that dumps all data to json file,
      delete all_cells[current_cell_file]; // pop the file that just got scanned, then on file list, get the first file, initiate main again.
      current_cell_file = all_cells[_.head(Object.keys(all_cells))]; // set the current file that the program is scanning to the first file.
      found = []; // reset found.
      break;
    }
    //set current to scans 

    current_cells_toscan = all_cells[current_cell_file];

    // get the first n cells. where n = num of workers.

    const first_cells = _.chunk(all_cells[current_cell_file], workers.length);
    
    // for each cell in the n cells, pass them to scan function.

    first_cells[0].forEach(first_cell => {
      scan(first_cell); // initiate scan
    });

  }

}

function dumper() {
  fs.writeFileSync(`result/spawns_${current_cell_file}.json`, JSON.stringify(found));
}

//LISTENER

ipc.server.on('WorkerDone', data => {
  logger.info('Worker killed.', {username: data.worker.username});
  worker_db.update({username: data.worker.username}, {$set:{working:false}});
  schedule_next_scan(data.cell);
});


ipc.server.on('yesthing', spawns => {
  logger.info('callback_from_worker');

  spawns.forEach(celldata => {
    // const origin = (new s2native.S2CellId(new s2native.S2LatLng(celldata.lat, celldata.lng))).parent(20);
    
    celldata.cell = s2.keyToId(s2.latLngToKey(celldata.lat, celldata.lng, 20));
    celldata.sid = celldata.cell.toString(16);

    logger.info('Found something.', celldata);

    if (found.includes(celldata) == false) {
      found.push(celldata);
    }
  });
});

ipc.server.on('token_error', data => {
  worker_db.update({username: data.worker.username}, {$set:{working:false}});
  refreshToken(data.worker); // refresh token of worker
  scan(data.cell, data.cell); // rescans with the same account
});

ipc.server.on("challenge", data => {
  logger.info('Worker killed.', {username: data.worker.username});
  worker_db.update({username: data.worker.username}, {$set:{working:false, capped: true}});
  scan(data.cell); // let someone else scan it

  if (config.solve_captcha) { // if solve captcha is enabled then

    const solver_config = { // pass config into the solver.
      two_key: config.two_captcha_token,
      two_cap: config.two_captcha,
      manual: config.manual_captcha
    };

    const solver = new captcha(solver_config);
    
    solver.solve(data.challenge_url)
      .then(token => {
        let solve_client = new lib.Client();
        solve_client.setAuthInfo(data.worker.type, data.worker.token);
        solve_client.init()
          .then(() => {
            return solve_client.verifyChallenge(token);
          })
          .then(success => {
            if (!success) {
              logger.error("Solve Challenge Failed.", {worker: data.worker});
            } else {
              worker_db.update({username: data.worker.username}, {$set: {capped: false}});
            }
          });
      }, err => {
        logger.error(err);
        tocsv(data.worker);
      });

  } else {
    tocsv(data.worker);
  }
});

function tocsv(worker){
  // add to capped.csv, flagged as captcha-ed
  csv.stringify([worker.username, worker.password], (err, output) => {
    if (err) {
      logger.error('Add account to capped.csv unsuccessful. Check log for details', {worker: worker, err: err});
    } else {
      fs.appendFile('./capped.csv', output+'\n', {}, (err) => {
        if (err) {
          logger.error('Add account to capped.csv unsuccessful. Check log for details', {worker: worker, err: err});
        }
      });
    }
  });
}

ipc.server.start();
main();
