#!/usr/bin/env node
// Builds the legal pages from one source.
//
//   docs/legal/<DOC>.md     English  -> website/<page>.html + src/data/<page>.md
//   docs/legal/<DOC>.ro.md  Romanian -> website/ro/<page>.html
//
// The website has no build step, so run this by hand after editing a text in
// docs/legal/ and commit what it writes:  node scripts/build-legal-pages.mjs
// The in-app copies (src/data/*.md) feed the Terms/Privacy sheet on the
// sign-up screen; links in them point to setlists.md.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://setlists.md';
// The logo comes from the home page, so a new logo needs no change here.
const indexHtml = readFileSync(join(ROOT, 'website/index.html'), 'utf8');
const MARK = indexHtml.match(/<symbol id="mark"[\s\S]*?<\/symbol>/)[0];

const DOCS = [
  { src: 'PRIVACY', page: 'privacy', app: true,
    desc: { en: 'What Setlists.md keeps about you and your church, why, and your rights.', ro: 'Ce păstrează Setlists.md despre tine și biserica ta, de ce, și drepturile tale.' } },
  { src: 'TERMS', page: 'terms', app: true,
    desc: { en: 'The agreement for using Setlists.md.', ro: 'Înțelegerea pentru folosirea Setlists.md.' } },
  { src: 'CHURCH-TERMS', page: 'church-terms', app: false,
    desc: { en: 'How Setlists.md handles members’ data for each church or band.', ro: 'Cum prelucrează Setlists.md datele membrilor pentru fiecare biserică sau trupă.' } },
  { src: 'COPYRIGHT', page: 'copyright', app: true,
    desc: { en: 'Songs, licences, and how to report a song.', ro: 'Cântări, licențe și cum semnalezi o cântare.' } },
];

