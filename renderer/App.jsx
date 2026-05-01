import React, { useEffect, useCallback, useRef } from 'react';
import useDocumentStore from './store/documentStore';
import useToolStore from './store/toolStore';
import useUIStore from './store/uiStore';
import useSettingsStore from './store/settingsStore';
import PageCanvas from './components/Canvas/PageCanvas';
import LeftToolbar from './components/Toolbar/LeftToolbar';
import PropertiesPanel from './components/Properties/PropertiesPanel';
import PagePanel from './components/Pages/PagePanel';
import BottomBar from './components/BottomBar/BottomBar';
import SettingsModal from './components/Settings/SettingsModal';
import ContextMenu from './components/common/ContextMenu';

const electron = window.require ? window.require('electron') : null;
const ipcRenderer = electron ? electron.ipcRenderer : null;

// Parse a shortcut string like "Ctrl+Shift+Z" into components
function parseShortcut(shortcut) {
  if (!shortcut) return null;
  const parts = shortcut.split('+');
  const key = parts[parts.length - 1];
  return {
    ctrl: parts.includes('Ctrl'),
    shift: parts.includes('Shift'),
    alt: parts.includes('Alt'),
    key: key.toLowerCase()
  };
}

// Check if a keyboard event matches a shortcut
function matchesShortcut(e, shortcut) {
  const parsed = parseShortcut(shortcut);
  if (!parsed) return false;

  const ctrl = e.ctrlKey || e.metaKey;
  const shift = e.shiftKey;
  const alt = e.altKey;

  if (parsed.ctrl !== ctrl) return false;
  if (parsed.shift !== shift) return false;
  if (parsed.alt !== alt) return false;

  let eventKey = e.key.toLowerCase();
  if (eventKey === ' ') eventKey = 'space';
  else if (eventKey === 'arrowup') eventKey = 'up';
  else if (eventKey === 'arrowdown') eventKey = 'down';
  else if (eventKey === 'arrowleft') eventKey = 'left';
  else if (eventKey === 'arrowright') eventKey = 'right';

  return eventKey === parsed.key.toLowerCase();
}

