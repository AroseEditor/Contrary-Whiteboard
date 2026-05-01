import React, { useState, useEffect, useRef } from 'react';
import Modal from '../common/Modal';
import useUIStore from '../../store/uiStore';
import useSettingsStore, { DEFAULT_KEYBINDINGS, STYLUS_ACTIONS } from '../../store/settingsStore';

const electron = window.require ? window.require('electron') : null;
const ipcRenderer = electron ? electron.ipcRenderer : null;

// Human-readable names for keybinding actions
const KEYBINDING_LABELS = {
  pen: 'Pen Tool',
  eraser: 'Eraser Tool',
  select: 'Select Tool',
  text: 'Text Tool',
  line: 'Line Tool',
  highlighter: 'Highlighter Tool',
  laser: 'Laser Pointer',
  rectangle: 'Rectangle Tool',
  ellipse: 'Ellipse Tool',
  undo: 'Undo',
  redo: 'Redo',
  redoAlt: 'Redo (Alt)',
  copy: 'Copy',
  paste: 'Paste',
  cut: 'Cut',
  duplicate: 'Duplicate',
  selectAll: 'Select All',
  delete: 'Delete',
  deleteAlt: 'Delete (Alt)',
  zoomIn: 'Zoom In',
  zoomOut: 'Zoom Out',
  zoomFit: 'Zoom to Fit',
  save: 'Save',
  saveAs: 'Save As',
  open: 'Open File',
  newPage: 'New Page',
  nextPage: 'Next Page',
  prevPage: 'Previous Page',
  blankScreen: 'Blank Screen',
  resetView: 'Reset View',
  exportPdf: 'Export PDF'
};

// Group keybindings for display
const KEYBINDING_GROUPS = {
  'Tools': ['pen', 'eraser', 'select', 'text', 'line', 'highlighter', 'laser', 'rectangle', 'ellipse'],
  'Edit': ['undo', 'redo', 'redoAlt', 'copy', 'paste', 'cut', 'duplicate', 'selectAll', 'delete', 'deleteAlt'],
  'View': ['zoomIn', 'zoomOut', 'zoomFit', 'resetView', 'blankScreen'],
  'File': ['save', 'saveAs', 'open', 'exportPdf'],
  'Pages': ['newPage', 'nextPage', 'prevPage']
};

// Convert KeyboardEvent to shortcut string
function eventToShortcut(e) {
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');

  let key = e.key;
  // Normalize key names
  if (key === ' ') key = 'Space';
  else if (key === 'ArrowUp') key = 'Up';
  else if (key === 'ArrowDown') key = 'Down';
  else if (key === 'ArrowLeft') key = 'Left';
  else if (key === 'ArrowRight') key = 'Right';
  else if (key.length === 1) key = key.toUpperCase();

  // Don't add modifier keys as the main key
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return null;

  parts.push(key);
  return parts.join('+');
}

function KeybindingRow({ action, currentKey, onRebind, onReset }) {
  const [isCapturing, setIsCapturing] = useState(false);
  const inputRef = useRef(null);

  const handleCapture = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const shortcut = eventToShortcut(e);
    if (shortcut) {
      onRebind(action, shortcut);
      setIsCapturing(false);
    }
  };

  const startCapture = () => {
    setIsCapturing(true);
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 50);
  };

  const isModified = currentKey !== DEFAULT_KEYBINDINGS[action];

  return (
    <div className={`keybinding-row${isModified ? ' modified' : ''}`}>
      <span className="keybinding-label">{KEYBINDING_LABELS[action] || action}</span>
      <div className="keybinding-key-group">
        {isCapturing ? (
          <input
            ref={inputRef}
            className="keybinding-capture"
            placeholder="Press key combo..."
            readOnly
            onKeyDown={handleCapture}
            onBlur={() => setIsCapturing(false)}
          />
        ) : (
          <button className="keybinding-key" onClick={startCapture}>
            {currentKey || '—'}
          </button>
        )}
        {isModified && (
          <button className="keybinding-reset" onClick={() => onReset(action)} title="Reset to default">
            ↺
          </button>
        )}
      </div>
    </div>
  );
}

