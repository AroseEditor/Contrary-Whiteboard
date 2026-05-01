import { create } from 'zustand';
import { generateId } from '../utils/uuid';
import { CommandHistory } from '../commands/CommandHistory';
import { AddObjectCommand } from '../commands/AddObjectCommand';
import { DeleteObjectCommand } from '../commands/DeleteObjectCommand';
import { MoveObjectCommand } from '../commands/MoveObjectCommand';
import { TransformCommand, BatchTransformCommand } from '../commands/TransformCommand';

function createDefaultPage(name = 'Page 1') {
  return {
    id: generateId(),
    name,
    background: { type: 'solid', color: '#FFFFFF' },
    layers: [
      { id: generateId(), name: 'Background', locked: true, visible: true },
      { id: generateId(), name: 'Drawing', locked: false, visible: true },
      { id: generateId(), name: 'Annotation', locked: false, visible: true }
    ],
    objects: []
  };
}

const history = new CommandHistory(200);

const useDocumentStore = create((set, get) => ({
  // -- State --
  pages: [createDefaultPage()],
  currentPageId: null, // will be set to first page id on init
  selectedObjectIds: [],
  clipboard: [],
  currentFilePath: null,
  isDirty: false,
  nextZIndex: 1,

  // -- Init --
  init: () => {
    const state = get();
    if (!state.currentPageId && state.pages.length > 0) {
      set({ currentPageId: state.pages[0].id });
    }
  },

  // -- Page Actions --
  getCurrentPage: () => {
    const state = get();
    return state.pages.find(p => p.id === state.currentPageId) || state.pages[0];
  },

  addPage: (afterCurrent = true) => {
    const state = get();
    const newPage = createDefaultPage(`Page ${state.pages.length + 1}`);
    let pages;
    if (afterCurrent) {
      const idx = state.pages.findIndex(p => p.id === state.currentPageId);
      pages = [...state.pages];
      pages.splice(idx + 1, 0, newPage);
    } else {
      pages = [...state.pages, newPage];
    }
    set({ pages, currentPageId: newPage.id, isDirty: true });
  },

  removePage: (pageId) => {
    const state = get();
    if (state.pages.length <= 1) return;
    const pages = state.pages.filter(p => p.id !== pageId);
    let currentPageId = state.currentPageId;
    if (currentPageId === pageId) {
      const idx = state.pages.findIndex(p => p.id === pageId);
      currentPageId = pages[Math.min(idx, pages.length - 1)]?.id;
    }
    set({ pages, currentPageId, isDirty: true });
  },

  duplicatePage: (pageId) => {
    const state = get();
    const page = state.pages.find(p => p.id === pageId);
    if (!page) return;
    const dup = JSON.parse(JSON.stringify(page));
    dup.id = generateId();
    dup.name = page.name + ' (copy)';
    dup.objects = dup.objects.map(o => ({ ...o, id: generateId() }));
    dup.layers = dup.layers.map(l => ({ ...l, id: generateId() }));
    const idx = state.pages.findIndex(p => p.id === pageId);
    const pages = [...state.pages];
    pages.splice(idx + 1, 0, dup);
    set({ pages, currentPageId: dup.id, isDirty: true });
  },

  reorderPages: (fromIdx, toIdx) => {
    const state = get();
    const pages = [...state.pages];
    const [moved] = pages.splice(fromIdx, 1);
    pages.splice(toIdx, 0, moved);
    set({ pages, isDirty: true });
  },

  setCurrentPage: (pageId) => {
    set({ currentPageId: pageId, selectedObjectIds: [] });
  },

  goToNextPage: () => {
    const state = get();
    const idx = state.pages.findIndex(p => p.id === state.currentPageId);
    if (idx < state.pages.length - 1) {
      set({ currentPageId: state.pages[idx + 1].id, selectedObjectIds: [] });
    }
  },

  goToPrevPage: () => {
    const state = get();
    const idx = state.pages.findIndex(p => p.id === state.currentPageId);
    if (idx > 0) {
      set({ currentPageId: state.pages[idx - 1].id, selectedObjectIds: [] });
    }
  },

  renamePage: (pageId, name) => {
    const state = get();
    const pages = state.pages.map(p => p.id === pageId ? { ...p, name } : p);
    set({ pages, isDirty: true });
  },

  // -- Object Actions (with undo/redo) --
  addObject: (obj) => {
    const state = get();
    const pageId = state.currentPageId;
    const zIdx = state.nextZIndex;
    const finalObj = { ...obj, zIndex: zIdx };
    const store = useDocumentStore;

    const cmd = new AddObjectCommand(store, pageId, finalObj);
    history.execute(cmd);
    set({ nextZIndex: zIdx + 1, isDirty: true });
    return finalObj;
  },

  removeObjects: (objectIds) => {
    const state = get();
    const pageId = state.currentPageId;
    const store = useDocumentStore;

    const cmd = new DeleteObjectCommand(store, pageId, objectIds);
    history.execute(cmd);
    set({ isDirty: true });
  },

  updateObject: (objectId, updates) => {
    const state = get();
    const pages = state.pages.map(p => {
      if (p.id === state.currentPageId) {
        const objects = p.objects.map(o => {
          if (o.id === objectId) return { ...o, ...updates };
          return o;
        });
        return { ...p, objects };
      }
      return p;
    });
    set({ pages, isDirty: true });
  },

  moveObjects: (objectIds, dx, dy) => {
    const state = get();
    const store = useDocumentStore;
    const cmd = new MoveObjectCommand(store, state.currentPageId, objectIds, dx, dy);
    history.execute(cmd);
    set({ isDirty: true });
  },

  transformObject: (objectId, oldProps, newProps) => {
    const state = get();
    const store = useDocumentStore;
    const cmd = new TransformCommand(store, state.currentPageId, objectId, oldProps, newProps);
    history.execute(cmd);
    set({ isDirty: true });
  },

  // -- Selection --
  setSelection: (objectIds) => {
    set({ selectedObjectIds: objectIds });
  },

  clearSelection: () => {
    set({ selectedObjectIds: [] });
  },

  selectAll: () => {
    const page = get().getCurrentPage();
    if (page) {
      set({ selectedObjectIds: page.objects.filter(o => !o.locked && o.visible !== false).map(o => o.id) });
    }
  },

  // -- Clipboard --
  copySelection: () => {
    const state = get();
    const page = state.getCurrentPage();
    if (!page) return;
    const copied = page.objects.filter(o => state.selectedObjectIds.includes(o.id));
    set({ clipboard: JSON.parse(JSON.stringify(copied)) });
  },

  cutSelection: () => {
    const state = get();
    state.copySelection();
    state.removeObjects(state.selectedObjectIds);
  },

  pasteClipboard: () => {
    const state = get();
    if (state.clipboard.length === 0) return;

    const newIds = [];
    const pasted = state.clipboard.map(o => {
      const newObj = JSON.parse(JSON.stringify(o));
      newObj.id = generateId();
      // Offset paste slightly
      if (newObj.transform) {
        newObj.transform.translateX = (newObj.transform.translateX || 0) + 20;
        newObj.transform.translateY = (newObj.transform.translateY || 0) + 20;
      } else if (newObj.bounds) {
        newObj.bounds = { ...newObj.bounds, x: newObj.bounds.x + 20, y: newObj.bounds.y + 20 };
      }
      newIds.push(newObj.id);
      return newObj;
    });

    const pageId = state.currentPageId;
    const pages = state.pages.map(p => {
      if (p.id === pageId) {
        return { ...p, objects: [...p.objects, ...pasted] };
      }
      return p;
    });
    set({ pages, selectedObjectIds: newIds, isDirty: true });
  },

  duplicateSelection: () => {
    const state = get();
    state.copySelection();
    state.pasteClipboard();
  },

  // -- Z-order --
  bringToFront: (objectIds) => {
    const state = get();
    let zIdx = state.nextZIndex;
    const pages = state.pages.map(p => {
      if (p.id === state.currentPageId) {
        const objects = p.objects.map(o => {
          if (objectIds.includes(o.id)) {
            return { ...o, zIndex: zIdx++ };
          }
          return o;
        });
        return { ...p, objects };
      }
      return p;
    });
    set({ pages, nextZIndex: zIdx, isDirty: true });
  },

  sendToBack: (objectIds) => {
    const state = get();
    const pages = state.pages.map(p => {
      if (p.id === state.currentPageId) {
        const minZ = Math.min(...p.objects.map(o => o.zIndex || 0)) - objectIds.length;
        let z = minZ;
        const objects = p.objects.map(o => {
          if (objectIds.includes(o.id)) {
            return { ...o, zIndex: z++ };
          }
          return o;
        });
        return { ...p, objects };
      }
      return p;
    });
    set({ pages, isDirty: true });
  },

  // -- Undo/Redo --
  undo: () => {
    history.undo();
    set({ isDirty: true });
  },

  redo: () => {
    history.redo();
    set({ isDirty: true });
  },

  canUndo: () => history.canUndo(),
  canRedo: () => history.canRedo(),

  // -- Clear Page --
  clearPage: () => {
    const state = get();
    const page = state.getCurrentPage();
    if (!page || page.objects.length === 0) return;
    const store = useDocumentStore;
    const cmd = new DeleteObjectCommand(store, state.currentPageId, page.objects.map(o => o.id));
    history.execute(cmd);
    set({ selectedObjectIds: [], isDirty: true });
  },

  // -- Background --
  setPageBackground: (pageId, bg) => {
    const state = get();
    const pages = state.pages.map(p => p.id === pageId ? { ...p, background: bg } : p);
    set({ pages, isDirty: true });
  },

  // -- Document Management --
  newDocument: () => {
    history.clear();
    const page = createDefaultPage();
    set({
      pages: [page],
      currentPageId: page.id,
      selectedObjectIds: [],
      clipboard: [],
      currentFilePath: null,
      isDirty: false,
      nextZIndex: 1
    });
  },

  loadFromData: (data) => {
    history.clear();
    set({
      pages: data.pages || [createDefaultPage()],
      currentPageId: data.pages?.[0]?.id || null,
      selectedObjectIds: [],
      clipboard: [],
      isDirty: false,
      nextZIndex: data.nextZIndex || 1
    });
    // Fix currentPageId
    const state = get();
    if (!state.currentPageId && state.pages.length > 0) {
      set({ currentPageId: state.pages[0].id });
    }
  },

  setFilePath: (path) => set({ currentFilePath: path }),
  setDirty: (dirty) => set({ isDirty: dirty }),

  getSerializableData: () => {
    const state = get();
    return {
      version: '1.0',
      pages: state.pages,
      nextZIndex: state.nextZIndex,
      assets: {}
    };
  }
}));

// Init on import
setTimeout(() => useDocumentStore.getState().init(), 0);

export default useDocumentStore;
