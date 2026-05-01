const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const JSZip = require('jszip');

const AUTO_SAVE_FILENAME = 'contrary-whiteboard-autosave.cwb';

function getAutoSavePath() {
  return path.join(app.getPath('userData'), AUTO_SAVE_FILENAME);
}

// Save document as .cwb (JSON zipped with JSZip)
async function saveDocument(filePath, documentData) {
  try {
    const zip = new JSZip();
    const jsonStr = JSON.stringify(documentData, null, 0);
    zip.file('document.json', jsonStr);

    // If there are embedded assets, store them separately in the zip
    if (documentData.assets) {
      const assetsFolder = zip.folder('assets');
      for (const [assetId, assetData] of Object.entries(documentData.assets)) {
        // assetData is base64 data URI — strip prefix and store raw
        const parts = assetData.split(',');
        const raw = parts.length > 1 ? parts[1] : parts[0];
        assetsFolder.file(assetId, raw, { base64: true });
      }
    }

    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    fs.writeFileSync(filePath, buffer);
    return { success: true };
  } catch (err) {
    console.error('Save failed:', err);
    return { success: false, error: err.message };
  }
}

// Load .cwb file
async function loadDocument(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(buffer);

    const jsonFile = zip.file('document.json');
    if (!jsonFile) {
      return { success: false, error: 'Invalid .cwb file: no document.json found' };
    }

    const jsonStr = await jsonFile.async('string');
    const documentData = JSON.parse(jsonStr);

    // Restore assets from zip if present
    const assetsFolder = zip.folder('assets');
    if (assetsFolder) {
      const assetFiles = [];
      assetsFolder.forEach((relativePath, file) => {
        assetFiles.push({ relativePath, file });
      });

      if (!documentData.assets) documentData.assets = {};
      for (const { relativePath, file } of assetFiles) {
        const base64 = await file.async('base64');
        // Try to guess MIME from the stored metadata, default to png
        documentData.assets[relativePath] = `data:image/png;base64,${base64}`;
      }
    }

    return { success: true, data: documentData };
  } catch (err) {
    console.error('Load failed:', err);
    return { success: false, error: err.message };
  }
}

// Export raw binary data (PNG, PDF, SVG, etc.)
async function exportFile(filePath, data) {
  try {
    if (typeof data === 'string') {
      // Could be base64 data URI or raw text (SVG)
      if (data.startsWith('data:')) {
        const parts = data.split(',');
        const raw = Buffer.from(parts[1], 'base64');
        fs.writeFileSync(filePath, raw);
      } else {
        fs.writeFileSync(filePath, data, 'utf-8');
      }
    } else if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
      fs.writeFileSync(filePath, Buffer.from(data));
    } else {
      fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
    }
    return { success: true };
  } catch (err) {
    console.error('Export failed:', err);
    return { success: false, error: err.message };
  }
}

// Auto-save to temp location (non-blocking, runs in main process)
async function autoSave(documentData) {
  try {
    const autoSavePath = getAutoSavePath();
    const zip = new JSZip();
    zip.file('document.json', JSON.stringify(documentData, null, 0));
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 1 } });
    fs.writeFileSync(autoSavePath, buffer);
    return { success: true, path: autoSavePath };
  } catch (err) {
    console.error('Auto-save failed:', err);
    return { success: false, error: err.message };
  }
}

// Check if auto-save file exists (for crash recovery)
async function getAutoSaveFile() {
  const autoSavePath = getAutoSavePath();
  if (fs.existsSync(autoSavePath)) {
    try {
      const stat = fs.statSync(autoSavePath);
      return {
        exists: true,
        path: autoSavePath,
        modifiedTime: stat.mtime.toISOString(),
        size: stat.size
      };
    } catch (e) {
      return { exists: false };
    }
  }
  return { exists: false };
}

// Delete auto-save file
async function deleteAutoSave() {
  const autoSavePath = getAutoSavePath();
  try {
    if (fs.existsSync(autoSavePath)) {
      fs.unlinkSync(autoSavePath);
    }
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = { saveDocument, loadDocument, exportFile, autoSave, getAutoSaveFile, deleteAutoSave };
