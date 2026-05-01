// CanvasRenderer — renders all objects on a canvas context

import { getObjectBounds } from '../../utils/hitTest';

export class CanvasRenderer {
  constructor() {
    this.imageCache = new Map();
  }

  // Render the full page: background + grid + objects + selection handles
  renderPage(ctx, page, coordSystem, options = {}) {
    const { showGrid, selectedObjectIds = [], selectionRect } = options;
    const canvas = ctx.canvas;
    const dpr = coordSystem.dpr;

    // Clear entire canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    this.renderBackground(ctx, page.background, canvas, coordSystem);

    // Draw grid if enabled
    if (showGrid) {
      this.renderGrid(ctx, canvas, coordSystem);
    }

    // Apply world transform for objects
    coordSystem.applyTransform(ctx);

    // Sort objects by zIndex and render
    const sorted = [...page.objects].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    for (const obj of sorted) {
      if (obj.visible === false) continue;
      this.renderObject(ctx, obj);
    }

    // Draw selection handles (in screen space)
    coordSystem.resetTransform(ctx);
    if (selectedObjectIds.length > 0) {
      this.renderSelectionHandles(ctx, page.objects, selectedObjectIds, coordSystem);
    }

    // Draw selection rectangle if dragging
    if (selectionRect) {
      this.renderSelectionRect(ctx, selectionRect);
    }
  }

  renderBackground(ctx, bg, canvas, coordSystem) {
    coordSystem.resetTransform(ctx);
    const w = canvas.width / coordSystem.dpr;
    const h = canvas.height / coordSystem.dpr;

    if (!bg || bg.type === 'solid') {
      ctx.fillStyle = bg?.color || '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
    } else if (bg.type === 'grid') {
      ctx.fillStyle = bg.color || '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      this.drawGrid(ctx, w, h, bg.size || 40, bg.gridColor || '#E0E0E0', coordSystem);
    } else if (bg.type === 'lines') {
      ctx.fillStyle = bg.color || '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      this.drawLines(ctx, w, h, bg.size || 30, bg.lineColor || '#BBDEFB', coordSystem);
    } else if (bg.type === 'dots') {
      ctx.fillStyle = bg.color || '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      this.drawDots(ctx, w, h, bg.size || 30, bg.dotColor || '#CCCCCC', coordSystem);
    }
  }

  drawGrid(ctx, w, h, size, color, cs) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;

    const startX = (cs.panX % (size * cs.zoom)) / cs.zoom;
    const startY = (cs.panY % (size * cs.zoom)) / cs.zoom;
    const step = size * cs.zoom;

    ctx.beginPath();
    for (let x = cs.panX % step; x < w; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = cs.panY % step; y < h; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  }

  drawLines(ctx, w, h, size, color, cs) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;
    const step = size * cs.zoom;

    ctx.beginPath();
    for (let y = cs.panY % step; y < h; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  }

