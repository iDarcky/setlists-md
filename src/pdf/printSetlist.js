// "Print for the band": the order sheet and the chart pages, on A4.
//
// Built to the "Share and print" canvas (PdfPages board): an order sheet the
// band can read off a music stand (number, key, title, who leads, start time,
// the band at the bottom), then — for Charts — one page per song with the key
// in the corner, the flow, the band's note and the chart in one or two
// columns. Light only: it's for paper. Every page ends with the church and a
// small setlists.md.
//
// The choices (Order sheet / Charts, notes, who leads, two columns) are made in
// the app's Print drawer, so the document carries no toolbar of its own.

import { transposeChord, transposeKey } from '@/music';
import { parseLine } from '@/parser';
import { buildOrder, totalLabel } from '@/lib/setlistView';
import { orderSections, sectionModPlan, repeatFirstIndex } from '@/lib/songFlow';
import { resolveSongView } from '@/arrangements';
import { escapeHtml as esc, renderTab } from './exportSongPdf';
import { openPrintWindow } from './pdfDocument';

const STYLES = `
  @page { size: A4; margin: 14mm 15mm 14mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: #E9E6E0; color: #1C1A17;
    font-family: Geist, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .sheet {
    width: 210mm; min-height: 297mm; margin: 16px auto; padding: 14mm 15mm;
    background: #fff; box-shadow: 0 6px 24px rgba(0,0,0,.14);
    display: flex; flex-direction: column; gap: 12px;
  }
  @media screen and (max-width: 820px) {
    .sheet { width: auto; min-height: 0; margin: 10px; padding: 22px 18px; }
  }
  @media print {
    body { background: #fff; }
    /* Fills the page so the footer sits at the bottom (A4 less the margins, less a hair). */
    .sheet { width: auto; min-height: 267mm; margin: 0; padding: 0; box-shadow: none; break-after: page; }
    .sheet:last-child { break-after: auto; }
  }
  .eyebrow { font-size: 9.5pt; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #6B655C; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px;
          border-bottom: 2px solid #1C1A17; padding-bottom: 9px; }
  .head h1 { margin: 2px 0 0; font-size: 21pt; line-height: 1.15; font-weight: 700; letter-spacing: -.02em; }
  .head .sub { margin-top: 3px; font-size: 10pt; color: #6B655C; }
  .head .when { display: flex; flex-direction: column; gap: 2px; text-align: right; font-size: 10pt; color: #6B655C; white-space: nowrap; }
  .head .kk { font: 700 19pt ui-monospace, "SF Mono", Menlo, monospace; color: #9A6412; text-align: right; line-height: 1; }
  .head .kk small { display: block; margin-top: 4px; font: 500 9pt Geist, ui-sans-serif, system-ui, sans-serif; color: #6B655C; }

  table.order { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
  table.order td { padding: 7px 5px; border-top: 1px solid #E2DDD3; vertical-align: top; }
  table.order tr:first-child td { border-top: 0; }
  table.order tr { break-inside: avoid; }
  td.n { width: 22px; color: #8F887D; font-variant-numeric: tabular-nums; }
  td.k { width: 40px; font: 700 10.5pt ui-monospace, "SF Mono", Menlo, monospace; color: #9A6412; }
  td.t b { display: block; font-size: 11.5pt; font-weight: 600; }
  td.t span { display: block; margin-top: 1px; font-size: 9.5pt; color: #6B655C; }
  td.m { width: 52px; text-align: right; color: #6B655C; font-variant-numeric: tabular-nums; }
  tr.brk td.t b { font-weight: 500; font-style: italic; color: #6B655C; }

  .note { font-size: 10pt; line-height: 1.45; background: #F6F4EF; border-radius: 6px; padding: 7px 10px; white-space: pre-line; break-inside: avoid; }
  .note b { font-weight: 600; }
  .flow { font-size: 9.5pt; color: #6B655C; }

  .chart { columns: var(--cols, 1); column-gap: 26px; }
  .sct { break-inside: avoid; margin-bottom: 12px; }
  .sct h4 { margin: 0 0 4px; font-size: 8.5pt; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; color: #3B5A52; }
  .sct .cue { font-size: 9pt; font-style: italic; color: #6B655C; margin-bottom: 3px; }
  .ln { display: flex; flex-wrap: wrap; align-items: flex-end; min-height: 1.2em; }
  .pr { display: inline-flex; flex-direction: column; white-space: pre; }
  .pr .c { font: 600 9pt ui-monospace, "SF Mono", Menlo, monospace; color: #9A6412; height: 12pt; padding-right: 5px; }
  .pr .w { font-size: 10.5pt; line-height: 1.3; }
  .chords-only .pr .w { display: none; }
  .ln.plain { font-size: 10.5pt; line-height: 1.3; white-space: pre-wrap; }
  .ln .inline { font-size: 9pt; font-style: italic; color: #6B655C; padding-left: 6px; }
  .mod { font-size: 8.5pt; font-weight: 600; color: #9A6412; margin: 3px 0; }
  .tab-block { font: 9pt/1.25 ui-monospace, "SF Mono", Menlo, monospace; margin: 4px 0; white-space: pre; }
  .tab-time { display: block; font-size: 8pt; color: #6B655C; }

  .foot { margin-top: auto; padding-top: 8px; border-top: 1px solid #E2DDD3; display: flex; justify-content: space-between; gap: 12px;
          font-size: 8.5pt; color: #8F887D; }
  .foot .brand { display: inline-flex; align-items: center; gap: 5px; }
  .foot img { width: 11px; height: 11px; border-radius: 3px; object-fit: cover; }
  .foot .md { color: #3B5A52; font-weight: 700; }
`;

const longDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

function brand(church, printedOn) {
  const logo = church?.logo ? `<img src="${esc(church.logo)}" alt="" />` : '';
  const name = church?.name ? `${esc(church.name)} · ` : '';
  return `<span class="brand">${printedOn ? `Printed ${esc(printedOn)} · ` : ''}${logo}${name}setlists<span class="md">.md</span></span>`;
}

function chordLine(line, shift) {
  if (typeof line !== 'string') return '';
  const inline = (line.match(/\{!(.*?)\}/) || [])[1];
  const clean = line.replace(/\{!.*?\}/g, '');
  const tail = inline ? `<span class="inline">${esc(inline)}</span>` : '';
  if (!clean.includes('[')) {
    return clean.trim() || inline ? `<div class="ln plain">${esc(clean)}${tail}</div>` : '<div class="ln">&nbsp;</div>';
  }
  const pairs = parseLine(clean);
  const words = pairs.some(p => p.text.trim());
  return `<div class="ln${words ? '' : ' chords-only'}">${pairs.map(p => (
    `<span class="pr"><span class="c">${p.chord ? esc(transposeChord(p.chord, shift)) : ''}</span><span class="w">${esc(p.text || ' ')}</span></span>`
  )).join('')}${tail}</div>`;
}

function sectionHtml(section, shift, fires) {
  let running = shift;
  const body = (section.lines || []).map(line => {
    if (line && typeof line === 'object') {
      if (line.type === 'tab') return renderTab(line);
      if (line.type === 'tabref') return line.tab ? renderTab(line.tab) : '';
      if (line.type === 'modulate') {
        if (!fires) return '';
        running += line.semitones;
        return `<div class="mod">Key change ${line.semitones > 0 ? '+' : ''}${line.semitones}</div>`;
      }
      return '';
    }
    return chordLine(line, running);
  }).join('');
  const label = (section.type || '').replace(/:+$/, '');
  return `<div class="sct"><h4>${esc(label)}</h4>${section.note ? `<div class="cue">${esc(section.note)}</div>` : ''}${body}</div>`;
}

