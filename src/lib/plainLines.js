import { parseLine } from '@/parser';

// "[G]Amazing [G7]grace" → word groups. Each group is one unbreakable unit on
// screen (a word, with any chords that sit inside it), so a long line wraps
// between words, never inside one, and a chord never drifts off its syllable.
export function lineGroups(line) {
  const tokens = [];
  for (const { chord, text } of parseLine(line)) {
    // Split the text after each run of spaces; the first piece carries the chord.
    const pieces = text.match(/[^\s]*\s*/g).filter(Boolean);
    if (pieces.length === 0) pieces.push('');
    pieces.forEach((p, i) => tokens.push({ chord: i === 0 ? chord : '', text: p }));
  }
  const groups = [];
  let cur = [];
  for (const t of tokens) {
    cur.push(t);
    if (/\s$/.test(t.text)) { groups.push(cur); cur = []; }
  }
  if (cur.length) groups.push(cur);
  return groups;
}
