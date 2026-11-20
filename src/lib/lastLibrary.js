// The group (church or band) the app last had open on this device. Read once
// at launch so a church member opens straight into the church, with its songs
// from the device. App still checks it against the user's memberships once
// those are known. Null = none remembered.
const KEY = 'setlists:lastLibrary';

export function readLastLibrary() {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return v && typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
}

export function writeLastLibrary(id) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (!id) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, id);
  } catch { /* private mode: launch falls back to waiting for memberships */ }
}

// Hold the loading screen (for a few seconds at most) until the group the app
// opens into is fully known, so nothing is drawn and then redrawn:
// - signed in, nothing open yet: wait for the memberships, and while the user
//   has some, for one of them to open (no empty Home in between);
// - a church: wait until it is the active team (its name, and my role in it,
//   so a leader never flashes the member Home) and its schedules have
//   answered (so Home does not say "Nothing planned" and then fill in);
// - the library itself (songs, setlists from the device) has loaded.
export function waitingForHomeSpace({
  userId, authLoading, teamsLoaded, activeLibrary, timedOut,
  loaded = true, teamId = null, schedulesLoaded = true, teamCount = 0,
}) {
  if (authLoading) return !timedOut;
  if (!userId) return false;
  if (!loaded) return true;
  if (timedOut) return false;
  if (!activeLibrary) return !teamsLoaded || teamCount > 0;
  return !teamsLoaded || teamId !== activeLibrary || !schedulesLoaded;
}
