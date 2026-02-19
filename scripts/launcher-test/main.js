const { app, BrowserWindow } = require('electron');
const path = require('path');
function createWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 260,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true }
  });
  win.setMenu(null);
  win.loadFile(path.join(__dirname, 'index.html'));
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
