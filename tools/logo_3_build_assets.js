// Rebuild the shirt mockup assets around the NEW HYROX artwork.
//
// Per garment we emit three files:
//   <g>-base.jpg   garment with the OLD logo fully removed (green wordmark AND
//                  white sub-text infilled with shirt black)
//   <g>-hyrox.png  full-frame alpha mask of the new HYROX line   -> tinted live
//   <g>-koda.png   full-frame alpha mask of "KODA CROSSFIT"      -> always white
//
// Placement: the new HYROX line is matched to the OLD HYROX line's width and
// horizontal centre, and the whole lockup is centred on the old lockup's
// vertical centre, so the print sits exactly where athletes have been seeing it.
const fs = require('fs');
const path = require('path');
const puppeteer = require('C:/Users/kevsc/Desktop/Claude/hyrox_pdf/node_modules/puppeteer');

const ART = path.join(__dirname, 'page1.png');
const OUT = 'C:/Users/kevsc/Desktop/Claude/hyrox-simulation-signup/assets/mockups';
const SRC = {
  tee:  'C:/Users/kevsc/Desktop/Claude/koda-hyrox-shirts/assets/mens-tee.png',
  crop: 'C:/Users/kevsc/Desktop/Claude/koda-hyrox-shirts/assets/womens-crop.png',
};
const M = require('./measure.json');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const load = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

  const results = {};
  for (const [name, file] of Object.entries(SRC)) {
    const geo = M.garments[name];
    const res = await page.evaluate(async (artUrl, garmentUrl, geo, artM) => {
      const li = src => new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = src; });
      const art = await li(artUrl);
      const gimg = await li(garmentUrl);
      const W = gimg.width, H = gimg.height;

      // ---------- 1. clean base: erase the old logo ----------
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d'); ctx.drawImage(gimg, 0, 0);
      const src = ctx.getImageData(0, 0, W, H);
      const d = src.data;

      const hit = new Uint8Array(W * H);
      const g = geo.green, wt = geo.white;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4, r = d[i], gg = d[i+1], b = d[i+2];
        // old green wordmark (incl. its dark green shadow)
        if (gg > Math.max(r, b) + 10) { hit[y * W + x] = 1; continue; }
        // old white sub-text, only inside its measured band (+pad)
        if (y >= wt.y0 - 6 && y <= wt.y1 + 6 && x >= wt.x0 - 10 && x <= wt.x1 + 10 &&
            r > 120 && gg > 120 && b > 120) hit[y * W + x] = 1;
      }
      // shirt black = median of dark, non-logo pixels around the logo band
      const rs = [], gs = [], bs = [];
      for (let y = Math.max(0, g.y0 - 25); y <= Math.min(H - 1, wt.y1 + 25); y++)
        for (let x = Math.max(0, g.x0 - 25); x <= Math.min(W - 1, g.x1 + 25); x++) {
          const p = y * W + x;
          if (!hit[p]) { const i = p * 4; if (d[i] < 90 && d[i+1] < 90 && d[i+2] < 90) { rs.push(d[i]); gs.push(d[i+1]); bs.push(d[i+2]); } }
        }
      const med = a => { a.sort((p, q) => p - q); return a[Math.floor(a.length / 2)] || 14; };
      const shirt = [med(rs), med(gs), med(bs)];

      // dilate the hit set by 3px so anti-aliased edges disappear too
      const fill = new Uint8Array(W * H);
      const R = 3;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!hit[y * W + x]) continue;
        for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < W && ny >= 0 && ny < H) fill[ny * W + nx] = 1;
        }
      }
      const base = ctx.createImageData(W, H);
      base.data.set(d);
      for (let p = 0; p < W * H; p++) if (fill[p]) {
        const i = p * 4;
        base.data[i] = shirt[0]; base.data[i+1] = shirt[1]; base.data[i+2] = shirt[2]; base.data[i+3] = 255;
      }
      const baseC = document.createElement('canvas'); baseC.width = W; baseC.height = H;
      const bx = baseC.getContext('2d');
      bx.fillStyle = '#ffffff'; bx.fillRect(0, 0, W, H);
      bx.putImageData(base, 0, 0);

      // ---------- 2. placement transform (artwork px -> frame px) ----------
      const hy = artM.lines[0], kd = artM.lines[1], full = artM.full;
      const s = g.w / hy.w;                       // match old HYROX width
      const lockH = full.h * s;
      const centerY = (g.y0 + wt.y1) / 2;         // old lockup vertical centre
      const originY = centerY - lockH / 2;        // where art.full.y0 lands
      const centerX = (g.x0 + g.x1) / 2;
      const originX = centerX - (hy.w * s) / 2 - (hy.x0 - full.x0) * s;
      const mapRect = (line) => ({
        sx: line.x0, sy: line.y0, sw: line.w, sh: line.h,
        dx: originX + (line.x0 - full.x0) * s,
        dy: originY + (line.y0 - full.y0) * s,
        dw: line.w * s, dh: line.h * s,
      });

      // ---------- 3. masks (white + alpha from ink darkness) ----------
      const makeMask = (line) => {
        const r = mapRect(line);
        const mc = document.createElement('canvas'); mc.width = W; mc.height = H;
        const mx = mc.getContext('2d');
        mx.fillStyle = '#ffffff'; mx.fillRect(0, 0, W, H);
        mx.imageSmoothingQuality = 'high';
        mx.drawImage(art, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
        const md = mx.getImageData(0, 0, W, H);
        const o = md.data;
        for (let p = 0; p < W * H; p++) {
          const i = p * 4;
          const lum = 0.299 * o[i] + 0.587 * o[i+1] + 0.114 * o[i+2];
          let a = (255 - lum) / (255 - 45);       // ink (~45) -> 1, paper (255) -> 0
          a = a < 0 ? 0 : a > 1 ? 1 : a;
          o[i] = 255; o[i+1] = 255; o[i+2] = 255; o[i+3] = Math.round(a * 255);
        }
        mx.putImageData(md, 0, 0);
        return { url: mc.toDataURL('image/png'), rect: r };
      };
      const hyMask = makeMask(hy);
      const kdMask = makeMask(kd);

      return {
        base: baseC.toDataURL('image/jpeg', 0.9),
        hyrox: hyMask.url, koda: kdMask.url,
        shirt, size: [W, H], scale: s,
        hyRect: hyMask.rect, kdRect: kdMask.rect,
        // vertical span of the HYROX line as a fraction of frame height (for gradients)
        logoY: [hyMask.rect.dy / H, (hyMask.rect.dy + hyMask.rect.dh) / H],
      };
    }, load(ART), load(file), geo, M.art);

    const save = (dataUrl, f) => fs.writeFileSync(path.join(OUT, f), Buffer.from(dataUrl.split(',')[1], 'base64'));
    save(res.base, `${name}-base.jpg`);
    save(res.hyrox, `${name}-hyrox.png`);
    save(res.koda, `${name}-koda.png`);
    results[name] = res;
    console.log(`${name}: frame ${res.size.join('x')} shirt-black rgb(${res.shirt}) scale ${res.scale.toFixed(4)}`);
    console.log(`   HYROX dest x ${res.hyRect.dx.toFixed(1)}..${(res.hyRect.dx+res.hyRect.dw).toFixed(1)}  y ${res.hyRect.dy.toFixed(1)}..${(res.hyRect.dy+res.hyRect.dh).toFixed(1)}`);
    console.log(`   KODA  dest x ${res.kdRect.dx.toFixed(1)}..${(res.kdRect.dx+res.kdRect.dw).toFixed(1)}  y ${res.kdRect.dy.toFixed(1)}..${(res.kdRect.dy+res.kdRect.dh).toFixed(1)}`);
    console.log(`   logoY = [${res.logoY[0].toFixed(4)}, ${res.logoY[1].toFixed(4)}]`);
  }
  fs.writeFileSync(path.join(__dirname, 'build_result.json'), JSON.stringify(results, (k, v) => (k === 'base' || k === 'hyrox' || k === 'koda') ? '[data]' : v, 2));
  await browser.close();
})();
