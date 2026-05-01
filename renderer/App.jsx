import React, { useEffect, useCallback, useRef } from 'react';
import useDocumentStore from './store/documentStore';
import useToolStore from './store/toolStore';
import useUIStore from './store/uiStore';
import PageCanvas from './components/Canvas/PageCanvas';
import LeftToolbar from './components/Toolbar/LeftToolbar';
import PropertiesPanel from './components/Properties/PropertiesPanel';
import PagePanel from './components/Pages/PagePanel';
import BottomBar from './components/BottomBar/BottomBar';
import SettingsModal from './components/Settings/SettingsModal';
import ContextMenu from './components/common/ContextMenu';

const electron = window.require ? window.require('electron') : null;
const ipcRenderer = electron ? electron.ipcRenderer : null;

export default function App() {
  const isBlankScreen = useUIStore(s => s.isBlankScreen);
  const blankScreenColor = useUIStore(s => s.blankScreenColor);
  const autoSaveTimerRef = useRef(null);

  // Initialize document store
  useEffect(() => {
    useDocumentStore.getState().init();
  }, []);

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

        // Delete auto-save file regardless
        await ipcRenderer.invoke('file:delete-auto-save');
      }
    });
  }, []);

  // Auto-save timer
  useEffect(() => {
    if (!ipcRenderer) return;

    autoSaveTimerRef.current = setInterval(async () => {
      const state = useDocumentStore.getState();
      if (!state.isDirty) return;

      const data = state.getSerializableData();
      await ipcRenderer.invoke('file:auto-save', data);
    }, 60000); // every 60 seconds

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
      const tool = useToolStore.getState();

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
            // Dynamic import to avoid loading jsPDF until needed
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't handle shortcuts when typing in inputs
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // Tool shortcuts (single key, no modifiers)
      if (!ctrl && !shift && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'p': useToolStore.getState().setActiveTool('pen'); e.preventDefault(); return;
          case 'e': useToolStore.getState().setActiveTool('eraser'); e.preventDefault(); return;
          case 's': useToolStore.getState().setActiveTool('select'); e.preventDefault(); return;
          case 'escape': useToolStore.getState().setActiveTool('select'); e.preventDefault(); return;
          case 't': useToolStore.getState().setActiveTool('text'); e.preventDefault(); return;
          case 'l': useToolStore.getState().setActiveTool('line'); e.preventDefault(); return;
          case 'h': useToolStore.getState().setActiveTool('highlighter'); e.preventDefault(); return;
          case 'b': useUIStore.getState().toggleBlankScreen(); e.preventDefault(); return;
          case 'delete':
          case 'backspace': {
            const doc = useDocumentStore.getState();
            if (doc.selectedObjectIds.length > 0) {
              doc.removeObjects(doc.selectedObjectIds);
              e.preventDefault();
            }
            return;
          }
          case 'pagedown': useDocumentStore.getState().goToNextPage(); e.preventDefault(); return;
          case 'pageup': useDocumentStore.getState().goToPrevPage(); e.preventDefault(); return;
        }
      }

      // Ctrl shortcuts
      if (ctrl && !shift) {
        switch (e.key.toLowerCase()) {
          case 'z': useDocumentStore.getState().undo(); e.preventDefault(); return;
          case 'y': useDocumentStore.getState().redo(); e.preventDefault(); return;
          case 'c': useDocumentStore.getState().copySelection(); e.preventDefault(); return;
          case 'v': useDocumentStore.getState().pasteClipboard(); e.preventDefault(); return;
          case 'x': useDocumentStore.getState().cutSelection(); e.preventDefault(); return;
          case 'd': useDocumentStore.getState().duplicateSelection(); e.preventDefault(); return;
          case 'a': useDocumentStore.getState().selectAll(); e.preventDefault(); return;
          case '=': case '+': useUIStore.getState().zoomIn(); e.preventDefault(); return;
          case '-': useUIStore.getState().zoomOut(); e.preventDefault(); return;
          case '0': useUIStore.getState().zoomFit(); e.preventDefault(); return;
        }
      }

      // Ctrl+Shift shortcuts
      if (ctrl && shift) {
        switch (e.key.toLowerCase()) {
          case 'z': useDocumentStore.getState().redo(); e.preventDefault(); return;
          case 'n': useDocumentStore.getState().addPage(); e.preventDefault(); return;
        }
      }

      // F11
      if (e.key === 'F11') {
        e.preventDefault();
        if (electron) {
          const win = electron.remote ? electron.remote.getCurrentWindow() : null;
          // Handled by menu accelerator
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      {/* Blank screen overlay */}
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

      {/* Overlays */}
      <SettingsModal />
      <ContextMenu />
    </div>
  );
}
