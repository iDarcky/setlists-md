// The engine behind every "how has this song actually been played?" counter.
//
// `keyHistory.js` and `tempoHistory.js` are both this file with a different
// answer to one question — *what did this performance sound like?* — so the
// walk over past setlists, the reference-preserving apply, and the
// save-time diff live here once. Adding a third dimension later (time
// signature, capo) is a `valueOf` function, not another copy of this file.
//
// Storage shape, in both cases: a flat `{ value: count }` map at the SONG
// level (never per-arrangement), so a song with three arrangements still has
// one comparable history. Neither map is serialised into the `.md` — these
// are device-derived counts, not user content.

export function isPastSetlist(setlist, today = new Date()) {
  if (!setlist?.date) return false;
  // setlist.date is YYYY-MM-DD. Compare as strings to avoid TZ skew.
  const d = today instanceof Date ? today : new Date(today);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${day}`;
  return setlist.date <= todayStr;
}

// songId → song, first occurrence wins (matching the `songs.find` this
// replaced, which returned the first match for a duplicated id).
function indexById(songs) {
  const map = new Map();
  for (const s of songs || []) {
    if (s && s.id != null && !map.has(s.id)) map.set(s.id, s);
  }
  return map;
}

// Call `visit(song, item)` once per playable item of every past-dated setlist.
// Future and undated setlists are not performances and would otherwise inflate
// every count in the app.
export function scanPastPerformances(songs, setlists, today, visit) {
  const byId = indexById(songs);
  for (const sl of setlists || []) {
    if (!isPastSetlist(sl, today)) continue;
    for (const it of sl.items || []) {
      if (it?.type === 'break') continue;
      const song = byId.get(it?.songId);
      if (!song) continue;
      visit(song, it);
    }
  }
}

// Recompute every song's history from scratch. O(setlists × items). Pure —
// returns a new map keyed by songId rather than mutating songs.
export function computeHistories(songs, setlists, valueOf, today = new Date()) {
  const out = {};
  scanPastPerformances(songs, setlists, today, (song, item) => {
    const v = valueOf(item, song);
    if (v == null || v === '') return;
    out[song.id] ||= {};
    out[song.id][v] = (out[song.id][v] || 0) + 1;
  });
  return out;
}

// Shallow { value: count } equality — histories are flat maps of small ints.
function historiesEqual(a, b) {
  const ka = Object.keys(a || {});
  const kb = Object.keys(b || {});
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}

// Reference-preserving: a song whose history is already up to date keeps its
// object identity. Downstream, reference identity is the "did it change?"
// signal for per-song IndexedDB writes, the sync engines' hash caches, and
// mid-sync edit detection (sync/adopt.js) — returning fresh objects for
// unchanged songs would rewrite the whole library on every launch and make
// every song look locally edited to a sync that was in flight.
export function applyHistories(songs, histories, field) {
  let changed = false;
  const next = songs.map(s => {
    const h = histories[s.id] || {};
    if (historiesEqual(s[field], h)) return s;
    changed = true;
    return { ...s, [field]: h };
  });
  return changed ? next : songs;
}

// Diff two snapshots of a setlist and adjust per-song histories to reflect the
// change, so a save does not have to recompute the whole library. Both
// snapshots may be null (creation / deletion).
export function incrementForDiff(songs, prev, next, valueOf, field, today = new Date()) {
  const wasPast = prev && isPastSetlist(prev, today);
  const isPast = next && isPastSetlist(next, today);
  if (!wasPast && !isPast) return songs;

  const byId = indexById(songs);
  const tally = {}; // songId → { value: deltaCount }
  const apply = (sl, sign) => {
    if (!sl) return;
    for (const it of sl.items || []) {
      if (it?.type === 'break') continue;
      const song = byId.get(it?.songId);
      if (!song) continue;
      const v = valueOf(it, song);
      if (v == null || v === '') continue;
      tally[song.id] ||= {};
      tally[song.id][v] = (tally[song.id][v] || 0) + sign;
    }
  };
  if (wasPast) apply(prev, -1);
  if (isPast) apply(next, +1);

  if (Object.keys(tally).length === 0) return songs;

  return songs.map(s => {
    const delta = tally[s.id];
    if (!delta) return s;
    const merged = { ...(s[field] || {}) };
    for (const [v, d] of Object.entries(delta)) {
      const n = (merged[v] || 0) + d;
      if (n <= 0) delete merged[v];
      else merged[v] = n;
    }
    return { ...s, [field]: merged };
  });
}

// The most-played entry, as its raw string key. Ties break on insertion order,
// which for a recomputed history is the order the values were first played.
export function topEntry(history) {
  if (!history || typeof history !== 'object') return null;
  const entries = Object.entries(history);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

export function totalCount(history) {
  if (!history || typeof history !== 'object') return 0;
  let n = 0;
  for (const v of Object.values(history)) n += v;
  return n;
}

// Sorted [value, count] pairs, most played first — what every display site
// wants and each one was re-deriving.
export function rankedEntries(history) {
  return Object.entries(history || {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
}
