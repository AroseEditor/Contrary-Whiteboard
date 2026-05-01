import React, { useRef, useEffect } from 'react';

export default function PageThumbnail({ page, isActive, onClick, onContextMenu, index }) {
  const canvasRef = useRef(null);

  // Render a mini thumbnail of the page
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = 200;
    const h = 112;
    canvas.width = w;
    canvas.height = h;

    // Background
    const bg = page.background;
    ctx.fillStyle = bg?.color || '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    // Mini render of objects
    if (page.objects && page.objects.length > 0) {
      // Calculate bounds of all objects
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const obj of page.objects) {
        const b = obj.bounds;
        if (!b) continue;
        const tx = obj.transform?.translateX || 0;
        const ty = obj.transform?.translateY || 0;
        minX = Math.min(minX, b.x + tx);
        minY = Math.min(minY, b.y + ty);
        maxX = Math.max(maxX, b.x + b.w + tx);
        maxY = Math.max(maxY, b.y + b.h + ty);
      }

      if (isFinite(minX)) {
        const contentW = maxX - minX || 1;
        const contentH = maxY - minY || 1;
        const scale = Math.min((w - 20) / contentW, (h - 20) / contentH, 1);
        const offsetX = (w - contentW * scale) / 2 - minX * scale;
        const offsetY = (h - contentH * scale) / 2 - minY * scale;

        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);

        for (const obj of page.objects) {
          if (obj.visible === false) continue;
          const tx = obj.transform?.translateX || 0;
          const ty = obj.transform?.translateY || 0;

          ctx.save();
          ctx.translate(tx, ty);

          if (obj.type === 'stroke' && obj.points && obj.points.length > 1) {
            ctx.strokeStyle = obj.color || '#000';
            ctx.lineWidth = Math.max(1, (obj.width || 2) * 0.5);
            ctx.globalAlpha = obj.opacity || 1;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(obj.points[0].x, obj.points[0].y);
            for (let i = 1; i < obj.points.length; i++) {
              ctx.lineTo(obj.points[i].x, obj.points[i].y);
            }
            ctx.stroke();
            ctx.globalAlpha = 1;
          } else if (obj.type === 'shape' && obj.bounds) {
            const b = obj.bounds;
            ctx.strokeStyle = obj.strokeColor || '#000';
            ctx.lineWidth = 1;
            if (obj.shapeType === 'ellipse') {
              ctx.beginPath();
              ctx.ellipse(b.x + b.w/2, b.y + b.h/2, b.w/2, b.h/2, 0, 0, Math.PI*2);
              ctx.stroke();
            } else {
              ctx.strokeRect(b.x, b.y, b.w, b.h);
            }
          } else if (obj.type === 'text' && obj.bounds) {
            ctx.fillStyle = '#999';
            ctx.fillRect(obj.bounds.x, obj.bounds.y, obj.bounds.w, 4);
          }

          ctx.restore();
        }

        ctx.restore();
      }
    }
  }, [page, page.objects?.length]);

  return (
    <div
      className={`page-thumbnail${isActive ? ' active' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <canvas ref={canvasRef} style={{ width: '100%', aspectRatio: '16/9' }} />
      <span className="page-thumbnail-label">{index + 1}</span>
    </div>
  );
}