export default function App() {
  const isBlankScreen = useUIStore(s => s.isBlankScreen);
  const blankScreenColor = useUIStore(s => s.blankScreenColor);
  const boardBackground = useUIStore(s => s.boardBackground);
  const autoSaveTimerRef = useRef(null);
  const keybindings = useSettingsStore(s => s.keybindings);

  // Initialize stores on mount
  useEffect(() => {
    useDocumentStore.getState().init();
    useSettingsStore.getState().loadSettings().then(() => {
      // Restore saved background
      const saved = useSettingsStore.getState().boardBackground;
      if (saved) {
        useUIStore.getState().setBoardBackground(saved);
      }
    });
  }, []);

  // Apply UI theme based on board background
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light');
    if (boardBackground === 'black') {
      root.classList.add('theme-dark');
    } else {
      root.classList.add('theme-light');
    }
  }, [boardBackground]);

  // Check for crash recovery on startup
  useEffect(() => {
    if (!ipcRenderer) return;

    ipcRenderer.invoke('file:check-auto-save').then(async (result) => {
      if (result.exists) {
        const confirmed = await ipcRenderer.invoke('dialog:confirm', {
          title: 'Crash Recovery',
          message: 'An auto-save file was found. Would you like to restore it?',
          detail: `Last modified: ${result.modifiedTime}`
        });

        if (confirmed) {
          const loaded = await ipcRenderer.invoke('file:load', result.path);
          if (loaded.success) {
            useDocumentStore.getState().loadFromData(loaded.data);
          }
        }

        await ipcRenderer.invoke('file:delete-auto-save');
      }
    });
  }, []);

  // Auto-save timer
  useEffect(() => {
    if (!ipcRenderer) return;

    const interval = useSettingsStore.getState().autoSaveInterval * 1000;
    autoSaveTimerRef.current = setInterval(async () => {
      const state = useDocumentStore.getState();
      if (!state.isDirty) return;

      const data = state.getSerializableData();
      await ipcRenderer.invoke('file:auto-save', data);
    }, interval);

    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, []);

  // Menu action handler (from native menu via IPC)
  useEffect(() => {
    if (!ipcRenderer) return;

    const handleMenuAction = async (event, action, extra) => {
      const doc = useDocumentStore.getState();
      const ui = useUIStore.getState();

      switch (action) {
        case 'new-document':
          doc.newDocument();
          break;

        case 'open-file': {
          const filePath = await ipcRenderer.invoke('dialog:open-file');
          if (filePath) {
            const result = await ipcRenderer.invoke('file:load', filePath);
            if (result.success) {
              doc.loadFromData(result.data);
              doc.setFilePath(filePath);
            }
          }
          break;
        }

        case 'save-file': {
          let filePath = doc.currentFilePath;
          if (!filePath) {
            filePath = await ipcRenderer.invoke('dialog:save-file');
          }
          if (filePath) {
            const data = doc.getSerializableData();
            await ipcRenderer.invoke('file:save', { filePath, data });
            doc.setFilePath(filePath);
            doc.setDirty(false);
          }
          break;
        }

        case 'save-file-as': {
          const filePath = await ipcRenderer.invoke('dialog:save-file');
          if (filePath) {
            const data = doc.getSerializableData();
            await ipcRenderer.invoke('file:save', { filePath, data });
            doc.setFilePath(filePath);
            doc.setDirty(false);
          }
          break;
        }

        case 'import-image': {
          const result = await ipcRenderer.invoke('dialog:import-image');
          if (result) {
            const img = new Image();
            img.onload = () => {
              const { generateId } = require('./utils/uuid');
              const imgObj = {
                id: generateId(),
                type: 'image',
                src: result.data,
                bounds: { x: 100, y: 100, w: img.naturalWidth, h: img.naturalHeight },
                transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
                visible: true,
                locked: false
              };
              doc.addObject(imgObj);
            };
            img.src = result.data;
          }
          break;
        }

        case 'import-pdf': {
          const filePath = await ipcRenderer.invoke('dialog:open-file-raw', {
            title: 'Import PDF',
            filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
          });
          if (filePath) {
            try {
              const fileData = await ipcRenderer.invoke('file:read-binary', filePath);
              if (fileData) {
                const { importPDFToDocument } = require('./export/importPDF');
                const pageCount = await importPDFToDocument(fileData.buffer || fileData, useDocumentStore);
                console.log(`[PDF Import] Imported ${pageCount} pages`);
              }
            } catch (err) {
              console.error('[PDF Import] Failed:', err);
            }
          }
          break;
        }

        case 'export-image': {
          const filePath = await ipcRenderer.invoke('dialog:export-image');
          if (filePath) {
            const canvas = document.getElementById('main-canvas');
            if (canvas) {
              const dataUrl = canvas.toDataURL(filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') ? 'image/jpeg' : 'image/png');
              await ipcRenderer.invoke('file:export', { filePath, data: dataUrl });
            }
          }
          break;
        }

        case 'export-pdf': {
          const filePath = await ipcRenderer.invoke('dialog:export-pdf');
          if (filePath) {
            const { exportPDF } = require('./export/exportPDF');
            const data = doc.getSerializableData();
            await exportPDF(filePath, data, ipcRenderer);
          }
          break;
        }

        case 'export-svg': {
          const filePath = await ipcRenderer.invoke('dialog:export-svg');
          if (filePath) {
            const { exportSVG } = require('./export/exportSVG');
            const page = doc.getCurrentPage();
            const svg = exportSVG(page);
            await ipcRenderer.invoke('file:export', { filePath, data: svg });
          }
          break;
        }

        case 'undo': doc.undo(); break;
        case 'redo': doc.redo(); break;
        case 'cut': doc.cutSelection(); break;
        case 'copy': doc.copySelection(); break;
        case 'paste': doc.pasteClipboard(); break;
        case 'duplicate': doc.duplicateSelection(); break;
        case 'select-all': doc.selectAll(); break;
        case 'clear-page': doc.clearPage(); break;
        case 'delete-selection': doc.removeObjects(doc.selectedObjectIds); break;

        case 'zoom-in': ui.zoomIn(); break;
        case 'zoom-out': ui.zoomOut(); break;
        case 'zoom-fit': ui.zoomFit(); break;
        case 'zoom-100': ui.zoom100(); break;
        case 'reset-view': ui.setZoom(1.0); ui.setPanOffset({ x: 0, y: 0 }); break;

        case 'toggle-page-panel': ui.setShowPagePanel(extra); break;
        case 'toggle-properties-panel': ui.setShowPropertiesPanel(extra); break;
        case 'toggle-grid': ui.setShowGrid(extra); break;
        case 'toggle-fullscreen': ui.toggleFullscreen(); break;
        case 'blank-screen': ui.toggleBlankScreen(); break;
        case 'open-settings': ui.setShowSettings(true); break;
        case 'show-shortcuts': ui.setShowSettings(true); break;
      }
    };

    ipcRenderer.on('menu-action', handleMenuAction);
    return () => ipcRenderer.removeListener('menu-action', handleMenuAction);
  }, []);

  // Configurable keyboard shortcuts from settingsStore
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const kb = keybindings;

      // Tool switching shortcuts
      if (matchesShortcut(e, kb.pen)) { useToolStore.getState().setActiveTool('pen'); e.preventDefault(); return; }
      if (matchesShortcut(e, kb.eraser)) { useToolStore.getState().setActiveTool('eraser'); e.preventDefault(); return; }
      if (matchesShortcut(e, kb.select)) { useToolStore.getState().setActiveTool('select'); e.preventDefault(); return; }
      if (matchesShortcut(e, kb.text)) { useToolStore.getState().setActiveTool('text'); e.preventDefault(); return; }
      if (matchesShortcut(e, kb.line)) { useToolStore.getState().setActiveTool('line'); e.preventDefault(); return; }
      if (matchesShortcut(e, kb.highlighter)) { useToolStore.getState().setActiveTool('highlighter'); e.preventDefault(); return; }
      if (matchesShortcut(e, kb.laser)) { useToolStore.getState().setActiveTool('laser'); e.preventDefault(); return; }
      if (matchesShortcut(e, kb.rectangle)) { useToolStore.getState().setActiveTool('rectangle'); e.preventDefault(); return; }
      if (matchesShortcut(e, kb.ellipse)) { useToolStore.getState().setActiveTool('ellipse'); e.preventDefault(); return; }

      // Escape always = select
      if (e.key === 'Escape') { useToolStore.getState().setActiveTool('select'); e.preventDefault(); return; }

      // Edit shortcuts
      if (matchesShortcut(e, kb.undo)) { useDocumentStore.getState().undo(); e.preventDefault(); return; }
      if (matchesShortcut(e, kb.redo)) { useDocumentStore.getState().redo(); e.preventDefault(); return; }
      if (matchesShortcut(e, kb.redoAlt)) { useDocumentStore.getState().redo(); e.preventDefault(); return; }
      if (matchesShortcut(e, kb.copy)) { useDocumentStore.getState().copySelection(); e.preventDefault(); return; }
      if (matchesShortcut(e, kb.paste)) { useDocumentStore.getState().pasteClipboard(); e.preventDefault(); return; }
      if (matchesShortcut(e, kb.cut)) { useDocumentStore.getState().cutSelection(); e.preventDefault(); return; }
      if (matchesShortcut(e, kb.duplicate)) { useDocumentStore.getState().duplicateSelection(); e.preventDefault(); return; }
      if (matchesShortcut(e, kb.selectAll)) { useDocumentStore.getState().selectAll(); e.preventDefault(); return; }

      // Delete
      if (matchesShortcut(e, kb.delete) || matchesShortcut(e, kb.deleteAlt)) {
        const doc = useDocumentStore.getState();
        if (doc.selectedObjectIds.length > 0) {
          doc.removeObjects(doc.selectedObjectIds);
          e.preventDefault();
        }
        return;
      }

      // View shortcuts
      if (matchesShortcut(e, kb.zoomIn)) { useUIStore.getState().zoomIn(); e.preventDefault(); return; }
      if (matchesShortcut(e, kb.zoomOut)) { useUIStore.getState().zoomOut(); e.preventDefault(); return; }
      if (matchesShortcut(e, kb.zoomFit)) { useUIStore.getState().zoomFit(); e.preventDefault(); return; }
      if (matchesShortcut(e, kb.blankScreen)) { useUIStore.getState().toggleBlankScreen(); e.preventDefault(); return; }
      if (matchesShortcut(e, kb.resetView)) {
        useUIStore.setState({ zoom: 1.0, panOffset: { x: 0, y: 0 } });
        e.preventDefault();
        return;
      }

      // File shortcuts (handled by menu accelerators too, but this catches them in dev mode)
      if (matchesShortcut(e, kb.save)) {
        ipcRenderer?.invoke('dialog:save-file-or-save');
        e.preventDefault();
        return;
      }

      // Page navigation
      if (matchesShortcut(e, kb.nextPage)) { useDocumentStore.getState().goToNextPage(); e.preventDefault(); return; }
      if (matchesShortcut(e, kb.prevPage)) { useDocumentStore.getState().goToPrevPage(); e.preventDefault(); return; }
      if (matchesShortcut(e, kb.newPage)) { useDocumentStore.getState().addPage(); e.preventDefault(); return; }

      // F11
      if (e.key === 'F11') {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keybindings]);

  // Clipboard paste (images from clipboard)
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          const reader = new FileReader();
          reader.onload = () => {
            const img = new Image();
            img.onload = () => {
              const { generateId } = require('./utils/uuid');
              const imgObj = {
                id: generateId(),
                type: 'image',
                src: reader.result,
                bounds: { x: 100, y: 100, w: img.naturalWidth, h: img.naturalHeight },
                transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
                visible: true,
                locked: false
              };
              useDocumentStore.getState().addObject(imgObj);
            };
            img.src = reader.result;
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  return (
    <div className="app-container" id="app-container">
      {isBlankScreen && (
        <div
          className={`blank-screen-overlay ${blankScreenColor}`}
          onClick={() => useUIStore.getState().setBlankScreen(false)}
        />
      )}

      <div className="app-body">
        <LeftToolbar />
        <PageCanvas />
        <div className="right-panel">
          <PropertiesPanel />
          <PagePanel />
        </div>
      </div>

      <BottomBar />

      <SettingsModal />
      <ContextMenu />
    </div>
  );
}
