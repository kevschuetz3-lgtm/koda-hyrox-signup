// Measure (a) the new artwork's two lines, (b) the OLD logo footprint on both
// garment mockups (green HYROX + white KODA CROSSFIT), so the new lockup can be
// placed at the same chest position/scale.
const fs = require('fs');
const path = require('path');
const puppeteer = require('C:/Users/kevsc/Desktop/Claude/hyrox_pdf/node_modules/puppeteer');

const ART = path.join(__dirname, 'page1.png');
const GARMENTS = {
  tee:  'C:/Users/kevsc/Desktop/Claude/koda-hyrox-shirts/assets/mens-tee.png',
  crop: 'C:/Users/kevsc/Desktop/Claude/koda-hyrox-shirts/assets/womens-crop.png',
};

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const load = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

  const out = await page.evaluate(async (artUrl, garmentUrls) => {
    const li = src => new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = src; });
    const dataOf = async (src) => {
      const img = await li(src);
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      return { W: img.width, H: img.height, d: x.getImageData(0, 0, img.width, img.height).data };
    };
    const bbox = (W, H, test, d) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (test(d[i], d[i+1], d[i+2], d[i+3])) {
          n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, n };
    };

    const res = {};

    // ---- New artwork: dark ink on white ----
    const art = await dataOf(artUrl);
    const isInk = (r, g, b, a) => a > 20 && (r + g + b) / 3 < 140;
    res.art = { size: [art.W, art.H], full: bbox(art.W, art.H, isInk, art.d) };
    // row profile to find the gap between the two lines
    const rows = [];
    for (let y = 0; y < art.H; y++) {
      let c = 0;
      for (let x = 0; x < art.W; x++) { const i = (y * art.W + x) * 4; if (isInk(art.d[i], art.d[i+1], art.d[i+2], art.d[i+3])) c++; }
      rows.push(c);
    }
    // find contiguous bands of ink rows
    const bands = [];
    let start = -1;
    for (let y = 0; y < art.H; y++) {
      if (rows[y] > 0 && start === -1) start = y;
      if ((rows[y] === 0 || y === art.H - 1) && start !== -1) { bands.push([start, y - 1]); start = -1; }
    }
    res.art.bands = bands;
    // per-band bbox
    res.art.lines = bands.map(([by0, by1]) => {
      let x0 = 1e9, x1 = -1;
      for (let y = by0; y <= by1; y++) for (let x = 0; x < art.W; x++) {
        const i = (y * art.W + x) * 4;
        if (isInk(art.d[i], art.d[i+1], art.d[i+2], art.d[i+3])) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
      }
      return { y0: by0, y1: by1, x0, x1, w: x1 - x0 + 1, h: by1 - by0 + 1 };
    });

    // ---- Old garment mockups: green wordmark + white subtext ----
    res.garments = {};
    for (const [name, url] of Object.entries(garmentUrls)) {
      const g = await dataOf(url);
      const isGreen = (r, gg, b, a) => a > 20 && gg > Math.max(r, b) + 10;
      const green = bbox(g.W, g.H, isGreen, g.d);
      // white subtext: bright pixels, but ONLY in the band under the green mark
      // (avoids the neck label / background)
      const yLo = green.y1 + 2, yHi = Math.min(g.H - 1, green.y1 + Math.round(green.h * 1.6));
      let wx0 = 1e9, wy0 = 1e9, wx1 = -1, wy1 = -1, wn = 0;
      for (let y = yLo; y <= yHi; y++) for (let x = green.x0 - 40; x <= green.x1 + 40; x++) {
        if (x < 0 || x >= g.W) continue;
        const i = (y * g.W + x) * 4;
        const r = g.d[i], gg = g.d[i+1], b = g.d[i+2];
        if (r > 140 && gg > 140 && b > 140) { wn++; if (x < wx0) wx0 = x; if (x > wx1) wx1 = x; if (y < wy0) wy0 = y; if (y > wy1) wy1 = y; }
      }
      const white = { x0: wx0, y0: wy0, x1: wx1, y1: wy1, w: wx1 - wx0 + 1, h: wy1 - wy0 + 1, n: wn };
      res.garments[name] = {
        size: [g.W, g.H], green, white,
        lockup: { x0: Math.min(green.x0, white.x0), y0: green.y0, x1: Math.max(green.x1, white.x1), y1: white.y1 },
      };
    }
    return res;
  }, load(ART), Object.fromEntries(Object.entries(GARMENTS).map(([k, v]) => [k, load(v)])));

  console.log(JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(__dirname, 'measure.json'), JSON.stringify(out, null, 2));
  await browser.close();
})();
