// Reminder lead-times (minutes before the event), Google-Calendar style. Used
// by the Settings → Notifications editors; the notify-worker keeps its own copy
// of the arithmetic (it's Deno, separate bundle).

export const REMINDER_OPTIONS = [
  { value: 0, label: 'At start time' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 180, label: '3 hours before' },
  { value: 720, label: '12 hours before' },
  { value: 1440, label: '1 day before' },
  { value: 2880, label: '2 days before' },
  { value: 10080, label: '1 week before' },
];

// Default when a user hasn't customised: one reminder, 24h before.
export const DEFAULT_REMINDERS = [1440];

export function reminderLabel(mins) {
  return REMINDER_OPTIONS.find(o => o.value === mins)?.label || `${mins} min before`;
}

// Normalize a stored value into a clean, de-duped, sorted (soonest-lead last)
// list of known offsets. Falsy/invalid → the default.
export function normalizeReminders(list) {
  if (!Array.isArray(list)) return [...DEFAULT_REMINDERS];
  const known = new Set(REMINDER_OPTIONS.map(o => o.value));
  const clean = [...new Set(list.filter(n => known.has(n)))].sort((a, b) => b - a);
  return clean;
}
