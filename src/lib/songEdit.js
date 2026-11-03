// The new song editor's model, as pure functions over one arrangement.
// SongEdit.jsx holds the state; the tests feed fixtures.

import { parseSectionLines, serializeTabBlock, serializeModulate, parseSongMd, songToMd, extractInlineNotes, lineToPlacement, placementToLine, EXTRA_META_KEYS } from '@/parser';
import { withArrangement, getArrangement } from '@/arrangements';
import { importChartText } from '@/lib/importChords';
import { getDiatonicChords } from '@/music';

/** One line of a section as the writer types it. */
export function lineToText(l) {
  if (typeof l === 'string') return l;
  if (l?.type === 'tab') return serializeTabBlock(l);
  if (l?.type === 'tabref') return `{tabref: ${l.name}}`;
  if (l?.type === 'modulate') return serializeModulate(l);
  return '';
}

export const sectionToText = (sec) => (sec?.lines || []).map(lineToText).join('\n');
export const textToLines = (text) => parseSectionLines(text);

/** The play order: the stored one, or the sections as written. */
export function playOrder(arr) {
  const s = arr?.structure;
  if (Array.isArray(s) && s.length && arr.structureMode === 'custom') return s;
  if (Array.isArray(s) && s.length && arr.structureMode !== 'auto') return s;
  return (arr?.sections || []).map(x => x.type);
}

/** A new order is always "custom": it says exactly what is played. */
export const withOrder = (arr, order) => ({ ...arr, structure: order, structureMode: 'custom' });

export function move(list, i, d) {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** "Verse" → "Verse 4" when Verse 1–3 exist; "Bridge" stays "Bridge" the first time. */
export function newSectionName(sections, base) {
  const names = new Set((sections || []).map(s => s.type));
  if (!names.has(base) && ![...names].some(n => n.startsWith(`${base} `))) return base;
  let n = 1;
  while (names.has(`${base} ${n}`)) n++;
  if (n === 1 && names.has(base)) n = 2;
  return `${base} ${n}`;
}

/**
 * Rename a section and every place the order names it. A sections-follow-order
 * song (no custom order) has nothing else to fix.
 */
export function renameSection(arr, i, name) {
  const old = arr.sections[i]?.type;
  if (!old || !name || old === name) return arr;
  return {
    ...arr,
    sections: arr.sections.map((s, n) => (n === i ? { ...s, type: name } : s)),
    structure: (arr.structure || []).map(x => (x === old ? name : x)),
  };
}

/** Delete a section and its places in the order. */
export function deleteSection(arr, i) {
  const old = arr.sections[i]?.type;
  return {
    ...arr,
    sections: arr.sections.filter((_, n) => n !== i),
    structure: (arr.structure || []).filter(x => x !== old),
  };
}

/** Insert a new section after index `at` (−1 = at the top), and add it to a custom order. */
export function addSection(arr, at, base = 'Verse') {
  const type = newSectionName(arr.sections, base);
  const sections = [...(arr.sections || [])];
  sections.splice(at + 1, 0, { type, lines: [''] });
  const custom = arr.structureMode === 'custom' && arr.structure?.length;
  return { arr: { ...arr, sections, structure: custom ? [...arr.structure, type] : arr.structure }, index: at + 1 };
}

export const setLines = (arr, i, lines) => ({ ...arr, sections: arr.sections.map((s, n) => (n === i ? { ...s, lines } : s)) });
export const setSection = (arr, i, patch) => ({ ...arr, sections: arr.sections.map((s, n) => (n === i ? { ...s, ...patch } : s)) });

/**
 * The chords to offer while editing, in an order that never moves under your
 * finger: the key's own six (G Am Bm C D Em for G), then the song's other
 * chords in the order they first appear. Pass the row you are showing as
 * `prev` and it is kept as it is, with chords new to the song added at the end.
 */
export function chordPalette(arr, prev = []) {
  const used = [];
  for (const s of arr?.sections || []) {
    for (const l of s.lines || []) {
      if (typeof l !== 'string') continue;
      for (const m of l.matchAll(/\[([A-G][^\]\s]*)\]/g)) used.push(m[1]);
    }
  }
  const base = prev.length ? prev : getDiatonicChords(arr?.key || 'C').slice(0, 6);
  return [...new Set([...base, ...used])];
}

