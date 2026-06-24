import { get, set, del, getMany, setMany, delMany, keys } from 'idb-keyval';

const OLD_PREFIX = 'Setlists MD:';
const NEW_PREFIX = 'setlists-md:';

const SONGS_KEY = (lib) => `${NEW_PREFIX}songs:${lib}`; // legacy whole-library blob
const SONG_KEY = (lib, id) => `${NEW_PREFIX}song:${lib}:${id}`; // per-song record
const SONG_IDX_KEY = (lib) => `${NEW_PREFIX}songidx:${lib}`; // ordered list of song ids
const SETLISTS_KEY = (lib) => `${NEW_PREFIX}setlists:${lib}`;
const SETTINGS_KEY = `${NEW_PREFIX}settings`; // Settings remain global
const SYNC_KEY = (lib) => `${NEW_PREFIX}sync:${lib}`;
const TOMBSTONES_KEY = (lib) => `${NEW_PREFIX}tombstones:${lib}`;
const CONFLICTS_KEY = (lib) => `${NEW_PREFIX}conflicts:${lib}`; // unresolved sync conflicts awaiting user choice
const TRASH_KEY = (lib) => `${NEW_PREFIX}trash:${lib}`; // soft-deleted songs (30-day recovery)

/**
 * Migrates data from legacy 'Setlists MD:' keys to new 'setlists-md:' keys.
 * This is a one-time operation per key.
 */
async function migrateLegacyKeys() {
  const keys = ['songs', 'setlists', 'settings', 'sync', 'tombstones'];
  for (const k of keys) {
    const oldKey = `${OLD_PREFIX}${k}`;
    const newKey = `${NEW_PREFIX}${k}`;
    try {
      const oldData = await get(oldKey);
      if (oldData !== undefined) {
        const newData = await get(k === 'settings' ? newKey : `${newKey}:personal`);
        // Only migrate if new key is empty
        if (newData === undefined) {
          await set(k === 'settings' ? newKey : `${newKey}:personal`, oldData);
          await del(oldKey);
          console.log(`[storage] Migrated legacy key: ${oldKey} -> ${newKey}`);
        }
      }
    } catch (err) {
      console.error(`[storage] Failed to migrate legacy key ${oldKey}:`, err);
    }
  }
}

// Trigger migration on module load
migrateLegacyKeys();

const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function pruneTombstones(t) {
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  return {
    songs: (t?.songs || []).filter(e => e.deletedAt > cutoff),
    setlists: (t?.setlists || []).filter(e => e.deletedAt > cutoff),
  };
}

// Storage shape version — bumped when the persisted song shape changes.
// v2 introduced song.arrangements[] (each song wraps its key/tempo/sections
// inside one or more arrangements). Loaders accept v1 (bare arrays) and
// migrate on the fly via migrateSongShape().
export const SCHEMA_VERSION = 2;

function genArrangementId() {
  return 'arr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Idempotently upgrades a persisted song record to the v2 shape with a nested
// arrangements[] array. Pre-v2 songs (which have flat key/tempo/sections at
// the song root) are wrapped in a single "Main Arrangement". Post-v2 songs
// are returned unchanged.
export function migrateSongShape(s) {
  if (!s || typeof s !== 'object') return s;
  if (Array.isArray(s.arrangements) && s.arrangements.length > 0) {
    // Already migrated. Make sure defaultArrangementId resolves; fall back to
    // first if not.
    const hasDefault = s.defaultArrangementId &&
      s.arrangements.some(a => a && a.id === s.defaultArrangementId);
    return hasDefault ? s : { ...s, defaultArrangementId: s.arrangements[0].id };
  }
  const arrId = genArrangementId();
  return {
    id: s.id,
    title: typeof s.title === 'string' ? s.title : 'Untitled',
    artist: typeof s.artist === 'string' ? s.artist : 'Unknown',
    ccli: s.ccli || '',
    tags: Array.isArray(s.tags) ? s.tags : [],
    spotify: s.spotify || '',
    youtube: s.youtube || '',
    keyHistory: (s.keyHistory && typeof s.keyHistory === 'object') ? s.keyHistory : {},
    defaultArrangementId: arrId,
    arrangements: [{
      id: arrId,
      name: 'Main Arrangement',
      key: s.key || 'C',
      tempo: s.tempo || 120,
      time: s.time || '4/4',
      capo: s.capo || 0,
      notes: s.notes || '',
      structure: Array.isArray(s.structure) ? s.structure : [],
      sections: Array.isArray(s.sections) ? s.sections : [],
      updatedAt: s.updatedAt || Date.now(),
    }],
    updatedAt: s.updatedAt || Date.now(),
  };
}

// Lightweight runtime schema check. Validates that a persisted payload looks
// like the shape we expect; returns only the entries that pass. This guards
// against corrupted IndexedDB payloads crashing the parser downstream.
export function isValidSong(s) {
  if (!s || typeof s !== 'object') return false;
  if (typeof s.id !== 'string' || !s.id) return false;
  if (typeof s.title !== 'string') return false;
  if (typeof s.artist !== 'string') return false;
  if (!Array.isArray(s.arrangements) || s.arrangements.length === 0) return false;
  for (const a of s.arrangements) {
    if (!a || typeof a !== 'object') return false;
    if (typeof a.id !== 'string' || !a.id) return false;
    if (typeof a.name !== 'string') return false;
    if (!Array.isArray(a.sections)) return false;
  }
  return true;
}

export function isValidSetlist(sl) {
  if (!sl || typeof sl !== 'object') return false;
  if (typeof sl.id !== 'string' || !sl.id) return false;
  if (typeof sl.name !== 'string') return false;
  if (!Array.isArray(sl.items)) return false;
  return true;
}

function sanitizeSongs(raw) {
  // Accept both bare arrays (v1 storage) and { schemaVersion, songs } (v2+).
  let arr = raw;
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray(raw.songs)) {
    arr = raw.songs;
  }
  if (!Array.isArray(arr)) return [];
  const out = [];
  let dropped = 0;
  for (const s of arr) {
    const migrated = migrateSongShape(s);
    if (isValidSong(migrated)) out.push(migrated);
    else dropped++;
  }
  if (dropped > 0 && typeof console !== 'undefined') {
    console.warn(`[storage] Dropped ${dropped} malformed song record(s) during load.`);
  }
  return out;
}

