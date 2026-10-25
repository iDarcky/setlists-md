// What Home shows, worked out from the library and the team's schedule. Pure
// functions: Home.jsx feeds them hook data, the tests feed them fixtures.
//
// A schedule row (`team_schedules`) points at the team_setlists ROW UUID, not
// the local setlist id — every lookup goes through `setlistMap` (local id →
// row UUID) as well as the plain id. See CLAUDE.md → Known Gotchas.

import { setlistStartMs, isSetlistUpcoming } from './setlistTime';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local YYYY-MM-DD (toISOString would shift across midnight in UTC+). */
export function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The setlist a schedule row points at, or null. */
export function scheduleSetlist(schedule, setlists, setlistMap = {}) {
  if (!schedule) return null;
  return setlists.find(sl => sl.id === schedule.setlist_id || setlistMap[sl.id] === schedule.setlist_id) || null;
}

/** Schedule rows for one setlist. */
export function bandFor(setlist, schedules = [], setlistMap = {}) {
  if (!setlist) return [];
  const rowId = setlistMap[setlist.id];
  return schedules.filter(s => s.setlist_id === setlist.id || (rowId && s.setlist_id === rowId));
}

const byStart = (a, b) => setlistStartMs(a.setlist) - setlistStartMs(b.setlist);

/** Upcoming services this user has been asked about and not answered yet. */
export function myAsks({ schedules = [], userId, setlists = [], setlistMap = {}, now = Date.now() }) {
  if (!userId) return [];
  return schedules
    .filter(s => s.user_id === userId && s.availability === 'pending')
    .map(s => ({ schedule: s, setlist: scheduleSetlist(s, setlists, setlistMap) }))
    .filter(a => a.setlist && isSetlistUpcoming(a.setlist, now))
    .sort(byStart);
}

/** Upcoming services this user said yes to, with their row. */
export function myServices({ schedules = [], userId, setlists = [], setlistMap = {}, now = Date.now() }) {
  if (!userId) return [];
  return schedules
    .filter(s => s.user_id === userId && s.availability === 'available')
    .map(s => ({ schedule: s, setlist: scheduleSetlist(s, setlists, setlistMap) }))
    .filter(a => a.setlist && isSetlistUpcoming(a.setlist, now))
    .sort(byStart);
}

/** Every upcoming dated setlist, soonest first. */
export function upcomingSetlists(setlists = [], now = Date.now()) {
  return setlists
    .filter(sl => sl.date && isSetlistUpcoming(sl, now))
    .sort((a, b) => setlistStartMs(a) - setlistStartMs(b));
}

/**
 * The service Home leads with. A member sees the next one they play; a leader
 * runs them all, so sees the church's next one. Without a team (a personal
 * library) it is simply the next dated setlist.
 * @returns {{ setlist, schedule } | null}
 */
export function nextUp({ setlists = [], schedules = [], userId, setlistMap = {}, now = Date.now(), inTeam = false, leader = false }) {
  if (!inTeam || leader) {
    const sl = upcomingSetlists(setlists, now)[0];
    if (!sl) return null;
    const mine = inTeam ? bandFor(sl, schedules, setlistMap).find(s => s.user_id === userId) || null : null;
    return { setlist: sl, schedule: mine };
  }
  return myServices({ schedules, userId, setlists, setlistMap, now })[0] || null;
}

/** Whole days from today to the setlist's date (0 = today). */
export function daysUntil(setlist, now = Date.now()) {
  if (!setlist?.date) return null;
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const day = new Date(`${setlist.date}T00:00:00`);
  return Math.round((day.getTime() - today.getTime()) / DAY_MS);
}

/**
 * The "Can you play?" strip on Home: the next `count` Sundays (today counts),
 * plus any other day the user has an unanswered ask on, so an ask on a Friday
 * is never hidden. Availability is stored per DAY (`team_availability`), so one
 * answer covers everything on that date.
 * `mine` is the user's own availability rows; `asks` and `plays` come from
 * myAsks() / myServices(). `rows` on a tile is every schedule row of the user's
 * on that day, which an answer updates as well.
 */
export function canYouPlay({ now = Date.now(), setlists = [], asks = [], plays = [], mine = [], count = 5, weekday = 0 }) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const dates = new Set();
  const d = new Date(today);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  for (let i = 0; i < count; i++) {
    dates.add(toDateStr(d));
    d.setDate(d.getDate() + 7);
  }
  asks.forEach(a => a.setlist?.date && dates.add(a.setlist.date));
  const status = Object.fromEntries(mine.map(r => [r.date, r.status]));
  return [...dates].sort().map(date => {
    const dt = new Date(`${date}T12:00:00`);
    const dayAsks = asks.filter(a => a.setlist.date === date);
    const dayPlays = plays.filter(p => p.setlist.date === date);
    return {
      date,
      weekday: dt.toLocaleDateString('en-US', { weekday: 'short' }),
      day: dt.getDate(),
      names: [...new Set(setlists.filter(sl => sl.date === date).map(sl => sl.name || 'Setlist'))],
      status: status[date] || null,
      asks: dayAsks,
      playing: dayPlays.length > 0,
      rows: [...dayAsks, ...dayPlays].map(x => x.schedule),
    };
  });
}

