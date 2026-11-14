/**
 * Date / time formatting helpers shared across the app.
 *
 * The app keeps two display preferences in user settings:
 *   - `clockFormat`     — '12h' (default) or '24h'
 *   - `firstDayOfWeek`  — 'sunday' (default) or 'monday'
 *
 * Centralising these here keeps every consumer in lockstep so a card on the
 * dashboard, the schedule grid, the setlist overview and the PDF export all
 * agree on what "8 PM" means.
 */

/**
 * A shared Intl.DateTimeFormat per (locale, options). `toLocaleDateString`
 * and `toLocaleTimeString` with options build a fresh formatter on every
 * call, which is slow enough to show on a list of hundreds of rows. Same
 * output, built once.
 */
const formatters = new Map();
export function dateFormatter(locale, opts) {
  const key = `${locale}|${JSON.stringify(opts)}`;
  let f = formatters.get(key);
  if (!f) { f = new Intl.DateTimeFormat(locale, opts); formatters.set(key, f); }
  return f;
}

const CLOCK_24 = { hour: '2-digit', minute: '2-digit', hour12: false };
const CLOCK_12 = { hour: 'numeric', minute: 'numeric', hour12: true };

/** Format a stored 'HH:MM' time string for display. */
export function formatClockTime(timeStr, format = '12h') {
  if (!timeStr) return '';
  return dateFormatter('en-US', format === '24h' ? CLOCK_24 : CLOCK_12).format(new Date(`1970-01-01T${timeStr}`));
}

/**
 * Returns the YYYY-MM-DD string of the next Sunday after `from`. If `from`
 * itself falls on a Sunday, returns the Sunday seven days later — "next"
 * means "after today", which is the intuition we want for new setlists.
 */
export function nextSundayDateStr(from = new Date()) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const today = d.getDay(); // 0 = Sun, 1 = Mon, ...
  const daysAhead = today === 0 ? 7 : 7 - today;
  d.setDate(d.getDate() + daysAhead);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Three-letter weekday labels in the user's preferred week order. */
export function weekdayLabels(firstDay = 'sunday') {
  if (firstDay === 'monday') {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  }
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
}

/** Index (0..6) the user considers the first day of the week. */
export function firstDayOffset(firstDay = 'sunday') {
  return firstDay === 'monday' ? 1 : 0;
}
