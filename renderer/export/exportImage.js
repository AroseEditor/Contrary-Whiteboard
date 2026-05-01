export async function exportImage(filePath, canvas, ipcRenderer, format = 'png') {
  const mimeType = format === 'jpeg' || format === 'jpg' ? 'image/jpeg' : 'image/png';
  const dataUrl = canvas.toDataURL(mimeType, 0.95);
  await ipcRenderer.invoke('file:export', { filePath, data: dataUrl });
}

export async function exportAllPages(pages, ipcRenderer, format = 'png', multiplier = 1) {
  const JSZip = require('jszip');
  const zip = new JSZip();

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 1920 * multiplier;
  canvas.height = 1080 * multiplier;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    // Clear
    ctx.fillStyle = page.background?.color || '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render objects (simplified — same as PDF export render)
    const sorted = [...(page.objects || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    for (const obj of sorted) {
      if (obj.visible === false) continue;
      ctx.save();
      const tx = obj.transform?.translateX || 0;
      const ty = obj.transform?.translateY || 0;
      ctx.translate(tx, ty);

      if (obj.type === 'stroke' && obj.points && obj.points.length > 1) {
        ctx.strokeStyle = obj.color || '#000';
        ctx.lineWidth = (obj.width || 2) * multiplier;
        ctx.globalAlpha = obj.opacity || 1;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(obj.points[0].x * multiplier, obj.points[0].y * multiplier);
        for (let j = 1; j < obj.points.length; j++) {
          ctx.lineTo(obj.points[j].x * multiplier, obj.points[j].y * multiplier);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    }

    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const dataUrl = canvas.toDataURL(mimeType, 0.95);
    const base64 = dataUrl.split(',')[1];
    zip.file(`page_${i + 1}.${ext}`, base64, { base64: true });
  }

  const zipBuffer = await zip.generateAsync({ type: 'uint8array' });
  return zipBuffer;
}
