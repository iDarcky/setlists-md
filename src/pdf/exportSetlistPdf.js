// Export a setlist to a print-friendly PDF via a popup window.
//
// Two modes:
//   - 'overview'   : single cover page with the full set order (titles,
//                    keys, capo, tempo, per-song notes). Useful as a
//                    band/runner sheet.
//   - 'full'       : cover page + every song as a full chord chart
//                    (each starts on a new page). Mirrors the per-song
//                    chord chart export.
//
// Reuses the JS render helpers from exportSongPdf.js so song bodies match
// the single-song export. The print CSS is intentionally duplicated below
// so this module stays self-contained — keep it in sync with exportSongPdf
// if either file's print styles change meaningfully.


import { transposeKey, compactLabel, normalizeSectionName } from '../music';
import { resolveSongView } from '../arrangements';
import {
  escapeHtml,
  buildSongBody,
} from './exportSongPdf';
import { openPrintWindow, readInitialPrefs } from './pdfDocument';

const PDF_STYLES = `
  @page {
    size: Letter;
    margin: 0.55in 0.55in 0.7in;
    @bottom-right {
      content: counter(page) " / " counter(pages);
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
      font-size: 9pt;
      color: #888;
    }
  }

  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #1a1a1a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  :root {
    --body-size: 11pt;
    --lyric-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --col-count: 1;
    --col-gap: 0.4in;
  }

  body {
    font-family: var(--lyric-font);
    font-size: var(--body-size);
    line-height: 1.45;
  }

  /* Every song wrapped in <article class="song"> starts on a new page —
     including the first one (which lands after the cover/set-order page). */
  article.song {
    break-before: page;
    page-break-before: always;
  }

  article.song main {
    column-count: var(--col-count);
    column-gap: var(--col-gap);
    column-fill: balance;
  }

  body.no-chords .chord { display: none !important; }
  body.no-chords .cl-line { line-height: 1.4; }
  body.no-chords .cl-pair { margin-right: 0; }

  body.bw .section-label,
  body.bw .structure-pill { color: #222 !important; }
  body.bw .section-rule   { background: #ccc !important; }
  body.bw .structure-pill { border-color: #ccc !important; background: #f5f5f5 !important; }
  body.bw .cl-pair .chord { color: #222 !important; }
  body.bw .modulate-pill  { background: #444 !important; }

  .page {
    max-width: 7.5in;
    margin: 0 auto;
    padding: 24px;
  }
  @media print {
    .page { max-width: none; margin: 0; padding: 0; }
    .toolbar { display: none !important; }
  }

  .toolbar {
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 0 14px;
    background: linear-gradient(#fff, #fff 80%, rgba(255,255,255,0));
    z-index: 10;
  }
  .toolbar-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
    align-items: center;
  }
  .action-group {
    display: inline-flex;
    gap: 8px;
    margin-left: auto;
  }

  /* Narrow viewport (e.g. user dragged the popup small or opened on a phone):
     stack the toolbar so controls don't overflow. */
  @media (max-width: 640px) {
    .toolbar { padding: 10px 0; gap: 8px; }
    .toolbar-row.controls {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }
    .toolbar-row.controls .control-group { justify-content: space-between; }
    .toolbar-row.controls .control-group .seg { flex: 1; justify-content: stretch; }
    .toolbar-row.controls .control-group .seg button { flex: 1; }
    .toolbar-row.controls .toggle { justify-content: center; }
    .toolbar-row.controls .action-group {
      margin-left: 0;
      width: 100%;
      flex-direction: row;
    }
    .toolbar-row.controls .action-group .action { flex: 1; text-align: center; }
    .toolbar .tip { font-size: 8.5pt; }
  }
  .control-group {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .control-group .group-label {
    font-size: 8.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #888;
    margin-right: 2px;
  }
  .seg {
    display: inline-flex;
    border: 1px solid #d8d8d8;
    border-radius: 8px;
    padding: 2px;
    background: #fafafa;
  }
  .seg button {
    border: 0;
    background: transparent;
    font: inherit;
    font-size: 9.5pt;
    padding: 4px 10px;
    border-radius: 6px;
    cursor: pointer;
    color: #555;
  }
  .seg button.active {
    background: #fff;
    color: #111;
    box-shadow: 0 1px 2px rgba(0,0,0,0.08);
    font-weight: 600;
  }
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: 1px solid #d8d8d8;
    border-radius: 8px;
    background: #fafafa;
    font-size: 9.5pt;
    cursor: pointer;
    color: #555;
  }
  .toggle.active {
    background: #fff;
    color: #111;
    border-color: #b8b8b8;
    font-weight: 600;
  }
  .toggle .check {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 3px;
    border: 1px solid #c0c0c0;
    background: #fff;
    position: relative;
  }
  .toggle.active .check {
    background: #111;
    border-color: #111;
  }
  .toggle.active .check::after {
    content: "";
    position: absolute;
    left: 3px; top: 0px;
    width: 4px; height: 8px;
    border: solid #fff;
    border-width: 0 1.5px 1.5px 0;
    transform: rotate(45deg);
  }
  .toolbar .tip {
    flex: 1;
    font-size: 9pt;
    color: #777;
    line-height: 1.35;
  }
  .toolbar .tip strong { color: #444; font-weight: 600; }
  .toolbar button.action {
    font: inherit;
    font-size: 10pt;
    padding: 7px 14px;
    border-radius: 8px;
    border: 1px solid #d0d0d0;
    background: #fff;
    cursor: pointer;
    white-space: nowrap;
  }
  .toolbar button.action.primary {
    background: #111;
    color: #fff;
    border-color: #111;
  }

  /* ── Setlist cover page ─────────────────────────────────────────── */
  .setlist-cover {
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 18px;
    margin-bottom: 22px;
  }
  .setlist-cover .eyebrow {
    font-size: 9pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: #888;
    margin: 0 0 6px;
  }
  .setlist-cover h1 {
    font-family: "Iowan Old Style", Georgia, "Times New Roman", serif;
    font-size: 30pt;
    line-height: 1.05;
    margin: 0 0 8px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .setlist-cover .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    font-size: 10pt;
    color: #555;
  }
  .setlist-cover .meta strong { color: #111; font-weight: 600; }
  .setlist-cover .meta .sep { color: #ccc; }
  .setlist-cover .tags {
    display: flex; flex-wrap: wrap; gap: 4px 6px; margin-top: 10px;
  }
  .setlist-cover .tag {
    font-size: 8.5pt;
    color: #555;
    padding: 2px 7px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
  }

  /* ── Set order list ───────────────────────────────────────────── */
  .set-order { margin-top: 4px; }
  .set-order .structure {
    font-size: 8.5pt;
    color: #888;
    margin: 2px 0 0;
    font-family: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
    letter-spacing: 0.03em;
  }
  .set-order .row {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid #ececec;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .set-order .row:last-child { border-bottom: 0; }
  .set-order .num {
    font-family: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
    font-size: 10pt;
    color: #999;
    width: 1.6em;
    flex-shrink: 0;
    text-align: right;
  }
  .set-order .body { flex: 1; min-width: 0; }
  .set-order .title {
    font-size: 12.5pt;
    font-weight: 600;
    color: #111;
    margin: 0;
  }
  .set-order .artist {
    font-size: 9.5pt;
    color: #666;
    margin: 2px 0 0;
  }
  .set-order .row .tail {
    text-align: right;
    flex-shrink: 0;
    font-size: 10pt;
    color: #555;
    line-height: 1.35;
  }
  .set-order .key {
    font-weight: 700;
    color: #111;
  }
  .set-order .capo {
    display: inline-block;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #666;
    margin-right: 6px;
  }
  .set-order .tempo {
    display: block;
    font-size: 9pt;
    color: #777;
    margin-top: 1px;
    font-variant-numeric: tabular-nums;
  }
  .set-order .note {
    margin: 4px 0 0;
    font-size: 9.5pt;
    color: #555;
    font-style: italic;
  }
  /* Breaks read as a band intermission, not a numbered song row. */
  .set-order .break-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 14px 0;
    padding: 0 4px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .set-order .break-banner .rule {
    flex: 1;
    height: 0;
    border-top: 1px dashed #cfcfcf;
  }
  .set-order .break-banner .pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 5px 12px;
    border-radius: 999px;
    background: #f5f5f3;
    border: 1px solid #e2e2dd;
    font-size: 9pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: #6a6a6a;
  }
  .set-order .break-banner .pill .label-text { color: #2c2c2c; }
  .set-order .break-banner .pill .dur {
    font-weight: 600;
    letter-spacing: 0.06em;
    color: #888;
    text-transform: none;
  }
  .set-order .break-banner .pill .dot {
    width: 3px; height: 3px; border-radius: 50%;
    background: #c0c0c0;
    display: inline-block;
  }
  .set-order .break-banner .note {
    margin: 4px 12px 0;
    font-size: 9pt;
    color: #777;
    font-style: italic;
    text-align: center;
  }

  /* ── Per-song cover (re-uses styles from song export) ───────────── */
  .cover {
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 14px;
    margin-bottom: 18px;
  }
  .cover h1 {
    font-family: "Iowan Old Style", Georgia, "Times New Roman", serif;
    font-size: 22pt;
    line-height: 1.1;
    margin: 0 0 4px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .cover .subtitle {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 8px;
    font-size: 10pt;
    color: #666;
    margin-bottom: 10px;
  }
  .sub-artist { color: #444; font-weight: 500; }
  .sub-sep    { color: #bbb; }
  .sub-meta   { color: #555; }
  .sub-meta strong { color: #111; font-weight: 600; }
  .sub-label  {
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #999;
    font-weight: 700;
    margin-right: 1px;
  }
  .sub-unit   { color: #888; font-size: 9pt; }
  .meta-shift { color: #888; font-weight: 400; font-size: 9pt; }

  .structure-ribbon {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }
  .structure-pill {
    font-size: 8.5pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 3px 9px;
    border-radius: 999px;
    color: var(--accent);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }
  .cover-tags {
    margin-top: 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 6px;
  }
  .cover-tags .tag {
    font-size: 8.5pt;
    color: #555;
    padding: 2px 7px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
  }
  .cover-aux { margin-top: 10px; font-size: 9pt; color: #666; }
  .cover-aux strong { color: #444; margin-right: 4px; font-weight: 600; }
  .cover-notes { margin-top: 10px; font-size: 9.5pt; color: #444; font-style: italic; }
  .cover-notes strong { font-style: normal; color: #222; margin-right: 4px; }

  /* ── Sections ───────────────────────────────────────────────────── */
  .song-section {
    margin: 0 0 18px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .section-label {
    font-size: 10pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--accent);
  }
  .section-rule {
    flex: 1;
    height: 1px;
    background: color-mix(in srgb, var(--accent) 30%, #e0e0e0);
  }
  .section-note {
    font-size: 9.5pt;
    font-style: italic;
    color: #555;
    border-left: 2px solid #ccc;
    padding: 1px 0 1px 8px;
    margin: 0 0 6px 2px;
  }
  .section-body { padding-left: 2px; }

  .plain-line { margin: 0 0 4px; white-space: pre-wrap; }
  .empty-line { height: 0.6em; }

  .cl-line {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    margin: 0 0 6px;
    line-height: 1;
  }
  .cl-line.chord-only-line { margin-bottom: 4px; }
  .cl-pair {
    display: inline-flex;
    flex-direction: column;
    justify-content: flex-end;
    margin-right: 0;
  }
  .cl-pair .chord {
    font-family: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
    font-weight: 700;
    font-size: 0.92em;
    color: #B07A1F;
    line-height: 1;
    padding: 0 0.5em 2px 0;
    white-space: nowrap;
  }
  .cl-pair .lyric { line-height: 1.25; white-space: pre-wrap; }
  .cl-pair.chord-only { margin-right: 0.5em; }
  .cl-pair.chord-only .chord { padding-bottom: 0; }
  .inline-note {
    color: #777;
    font-style: italic;
    font-size: 0.82em;
    margin-left: 0.5em;
  }
  .inline-note-cl { align-self: flex-end; }

  .tab-block {
    font-family: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
    font-size: 9.5pt;
    line-height: 1.35;
    white-space: pre;
    overflow: visible;
    background: #f7f7f5;
    border: 1px solid #ececea;
    border-radius: 4px;
    padding: 8px 10px;
    margin: 6px 0 8px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .tab-time {
    display: block;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 8.5pt;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 4px;
  }

  .modulate { display: flex; align-items: center; gap: 10px; margin: 10px 0; }
  .modulate-rule { flex: 1; height: 1px; background: #d0d0d0; }
  .modulate-pill {
    font-size: 8.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    padding: 3px 10px;
    border-radius: 999px;
    background: #111;
    color: #fff;
  }

  .cover-artist {
    margin-top: 6px;
    font-size: 10pt;
    color: #666;
    font-weight: 500;
  }
  .cover-structure {
    margin-top: 6px;
    font-size: 9.5pt;
    color: #555;
    line-height: 1.5;
  }

  /* Collapse-repeats mode */
  .repeat-ref { display: none; }
  body.collapse-repeats .section-wrap[data-repeat="true"] > .song-section { display: none; }
  body.collapse-repeats .section-wrap[data-repeat="true"] > .repeat-ref {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 6px 0 14px;
  }
  .repeat-ref-pill {
    font-size: 9pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 4px 12px;
    border-radius: 999px;
    color: var(--accent);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  /* ── Cards layout: 3×3 grid of miniature setlist copies ───────── */
  /* In cards mode, the regular set-order is hidden and a grid of 9 mini
     copies of the full setlist appears — each one can be cut out. */
  .cards-grid { display: none; }
  body.cards-layout .set-order { display: none !important; }
  body.cards-layout .setlist-cover { display: none !important; }
  body.cards-layout .brand-footer { display: none !important; }
  body.cards-layout .cards-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
  }
  .mini-card {
    border: 1px dashed #bbb;
    padding: 8px 10px;
    overflow: hidden;
  }
  .mini-card-title {
    font-size: 8pt;
    font-weight: 700;
    margin: 0 0 2px;
    color: #111;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mini-card-date {
    font-size: 6pt;
    color: #999;
    margin: 0 0 4px;
  }
  .mini-row {
    display: flex;
    align-items: baseline;
    gap: 4px;
    padding: 1.5px 0;
    font-size: 6.5pt;
    line-height: 1.3;
  }
  .mini-row .mini-num {
    color: #bbb;
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 6pt;
    min-width: 1.2em;
    text-align: right;
    flex-shrink: 0;
  }
  .mini-row .mini-song-title {
    flex: 1;
    min-width: 0;
    font-weight: 600;
    color: #111;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mini-row .mini-key {
    font-weight: 700;
    color: #B07A1F;
    flex-shrink: 0;
    font-family: "JetBrains Mono", ui-monospace, monospace;
  }
  .mini-row .mini-tempo {
    color: #999;
    flex-shrink: 0;
    font-size: 6pt;
  }
  .mini-row .mini-structure {
    color: #888;
    font-size: 5.5pt;
    flex-shrink: 0;
    font-family: "JetBrains Mono", ui-monospace, monospace;
    max-width: 40%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mini-break {
    font-size: 6pt;
    color: #aaa;
    text-align: center;
    padding: 2px 0;
    font-style: italic;
    border-top: 1px solid #eee;
    border-bottom: 1px solid #eee;
    margin: 1px 0;
  }
  /* In print, force the grid onto a single page. */
  @media print {
    body.cards-layout .cards-grid {
      page-break-inside: avoid;
      break-inside: avoid;
    }
  }

  .brand-footer { display: none; }
  @media print {
    .brand-footer {
      display: block;
      position: fixed;
      bottom: 0.25in;
      left: 0;
      right: 0;
      text-align: center;
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
      font-size: 8.5pt;
      letter-spacing: 0.04em;
      color: #888;
    }
    .brand-footer .brand-name { color: #444; font-weight: 500; }
    .brand-footer .brand-md   { color: #53796F; font-weight: 700; }
  }
`;

