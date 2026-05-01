const { Menu, dialog, app, BrowserWindow } = require('electron');
const path = require('path');
const { checkForUpdates } = require('./auto-updater');

function buildMenu(mainWindow) {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Document',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('menu-action', 'new-document')
        },
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow.webContents.send('menu-action', 'open-file')
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu-action', 'save-file')
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow.webContents.send('menu-action', 'save-file-as')
        },
        { type: 'separator' },
        {
          label: 'Import Image...',
          click: () => mainWindow.webContents.send('menu-action', 'import-image')
        },
        {
          label: 'Import PDF...',
          click: () => mainWindow.webContents.send('menu-action', 'import-pdf')
        },
        { type: 'separator' },
        {
          label: 'Export',
          submenu: [
            {
              label: 'Export as Image...',
              click: () => mainWindow.webContents.send('menu-action', 'export-image')
            },
            {
              label: 'Export as PDF...',
              accelerator: 'CmdOrCtrl+Shift+E',
              click: () => mainWindow.webContents.send('menu-action', 'export-pdf')
            },
            {
              label: 'Export as SVG...',
              click: () => mainWindow.webContents.send('menu-action', 'export-svg')
            },
            {
              label: 'Export as OpenBoard (.ubz)...',
              click: () => mainWindow.webContents.send('menu-action', 'export-ubz')
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => mainWindow.webContents.send('menu-action', 'undo')
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Y',
          click: () => mainWindow.webContents.send('menu-action', 'redo')
        },
        { type: 'separator' },
        {
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          click: () => mainWindow.webContents.send('menu-action', 'cut')
        },
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          click: () => mainWindow.webContents.send('menu-action', 'copy')
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          click: () => mainWindow.webContents.send('menu-action', 'paste')
        },
        {
          label: 'Duplicate',
          accelerator: 'CmdOrCtrl+D',
          click: () => mainWindow.webContents.send('menu-action', 'duplicate')
        },
        { type: 'separator' },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          click: () => mainWindow.webContents.send('menu-action', 'select-all')
        },
        {
          label: 'Clear Page',
          click: () => mainWindow.webContents.send('menu-action', 'clear-page')
        },
        {
          label: 'Delete',
          accelerator: 'Delete',
          click: () => mainWindow.webContents.send('menu-action', 'delete-selection')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: () => mainWindow.webContents.send('menu-action', 'zoom-in')
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => mainWindow.webContents.send('menu-action', 'zoom-out')
        },
        {
          label: 'Zoom to Fit',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow.webContents.send('menu-action', 'zoom-fit')
        },
        {
          label: 'Zoom 100%',
          click: () => mainWindow.webContents.send('menu-action', 'zoom-100')
        },
        { type: 'separator' },
        {
          label: 'Show Page Panel',
          type: 'checkbox',
          checked: true,
          click: (item) => mainWindow.webContents.send('menu-action', 'toggle-page-panel', item.checked)
        },
        {
          label: 'Show Properties Panel',
          type: 'checkbox',
          checked: true,
          click: (item) => mainWindow.webContents.send('menu-action', 'toggle-properties-panel', item.checked)
        },
        {
          label: 'Show Grid',
          type: 'checkbox',
          checked: false,
          click: (item) => mainWindow.webContents.send('menu-action', 'toggle-grid', item.checked)
        },
        { type: 'separator' },
        {
          label: 'Fullscreen',
          accelerator: 'F11',
          click: () => {
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
            mainWindow.webContents.send('menu-action', 'toggle-fullscreen');
          }
        }
      ]
    },
    {
      label: 'Display',
      submenu: [
        {
          label: 'Blank Screen',
          accelerator: 'B',
          click: () => mainWindow.webContents.send('menu-action', 'blank-screen')
        },
        { type: 'separator' },
        {
          label: 'Use Secondary Display',
          type: 'checkbox',
          checked: false,
          click: (item) => mainWindow.webContents.send('menu-action', 'toggle-secondary-display', item.checked)
        },
        {
          label: 'Mirror Display',
          click: () => mainWindow.webContents.send('menu-action', 'mirror-display')
        }
      ]
    },
    {
      label: 'Settings',
      submenu: [
        {
          label: 'Open Settings',
          click: () => mainWindow.webContents.send('menu-action', 'open-settings')
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          click: () => mainWindow.webContents.send('menu-action', 'show-shortcuts')
        },
        { type: 'separator' },
        {
          label: 'Check for Updates...',
          click: () => checkForUpdates(false)
        },
        { type: 'separator' },
        {
          label: 'About Contrary Whiteboard',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Contrary Whiteboard',
              message: 'Contrary Whiteboard',
              detail: `Version: ${app.getVersion()}\n\nA full-featured digital whiteboard application.\nInspired by OpenBoard.\n\nBuilt with Electron + React + Canvas 2D`,
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = { buildMenu };
