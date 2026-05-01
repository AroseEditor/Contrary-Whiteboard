const { app, dialog, BrowserWindow } = require('electron');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

// ---- CONFIG ----
// Change this to your actual GitHub owner/repo
const GITHUB_OWNER = 'AroseEditor';
const GITHUB_REPO = 'Contrary-Whiteboard';
const UPDATE_CHECK_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

function getAppVersion() {
  return app.getVersion();
}

// Strip 'v' prefix from tag, e.g. "v1.0.0" -> "1.0.0"
function normalizeTag(tag) {
  return tag.replace(/^v/i, '');
}

// Fetch JSON from URL (follows redirects)
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'ContraryWhiteboard-Updater',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    https.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchJSON(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`GitHub API returned ${res.statusCode}`));
      }

      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Download a file from URL to dest path, following redirects
function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const options = {
      headers: { 'User-Agent': 'ContraryWhiteboard-Updater' }
    };

    proto.get(url, options, (res) => {
      // Follow redirects (GitHub uses 302 for asset downloads)
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, destPath, onProgress).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      }

      const totalBytes = parseInt(res.headers['content-length'], 10) || 0;
      let downloadedBytes = 0;

      const file = fs.createWriteStream(destPath);
      res.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (onProgress && totalBytes > 0) {
          onProgress(downloadedBytes, totalBytes);
        }
      });
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(destPath));
      });
      file.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// Figure out which release asset to download for this OS
function findAssetForPlatform(assets) {
  const platform = process.platform;

  for (const asset of assets) {
    const name = asset.name.toLowerCase();

    if (platform === 'win32' && name.endsWith('.exe') && !name.includes('blockmap')) {
      return asset;
    }
    if (platform === 'darwin' && name.endsWith('.dmg')) {
      return asset;
    }
    if (platform === 'linux' && name.endsWith('.appimage')) {
      return asset;
    }
  }
  return null;
}

// Create the update script that closes app, runs installer, shows message
function createUpdateScript(installerPath, installerName) {
  const tmpDir = os.tmpdir();
  const platform = process.platform;

  if (platform === 'win32') {
    const batPath = path.join(tmpDir, 'install_setupwhiteboard.bat');
    const batContent = [
      '@echo off',
      'echo ============================================',
      'echo   Contrary Whiteboard - Auto Update',
      'echo ============================================',
      'echo.',
      'echo Closing app...',
      'timeout /t 2 /nobreak >nul',
      'echo.',
      `echo Running setup: ${installerName}`,
      'echo.',
      `start "" "${installerPath}"`,
      'echo.',
      'echo ============================================',
      'echo   Update installed!',
      'echo ============================================',
      'echo.',
      'pause',
      `del "%~f0"`,
      ''
    ].join('\r\n');

    fs.writeFileSync(batPath, batContent, 'utf-8');
    return batPath;
  }

  if (platform === 'darwin') {
    const shPath = path.join(tmpDir, 'install_setupwhiteboard.sh');
    const shContent = [
      '#!/bin/bash',
      'echo "============================================"',
      'echo "  Contrary Whiteboard - Auto Update"',
      'echo "============================================"',
      'echo ""',
      'echo "Closing app..."',
      'sleep 2',
      'echo ""',
      `echo "Running setup: ${installerName}"`,
      'echo ""',
      `open "${installerPath}"`,
      'echo ""',
      'echo "============================================"',
      'echo "  Update installed!"',
      'echo "============================================"',
      'echo ""',
      'echo "Press any key to close..."',
      'read -n 1 -s',
      `rm -- "$0"`,
      ''
    ].join('\n');

    fs.writeFileSync(shPath, shContent, { mode: 0o755 });
    return shPath;
  }

  if (platform === 'linux') {
    const shPath = path.join(tmpDir, 'install_setupwhiteboard.sh');
    const shContent = [
      '#!/bin/bash',
      'echo "============================================"',
      'echo "  Contrary Whiteboard - Auto Update"',
      'echo "============================================"',
      'echo ""',
      'echo "Closing app..."',
      'sleep 2',
      'echo ""',
      `echo "Running setup: ${installerName}"`,
      `chmod +x "${installerPath}"`,
      `"${installerPath}" &`,
      'echo ""',
      'echo "============================================"',
      'echo "  Update installed!"',
      'echo "============================================"',
      'echo ""',
      'echo "Press any key to close..."',
      'read -n 1 -s',
      `rm -- "$0"`,
      ''
    ].join('\n');

    fs.writeFileSync(shPath, shContent, { mode: 0o755 });
    return shPath;
  }

  return null;
}

// Launch the update script and quit the app
function launchUpdateAndQuit(scriptPath) {
  const platform = process.platform;

  if (platform === 'win32') {
    // Open a visible cmd window running the bat
    spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/c', scriptPath], {
      detached: true,
      stdio: 'ignore'
    }).unref();
  } else {
    // macOS / Linux: open terminal with the script
    if (platform === 'darwin') {
      spawn('open', ['-a', 'Terminal', scriptPath], {
        detached: true,
        stdio: 'ignore'
      }).unref();
    } else {
      // Try common Linux terminals
      const terminals = ['x-terminal-emulator', 'gnome-terminal', 'konsole', 'xterm'];
      let launched = false;
      for (const term of terminals) {
        try {
          if (term === 'gnome-terminal') {
            spawn(term, ['--', 'bash', scriptPath], { detached: true, stdio: 'ignore' }).unref();
          } else {
            spawn(term, ['-e', `bash ${scriptPath}`], { detached: true, stdio: 'ignore' }).unref();
          }
          launched = true;
          break;
        } catch (e) {
          continue;
        }
      }
      if (!launched) {
        spawn('bash', [scriptPath], { detached: true, stdio: 'ignore' }).unref();
      }
    }
  }

  // Quit the app after a brief delay to let the script spawn
  setTimeout(() => {
    app.quit();
  }, 500);
}

