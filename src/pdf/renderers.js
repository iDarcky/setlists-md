// Pure HTML-string renderers shared by exportSongPdf + exportSetlistPdf.
//
// These helpers don't touch the DOM. They take parsed song / section / line
// data and return a string of HTML that the document shell (pdfDocument.js)
// stitches into a full printable page.

import { transposeChord, transposeKey, normalizeSectionName } from '../music';
import { parseLine, serializeTabBlock } from '../parser';

// Print-friendly section accent colors (CMYK-safe approximations of the Geist
// palette used in-app — we can't rely on CSS vars in the popup window).
export const SECTION_ACCENTS = {
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

function renderTab(tab) {
  let lines = tab.raw && tab.raw.length > 0
    ? tab.raw
    : serializeTabBlock(tab).split('\n').slice(1, -1);
  lines = lines.filter(l => !/^\{\/?tab/.test(l.trim()));
  const time = tab.time ? `<span class="tab-time">${escapeHtml(tab.time)}</span>` : '';
  return `<pre class="tab-block">${time}${escapeHtml(lines.join('\n'))}</pre>`;
}

function renderModulate(mod) {
  const sign = mod.semitones > 0 ? '+' : '';
  return `
    <div class="modulate">
      <span class="modulate-rule"></span>
      <span class="modulate-pill">Key Change: ${sign}${mod.semitones}</span>
      <span class="modulate-rule"></span>
    </div>`;
}

function renderLyricLine(line, transpose) {
  const noteMatch = line.match(/\{!(.*?)\}/);
  const inlineNote = noteMatch ? noteMatch[1] : null;
  const cleanLine = line.replace(/\{!.*?\}/g, '');

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
    const text = p.text || (p.chord ? ' ' : '');
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

// Resolve playback order: if `song.structure` is set and section types are
// unique, use it (same logic as ChartView). Otherwise fall back to doc order.
export function resolveOrderedSections(song) {
  const sections = song.sections || [];
  if (!Array.isArray(song.structure) || song.structure.length === 0) return sections;
  const types = sections.map(s => normalizeSectionName(s.type));
  if (new Set(types).size !== types.length) return sections;
  const resolved = song.structure
    .map(name => sections.find(s => normalizeSectionName(s.type) === normalizeSectionName(name)))
    .filter(Boolean);
  return resolved.length === song.structure.length ? resolved : sections;
}

// Cumulative modulate offsets per section (same logic as ChartView).
export function computeModOffsets(sections) {
  const acc = { total: 0 };
  return (sections || []).map(section => {
    const offset = acc.total;
    (section.lines || []).forEach(line => {
      if (line && typeof line === 'object' && line.type === 'modulate') {
        acc.total += line.semitones;
      }
    });
    return offset;
  });
}

// Render the cover header for a single song (title, subtitle, structure
// ribbon, tags, ccli, notes). Returns the inner HTML to slot into <header>.
export function renderSongCover(song, transpose) {
  const displayKey = transposeKey(song.key, transpose);
  const transposeNote = transpose !== 0
    ? ` <span class="meta-shift">(orig. ${escapeHtml(song.key)})</span>`
    : '';

  const subtitleParts = [];
  if (song.artist) subtitleParts.push(`<span class="sub-artist">${escapeHtml(song.artist)}</span>`);
  subtitleParts.push(`<span class="sub-meta"><span class="sub-label">Key</span> <strong>${displayKey}</strong>${transposeNote}</span>`);
  if (song.tempo) subtitleParts.push(`<span class="sub-meta"><span class="sub-label">Tempo</span> <strong>${escapeHtml(String(song.tempo))}</strong> <span class="sub-unit">bpm</span></span>`);
  if (song.time)  subtitleParts.push(`<span class="sub-meta"><span class="sub-label">Time</span> <strong>${escapeHtml(song.time)}</strong></span>`);
  if (song.capo)  subtitleParts.push(`<span class="sub-meta"><span class="sub-label">Capo</span> <strong>${escapeHtml(String(song.capo))}</strong></span>`);
  const subtitleHtml = subtitleParts.join('<span class="sub-sep">·</span>');

  const tagsHtml = song.tags && song.tags.length
    ? `<div class="cover-tags">${song.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';
  const ccliHtml = song.ccli ? `<span class="cover-aux"><strong>CCLI</strong> ${escapeHtml(song.ccli)}</span>` : '';
  const notesHtml = song.notes
    ? `<div class="cover-notes"><strong>Notes</strong> ${escapeHtml(song.notes)}</div>`
    : '';

  return `
    <h1>${escapeHtml(song.title || 'Untitled')}</h1>
    <div class="subtitle">${subtitleHtml}</div>
    ${renderStructureRibbon(resolveOrderedSections(song).map(s => s.type))}
    ${tagsHtml}
    ${ccliHtml ? `<div>${ccliHtml}</div>` : ''}
    ${notesHtml}`;
}

// Render the body (<main> contents) for a single song: every section, with
// per-section transpose offsets accumulated through any {modulate} markers.
export function renderSongBody(song, transpose) {
  const ordered = resolveOrderedSections(song);
  const modOffsets = computeModOffsets(ordered);
  return ordered
    .map((s, i) => renderSection(s, transpose, modOffsets[i] || 0))
    .join('');
}
