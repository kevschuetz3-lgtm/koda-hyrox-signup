// Contact sheet: clean bases (logo erased) + new lockup in several colors.
const fs = require('fs');
const path = require('path');
const puppeteer = require('C:/Users/kevsc/Desktop/Claude/hyrox_pdf/node_modules/puppeteer');
const DIR = 'C:/Users/kevsc/Desktop/Claude/hyrox-simulation-signup/assets/mockups';

const COLORS = [
  ['Lime', '#5BF94C'], ['Red', '#F3222B'], ['White', '#FFFFFF'],
  ['Gold', [[0,'#FFF9D8'],[0.30,'#FFE58A'],[0.47,'#E2A82F'],[0.53,'#8A5A0B'],[0.60,'#EFC14D'],[0.82,'#FFE9A0'],[1,'#C9942C']]],
  ['Silver', [[0,'#FDFDFD'],[0.30,'#E9EBED'],[0.47,'#BAC0C6'],[0.53,'#6E747B'],[0.60,'#D6DADE'],[0.82,'#F4F5F6'],[1,'#A7ACB2']]],
];
const LOGOY = { tee: [0.2938, 0.3945], crop: [0.3662, 0.4981] };

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const load = f => 'data:image/png;base64,' + fs.readFileSync(path.join(DIR, f)).toString('base64');
  const loadJ = f => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(DIR, f)).toString('base64');
  const assets = {
    teeBase: loadJ('tee-base.jpg'), teeHy: load('tee-hyrox.png'), teeKd: load('tee-koda.png'),
    cropBase: loadJ('crop-base.jpg'), cropHy: load('crop-hyrox.png'), cropKd: load('crop-koda.png'),
  };

  const sheet = await page.evaluate(async (A, COLORS, LOGOY) => {
    const li = src => new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = src; });
    const compose = async (baseUrl, hyUrl, kdUrl, color, logoY) => {
      const base = await li(baseUrl), hy = await li(hyUrl), kd = await li(kdUrl);
      const W = base.width, H = base.height;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d'); x.drawImage(base, 0, 0);
      // HYROX tinted
      const t = document.createElement('canvas'); t.width = W; t.height = H;
      const tx = t.getContext('2d');
      tx.drawImage(hy, 0, 0);
      tx.globalCompositeOperation = 'source-in';
      if (Array.isArray(color)) {
        const gr = tx.createLinearGradient(0, logoY[0] * H, 0, logoY[1] * H);
        color.forEach(([p, col]) => gr.addColorStop(p, col));
        tx.fillStyle = gr;
      } else tx.fillStyle = color;
      tx.fillRect(0, 0, W, H);
      x.drawImage(t, 0, 0);
      // KODA CROSSFIT always white
      const k = document.createElement('canvas'); k.width = W; k.height = H;
      const kx = k.getContext('2d');
      kx.drawImage(kd, 0, 0);
      kx.globalCompositeOperation = 'source-in';
      kx.fillStyle = '#FFFFFF'; kx.fillRect(0, 0, W, H);
      x.drawImage(k, 0, 0);
      return c;
    };

    const cell = 360, cols = COLORS.length + 1, rows = 2;
    const sheet = document.createElement('canvas');
    sheet.width = cell * cols; sheet.height = cell * rows + 34;
    const sx = sheet.getContext('2d');
    sx.fillStyle = '#d8d8d8'; sx.fillRect(0, 0, sheet.width, sheet.height);
    sx.fillStyle = '#000'; sx.font = 'bold 15px sans-serif';

    const garments = [['tee', A.teeBase, A.teeHy, A.teeKd], ['crop', A.cropBase, A.cropHy, A.cropKd]];
    for (let r = 0; r < 2; r++) {
      const [gname, b, h, kd] = garments[r];
      // col 0 = clean base (no logo) to check the erase
      const baseImg = await li(b);
      const s0 = Math.min(cell / baseImg.width, cell / baseImg.height);
      sx.drawImage(baseImg, (cell - baseImg.width * s0) / 2, r * cell + (cell - baseImg.height * s0) / 2, baseImg.width * s0, baseImg.height * s0);
      sx.fillText(gname + ' — CLEAN BASE', 10, r * cell + 18);
      for (let ci = 0; ci < COLORS.length; ci++) {
        const cnv = await compose(b, h, kd, COLORS[ci][1], LOGOY[gname]);
        const s = Math.min(cell / cnv.width, cell / cnv.height);
        const ox = (ci + 1) * cell;
        sx.drawImage(cnv, ox + (cell - cnv.width * s) / 2, r * cell + (cell - cnv.height * s) / 2, cnv.width * s, cnv.height * s);
        sx.fillText(gname + ' — ' + COLORS[ci][0], ox + 10, r * cell + 18);
      }
    }
    return sheet.toDataURL('image/jpeg', 0.92);
  }, assets, COLORS, LOGOY);

  fs.writeFileSync(path.join(__dirname, 'new-logo-sheet.jpg'), Buffer.from(sheet.split(',')[1], 'base64'));
  console.log('sheet written');
  await browser.close();
})();
