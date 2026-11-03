// The space (library) the app last had open on this device: 'personal' or a
// church's id. Read once at launch so a church member opens straight into the
// church, with its songs from the device, instead of Personal first. App
// still checks it against the user's memberships once those are known.
const KEY = 'setlists:lastLibrary';

export function readLastLibrary() {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return v && typeof v === 'string' ? v : 'personal';
  } catch {
    return 'personal';
  }
}

export function writeLastLibrary(id) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (!id || id === 'personal') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, id);
  } catch { /* private mode: launch falls back to waiting for memberships */ }
}

// While a signed-in user's memberships are still loading and nothing was
// remembered, Personal is only a placeholder: hold the loading screen (for a
// few seconds at most) rather than draw it and then jump to the church.
export function waitingForHomeSpace({ userId, authLoading, teamsLoaded, activeLibrary, timedOut }) {
  if (timedOut || activeLibrary !== 'personal') return false;
  if (authLoading) return true;
  return !!userId && !teamsLoaded;
}
