import { generateId } from '../utils/uuid';
import { getBounds, expandBounds } from '../utils/geometry';
import { simplifyPath, getVelocityWidth } from '../utils/bezier';

export class PenTool {
  constructor() {
    this.isDrawing = false;
    this.currentPoints = [];
    this.previewObject = null;
  }

  onPointerDown(pos, context) {
    this.isDrawing = true;
    this.currentPoints = [{ x: pos.x, y: pos.y, time: pos.time }];

    const { toolStore } = context;
    const state = toolStore.getState();

    this.previewObject = {
      id: '__preview__',
      type: 'stroke',
      color: state.penColor,
      width: state.penWidth,
      opacity: state.penOpacity,
      points: [...this.currentPoints],
      visible: true
    };
  }

  onPointerMove(pos, context) {
    if (!this.isDrawing) return;

    const newPoint = { x: pos.x, y: pos.y, time: pos.time };
    this.currentPoints.push(newPoint);

    // Velocity-based width variation (applied during render)
    const { toolStore } = context;
    const state = toolStore.getState();

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

    // Simplify path to reduce point count
    const simplified = this.currentPoints.length > 3
      ? simplifyPath(this.currentPoints, 1.0)
      : this.currentPoints;

    const { store, toolStore } = context;
    const state = toolStore.getState();
    const bounds = getBounds(simplified);
    const expandedBounds = expandBounds(bounds, state.penWidth / 2);

    const strokeObj = {
      id: generateId(),
      type: 'stroke',
      color: state.penColor,
      width: state.penWidth,
      opacity: state.penOpacity,
      points: simplified.map(p => ({ x: p.x, y: p.y })),
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
