const yaml = require('js-yaml');
const {readFileSync, readdir} = require('fs');
const config = yaml.safeLoad(readFileSync('../config.yaml'));

const getCell = require('../lib/getCell');

let sum = 0;

getCell.main(config.areas).then(() => {
  readdir('../cell_files/', (err, cell_files) => {
    cell_files.forEach(file => {
      const read = JSON.parse(readFileSync(`../cell_files/${file}`).toString());
      sum += read.length;
      console.log(`File ${file} has ${read.length} cells.`);
    });
    console.log(`Total cell count: ${sum}`);
  });
});