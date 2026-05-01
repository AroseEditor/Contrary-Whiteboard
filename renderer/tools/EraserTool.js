import { hitTestStroke, hitTestObject } from '../utils/hitTest';

export class EraserTool {
  constructor() {
    this.isErasing = false;
    this.cursorPos = null;
    this.previewObject = null;
  }

  onPointerDown(pos, context) {
    this.isErasing = true;
    this.cursorPos = { x: pos.x, y: pos.y };
    this.eraseAtPoint(pos, context);
  }

  onPointerMove(pos, context) {
    this.cursorPos = { x: pos.x, y: pos.y };

    if (!this.isErasing) return;
    this.eraseAtPoint(pos, context);
  }

  onPointerUp(pos, context) {
    this.isErasing = false;
  }

  eraseAtPoint(pos, context) {
    const { store, toolStore } = context;
    const state = store.getState();
    const page = state.getCurrentPage();
    if (!page) return;

    const eraserSize = toolStore.getState().eraserSize;
    const eraserMode = toolStore.getState().eraserMode;

    if (eraserMode === 'stroke') {
      // Stroke eraser: find and delete any stroke touched
      const toDelete = [];

      for (const obj of page.objects) {
        if (obj.locked || obj.visible === false) continue;

        if (obj.type === 'stroke') {
          if (hitTestStroke(pos.x, pos.y, obj, eraserSize / 2)) {
            toDelete.push(obj.id);
          }
        } else {
          // For non-stroke objects, check if eraser center is inside
          if (hitTestObject(pos.x, pos.y, obj)) {
            toDelete.push(obj.id);
          }
        }
      }

      if (toDelete.length > 0) {
        state.removeObjects(toDelete);
      }
    }
    // Pixel eraser mode would require a different approach (bitmap clearing)
    // For now, stroke eraser covers the primary use case
  }
}
