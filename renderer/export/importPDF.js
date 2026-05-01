// importPDF — opens a PDF and creates one whiteboard page per PDF page
// Each page gets the PDF page rendered as a background image

const pdfjs = require('pdfjs-dist');

// Set worker source to bundled worker
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '';
}

/**
 * Import a PDF file and convert each page to a canvas data URL
 * @param {ArrayBuffer} data — raw PDF bytes
 * @param {number} scale — render scale (2 = 2x resolution)
 * @returns {Promise<Array<{width: number, height: number, dataUrl: string}>>}
 */
export async function renderPDFPages(data, scale = 2) {
  // Load with fake worker (inline)
  const loadingTask = pdfjs.getDocument({
    data,
    disableWorker: true,
    isEvalSupported: false
  });

  const pdf = await loadingTask.promise;
  const pages = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    // Render to offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    await page.render({
      canvasContext: ctx,
      viewport
    }).promise;

    pages.push({
      width: viewport.width / scale,
      height: viewport.height / scale,
      dataUrl: canvas.toDataURL('image/png')
    });

    // Free memory
    page.cleanup();
  }

  pdf.destroy();
  return pages;
}

/**
 * Import PDF into the document store — creates one page per PDF page
 * @param {ArrayBuffer} data — raw PDF bytes
 * @param {object} documentStore — Zustand store reference
 */
export async function importPDFToDocument(data, documentStore) {
  const pdfPages = await renderPDFPages(data, 2);
  const store = documentStore.getState();
  const { generateId } = require('../utils/uuid');

  for (let i = 0; i < pdfPages.length; i++) {
    const pdfPage = pdfPages[i];

    // Create a new whiteboard page
    const pageId = generateId();
    store.addPage({
      id: pageId,
      background: 'solid',
      backgroundColor: '#FFFFFF',
      objects: [
        {
          id: generateId(),
          type: 'image',
          src: pdfPage.dataUrl,
          bounds: {
            x: 0,
            y: 0,
            w: pdfPage.width,
            h: pdfPage.height
          },
          transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
          visible: true,
          locked: true // Lock PDF background so it can't be accidentally moved
        }
      ]
    });
  }

  // Navigate to the first imported page
  if (pdfPages.length > 0) {
    const allPages = documentStore.getState().pages;
    const firstImported = allPages[allPages.length - pdfPages.length];
    if (firstImported) {
      store.setCurrentPage(firstImported.id);
    }
  }

  return pdfPages.length;
}
