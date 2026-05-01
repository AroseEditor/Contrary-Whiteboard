// GeometryOverlays — virtual ruler, protractor, and set square
// These are interactive overlays rendered on top of the canvas
// Each can be dragged, rotated, and used as drawing guides

export class GeometryOverlays {
  constructor() {
    this.ruler = {
      visible: false,
      x: 200,
      y: 400,
      rotation: 0,       // radians
      length: 600,        // px in canvas space
      dragging: false,
      rotating: false,
      dragOffset: null
    };

    this.protractor = {
      visible: false,
      x: 500,
      y: 400,
      rotation: 0,
      radius: 200,
      dragging: false,
      rotating: false,
      dragOffset: null
    };

    this.setSquare = {
      visible: false,
      x: 400,
      y: 300,
      rotation: 0,
      size: 300,          // side length
      type: '45',         // '45' or '30-60'
      dragging: false,
      rotating: false,
      dragOffset: null
    };
  }

  toggleRuler() { this.ruler.visible = !this.ruler.visible; }
  toggleProtractor() { this.protractor.visible = !this.protractor.visible; }
  toggleSetSquare() { this.setSquare.visible = !this.setSquare.visible; }

  // Hit test for overlay interaction
  hitTest(x, y) {
    if (this.ruler.visible && this._hitRuler(x, y)) return 'ruler';
    if (this.protractor.visible && this._hitProtractor(x, y)) return 'protractor';
    if (this.setSquare.visible && this._hitSetSquare(x, y)) return 'setSquare';
    return null;
  }

  // Hit test for rotation handle (small circle at the end)
  hitTestRotate(x, y) {
    if (this.ruler.visible) {
      const r = this.ruler;
      const hx = r.x + Math.cos(r.rotation) * r.length;
      const hy = r.y + Math.sin(r.rotation) * r.length;
      if (Math.hypot(x - hx, y - hy) < 20) return 'ruler';
    }
    if (this.protractor.visible) {
      const p = this.protractor;
      const hx = p.x + Math.cos(p.rotation) * (p.radius + 30);
      const hy = p.y + Math.sin(p.rotation) * (p.radius + 30);
      if (Math.hypot(x - hx, y - hy) < 20) return 'protractor';
    }
    if (this.setSquare.visible) {
      const s = this.setSquare;
      const hx = s.x + Math.cos(s.rotation) * (s.size + 20);
      const hy = s.y + Math.sin(s.rotation) * (s.size + 20);
      if (Math.hypot(x - hx, y - hy) < 20) return 'setSquare';
    }
    return null;
  }

  _hitRuler(x, y) {
    const r = this.ruler;
    // Transform point into ruler's local space
    const cos = Math.cos(-r.rotation);
    const sin = Math.sin(-r.rotation);
    const dx = x - r.x;
    const dy = y - r.y;
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    return lx >= -10 && lx <= r.length + 10 && ly >= -30 && ly <= 30;
  }

  _hitProtractor(x, y) {
    const p = this.protractor;
    const dist = Math.hypot(x - p.x, y - p.y);
    return dist <= p.radius + 15;
  }

  _hitSetSquare(x, y) {
    const s = this.setSquare;
    const dist = Math.hypot(x - s.x, y - s.y);
    return dist <= s.size * 0.8;
  }

  startDrag(which, x, y) {
    const item = this[which];
    if (!item) return;
    item.dragging = true;
    item.dragOffset = { x: x - item.x, y: y - item.y };
  }

  startRotate(which, x, y) {
    const item = this[which];
    if (!item) return;
    item.rotating = true;
  }

  onMove(x, y) {
    // Check ruler
    if (this.ruler.dragging && this.ruler.dragOffset) {
      this.ruler.x = x - this.ruler.dragOffset.x;
      this.ruler.y = y - this.ruler.dragOffset.y;
      return true;
    }
    if (this.ruler.rotating) {
      this.ruler.rotation = Math.atan2(y - this.ruler.y, x - this.ruler.x);
      return true;
    }

    // Check protractor
    if (this.protractor.dragging && this.protractor.dragOffset) {
      this.protractor.x = x - this.protractor.dragOffset.x;
      this.protractor.y = y - this.protractor.dragOffset.y;
      return true;
    }
    if (this.protractor.rotating) {
      this.protractor.rotation = Math.atan2(y - this.protractor.y, x - this.protractor.x);
      return true;
    }

    // Check set square
    if (this.setSquare.dragging && this.setSquare.dragOffset) {
      this.setSquare.x = x - this.setSquare.dragOffset.x;
      this.setSquare.y = y - this.setSquare.dragOffset.y;
      return true;
    }
    if (this.setSquare.rotating) {
      this.setSquare.rotation = Math.atan2(y - this.setSquare.y, x - this.setSquare.x);
      return true;
    }

    return false;
  }

  onUp() {
    this.ruler.dragging = false;
    this.ruler.rotating = false;
    this.ruler.dragOffset = null;
    this.protractor.dragging = false;
    this.protractor.rotating = false;
    this.protractor.dragOffset = null;
    this.setSquare.dragging = false;
    this.setSquare.rotating = false;
    this.setSquare.dragOffset = null;
  }

  // ---- RENDER ----

  render(ctx, coordSystem) {
    if (this.ruler.visible) this._renderRuler(ctx, coordSystem);
    if (this.protractor.visible) this._renderProtractor(ctx, coordSystem);
    if (this.setSquare.visible) this._renderSetSquare(ctx, coordSystem);
  }

