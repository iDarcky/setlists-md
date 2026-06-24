// Per-item write-amplification breaker (defense-in-depth).
//
// The existing mass-update breaker catches a serialization regression that
// makes MANY rows dirty at once. It cannot catch a SINGLE item that re-uploads
// in a tight loop (the "edited just now" spam we saw on one song) — that never
// crosses the ">50% of the library" threshold.
//
// This guard tracks how often each item is actually pushed and, if one item is
// pushed more than `limit` times within `windowMs`, trips: it blocks further
// pushes of that item for `cooldownMs` and reports it, so a runaway loop can't
// spam the activity feed or burn writes. With canonical change-detection in
// place an unchanged item never reaches a push at all, so this should
// effectively never fire in normal use — it's a backstop.
export function createAmplificationGuard({ limit = 12, windowMs = 60000, cooldownMs = 120000 } = {}) {
  const hits = new Map();    // id -> timestamps[] within the window
  const trippedUntil = new Map(); // id -> timestamp the cooldown ends

  return {
    // Call right before actually pushing a changed item. Returns true if the
    // push should be SKIPPED because amplification is suspected.
    shouldBlock(id) {
      const now = Date.now();
      const until = trippedUntil.get(id);
      if (until != null) {
        if (now < until) return true;
        trippedUntil.delete(id);
        hits.delete(id);
      }
      const recent = (hits.get(id) || []).filter(t => now - t < windowMs);
      recent.push(now);
      hits.set(id, recent);
      if (recent.length > limit) {
        trippedUntil.set(id, now + cooldownMs);
        return true;
      }
      return false;
    },
  };
}
