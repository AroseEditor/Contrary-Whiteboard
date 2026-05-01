import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import useUIStore from '../../store/uiStore';
import useDocumentStore from '../../store/documentStore';

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };

const DEFAULT_SETTINGS = {
  autoSaveInterval: 60,
  undoHistoryLimit: 200,
  defaultBackground: 'solid',
  defaultPageSize: '16:9',
  defaultPenColor: '#1A1A1A',
  defaultPenWidth: 3,
  defaultHighlighterColor: '#FFEB3B'
};

export default function SettingsModal() {
  const showSettings = useUIStore(s => s.showSettings);
  const setShowSettings = useUIStore(s => s.setShowSettings);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [appVersion, setAppVersion] = useState('1.0.0');

  useEffect(() => {
    if (!showSettings || !ipcRenderer) return;

    ipcRenderer.invoke('settings:load').then(saved => {
      if (saved) setSettings(prev => ({ ...prev, ...saved }));
    });

    ipcRenderer.invoke('app:get-version').then(v => {
      if (v) setAppVersion(v);
    });
  }, [showSettings]);

  if (!showSettings) return null;

  const handleSave = async () => {
    if (ipcRenderer) {
      await ipcRenderer.invoke('settings:save', settings);
    }
    setShowSettings(false);
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Modal
      title="SETTINGS"
      onClose={() => setShowSettings(false)}
      footer={
        <>
          <button className="btn" onClick={() => setShowSettings(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </>
      }
    >
      <div className="settings-section">
        <h3>GENERAL</h3>
        <div className="settings-row">
          <label>Auto-save Interval (seconds)</label>
          <input
            type="number"
            min={10}
            max={600}
            value={settings.autoSaveInterval}
            onChange={e => updateSetting('autoSaveInterval', parseInt(e.target.value))}
          />
        </div>
        <div className="settings-row">
          <label>Undo History Limit</label>
          <input
            type="number"
            min={10}
            max={1000}
            value={settings.undoHistoryLimit}
            onChange={e => updateSetting('undoHistoryLimit', parseInt(e.target.value))}
          />
        </div>
      </div>

      <div className="settings-section">
        <h3>BOARD</h3>
        <div className="settings-row">
          <label>Default Background</label>
          <select
            value={settings.defaultBackground}
            onChange={e => updateSetting('defaultBackground', e.target.value)}
          >
            <option value="solid">Solid Color</option>
            <option value="grid">Grid</option>
            <option value="lines">Lines</option>
            <option value="dots">Dots</option>
          </select>
        </div>
        <div className="settings-row">
          <label>Default Page Size</label>
          <select
            value={settings.defaultPageSize}
            onChange={e => updateSetting('defaultPageSize', e.target.value)}
          >
            <option value="16:9">16:9 (Widescreen)</option>
            <option value="A4">A4</option>
            <option value="infinite">Infinite</option>
          </select>
        </div>
      </div>

      <div className="settings-section">
        <h3>TOOLS</h3>
        <div className="settings-row">
          <label>Default Pen Color</label>
          <input
            type="color"
            value={settings.defaultPenColor}
            onChange={e => updateSetting('defaultPenColor', e.target.value)}
          />
        </div>
        <div className="settings-row">
          <label>Default Pen Width</label>
          <input
            type="number"
            min={1}
            max={50}
            value={settings.defaultPenWidth}
            onChange={e => updateSetting('defaultPenWidth', parseInt(e.target.value))}
          />
        </div>
      </div>

      <div className="settings-section">
        <h3>SHORTCUTS</h3>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <div><strong>P</strong> — Pen</div>
          <div><strong>E</strong> — Eraser</div>
          <div><strong>S / Esc</strong> — Select</div>
          <div><strong>T</strong> — Text</div>
          <div><strong>L</strong> — Line</div>
          <div><strong>H</strong> — Highlighter</div>
          <div><strong>Ctrl+Z</strong> — Undo</div>
          <div><strong>Ctrl+Y</strong> — Redo</div>
          <div><strong>Ctrl+S</strong> — Save</div>
          <div><strong>Ctrl+O</strong> — Open</div>
          <div><strong>Ctrl+D</strong> — Duplicate</div>
          <div><strong>Ctrl+A</strong> — Select All</div>
          <div><strong>Del</strong> — Delete</div>
          <div><strong>F11</strong> — Fullscreen</div>
          <div><strong>B</strong> — Blank Screen</div>
        </div>
      </div>

      <div className="settings-section">
        <h3>ABOUT</h3>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          <div><strong>Contrary Whiteboard</strong></div>
          <div>Version {appVersion}</div>
          <div style={{ marginTop: 8 }}>
            A full-featured digital whiteboard application.<br />
            Inspired by OpenBoard.<br />
            Built with Electron + React + Canvas 2D.
          </div>
          <div style={{ marginTop: 8, color: 'var(--text-muted)' }}>
            MIT License
          </div>
        </div>
      </div>
    </Modal>
  );
}
