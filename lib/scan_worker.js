const ipc = require('node-ipc'); // Inter Process Communication module, to communicate with Controller.
const lib = require('pogobuf'); // pogobuf library.
const {Logger} = require('winston'); // Logger
const {S2:s2} = require('s2-geometry'); //s2 library, currently uses to turn cell id to lat lng.

// setup logger

const logger = new (Logger)({
  transports: [
    new (winston.transports.Console)(),
    new (winston.transports.File)({ filename: 'scanner.log' })
  ]
});

// ipc config

ipc.config.id = 'Worker';
ipc.config.retry = 3000;
ipc.config.silent = true;

ipc.connectTo('Controller');

// creates client

const client = new lib.Client();

// receives data through child_process socket

process.on('message', data => {

  logger.info('Worker initialized.', data)
  
  let orig_cell = data.cell; // the cell passed into the worker

  let worker = data.worker; // worker details such as tokens, username

  let latlng = s2.idToLatLng(orig_cell); // lat lng of the cell.

  client.setAuthInfo('ptc', worker.token); //set the client's auth. [TODO: make "ptc" portable - supports both ptc and google]

  client.setPosition(latlng.lat, latlng.lng); //set initial location

  client.init() // initialize the client [TODO: pass own init, device info]

  .then(() => {
    return client.playerUpdate()
  }, err => {
    ipc.of.Controller.emit('token_error', data)
  })

  .then(() => {
    return client.getMapObjects([orig_cell],[0]) // get all the map objects in the cell
  }) 

  .then(mapObj => {
    return mapObj.map_cells
  })

  .each(cell => {
    // logger.info('scanner callback', cell)

    if (map_cell.wild_pokemons.length > 0) {

      let spawn_points = [];

      Promise.each(map_cell.wild_pokemons, pokemon => {
        spawn_points.push({orig_cell: orig_cell, lat: pokemon.latitude, lng: pokemon.longitude, sid: pokemon.spawn_point_id})
      })
      
      ipc.of.Controller.emit('yesthing', spawn_points);

    } else {
      client.checkChallenge(false)
        .then(response => {
          if (response.challenge_url != null) {
            logger.info('Challenged.')
          }
        })
    }

    // scanner: scan with lvl 15/16 then use nearby to encounter
  })

  .then(() => {
    ipc.of.Controller.emit('WorkerDone', {worker: worker, cell: orig.cell})
    process.exit(0)
  })

  .catch(error => {

    logger.error(error)
    ipc.of.Controller.emit('WorkerDone', worker);
    process.exit(1);
    throw(error);

  })

})


// add check challenge