function chartPage({ song, item, n, count, setlist, show }) {
  const shift = item.transpose || 0;
  const ordered = orderSections(song);
  const { offsets, fires } = sectionModPlan(ordered);
  const firsts = repeatFirstIndex(ordered, offsets);
  const lead = show.leads !== false && item.leadBy && show.nameOf ? show.nameOf(item.leadBy) : '';
  const tempo = item.tempo ?? song.tempo;
  const sub = [song.artist && song.artist !== 'Unknown' && song.artist, lead && `${lead} leads`, song.time, tempo && `${tempo} bpm`].filter(Boolean).join(' · ');
  const capo = item.capo || 0;
  const notes = show.notes === false ? [] : [item.note, song.notes].filter(Boolean);
  const flow = ordered.length > 1 ? `<div class="flow">${ordered.map(s => esc((s.type || '').replace(/:+$/, ''))).join(' → ')}</div>` : '';
  const sections = ordered.map((s, i) => (firsts[i] === -1 ? sectionHtml(s, shift + offsets[i], fires[i]) : '')).join('');
  return `<section class="sheet">
    <div class="head">
      <div>
        <div class="eyebrow" style="text-transform:none;letter-spacing:0;font-weight:500">${n} of ${count} · ${esc(setlist.name || 'Setlist')}</div>
        <h1>${esc(song.title || 'Untitled')}</h1>
        ${sub ? `<div class="sub">${esc(sub)}</div>` : ''}
      </div>
      <div class="kk">${esc(transposeKey(song.key, shift) || '')}${capo ? `<small>Capo ${esc(String(capo))}</small>` : ''}</div>
    </div>
    ${flow}
    ${notes.map(t => `<div class="note">${esc(t)}</div>`).join('')}
    <div class="chart">${sections}</div>
    <div class="foot"><span>${song.ccli ? `CCLI ${esc(song.ccli)}` : ''}</span>${brand(show.church)}</div>
  </section>`;
}

/**
 * The print document. `show`: { mode: 'overview' | 'full', notes, leads,
 * twoColumns, band: ['Joe (Vocals)'], church: { name, logo }, nameOf(uid),
 * clock(hhmm) → label, now }.
 */
export function buildPrintDocument(setlist, songs = [], show = {}) {
  const leads = show.leads !== false && show.nameOf ? show.nameOf : () => '';
  const order = buildOrder(setlist, songs, leads);
  const clock = show.clock || (t => t);
  const notesOn = show.notes !== false;

  const rows = order.rows.map(r => {
    const time = r.startsAt ? esc(clock(r.startsAt)) : '';
    if (r.kind === 'moment') {
      const sub = [r.minutes && `${r.minutes} min`, notesOn && r.note].filter(Boolean).join(' · ');
      return `<tr class="brk"><td class="n"></td><td class="k"></td><td class="t"><b>${esc(r.title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</td><td class="m">${time}</td></tr>`;
    }
    const sub = [r.leads && `${r.leads} leads`, r.time, r.tempo && `${r.tempo} bpm`, r.capo && `capo ${r.capo}`, notesOn && r.note].filter(Boolean).join(' · ');
    return `<tr><td class="n">${r.n}</td><td class="k">${esc(r.key || '')}</td><td class="t"><b>${esc(r.title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</td><td class="m">${time}</td></tr>`;
  }).join('');

  const when = [
    setlist.date && longDate(setlist.date),
    [setlist.time && clock(setlist.time), setlist.endTime && clock(setlist.endTime)].filter(Boolean).join(' – ') + (setlist.location ? ` · ${setlist.location}` : ''),
  ].filter(Boolean);
  const printedOn = new Date(show.now || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const band = show.band?.length ? `<div class="note"><b>Band:</b> ${show.band.map(esc).join(' · ')}</div>` : '';

  const orderSheet = `<section class="sheet">
    <div class="head">
      <div>
        ${show.church?.name ? `<div class="eyebrow">${esc(show.church.name)}</div>` : ''}
        <h1>${esc(setlist.name || 'Setlist')}</h1>
      </div>
      <div class="when">${when.map(w => `<span>${esc(w)}</span>`).join('')}</div>
    </div>
    <table class="order">${rows}</table>
    ${band}
    <div class="foot"><span>${order.songCount} ${order.songCount === 1 ? 'song' : 'songs'} · ${esc(totalLabel(order.totalSeconds, order.estimated))}</span>${brand(show.church, printedOn)}</div>
  </section>`;

  let charts = '';
  if (show.mode === 'full') {
    const items = (setlist.items || []).filter(it => it && it.type !== 'break');
    charts = items.map((item, i) => {
      const raw = songs.find(s => s.id === item.songId);
      const song = raw ? resolveSongView(raw, item.arrangementId) : null;
      return song ? chartPage({ song, item, n: i + 1, count: items.length, setlist, show }) : '';
    }).join('');
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(setlist.name || 'Setlist')}</title>
<style>${STYLES}</style>
</head>
<body style="--cols:${show.twoColumns === false ? 1 : 2}">
${orderSheet}
${charts}
</body>
</html>`;
}

/** Open the print preview for the band's printout. */
export function printSetlist(setlist, songs, show = {}) {
  if (!setlist) return;
  openPrintWindow(buildPrintDocument(setlist, songs || [], show));
}
