// What the Schedule page lists, worked out from setlists, the team's schedule
// rows and per-day availability. Pure: Schedule.jsx feeds hook data, the
// tests feed fixtures. Schedule rows point at the team_setlists ROW id, so
// band lookups go through `bandFor` (homeData), which knows the row map.

import { setlistStartMs, isSetlistUpcoming } from './setlistTime';
import { bandFor, toDateStr } from './homeData';
import { partLabel } from '@/data/instruments';

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
  const part = partLabel(row);
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

// ── Band grid ───────────────────────────────────────────────────────────────

/** The parts a band is checked against, in the order the Missing row names them. */
export const PARTS = ['Drums', 'Bass', 'Keys', 'Guitar', 'Vocals'];

/**
 * One cell of the leader's people × setlists grid. A schedule row (asked or
 * answered) outranks the person's day availability.
 *   in · asked · maybe · cant · free · none
 */
export function cellState(schedule, dayStatus) {
  if (schedule) {
    return { available: 'in', pending: 'asked', maybe: 'maybe', unavailable: 'cant' }[schedule.availability] || 'asked';
  }
  return { available: 'free', maybe: 'maybe', unavailable: 'cant' }[dayStatus] || 'none';
}

export const planKey = (setlistId, userId) => `${setlistId}:${userId}`;

/**
 * The Band grid. `plan` is the leader's unsent taps: { [planKey]: 'add' | 'remove' }.
 * An add shows as a fresh ask, a remove keeps its state but is marked. A column
 * counts who said yes and names the parts nobody covers (in or asked), from
 * the parts the church's members play.
 * Returns { columns: [{ setlist, rowId, inBand, missing }], people: [{ userId, name, part, cells }] }.
 */
export function bandGrid({ setlists = [], members = [], schedules = [], setlistMap = {}, availability = [], plan = {}, nameOf = (m) => m.user_id }) {
  const teamParts = PARTS.filter(p => members.some(m => (m.instruments || []).includes(p)));
  const people = members.map(m => ({ userId: m.user_id, name: nameOf(m), part: (m.instruments || [])[0] || '', parts: m.instruments || [], cells: [] }));
  const columns = setlists.map(sl => {
    const rows = bandFor(sl, schedules, setlistMap);
    const covered = new Set();
    let inBand = 0;
    let anyone = false;
    for (const p of people) {
      const schedule = rows.find(r => r.user_id === p.userId) || null;
      const day = availability.find(a => a.user_id === p.userId && a.date === sl.date)?.status;
      const planned = plan[planKey(sl.id, p.userId)] || null;
      const state = planned === 'add' && !schedule ? 'asked' : cellState(schedule, day);
      p.cells.push({ setlistId: sl.id, schedule, state, planned });
      const counts = planned !== 'remove' && (state === 'in' || (state === 'asked' && (schedule || planned === 'add')));
      if (counts) {
        anyone = true;
        if (state === 'in') inBand++;
        const role = schedule?.role || p.part;
        if (role) covered.add(role);
        else p.parts.forEach(x => covered.add(x));
      }
    }
    const missing = anyone ? teamParts.filter(x => !covered.has(x)) : null;
    return { setlist: sl, rowId: setlistMap[sl.id] || null, inBand, missing };
  });
  return { columns, people };
}

/** What a plan will do: asks to send and band places to take back. */
export function planSummary(plan = {}) {
  const v = Object.values(plan);
  return { adds: v.filter(x => x === 'add').length, removes: v.filter(x => x === 'remove').length };
}
