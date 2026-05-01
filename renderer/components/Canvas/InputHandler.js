// InputHandler — pointer event processing, stylus support, panning, zoom gestures

export class InputHandler {
  constructor(coordSystem, callbacks) {
    this.cs = coordSystem;
    this.callbacks = callbacks;
    this.isPanning = false;
    this.isSpaceHeld = false;
    this.lastPanPos = null;
    this.lastPinchDist = null;

    // Stylus state
    this.stylusDetected = false;
    this.stylusBarrelHeld = false;
    this.previousTool = null;
    this.stylusConfig = null; // set externally
  }

  // Update stylus config from settings store
  setStylusConfig(config) {
    this.stylusConfig = config;
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
      tiltX: e.tiltX || 0,
      tiltY: e.tiltY || 0,
      time: Date.now(),
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      button: e.button,
      pointerType: e.pointerType || 'mouse',
      isPen: e.pointerType === 'pen'
    };
  }

  // Detect stylus and handle barrel button
  _detectStylus(e) {
    if (e.pointerType === 'pen' && !this.stylusDetected) {
      this.stylusDetected = true;
      this.callbacks.onStylusDetected?.();
    }
  }

  // Get the action mapped to a stylus button press
  _getStylusButtonAction(e) {
    if (e.pointerType !== 'pen' || !this.stylusConfig?.enabled) return null;

    // W3C Pointer Events button mapping for pen devices:
    //   button 0 = pen tip contact (primary)
    //   button 2 = barrel button (side button 1)
    //   button 3 = secondary barrel (some 2-button pen drivers)
    //   button 4 = secondary barrel (alt driver mapping)
    //   button 5 = eraser tip (flip end)
    //
    // e.buttons bitmask (live state during move):
    //   1  = tip contact
    //   2  = barrel button
    //   4  = secondary barrel (some drivers)
    //   8  = secondary barrel (alt drivers, e.g. Huion)
    //   32 = eraser tip

    // Barrel button (side button 1)
    if (e.button === 2 || (e.buttons & 2)) {
      return this.stylusConfig.barrelButton || 'eraser';
    }

    // Eraser tip (flip pen / eraser end)
    if (e.button === 5 || (e.buttons & 32)) {
      return this.stylusConfig.eraserTip || 'eraser';
    }

    // Secondary barrel button (side button 2) — varies by driver
    if (e.button === 3 || e.button === 4 || (e.buttons & 4) || (e.buttons & 8)) {
      return this.stylusConfig.secondaryButton || 'rightClick';
    }

    return null;
  }

  // Execute a stylus action
  _executeStylusAction(action, pos, e) {
    switch (action) {
      case 'eraser':
        this.callbacks.onStylusAction?.('switchTool', 'eraser');
        return true;
      case 'select':
        this.callbacks.onStylusAction?.('switchTool', 'select');
        return true;
      case 'pen':
        this.callbacks.onStylusAction?.('switchTool', 'pen');
        return true;
      case 'undo':
        this.callbacks.onStylusAction?.('undo');
        return true;
      case 'pan':
        this.isPanning = true;
        this.lastPanPos = { x: e.clientX, y: e.clientY };
        this.canvas.style.cursor = 'grabbing';
        return true;
      case 'rightClick':
        this.callbacks.onContextMenu?.(pos, e);
        return true;
      case 'none':
      default:
        return false;
    }
  }

  handlePointerDown = (e) => {
    this._detectStylus(e);

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

    // Stylus button handling
    if (e.pointerType === 'pen') {
      const stylusAction = this._getStylusButtonAction(e);
      if (stylusAction) {
        e.preventDefault();
        const pos = this.getCanvasPos(e);
        // Save current tool so we can restore on pen up
        this.previousTool = this.callbacks.getCurrentTool?.() || null;
        this.stylusBarrelHeld = true;
        this._executeStylusAction(stylusAction, pos, e);
        // If the action switches tool, still let the pointer down through
        // so drawing starts with the new tool
        if (stylusAction === 'eraser' || stylusAction === 'pen' || stylusAction === 'select') {
          const pos2 = this.getCanvasPos(e);
          this.callbacks.onPointerDown?.(pos2, e);
        }
        return;
      }
    }

    // Right click → context menu
    if (e.button === 2) {
      return;
    }

    const pos = this.getCanvasPos(e);
    this.callbacks.onPointerDown?.(pos, e);
  };

  handlePointerMove = (e) => {
    this._detectStylus(e);

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

    // If stylus barrel was held and we switched tools, restore previous tool
    if (this.stylusBarrelHeld && this.previousTool) {
      const pos = this.getCanvasPos(e);
      this.callbacks.onPointerUp?.(pos, e);

      // Restore tool after a brief tick so the current stroke finishes
      setTimeout(() => {
        this.callbacks.onStylusAction?.('switchTool', this.previousTool);
        this.previousTool = null;
      }, 10);
      this.stylusBarrelHeld = false;
      return;
    }

    const pos = this.getCanvasPos(e);
    this.callbacks.onPointerUp?.(pos, e);
  };

  handleWheel = (e) => {
    e.preventDefault();

    if (e.shiftKey) {
      // Shift + scroll = horizontal pan
      this.callbacks.onPan?.(-e.deltaY, 0);
    } else if (e.ctrlKey) {
      // Ctrl + scroll = pan (vertical)
      this.callbacks.onPan?.(-e.deltaX, -e.deltaY);
    } else {
      // Plain scroll = zoom towards cursor
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.callbacks.onZoom?.(delta, mouseX, mouseY);
    }
  };

  handleContextMenu = (e) => {
    e.preventDefault();
    const pos = this.getCanvasPos(e);
    this.callbacks.onContextMenu?.(pos, e);
  };

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
