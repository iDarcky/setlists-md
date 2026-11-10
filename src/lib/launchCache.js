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

export function clearLaunchCache(userId) {
  try { if (userId && typeof localStorage !== 'undefined') localStorage.removeItem(PREFIX + userId); } catch { /* ignore */ }
}
