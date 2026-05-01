const { BrowserWindow, screen } = require('electron');
const path = require('path');

let audienceWindow = null;

function getDisplays() {
  const displays = screen.getAllDisplays();
  return displays.map((d, i) => ({
    id: d.id,
    label: `Display ${i + 1}${d.id === screen.getPrimaryDisplay().id ? ' (Primary)' : ''}`,
    bounds: d.bounds,
    isPrimary: d.id === screen.getPrimaryDisplay().id
  }));
}

function createAudienceWindow(displayId) {
  if (audienceWindow && !audienceWindow.isDestroyed()) {
    audienceWindow.close();
  }

  const displays = screen.getAllDisplays();
  let targetDisplay = displays.find(d => d.id === displayId);

  // If no specific display requested, use a non-primary display
  if (!targetDisplay) {
    targetDisplay = displays.find(d => d.id !== screen.getPrimaryDisplay().id);
  }

  // Fallback to primary if no secondary found
  if (!targetDisplay) {
    targetDisplay = screen.getPrimaryDisplay();
  }

  const { x, y, width, height } = targetDisplay.bounds;

  audienceWindow = new BrowserWindow({
    x, y,
    width, height,
    fullscreen: true,
    frame: false,
    resizable: false,
    backgroundColor: '#FFFFFF',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Load a minimal audience view HTML
  audienceWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #fff; overflow: hidden; width: 100vw; height: 100vh; }
        canvas { width: 100vw; height: 100vh; display: block; }
      </style>
    </head>
    <body>
      <canvas id="audience-canvas"></canvas>
      <script>
        const { ipcRenderer } = require('electron');
        const canvas = document.getElementById('audience-canvas');
        const ctx = canvas.getContext('2d');

        function resize() {
          canvas.width = window.innerWidth * window.devicePixelRatio;
          canvas.height = window.innerHeight * window.devicePixelRatio;
          ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }
        resize();
        window.addEventListener('resize', resize);

        ipcRenderer.on('audience:update-canvas', (event, dataUrl) => {
          if (!dataUrl) return;
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, window.innerWidth, window.innerHeight);
          };
          img.src = dataUrl;
        });

        // Escape to close audience view
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            ipcRenderer.send('display:close-audience');
          }
        });
      </script>
    </body>
    </html>
  `)}`);

  audienceWindow.on('closed', () => {
    audienceWindow = null;
  });

  return { success: true, displayId: targetDisplay.id };
}

function closeAudienceWindow() {
  if (audienceWindow && !audienceWindow.isDestroyed()) {
    audienceWindow.close();
    audienceWindow = null;
  }
  return true;
}

function getAudienceWindow() {
  return audienceWindow;
}

module.exports = { getDisplays, createAudienceWindow, closeAudienceWindow, getAudienceWindow };
