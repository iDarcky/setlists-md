/**
 * Services — the recurring things a church plays for (Sunday Morning, Youth
 * Night…). Rows live in `team_services` (20261020_team_services.sql); who
 * plays in each lives in `team_service_members`. This file is the pure half:
 * colours, the recurrence rule, and which dates a person is asked about.
 *
 * Recurrence is a weekday (0 = Sunday … 6 = Saturday) and an optional `nth`
 * (1–5): `nth` null = every week, `nth` 1 = the first one of the month. A month
 * with no fifth Wednesday simply has no date for "5th Wednesday".
 *
 * Dates are LOCAL `YYYY-MM-DD` strings, the same shape `team_availability.date`
 * and `setlist.date` use. Never go through `toISOString()` (UTC shift).
 */

/** The fixed palette. Stored as the id; the hex is for drawing only. */
export const SERVICE_COLORS = [
  { id: 'teal', hex: '#7AA89C' },
  { id: 'blue', hex: '#8FA8D6' },
  { id: 'amber', hex: '#E0A35C' },
  { id: 'purple', hex: '#C79BD6' },
  { id: 'rose', hex: '#E08A9B' },
  { id: 'green', hex: '#8CC084' },
];

export function serviceColor(id) {
  return (SERVICE_COLORS.find(c => c.id === id) || SERVICE_COLORS[0]).hex;
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th'];

export function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "10:00:00" → "10:00" (Postgres `time` comes back with seconds). */
export function shortTime(t) {
  return String(t || '').slice(0, 5);
}

/** "Every Sunday" / "Every 1st Wednesday". */
export function repeatLabel(service) {
  const day = WEEKDAYS[service?.weekday ?? 0];
  return service?.nth ? `Every ${ORDINALS[service.nth]} ${day}` : `Every ${day}`;
}

/** "Every Sunday · 10:00". */
export function whenLabel(service) {
  return `${repeatLabel(service)} · ${shortTime(service?.start_time) || '10:00'}`;
}

function nthOfMonth(date) {
  return Math.floor((date.getDate() - 1) / 7) + 1;
}

/**
 * The service's dates from `from` (inclusive) for `weeks` weeks.
 * @returns {string[]} local YYYY-MM-DD, ascending
 */
export function serviceDates(service, { from = new Date(), weeks = 8 } = {}) {
  if (!service) return [];
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const shift = ((service.weekday ?? 0) - start.getDay() + 7) % 7;
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + shift);
  const out = [];
  for (let i = 0; i < weeks; i++) {
    if (!service.nth || nthOfMonth(d) === service.nth) out.push(toLocalDateStr(d));
    d.setDate(d.getDate() + 7);
  }
  return out;
}

/** Service ids a user is on. */
export function serviceIdsFor(userId, serviceMembers) {
  return new Set((serviceMembers || []).filter(m => m.user_id === userId).map(m => m.service_id));
}

/** User ids on a service. */
export function memberIdsOf(serviceId, serviceMembers) {
  return (serviceMembers || []).filter(m => m.service_id === serviceId).map(m => m.user_id);
}

/**
 * Every upcoming (date, service) pair a user is asked about — the dates of
 * the services they are on, within each service's ask-ahead window.
 * @returns {{ date: string, service: object }[]} sorted by date, then start time
 */
export function myServiceDates(userId, services, serviceMembers, { from = new Date() } = {}) {
  const mine = serviceIdsFor(userId, serviceMembers);
  const out = [];
  for (const s of services || []) {
    if (!mine.has(s.id)) continue;
    for (const date of serviceDates(s, { from, weeks: s.ask_weeks || 3 })) out.push({ date, service: s });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date)
    || shortTime(a.service.start_time).localeCompare(shortTime(b.service.start_time)));
}

/**
 * The setlist that is this service on this date, if one exists. A setlist
 * names its service by text (`setlist.service`), so match on the name.
 */
export function setlistFor(service, date, setlists) {
  const name = (service?.name || '').trim().toLowerCase();
  return (setlists || []).find(sl => sl.date === date && (sl.service || '').trim().toLowerCase() === name) || null;
}

/**
 * What a date means for me right now.
 * @returns {{ kind: 'asked'|'playing'|'declined'|'open', setlist: object|null, schedule: object|null }}
 */
export function dateState({ date, service, setlists, schedules, setlistMap, userId }) {
  const setlist = setlistFor(service, date, setlists);
  if (!setlist) return { kind: 'open', setlist: null, schedule: null };
  const rowId = setlistMap?.[setlist.id];
  const schedule = rowId ? (schedules || []).find(s => s.user_id === userId && s.setlist_id === rowId) : null;
  if (!schedule) return { kind: 'open', setlist, schedule: null };
  if (schedule.availability === 'pending') return { kind: 'asked', setlist, schedule };
  if (schedule.availability === 'unavailable') return { kind: 'declined', setlist, schedule };
  return { kind: 'playing', setlist, schedule };
}

/** The short label a day card has room for: "Sunday Morning" → "Morning", "Youth Night" → "Youth". */
export function shortServiceName(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return words[0] || '';
  return WEEKDAYS.some(d => d.toLowerCase() === words[0].toLowerCase()) ? words.slice(1).join(' ') : words[0];
}

/** Songs in a setlist (breaks are not songs). */
export function songCountOf(setlist) {
  return (setlist?.items || []).filter(it => it.type !== 'break').length;
}
