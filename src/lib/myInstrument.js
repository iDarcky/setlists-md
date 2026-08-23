import { normalize } from '@/data/instruments';

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
      const role = normalize(mine.role);
      if (role) return role;
    }
  }

  const me = members.find(m => m.user_id === userId);
  const list = uniq((me?.instruments || []).map(normalize).filter(Boolean));
  return list.length === 1 ? list[0] : null;
}

function uniq(xs) { return Array.from(new Set(xs)); }

/**
 * The ☰'s "Your instrument" presets, in the instrument vocabulary.
 *
 * ⚠ THE TWO ENDS OF ONE SWITCH. `ReaderMenu`'s `ROLES` and `INSTRUMENTS` are
 * two lists for one idea that have never been introduced: the menu writes
 * `settings.displayRole` (`'drums'`, `'vocalist'`) and `resolveMyInstrument`
 * above reads `team_schedules.role` (`'drums'`, `'vocals:alto'`). Anything that
 * consults only one of them is right for half the app's users and silently
 * wrong for the other half — a solo drummer picking Drums in the menu is not in
 * anybody's schedule, and a rostered drummer has never opened the menu.
 *
 * `leader` maps to NULL on purpose. "Leading" is also the value `displayRole`
 * falls back to when it was never set (`settings?.displayRole || 'leader'`, in
 * two places in App), so it cannot be told apart from "no answer" — and reading
 * it as a claim would let an untouched default outrank a leader's roster.
 */
const ROLE_INSTRUMENT = {
  leader: null,
  vocalist: 'vocals',
  guitar: 'electric-guitar',
  bass: 'bass-guitar',
  keys: 'keys',
  drums: 'drums',
};

/**
 * What the READER should assume you are playing — both ends, one answer.
 *
 * The menu pick wins over the roster because it is the more specific statement:
 * the roster is what a leader put you down for, the pick is you saying what you
 * want on screen right now. Neither present → null, which every caller must
 * read as "we do not know", never as a default instrument.
 */
export function resolveDisplayInstrument({ myInstrument = null, displayRole = null } = {}) {
  const picked = ROLE_INSTRUMENT[displayRole] ?? null;
  return picked || normalize(myInstrument) || null;
}
