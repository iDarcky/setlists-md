import { normalizeSectionName } from '@/music';

/**
 * Edit mode's play-order arithmetic, as pure functions.
 *
 * Kept out of the component because getting this wrong is invisible: a
 * structure edit that lands on the wrong slot re-orders somebody's song and
 * nothing on screen says so until they play it. It is also the only part of
 * edit mode that can be tested without a DOM.
 *
 * The model, from `arrangements.js` + `songFlow.js`:
 *  - `arrangement.structure[]` is the PLAY ORDER — section *names*, repeatable.
 *  - `arrangement.sections[]` are the section bodies, each named once.
 *  - `orderSections()` maps the names onto the bodies, and falls back to
 *    document order when the structure doesn't fully resolve.
 *
 * So editing the play order means editing `structure`, never `sections`:
 * removing a slot must not delete the words.
 */

/** A structure entry can be a bare string or `{ type }`. Read either. */
export function entryName(entry) {
  return typeof entry === 'string' ? entry : (entry?.type || '');
}

/**
 * The play order as a real array, materialising one when the song has none.
 *
 * A song with no `structure` (or `structureMode: 'doc'`) is played in document
 * order — `orderSections` returns `sections` untouched. There is nothing to
 * reorder in that case, so the first edit has to WRITE DOWN the order that was
 * previously implied. Without this the first tap appears to do nothing: the
 * edit lands on an empty array and `orderSections` keeps falling back.
 */
export function materialiseStructure(song, ordered) {
  const structure = song?.structure;
  const usable = Array.isArray(structure)
    && structure.length > 0
    && song?.structureMode !== 'doc'
    // It must actually resolve, or `orderSections` is ignoring it anyway and
    // the indices we are about to edit refer to a list nobody is reading.
    && structure.length === (ordered || []).length;
  if (usable) return structure.slice();
  return (ordered || []).map(s => s.type);
}

/**
 * Move the slot at `idx` by `delta` (-1 earlier, +1 later).
 * Returns the same array reference when the move is a no-op, so a caller can
 * skip a write.
 */
export function moveSlot(structure, idx, delta) {
  const to = idx + delta;
  if (!Array.isArray(structure)) return structure;
  if (idx < 0 || idx >= structure.length || to < 0 || to >= structure.length) return structure;
  const next = structure.slice();
  [next[idx], next[to]] = [next[to], next[idx]];
  return next;
}

/**
 * Take the slot at `idx` out of the play order.
 *
 * The section BODY is left alone. Removing "Chorus" the third time it is sung
 * must not delete the chorus — and because the same body is referenced by every
 * slot that names it, deleting bodies here would silently empty the other
 * repeats too.
 */
export function removeSlot(structure, idx) {
  if (!Array.isArray(structure)) return structure;
  if (idx < 0 || idx >= structure.length) return structure;
  // Never leave a song with an empty play order: `orderSections` would fall
  // back to document order and every removal would appear to undo itself.
  if (structure.length <= 1) return structure;
  return structure.filter((_, i) => i !== idx);
}

/**
 * Move a whole RUN of consecutive identical slots to a new position.
 *
 * The ribbon collapses `C C C` into one `C ×3` chip, so dragging that chip has
 * to move all three — moving one slot out of a run would silently split it into
 * two chips, which is not what the thing under your finger looked like.
 *
 * `fromIndex` is the run's first slot, `count` its length, `toIndex` the slot
 * position to land at (before removal).
 */
export function moveRun(structure, fromIndex, count, toIndex) {
  if (!Array.isArray(structure)) return structure;
  if (fromIndex < 0 || count < 1 || fromIndex + count > structure.length) return structure;
  if (toIndex < 0 || toIndex > structure.length) return structure;
  // Landing inside itself is a no-op; return the same reference so the caller
  // skips the write and no undo step is pushed.
  if (toIndex >= fromIndex && toIndex <= fromIndex + count - 1) return structure;
  const moved = structure.slice(fromIndex, fromIndex + count);
  const rest = [...structure.slice(0, fromIndex), ...structure.slice(fromIndex + count)];
  // Removing the run first shifts every later index down by `count`.
  const at = toIndex > fromIndex ? toIndex - count : toIndex;
  return [...rest.slice(0, at), ...moved, ...rest.slice(at)];
}

/** Add a section to the END of the play order. */
export function appendSection(structure, name) {
  if (!Array.isArray(structure) || !name) return structure;
  return [...structure, name];
}

