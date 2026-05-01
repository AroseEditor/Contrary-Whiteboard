// Screen ↔ Canvas coordinate transforms with zoom and pan

export class CoordinateSystem {
  constructor() {
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.dpr = window.devicePixelRatio || 1;
  }

  update(zoom, panOffset, dpr) {
    this.zoom = zoom;
    this.panX = panOffset.x;
    this.panY = panOffset.y;
    this.dpr = dpr || window.devicePixelRatio || 1;
  }

  // Convert screen (mouse) coordinates to canvas (world) coordinates
  screenToCanvas(screenX, screenY) {
    return {
      x: (screenX - this.panX) / this.zoom,
      y: (screenY - this.panY) / this.zoom
    };
  }

  // Convert canvas (world) coordinates to screen coordinates
  canvasToScreen(canvasX, canvasY) {
    return {
      x: canvasX * this.zoom + this.panX,
      y: canvasY * this.zoom + this.panY
    };
  }

  // Apply the current transform to a canvas context
  applyTransform(ctx) {
    ctx.setTransform(
      this.zoom * this.dpr,
      0,
      0,
      this.zoom * this.dpr,
      this.panX * this.dpr,
      this.panY * this.dpr
    );
  }

  // Reset to identity (for UI overlays drawn in screen space)
  resetTransform(ctx) {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
}
