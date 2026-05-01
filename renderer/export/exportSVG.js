export function exportSVG(page) {
  if (!page) return '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

  const objects = page.objects || [];
  const sorted = [...objects].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  // Calculate viewBox from all objects
  let minX = 0, minY = 0, maxX = 1920, maxY = 1080;
  for (const obj of sorted) {
    const b = obj.bounds;
    if (!b) continue;
    const tx = obj.transform?.translateX || 0;
    const ty = obj.transform?.translateY || 0;
    minX = Math.min(minX, b.x + tx);
    minY = Math.min(minY, b.y + ty);
    maxX = Math.max(maxX, b.x + b.w + tx);
    maxY = Math.max(maxY, b.y + b.h + ty);
  }

  const width = maxX - minX;
  const height = maxY - minY;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">\n`;

  // Background
  const bg = page.background;
  svg += `  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${bg?.color || '#FFFFFF'}"/>\n`;

  for (const obj of sorted) {
    if (obj.visible === false) continue;
    const tx = obj.transform?.translateX || 0;
    const ty = obj.transform?.translateY || 0;
    const transformAttr = (tx || ty) ? ` transform="translate(${tx},${ty})"` : '';

    switch (obj.type) {
      case 'stroke': {
        if (!obj.points || obj.points.length < 2) break;
        let d = `M ${obj.points[0].x} ${obj.points[0].y}`;
        for (let i = 1; i < obj.points.length - 1; i++) {
          const mx = (obj.points[i].x + obj.points[i + 1].x) / 2;
          const my = (obj.points[i].y + obj.points[i + 1].y) / 2;
          d += ` Q ${obj.points[i].x} ${obj.points[i].y} ${mx} ${my}`;
        }
        const last = obj.points[obj.points.length - 1];
        d += ` L ${last.x} ${last.y}`;
        const opacity = obj.opacity != null ? ` opacity="${obj.opacity}"` : '';
        svg += `  <path d="${d}" fill="none" stroke="${obj.color || '#000'}" stroke-width="${obj.width || 2}" stroke-linecap="round" stroke-linejoin="round"${opacity}${transformAttr}/>\n`;
        break;
      }

      case 'shape': {
        const b = obj.bounds;
        if (!b) break;
        const fill = obj.filled && obj.fillColor ? obj.fillColor : 'none';
        const stroke = obj.strokeColor || '#000';
        const sw = obj.strokeWidth || 2;

        if (obj.shapeType === 'rectangle') {
          svg += `  <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${transformAttr}/>\n`;
        } else if (obj.shapeType === 'ellipse') {
          svg += `  <ellipse cx="${b.x + b.w/2}" cy="${b.y + b.h/2}" rx="${b.w/2}" ry="${b.h/2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${transformAttr}/>\n`;
        } else if (obj.shapeType === 'triangle') {
          const points = `${b.x + b.w/2},${b.y} ${b.x + b.w},${b.y + b.h} ${b.x},${b.y + b.h}`;
          svg += `  <polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${transformAttr}/>\n`;
        }
        break;
      }

      case 'line': {
        svg += `  <line x1="${obj.startX}" y1="${obj.startY}" x2="${obj.endX}" y2="${obj.endY}" stroke="${obj.color || '#000'}" stroke-width="${obj.width || 2}" stroke-linecap="round"${transformAttr}/>\n`;
        break;
      }

      case 'text': {
        const b = obj.bounds;
        if (!b) break;
        const fontParts = [];
        if (obj.bold) fontParts.push('font-weight="bold"');
        if (obj.italic) fontParts.push('font-style="italic"');
        const decoration = obj.underline ? ' text-decoration="underline"' : '';
        svg += `  <text x="${b.x}" y="${b.y + (obj.fontSize || 16)}" font-family="${obj.fontFamily || 'Arial'}" font-size="${obj.fontSize || 16}" fill="${obj.color || '#000'}" ${fontParts.join(' ')}${decoration}${transformAttr}>${escapeXml(obj.text || '')}</text>\n`;
        break;
      }
    }
  }

  svg += `</svg>`;
  return svg;
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
