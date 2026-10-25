// What the Schedule page lists, worked out from setlists, the team's schedule
// rows and per-day availability. Pure: Schedule.jsx feeds hook data, the
// tests feed fixtures. Schedule rows point at the team_setlists ROW id, so
// band lookups go through `bandFor` (homeData), which knows the row map.

import { setlistStartMs, isSetlistUpcoming } from './setlistTime';
import { bandFor, toDateStr } from './homeData';

const monthOf = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

/**
 * Dated setlists split into upcoming (soonest first) or past (latest first),
 * grouped by month: [{ month: 'November 2026', setlists: [...] }].
 */
export function groupByMonth(setlists = [], { now = Date.now(), past = false } = {}) {
  const dated = setlists.filter(sl => sl.date && isSetlistUpcoming(sl, now) !== past);
  dated.sort((a, b) => (past ? -1 : 1) * (setlistStartMs(a) - setlistStartMs(b)));
  const groups = [];
  for (const sl of dated) {
    const month = monthOf(sl.date);
    const last = groups[groups.length - 1];
    if (last?.month === month) last.setlists.push(sl);
    else groups.push({ month, setlists: [sl] });
  }
  return groups;
}

/**
 * Where the user stands on one setlist:
 *   { kind: 'playing', part, schedule } — said yes
 *   { kind: 'asked', part, schedule }   — asked, no answer yet
 *   { kind: 'cant' }                    — said no, or marked the day off
 *   { kind: 'maybe', part, schedule }   — said maybe
 *   { kind: 'not' }                     — not in the band
 */
export function myStatus(setlist, { schedules = [], setlistMap = {}, userId, availability = [] } = {}) {
  const row = bandFor(setlist, schedules, setlistMap).find(s => s.user_id === userId);
  const part = row ? [row.role, row.vocal_part].filter(Boolean).join(' · ') : '';
  if (row?.availability === 'available') return { kind: 'playing', part, schedule: row };
  if (row?.availability === 'pending') return { kind: 'asked', part, schedule: row };
  if (row?.availability === 'maybe') return { kind: 'maybe', part, schedule: row };
  if (row?.availability === 'unavailable') return { kind: 'cant' };
  const day = availability.find(a => a.user_id === userId && a.date === setlist.date);
  if (day?.status === 'unavailable') return { kind: 'cant' };
  return { kind: 'not' };
}

/**
 * A leader's view of one setlist's band: who is on it, how many said yes, and
 * how many members are free that day and not on it yet.
 */
export function bandSummary(setlist, { schedules = [], setlistMap = {}, availability = [] } = {}) {
  const rows = bandFor(setlist, schedules, setlistMap);
  const onBand = new Set(rows.map(r => r.user_id));
  const free = availability.filter(a => a.date === setlist.date && a.status === 'available' && !onBand.has(a.user_id)).length;
  return {
    rows,
    yes: rows.filter(r => r.availability === 'available').length,
    no: rows.filter(r => r.availability === 'unavailable').length,
    total: rows.length,
    free,
  };
}

/** Leader filters: a setlist needs people when it has no band or someone said no. */
export const needsPeople = (summary) => summary.total === 0 || summary.no > 0;
export const isDraft = (setlist) => setlist.status === 'draft';

/**
 * The "Can you play?" strip on Schedule: the next `count` Sundays (today counts),
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
