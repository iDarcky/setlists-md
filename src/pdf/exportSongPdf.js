// Export a song to a print-friendly PDF via a popup window.
//
// Renders a self-contained HTML document with a beautiful header, structure
// ribbon, and chord-above-lyric body, then triggers the browser's native
// print dialog (which the user can use to "Save as PDF" or send to a printer).
//
// Why a new window? The previous implementation called window.print() on the
// current page, which printed whatever was visible (including the Library list
// in the desktop preview pane). A dedicated window guarantees the output is
// just the song, regardless of where it was triggered from.

import { transposeChord, transposeKey, sectionStyle, normalizeSectionName } from '../music';
import { parseLine, serializeTabBlock } from '../parser';
import { openPrintWindow, readInitialPrefs } from './pdfDocument';

// Print-friendly section accent colors (CMYK-safe approximations of the Geist
// palette used in-app — we can't rely on CSS vars in the popup window).
const SECTION_ACCENTS = {
  Intro:        '#1F5FB4',
  Refrain:      '#6F42C1',
  Verse:        '#1A7F37',
  'Pre Chorus': '#B8801B',
  Chorus:       '#C2255C',
  Bridge:       '#1F7E8C',
  Instrumental: '#B8801B',
  Ending:       '#B1361E',
  Tag:          '#1F5FB4',
  Interlude:    '#6F42C1',
  Vamp:         '#B8801B',
  Outro:        '#B1361E',
};

export function accentForSection(type) {
  const base = (type || '').replace(/\s*\d+$/, '').replace(/:+$/, '');
  const key = Object.keys(SECTION_ACCENTS).find(
    k => base.toLowerCase().startsWith(k.toLowerCase())
  );
  // Fall back to the in-app sectionStyle just for parity (won't be used,
  // but keeps the import meaningful for future tweaks).
  void sectionStyle;
  return SECTION_ACCENTS[key] || '#555555';
}

