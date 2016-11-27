const Promise = require('bluebird');
const {S2:s2} = require('s2-geometry');
const _ = require('lodash');
const {writeFileSync} = require('fs');

function getCell(lat, lng, radius=3, level=17) {

  const origin = s2.S2Cell.FromLatLng({
    lat: lat,
    lng: lng
  }, level);

  const cells = [];
  cells.push(origin.toHilbertQuadkey());

  for (var i = 1; i < radius; i++) {
    // cross in middle
    cells.push(s2.S2Cell.FromFaceIJ(origin.face, [origin.ij[0], origin.ij[1] - i], origin.level)
        .toHilbertQuadkey());
    cells.push(s2.S2Cell.FromFaceIJ(origin.face, [origin.ij[0], origin.ij[1] + i], origin.level)
        .toHilbertQuadkey());
    cells.push(s2.S2Cell.FromFaceIJ(origin.face, [origin.ij[0] - i, origin.ij[1]], origin.level)
        .toHilbertQuadkey());
    cells.push(s2.S2Cell.FromFaceIJ(origin.face, [origin.ij[0] + i, origin.ij[1]], origin.level)
        .toHilbertQuadkey());

    for (var j = 1; j < radius; j++) {
      cells.push(s2.S2Cell.FromFaceIJ(origin.face, [origin.ij[0] - j, origin.ij[1] - i], origin.level)
          .toHilbertQuadkey());
      cells.push(s2.S2Cell.FromFaceIJ(origin.face, [origin.ij[0] + j, origin.ij[1] - i], origin.level)
          .toHilbertQuadkey());
      cells.push(s2.S2Cell.FromFaceIJ(origin.face, [origin.ij[0] - j, origin.ij[1] + i], origin.level)
          .toHilbertQuadkey());
      cells.push(s2.S2Cell.FromFaceIJ(origin.face, [origin.ij[0] + j, origin.ij[1] + i], origin.level)
          .toHilbertQuadkey());
    }
  }
  /* eslint-enable new-cap */

  return cells.map((cell) => {
    return s2.keyToId(cell);
  });
}

module.exports = {
  main: areas => {
    return new Promise((resolve, reject) => {
      if (areas != undefined) {
        _.each(areas, function(value, key) { //key would be the area's name, value would be a list of lat long
          let all_cells = [];
          value.forEach(latlngobj => {
            let cells = getCell(latlngobj.lat, latlngobj.lng, Math.ceil(latlngobj.rad/37.5), 17);
            all_cells = _.union(all_cells, cells);
          });
          writeFileSync(`./cell_files/${key}`, JSON.stringify(all_cells));
        })
        resolve();
      } else {
        reject(new Error('Areas not defined.'));
      }
    });
  },
  getCell: getCell
};