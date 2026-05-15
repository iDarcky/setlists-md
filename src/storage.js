import { get, set, del } from 'idb-keyval';

const OLD_PREFIX = 'Setlists MD:';
const NEW_PREFIX = 'setlists-md:';

const SONGS_KEY = (lib) => `${NEW_PREFIX}songs:${lib}`;
const SETLISTS_KEY = (lib) => `${NEW_PREFIX}setlists:${lib}`;
const SETTINGS_KEY = `${NEW_PREFIX}settings`; // Settings remain global
const SYNC_KEY = (lib) => `${NEW_PREFIX}sync:${lib}`;
const TOMBSTONES_KEY = (lib) => `${NEW_PREFIX}tombstones:${lib}`;

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

export async function loadSongs(libraryId = 'personal') {
  try {
    const raw = (await get(SONGS_KEY(libraryId))) || [];
    return sanitizeSongs(raw);
  } catch {
    return [];
  }
}

export async function saveSongs(songs, libraryId = 'personal') {
  // Persist with a schemaVersion envelope so future loaders can detect/migrate.
  await set(SONGS_KEY(libraryId), { schemaVersion: SCHEMA_VERSION, songs });
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

export async function clearAll(libraryId = 'personal') {
  await del(SONGS_KEY(libraryId));
  await del(SETLISTS_KEY(libraryId));
  await del(SETTINGS_KEY); // Global
  await del(SYNC_KEY(libraryId));
  await del(TOMBSTONES_KEY(libraryId));
}

