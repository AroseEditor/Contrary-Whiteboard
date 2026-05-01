import { generateId } from '../utils/uuid';

export class ShapeTool {
  constructor() {
    this.isDrawing = false;
    this.startPos = null;
    this.previewObject = null;
  }

  onPointerDown(pos, context) {
    this.isDrawing = true;
    this.startPos = { x: pos.x, y: pos.y };

    const { toolStore } = context;
    const ts = toolStore.getState();
    const shapeType = ts.activeTool === 'rectangle' ? 'rectangle'
      : ts.activeTool === 'ellipse' ? 'ellipse'
      : ts.activeTool === 'triangle' ? 'triangle'
      : ts.shapeType;

    this.previewObject = {
      id: '__preview__',
      type: 'shape',
      shapeType,
      fillColor: ts.shapeFilled ? ts.shapeFillColor : 'transparent',
      strokeColor: ts.shapeStrokeColor,
      strokeWidth: ts.shapeStrokeWidth,
      filled: ts.shapeFilled,
      bounds: { x: pos.x, y: pos.y, w: 0, h: 0 },
      visible: true
    };
  }

  onPointerMove(pos, context) {
    if (!this.isDrawing || !this.startPos) return;

    let x = Math.min(this.startPos.x, pos.x);
    let y = Math.min(this.startPos.y, pos.y);
    let w = Math.abs(pos.x - this.startPos.x);
    let h = Math.abs(pos.y - this.startPos.y);

    // Shift = constrain to square / circle
    if (pos.shiftKey) {
      const size = Math.max(w, h);
      w = size;
      h = size;
      if (pos.x < this.startPos.x) x = this.startPos.x - size;
      if (pos.y < this.startPos.y) y = this.startPos.y - size;
    }

    this.previewObject = {
      ...this.previewObject,
      bounds: { x, y, w, h }
    };
  }

  onPointerUp(pos, context) {
    if (!this.isDrawing || !this.startPos) return;
    this.isDrawing = false;

    let x = Math.min(this.startPos.x, pos.x);
    let y = Math.min(this.startPos.y, pos.y);
    let w = Math.abs(pos.x - this.startPos.x);
    let h = Math.abs(pos.y - this.startPos.y);

    if (pos.shiftKey) {
      const size = Math.max(w, h);
      w = size;
      h = size;
      if (pos.x < this.startPos.x) x = this.startPos.x - size;
      if (pos.y < this.startPos.y) y = this.startPos.y - size;
    }

    // Don't create shapes that are too small
    if (w < 3 && h < 3) {
      this.previewObject = null;
      return;
    }

    const { store, toolStore } = context;
    const ts = toolStore.getState();
    const shapeType = ts.activeTool === 'rectangle' ? 'rectangle'
      : ts.activeTool === 'ellipse' ? 'ellipse'
      : ts.activeTool === 'triangle' ? 'triangle'
      : ts.shapeType;

    const shapeObj = {
      id: generateId(),
      type: 'shape',
      shapeType,
      fillColor: ts.shapeFilled ? ts.shapeFillColor : 'transparent',
      strokeColor: ts.shapeStrokeColor,
      strokeWidth: ts.shapeStrokeWidth,
      filled: ts.shapeFilled,
      bounds: { x, y, w, h },
      transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      visible: true,
      locked: false
    };

    store.getState().addObject(shapeObj);
    this.previewObject = null;
    this.startPos = null;
  }
}
