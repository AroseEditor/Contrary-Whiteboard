import { generateId } from '../utils/uuid';
import { constrainLine } from '../utils/geometry';

export class LineTool {
  constructor() {
    this.isDrawing = false;
    this.startPos = null;
    this.previewObject = null;
  }

  onPointerDown(pos, context) {
    this.isDrawing = true;
    this.startPos = { x: pos.x, y: pos.y };

    const { toolStore } = context;
    const state = toolStore.getState();

    this.previewObject = {
      id: '__preview__',
      type: 'line',
      color: state.lineColor,
      width: state.lineWidth,
      arrowStart: state.lineArrowStart,
      arrowEnd: state.lineArrowEnd,
      startX: pos.x,
      startY: pos.y,
      endX: pos.x,
      endY: pos.y,
      bounds: { x: pos.x, y: pos.y, w: 0, h: 0 },
      visible: true
    };
  }

  onPointerMove(pos, context) {
    if (!this.isDrawing || !this.startPos) return;

    let endX = pos.x;
    let endY = pos.y;

    // Shift-lock to 0/45/90 degrees
    if (pos.shiftKey) {
      const constrained = constrainLine(this.startPos.x, this.startPos.y, endX, endY);
      endX = constrained.x;
      endY = constrained.y;
    }

    const minX = Math.min(this.startPos.x, endX);
    const minY = Math.min(this.startPos.y, endY);
    const maxX = Math.max(this.startPos.x, endX);
    const maxY = Math.max(this.startPos.y, endY);

    this.previewObject = {
      ...this.previewObject,
      endX,
      endY,
      startX: this.startPos.x,
      startY: this.startPos.y,
      bounds: { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
    };
  }

  onPointerUp(pos, context) {
    if (!this.isDrawing || !this.startPos) return;
    this.isDrawing = false;

    let endX = pos.x;
    let endY = pos.y;

    if (pos.shiftKey) {
      const constrained = constrainLine(this.startPos.x, this.startPos.y, endX, endY);
      endX = constrained.x;
      endY = constrained.y;
    }

    // Don't create zero-length lines
    const dx = endX - this.startPos.x;
    const dy = endY - this.startPos.y;
    if (Math.sqrt(dx * dx + dy * dy) < 2) {
      this.previewObject = null;
      return;
    }

    const { store, toolStore } = context;
    const state = toolStore.getState();
    const minX = Math.min(this.startPos.x, endX);
    const minY = Math.min(this.startPos.y, endY);
    const maxX = Math.max(this.startPos.x, endX);
    const maxY = Math.max(this.startPos.y, endY);

    const lineObj = {
      id: generateId(),
      type: 'line',
      color: state.lineColor,
      width: state.lineWidth,
      arrowStart: state.lineArrowStart,
      arrowEnd: state.lineArrowEnd,
      startX: this.startPos.x,
      startY: this.startPos.y,
      endX,
      endY,
      bounds: { x: minX, y: minY, w: maxX - minX || 1, h: maxY - minY || 1 },
      transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      visible: true,
      locked: false
    };

    store.getState().addObject(lineObj);
    this.previewObject = null;
    this.startPos = null;
  }
}
