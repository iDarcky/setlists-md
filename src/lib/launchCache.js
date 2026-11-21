// What this device last heard from the server about the user's churches:
// the memberships (with my role), each roster, each church's schedules. Read
// at launch so a refresh draws the church at once instead of waiting on the
// network; the server's answer then replaces it. Per user, so a shared iPad
// never shows one person's church to another.
const PREFIX = 'setlists:launch:';
const MAX_SCHEDULES = 3000;

function read(userId) {
  if (!userId) return null;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PREFIX + userId) : null;
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

function write(userId, patch) {
  if (!userId) return;
  try {
    if (typeof localStorage === 'undefined') return;
    const next = { ...(read(userId) || {}), ...patch };
    localStorage.setItem(PREFIX + userId, JSON.stringify(next));
  } catch { /* full or private mode: launch just waits for the network */ }
}

export function cachedTeams(userId) {
  const v = read(userId)?.teams;
  return Array.isArray(v) ? v : null;
}

export function cacheTeams(userId, teams) {
  write(userId, { teams: teams || [] });
}

export function cachedMembers(userId, teamId) {
  const v = read(userId)?.members?.[teamId];
  return Array.isArray(v) ? v : null;
}

export function cacheMembers(userId, teamId, members) {
  if (!teamId) return;
  const all = read(userId)?.members || {};
  write(userId, { members: { ...all, [teamId]: members || [] } });
}

export function cachedSchedules(userId, teamId) {
  const v = read(userId)?.schedules?.[teamId];
  return Array.isArray(v) ? v : null;
}

export function cacheSchedules(userId, teamId, rows) {
  if (!teamId) return;
  const all = read(userId)?.schedules || {};
  write(userId, { schedules: { ...all, [teamId]: (rows || []).slice(0, MAX_SCHEDULES) } });
}

// Home's Recent activity: the newest rows only, so a launch paints the feed
// with everything else instead of an empty card that fills in later.
const MAX_ACTIVITY = 60;

export function cachedActivity(userId, teamId) {
  const v = read(userId)?.activity?.[teamId];
  return Array.isArray(v) ? v : null;
}

export function cacheActivity(userId, teamId, rows) {
  if (!teamId) return;
  const all = read(userId)?.activity || {};
  write(userId, { activity: { ...all, [teamId]: (rows || []).slice(0, MAX_ACTIVITY) } });
}

/** The signed-in user this device remembers, before auth has settled: read
 *  from Supabase's own session key. Null when nobody is signed in. */
export function rememberedUserId(storage = globalThis.localStorage) {
  try {
    for (let i = 0; i < (storage?.length || 0); i++) {
      const key = storage.key(i);
      if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
      const id = JSON.parse(storage.getItem(key) || 'null')?.user?.id;
      if (id) return id;
    }
  } catch { /* private mode or a bad value */ }
  return null;
}

/** Will this launch open a team? Only when the device has seen this user in
 *  one. Otherwise (signed out, or no team yet) the app shape would be a lie:
 *  the welcome or the set-up screens come next. */
export function expectsTeam(userId) {
  const id = userId || rememberedUserId();
  return !!id && (cachedTeams(id)?.length || 0) > 0;
}

export function clearLaunchCache(userId) {
  try { if (userId && typeof localStorage !== 'undefined') localStorage.removeItem(PREFIX + userId); } catch { /* ignore */ }
}
