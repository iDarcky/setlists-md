// Beta icons: the same mark on a brand-green tile with a BETA band, so the
// beta app (beta.setlists.md and PR previews) can't be mistaken for the real
// one on a Home Screen or in a tab. Writes public/beta/. Run after
// render_icons.cjs:  node scripts/brand/render_beta_icons.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const pub = path.join(__dirname, '..', '..', 'public');
const out = path.join(pub, 'beta');
fs.mkdirSync(out, { recursive: true });

const TILE = '#1A1816';
const BETA_TILE = '#53796F';
// band: [y, height, font size] in the 256 viewBox; null = colour only (too small for text)
const BAND = '<rect x="0" y="206" width="256" height="50" fill="#E2A832"/>'
  + '<text x="128" y="243" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="34" letter-spacing="6" fill="#1A1816">BETA</text>';

function beta(src, withBand) {
  let svg = fs.readFileSync(path.join(pub, src), 'utf8').split(TILE).join(BETA_TILE);
  if (withBand) {
    // Keep the band inside a rounded tile: clip to the tile's own corners.
    const rx = (svg.match(/<rect width="256" height="256"( rx="(\d+)")?/) || [])[2] || 0;
    svg = svg.replace('</svg>', `<clipPath id="t"><rect width="256" height="256" rx="${rx}"/></clipPath><g clip-path="url(#t)">${BAND}</g></svg>`);
  }
  return svg;
}

const ICONS = [
  ['setlists-md-icon.svg', 'icon-192.png', 192, true],
  ['setlists-md-icon.svg', 'icon-512.png', 512, true],
  ['setlists-md-icon-maskable.svg', 'icon-512-maskable.png', 512, false],
  ['setlists-md-icon-full.svg', 'apple-touch-icon.png', 180, true],
  ['favicon.svg', 'favicon-32.png', 32, false],
];

(async () => {
  fs.writeFileSync(path.join(out, 'favicon.svg'), beta('favicon.svg', false));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [src, file, size, band] of ICONS) {
    const uri = 'data:image/svg+xml;base64,' + Buffer.from(beta(src, band)).toString('base64');
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<body style="margin:0;background:transparent"><img src="${uri}" width="${size}" height="${size}" style="display:block"></body>`);
    await page.waitForTimeout(100);
    fs.writeFileSync(path.join(out, file), await page.screenshot({ omitBackground: true }));
  }
  await browser.close();
  console.log('rendered beta icons into public/beta/');
})();
