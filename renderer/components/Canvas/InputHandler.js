// InputHandler — pointer event processing, panning, zoom gestures

export class InputHandler {
  constructor(coordSystem, callbacks) {
    this.cs = coordSystem;
    this.callbacks = callbacks; // { onPointerDown, onPointerMove, onPointerUp, onZoom, onPan }
    this.isPanning = false;
    this.isSpaceHeld = false;
    this.lastPanPos = null;
    this.lastPinchDist = null;
  }

  // Bind to a canvas element
  bind(canvas) {
    this.canvas = canvas;

    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('pointerleave', this.handlePointerUp);
    canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    canvas.addEventListener('contextmenu', this.handleContextMenu);

    // Touch for pinch zoom
    canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.handleTouchEnd);

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  unbind() {
    if (!this.canvas) return;
    const canvas = this.canvas;

    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    canvas.removeEventListener('pointermove', this.handlePointerMove);
    canvas.removeEventListener('pointerup', this.handlePointerUp);
    canvas.removeEventListener('pointerleave', this.handlePointerUp);
    canvas.removeEventListener('wheel', this.handleWheel);
    canvas.removeEventListener('contextmenu', this.handleContextMenu);
    canvas.removeEventListener('touchstart', this.handleTouchStart);
    canvas.removeEventListener('touchmove', this.handleTouchMove);
    canvas.removeEventListener('touchend', this.handleTouchEnd);

    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvasPos = this.cs.screenToCanvas(screenX, screenY);
    return {
      screenX,
      screenY,
      x: canvasPos.x,
      y: canvasPos.y,
      pressure: e.pressure || 0.5,
      time: Date.now(),
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      button: e.button
    };
  }

  handlePointerDown = (e) => {
    // Middle mouse button = pan
    if (e.button === 1) {
      e.preventDefault();
      this.isPanning = true;
      this.lastPanPos = { x: e.clientX, y: e.clientY };
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    // Space + click = pan
    if (this.isSpaceHeld && e.button === 0) {
      e.preventDefault();
      this.isPanning = true;
      this.lastPanPos = { x: e.clientX, y: e.clientY };
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    // Right click handled by context menu
    if (e.button === 2) {
      return;
    }

    const pos = this.getCanvasPos(e);
    this.callbacks.onPointerDown?.(pos, e);
  };

  handlePointerMove = (e) => {
    if (this.isPanning && this.lastPanPos) {
      const dx = e.clientX - this.lastPanPos.x;
      const dy = e.clientY - this.lastPanPos.y;
      this.lastPanPos = { x: e.clientX, y: e.clientY };
      this.callbacks.onPan?.(dx, dy);
      return;
    }

    const pos = this.getCanvasPos(e);
    this.callbacks.onPointerMove?.(pos, e);
  };

  handlePointerUp = (e) => {
    if (this.isPanning) {
      this.isPanning = false;
      this.lastPanPos = null;
      this.canvas.style.cursor = '';
      return;
    }

    const pos = this.getCanvasPos(e);
    this.callbacks.onPointerUp?.(pos, e);
  };

  handleWheel = (e) => {
    e.preventDefault();

    if (e.ctrlKey) {
      // Ctrl + scroll = zoom
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.callbacks.onZoom?.(delta, mouseX, mouseY);
    } else {
      // Regular scroll = pan
      this.callbacks.onPan?.(-e.deltaX, -e.deltaY);
    }
  };

  handleContextMenu = (e) => {
    e.preventDefault();
    const pos = this.getCanvasPos(e);
    this.callbacks.onContextMenu?.(pos, e);
  };

  // Pinch zoom for touch devices
  handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.lastPinchDist = Math.sqrt(dx * dx + dy * dy);
    }
  };

  handleTouchMove = (e) => {
    if (e.touches.length === 2 && this.lastPinchDist) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const delta = dist / this.lastPinchDist;
      this.lastPinchDist = dist;

      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const rect = this.canvas.getBoundingClientRect();
      this.callbacks.onZoom?.(delta, midX - rect.left, midY - rect.top);
    }
  };

  handleTouchEnd = () => {
    this.lastPinchDist = null;
  };

  handleKeyDown = (e) => {
    if (e.code === 'Space' && !e.repeat) {
      this.isSpaceHeld = true;
      if (this.canvas) this.canvas.style.cursor = 'grab';
    }
  };

  handleKeyUp = (e) => {
    if (e.code === 'Space') {
      this.isSpaceHeld = false;
      if (!this.isPanning && this.canvas) {
        this.canvas.style.cursor = '';
      }
    }
  };
}
