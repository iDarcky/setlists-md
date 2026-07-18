// Field-level three-way merge for songs and setlists.
//
// WHY: today a Yes/Yes conflict (both this device AND the server changed an item
// since the last sync) surfaces the WHOLE item to the user to resolve. But most
// such collisions are disjoint — one person fixed the tempo while another added
// a tag — and shouldn't need a human at all. A three-way merge against the last
// synced BASELINE resolves every field only one side touched, and only asks the
// user about fields BOTH sides changed differently.
//
// SCOPE (deliberately conservative): song *metadata* merges per field; the
// chart itself (`arrangements`, i.e. every lyric/chord/section) is treated as a
// SINGLE unit — if both sides edited the chart we do NOT try to line up sections
// (they have no stable ids), we flag a conflict. Setlists merge per top-level
// field with `items` (the song order) as one unit. This resolves the common,
// low-stakes collisions automatically while never guessing on the risky ones.
//
// PURE + wiring-ready: takes plain song/setlist objects (base = last synced,
// local = this device, remote = server) and returns { merged, conflictFields }.
// `conflictFields.length === 0` means it merged cleanly and the caller can adopt
// `merged` without prompting; otherwise fall back to the existing conflict UI.

import { stableStringify } from './canonical';

const eq = (a, b) => stableStringify(a) === stableStringify(b);

// Resolve one field across the three versions. Returns { value, conflict }.
function mergeField(base, local, remote) {
  if (eq(local, remote)) return { value: local, conflict: false };   // agree (or both same edit)
  if (eq(local, base)) return { value: remote, conflict: false };    // only remote changed
  if (eq(remote, base)) return { value: local, conflict: false };    // only local changed
  return { value: local, conflict: true };                           // both changed differently
}

// Merge a set of field keys off three objects. `blob` keys are compared as one
// opaque unit (already the default here — every key is compared whole).
function mergeByKeys(keys, base, local, remote) {
  const merged = {};
  const conflictFields = [];
  for (const k of keys) {
    const { value, conflict } = mergeField(base?.[k], local?.[k], remote?.[k]);
    merged[k] = value;
    if (conflict) conflictFields.push(k);
  }
  return { merged, conflictFields };
}

// Song fields that merge independently. `arrangements` + `defaultArrangementId`
// are the chart — compared as one unit (both-touched → conflict). `keyHistory`
// is device-derived play counts, not user content: never a conflict, union by
// taking the larger count so no play is lost.
const SONG_FIELDS = [
  'title', 'artist', 'ccli', 'tags', 'spotify', 'youtube',
  'originalTitle', 'language', 'translator', 'writers', 'publishers',
  'copyright', 'album', 'label', 'year', 'themes', 'genres', 'scripture',
  'vocalRange', 'moment', 'story',
  'arrangements', 'defaultArrangementId',
];

function mergeKeyHistory(base, local, remote) {
  const out = {};
  for (const k of new Set([...Object.keys(local || {}), ...Object.keys(remote || {})])) {
    out[k] = Math.max(local?.[k] || 0, remote?.[k] || 0);
  }
  void base;
  return out;
}

export function threeWayMergeSong(base, local, remote) {
  if (!base || !local || !remote) return { merged: remote, conflictFields: ['__nobase__'] };
  const { merged, conflictFields } = mergeByKeys(SONG_FIELDS, base, local, remote);
  return {
    merged: {
      ...remote,          // carry any fields we don't explicitly merge (id, updatedAt, …)
      ...merged,
      id: local.id,       // identity is never merged — keep ours
      keyHistory: mergeKeyHistory(base.keyHistory, local.keyHistory, remote.keyHistory),
    },
    conflictFields,
  };
}

// Setlist fields that merge independently. `items` (the song order + per-item
// key/capo/notes) is the body — one unit; reordering while someone else edits
// an item is a genuine conflict worth a human.
const SETLIST_FIELDS = [
  'name', 'date', 'time', 'location', 'tags', 'service', 'status', 'notes', 'items',
];

export function threeWayMergeSetlist(base, local, remote) {
  if (!base || !local || !remote) return { merged: remote, conflictFields: ['__nobase__'] };
  const { merged, conflictFields } = mergeByKeys(SETLIST_FIELDS, base, local, remote);
  return {
    merged: { ...remote, ...merged, id: local.id },
    conflictFields,
  };
}