function formatDate(dateStr, timeStr) {
  if (!dateStr) return '';
  try {
    const t = timeStr || '12:00';
    const d = new Date(`${dateStr}T${t}:00`);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  try {
    const d = new Date(`1970-01-01T${timeStr}`);
    if (Number.isNaN(d.getTime())) return timeStr;
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric' });
  } catch {
    return timeStr;
  }
}

function renderSetlistCover(setlist, items) {
  const tags = (setlist.tags && setlist.tags.length)
    ? setlist.tags
    : (setlist.service ? [setlist.service] : []);

  const songCount = items.filter(it => it.type !== 'break').length;
  const breakCount = items.filter(it => it.type === 'break').length;

  const dateLabel = formatDate(setlist.date, setlist.time);
  const timeLabel = formatTime(setlist.time);

  const metaParts = [];
  if (dateLabel) metaParts.push(`<span><strong>${escapeHtml(dateLabel)}</strong></span>`);
  if (timeLabel) metaParts.push(`<span>${escapeHtml(timeLabel)}</span>`);
  if (setlist.location) metaParts.push(`<span>${escapeHtml(setlist.location)}</span>`);
  metaParts.push(`<span>${songCount} song${songCount !== 1 ? 's' : ''}${breakCount ? ` + ${breakCount} break${breakCount !== 1 ? 's' : ''}` : ''}</span>`);
  const metaHtml = metaParts.join('<span class="sep">·</span>');

  const tagsHtml = tags.length
    ? `<div class="tags">${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';

  return `
    <header class="setlist-cover">
      <p class="eyebrow">Setlist</p>
      <h1>${escapeHtml(setlist.name || 'Untitled Setlist')}</h1>
      <div class="meta">${metaHtml}</div>
      ${tagsHtml}
    </header>`;
}

function renderBreakBanner(item) {
  const label = (item.label || 'Break').trim() || 'Break';
  const duration = item.duration ? `
    <span class="dot" aria-hidden="true"></span>
    <span class="dur">${escapeHtml(String(item.duration))} min</span>` : '';
  const note = item.note
    ? `<p class="note">${escapeHtml(item.note)}</p>`
    : '';
  return `
    <div class="break-banner">
      <span class="rule"></span>
      <span class="pill">
        <span class="label-text">${escapeHtml(label)}</span>
        ${duration}
      </span>
      <span class="rule"></span>
    </div>
    ${note}`;
}

function renderSongRow(item, songs, songIndex) {
  const raw = songs.find(s => s.id === item.songId);
  const song = raw ? resolveSongView(raw, item.arrangementId) : null;
  if (!song) return '';
  const num = String(songIndex).padStart(2, '0');
  const transpose = item.transpose || 0;
  const capo = item.capo || 0;
  const displayKey = transposeKey(song.key, transpose);
  const note = item.note ? `<p class="note">${escapeHtml(item.note)}</p>` : '';

  // Structure flow with compact labels (V1 · C · B · C)
  const names = song.structure || song.sections?.map(s => s.type) || [];
  const structureFlow = names.map(n => compactLabel(n)).join(' · ');
  const structureHtml = structureFlow
    ? `<p class="structure">${escapeHtml(structureFlow)}</p>`
    : '';

  return `
    <div class="row">
      <span class="num">${num}</span>
      <div class="body">
        <p class="title">${escapeHtml(song.title || 'Untitled')}</p>
        ${note}
      </div>
      <div class="tail">
        <div>
          ${capo > 0 ? `<span class="capo">Capo ${escapeHtml(String(capo))}</span>` : ''}
          <span class="key">${escapeHtml(displayKey || '')}</span>
        </div>
        ${song.tempo ? `<span class="tempo">${escapeHtml(String(song.tempo))} BPM</span>` : ''}
      </div>
    </div>`;
}

function renderMiniCard(setlist, items, songs) {
  const titleSafe = escapeHtml(setlist.name || 'Untitled Setlist');
  const dateSafe = escapeHtml(formatDate(setlist.date, setlist.time) || '');

  let songIndex = 0;
  const rows = items.map(item => {
    if (item.type === 'break') {
      const label = (item.label || 'Break').trim() || 'Break';
      return `<div class="mini-break">${escapeHtml(label)}</div>`;
    }
    songIndex += 1;
    const raw = songs.find(s => s.id === item.songId);
    const song = raw ? resolveSongView(raw, item.arrangementId) : null;
    if (!song) return '';
    
    const num = String(songIndex).padStart(2, '0');
    const transpose = item.transpose || 0;
    const displayKey = transposeKey(song.key, transpose);
    const tempo = song.tempo ? `${escapeHtml(String(song.tempo))}` : '';

    return `
      <div class="mini-row">
        <span class="mini-num">${num}</span>
        <span class="mini-song-title">${escapeHtml(song.title || 'Untitled')}</span>
        <span class="mini-key">${escapeHtml(displayKey || '')}</span>
        ${tempo ? `<span class="mini-tempo">${tempo}</span>` : ''}
      </div>`;
  });

  return `
    <div class="mini-card">
      <h3 class="mini-card-title">${titleSafe}</h3>
      ${dateSafe ? `<div class="mini-card-date">${dateSafe}</div>` : ''}
      <div class="mini-card-rows">${rows.join('')}</div>
    </div>`;
}

function buildSetlistDocument(setlist, songs, mode, initialPrefs = {}) {
  const items = setlist.items || [];

  // Songs get a running counter (01, 02, 03…); breaks render as banners and
  // don't consume a number so the song numbering stays clean across breaks.
  const setOrderHtml = (() => {
    let songIndex = 0;
    const rows = items.map(item => {
      if (item.type === 'break') return renderBreakBanner(item);
      songIndex += 1;
      return renderSongRow(item, songs, songIndex);
    });
    return `<div class="set-order">${rows.join('')}</div>`;
  })();

  const cardsGridHtml = (() => {
    const cardHtml = renderMiniCard(setlist, items, songs);
    const copies = Array(9).fill(cardHtml).join('');
    return `<div class="cards-grid">${copies}</div>`;
  })();

  // For 'full' mode, render every song as its own article (each starts on
  // a new page), using per-item transpose and per-item note.
  let songsHtml = '';
  if (mode === 'full') {
    songsHtml = items
      .filter(it => it.type !== 'break')
      .map(item => {
        const raw = songs.find(s => s.id === item.songId);
        const song = raw ? resolveSongView(raw, item.arrangementId) : null;
        if (!song) return '';
        const transpose = item.transpose || 0;
        const noteOverride = item.note ? item.note : null;
        const { coverHtml, sectionsHtml } = buildSongBody(song, transpose, {
          noteOverride,
          hideArtist: true,
        });
        return `
          <article class="song">
            ${coverHtml}
            <main>${sectionsHtml}</main>
          </article>`;
      }).join('');
  }

  const titleSafe = escapeHtml(setlist.name || 'Setlist');
  const coverHtml = renderSetlistCover(setlist, items);

  // Overview mode has no chord charts to apply Cols / Size / Font / Chords /
  // Colors to, so the chart-only controls are hidden — keep the toolbar
  // focused on Print + Close.
  const showChartControls = mode === 'full';
  const chartControlsHtml = showChartControls ? `
        <div class="control-group">
          <span class="group-label">Cols</span>
          <div class="seg" role="group" aria-label="Columns">
            <button type="button" data-control="cols" data-value="1">1</button>
            <button type="button" data-control="cols" data-value="2">2</button>
          </div>
        </div>
        <div class="control-group">
          <span class="group-label">Size</span>
          <div class="seg" role="group" aria-label="Font size">
            <button type="button" data-control="size" data-value="S">S</button>
            <button type="button" data-control="size" data-value="M">M</button>
            <button type="button" data-control="size" data-value="L">L</button>
            <button type="button" data-control="size" data-value="XL">XL</button>
          </div>
        </div>
        <div class="control-group">
          <span class="group-label">Font</span>
          <div class="seg" role="group" aria-label="Font family">
            <button type="button" data-control="font" data-value="sans">Sans</button>
            <button type="button" data-control="font" data-value="serif">Serif</button>
            <button type="button" data-control="font" data-value="mono">Mono</button>
          </div>
        </div>
        <button type="button" class="toggle" data-control="chords">
          <span class="check"></span>Chords
        </button>
        <button type="button" class="toggle" data-control="colors">
          <span class="check"></span>Colors
        </button>
        <button type="button" class="toggle" data-control="repeats">
          <span class="check"></span>Repeats
        </button>` : '';

  // Overview mode gets a Layout toggle instead of chart controls.
  const overviewControlsHtml = !showChartControls ? `
        <div class="control-group">
          <span class="group-label">Layout</span>
          <div class="seg" role="group" aria-label="Layout">
            <button type="button" data-control="layout" data-value="list">List</button>
            <button type="button" data-control="layout" data-value="cards">Cards</button>
          </div>
        </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${titleSafe} — Setlist</title>
<style>${PDF_STYLES}</style>
</head>
<body>
  <div class="page">
    <div class="toolbar" data-toolbar>
      <div class="toolbar-row tip-row">
        <div class="tip">
          <strong>Tip:</strong> in the print dialog, open <em>More settings</em> and uncheck
          <em>Headers and footers</em> for a clean output (no URL or date at the top).
        </div>
      </div>
      <div class="toolbar-row controls">
        ${chartControlsHtml}
        ${overviewControlsHtml}
        <div class="action-group">
          <button class="action primary" type="button" data-action="print">Print / Save as PDF</button>
          <button class="action" type="button" data-action="close">Close</button>
        </div>
      </div>
    </div>

    <footer class="brand-footer" aria-hidden="true">
      <span class="brand-name">setlists</span><span class="brand-md">.md</span>
    </footer>

    ${coverHtml}

    <main>
      ${setOrderHtml}
      ${cardsGridHtml}
    </main>

    ${songsHtml}
  </div>

  <script>
    (function () {
      var STORAGE_KEY = 'setlists-md:pdf-prefs';
      var DEFAULTS = { cols: 1, size: 'M', font: 'sans', chords: true, colors: true, repeats: true, layout: 'list' };
      var SIZE = { S: '10pt', M: '11pt', L: '12.5pt', XL: '14pt' };
      var FONT = {
        sans:  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        serif: '"Iowan Old Style", Georgia, "Times New Roman", serif',
        mono:  '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace'
      };

      var initial = ${JSON.stringify(initialPrefs).replace(/</g, '\\u003c')};
      var prefs = Object.assign({}, DEFAULTS, initial);

      function readStored() {
        try {
          if (window.opener && window.opener.localStorage) {
            var raw = window.opener.localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
          }
        } catch (e) {}
        try {
          var raw2 = localStorage.getItem(STORAGE_KEY);
          if (raw2) return JSON.parse(raw2);
        } catch (e) {}
        return null;
      }

      function writeStored(p) {
        var s = JSON.stringify(p);
        try { if (window.opener && window.opener.localStorage) window.opener.localStorage.setItem(STORAGE_KEY, s); } catch (e) {}
        try { localStorage.setItem(STORAGE_KEY, s); } catch (e) {}
      }

      var stored = readStored();
      if (stored) prefs = Object.assign(prefs, stored);

      var root = document.documentElement;
      var body = document.body;

      function apply() {
        root.style.setProperty('--col-count', String(prefs.cols));
        root.style.setProperty('--body-size', SIZE[prefs.size] || SIZE.M);
        root.style.setProperty('--lyric-font', FONT[prefs.font] || FONT.sans);
        body.classList.toggle('no-chords', !prefs.chords);
        body.classList.toggle('bw', !prefs.colors);
        body.classList.toggle('collapse-repeats', !prefs.repeats);
        body.classList.toggle('cards-layout', prefs.layout === 'cards');
        var nodes = document.querySelectorAll('[data-control]');
        for (var i = 0; i < nodes.length; i++) {
          var el = nodes[i];
          var k = el.getAttribute('data-control');
          var v = el.getAttribute('data-value');
          var active = false;
          if      (k === 'cols')    active = String(prefs.cols) === v;
          else if (k === 'size')    active = prefs.size === v;
          else if (k === 'font')    active = prefs.font === v;
          else if (k === 'chords')  active = !!prefs.chords;
          else if (k === 'colors')  active = !!prefs.colors;
          else if (k === 'repeats') active = !!prefs.repeats;
          else if (k === 'layout')  active = prefs.layout === v;
          el.classList.toggle('active', active);
        }
        writeStored(prefs);
      }

      document.addEventListener('click', function (e) {
        var ctrl = e.target.closest('[data-control]');
        if (ctrl) {
          var k = ctrl.getAttribute('data-control');
          var v = ctrl.getAttribute('data-value');
          if      (k === 'cols')   prefs.cols   = parseInt(v, 10) || 1;
          else if (k === 'size')   prefs.size   = v;
          else if (k === 'font')   prefs.font   = v;
          else if (k === 'chords') prefs.chords = !prefs.chords;
          else if (k === 'colors') prefs.colors = !prefs.colors;
          else if (k === 'repeats') prefs.repeats = !prefs.repeats;
          else if (k === 'layout')  prefs.layout  = v;
          apply();
          return;
        }
        var act = e.target.closest('[data-action]');
        if (!act) return;
        if (act.dataset.action === 'print') window.print();
        if (act.dataset.action === 'close') window.close();
      });

      apply();
    })();
  </script>
</body>
</html>`;
}

/**
 * Open a print-friendly view for a setlist.
 *
 * @param {object} setlist - The setlist (name, date, time, location, tags, items).
 * @param {Array}  songs   - All songs (used to look up each item.songId).
 * @param {object} opts    - { mode: 'overview' | 'full' }.
 */
export function exportSetlistPdf(setlist, songs, opts = {}) {
  if (!setlist) return;
  const mode = opts.mode === 'full' ? 'full' : 'overview';
  const html = buildSetlistDocument(setlist, songs || [], mode, readInitialPrefs());
  openPrintWindow(html);
}
