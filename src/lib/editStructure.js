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
