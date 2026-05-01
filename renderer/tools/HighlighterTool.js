import { generateId } from '../utils/uuid';
import { getBounds, expandBounds } from '../utils/geometry';

export class HighlighterTool {
  constructor() {
    this.isDrawing = false;
    this.currentPoints = [];
    this.previewObject = null;
  }

  onPointerDown(pos, context) {
    this.isDrawing = true;
    this.currentPoints = [{ x: pos.x, y: pos.y }];

    const { toolStore } = context;
    const state = toolStore.getState();

    this.previewObject = {
      id: '__preview__',
      type: 'stroke',
      color: state.highlighterColor,
      width: state.highlighterWidth,
      opacity: 0.4,
      points: [...this.currentPoints],
      visible: true
    };
  }

  onPointerMove(pos, context) {
    if (!this.isDrawing) return;

    this.currentPoints.push({ x: pos.x, y: pos.y });
    this.previewObject = {
      ...this.previewObject,
      points: [...this.currentPoints]
    };
  }

  onPointerUp(pos, context) {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    if (this.currentPoints.length === 0) {
      this.previewObject = null;
      return;
    }

    const { store, toolStore } = context;
    const state = toolStore.getState();
    const bounds = getBounds(this.currentPoints);
    const expandedBounds = expandBounds(bounds, state.highlighterWidth / 2);

    const strokeObj = {
      id: generateId(),
      type: 'stroke',
      color: state.highlighterColor,
      width: state.highlighterWidth,
      opacity: 0.4,
      points: this.currentPoints.map(p => ({ x: p.x, y: p.y })),
      bounds: expandedBounds,
      transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      visible: true,
      locked: false
    };

    store.getState().addObject(strokeObj);
    this.previewObject = null;
    this.currentPoints = [];
  }
}
