import { jsPDF } from 'jspdf';

export async function exportPDF(filePath, documentData, ipcRenderer) {
  const pages = documentData.pages || [];
  if (pages.length === 0) return;

  // Create a temporary canvas to render each page
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Use 16:9 aspect ratio at 150 DPI
  const pageWidth = 297; // mm (A4 landscape approx)
  const pageHeight = 210;
  const pxPerMm = 4; // render resolution multiplier
  canvas.width = pageWidth * pxPerMm;
  canvas.height = pageHeight * pxPerMm;

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [pageWidth, pageHeight]
  });

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    if (i > 0) {
      pdf.addPage([pageWidth, pageHeight], 'landscape');
    }

    // Clear and render background
    ctx.fillStyle = page.background?.color || '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate content bounds for scaling
    let minX = 0, minY = 0, maxX = canvas.width, maxY = canvas.height;

    // Render objects
    const sorted = [...(page.objects || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    for (const obj of sorted) {
      if (obj.visible === false) continue;

      ctx.save();
      const tx = obj.transform?.translateX || 0;
      const ty = obj.transform?.translateY || 0;
      ctx.translate(tx, ty);

      if (obj.type === 'stroke' && obj.points && obj.points.length > 1) {
        ctx.strokeStyle = obj.color || '#000';
        ctx.lineWidth = obj.width || 2;
        ctx.globalAlpha = obj.opacity || 1;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(obj.points[0].x, obj.points[0].y);
        for (let j = 1; j < obj.points.length - 1; j++) {
          const mx = (obj.points[j].x + obj.points[j + 1].x) / 2;
          const my = (obj.points[j].y + obj.points[j + 1].y) / 2;
          ctx.quadraticCurveTo(obj.points[j].x, obj.points[j].y, mx, my);
        }
        ctx.lineTo(obj.points[obj.points.length - 1].x, obj.points[obj.points.length - 1].y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (obj.type === 'shape' && obj.bounds) {
        const b = obj.bounds;
        ctx.strokeStyle = obj.strokeColor || '#000';
        ctx.lineWidth = obj.strokeWidth || 2;
        if (obj.filled && obj.fillColor) {
          ctx.fillStyle = obj.fillColor;
        }

        if (obj.shapeType === 'ellipse') {
          ctx.beginPath();
          ctx.ellipse(b.x + b.w/2, b.y + b.h/2, b.w/2, b.h/2, 0, 0, Math.PI * 2);
          if (obj.filled) ctx.fill();
          ctx.stroke();
        } else if (obj.shapeType === 'triangle') {
          ctx.beginPath();
          ctx.moveTo(b.x + b.w/2, b.y);
          ctx.lineTo(b.x + b.w, b.y + b.h);
          ctx.lineTo(b.x, b.y + b.h);
          ctx.closePath();
          if (obj.filled) ctx.fill();
          ctx.stroke();
        } else {
          if (obj.filled) ctx.fillRect(b.x, b.y, b.w, b.h);
          ctx.strokeRect(b.x, b.y, b.w, b.h);
        }
      } else if (obj.type === 'line') {
        ctx.strokeStyle = obj.color || '#000';
        ctx.lineWidth = obj.width || 2;
        ctx.beginPath();
        ctx.moveTo(obj.startX, obj.startY);
        ctx.lineTo(obj.endX, obj.endY);
        ctx.stroke();
      } else if (obj.type === 'text' && obj.bounds) {
        const fontParts = [];
        if (obj.bold) fontParts.push('bold');
        if (obj.italic) fontParts.push('italic');
        fontParts.push(`${obj.fontSize || 16}px`);
        fontParts.push(obj.fontFamily || 'Arial');
        ctx.font = fontParts.join(' ');
        ctx.fillStyle = obj.color || '#000';
        ctx.textBaseline = 'top';
        ctx.fillText(obj.text || '', obj.bounds.x, obj.bounds.y);
      }

      ctx.restore();
    }

    // Add canvas as image to PDF
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
  }

  // Get PDF as array buffer and write via IPC
  const pdfBuffer = pdf.output('arraybuffer');
  await ipcRenderer.invoke('file:write-binary', {
    filePath,
    buffer: Array.from(new Uint8Array(pdfBuffer))
  });
}
