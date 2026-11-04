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

// Hold the loading screen (for a few seconds at most) until the space the app
// opens into is fully known, so nothing is drawn and then redrawn:
// - signed in, memberships loading, nothing remembered: Personal is only a
//   placeholder, so wait rather than draw it and jump to the church;
// - a church: wait until it is the active team (its name, and my role in it,
//   so a leader never flashes the member Home) and its schedules have
//   answered (so Home does not say "Nothing planned" and then fill in);
// - the library itself (songs, setlists from the device) has loaded.
export function waitingForHomeSpace({
  userId, authLoading, teamsLoaded, activeLibrary, timedOut,
  loaded = true, teamId = null, schedulesLoaded = true,
}) {
  if (authLoading) return !timedOut;
  if (!userId) return false;
  if (!loaded) return true;
  if (timedOut) return false;
  if (activeLibrary === 'personal') return !teamsLoaded;
  return !teamsLoaded || teamId !== activeLibrary || !schedulesLoaded;
}
