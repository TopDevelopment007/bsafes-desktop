const {app, BrowserWindow, ipcMain} = require('electron')
const path = require('path')
const url = require('url')
const fs = require('fs')
const ejse = require('ejs-electron')
var sqlite3 = require('sqlite3').verbose();
var databaseFile = 'BSafes.db';
var db = null;
var arrDownloadQueue = [];
var threads = require('./thread.js');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

global.sqliteDB = db;

function createWindow () {
  // Create the browser window.
  win = new BrowserWindow({
    width: 900, 
    height: 700,
    webPreferences: {
        //nodeIntegration: false,
        preload: path.join(__dirname, 'preload.js')
    }
  })

  ejse.data('masterId', 'F_hRPgswTh1se8DuWy6762ojHUWOvn6dch4KIvaIo4flg=')
  ejse.data('displayMasterId', '2339894959580958')
  //ejse.data('isDemo', true)

  // and load the index.html of the app.
  win.loadURL(url.format({
    pathname: path.join(__dirname, 'Bsafes/views/managedMemberSignIn.ejs'),
    protocol: 'file:',
    slashes: true
  }))
  //win.loadURL("views/managedMemberSignIn.ejs")
  //win.loadURL("views/Local.html")

  //win.setMenu(null);
  // Open the DevTools.
  win.webContents.openDevTools()

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
  })
}

function initSQLiteDB()
{
  // check whether database file exists...
  fs.access(databaseFile, fs.F_OK, (err) => {
    if (err) {
      //console.error(err)
      fs.closeSync(fs.openSync(databaseFile, 'w'));
      //return;
    }
    //file exists
    db = new sqlite3.Database(databaseFile, (err) => {
      if (err) {
        return console.error(err.message);
      }
      console.log('Connected to the BSafes SQlite database.');
    });

    global.sqliteDB = db;

    db.serialize(function() {
      sql = "CREATE TABLE IF NOT EXISTS 'teamList' (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, jsonData BLOB, total TEXT, downloaded TEXT); ";
      db.run(sql);

      sql = "CREATE TABLE IF NOT EXISTS 'downloadList' (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, itemId TEXT); ";
      db.run(sql);

      sql = "CREATE TABLE IF NOT EXISTS 'teams' (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, teamId TEXT, isDownload INTEGER, jsonData BLOB); ";
      db.run(sql);

      sql = "CREATE TABLE IF NOT EXISTS 'containers' (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, containerId TEXT, isDownload INTEGER, jsonData BLOB); ";
      db.run(sql);

      sql = "CREATE TABLE IF NOT EXISTS 'pages' (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, pageId TEXT, containerId TEXT, teamId TEXT, isDownload INTEGER); ";
      db.run(sql);

      sql = "CREATE TABLE IF NOT EXISTS 'pageContents' (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, pageId TEXT, jsonData BLOB); ";
      db.run(sql);

      sql = "CREATE TABLE IF NOT EXISTS 'itemPath' (" +
              "id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, itemId TEXT, jsonData BLOB); ";
      db.run(sql);

      sql = "CREATE TABLE IF NOT EXISTS 'logs' (" +
              "id INTEGER PRIMARY KEY AUTOINCREMENT, itemName TEXT, itemID TEXT, position TEXT, status TEXT, total TEXT, downloaded TEXT, logTime TEXT); ";
      db.run(sql);

      sql = "CREATE TABLE IF NOT EXISTS 'info' (" +
              "id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, jsonData BLOB); ";
      db.run(sql);
      
    });

    //threads.downloadPages(db);
    //threads.downloadPages(db, 'p:mF_hRPgswTh1se8DuWy6762ojHUWOvn6dch4KIvaIo4flg=-1558941669974:1:1559177877327');

  })  
  
}


initSQLiteDB();

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
//   if (process.platform !== 'darwin') {
    app.quit()
    //db.close();
//   }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})

ipcMain.on('show-message', (event, msg) => {
    if (win) {
        win.webContents.send('show-message', msg);
    }

})

//import { spawn, Thread, Worker } from "threads"

global.glbDownload = function(pageId){
    //threads.downloadPages(db, pageId);
}

global.glbConnect = function(url, postData){
    //threads.connectToServer(url, postData);
}

global.glbConnect = function(url, postData){
    //threads.connectToServer(url, postData);
}

global.glbConnectWithKey = function(url, postData){
    //threads.connectToServerWithKey(url, postData);
}