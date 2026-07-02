// Cross-context sync mutex.
//
// A sync pass is a read-modify-write over the library's persisted sync state
// (manifests + pending-push flag in IndexedDB). Each engine instance guards
// itself with a local `syncing` flag, but that flag can't see:
//   * a second tab of the installed PWA / browser running its own engine,
//   * the temporary engine `handleMove/CopySongToLibrary` spins up for the
//     target library while that library's own engine may be active elsewhere.
// Two concurrent passes interleave their manifest read→write and the loser's
// baselines are silently overwritten. A stale baseline is exactly what turns
// the next sync into phantom "changed" items — the raw material of the
// mass-conflict storms.
//
// The Web Locks API is the platform primitive for this: held locks are scoped
// per-origin across tabs/workers and auto-release if the holding context dies
// (unlike any storage-flag scheme, which would wedge after a crash). Where the
// API is missing (very old WebViews, non-browser test environments) we fall
// back to running unguarded — no worse than before.

export function withSyncLock(libraryId, fn) {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(`setlists-md:sync:${libraryId}`, fn);
  }
  return fn();
}
