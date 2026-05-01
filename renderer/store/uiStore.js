import { create } from 'zustand';

const useUIStore = create((set) => ({
  zoom: 1.0,
  panOffset: { x: 0, y: 0 },
  isFullscreen: false,
  isBlankScreen: false,
  blankScreenColor: 'black', // 'black' | 'white'
  showPagePanel: true,
  showPropertiesPanel: true,
  showGrid: false,
  showSettings: false,
  showShortcuts: false,
  boardBackground: 'white', // 'white' | 'black' | 'copy'

  // Context menu
  contextMenu: null, // { x, y, items } or null

  // Actions
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(20, zoom)) }),
  zoomIn: () => set((s) => ({ zoom: Math.min(20, s.zoom * 1.2) })),
  zoomOut: () => set((s) => ({ zoom: Math.max(0.1, s.zoom / 1.2) })),
  zoomFit: () => set({ zoom: 1.0, panOffset: { x: 0, y: 0 } }),
  zoom100: () => set({ zoom: 1.0 }),

  setPanOffset: (offset) => set({ panOffset: offset }),
  pan: (dx, dy) => set((s) => ({
    panOffset: { x: s.panOffset.x + dx, y: s.panOffset.y + dy }
  })),

  setFullscreen: (v) => set({ isFullscreen: v }),
  toggleFullscreen: () => set((s) => ({ isFullscreen: !s.isFullscreen })),

  toggleBlankScreen: () => set((s) => ({
    isBlankScreen: !s.isBlankScreen,
    blankScreenColor: s.blankScreenColor === 'black' ? 'white' : (s.isBlankScreen ? 'black' : s.blankScreenColor)
  })),
  setBlankScreen: (v) => set({ isBlankScreen: v }),

  togglePagePanel: () => set((s) => ({ showPagePanel: !s.showPagePanel })),
  setShowPagePanel: (v) => set({ showPagePanel: v }),

  togglePropertiesPanel: () => set((s) => ({ showPropertiesPanel: !s.showPropertiesPanel })),
  setShowPropertiesPanel: (v) => set({ showPropertiesPanel: v }),

  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  setShowGrid: (v) => set({ showGrid: v }),

  setShowSettings: (v) => set({ showSettings: v }),
  setShowShortcuts: (v) => set({ showShortcuts: v }),

  setContextMenu: (menu) => set({ contextMenu: menu }),
  hideContextMenu: () => set({ contextMenu: null }),
  setBoardBackground: (bg) => set({ boardBackground: bg })
}));

export default useUIStore;