  drawDots(ctx, w, h, size, color, cs) {
    ctx.fillStyle = color;
    const step = size * cs.zoom;
    const dotSize = 1.5;

    for (let x = cs.panX % step; x < w; x += step) {
      for (let y = cs.panY % step; y < h; y += step) {
        ctx.beginPath();
        ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  renderGrid(ctx, canvas, coordSystem) {
    // Standalone grid overlay (when toggled from View menu)
    const w = canvas.width / coordSystem.dpr;
    const h = canvas.height / coordSystem.dpr;
    this.drawGrid(ctx, w, h, 40, 'rgba(200,200,200,0.3)', coordSystem);
  }

  renderObject(ctx, obj) {
    ctx.save();

    // Apply object transform
    const tx = obj.transform?.translateX || 0;
    const ty = obj.transform?.translateY || 0;
    const sx = obj.transform?.scaleX || 1;
    const sy = obj.transform?.scaleY || 1;
    const rotation = obj.transform?.rotation || 0;

    if (tx || ty || rotation || sx !== 1 || sy !== 1) {
      const bounds = obj.bounds || { x: 0, y: 0, w: 0, h: 0 };
      const cx = bounds.x + bounds.w / 2 + tx;
      const cy = bounds.y + bounds.h / 2 + ty;

      ctx.translate(cx, cy);
      if (rotation) ctx.rotate(rotation);
      ctx.scale(sx, sy);
      ctx.translate(-cx + tx, -cy + ty);

      if (!rotation && sx === 1 && sy === 1) {
        ctx.setTransform(ctx.getTransform()); // normalize
      }
    }

    switch (obj.type) {
      case 'stroke':
        this.renderStroke(ctx, obj);
        break;
      case 'shape':
        this.renderShape(ctx, obj);
        break;
      case 'line':
        this.renderLine(ctx, obj);
        break;
      case 'text':
        this.renderText(ctx, obj);
        break;
      case 'image':
      case 'pdf':
        this.renderImage(ctx, obj);
        break;
    }

    ctx.restore();
  }

  renderStroke(ctx, stroke) {
    const points = stroke.points;
    if (!points || points.length === 0) return;

    ctx.strokeStyle = stroke.color || '#000000';
    ctx.lineWidth = stroke.width || 2;
    ctx.globalAlpha = stroke.opacity != null ? stroke.opacity : 1;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = stroke.color || '#000000';
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 1; i++) {
      const mx = (points[i].x + points[i + 1].x) / 2;
      const my = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
    }

    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  renderShape(ctx, shape) {
    const b = shape.bounds;
    if (!b) return;

    ctx.strokeStyle = shape.strokeColor || '#000000';
    ctx.lineWidth = shape.strokeWidth || 2;
    ctx.fillStyle = shape.fillColor || 'transparent';

    const filled = shape.filled || shape.fillColor !== 'transparent';

    switch (shape.shapeType) {
      case 'rectangle':
        ctx.beginPath();
        ctx.rect(b.x, b.y, b.w, b.h);
        if (filled) ctx.fill();
        ctx.stroke();
        break;

      case 'ellipse':
        ctx.beginPath();
        ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, Math.abs(b.w / 2), Math.abs(b.h / 2), 0, 0, Math.PI * 2);
        if (filled) ctx.fill();
        ctx.stroke();
        break;

      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(b.x + b.w / 2, b.y);
        ctx.lineTo(b.x + b.w, b.y + b.h);
        ctx.lineTo(b.x, b.y + b.h);
        ctx.closePath();
        if (filled) ctx.fill();
        ctx.stroke();
        break;
    }
  }

  renderLine(ctx, line) {
    const b = line.bounds;
    if (!b) return;

    ctx.strokeStyle = line.color || '#000000';
    ctx.lineWidth = line.width || 2;
    ctx.lineCap = 'round';

    const x1 = line.startX ?? b.x;
    const y1 = line.startY ?? b.y;
    const x2 = line.endX ?? (b.x + b.w);
    const y2 = line.endY ?? (b.y + b.h);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrowheads
    if (line.arrowEnd) {
      this.drawArrowhead(ctx, x1, y1, x2, y2, line.width || 2);
    }
    if (line.arrowStart) {
      this.drawArrowhead(ctx, x2, y2, x1, y1, line.width || 2);
    }
  }

  drawArrowhead(ctx, fromX, fromY, toX, toY, lineWidth) {
    const headLen = Math.max(10, lineWidth * 4);
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  renderText(ctx, textObj) {
    const b = textObj.bounds;
    if (!b) return;

    const fontParts = [];
    if (textObj.bold) fontParts.push('bold');
    if (textObj.italic) fontParts.push('italic');
    fontParts.push(`${textObj.fontSize || 16}px`);
    fontParts.push(textObj.fontFamily || 'Arial');

    ctx.font = fontParts.join(' ');
    ctx.fillStyle = textObj.color || '#000000';
    ctx.textBaseline = 'top';

    // Simple word-wrap within bounds
    const maxWidth = b.w || 200;
    const lineHeight = (textObj.fontSize || 16) * 1.3;
    const text = textObj.text || '';
    const words = text.split(' ');
    let line = '';
    let y = b.y;

    for (let i = 0; i < words.length; i++) {
      const testLine = line + (line ? ' ' : '') + words[i];
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && line) {
        ctx.fillText(line, b.x, y);
        if (textObj.underline) {
          const w = ctx.measureText(line).width;
          ctx.beginPath();
          ctx.moveTo(b.x, y + lineHeight - 2);
          ctx.lineTo(b.x + w, y + lineHeight - 2);
          ctx.strokeStyle = textObj.color || '#000000';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        line = words[i];
        y += lineHeight;
      } else {
        line = testLine;
      }
    }

    if (line) {
      ctx.fillText(line, b.x, y);
      if (textObj.underline) {
        const w = ctx.measureText(line).width;
        ctx.beginPath();
        ctx.moveTo(b.x, y + lineHeight - 2);
        ctx.lineTo(b.x + w, y + lineHeight - 2);
        ctx.strokeStyle = textObj.color || '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  renderImage(ctx, imgObj) {
    const b = imgObj.bounds;
    if (!b || !imgObj.src) return;

    let img = this.imageCache.get(imgObj.src);
    if (!img) {
      img = new Image();
      img.src = imgObj.src;
      this.imageCache.set(imgObj.src, img);
      img.onload = () => {
        // Will be rendered on next frame
      };
    }

    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, b.x, b.y, b.w, b.h);
    }
  }

  renderSelectionHandles(ctx, objects, selectedIds, coordSystem) {
    const selected = objects.filter(o => selectedIds.includes(o.id));
    if (selected.length === 0) return;

    // Calculate combined bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const obj of selected) {
      const b = getObjectBounds(obj);
      if (!b) continue;
      const tl = coordSystem.canvasToScreen(b.x, b.y);
      const br = coordSystem.canvasToScreen(b.x + b.w, b.y + b.h);
      minX = Math.min(minX, tl.x);
      minY = Math.min(minY, tl.y);
      maxX = Math.max(maxX, br.x);
      maxY = Math.max(maxY, br.y);
    }

    if (!isFinite(minX)) return;

    const pad = 4;
    const x = minX - pad;
    const y = minY - pad;
    const w = maxX - minX + pad * 2;
    const h = maxY - minY + pad * 2;

    // Selection rectangle
    ctx.strokeStyle = '#E63946';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    // 8 resize handles
    const hs = 8;
    const handles = [
      { x: x - hs/2, y: y - hs/2 },                     // NW
      { x: x + w/2 - hs/2, y: y - hs/2 },               // N
      { x: x + w - hs/2, y: y - hs/2 },                  // NE
      { x: x + w - hs/2, y: y + h/2 - hs/2 },            // E
      { x: x + w - hs/2, y: y + h - hs/2 },              // SE
      { x: x + w/2 - hs/2, y: y + h - hs/2 },            // S
      { x: x - hs/2, y: y + h - hs/2 },                  // SW
      { x: x - hs/2, y: y + h/2 - hs/2 }                 // W
    ];

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#E63946';
    ctx.lineWidth = 1.5;
    for (const handle of handles) {
      ctx.fillRect(handle.x, handle.y, hs, hs);
      ctx.strokeRect(handle.x, handle.y, hs, hs);
    }

    // Rotation handle (top-center, 20px above)
    const rotX = x + w / 2;
    const rotY = y - 20;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(rotX, rotY);
    ctx.strokeStyle = '#E63946';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(rotX, rotY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#E63946';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  renderSelectionRect(ctx, rect) {
    ctx.strokeStyle = '#E63946';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.fillStyle = 'rgba(230, 57, 70, 0.1)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.setLineDash([]);
  }

  // Render laser pointer trail
  renderLaser(ctx, points, coordSystem) {
    if (!points || points.length === 0) return;

    coordSystem.resetTransform(ctx);

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const age = Date.now() - p.time;
      const alpha = Math.max(0, 1 - age / 1000);
      if (alpha <= 0) continue;

      const screenPos = coordSystem.canvasToScreen(p.x, p.y);
      const radius = 6 * alpha + 2;

      // Outer glow
      const gradient = ctx.createRadialGradient(screenPos.x, screenPos.y, 0, screenPos.x, screenPos.y, radius * 3);
      gradient.addColorStop(0, `rgba(230, 57, 70, ${alpha * 0.6})`);
      gradient.addColorStop(1, 'rgba(230, 57, 70, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, radius * 3, 0, Math.PI * 2);
      ctx.fill();

      // Core dot
      ctx.fillStyle = `rgba(255, 80, 90, ${alpha})`;
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Render eraser cursor
  renderEraserCursor(ctx, pos, size, coordSystem) {
    if (!pos) return;
    coordSystem.resetTransform(ctx);
    const screenPos = coordSystem.canvasToScreen(pos.x, pos.y);
    const radius = (size / 2) * coordSystem.zoom;

    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}
