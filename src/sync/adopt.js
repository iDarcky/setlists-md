// Adopting a sync result into React state without clobbering concurrent edits.
//
// THE PROBLEM: a full sync runs against a SNAPSHOT of songs/setlists (the
// arrays that existed when it started) and takes seconds on a large library.
// The old adoption code did `setSongs(result.songs)` — wholesale — so anything
// the user edited/created/deleted *while the sync was in flight* was silently
// reverted to the snapshot's version. The edit usually still reached the cloud
// via its own debounced push, so the UI "flickered back" and then healed on a
// later pull — exactly the kind of shaky behaviour that erodes trust in sync —
// and in the worst case the follow-up push raced a CAS conflict for no reason.
//
// THE FIX: adopt functionally against the CURRENT state (`prev`), using the
// snapshot (`base`) to tell "the sync changed this" apart from "the user
// changed this while we were syncing". React state is immutable-by-convention
// here, so reference identity is an exact, free change signal:
//   prev[id] === base[id]  → untouched during the sync → the result wins
//   prev[id] !== base[id]  → edited during the sync    → the edit wins
//                            (its own debounced push follows right behind)

/**
 * Reconcile a server-authoritative (`replaced: true`) sync result with the
 * current state. Per item id:
 *  - in result & in prev: keep the prev object if it changed during the sync,
 *    else adopt the result object.
 *  - in result, missing from prev: re-add only if it wasn't deleted mid-sync
 *    (absent from prev but present in base = the user just deleted it).
 *  - in prev, missing from result: server deletion → drop, UNLESS the user
 *    edited it mid-sync or created it mid-sync — those survive and re-push.
 * Result order is preserved; mid-sync creations append at the end.
 */
export function reconcileAdopt(prev, base, result) {
  const prevById = new Map();
  for (const item of prev) if (item?.id) prevById.set(item.id, item);
  const baseById = new Map();
  for (const item of base) if (item?.id) baseById.set(item.id, item);

  const out = [];
  const seen = new Set();
  for (const item of result) {
    const id = item?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const cur = prevById.get(id);
    if (cur !== undefined) {
      const snap = baseById.get(id);
      out.push(cur !== snap ? cur : item);
    } else if (!baseById.has(id)) {
      out.push(item); // brand new from the server
    }
    // else: was present at sync start, gone from current state → the user
    // deleted it mid-sync; don't resurrect (their tombstone pushes the delete).
  }

  for (const item of prev) {
    const id = item?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const snap = baseById.get(id);
    if (snap === undefined) {
      out.push(item); // created mid-sync — never seen by this sync pass
    } else if (item !== snap) {
      // The server (or a truncated pull) dropped it, but the user edited it
      // while the sync ran. An in-flight edit beats a concurrent delete: keep
      // it; with its manifest entry gone the next push re-inserts it.
      out.push(item);
    }
    // else: untouched locally + dropped by the server → deletion wins.
  }

  return out;
}

/**
 * Apply a partial (file-provider) pull into current state: only the ids the
 * engine actually pulled are touched. An item the user edited mid-sync keeps
 * the local version (the remote copy stays synced in the manifest; the very
 * next push uploads the local edit — same last-write-wins the engine already
 * implements, minus the UI flicker). An id absent from BOTH prev and base is a
 * new remote item and is appended; absent from prev but present in base means
 * the user deleted it mid-sync, so it is not re-added.
 */
export function applyPulled(prev, base, resultItems, pulledIds) {
  if (!pulledIds || pulledIds.size === 0) return prev;
  const baseById = new Map();
  for (const item of base) if (item?.id) baseById.set(item.id, item);
  const resultById = new Map();
  for (const item of resultItems) if (item?.id) resultById.set(item.id, item);

  let changed = false;
  const next = prev.map(item => {
    const id = item?.id;
    if (!id || !pulledIds.has(id)) return item;
    const pulled = resultById.get(id);
    if (!pulled || pulled === item) return item;
    const snap = baseById.get(id);
    if (item !== snap) return item; // edited mid-sync — local wins for now
    changed = true;
    return pulled;
  });

  const prevIds = new Set(prev.map(i => i?.id));
  for (const id of pulledIds) {
    if (prevIds.has(id)) continue;
    if (baseById.has(id)) continue; // deleted mid-sync — don't resurrect
    const pulled = resultById.get(id);
    if (pulled) {
      next.push(pulled);
      changed = true;
    }
  }

  return changed ? next : prev;
}