function sanitizeSetlists(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  let dropped = 0;
  for (const sl of raw) {
    if (isValidSetlist(sl)) out.push(sl);
    else dropped++;
  }
  if (dropped > 0 && typeof console !== 'undefined') {
    console.warn(`[storage] Dropped ${dropped} malformed setlist record(s) during load.`);
  }
  return out;
}

// --- Per-song persistence ---------------------------------------------------
// Songs are stored one IndexedDB entry per song (`song:<lib>:<id>`) plus an
// ordered index of ids (`songidx:<lib>`), so editing a single song rewrites
// only that song's entry instead of the whole library blob. `saveSongs` keeps
// its whole-array signature; it diffs against a per-library cache of the last
// persisted object references (React replaces only the edited song's object,
// so reference identity is a free, exact "changed?" signal) and writes just
// the songs whose reference changed, deletes removed ids, and rewrites the
// index only when the id sequence changes.

// lib -> Map<id, songRef> of what we last persisted.
const songRefCache = new Map();
// lib -> ids[] of the last persisted index, for cheap sequence comparison.
const songIdsCache = new Map();

function primeSongCaches(libraryId, songs) {
  const refs = new Map();
  for (const s of songs) if (s && typeof s.id === 'string') refs.set(s.id, s);
  songRefCache.set(libraryId, refs);
  songIdsCache.set(libraryId, songs.map(s => s.id));
}

