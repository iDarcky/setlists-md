// Which Space (library) a song or setlist object came from.
//
// A Space's sync engine must only ever upload what belongs to that Space. On
// 2026-11-14 one library's pull finished after the app had switched to the
// church; its songs landed in the church's state, looked like new local edits
// there, and were uploaded into the church (31 created, 5 overwritten).
//
// The rule, enforced inside the engine rather than at every call site in App:
// an object is stamped with the Space it was read from (a load from the
// device, or a sync result), and an engine drops any object stamped with a
// different Space before it can mark it dirty or push it. Objects created by
// an edit are new objects with no stamp: they belong to whichever Space's
// state they are put into, which is the normal case.
//
// A WeakMap, not a property: the stamp must never reach the wire, IndexedDB or
// a content hash, and object identity (the app's change signal) is unchanged.
const origin = new WeakMap();

export function markOrigin(items, libraryId) {
  if (!libraryId || !Array.isArray(items)) return items;
  for (const item of items) {
    if (item && typeof item === 'object') origin.set(item, libraryId);
  }
  return items;
}

export function originOf(item) {
  return item && typeof item === 'object' ? origin.get(item) : undefined;
}

// The items an engine for `libraryId` may treat as its own. Returns the same
// array when nothing is foreign, so callers keep reference equality.
export function ownItems(items, libraryId, onForeign) {
  if (!Array.isArray(items) || !libraryId) return items;
  let out = null;
  for (let i = 0; i < items.length; i++) {
    const from = originOf(items[i]);
    if (from !== undefined && from !== libraryId) {
      if (!out) out = items.slice(0, i);
      onForeign?.(items[i], from);
      continue;
    }
    if (out) out.push(items[i]);
  }
  return out || items;
}
