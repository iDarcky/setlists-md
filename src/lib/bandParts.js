import { normalize, labelFor } from '@/data/instruments';
import { bandFor } from '@/lib/homeData';

// The leader's band picker on the setlist page: one row per part, filled by
// who is on it (or about to be asked), empty where a part is still needed.
// A part is a top-level instrument id: 'drums', 'keys', 'vocals'…

const DAY = 86400000;
const ORDER = ['vocals', 'keys', 'piano', 'acoustic-guitar', 'electric-guitar', 'bass-guitar', 'drums'];

/** Any stored role or instrument → its top-level part id, or null. */
export function partOf(token) {
  const n = normalize(token);
  return n ? n.split(':')[0] : null;
}

export const partName = (part) => (part ? labelFor(part) || part : 'Anything');

export const plays = (member, part) => (member?.instruments || []).some(t => partOf(t) === part);

const rank = (part) => { const i = ORDER.indexOf(part); return i < 0 ? ORDER.length : i; };

/**
 * The parts the last setlist with this name had, so next Sunday starts from
 * last Sunday's shape. Empty when there is none (service templates replace this).
 */
export function lastParts({ setlist, setlists = [], schedules = [], setlistMap = {} }) {
  const name = (setlist?.name || '').trim().toLowerCase();
  if (!name) return [];
  const prev = setlists
    .filter(o => o.id !== setlist.id && o.date && (!setlist.date || o.date < setlist.date) && (o.name || '').trim().toLowerCase() === name)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const o of prev) {
    const rows = bandFor(o, schedules, setlistMap);
    if (rows.length) return rows.map(r => partOf(r.role)).filter(Boolean).sort((a, b) => rank(a) - rank(b));
  }
  return [];
}

/**
 * @param {Array} rows      this setlist's schedule rows
 * @param {Array} adds      unsent picks: [{ part, userId }]
 * @param {Set}   removes   schedule ids the leader is taking off (unsent)
 * @param {Array} needed    part ids, repeated for two of a part
 * @returns {Array<{ key, part, userId, schedule, status }>} status: available·pending·maybe·unavailable·notsent·empty
 */
export function bandSlots({ rows = [], adds = [], removes = new Set(), needed = [] }) {
  const byPart = new Map();
  const put = (part, slot) => { if (!byPart.has(part)) byPart.set(part, []); byPart.get(part).push(slot); };
  for (const r of rows) {
    if (removes.has(r.id)) continue;
    put(partOf(r.role), { key: `s-${r.id}`, userId: r.user_id, schedule: r, status: r.availability || 'pending' });
  }
  adds.forEach((a, i) => put(a.part ?? null, { key: `a-${i}`, userId: a.userId, schedule: null, status: 'notsent', add: i }));
  const want = new Map();
  needed.forEach(p => want.set(p, (want.get(p) || 0) + 1));
  const parts = [...new Set([...needed, ...byPart.keys()])].sort((a, b) => (a === null) - (b === null) || rank(a) - rank(b));
  const out = [];
  for (const part of parts) {
    const filled = byPart.get(part) || [];
    filled.forEach(s => out.push({ ...s, part }));
    for (let i = filled.length; i < (want.get(part) || 0); i++) out.push({ key: `e-${part}-${i}`, part, userId: null, schedule: null, status: 'empty' });
  }
  return out;
}

const weekdayName = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' });
const shift = (date, days) => new Date(new Date(`${date}T12:00:00`).getTime() + days * DAY).toISOString().slice(0, 10);

/**
 * Who could take `part` on this setlist, in three groups: free that day, no
 * answer yet, can't. A day answer comes from My availability, and a yes/no on
 * another setlist that day counts too. `warn` flags a third week running.
 */
export function candidates({ part, setlist, members = [], schedules = [], setlists = [], setlistMap = {}, availability = [], taken = [], nameOf = (m) => m.user_id }) {
  const date = setlist?.date;
  const onBandOn = (uid, d) => setlists.some(o => o.date === d && bandFor(o, schedules, setlistMap).some(r => r.user_id === uid && r.availability !== 'unavailable'));
  const groups = { free: [], none: [], cant: [] };
  const people = part ? members.filter(m => plays(m, part)) : members;
  for (const m of people) {
    const uid = m.user_id;
    if (taken.includes(uid)) continue;
    let status = date ? availability.find(a => a.user_id === uid && a.date === date)?.status : null;
    let said = false;
    if (date) {
      for (const o of setlists) {
        if (o.date !== date || o.id === setlist.id) continue;
        const r = bandFor(o, schedules, setlistMap).find(x => x.user_id === uid && x.availability !== 'pending');
        if (r) { status = r.availability; said = true; }
      }
    }
    let warn = '';
    if (date && onBandOn(uid, shift(date, -7)) && onBandOn(uid, shift(date, -14))) warn = `Would be 3 ${weekdayName(date)}s in a row`;
    const p = { userId: uid, name: nameOf(m), url: m.profile?.avatar_url, warn };
    if (status === 'available') groups.free.push({ ...p, note: said ? 'Playing another service that day' : 'Free that day' });
    else if (status === 'maybe') groups.free.push({ ...p, note: 'Maybe that day' });
    else if (status === 'unavailable') groups.cant.push({ ...p, note: 'Away that day' });
    else groups.none.push({ ...p, note: 'Hasn’t said' });
  }
  const byName = (a, b) => a.name.localeCompare(b.name);
  // Free first, and inside it anyone without the warning first.
  groups.free.sort((a, b) => (!!a.warn - !!b.warn) || (a.note === 'Maybe that day') - (b.note === 'Maybe that day') || byName(a, b));
  groups.none.sort(byName);
  groups.cant.sort(byName);
  return groups;
}

/** Parts a leader can add a row for. */
export const ADDABLE_PARTS = ORDER;
