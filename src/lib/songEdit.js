// The new song editor's model, as pure functions over one arrangement.
// SongEdit.jsx holds the state; the tests feed fixtures.

import { parseSectionLines, serializeTabBlock, serializeModulate } from '@/parser';
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

/** The chords to offer while editing: the ones the song already uses first, then the key's own. */
export function chordPalette(arr, max = 10) {
  const seen = new Map();
  for (const s of arr?.sections || []) {
    for (const l of s.lines || []) {
      if (typeof l !== 'string') continue;
      for (const m of l.matchAll(/\[([A-G][^\]\s]*)\]/g)) seen.set(m[1], (seen.get(m[1]) || 0) + 1);
    }
  }
  const used = [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const all = [...used, ...getDiatonicChords(arr?.key || 'C')];
  return [...new Set(all)].slice(0, max);
}

export const SECTION_TYPES = ['Intro', 'Verse', 'Pre Chorus', 'Chorus', 'Bridge', 'Instrumental', 'Interlude', 'Tag', 'Outro'];