const UI = {
  en: { skip: 'Skip to content', how: 'How it works', faq: 'FAQ', help: 'Help', login: 'Log in', join: 'Join beta', menu: 'Menu', main: 'Main', homeLabel: 'Setlists.md home', other: 'Română', otherLang: 'ro',
    foot: { privacy: 'Privacy', terms: 'Terms', church: 'Church terms', copyright: 'Copyright' }, made: 'Made in Romania for worship teams everywhere.' },
  ro: { skip: 'Sari la conținut', how: 'Cum funcționează', faq: 'Întrebări', help: 'Ajutor', login: 'Intră în cont', join: 'Intră în beta', menu: 'Meniu', main: 'Principal', homeLabel: 'Setlists.md, pagina principală', other: 'English', otherLang: 'en',
    foot: { privacy: 'Confidențialitate', terms: 'Termeni', church: 'Termeni pentru biserici', copyright: 'Drepturi de autor' }, made: 'Făcut în România pentru echipele de laudă de peste tot.' },
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(text, linkBase) {
  let out = esc(text);
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const url = /^(https?:|mailto:)/.test(href) ? href : `${linkBase}${href}`;
    const ext = /^https?:/.test(url) && !url.startsWith(SITE) ? ' rel="noopener"' : '';
    return `<a href="${url}"${ext}>${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  out = out.replace(/\*([^*]+)\*/g, '<i>$1</i>');
  out = out.replace(/\b([a-z]+@setlists\.md)\b(?![^<]*<\/a>)/g, '<a href="mailto:$1">$1</a>');
  return out;
}

/** Small Markdown subset: #/## headings, paragraphs, - lists, | tables. */
function toHtml(md, linkBase) {
  const lines = md.split('\n');
  const html = [];
  let title = '';
  let meta = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim() === '---') continue;
    if (line.startsWith('# ')) { title = line.slice(2).trim(); continue; }
    if (!meta && /^\*[^*].*\*$/.test(line.trim())) { meta = line.trim().slice(1, -1); continue; }
    if (line.startsWith('## ')) { html.push(`<h2>${inline(line.slice(3), linkBase)}</h2>`); continue; }
    if (line.startsWith('### ')) { html.push(`<h3>${inline(line.slice(4), linkBase)}</h3>`); continue; }
    if (line.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].startsWith('- ')) { items.push(`  <li>${inline(lines[i].slice(2), linkBase)}</li>`); i++; }
      i--;
      html.push(`<ul>\n${items.join('\n')}\n</ul>`);
      continue;
    }
    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) { rows.push(lines[i]); i++; }
      i--;
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = cells(rows[0]).map(c => `<th>${inline(c, linkBase)}</th>`).join('');
      const body = rows.slice(2).map(r => `    <tr>${cells(r).map(c => `<td>${inline(c, linkBase)}</td>`).join('')}</tr>`).join('\n');
      html.push(`<div class="table-wrap"><table>\n  <thead><tr>${head}</tr></thead>\n  <tbody>\n${body}\n  </tbody>\n</table></div>`);
      continue;
    }
    html.push(`<p>${inline(line, linkBase)}</p>`);
  }
  return { title, meta, body: html.join('\n') };
}

function page({ lang, doc, title, meta, body }) {
  const t = UI[lang];
  const path = lang === 'en' ? `/${doc.page}` : `/ro/${doc.page}`;
  const otherPath = lang === 'en' ? `/ro/${doc.page}` : `/${doc.page}`;
  const p = lang === 'en' ? '/' : '/ro/';
  const foot = [['privacy', t.foot.privacy], ['terms', t.foot.terms], ['church-terms', t.foot.church], ['copyright', t.foot.copyright]]
    .map(([pg, label]) => `<a href="${p}${pg}"${pg === doc.page ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  const app = 'https://app.setlists.md/';
  return `<!DOCTYPE html>
<!-- Generated by scripts/build-legal-pages.mjs from docs/legal/. Edit the .md, then re-run the script. -->
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)} · Setlists.md</title>
<meta name="description" content="${esc(doc.desc[lang])}">
<link rel="canonical" href="${SITE}${path}">
<link rel="alternate" hreflang="en" href="${SITE}/${doc.page}">
<link rel="alternate" hreflang="ro" href="${SITE}/ro/${doc.page}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:title" content="${esc(title)} · Setlists.md">
<meta property="og:description" content="${esc(doc.desc[lang])}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="theme-color" content="#11100E">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" href="/fonts/Geist-Variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/GeistMono-Variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/site.css?v=2">
<script src="/site.js" defer></script>
<script data-goatcounter="https://insideahead.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  ${MARK}
  <symbol id="menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
  <symbol id="info" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></g></symbol>
</svg>
<a class="skip-link" href="#main">${t.skip}</a>
<header class="head" id="head">
  <div class="wrap row">
    <a class="brand" href="/" aria-label="${t.homeLabel}"><svg aria-hidden="true"><use href="#mark"/></svg><span translate="no">setlists<span class="ext">.md</span></span></a>
    <nav class="nav" aria-label="${t.main}"><a href="/#how">${t.how}</a><a href="/#faq">${t.faq}</a><a href="/help">${t.help}</a><span class="sep" aria-hidden="true"></span><a href="${app}?start=login&amp;from=site">${t.login}</a></nav>
    <a class="btn btn-gold btn-sm join" href="${app}?start=signup&amp;from=site">${t.join}</a>
    <button class="menu-btn" type="button" id="menuBtn" aria-expanded="false" aria-controls="mnav" aria-label="${t.menu}"><svg width="22" height="22" aria-hidden="true"><use href="#menu"/></svg></button>
  </div>
  <nav class="mnav wrap" id="mnav" aria-label="${t.main}" hidden><a href="/#how">${t.how}</a><a href="/#faq">${t.faq}</a><a href="/help">${t.help}</a><a href="${otherPath}" hreflang="${t.otherLang}" lang="${t.otherLang}">${t.other}</a><a href="${app}?start=login&amp;from=site">${t.login}</a></nav>
</header>

<main id="main">
<div class="page"><div class="wrap"><div class="prose">
<h1>${inline(title, '')}</h1>
<div class="draft"><svg width="18" height="18" aria-hidden="true" style="flex:none;margin-top:1px"><use href="#info"/></svg><div>${inline(meta, '')} <a class="lang-inline" href="${otherPath}" hreflang="${t.otherLang}" lang="${t.otherLang}">${t.other}</a></div></div>

${body}
</div></div></div>
</main>

<footer class="foot">
  <div class="wrap row">
    <a class="brand" href="/" aria-label="${t.homeLabel}"><svg aria-hidden="true"><use href="#mark"/></svg><span translate="no">setlists<span class="ext">.md</span></span></a>
    <nav aria-label="Footer"><a href="/#how">${t.how}</a><a href="/help">${t.help}</a>${foot}<a href="${otherPath}" hreflang="${t.otherLang}" lang="${t.otherLang}">${t.other}</a></nav>
  </div>
  <div class="wrap made">© 2026 Setlists.md · ${t.made}</div>
</footer>
</body>
</html>
`;
}

for (const doc of DOCS) {
  for (const lang of ['en', 'ro']) {
    const file = join(ROOT, 'docs/legal', `${doc.src}${lang === 'en' ? '' : '.ro'}.md`);
    const md = readFileSync(file, 'utf8');
    const { title, meta, body } = toHtml(md, '');
    const out = join(ROOT, 'website', lang === 'en' ? '' : 'ro', `${doc.page}.html`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, page({ lang, doc, title, meta, body }));
    if (lang === 'en' && doc.app) {
      // In-app copy: same text, links made absolute (the app lives elsewhere).
      const appMd = md.replace(/\]\((privacy|terms|copyright|church-terms)\)/g, `](${SITE}/$1)`);
      writeFileSync(join(ROOT, 'src/data', `${doc.page}.md`), appMd);
    }
    console.log('wrote', out.replace(ROOT + '/', ''));
  }
}
