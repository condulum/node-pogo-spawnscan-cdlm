const ipc = require('node-ipc');
const lib = require('pogobuf');
const moment = require('moment');
const winston = require('winston');
const {S2:s2} = require('s2-geometry')

const logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)(),
    new (winston.transports.File)({ filename: 'scanner.log' })
  ]
});

ipc.config.id = 'Worker';
ipc.config.retry = 3000;
ipc.config.silent = true;

ipc.connectTo('Controller');

const client = new lib.Client();

process.on('message', data => {
  logger.info('Worker initialized.', data)
  let orig_cell = data.cell;
  let worker = data.worker;
  let latlng = s2.idToLatLng(orig_cell);
  client.setAuthInfo('ptc', worker.token); //get token
  client.setPosition(latlng.lat, latlng.lng); //set initial location
  client.init()

  .then(() => {
    return client.playerUpdate()
  })

  .then(() => {
    return client.getMapObjects([orig_cell],[0])
  }) //update worker (character)

  .then(cellList => { //get the objects on the map
    cellList.map_cells.forEach(map_cell => {
      logger.info('scanner callback', map_cell)
      if (map_cell.wild_pokemons.length > 0) {
        let spawn_points = [];
        map_cell.wild_pokemons.forEach(pokemon => {
          spawn_points.push({orig_cell: orig_cell, lat: pokemon.latitude, lng: pokemon.longitude, sid: pokemon.spawn_point_id})
        })
        ipc.of.Controller.emit('yesthing', spawn_points);
      }
    })
    return;
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
