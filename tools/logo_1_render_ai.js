// Rasterize the new HYROX .ai (PDF-based) at high resolution for inspection.
const fs = require('fs');
const path = require('path');
const puppeteer = require('C:/Users/kevsc/Desktop/Claude/hyrox_pdf/node_modules/puppeteer');

const SRC = 'C:/Users/kevsc/Downloads/HYROX Desgins-01.ai';
const OUT = __dirname;

(async () => {
  const b64 = fs.readFileSync(SRC).toString('base64');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('about:blank');
  await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js' });

  const res = await page.evaluate(async (b64) => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const doc = await pdfjsLib.getDocument({ data: u8 }).promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const pg = await doc.getPage(p);
      const vp0 = pg.getViewport({ scale: 1 });
      // target ~2400px on the long edge
      const scale = 2400 / Math.max(vp0.width, vp0.height);
      const vp = pg.getViewport({ scale });
      const c = document.createElement('canvas');
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const ctx = c.getContext('2d');
      // transparent render (no background fill) so we can see what's actually drawn
      await pg.render({ canvasContext: ctx, viewport: vp }).promise;
      pages.push({ n: p, w: c.width, h: c.height, ptW: vp0.width, ptH: vp0.height, png: c.toDataURL('image/png') });

      // also a version over mid-gray, to reveal white artwork
      const c2 = document.createElement('canvas');
      c2.width = c.width; c2.height = c.height;
      const x2 = c2.getContext('2d');
      x2.fillStyle = '#808080'; x2.fillRect(0, 0, c2.width, c2.height);
      x2.drawImage(c, 0, 0);
      pages[pages.length - 1].pngGray = c2.toDataURL('image/png');

      // and over black
      const c3 = document.createElement('canvas');
      c3.width = c.width; c3.height = c.height;
      const x3 = c3.getContext('2d');
      x3.fillStyle = '#000000'; x3.fillRect(0, 0, c3.width, c3.height);
      x3.drawImage(c, 0, 0);
      pages[pages.length - 1].pngBlack = c3.toDataURL('image/png');
    }
    return { numPages: doc.numPages, pages };
  }, b64);

  const save = (dataUrl, file) => fs.writeFileSync(path.join(OUT, file), Buffer.from(dataUrl.split(',')[1], 'base64'));
  res.pages.forEach(p => {
    save(p.png, `page${p.n}.png`);
    save(p.pngGray, `page${p.n}-gray.png`);
    save(p.pngBlack, `page${p.n}-black.png`);
    console.log(`page ${p.n}: ${p.w}x${p.h}px (${Math.round(p.ptW)}x${Math.round(p.ptH)}pt)`);
  });
  console.log('numPages:', res.numPages);
  await browser.close();
})();