/**
 * Leaders: how many people can play on each of the next few services, from
 * the team's per-date availability. `noAnswer` counts members with no row.
 */
export function whoCanPlay({ setlists = [], availability = [], memberCount = 0, now = Date.now(), limit = 3 }) {
  const seen = new Set();
  return upcomingSetlists(setlists, now)
    .filter(sl => (seen.has(sl.date) ? false : seen.add(sl.date)))
    .slice(0, limit)
    .map(sl => {
      const rows = availability.filter(a => a.date === sl.date);
      const yes = rows.filter(a => a.status === 'available').length;
      const maybe = rows.filter(a => a.status === 'maybe').length;
      const no = rows.filter(a => a.status === 'unavailable').length;
      return { setlist: sl, yes, maybe, no, noAnswer: Math.max(0, memberCount - yes - maybe - no), total: Math.max(memberCount, yes + maybe + no) };
    });
}

/**
 * Leaders: things only they can unblock, in the order to do them. People
 * waiting to join; services in the next `horizonDays` with nobody on the band;
 * and ones with no songs.
 */
export function needsYou({ joinRequests = [], setlists = [], schedules = [], setlistMap = {}, now = Date.now(), horizonDays = 21 }) {
  const items = [];
  if (joinRequests.length) {
    const names = joinRequests.map(r => r.display_name || r.email?.split('@')[0]).filter(Boolean);
    items.push({ kind: 'join', count: joinRequests.length, names });
  }
  const horizon = now + horizonDays * DAY_MS;
  for (const sl of upcomingSetlists(setlists, now)) {
    if (setlistStartMs(sl) > horizon) break;
    if (bandFor(sl, schedules, setlistMap).length === 0) items.push({ kind: 'noband', setlist: sl });
    if (!(sl.items || []).some(i => i.songId)) items.push({ kind: 'nosongs', setlist: sl });
  }
  return items;
}

/**
 * Songs added or changed most recently. Songs carry no creation stamp, only
 * `updatedAt`, so a fresh edit to an old song counts as well.
 */
export function latestSongs(songs = [], limit = 3) {
  return [...songs].filter(s => s.updatedAt).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
}

const ACTIVITY_VERBS = {
  song_added: ['song', 'added'],
  song_edited: ['song', 'edited'],
  song_removed: ['song', 'removed'],
  setlist_created: ['setlist', 'created'],
  setlist_edited: ['setlist', 'updated'],
  setlist_removed: ['setlist', 'deleted'],
  member_joined: ['member', 'joined'],
};

/**
 * What changed in the library lately, from `team_activity` rows (newest
 * first). Repeats of one event on one thing collapse to the newest, so ten
 * saves of a song read as one "edited". Schedule and availability rows are
 * left out: Home already shows those as asks and the strip.
 * `entity_id` is the server ROW id, so the item carries the name as well —
 * the caller finds the local song or setlist by row map or by name.
 * @returns {Array<{ id, kind, actorId, actor, verb, object, rowId, at, removed }>}
 */
export function recentActivity(rows = [], { nameFor = () => null, userId, limit = 5 } = {}) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const known = ACTIVITY_VERBS[r.action];
    if (!known) continue;
    const key = `${r.action}:${r.entity_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const [kind, verb] = known;
    const actor = r.actor_id && r.actor_id === userId ? 'You' : nameFor(r.actor_id) || 'Someone';
    out.push({
      id: r.id, kind, actorId: r.actor_id, actor, verb,
      object: kind === 'member' ? null : r.entity_name || null,
      rowId: r.entity_id, at: new Date(r.created_at).getTime(),
      removed: verb === 'removed' || verb === 'deleted',
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Without a team there is no activity log: your own latest edits stand in. */
export function activityFromSongs(songs = [], limit = 5) {
  return latestSongs(songs, limit).map(s => ({
    id: s.id, kind: 'song', actor: 'You', verb: 'edited', object: s.title, songId: s.id, at: s.updatedAt, removed: false,
  }));
}

/** "just now", "5 min ago", "3 h ago", "2 d ago", then a date. */
export function timeAgo(at, now = Date.now()) {
  const m = Math.round((now - at) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