function idsEqual(a, b) {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export async function loadSongs(libraryId = 'personal') {
  try {
    const idx = await get(SONG_IDX_KEY(libraryId));
    if (idx && Array.isArray(idx.ids)) {
      const raw = idx.ids.length
        ? await getMany(idx.ids.map(id => SONG_KEY(libraryId, id)))
        : [];
      const songs = sanitizeSongs(raw);
      primeSongCaches(libraryId, songs);
      return songs;
    }
    // No per-song index yet: migrate the legacy whole-library blob in place.
    const blob = await get(SONGS_KEY(libraryId));
    if (blob !== undefined) {
      const songs = sanitizeSongs(blob);
      await writeAllSongs(libraryId, songs);
      await del(SONGS_KEY(libraryId));
      return songs;
    }
    primeSongCaches(libraryId, []);
    return [];
  } catch {
    return [];
  }
}

// Full rewrite of a library's songs (used for migration + first save). Resets
// the caches to match what we just wrote.
async function writeAllSongs(libraryId, songs) {
  const ids = songs.map(s => s.id);
  await setMany(songs.map(s => [SONG_KEY(libraryId, s.id), s]));
  await set(SONG_IDX_KEY(libraryId), { schemaVersion: SCHEMA_VERSION, ids });
  primeSongCaches(libraryId, songs);
}

export async function saveSongs(songs, libraryId = 'personal') {
  const list = Array.isArray(songs) ? songs.filter(s => s && typeof s.id === 'string') : [];
  const prev = songRefCache.get(libraryId) || new Map();
  const nextRefs = new Map();
  const toSet = [];
  for (const s of list) {
    nextRefs.set(s.id, s);
    if (prev.get(s.id) !== s) toSet.push([SONG_KEY(libraryId, s.id), s]);
  }
  const toDel = [];
  for (const id of prev.keys()) if (!nextRefs.has(id)) toDel.push(SONG_KEY(libraryId, id));
  const ids = list.map(s => s.id);
  const idxChanged = !idsEqual(songIdsCache.get(libraryId), ids);

  // Update caches synchronously (before awaiting) so overlapping fire-and-forget
  // saves diff against the latest intended state, not a stale snapshot.
  songRefCache.set(libraryId, nextRefs);
  songIdsCache.set(libraryId, ids);

  const ops = [];
  if (toSet.length) ops.push(setMany(toSet));
  if (toDel.length) ops.push(delMany(toDel));
  if (idxChanged) ops.push(set(SONG_IDX_KEY(libraryId), { schemaVersion: SCHEMA_VERSION, ids }));
  await Promise.all(ops);
}

export async function loadSetlists(libraryId = 'personal') {
  try {
    const raw = (await get(SETLISTS_KEY(libraryId))) || [];
    return sanitizeSetlists(raw);
  } catch {
    return [];
  }
}

export async function saveSetlists(setlists, libraryId = 'personal') {
  await set(SETLISTS_KEY(libraryId), setlists);
}

export const DEFAULT_SETTINGS = {
  theme: 'midnight',
  lastChangelogVersion: null,
  userName: '',
  defaultColumns: 'auto',
  defaultFontSize: 'M',
  pedalNext: 'ArrowRight',
  pedalPrev: 'ArrowLeft',
  onboardingComplete: false,
  showInlineNotes: true,
  inlineNoteStyle: 'dashes',
  displayRole: 'leader',
  duplicateSections: 'full',
  chartLayout: 'columns',
  firstDayOfWeek: 'sunday',
  clockFormat: '12h',
  helpPageSeen: false,
  notifications: [
    {
      id: 'welcome-help',
      title: 'Welcome to setlists.md!',
      message: 'Learn how to use the app — tap to read the getting started guide.',
      read: false,
      action: { type: 'navigate', view: 'help' },
      createdAt: Date.now(),
    },
  ],
};

export async function loadSettings() {
  try {
    const s = await get(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...s };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings) {
  await set(SETTINGS_KEY, settings);
}

export async function loadSyncState(libraryId = 'personal') {
  try {
    return (await get(SYNC_KEY(libraryId))) || null;
  } catch {
    return null;
  }
}

export async function saveSyncState(state, libraryId = 'personal') {
  await set(SYNC_KEY(libraryId), state);
}

// Returns null if the API is unavailable, otherwise { usage, quota, ratio }.
// `ratio` is a number between 0 and 1 indicating how full storage is.
export async function getStorageEstimate() {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    if (!quota) return { usage, quota, ratio: 0 };
    return { usage, quota, ratio: usage / quota };
  } catch {
    return null;
  }
}

export async function loadTombstones(libraryId = 'personal') {
  try {
    return pruneTombstones(await get(TOMBSTONES_KEY(libraryId)));
  } catch {
    return { songs: [], setlists: [] };
  }
}

export async function saveTombstones(tombstones, libraryId = 'personal') {
  await set(TOMBSTONES_KEY(libraryId), pruneTombstones(tombstones));
}

// ----- Sync conflicts (awaiting the user's keep-mine/keep-cloud/keep-both
// choice) -----. Persisted so an unresolved conflict — and the user's only
// surviving copy of their divergent local edit — survives a reload.
export async function loadConflicts(libraryId = 'personal') {
  try {
    const list = await get(CONFLICTS_KEY(libraryId));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function saveConflicts(list, libraryId = 'personal') {
  await set(CONFLICTS_KEY(libraryId), Array.isArray(list) ? list : []);
}

// ----- Trash (soft-deleted songs, recoverable for 30 days) -----
// Each entry is { song, deletedAt }. Same TTL as tombstones; entries older
// than 30 days are pruned on read/write so the bin self-empties.
function pruneTrash(list) {
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  return (Array.isArray(list) ? list : []).filter(e => e && e.song && e.deletedAt > cutoff);
}

export async function loadTrash(libraryId = 'personal') {
  try {
    return pruneTrash(await get(TRASH_KEY(libraryId)));
  } catch {
    return [];
  }
}

export async function saveTrash(list, libraryId = 'personal') {
  await set(TRASH_KEY(libraryId), pruneTrash(list));
}

export async function clearAll(libraryId = 'personal') {
  // Per-song entries: enumerate keys under the library's song prefix.
  try {
    const prefix = `${NEW_PREFIX}song:${libraryId}:`;
    const songKeys = (await keys()).filter(k => typeof k === 'string' && k.startsWith(prefix));
    if (songKeys.length) await delMany(songKeys);
  } catch { /* best-effort */ }
  await del(SONG_IDX_KEY(libraryId));
  await del(SONGS_KEY(libraryId)); // legacy blob, if any lingers
  await del(SETLISTS_KEY(libraryId));
  await del(SETTINGS_KEY); // Global
  await del(SYNC_KEY(libraryId));
  await del(TOMBSTONES_KEY(libraryId));
  await del(TRASH_KEY(libraryId));
  await del(CONFLICTS_KEY(libraryId));
  songRefCache.delete(libraryId);
  songIdsCache.delete(libraryId);
}

