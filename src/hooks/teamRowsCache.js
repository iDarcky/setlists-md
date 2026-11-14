// Last rows each team-scoped hook saw, per team, for the life of the page.
//
// Home, Schedule and the setlist page each mount `useTeamActivity` /
// `useTeamAvailability` fresh on every visit. Starting from `[]` meant every
// tab switch painted the screen WITHOUT the band's activity and availability,
// then painted it again a moment later when the fetch landed: the "widgets
// draw again" the owner saw between Home and Schedule. Seeding from here shows
// the last known rows at once; the fetch still runs and replaces them.
const caches = new Map(); // name -> Map(teamId -> rows)

function bucket(name) {
  let b = caches.get(name);
  if (!b) { b = new Map(); caches.set(name, b); }
  return b;
}

export function readTeamRows(name, teamId) {
  if (!teamId) return undefined;
  return bucket(name).get(teamId);
}

export function writeTeamRows(name, teamId, rows) {
  if (!teamId) return;
  bucket(name).set(teamId, rows);
}

/** Tests only. */
export function clearTeamRows() {
  caches.clear();
}
