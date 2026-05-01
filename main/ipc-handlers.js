const { ipcMain, dialog, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { saveDocument, loadDocument, exportFile, autoSave, getAutoSaveFile, deleteAutoSave } = require('./file-manager');
const { getDisplays, createAudienceWindow, closeAudienceWindow } = require('./display-manager');

function registerIpcHandlers() {
  // ---- FILE DIALOGS ----
  ipcMain.handle('dialog:open-file', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open Whiteboard',
      filters: [
        { name: 'Contrary Whiteboard', extensions: ['cwb'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('dialog:save-file', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Save Whiteboard',
      defaultPath: 'Untitled.cwb',
      filters: [
        { name: 'Contrary Whiteboard', extensions: ['cwb'] }
      ]
    });
    if (result.canceled) return null;
    return result.filePath;
  });

  ipcMain.handle('dialog:import-image', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import Image',
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'] }
      ],
      properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', webp: 'image/webp' }[ext] || 'image/png';
    const base64 = `data:${mime};base64,${data.toString('base64')}`;
    return { path: filePath, data: base64, name: path.basename(filePath) };
  });

  ipcMain.handle('dialog:import-pdf', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import PDF',
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] }
      ],
      properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const data = fs.readFileSync(filePath);
    const base64 = `data:application/pdf;base64,${data.toString('base64')}`;
    return { path: filePath, data: base64, name: path.basename(filePath) };
  });

  ipcMain.handle('dialog:export-image', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Export as Image',
      defaultPath: 'whiteboard.png',
      filters: [
        { name: 'PNG Image', extensions: ['png'] },
        { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }
      ]
    });
    if (result.canceled) return null;
    return result.filePath;
  });

  ipcMain.handle('dialog:export-pdf', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Export as PDF',
      defaultPath: 'whiteboard.pdf',
      filters: [
        { name: 'PDF Document', extensions: ['pdf'] }
      ]
    });
    if (result.canceled) return null;
    return result.filePath;
  });

  ipcMain.handle('dialog:export-svg', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Export as SVG',
      defaultPath: 'whiteboard.svg',
      filters: [
        { name: 'SVG File', extensions: ['svg'] }
      ]
    });
    if (result.canceled) return null;
    return result.filePath;
  });

  ipcMain.handle('dialog:export-ubz', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Export as OpenBoard (.ubz)',
      defaultPath: 'whiteboard.ubz',
      filters: [
        { name: 'OpenBoard Format', extensions: ['ubz'] }
      ]
    });
    if (result.canceled) return null;
    return result.filePath;
  });

  // ---- FILE I/O ----
  ipcMain.handle('file:save', async (event, { filePath, data }) => {
    return saveDocument(filePath, data);
  });

  ipcMain.handle('file:load', async (event, filePath) => {
    return loadDocument(filePath);
  });

  ipcMain.handle('file:export', async (event, { filePath, data }) => {
    return exportFile(filePath, data);
  });

  ipcMain.handle('file:auto-save', async (event, data) => {
    return autoSave(data);
  });

  ipcMain.handle('file:check-auto-save', async () => {
    return getAutoSaveFile();
  });

  ipcMain.handle('file:delete-auto-save', async () => {
    return deleteAutoSave();
  });

  ipcMain.handle('file:write-binary', async (event, { filePath, buffer }) => {
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return true;
  });

  // ---- DISPLAY ----
  ipcMain.handle('display:get-displays', async () => {
    return getDisplays();
  });

  ipcMain.handle('display:open-audience', async (event, displayId) => {
    return createAudienceWindow(displayId);
  });

  ipcMain.handle('display:close-audience', async () => {
    return closeAudienceWindow();
  });

  ipcMain.on('display:sync-canvas', (event, canvasData) => {
    // Forward to audience window if it exists
    const { getAudienceWindow } = require('./display-manager');
    const audienceWin = getAudienceWindow();
    if (audienceWin && !audienceWin.isDestroyed()) {
      audienceWin.webContents.send('audience:update-canvas', canvasData);
    }
  });

  // ---- SETTINGS ----
  ipcMain.handle('settings:get-path', async () => {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'settings.json');
  });

  ipcMain.handle('settings:load', async () => {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    try {
      if (fs.existsSync(settingsPath)) {
        const data = fs.readFileSync(settingsPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
    return null;
  });

  ipcMain.handle('settings:save', async (event, settings) => {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    try {
      const dir = path.dirname(settingsPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
      return true;
    } catch (e) {
      console.error('Failed to save settings:', e);
      return false;
    }
  });

  // ---- APP INFO ----
  ipcMain.handle('app:get-version', async () => {
    return app.getVersion();
  });

  // ---- CONFIRM DIALOG ----
  ipcMain.handle('dialog:confirm', async (event, { title, message, detail }) => {
    const result = await dialog.showMessageBox({
      type: 'question',
      title: title || 'Confirm',
      message: message || 'Are you sure?',
      detail: detail || '',
      buttons: ['Yes', 'No'],
      defaultId: 0,
      cancelId: 1
    });
    return result.response === 0;
  });
}

module.exports = { registerIpcHandlers };
