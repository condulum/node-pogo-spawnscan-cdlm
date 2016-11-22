// This script turns csv generated from ptc-acc-gen to yaml.
// TODO: also include support for a csv file that includes lat, lng

const Promise = require('bluebird');
const yml = require('js-yaml');
const csv = require('csv-parse');
const {readFileSync, writeFileSync} = require('fs');

const outputFile = {}

new Promise((resolve, reject) => {
  csv(readFileSync(`./accounts.csv`).toString(), {}, function(err, output) {
    if (err) {
      reject(err)
    } else {
      resolve(output)
    }
  })
})

  .each(account => {
    outputFile.push({type: account[0], username: account[1], password: account[2]})
  })

  .then(() => {
    return writeFileSync('accounts.yaml', yaml.safeDump(outputFile))
  })

  .catch(err => {
    console.error(err)
    process.exit(1)
  })