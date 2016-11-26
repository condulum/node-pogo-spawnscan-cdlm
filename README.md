# Still a WIP, ACTIVELY WORKING ON IT.
# Next task: fix README.

(Before we start, you should also check out [TODO](./TODO.md))

(I've come to a conclusion that one README.md is not enough to explain how this program works. Check wiki.)

Welcome to node-pogo-scanspawn-cdlm.

### Objective

Scans for spawns that Niantic enabled.

### Background

Spawn points are all level 20 cells. Niantic could enable and disable spawn points. This is why there are spawn point changes.

This application attemps to scan all the spawn points at a given location / a given area.

### Requirements

- `node >= 6.0.0`

### Configuration

See wiki.Configuration.

### Usage

#### `scanSpawn.js`

Usage: `node scanSpawn.js` or `npm start`.

This starts the main program. (In the future, I might add a REPL flag to start the application in REPL mode.)

#### `csv2yaml.js`

Usage: `node csv2yaml.js`

Turns your accounts.csv into accounts.yaml. (Soon to implement the feature for all csv files, or just read from csv.)

#### `helper_scripts/calibrate_time.js` [NOT IMPLEMENTED YET]

Usage: `node calibrate_time.js [--file=your_scanned_file.json]`

Calibrates the time of the scanned spawn point. Must only be run after scanSpawn.

If no file is passed, the program will calibrate all of them.

#### `helper_scripts/getCellTest.js`

Usage: `node getCellTest.js`

Gets all cells at the point defined in config.yaml (soon to be transferred to locations.yaml)

#### `helper_scripts/check_challenge.js`

Usage: `node check_challenge.js`

Loops through all your accounts and check if any challenge is unsolved. If there is, solve it with 2captcha, manually (electron new window), or just show you which accounts are capped.

# Note

You are welcome to use any of the code in your project. You just have to LET ME KNOW. 