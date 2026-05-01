import { create } from 'zustand';

const electron = window.require ? window.require('electron') : null;
const ipcRenderer = electron ? electron.ipcRenderer : null;

// Default keybindings — user can override any of these
const DEFAULT_KEYBINDINGS = {
  pen: 'P',
  eraser: 'E',
  select: 'S',
  text: 'T',
  line: 'L',
  highlighter: 'H',
  laser: 'R',
  rectangle: 'U',
  ellipse: 'O',
  undo: 'Ctrl+Z',
  redo: 'Ctrl+Y',
  redoAlt: 'Ctrl+Shift+Z',
  copy: 'Ctrl+C',
  paste: 'Ctrl+V',
  cut: 'Ctrl+X',
  duplicate: 'Ctrl+D',
  selectAll: 'Ctrl+A',
  delete: 'Delete',
  deleteAlt: 'Backspace',
  zoomIn: 'Ctrl+=',
  zoomOut: 'Ctrl+-',
  zoomFit: 'Ctrl+0',
  save: 'Ctrl+S',
  saveAs: 'Ctrl+Shift+S',
  open: 'Ctrl+O',
  newPage: 'Ctrl+Shift+N',
  nextPage: 'PageDown',
  prevPage: 'PageUp',
  blankScreen: 'B',
  resetView: 'Home',
  exportPdf: 'Ctrl+Shift+E'
};

// Stylus button actions
const STYLUS_ACTIONS = [
  { value: 'eraser', label: 'Switch to Eraser' },
  { value: 'select', label: 'Switch to Select' },
  { value: 'pen', label: 'Switch to Pen' },
  { value: 'rightClick', label: 'Right Click (Context Menu)' },
  { value: 'undo', label: 'Undo' },
  { value: 'pan', label: 'Pan Canvas' },
  { value: 'none', label: 'Do Nothing' }
];

const DEFAULT_STYLUS = {
  enabled: true,
  usePressure: true,
  pressureSensitivity: 1.0,
  // Barrel button (button index 2 in pointer events, pen side button)
  barrelButton: 'eraser',
  // Secondary barrel button (button index 4, if pen has two side buttons)
  secondaryButton: 'rightClick',
  // Eraser tip (button index 5 / pointerType pen + eraser end)
  eraserTip: 'eraser'
};

const DEFAULT_SETTINGS = {
  autoSaveInterval: 60,
  undoHistoryLimit: 200,
  defaultBackground: 'solid',
  defaultPageSize: '16:9',
  defaultPenColor: '#1A1A1A',
  defaultPenWidth: 3,
  defaultHighlighterColor: '#FFEB3B',
  keybindings: { ...DEFAULT_KEYBINDINGS },
  stylus: { ...DEFAULT_STYLUS }
};

const useSettingsStore = create((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,
  stylusDetected: false,

  // Load settings from disk
  loadSettings: async () => {
    if (!ipcRenderer) {
      set({ loaded: true });
      return;
    }
    try {
      const saved = await ipcRenderer.invoke('settings:load');
      if (saved) {
        // Merge saved over defaults (so new keys get defaults)
        set({
          ...DEFAULT_SETTINGS,
          ...saved,
          keybindings: { ...DEFAULT_KEYBINDINGS, ...(saved.keybindings || {}) },
          stylus: { ...DEFAULT_STYLUS, ...(saved.stylus || {}) },
          loaded: true
        });
      } else {
        set({ loaded: true });
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
      set({ loaded: true });
    }
  },

  // Save all settings to disk
  saveSettings: async () => {
    if (!ipcRenderer) return;
    const state = get();
    const toSave = {
      autoSaveInterval: state.autoSaveInterval,
      undoHistoryLimit: state.undoHistoryLimit,
      defaultBackground: state.defaultBackground,
      defaultPageSize: state.defaultPageSize,
      defaultPenColor: state.defaultPenColor,
      defaultPenWidth: state.defaultPenWidth,
      defaultHighlighterColor: state.defaultHighlighterColor,
      keybindings: state.keybindings,
      stylus: state.stylus
    };
    try {
      await ipcRenderer.invoke('settings:save', toSave);
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  },

  // Update a single setting and auto-save
  updateSetting: (key, value) => {
    set({ [key]: value });
    // Debounced save
    clearTimeout(get()._saveTimer);
    const timer = setTimeout(() => get().saveSettings(), 500);
    set({ _saveTimer: timer });
  },

  // Update a keybinding
  setKeybinding: (action, key) => {
    const kb = { ...get().keybindings, [action]: key };
    set({ keybindings: kb });
    clearTimeout(get()._saveTimer);
    const timer = setTimeout(() => get().saveSettings(), 500);
    set({ _saveTimer: timer });
  },

  // Reset a keybinding to default
  resetKeybinding: (action) => {
    const kb = { ...get().keybindings, [action]: DEFAULT_KEYBINDINGS[action] };
    set({ keybindings: kb });
    get().saveSettings();
  },

  // Reset all keybindings
  resetAllKeybindings: () => {
    set({ keybindings: { ...DEFAULT_KEYBINDINGS } });
    get().saveSettings();
  },

  // Update stylus config
  updateStylus: (key, value) => {
    const stylus = { ...get().stylus, [key]: value };
    set({ stylus });
    clearTimeout(get()._saveTimer);
    const timer = setTimeout(() => get().saveSettings(), 500);
    set({ _saveTimer: timer });
  },

  // Set stylus detected flag
  setStylusDetected: (v) => set({ stylusDetected: v }),

  // Get the action for a stylus button
  getStylusAction: (buttonName) => {
    const s = get().stylus;
    switch (buttonName) {
      case 'barrel': return s.barrelButton;
      case 'secondary': return s.secondaryButton;
      case 'eraserTip': return s.eraserTip;
      default: return 'none';
    }
  }
}));

export { DEFAULT_KEYBINDINGS, DEFAULT_STYLUS, STYLUS_ACTIONS };
export default useSettingsStore;
