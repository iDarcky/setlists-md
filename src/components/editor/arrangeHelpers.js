// Shared line helpers for the Arrange editors. Extracted so the V2 editor can
// reuse the proven caret-mapping + placement parsing without duplicating it.

import { lineToPlacement, extractInlineNotes, serializeTabBlock } from '../../parser';

// Serialize one section line (string lyric, tab, tabref, or modulate) back to
// its raw .md form. Shared by SectionDrawer's raw editor and the Arrange
// per-section Source toggle.
export function serializeLine(l) {
  if (typeof l === 'string') return l;
  if (l.type === 'tab') return serializeTabBlock(l);
  if (l.type === 'tabref') return `{tabref: ${l.name}}`;
  if (l.type === 'modulate') return `{modulate: ${l.semitones > 0 ? '+' : ''}${l.semitones}}`;
  return '';
}

// Serialize a whole section's lines[] to a raw .md block (lyrics + chords +
// tabs + modulate markers). The section cue (`section.note`) is NOT included —
// it's edited separately.
export function serializeSectionLines(lines) {
  return lines.map(serializeLine).join('\n');
}

// Map a screen point to a character offset within a line's lyric text node.
// Uses native caret APIs when available, then falls back to a per-character
// rect scan (robust on touch / wrapped lines).
export function caretOffsetFromPoint(x, y, textEl) {
  if (!textEl) return null;
  const textNode = textEl.firstChild;
  let node = null;
  let offset = 0;
  if (document.caretPositionFromPoint) {
    const cp = document.caretPositionFromPoint(x, y);
    if (cp) { node = cp.offsetNode; offset = cp.offset; }
  } else if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(x, y);
    if (r) { node = r.startContainer; offset = r.startOffset; }
  }
  if (node && textNode && node === textNode) return offset;
  if (node === textEl) return 0;
  return offsetFromRects(textEl, x, y);
}

export function offsetFromRects(textEl, x, y) {
  const node = textEl?.firstChild;
  if (!node || node.nodeType !== 3 || node.length === 0) return null;
  const range = document.createRange();
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < node.length; i++) {
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    for (const r of range.getClientRects()) {
      const onRow = y >= r.top - 2 && y <= r.bottom + 2;
      const mid = r.left + r.width / 2;
      const dist = (onRow ? 0 : 100000) + Math.abs(x - mid);
      if (dist < bestDist) { bestDist = dist; best = x > mid ? i + 1 : i; }
    }
  }
  return best;
}

export function parsePlacementLine(line) {
  const { clean } = extractInlineNotes(line);
  const noteMatch = line.match(/\{!(.*?)\}/);
  const inlineNote = noteMatch ? noteMatch[1] : null;
  const placement = lineToPlacement(clean);
  return { ...placement, inlineNote };
}

// Strip a trailing " 2"/" 3" (and an optional trailing colon, e.g. from
// "## Verse 1:") from a section label to get its base type.
export function sectionBaseType(type) {
  return (type || '').replace(/:\s*$/, '').replace(/\s*\d+$/, '').trim();
}
