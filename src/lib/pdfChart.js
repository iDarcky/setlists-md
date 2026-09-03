// PDF → chord chart. The pdf.js half; all the reconstruction lives in
// pdfLayout.js as pure functions.
//
// pdf.js is ~330KB gzipped with its worker, so it is imported lazily — nobody
// pays for it until a .pdf actually arrives.
import { buildChartFromItems } from './pdfLayout';

let pdfjsPromise = null;

async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then(async (pdfjs) => {
      // Same-origin worker — `worker-src 'self' blob:` in vercel.json covers it.
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    }).catch((err) => {
      pdfjsPromise = null; // let a blocked first load retry
      throw err;
    });
  }
  return pdfjsPromise;
}

// One page's text runs, normalised into the shape pdfLayout expects.
function itemsFromTextContent(textContent) {
  return textContent.items
    .filter(i => typeof i.str === 'string' && i.str.length > 0)
    .map(i => ({
      str: i.str,
      x: i.transform[4],
      y: i.transform[5],
      w: i.width || 0,
      h: i.height || 0,
      font: i.fontName,
    }));
}

/**
 * Convert a PDF into our .md chart format.
 *
 * @param {ArrayBuffer|Uint8Array} data
 * @returns {Promise<{ md: string, meta: object, warnings: string[], pages: number }>}
 * @throws if the PDF can't be opened, or has no text layer (a scan).
 */
export async function pdfToChart(data) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({
    data: data instanceof Uint8Array ? data : new Uint8Array(data),
    useSystemFonts: true,
    isEvalSupported: false, // the app's CSP has no 'unsafe-eval'
  }).promise;

  try {
    const warnings = [];
    const items = [];
    // Pages stack downward: offset each page's y so page 2 sorts below page 1.
    let yOffset = 0;
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const pageItems = itemsFromTextContent(await page.getTextContent());
      for (const it of pageItems) items.push({ ...it, y: it.y + yOffset });
      yOffset -= page.getViewport({ scale: 1 }).height;
      page.cleanup();
    }

    if (items.length === 0) {
      throw new Error('no-text-layer');
    }

    // More than a few pages of chart is almost certainly a songbook. We don't
    // try to split it — say so instead of silently producing one giant song.
    if (doc.numPages > 4) {
      warnings.push(`This PDF has ${doc.numPages} pages — if it's a songbook, split it first; only one song is created.`);
    }

    const built = buildChartFromItems(items);
    return { ...built, warnings: [...warnings, ...built.warnings], pages: doc.numPages };
  } finally {
    doc.destroy();
  }
}

export function isPdfFile(file) {
  return /\.pdf$/i.test(file?.name || '') || file?.type === 'application/pdf';
}