export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderTab(tab) {
  // Prefer the raw ASCII for fidelity; fall back to serialized strings.
  let lines = tab.raw && tab.raw.length > 0
    ? tab.raw
    : serializeTabBlock(tab).split('\n').slice(1, -1);
  // Drop the {tab} / {/tab} delimiters if they slipped in.
  lines = lines.filter(l => !/^\{\/?tab/.test(l.trim()));
  const time = tab.time ? `<span class="tab-time">${escapeHtml(tab.time)}</span>` : '';
  return `<pre class="tab-block">${time}${escapeHtml(lines.join('\n'))}</pre>`;
}

export function renderModulate(mod) {
  const sign = mod.semitones > 0 ? '+' : '';
  return `
    <div class="modulate">
      <span class="modulate-rule"></span>
      <span class="modulate-pill">Key Change: ${sign}${mod.semitones}</span>
      <span class="modulate-rule"></span>
    </div>`;
}

export function renderLyricLine(line, transpose) {
  const noteMatch = line.match(/\{!(.*?)\}/);
  const inlineNote = noteMatch ? noteMatch[1] : null;
  const cleanLine = line.replace(/\{!.*?\}/g, '');

  // Plain text line (no chords)
  if (!cleanLine.includes('[')) {
    if (!cleanLine.trim() && !inlineNote) {
      return '<div class="empty-line">&nbsp;</div>';
    }
    return `<div class="plain-line">${escapeHtml(cleanLine)}${
      inlineNote ? `<span class="inline-note"> &mdash; ${escapeHtml(inlineNote)}</span>` : ''
    }</div>`;
  }

  const pairs = parseLine(cleanLine);
  const hasLyrics = pairs.some(p => p.text.trim());

  const pairHtml = pairs.map(p => {
    const chord = p.chord ? transposeChord(p.chord, transpose) : '';
    const text = p.text || (p.chord ? ' ' : '');
    return `<span class="cl-pair${hasLyrics ? '' : ' chord-only'}">${
      chord ? `<span class="chord">${escapeHtml(chord)}</span>` : ''
    }${
      hasLyrics ? `<span class="lyric">${escapeHtml(text)}</span>` : ''
    }</span>`;
  }).join('');

  const noteHtml = inlineNote
    ? `<span class="inline-note inline-note-cl"> &mdash; ${escapeHtml(inlineNote)}</span>`
    : '';

  return `<div class="cl-line${hasLyrics ? '' : ' chord-only-line'}">${pairHtml}${noteHtml}</div>`;
}

export function renderSection(section, transpose, modOffset) {
  let running = modOffset;
  const accent = accentForSection(section.type);
  const label = (section.type || '').replace(/:+$/, '');

  const inner = (section.lines || []).map(line => {
    if (typeof line === 'object' && line) {
      if (line.type === 'tab') return renderTab(line);
      if (line.type === 'tabref') return line.tab ? renderTab(line.tab) : '';
      if (line.type === 'modulate') {
        running += line.semitones;
        return renderModulate(line);
      }
      return '';
    }
    return renderLyricLine(line, transpose + running);
  }).join('');

  const noteHtml = section.note
    ? `<div class="section-note" style="border-color:${accent}">${escapeHtml(section.note)}</div>`
    : '';

  return `
    <section class="song-section" style="--accent:${accent}">
      <header class="section-header">
        <span class="section-label">${escapeHtml(label)}</span>
        <span class="section-rule"></span>
      </header>
      ${noteHtml}
      <div class="section-body">${inner}</div>
    </section>`;
}

export function renderStructureRibbon(structure) {
  if (!structure || structure.length === 0) return '';
  return `<div class="structure-ribbon">${
    structure.map(type => {
      const accent = accentForSection(type);
      const label = (type || '').replace(/:+$/, '');
      return `<span class="structure-pill" style="--accent:${accent}">${escapeHtml(label)}</span>`;
    }).join('')
  }</div>`;
}

// Returns { coverHtml, sectionsHtml, titleSafe, artistSafe } for one song.
// Reused by both single-song and setlist (full charts) PDF exports so the
// rendered output stays in sync.
export function buildSongBody(song, transpose, opts = {}) {
  const { extraSubtitle = '', noteOverride = null, hideArtist = false } = opts;
  const displayKey = transposeKey(song.key, transpose);
  const transposeNote = transpose !== 0
    ? ` <span class="meta-shift">(orig. ${escapeHtml(song.key)})</span>`
    : '';

  // Resolve playback order: if `song.structure` is set and section types are
  // unique, use it (same logic as ChartView). Otherwise fall back to doc order.
  const orderedSections = (() => {
    const sections = song.sections || [];
    if (!Array.isArray(song.structure) || song.structure.length === 0) return sections;
    const types = sections.map(s => normalizeSectionName(s.type));
    if (new Set(types).size !== types.length) return sections;
    const resolved = song.structure
      .map(name => sections.find(s => normalizeSectionName(s.type) === normalizeSectionName(name)))
      .filter(Boolean);
    return resolved.length === song.structure.length ? resolved : sections;
  })();

  // Cumulative modulate offsets per section (same logic as ChartView).
  const modOffsets = (() => {
    const acc = { total: 0 };
    return orderedSections.map(section => {
      const offset = acc.total;
      (section.lines || []).forEach(line => {
        if (line && typeof line === 'object' && line.type === 'modulate') {
          acc.total += line.semitones;
        }
      });
      return offset;
    });
  })();

  // Inline subtitle parts: Key · Tempo · Time · Capo (artist moves below structure)
  const subtitleParts = [];
  subtitleParts.push(`<span class="sub-meta"><span class="sub-label">Key</span> <strong>${displayKey}</strong>${transposeNote}</span>`);
  if (song.tempo) subtitleParts.push(`<span class="sub-meta"><span class="sub-label">Tempo</span> <strong>${escapeHtml(String(song.tempo))}</strong> <span class="sub-unit">bpm</span></span>`);
  if (song.time)  subtitleParts.push(`<span class="sub-meta"><span class="sub-label">Time</span> <strong>${escapeHtml(song.time)}</strong></span>`);
  if (song.capo)  subtitleParts.push(`<span class="sub-meta"><span class="sub-label">Capo</span> <strong>${escapeHtml(String(song.capo))}</strong></span>`);
  if (extraSubtitle) subtitleParts.push(`<span class="sub-meta">${extraSubtitle}</span>`);
  const subtitleHtml = subtitleParts.join('<span class="sub-sep">·</span>');

  // Track which section types we've already rendered so repeated ones can
  // be collapsed when the user toggles "Repeats" off. Each <section> gets
  // a data-section-type and optionally a `section-repeat` class.
  const seenTypes = new Set();
  const sectionsHtml = orderedSections
    .map((s, i) => {
      const normType = normalizeSectionName(s.type);
      const isRepeat = seenTypes.has(normType);
      seenTypes.add(normType);
      const repeatAttr = isRepeat ? ' data-repeat="true"' : '';
      const label = (s.type || '').replace(/:+$/, '');
      const accent = accentForSection(s.type);
      const sectionHtml = renderSection(s, transpose, modOffsets[i] || 0);
      // Wrap so we can hide the full body and show a reference pill instead.
      return `<div class="section-wrap"${repeatAttr} data-section-label="${escapeHtml(label)}" style="--accent:${accent}">
        ${sectionHtml}
        <div class="repeat-ref" aria-hidden="true">
          <span class="repeat-ref-pill" style="--accent:${accent}">↩ ${escapeHtml(label)}</span>
        </div>
      </div>`;
    })
    .join('');

  const tagsHtml = song.tags && song.tags.length
    ? `<div class="cover-tags">${song.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';

  const ccliHtml = song.ccli ? `<span class="cover-aux"><strong>CCLI</strong> ${escapeHtml(song.ccli)}</span>` : '';
  const notesText = noteOverride != null ? noteOverride : song.notes;
  const notesHtml = notesText
    ? `<div class="cover-notes"><strong>Notes</strong> ${escapeHtml(notesText)}</div>`
    : '';

  const titleSafe = escapeHtml(song.title || 'Untitled');
  const artistSafe = escapeHtml(song.artist || '');

  const coverHtml = `
    <header class="cover">
      <h1>${titleSafe}</h1>
      <div class="subtitle">${subtitleHtml}</div>
      ${renderStructureRibbon(orderedSections.map(s => s.type))}
      ${!hideArtist && artistSafe ? `<div class="cover-artist">${artistSafe}</div>` : ''}
      ${tagsHtml}
      ${ccliHtml ? `<div>${ccliHtml}</div>` : ''}
      ${notesHtml}
    </header>`;

  return { coverHtml, sectionsHtml, titleSafe, artistSafe };
}

function buildDocument(song, transpose, initialPrefs = {}) {
  const { coverHtml, sectionsHtml, titleSafe, artistSafe } = buildSongBody(song, transpose);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${titleSafe}${artistSafe ? ' — ' + artistSafe : ''}</title>
<style>
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

  /* Multi-column body layout (cover header stays full width). */
  main {
    column-count: var(--col-count);
    column-gap: var(--col-gap);
    column-fill: balance;
  }

  /* "no-chords" mode: hide the chord row entirely; lyrics flow as plain text. */
  body.no-chords .chord { display: none !important; }
  body.no-chords .cl-line { line-height: 1.4; }
  body.no-chords .cl-pair { margin-right: 0; }
  /* "no-tabs" mode: hide tab blocks entirely. */
  body.no-tabs .tab-block { display: none !important; }

  /* "bw" (no-color) mode: drop section / chord / structure colors for a
     monochrome print that's friendly to grayscale printers and reduces ink. */
  body.bw .section-label,
  body.bw .structure-pill { color: #222 !important; }
  body.bw .section-rule   { background: #ccc !important; }
  body.bw .structure-pill { border-color: #ccc !important; background: #f5f5f5 !important; }
  body.bw .cl-pair .chord { color: #222 !important; }
  body.bw .modulate-pill  { background: #444 !important; }

  /* On-screen wrapper so the page looks reasonable before printing. */
  .page {
    max-width: 7.5in;
    margin: 0 auto;
    padding: 24px;
  }
  @media print {
    .page { max-width: none; margin: 0; padding: 0; }
    .toolbar { display: none !important; }
  }

  /* Floating toolbar shown on screen only, before/after print. */
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
  /* Print/Close pair sits at the far right of the controls row. */
  .action-group {
    display: inline-flex;
    gap: 8px;
    margin-left: auto;
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

  /* ── Cover header ───────────────────────────────────────────────── */
  .cover {
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 14px;
    margin-bottom: 18px;
  }
  .cover h1 {
    font-family: "Iowan Old Style", Georgia, "Times New Roman", serif;
    font-size: 26pt;
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
  .cover-aux {
    margin-top: 10px;
    font-size: 9pt;
    color: #666;
  }
  .cover-aux strong { color: #444; margin-right: 4px; font-weight: 600; }
  .cover-notes {
    margin-top: 10px;
    font-size: 9.5pt;
    color: #444;
    font-style: italic;
  }
  .cover-notes strong { font-style: normal; color: #222; margin-right: 4px; }

  /* ── Sections ───────────────────────────────────────────────────── */
  .song-section {
    margin: 0 0 18px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }
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

  /* ── Lyric / chord lines ────────────────────────────────────────── */
  .plain-line {
    margin: 0 0 4px;
    white-space: pre-wrap;
  }
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
  .cl-pair .lyric {
    line-height: 1.25;
    white-space: pre-wrap;
  }
  .cl-pair.chord-only { margin-right: 0.5em; }
  .cl-pair.chord-only .chord { padding-bottom: 0; }

  .inline-note {
    color: #777;
    font-style: italic;
    font-size: 0.82em;
    margin-left: 0.5em;
  }
  .inline-note-cl { align-self: flex-end; }

  /* ── Tab blocks ─────────────────────────────────────────────────── */
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

  /* ── Brand footer (repeats on every printed page) ───────────────── */
  /* On screen we hide it; @media print uses position:fixed so the browser
     repeats the element as a footer on each page (Chrome/Safari/Firefox). */
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

  /* ── Modulate marker ────────────────────────────────────────────── */
  .modulate {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 10px 0;
  }
  .modulate-rule {
    flex: 1;
    height: 1px;
    background: #d0d0d0;
  }
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

  /* ── Collapse-repeats mode ─────────────────────────────────────── */
  /* By default repeat-ref pills are hidden and sections render fully. */
  .repeat-ref { display: none; }

  /* When body has .collapse-repeats, repeated sections hide their inner
     <section> and show a compact reference pill instead. */
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
</style>
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
        <button type="button" class="toggle" data-control="tabs">
          <span class="check"></span>Tabs
        </button>
        <button type="button" class="toggle" data-control="colors">
          <span class="check"></span>Colors
        </button>
        <button type="button" class="toggle" data-control="repeats">
          <span class="check"></span>Repeats
        </button>
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
      ${sectionsHtml}
    </main>
  </div>

  <script>
    (function () {
      var STORAGE_KEY = 'setlists-md:pdf-prefs';
      var DEFAULTS = { cols: 1, size: 'M', font: 'sans', chords: true, tabs: true, colors: true, repeats: true };
      var SIZE = { S: '10pt', M: '11pt', L: '12.5pt', XL: '14pt' };
      var FONT = {
        sans:  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        serif: '"Iowan Old Style", Georgia, "Times New Roman", serif',
        mono:  '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace'
      };

      // Initial prefs are injected by the parent app from its own localStorage
      // so the popup honours the user's last-used PDF settings even when the
      // popup's about:blank context can't read them itself.
      var initial = ${JSON.stringify(initialPrefs).replace(/</g, '\\u003c')};
      var prefs = Object.assign({}, DEFAULTS, initial);

      function readStored() {
        // Try opener's localStorage first (parent app's origin) so prefs
        // survive across exports. Fall back to our own (ephemeral on
        // about:blank in some browsers, but no-op there is fine).
        try {
          if (window.opener && window.opener.localStorage) {
            var raw = window.opener.localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
          }
        } catch (e) { /* cross-origin or closed opener */ }
        try {
          var raw2 = localStorage.getItem(STORAGE_KEY);
          if (raw2) return JSON.parse(raw2);
        } catch (e) { /* unavailable */ }
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
        body.classList.toggle('no-tabs', !prefs.tabs);
        body.classList.toggle('bw', !prefs.colors);
        body.classList.toggle('collapse-repeats', !prefs.repeats);
        // Reflect active state on the controls.
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
          else if (k === 'tabs')    active = !!prefs.tabs;
          else if (k === 'colors')  active = !!prefs.colors;
          else if (k === 'repeats') active = !!prefs.repeats;
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
          else if (k === 'tabs') prefs.tabs = !prefs.tabs;
          else if (k === 'colors') prefs.colors = !prefs.colors;
          else if (k === 'repeats') prefs.repeats = !prefs.repeats;
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

export function exportSongPdf(song, opts = {}) {
  if (!song) return;
  const transpose = Number.isFinite(opts.transpose) ? opts.transpose : 0;
  const html = buildDocument(song, transpose, readInitialPrefs());
  openPrintWindow(html);
}