export default function SettingsModal() {
  const showSettings = useUIStore(s => s.showSettings);
  const setShowSettings = useUIStore(s => s.setShowSettings);
  const [activeTab, setActiveTab] = useState('general');
  const [appVersion, setAppVersion] = useState('1.0.0');

  // Settings store
  const settings = useSettingsStore();

  useEffect(() => {
    if (!showSettings) return;
    if (ipcRenderer) {
      ipcRenderer.invoke('app:get-version').then(v => {
        if (v) setAppVersion(v);
      });
    }
  }, [showSettings]);

  if (!showSettings) return null;

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'stylus', label: 'Stylus' },
    { id: 'keybindings', label: 'Keybindings' },
    { id: 'shortcuts', label: 'Shortcuts' },
    { id: 'about', label: 'About' }
  ];

  const renderGeneralTab = () => (
    <div>
      <div className="settings-section">
        <h3>GENERAL</h3>
        <div className="settings-row">
          <label>Auto-save Interval (seconds)</label>
          <input
            type="number"
            min={10}
            max={600}
            value={settings.autoSaveInterval}
            onChange={e => settings.updateSetting('autoSaveInterval', parseInt(e.target.value))}
          />
        </div>
        <div className="settings-row">
          <label>Undo History Limit</label>
          <input
            type="number"
            min={10}
            max={1000}
            value={settings.undoHistoryLimit}
            onChange={e => settings.updateSetting('undoHistoryLimit', parseInt(e.target.value))}
          />
        </div>
      </div>

      <div className="settings-section">
        <h3>BOARD</h3>
        <div className="settings-row">
          <label>Default Background</label>
          <select
            value={settings.defaultBackground}
            onChange={e => settings.updateSetting('defaultBackground', e.target.value)}
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
            onChange={e => settings.updateSetting('defaultPageSize', e.target.value)}
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
            onChange={e => settings.updateSetting('defaultPenColor', e.target.value)}
          />
        </div>
        <div className="settings-row">
          <label>Default Pen Width</label>
          <input
            type="number"
            min={1}
            max={50}
            value={settings.defaultPenWidth}
            onChange={e => settings.updateSetting('defaultPenWidth', parseInt(e.target.value))}
          />
        </div>
      </div>
    </div>
  );

  const renderStylusTab = () => (
    <div>
      <div className="settings-section">
        <h3>STYLUS / PEN TABLET</h3>
        <div className="settings-row" style={{ alignItems: 'center' }}>
          <label>Status</label>
          <span style={{
            color: settings.stylusDetected ? '#2A9D8F' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: 12
          }}>
            {settings.stylusDetected ? '● Stylus Detected' : '○ No Stylus Detected'}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
          Stylus is auto-detected when you start using a pen/tablet. Connect your device and tap the canvas.
        </div>
      </div>

      <div className="settings-section">
        <h3>ENABLE</h3>
        <div className="settings-row">
          <label>Stylus Support</label>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.stylus.enabled}
              onChange={e => settings.updateStylus('enabled', e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h3>PRESSURE</h3>
        <div className="settings-row">
          <label>Use Pressure Sensitivity</label>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.stylus.usePressure}
              onChange={e => settings.updateStylus('usePressure', e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
        <div className="settings-row">
          <label>Pressure Sensitivity</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="range"
              min={0.1}
              max={3.0}
              step={0.1}
              value={settings.stylus.pressureSensitivity}
              onChange={e => settings.updateStylus('pressureSensitivity', parseFloat(e.target.value))}
              style={{ width: 120 }}
            />
            <span style={{ fontSize: 11, minWidth: 30 }}>{settings.stylus.pressureSensitivity.toFixed(1)}x</span>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>BUTTON MAPPING</h3>
        <div className="settings-row">
          <label>Barrel Button (Side Button 1)</label>
          <select
            value={settings.stylus.barrelButton}
            onChange={e => settings.updateStylus('barrelButton', e.target.value)}
          >
            {STYLUS_ACTIONS.map(a => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>
        <div className="settings-row">
          <label>Secondary Button (Side Button 2)</label>
          <select
            value={settings.stylus.secondaryButton}
            onChange={e => settings.updateStylus('secondaryButton', e.target.value)}
          >
            {STYLUS_ACTIONS.map(a => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>
        <div className="settings-row">
          <label>Eraser Tip (Flip Pen)</label>
          <select
            value={settings.stylus.eraserTip}
            onChange={e => settings.updateStylus('eraserTip', e.target.value)}
          >
            {STYLUS_ACTIONS.map(a => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          Button availability depends on your pen hardware. Most pens have one barrel button; some have two.
          Eraser tip is available on pens with a flip eraser end (e.g. Wacom, Surface Pen).
        </div>
      </div>
    </div>
  );

  const renderKeybindingsTab = () => (
    <div>
      <div className="settings-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>KEYBOARD BINDINGS</h3>
        <button
          className="btn"
          style={{ fontSize: 11, padding: '4px 10px' }}
          onClick={() => settings.resetAllKeybindings()}
        >
          Reset All to Default
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
        Click a key binding to reassign it. Press the new key combination. Changes are saved automatically.
      </div>

      {Object.entries(KEYBINDING_GROUPS).map(([group, actions]) => (
        <div key={group} className="settings-section">
          <h3>{group.toUpperCase()}</h3>
          {actions.map(action => (
            <KeybindingRow
              key={action}
              action={action}
              currentKey={settings.keybindings[action]}
              onRebind={settings.setKeybinding}
              onReset={settings.resetKeybinding}
            />
          ))}
        </div>
      ))}
    </div>
  );

  const renderShortcutsTab = () => (
    <div className="settings-section">
      <h3>CURRENT SHORTCUTS</h3>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
        {Object.entries(settings.keybindings).map(([action, key]) => (
          <div key={action}>
            <strong>{key}</strong> — {KEYBINDING_LABELS[action] || action}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-muted)' }}>
        <div><strong>Scroll Wheel</strong> — Zoom</div>
        <div><strong>Ctrl + Scroll</strong> — Pan</div>
        <div><strong>Shift + Scroll</strong> — Horizontal Pan</div>
        <div><strong>Middle Mouse / Space+Drag</strong> — Pan</div>
        <div><strong>Pinch</strong> — Zoom (touch)</div>
      </div>
    </div>
  );

  const renderAboutTab = () => (
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
  );

  const renderTab = () => {
    switch (activeTab) {
      case 'general': return renderGeneralTab();
      case 'stylus': return renderStylusTab();
      case 'keybindings': return renderKeybindingsTab();
      case 'shortcuts': return renderShortcutsTab();
      case 'about': return renderAboutTab();
      default: return renderGeneralTab();
    }
  };

  return (
    <Modal
      title="PREFERENCES"
      onClose={() => setShowSettings(false)}
    >
      <div className="settings-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`settings-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="settings-tab-content">
        {renderTab()}
      </div>
    </Modal>
  );
}
