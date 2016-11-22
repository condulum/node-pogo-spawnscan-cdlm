# Still a WIP, ACTIVELY WORKING ON IT.

Before we start, the following "Next task" is a note on what I'm currently working on.

## Next task: fix README.

Welcome to node-pogo-scanspawn-cdlm. This scanner scans for spawns that Niantic enabled.

This scanner comes with 3 functions.

###`getCell.js`

`getCell.js` lets you get all the cell ids in a certain area, with custom tags.

Imagine you have an area with different districts and you want to tag them, e.g. Central London (Zone 1), Stratford (Zone 2), Wimbledon (Greater London), etc.

```json
{
  "zone1": [[11.1493521821, 0.5918317346], [11.1501823124, 0.1754091892]],
  "zone2": [[14.1936018356, 0.1029581271]]
}
```
and so on...

The files generated with `getCell.js` can then be passed into `scanSpawns.js`.

###`scanSpawns.js`

This is the main scanner. It scans the cells every 10 minutes (time), up to 6 times (scan interval). (configurable)

This scanner has 2 modes,
1. Large Area Scan - This mode lets you define the area and get all the cells within that area, using cell level 17 (configurable). (This mode is not recommended as you will get ALL the spawn points within that area, takes a long time to scan.)
2. Generated Area Scan - This mode lets you use a pre-generated JSON file containing an array of cell ids, generated from `getCell.js`.

Table for different time, scan interval combination for cell level 15, 16, 17 and 18. (Basic maths calculation)
