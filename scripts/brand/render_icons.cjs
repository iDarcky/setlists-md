// Renders the PNG icons and the link-preview images from the SVGs that
// build_logo.py wrote. Run after it:  node scripts/brand/render_icons.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const pub = path.join(root, 'public');
const web = path.join(root, 'website');
const dataUri = (f) => 'data:image/svg+xml;base64,' + fs.readFileSync(f).toString('base64');
const font = (f) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(web, 'fonts', f)).toString('base64');

const ICONS = [
  ['setlists-md-icon.svg', 'icon-192.png', 192, [pub]],
  ['setlists-md-icon.svg', 'icon-512.png', 512, [pub]],
  ['setlists-md-icon-maskable.svg', 'icon-512-maskable.png', 512, [pub]],
  ['setlists-md-icon-full.svg', 'apple-touch-icon.png', 180, [pub, web]],
  ['favicon.svg', 'favicon-32.png', 32, [pub, web]],
  ['setlists-md-badge.svg', 'badge-96.png', 96, [pub]],
];

const OG = [
  { out: path.join(web, 'og.png'), lang: 'en', head: 'Sunday, sorted.',
    sub: 'Chord charts, setlists and the band’s schedule in one app for worship teams.', foot: 'Free during the beta' },
  { out: path.join(web, 'ro', 'og.png'), lang: 'ro', head: 'Duminica, rezolvată.',
    sub: 'Acorduri, liste de cântări și programul trupei într-o singură aplicație pentru echipele de laudă.', foot: 'Gratuit pe durata versiunii beta' },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [src, out, size, dirs] of ICONS) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<body style="margin:0;background:transparent"><img src="${dataUri(path.join(pub, src))}" width="${size}" height="${size}" style="display:block"></body>`);
    await page.waitForTimeout(100);
    const png = await page.screenshot({ omitBackground: true });
    for (const d of dirs) fs.writeFileSync(path.join(d, out), png);
  }
  const mark = dataUri(path.join(pub, 'setlists-md-mark.svg'));
  for (const og of OG) {
    await page.setViewportSize({ width: 1200, height: 630 });
    await page.setContent(`<!doctype html><html lang="${og.lang}"><style>
      @font-face{font-family:Geist;src:url(${font('Geist-Variable.woff2')}) format('woff2');font-weight:100 900}
      @font-face{font-family:'Geist Mono';src:url(${font('GeistMono-Variable.woff2')}) format('woff2');font-weight:100 900}
      body{margin:0;width:1200px;height:630px;background:#11100E;color:#F3EFE8;font-family:Geist;display:flex;align-items:center}
      .wrap{display:grid;grid-template-columns:300px 1fr;gap:56px;align-items:center;padding:0 88px}
      h1{font-size:96px;line-height:1;letter-spacing:-.04em;font-weight:600;margin:0 0 24px}
      p{font-size:32px;line-height:1.3;color:#A39C92;margin:0 0 36px;max-width:22ch}
      .foot{font:24px 'Geist Mono',monospace;color:#7AA89C}
      .brand{font-size:30px;font-weight:600;letter-spacing:-.02em;margin-bottom:28px}.brand span{font-family:'Geist Mono';color:#7AA89C}
    </style><body><div class="wrap"><img src="${mark}" width="300" height="300">
      <div><div class="brand">setlists<span>.md</span></div><h1>${og.head}</h1><p>${og.sub}</p><div class="foot">${og.foot}</div></div></div></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    await page.screenshot({ path: og.out });
    // Invite links open the app, so the app gets the English preview too.
    if (og.lang === 'en') fs.copyFileSync(og.out, path.join(pub, 'og.png'));
  }
  await browser.close();
  console.log('rendered icons and link previews');
})();