  _renderRuler(ctx, cs) {
    const r = this.ruler;
    const height = 50;

    ctx.save();
    const screen = cs.canvasToScreen(r.x, r.y);
    ctx.translate(screen.x, screen.y);
    ctx.rotate(r.rotation);
    ctx.scale(cs.zoom, cs.zoom);

    // Body
    ctx.fillStyle = 'rgba(255, 220, 120, 0.7)';
    ctx.strokeStyle = 'rgba(120, 80, 0, 0.6)';
    ctx.lineWidth = 1;
    ctx.fillRect(0, -height / 2, r.length, height);
    ctx.strokeRect(0, -height / 2, r.length, height);

    // Tick marks
    ctx.strokeStyle = 'rgba(60, 40, 0, 0.8)';
    ctx.fillStyle = 'rgba(60, 40, 0, 0.9)';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';

    for (let i = 0; i <= r.length; i += 10) {
      const isCm = i % 100 === 0;
      const isHalf = i % 50 === 0;
      const tickH = isCm ? 18 : isHalf ? 12 : 6;

      ctx.beginPath();
      ctx.moveTo(i, -height / 2);
      ctx.lineTo(i, -height / 2 + tickH);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(i, height / 2);
      ctx.lineTo(i, height / 2 - tickH);
      ctx.stroke();

      if (isCm && i > 0) {
        ctx.fillText(String(i / 100), i, 4);
      }
    }

    // Rotation handle
    ctx.beginPath();
    ctx.arc(r.length + 15, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(230, 57, 70, 0.8)';
    ctx.fill();

    ctx.restore();
  }

  _renderProtractor(ctx, cs) {
    const p = this.protractor;

    ctx.save();
    const screen = cs.canvasToScreen(p.x, p.y);
    ctx.translate(screen.x, screen.y);
    ctx.rotate(p.rotation);
    ctx.scale(cs.zoom, cs.zoom);

    const r = p.radius;

    // Semi-circle body
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(180, 220, 255, 0.5)';
    ctx.strokeStyle = 'rgba(30, 80, 160, 0.6)';
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();

    // Inner circles
    for (let ir = r * 0.3; ir < r; ir += r * 0.2) {
      ctx.beginPath();
      ctx.arc(0, 0, ir, Math.PI, 0);
      ctx.strokeStyle = 'rgba(30, 80, 160, 0.15)';
      ctx.stroke();
    }

    // Degree marks
    ctx.strokeStyle = 'rgba(30, 80, 160, 0.8)';
    ctx.fillStyle = 'rgba(30, 80, 160, 0.9)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let deg = 0; deg <= 180; deg++) {
      const rad = (Math.PI - deg * Math.PI / 180);
      const isTen = deg % 10 === 0;
      const isFive = deg % 5 === 0;
      const innerR = isTen ? r * 0.85 : isFive ? r * 0.9 : r * 0.93;

      ctx.beginPath();
      ctx.moveTo(Math.cos(rad) * innerR, Math.sin(rad) * innerR);
      ctx.lineTo(Math.cos(rad) * r, Math.sin(rad) * r);
      ctx.lineWidth = isTen ? 1.5 : 0.5;
      ctx.stroke();

      if (isTen) {
        const labelR = r * 0.78;
        ctx.save();
        ctx.translate(Math.cos(rad) * labelR, Math.sin(rad) * labelR);
        ctx.rotate(rad - Math.PI / 2);
        ctx.fillText(String(deg), 0, 0);
        ctx.restore();
      }
    }

    // Center dot
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(230, 57, 70, 0.9)';
    ctx.fill();

    // Rotation handle
    ctx.beginPath();
    ctx.arc(r + 20, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(230, 57, 70, 0.8)';
    ctx.fill();

    ctx.restore();
  }

  _renderSetSquare(ctx, cs) {
    const s = this.setSquare;

    ctx.save();
    const screen = cs.canvasToScreen(s.x, s.y);
    ctx.translate(screen.x, screen.y);
    ctx.rotate(s.rotation);
    ctx.scale(cs.zoom, cs.zoom);

    const sz = s.size;

    ctx.beginPath();
    if (s.type === '45') {
      // 45-45-90 triangle
      ctx.moveTo(0, 0);
      ctx.lineTo(sz, 0);
      ctx.lineTo(0, -sz);
      ctx.closePath();
    } else {
      // 30-60-90 triangle
      ctx.moveTo(0, 0);
      ctx.lineTo(sz, 0);
      ctx.lineTo(0, -sz * Math.tan(Math.PI / 3));
      ctx.closePath();
    }

    ctx.fillStyle = 'rgba(200, 255, 200, 0.5)';
    ctx.strokeStyle = 'rgba(30, 100, 30, 0.6)';
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();

    // Tick marks along base
    ctx.strokeStyle = 'rgba(30, 100, 30, 0.7)';
    ctx.fillStyle = 'rgba(30, 100, 30, 0.8)';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';

    for (let i = 0; i <= sz; i += 10) {
      const isCm = i % 100 === 0;
      const tickH = isCm ? 12 : 4;
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, -tickH);
      ctx.lineWidth = isCm ? 1 : 0.5;
      ctx.stroke();

      if (isCm && i > 0) {
        ctx.fillText(String(i / 100), i, 10);
      }
    }

    // Right angle mark
    const markSz = 15;
    ctx.strokeStyle = 'rgba(30, 100, 30, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, -markSz, markSz, markSz);

    // Rotation handle
    ctx.beginPath();
    ctx.arc(sz + 15, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(230, 57, 70, 0.8)';
    ctx.fill();

    ctx.restore();
  }
}
