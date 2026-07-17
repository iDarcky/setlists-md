// Shared line helpers for the Arrange editors. Extracted so the V2 editor can
// reuse the proven caret-mapping + placement parsing without duplicating it.

import { lineToPlacement, placementToLine, extractInlineNotes, serializeTabBlock } from '../../parser';

// Serialize one section line (string lyric, tab, tabref, or modulate) back to
// its raw .md form. Shared by the inline lyric editor and the Arrange
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

// Plain lyrics (chords + inline notes stripped) for the string lines only.
// Used by the inline "Edit lyrics" surface so the writer sees just the words.
export function lyricsOnly(lines) {
  return lines
    .filter(l => typeof l === 'string')
    .map(l => lineToPlacement(extractInlineNotes(l).clean).plainText)
    .join('\n');
}

// Shift chord positions from `oldText` onto `newText` using a common
// prefix/suffix diff, so editing the words (e.g. deleting a space) MOVES the
// chords with the text instead of leaving them at stale absolute offsets — the
// old clamp-only behaviour piled chords at the end and looked like they vanished.
export function alignChords(oldText, newText, chords) {
  const oldLen = oldText.length;
  const newLen = newText.length;
  let pre = 0;
  while (pre < oldLen && pre < newLen && oldText[pre] === newText[pre]) pre++;
  let suf = 0;
  while (suf < (oldLen - pre) && suf < (newLen - pre)
    && oldText[oldLen - 1 - suf] === newText[newLen - 1 - suf]) suf++;
  const delta = newLen - oldLen;
  const changeEnd = oldLen - suf; // exclusive end of the edited region in oldText
  return chords.map(c => {
    let pos = c.pos;
    if (pos <= pre) { /* before the edit — unchanged */ }
    else if (pos >= changeEnd) { pos += delta; } // after the edit — shift by delta
    else { pos = pre; } // inside the edited span — snap to the edit's start
    return { chord: c.chord, pos: Math.max(0, Math.min(pos, newLen)) };
  });
}

// Merge edited plain-lyrics back onto a section's lines, preserving each line's
// existing chords (moved to track the edited text), any inline note, and any
// tab/modulate lines in place. Extra new lines become plain lyrics. Returns a
// raw .md block (re-parsed by the caller with parseSectionLines).
export function mergeLyrics(originalLines, lyricsText) {
  const newLyrics = lyricsText.split('\n');
  const out = [];
  let p = 0;
  for (const line of originalLines) {
    if (typeof line !== 'string') { out.push(serializeLine(line)); continue; }
    const lyric = newLyrics[p] ?? '';
    p += 1;
    const { clean } = extractInlineNotes(line);
    const noteMatch = line.match(/\{!(.*?)\}/);
    const { plainText: oldLyric, chords } = lineToPlacement(clean);
    const aligned = alignChords(oldLyric, lyric, chords);
    let merged = placementToLine({ plainText: lyric, chords: aligned });
    if (noteMatch) merged += ` {!${noteMatch[1]}}`;
    out.push(merged);
  }
  for (; p < newLyrics.length; p++) out.push(newLyrics[p]);
  return out.join('\n');
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
