// Setlist time helpers — when a set starts, when it ends, and whether it's still
// "upcoming". A set stays upcoming/on the dashboard until it actually *ends*:
// its explicit end time if set, otherwise a short grace window after it starts.
// This stops a service from dropping into "Past" the moment it begins (so it's
// still findable mid-set), while old sets still age out.

// 3h, the same run lib/openingMode.js gives a service with no end time, so a
// setlist stays "Next up" for as long as it opens live (owner, 2026-11-15:
// Next up vanished mid-service and they had to dig it out of Past).
export const SETLIST_GRACE_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Start datetime (date + time) in ms. NaN when there's no date.
export function setlistStartMs(sl) {
  return new Date((sl?.date || '') + 'T' + (sl?.time || '00:00') + ':00').getTime();
}

// End datetime in ms: the explicit `endTime` (date + endTime) when it's after the
// start, otherwise start + grace. A setlist with a date but no time lasts the
// whole day: it used to "start" at midnight and be Past by 1 AM on the day.
export function setlistEndMs(sl, graceMs = SETLIST_GRACE_MS) {
  const start = setlistStartMs(sl);
  if (!sl?.time && !Number.isNaN(start)) return start + DAY_MS;
  if (sl?.endTime) {
    const end = new Date((sl.date || '') + 'T' + sl.endTime + ':00').getTime();
    if (!Number.isNaN(end) && end > start) return end;
  }
  return Number.isNaN(start) ? NaN : start + graceMs;
}

export function isSetlistUpcoming(sl, nowMs = Date.now(), graceMs = SETLIST_GRACE_MS) {
  const end = setlistEndMs(sl, graceMs);
  return !Number.isNaN(end) && end > nowMs;
}
