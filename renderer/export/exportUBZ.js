import JSZip from 'jszip';

// Export in OpenBoard .ubz format
// UBZ is a ZIP containing scene XML + media assets
export async function exportUBZ(filePath, documentData, ipcRenderer) {
  const zip = new JSZip();
  const pages = documentData.pages || [];

  // Build scene.xml
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<document version="1.0">\n';

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    xml += `  <page id="${page.id}" name="${escapeXml(page.name || `Page ${i + 1}`)}">\n`;
    xml += `    <background type="${page.background?.type || 'solid'}" color="${page.background?.color || '#FFFFFF'}"/>\n`;

    const sorted = [...(page.objects || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    for (const obj of sorted) {
      if (obj.visible === false) continue;

      const tx = obj.transform?.translateX || 0;
      const ty = obj.transform?.translateY || 0;
      const sx = obj.transform?.scaleX || 1;
      const sy = obj.transform?.scaleY || 1;
      const rot = obj.transform?.rotation || 0;
      const transformStr = `translate="${tx},${ty}" scale="${sx},${sy}" rotation="${rot}"`;

      switch (obj.type) {
        case 'stroke': {
          if (!obj.points || obj.points.length === 0) break;
          const pointsStr = obj.points.map(p => `${p.x},${p.y}`).join(' ');
          xml += `    <stroke id="${obj.id}" color="${obj.color || '#000'}" width="${obj.width || 2}" opacity="${obj.opacity || 1}" ${transformStr}>\n`;
          xml += `      <points>${pointsStr}</points>\n`;
          xml += `    </stroke>\n`;
          break;
        }
        case 'shape': {
          const b = obj.bounds || {};
          xml += `    <shape id="${obj.id}" type="${obj.shapeType || 'rectangle'}" x="${b.x || 0}" y="${b.y || 0}" width="${b.w || 0}" height="${b.h || 0}" fill="${obj.fillColor || 'none'}" stroke="${obj.strokeColor || '#000'}" strokeWidth="${obj.strokeWidth || 2}" ${transformStr}/>\n`;
          break;
        }
        case 'line': {
          xml += `    <line id="${obj.id}" x1="${obj.startX}" y1="${obj.startY}" x2="${obj.endX}" y2="${obj.endY}" color="${obj.color || '#000'}" width="${obj.width || 2}" ${transformStr}/>\n`;
          break;
        }
        case 'text': {
          const b = obj.bounds || {};
          xml += `    <text id="${obj.id}" x="${b.x || 0}" y="${b.y || 0}" width="${b.w || 200}" height="${b.h || 30}" font="${obj.fontFamily || 'Arial'}" size="${obj.fontSize || 16}" color="${obj.color || '#000'}" bold="${obj.bold || false}" italic="${obj.italic || false}" ${transformStr}>${escapeXml(obj.text || '')}</text>\n`;
          break;
        }
        case 'image': {
          const assetName = `asset_${obj.id}.png`;
          xml += `    <image id="${obj.id}" src="${assetName}" x="${obj.bounds?.x || 0}" y="${obj.bounds?.y || 0}" width="${obj.bounds?.w || 0}" height="${obj.bounds?.h || 0}" ${transformStr}/>\n`;

          // Store image data in zip
          if (obj.src && obj.src.startsWith('data:')) {
            const base64 = obj.src.split(',')[1];
            zip.file(`assets/${assetName}`, base64, { base64: true });
          }
          break;
        }
      }
    }

    xml += `  </page>\n`;
  }

  xml += '</document>';

  zip.file('scene.xml', xml);

  const buffer = await zip.generateAsync({ type: 'uint8array' });
  await ipcRenderer.invoke('file:write-binary', {
    filePath,
    buffer: Array.from(buffer)
  });
}

function escapeXml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
