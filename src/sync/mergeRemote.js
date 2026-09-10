// Adopting a pulled song into the copy this device already holds.
//
// THE RULE: the server's copy wins WHOLESALE. The only things the local copy
// contributes are what the wire cannot carry — the device-derived play
// histories (never serialized) and any extra arrangements the `.md` flattening
// left behind (markdown carries ONE arrangement per song). Since step 5 the
// replica reads a row's JSON document when it has one (`./songDoc`) and comes
// here only for a markdown-only row — one written by an older build.
//
// WHY WHOLESALE: this used to be a field-by-field patch that copied title,
// artist, ccli, tags, spotify and youtube and nothing else. Every field added
// to the format since — the twelve extended-metadata keys, the preserved
// unknown frontmatter, `structureMode`, `keyChanges` — was silently kept at
// its stale local value after a pull. The device then hashed that stale copy,
// saw it differ from the server hash it had just recorded as the baseline,
// and pushed the old values back; the other device did the same in reverse.
// Measured in production on 2026-09-09: songs alternating between two
// versions every 3–5 s, differing only by `language:` and `year:`, on the
// current build, no stale client involved (PLAN.md §1.2 #6).
//
// Building the result from `songFromFlat(parsed)` means the carried field list
// is the parser's own output shape: a field the format gains tomorrow is
// adopted on pull without anyone remembering to add it here. The invariant
// the convergence suite pins is `hash(songToMd(merged)) === hash(remote md)`,
// which is exactly the condition under which the next push is a no-op.

import { songFromFlat } from '@/arrangements';

/**
 * @param {object|null} localSong   the copy this device holds (may be null)
 * @param {object} parsed           `parseSongMd(remoteContent)`
 * @param {number} [serverUpdatedAt] the server's edit time (ms); stamped on the
 *   song and the adopted arrangement so a pulled-but-unedited song does not
 *   surface as freshly edited ("Recently edited", the activity feed).
 */
export function mergeRemoteSong(localSong, parsed, serverUpdatedAt) {
  const id = localSong?.id || parsed.id;
  const fresh = songFromFlat({ ...parsed, id });
  const stamp = serverUpdatedAt ? { updatedAt: serverUpdatedAt } : {};
  const localArrs = Array.isArray(localSong?.arrangements) ? localSong.arrangements : [];

  if (localArrs.length === 0) {
    return { ...fresh, ...stamp, arrangements: fresh.arrangements.map(a => ({ ...a, ...stamp })) };
  }

  // Which local arrangement does the remote replace? An id match first; else
  // the default one (songs synced before arrangement ids travelled, or a
  // remote written by a build that did not emit them).
  const hasIdMatch = !!parsed.arrangementId && localArrs.some(a => a.id === parsed.arrangementId);
  const targetId = hasIdMatch
    ? parsed.arrangementId
    : (localArrs.find(a => a.id === localSong.defaultArrangementId) || localArrs[0]).id;
  // The remote's arrangement id wins when it has one — a one-time migration so
  // later round-trips match by id. When it has none, the local target keeps
  // its id so setlist items that reference it keep resolving.
  const arrId = parsed.arrangementId || targetId;
  const adopted = { ...fresh.arrangements[0], id: arrId, ...stamp };
  const arrangements = localArrs.map(a => (a.id === targetId ? adopted : a));
  const defaultStillExists = arrangements.some(a => a.id === localSong.defaultArrangementId);
  const defaultArrangementId = (localSong.defaultArrangementId === targetId || !defaultStillExists)
    ? arrId
    : localSong.defaultArrangementId;

  return {
    ...fresh,
    // Play counts are per-device and never on the wire — keep ours.
    keyHistory: localSong.keyHistory || fresh.keyHistory,
    tempoHistory: localSong.tempoHistory || fresh.tempoHistory,
    arrangements,
    defaultArrangementId,
    ...stamp,
  };
}
