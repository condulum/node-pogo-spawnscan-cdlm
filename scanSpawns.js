const yaml = require('js-yaml'); // read config
const {access, mkdirSync, readFileSync, writeFileSync} = require('fs');  // import fs, only import those which are needed.
const Promise = require('bluebird'); // replace js Promise.
const moment = require('moment'); // moment.js, to manipulate time.
const {Logger} = require('winston'); // logger. 
const schedule = require('node-schedule'); // scheduler, used to schedule scans.
const nedb = require('nedb'); // database (mongodb api)
const lib = require('pogobuf'); // pogobuf lib, only used here for refreshing tokens
const _ = require('lodash'); // lodash, swiss army knife.
const {S2: s2} = require('s2-geometry');  // s2 geometry, to get cell id, lat lng, etc.
const cp = require('child_process'); // cp, for forking process (workers)
const ipc = require('node-ipc'); // ipc, for sub_process communication
const getCell = require('./lib/getCell'); // local lib to get all the cells.

// END REQUIRE

const config = yaml.safeLoad(readFileSync('./config.yaml')); // read config.

// setup Logger.
const logger = new (Logger)({
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
      // for each file parse cells and put it in all_cells.
      files.forEach(file => {
        let read = JSON.parse(readFileSync(`./cell_files/${file}`).toString());
        all_cells[file] = read; // all_cells[file_name] contains the cells (in array)
        // Object.keys(obj)
      })
      resolve();
    });
  })
}

// refreshes token.

let Trainer = new lib.PTCLogin();

function refreshToken(worker) {
  // Get worker's token.
  Trainer = null;
  Trainer = new lib.PTCLogin();
  Trainer.login(worker.username, worker.password)
    .then(token => {
      logger.info(`Token.`, {username: worker.username, token: token});
      worker_db.update({username: worker.username}, {$set:{token: token}}, {})
    }, err => {
      logger.error(err, {username: worker.username})
    })
}

function scan(cell, prevCell=0) {
  // remove the cell from "toscan", so when next scan for the worker is initiated, the app will not select cells that have already been scanned.

  current_cells_toscan.pop(current_cells_toscan.indexOf(cell));

  logger.info('Scan initiated.');

  // get current timestamp

  const now = moment().unix()
  
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
        fork.send({cell:cell, worker:AvailableWorker})
        
        // updates the worker_db that, the worker is working, last scan timestamp, and the cell it is scanning.

        worker_db.update({username: AvailableWorker.username}, {$set:{working:true, last_scan_unix: now, cell: cell}})

        clearInterval(interval);
      } else {
        logger.info('No Worker available. Will retry in 1 sec.')
      }
    })
  },1000)
}

function main() {
  // initialize all workers
  Promise.each(config.workers, worker => {
    // insert to database
    worker_db.insert(worker);
  })

  .then(() => {
    // more initialization on workers.
    worker_db.update({}, {$set:{token: "", working: false, last_scan_unix: 0, cell: 0}}, {})
  })

  .then(() => {
    // update token for every worker.
    worker_db.find({}, (err, docs) => {
      docs.forEach(worker => {
        refreshToken(worker)
      })
    })
  })

  .then(() => {
    // make the folder if not exists
    access('./cell_files/', fs.constants.W_OK, err => {
      if (err) {
        mkdirSync('./cell_files/')
      }
    })
    access('./result/', fs.constants.W_OK, err => {
      if (err) {
        mkdirSync('./result/')
      }
    })
  })

  .then(() => {
    if (config.generated) {
      return getCell.main(config.areas)
    } else {
      return getCell.main({location: config.non_generated})
    }
  })

  .then(() => {
    return readthefile()  // read all the files first, to ensure everything is loaded.
  })
  
  .then(() => {
    logger.info("Program started.")

    // set the current file that the program is scanning to the first file.
    current_cell_file = cell_files[_.head(Object.keys(cell_files))];

    current_cells_toscan = cells[current_cell_file]

    // get the first n cells. where n = num of workers.

    const first_cells = _.chunk(cells[current_cell_file], config.workers.length)
    
    // for each cell in the n cells, pass them to scan function.

    first_cells[0].forEach(first_cell => {
      scan(cell) // initiate scan
    })
  })
}

function schedule_next_scan(scanned_cell) {
  let unscanned_cells = []; // cache of current_cells_toscan, processed.

  // get latlng of scanned_cell, then init new geopoint instance of it

  const scanned_cell_latlng = s2.idToLatLng(scanned_cell);
  const scanned_cell_geo = new geopoint(scanned_cell_latlng.lat, scanned_cell_latlng.lng)

  // for each cells to scan, get the distance from the scanned_cell to the unscanned_cell.
  if (current_cells_toscan.length != 0) {
    Promise.each(current_cells_toscan, unscanned_cell => {
      const unscanned_cell_latlng = s2.idToLatLng(unscanned_cell);
      const unscanned_cell_geo = new geopoint(unscanned_cell_latlng.lat, unscanned_cell_latlng.lng);

      unscanned_cells.push({cell: cell, dist: scanned_cell_geo.distanceTo(unscanned_cell_geo, true) * 1000})
    })
    
    .then(() => {
      // sort them by distance.
      return _.sortBy(unscanned_cells, obj => {
        return obj.dist
      })
    })
    
    .then(sorted => {
      const next_cell = sorted[0]
      // scan the next cell. (should schedule by calculating distance.)
      // time = distance / speed.
      const time = next_cell.dist / config.travelling_speed
      const next = moment().add(time, "s")
      return schedule.scheduleJob(next.toDate(), scan.bind(null, next_cell.cell, scanned_cell))
    })
  } else {
    switch (round == config.round) {
      case true: 
        dumper(); // function that dumps all data to json file,
        delete cell_files[current_cell_file] // pop the file that just got scanned, then on file list, get the first file, initiate main again.
        current_cell_file = cell_files[_.head(Object.keys(cell_files))]; // set the current file that the program is scanning to the first file.
        found = []; // reset found.
      default: 
        //set current to scans 

        current_cells_toscan = cells[current_cell_file]

        // get the first n cells. where n = num of workers.

        const first_cells = _.chunk(cells[current_cell_file], config.workers.length)
        
        // for each cell in the n cells, pass them to scan function.

        first_cells[0].forEach(first_cell => {
          scan(cell) // initiate scan
        })

        break;

    }
  }

}

function dumper() {
  writeFileSync(`result/spawns_${file}`, JSON.stringify(found))
}

//LISTENER

ipc.server.on('WorkerDone', (data, socket) => {
  logger.info('Worker killed.', {username: data.worker.username});
  worker_db.update({username: data.worker.username}, {$set:{working:false}})
  schedule_next_scan(data.cell);
});


ipc.server.on('yesthing', (spawns, socket) => {
  logger.info('callback_from_worker')

  spawns.forEach(celldata => {
    // const origin = (new s2native.S2CellId(new s2native.S2LatLng(celldata.lat, celldata.lng))).parent(20);
    
    celldata.cell = s2.keyToId(s2.latLngToKey(celldata.lat, celldata.lng, 20))
    celldata.sid = celldata.cell.toString(16)

    logger.info('Found something.', celldata);

    if (found.includes(celldata) == false) {
      found.push(celldata)
    }
  })
});

ipc.server.on('token_error', (data, socket) => {
  refreshToken(data.worker) // refresh token of worker
  scan(data.cell, data.cell) // rescans with the same account
})

ipc.server.start();
main();