// Main update check — call this from main.js after app ready
async function checkForUpdates(silent = true) {
  try {
    const currentVersion = getAppVersion();
    console.log(`[AutoUpdater] Current version: ${currentVersion}`);
    console.log(`[AutoUpdater] Checking ${UPDATE_CHECK_URL}`);

    const release = await fetchJSON(UPDATE_CHECK_URL);
    const latestVersion = normalizeTag(release.tag_name);

    console.log(`[AutoUpdater] Latest release: ${latestVersion} (tag: ${release.tag_name})`);

    // Version matches — we're up to date
    if (currentVersion === latestVersion) {
      console.log('[AutoUpdater] App is up to date.');
      if (!silent) {
        dialog.showMessageBox({
          type: 'info',
          title: 'Up to Date',
          message: 'Contrary Whiteboard is up to date.',
          detail: `Current version: v${currentVersion}`
        });
      }
      return false;
    }

    // New version available
    console.log(`[AutoUpdater] Update available: ${currentVersion} -> ${latestVersion}`);

    const asset = findAssetForPlatform(release.assets || []);
    if (!asset) {
      console.log('[AutoUpdater] No compatible asset found for this platform.');
      if (!silent) {
        dialog.showMessageBox({
          type: 'warning',
          title: 'Update Available',
          message: `A new version (v${latestVersion}) is available, but no installer was found for your platform.`,
          detail: 'Please download manually from GitHub.'
        });
      }
      return false;
    }

    // Ask user if they want to update
    const win = BrowserWindow.getFocusedWindow();
    const response = await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Update Available',
      message: `A new version is available: v${latestVersion}`,
      detail: `You are running v${currentVersion}.\n\nDo you want to download and install the update now?\n\nFile: ${asset.name}`,
      buttons: ['Update Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    });

    if (response.response !== 0) {
      console.log('[AutoUpdater] User declined update.');
      return false;
    }

    // Download the installer to temp
    const tmpDir = os.tmpdir();
    const installerPath = path.join(tmpDir, asset.name);

    console.log(`[AutoUpdater] Downloading ${asset.browser_download_url} -> ${installerPath}`);

    // Show a progress dialog (simple message box — could be fancier with a progress window)
    const progressWin = new BrowserWindow({
      width: 400,
      height: 150,
      resizable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      frame: false,
      alwaysOnTop: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });

    progressWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            margin: 0; padding: 24px;
            font-family: 'Segoe UI', system-ui, sans-serif;
            background: #1E1E1E; color: #F0F0F0;
            display: flex; flex-direction: column;
            justify-content: center; align-items: center;
            height: 100vh; box-sizing: border-box;
            -webkit-app-region: drag;
          }
          .title { font-size: 14px; font-weight: 600; margin-bottom: 16px; }
          .bar-bg {
            width: 100%; height: 8px;
            background: #333; border-radius: 4px; overflow: hidden;
          }
          .bar-fill {
            height: 100%; width: 0%;
            background: #E63946; border-radius: 4px;
            transition: width 0.2s;
          }
          .pct { margin-top: 8px; font-size: 12px; color: #999; }
        </style>
      </head>
      <body>
        <div class="title">Downloading update...</div>
        <div class="bar-bg"><div class="bar-fill" id="fill"></div></div>
        <div class="pct" id="pct">0%</div>
      </body>
      </html>
    `)}`);

    await downloadFile(asset.browser_download_url, installerPath, (downloaded, total) => {
      const pct = Math.round((downloaded / total) * 100);
      try {
        progressWin.webContents.executeJavaScript(
          `document.getElementById('fill').style.width='${pct}%';` +
          `document.getElementById('pct').textContent='${pct}%';`
        ).catch(() => {});
      } catch (e) {
        // Window may have been destroyed
      }
    });

    // Close progress window
    if (!progressWin.isDestroyed()) {
      progressWin.close();
    }

    console.log(`[AutoUpdater] Download complete: ${installerPath}`);

    // Create the update script
    const scriptPath = createUpdateScript(installerPath, asset.name);
    if (!scriptPath) {
      dialog.showMessageBox({
        type: 'error',
        title: 'Update Error',
        message: 'Could not create update script for this platform.'
      });
      return false;
    }

    console.log(`[AutoUpdater] Update script: ${scriptPath}`);

    // Launch the script and quit
    launchUpdateAndQuit(scriptPath);
    return true;

  } catch (err) {
    console.error('[AutoUpdater] Update check failed:', err.message);
    if (!silent) {
      dialog.showMessageBox({
        type: 'error',
        title: 'Update Check Failed',
        message: 'Could not check for updates.',
        detail: err.message
      });
    }
    return false;
  }
}

module.exports = { checkForUpdates };
