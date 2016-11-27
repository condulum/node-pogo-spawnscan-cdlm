const {app, BrowserWindow, ipcMain} = require('electron');
const path = require('path');
const url = require('url');

let win;

function solve() {
  return new Promise((resolve, reject) => {
    win = new BrowserWindow({useContentSize:true, width: 648, height: 496});

    win.loadURL(url.format({
      pathname: path.join(__dirname, 'index.html'),
      protocol: "file"
    }));

    win.on('closed', () => {
      win = null;
    });

    app.on('window-all-closed', function () {
      reject(new Error("You killed electron."));
      app.quit();
    });

    ipcMain.on('token', (event, token) => {
      app.quit();
      resolve(token);
    });
  });
}



module.exports = solve;