const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { buildMenu } = require('./menu');
const { registerIpcHandlers } = require('./ipc-handlers');
const { checkForUpdates } = require('./auto-updater');

let mainWindow = null;

function createMainWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1400, width),
    height: Math.min(900, height),
    minWidth: 800,
    minHeight: 600,
    title: 'Contrary Whiteboard',
    icon: path.join(__dirname, '..', 'assets', 'icon.svg'),
    backgroundColor: '#1E1E1E',
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  // Load renderer
  const isDev = !app.isPackaged;
  if (isDev) {
    // In dev, try webpack-dev-server first, fallback to dist
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html')).catch(() => {
      mainWindow.loadURL('http://localhost:9000');
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Build native menu
  buildMenu(mainWindow);

  return mainWindow;
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();

  // Check for updates silently after 3 seconds
  setTimeout(() => {
    checkForUpdates(true).catch(() => {});
  }, 3000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Expose mainWindow getter for other modules
function getMainWindow() {
  return mainWindow;
}

module.exports = { getMainWindow };
