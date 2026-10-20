import { serviceDates, shortTime } from '@/lib/services';

// Plain helpers for the services Schedule screens (scheduleBits.jsx holds the
// components; a component file may export only components).

export const ANSWERS = {
  available: { label: 'Yes', icon: '✓', bg: 'var(--ds-green-100)', fg: 'var(--ds-green-900)', ring: 'color-mix(in srgb, var(--ds-green-900) 40%, transparent)' },
  maybe: { label: 'Maybe', icon: '?', bg: 'var(--ds-amber-100)', fg: 'var(--ds-amber-900)', ring: 'color-mix(in srgb, var(--ds-amber-900) 40%, transparent)' },
  unavailable: { label: 'No', icon: '×', bg: 'var(--ds-red-100)', fg: 'var(--ds-red-900)', ring: 'color-mix(in srgb, var(--ds-red-900) 40%, transparent)' },
};
export const NO_ANSWER = { label: 'Answer', bg: 'var(--modes-surface-strong)', fg: 'var(--modes-text-muted)', ring: 'var(--modes-border)' };

export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "Fri 23 Oct". */
export function shortDate(str) {
  const d = parseDate(str);
  return `${DOW[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`;
}

/** "Friday 23 October". */
export function longDate(str) {
  return parseDate(str).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "N to answer" / "All answered", counted per date. */
export function leftLine(entries, statusOf) {
  const left = new Set(entries.filter(e => !statusOf(e.date)).map(e => e.date)).size;
  return left === 0 ? 'All answered' : `${left} to answer`;
}

const WEEKS = 6;

export const planKey = (date, service) => `${date}|${service.id}`;

/** Every (date, service) the plan list shows, in date order. */
export function planRows(services, { weeks = WEEKS } = {}) {
  return services
    .flatMap(service => serviceDates(service, { weeks }).map(date => ({ date, service })))
    .sort((a, b) => a.date.localeCompare(b.date)
      || shortTime(a.service.start_time).localeCompare(shortTime(b.service.start_time)));
}

