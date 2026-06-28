// Setlist time helpers — when a set starts, when it ends, and whether it's still
// "upcoming". A set stays upcoming/on the dashboard until it actually *ends*:
// its explicit end time if set, otherwise a short grace window after it starts.
// This stops a service from dropping into "Past" the moment it begins (so it's
// still findable mid-set), while old sets still age out.

export const SETLIST_GRACE_MS = 60 * 60 * 1000; // 1h after start when no end time

// Start datetime (date + time) in ms. NaN when there's no date.
export function setlistStartMs(sl) {
  return new Date((sl?.date || '') + 'T' + (sl?.time || '00:00') + ':00').getTime();
}

// End datetime in ms: the explicit `endTime` (date + endTime) when it's after the
// start, otherwise start + grace.
export function setlistEndMs(sl, graceMs = SETLIST_GRACE_MS) {
  const start = setlistStartMs(sl);
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
