const {app, BrowserWindow, ipcMain} = require('electron');
const path = require('path');
const url = require('url');

let win;

function solve(cap_url, site_key) {
  win = new BrowserWindow({useContentSize:true});

  win.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: "file"
  }));

  win.on('closed', () => {
    win = null;
  });
}

module.exports = solve;