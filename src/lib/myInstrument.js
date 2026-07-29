/**
 * "What am I playing this service?"
 *
 * Element 9 collapses every tab that isn't yours. This is where the answer
 * comes from, and it is deliberately conservative: a wrong answer hides the
 * tab you actually needed, which is worse than showing all of them.
 *
 * Two sources, in order:
 *   1. The band for THIS setlist — `team_schedules.role` is the instrument the
 *      leader put you on, so it beats everything else.
 *   2. Your instruments on the team — only when there is exactly one. Someone
 *      listed as "Guitar, Vocals" has no single answer, so we don't guess.
 *
 * Anything else returns null, which means "show every tab".
 */
export function resolveMyInstrument({
  userId,
  setlistId,
  schedules = [],
  members = [],
  // localId → team_setlists row UUID. Schedules reference the ROW uuid, never
  // the local setlist id — matching them directly silently finds nothing.
  setlistMap = {},
} = {}) {
  if (!userId) return null;

  if (setlistId) {
    const remoteId = setlistMap[setlistId];
    const mine = schedules.find(s => (
      s.user_id === userId
      && (s.setlist_id === setlistId || (remoteId && s.setlist_id === remoteId))
    ));
    // Someone who declined isn't playing, so their roles say nothing about
    // what they need on screen — fall through to their instrument list.
    if (mine && mine.availability !== 'unavailable') {
      const role = String(mine.role || '').trim();
      if (role) return role;
    }
  }

  const me = members.find(m => m.user_id === userId);
  const list = (me?.instruments || []).map(s => String(s || '').trim()).filter(Boolean);
  return list.length === 1 ? list[0] : null;
}