/**
 * A section that does not exist yet — a NEW body, not another play of an old one.
 *
 * ⚠ This is a different verb from `appendSection` and from the song map's `+`,
 * and the difference is the whole reason it lives at the bottom of the chart
 * rather than on the map. The map's `+` means *"play this again"*: it touches
 * `structure` only, and the section it repeats already has words. This one
 * invents a body — somebody brought an intro to rehearsal — so it has to write
 * `sections` AND `structure`, and it is the only edit in the reader that makes
 * the song longer. Owner, 2026-08-10: *"a better way is to add a add section at
 * the bottom of the edit view, because we already have a + in the song map for
 * adding a repeating section."*
 *
 * Both lists move together or neither does. Writing `sections` alone leaves a
 * section that exists and never plays; writing `structure` alone names a
 * section that does not exist, which `buildSongFlow` then drops — either way the
 * tap looks like it did nothing, which is the failure mode this whole file
 * exists to avoid.
 *
 * `ordered` is what the reader is actually showing, so the structure is
 * materialised from the same source `editStructure` uses — a song played in
 * document order has no `structure` array to append to, and appending to the
 * empty one it does have would silently drop every section before the new one.
 *
 * The name is made UNIQUE against the sections that exist, because the play
 * order refers to sections BY NAME: a second "Intro" would be indistinguishable
 * from the first, and every slot naming it would render the same body.
 */
export function addNewSection(song, ordered, rawName) {
  const name = String(rawName || '').trim();
  if (!song || !name) return null;
  const sections = Array.isArray(song.sections) ? song.sections : [];
  const taken = new Set(sections.map(s => normalizeSectionName(s?.type)));
  let unique = name;
  for (let n = 2; taken.has(normalizeSectionName(unique)); n += 1) unique = `${name} ${n}`;
  return {
    // One empty line, not zero. A section with no lines renders as a heading
    // with nothing under it and no line to put a chord on, so the thing you
    // just added would offer nowhere to type.
    sections: [...sections, { type: unique, note: '', lines: [''] }],
    structure: [...materialiseStructure(song, ordered), unique],
    structureMode: 'custom',
    name: unique,
  };
}

/**
 * Play the slot at `afterIndex` once more, immediately after itself.
 *
 * The ribbon collapses consecutive duplicates, so inserting a copy right after
 * the run's last slot makes the chip's `×N` tick up rather than adding a second
 * chip beside it — which is what "add it to the song map" should look like.
 */
export function addSlotAfter(structure, afterIndex) {
  if (!Array.isArray(structure)) return structure;
  if (afterIndex < 0 || afterIndex >= structure.length) return structure;
  const next = structure.slice();
  next.splice(afterIndex + 1, 0, structure[afterIndex]);
  return next;
}

/** The fields edit mode can change, snapshotted for "save as new arrangement". */
export const EDITABLE_FIELDS = ['key', 'tempo', 'time', 'capo', 'notes', 'structure', 'structureMode', 'sections'];

export function snapshotEditable(song) {
  const out = {};
  for (const k of EDITABLE_FIELDS) out[k] = song?.[k];
  return out;
}

/** Has anything actually changed since edit mode opened? */
export function isDirty(base, song) {
  if (!base || !song) return false;
  return EDITABLE_FIELDS.some(k => JSON.stringify(base[k]) !== JSON.stringify(song[k]));
}

/**
 * Replace the Nth chord on a line, in place, leaving everything else byte-exact.
 *
 * The `.md` line is the source of truth — NOT the parsed pairs — so this edits
 * the text rather than re-serialising a parse. A round-trip through
 * parse→serialise would quietly normalise spacing on every chord change, and a
 * chart that reflows because someone fixed one chord is a chart nobody trusts.
 *
 * Inline notes are `{!…}`, not `[…]`, so they cannot be mistaken for a chord.
 */
export function replaceChordInLine(line, index, chord) {
  if (typeof line !== 'string' || index < 0) return line;
  let n = -1;
  let replaced = false;
  const out = line.replace(/\[([^\]]+)\]/g, (match) => {
    n += 1;
    if (n !== index) return match;
    replaced = true;
    return `[${chord}]`;
  });
  // Out of range — return the ORIGINAL reference so a caller can tell nothing
  // happened and skip the write.
  return replaced ? out : line;
}

/**
 * Write one edited line back into a song's sections.
 *
 * `sectionIndex` is an index into `song.sections`, NOT into the play order:
 * a section repeated three times is ONE body, so editing it correctly changes
 * every repeat. Looking it up by play-order position instead would edit
 * whichever section happened to sit at that slot.
 */
export function withEditedLine(sections, sectionIndex, lineIndex, nextLine) {
  if (!Array.isArray(sections)) return sections;
  const section = sections[sectionIndex];
  if (!section || !Array.isArray(section.lines)) return sections;
  if (section.lines[lineIndex] === nextLine) return sections;
  return sections.map((s, i) => (i === sectionIndex
    ? { ...s, lines: s.lines.map((l, j) => (j === lineIndex ? nextLine : l)) }
    : s));
}
