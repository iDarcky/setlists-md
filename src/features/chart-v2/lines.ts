import { parseLine, extractInlineNotes } from '@/parser';
import type { Line, LineView, Play, Token } from './types';

/**
 * "[G]Amazing [G7]grace" → word groups. A group is one unbreakable unit on
 * screen (a word, with any chords inside it), so a long line wraps between
 * words and a chord never leaves its syllable.
 */
export function lineGroups(line: string): Token[][] {
  const tokens: Token[] = [];
  for (const { chord, text } of parseLine(line) as Token[]) {
    const pieces = (text.match(/[^\s]*\s*/g) || []).filter(Boolean);
    if (pieces.length === 0) pieces.push('');
    pieces.forEach((p, i) => tokens.push({ chord: i === 0 ? chord : '', text: p }));
  }
  const groups: Token[][] = [];
  let cur: Token[] = [];
  for (const t of tokens) {
    cur.push(t);
    if (/\s$/.test(t.text)) { groups.push(cur); cur = []; }
  }
  if (cur.length) groups.push(cur);
  return groups;
}

/** Decide what one stored line draws as. */
export function viewLine(line: Line): LineView {
  if (typeof line !== 'string') {
    if (line.type === 'tab') return { kind: 'tab', tab: line };
    if (line.type === 'tabref') return line.tab ? { kind: 'tab', tab: line.tab } : { kind: 'skip' };
    return { kind: 'skip' }; // modulate: drawn from the key-change marks
  }
  const { clean, notes } = extractInlineNotes(line) as { clean: string; notes: string[] };
  const groups = lineGroups(clean);
  const chords = groups.flat().filter(t => t.chord).map(t => t.chord);
  const words = clean.replace(/\[[^\]]*\]/g, '').trim();
  if (!words && chords.length === 0) return notes.length ? { kind: 'lyrics', groups: [], notes, hasChords: false } : { kind: 'gap' };
  // A chords-only line (intro, solo, turnaround) is drawn as bars.
  if (!words) return { kind: 'bars', chords, notes };
  return { kind: 'lyrics', groups, notes, hasChords: chords.length > 0 };
}

/** "G7" → ["G", "7", ""]; "Dsus4/F#" → ["D", "sus4", "/F#"]. Minor stays on the line. */
export function splitChord(chord: string): [string, string, string] {
  const m = /^([A-G][#b♯♭]?(?:m(?!aj))?)([^/]*)(\/.*)?$/.exec(chord);
  if (!m) return [chord, '', ''];
  return [m[1], m[2] || '', m[3] || ''];
}

/** 2 → "2nd", 3 → "3rd", 4 → "4th". */
export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th';
  return `${n}${s}`;
}

/** "Chorus" → "Chorus · 2nd time" on its second play. */
export function playName(p: Play): string {
  return p.nth > 1 ? `${p.section.type} · ${ordinal(p.nth)} time` : p.section.type;
}