export const SECTION_TYPES = ['Intro', 'Verse', 'Pre Chorus', 'Chorus', 'Bridge', 'Instrumental', 'Interlude', 'Tag', 'Outro'];

/** The whole arrangement as one text: `## Name`, `> cue`, then the lines. */
export const arrangementToText = (arr) => (arr?.sections || [])
  .map(s => [`## ${s.type}`, ...(s.note ? [`> ${s.note}`] : []), sectionToText(s)].join('\n'))
  .join('\n\n');

/** The reverse: text with `## Name` headers back into sections. */
export function textToSections(text) {
  const parsed = parseSongMd(`---\ntitle: x\n---\n${text || ''}\n`).sections || [];
  return parsed.map(s => ({ ...s, note: s.note || undefined }));
}

/**
 * Reviewed paste blocks ({ type, lines, repeat }) into sections + a play order.
 * A block whose name and words come back is one section played twice, so it
 * lands in the order, not twice in the chart. Chords written over the words are
 * moved inline on the way (importChartText). Returns { sections, structure, meta }.
 */
export function blocksToSections(blocks) {
  const totals = {};
  for (const b of blocks) totals[b.type] = (totals[b.type] || 0) + 1;
  const seen = {};
  const sections = [];
  const order = [];
  const byName = new Map();
  let meta = {};
  for (const b of blocks) {
    const key = b.lines.join('\n').trim();
    const repeatName = [...byName.entries()].find(([n, k]) => n.replace(/\s*\d+$/, '') === b.type && k === key)?.[0];
    if (repeatName) { order.push(...Array(b.repeat || 1).fill(repeatName)); continue; }
    seen[b.type] = (seen[b.type] || 0) + 1;
    const numbered = totals[b.type] > 1 && b.type !== 'Chorus' && b.type !== 'Refrain';
    let name = numbered ? `${b.type} ${seen[b.type]}` : b.type;
    while (byName.has(name)) name = `${b.type} ${++seen[b.type]}`;
    const { body, meta: m } = importChartText(b.lines.join('\n'));
    meta = { ...m, ...meta };
    // A "[Verse 1]" or "Chorus:" first line is the label the block was named
    // from; any later "## …" is a lyric the importer mistook for one.
    const rows = body.trim().split('\n');
    if (/^##\s/.test(rows[0] || '')) rows.shift();
    const words = rows.join('\n').replace(/^##\s+/gm, '').trim();
    const parsed = textToSections(`## ${name}\n${words}`)[0] || { type: name, lines: [] };
    sections.push({ ...parsed, type: name });
    byName.set(name, key);
    order.push(...Array(b.repeat || 1).fill(name));
  }
  const plain = order.length === sections.length && order.every((n, i) => n === sections[i].type);
  return { sections, structure: plain ? null : order, meta };
}

/** Put `chord` at letter `pos` of a line, replacing one already there; null removes it. */
export function setChordAt(value, pos, chord) {
  const { clean, notes } = extractInlineNotes(value);
  const { plainText, chords } = lineToPlacement(clean);
  const rest = chords.filter(c => c.pos !== pos);
  const next = placementToLine({ plainText, chords: chord ? [...rest, { chord, pos }] : rest });
  return notes.length ? `${next} ${notes.map(n => `{!${n}}`).join(' ')}` : next;
}

/** The song as its .md file, one arrangement: what the Markdown editor shows. */
// Lines of the .md that belong to the app, not to the writer: identity the
// sync engine relies on. Never shown, and never taken back from the text.
const HIDDEN_FRONT = /^(id|songid|arrangementid|arrangementname)\s*:/i;
const frontLines = (md) => {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md || '');
  return m ? m[1].split(/\r?\n/) : [];
};

/** The song as its .md file, one arrangement: what the Markdown editor shows (no ids). */
export function songMarkdown(song, arrId) {
  const md = songToMd(song, getArrangement(song, arrId));
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md);
  if (!m) return md;
  const kept = m[1].split(/\r?\n/).filter(l => !HIDDEN_FRONT.test(l)).join('\n');
  return `---\n${kept}\n---${md.slice(m[0].length)}`;
}

export const MARKDOWN_MAX = 100000;
const FIELD_MAX = { title: 120, artist: 120, ccli: 20, spotify: 300, youtube: 300, story: 1000 };
// Control characters (not tab or newline) never belong in a song.
// eslint-disable-next-line no-control-regex
const clean = (v, max = 300) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max) : v);
const safeLink = (v) => {
  const t = clean(v || '', 300).trim();
  return !t || /^https?:\/\/[^\s<>"']+$/i.test(t) ? t : '';
};

/**
 * The Markdown editor's text back onto the song: that arrangement's content
 * and the song-level fields its frontmatter carries. Only the fields that are
 * written in the text change: a line taken out keeps the song's value (the
 * parser's defaults, "Unknown" artist and key C, must never land on a song).
 * Ids in the text are ignored; links must be http(s); lengths are capped.
 */
export function applyMarkdown(song, arrId, md) {
  const text = clean(String(md || ''), MARKDOWN_MAX);
  const has = new Set(frontLines(text).map(l => (/^([A-Za-z][\w-]*)\s*:/.exec(l) || [])[1]?.toLowerCase()).filter(Boolean));
  const p = parseSongMd(text);
  const pick = (k, cur) => (has.has(k) ? p[k] : cur);
  const next = withArrangement(song, arrId, (a) => ({
    ...a,
    key: has.has('key') ? (clean(p.key, 8) || a.key) : a.key,
    tempo: pick('tempo', a.tempo), time: has.has('time') ? clean(p.time, 8) : a.time,
    capo: pick('capo', a.capo), notes: has.has('notes') ? clean(p.notes, 1000) : a.notes,
    structure: has.has('structure') && Array.isArray(p.structure) ? p.structure : a.structure,
    structureMode: has.has('structure') ? (p.structureMode || 'auto') : a.structureMode,
    sections: Array.isArray(p.sections) ? p.sections.map(sc => ({ ...sc, type: clean(sc.type, 60), lines: (sc.lines || []).map(l => (typeof l === 'string' ? clean(l, 1000) : l)) })) : a.sections,
    tabLibrary: Array.isArray(p.tabLibrary) ? p.tabLibrary : a.tabLibrary,
  }));
  if (has.has('title') && clean(p.title, FIELD_MAX.title).trim()) next.title = clean(p.title, FIELD_MAX.title);
  if (has.has('artist')) next.artist = clean(p.artist, FIELD_MAX.artist);
  for (const k of ['ccli', 'tags', 'spotify', 'youtube', ...EXTRA_META_KEYS]) {
    if (!has.has(k) || p[k] === undefined) continue;
    if (k === 'spotify' || k === 'youtube') next[k] = safeLink(p[k]);
    else if (Array.isArray(p[k])) next[k] = p[k].slice(0, 30).map(v => clean(String(v), 60));
    else next[k] = clean(p[k], FIELD_MAX[k] || 300);
  }
  return next;
}

// ── Words: a run of lines typed as one text, chords riding on their letters ──
//
// A run is the section's string lines between key changes and tabs. Its text
// is the lines' words joined by "\n"; every chord is a mark at an offset into
// that text, and each line's inline notes ride at the end of their line. An
// edit to the text moves the marks the way the letters moved, so a chord stays
// on its letter while the words around it change.

/** String lines → { text, marks: [{ at, chord } | { at, notes }] }. */
export function linesToWords(lines) {
  const marks = [];
  const rows = [];
  let at = 0;
  for (const l of lines) {
    const { clean, notes } = extractInlineNotes(typeof l === 'string' ? l : '');
    const { plainText, chords } = lineToPlacement(clean);
    for (const c of chords) marks.push({ at: at + c.pos, chord: c.chord });
    if (notes.length) marks.push({ at: at + plainText.length, notes });
    rows.push(plainText);
    at += plainText.length + 1;
  }
  return { text: rows.join('\n'), marks };
}

/**
 * The marks after `prev` became `next` (one contiguous edit, as a text box
 * reports it). Typing right before a chord's letter pushes the chord along
 * with the letter; a note stays at the end of the line it was on.
 */
export function remapWords(prev, next, marks) {
  if (prev === next) return marks;
  let a = 0;
  const max = Math.min(prev.length, next.length);
  while (a < max && prev[a] === next[a]) a++;
  let e = 0;
  while (e < max - a && prev[prev.length - 1 - e] === next[next.length - 1 - e]) e++;
  const b = prev.length - e;        // prev[a, b) was replaced by
  const len = next.length - e - a;  // next[a, a + len)
  const map = (p, sticky) => {
    if (p < a || (sticky && p === a)) return p;
    if (p >= b) return p - (b - a) + len;
    return a + Math.min(p - a, len);
  };
  return marks.map(m => ({ ...m, at: map(m.at, !!m.notes) }));
}

/** { text, marks } → string lines. */
export function wordsToLines(text, marks) {
  const rows = text.split('\n');
  const starts = [];
  let at = 0;
  for (const r of rows) { starts.push(at); at += r.length + 1; }
  const lineOf = (p) => { let k = 0; while (k + 1 < starts.length && starts[k + 1] <= p) k++; return k; };
  const chords = rows.map(() => new Map());
  const notes = rows.map(() => []);
  for (const m of marks) {
    const k = lineOf(Math.max(0, Math.min(m.at, text.length)));
    if (m.notes) notes[k].push(...m.notes);
    else chords[k].set(Math.min(m.at - starts[k], rows[k].length), m.chord);
  }
  return rows.map((plainText, k) => {
    const line = placementToLine({ plainText, chords: [...chords[k]].map(([pos, chord]) => ({ pos, chord })) });
    if (!notes[k].length) return line;
    const tail = notes[k].map(n => `{!${n}}`).join(' ');
    return !line ? tail : /\s$/.test(line) ? line + tail : `${line} ${tail}`;
  });
}

/** A section's lines cut into runs of string lines and the objects between them. */
export function lineRuns(lines) {
  const runs = [];
  for (const l of lines) {
    if (typeof l === 'string') {
      if (runs.length && runs[runs.length - 1].lines) runs[runs.length - 1].lines.push(l);
      else runs.push({ lines: [l] });
    } else runs.push({ obj: l });
  }
  if (!runs.length || !runs[runs.length - 1].lines) runs.push({ lines: [] });
  return runs;
}

/** The reverse of lineRuns. An empty run adds nothing. */
export const runsToLines = (runs) => runs.flatMap(r => (r.lines ? r.lines : [r.obj]));

/** A line with its inline notes ({!…}) replaced by `notes`; chords untouched. */
export function setLineNotes(line, notes) {
  const { clean } = extractInlineNotes(line);
  const keep = notes.map(n => String(n).replace(/[{}]/g, '').trim()).filter(Boolean);
  if (!keep.length) return clean;
  const tail = keep.map(n => `{!${n}}`).join(' ');
  return !clean ? tail : /\s$/.test(clean) ? clean + tail : `${clean} ${tail}`;
}
