// Helpers for the song.arrangements[] data shape introduced in storage v2.
// A song has 1+ arrangements; each arrangement owns its own musical content
// (key, tempo, time, capo, structure, sections, notes). Song-level fields
// (title, artist, ccli, tags, spotify, youtube, keyHistory) are shared.
//
// resolveSongView() returns a flat object that looks like the pre-v2 song
// shape so most consumers (ChartView, PerformanceView, PDF exporters) keep
// working unchanged when their callers wrap the song with this helper.

import { generateId, EXTRA_META_FIELDS } from './parser.js';

const EXTRA_KEYS = EXTRA_META_FIELDS.map(([k]) => k);

function arrangementId() {
  return 'arr_' + generateId();
}

export function getArrangement(song, arrangementId) {
  if (!song || !Array.isArray(song.arrangements) || song.arrangements.length === 0) {
    return null;
  }
  if (arrangementId) {
    const hit = song.arrangements.find(a => a.id === arrangementId);
    if (hit) return hit;
  }
  if (song.defaultArrangementId) {
    const hit = song.arrangements.find(a => a.id === song.defaultArrangementId);
    if (hit) return hit;
  }
  return song.arrangements[0];
}

export function resolveSongView(song, arrangementId) {
  if (!song) return null;
  const arr = getArrangement(song, arrangementId);
  if (!arr) return null;
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    ccli: song.ccli || '',
    tags: song.tags || [],
    spotify: song.spotify || '',
    youtube: song.youtube || '',
    keyHistory: song.keyHistory || {},
    ...Object.fromEntries(EXTRA_KEYS.map(k => [k, song[k] ?? ''])),
    key: arr.key,
    tempo: arr.tempo,
    time: arr.time,
    duration: arr.duration || '',
    capo: arr.capo || 0,
    notes: arr.notes || '',
    structure: arr.structure || [],
    sections: arr.sections || [],
    tabLibrary: arr.tabLibrary || [],
    updatedAt: arr.updatedAt || song.updatedAt,
    _songId: song.id,
    _arrangementId: arr.id,
    _arrangementName: arr.name,
    _arrangementCount: song.arrangements.length,
    _allArrangements: song.arrangements,
    _defaultArrangementId: song.defaultArrangementId,
  };
}

export function withArrangement(song, arrangementId, mutator) {
  if (!song || !Array.isArray(song.arrangements)) return song;
  const arrangements = song.arrangements.map(a => {
    if (a.id !== arrangementId) return a;
    const next = mutator({ ...a }) || a;
    return { ...next, id: a.id, updatedAt: Date.now() };
  });
  return { ...song, arrangements, updatedAt: Date.now() };
}

export function addArrangement(song, name, base) {
  const id = arrangementId();
  const seed = base || (song.arrangements && song.arrangements.find(a => a.id === song.defaultArrangementId)) || (song.arrangements && song.arrangements[0]);
  // A new arrangement starts as a full copy of its seed (the main arrangement
  // by default) — same lyrics, structure and chords — so the leader tweaks a
  // duplicate rather than rebuilding the song from an empty shell. sections and
  // structure are deep-cloned so edits don't mutate the seed.
  const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const arrangement = {
    id,
    name: name || `Arrangement ${(song.arrangements?.length || 0) + 1}`,
    key: seed?.key || 'C',
    tempo: seed?.tempo ?? null,
    time: seed?.time || '',
    duration: seed?.duration || '',
    capo: seed?.capo || 0,
    notes: seed?.notes || '',
    structure: Array.isArray(seed?.structure) ? clone(seed.structure) : [],
    sections: Array.isArray(seed?.sections) ? clone(seed.sections) : [],
    tabLibrary: Array.isArray(seed?.tabLibrary) ? clone(seed.tabLibrary) : [],
    updatedAt: Date.now(),
  };
  const next = {
    ...song,
    arrangements: [...(song.arrangements || []), arrangement],
    updatedAt: Date.now(),
  };
  return { song: next, arrangementId: id };
}

export function deleteArrangement(song, arrangementId) {
  if (!song || !Array.isArray(song.arrangements)) return song;
  if (song.arrangements.length <= 1) {
    throw new Error('Cannot delete the only arrangement of a song.');
  }
  const arrangements = song.arrangements.filter(a => a.id !== arrangementId);
  let defaultArrangementId = song.defaultArrangementId;
  if (defaultArrangementId === arrangementId) {
    defaultArrangementId = arrangements[0].id;
  }
  return { ...song, arrangements, defaultArrangementId, updatedAt: Date.now() };
}

export function renameArrangement(song, arrangementId, name) {
  return withArrangement(song, arrangementId, a => ({ ...a, name }));
}

export function setDefaultArrangement(song, arrangementId) {
  if (!song || !Array.isArray(song.arrangements)) return song;
  if (!song.arrangements.some(a => a.id === arrangementId)) return song;
  return { ...song, defaultArrangementId: arrangementId, updatedAt: Date.now() };
}

// Build a v2 song from the pre-v2 flat fields (title/artist/key/sections/...).
// Used by Editor/import flows that still produce a single arrangement.
// When the flat input carries `arrangementId`/`arrangementName` (e.g. a song
// parsed from MD that already has that linkage in its frontmatter), preserve
// them so the local arrangement's identity matches the remote — otherwise
// every pull would mint a fresh id, defeating cross-device sync.
export function songFromFlat(flat) {
  const arrId = flat.arrangementId || arrangementId();
  return {
    id: flat.id,
    title: flat.title || 'Untitled',
    artist: flat.artist || 'Unknown',
    ccli: flat.ccli || '',
    tags: Array.isArray(flat.tags) ? flat.tags : [],
    spotify: flat.spotify || '',
    youtube: flat.youtube || '',
    keyHistory: flat.keyHistory || {},
    ...Object.fromEntries(EXTRA_KEYS.map(k => [k, flat[k] ?? ''])),
    defaultArrangementId: arrId,
    arrangements: [{
      id: arrId,
      name: flat.arrangementName || 'Main Arrangement',
      key: flat.key || 'C',
      tempo: flat.tempo ?? null,
      time: flat.time ?? '',
      duration: flat.duration || '',
      capo: flat.capo || 0,
      notes: flat.notes || '',
      structure: Array.isArray(flat.structure) ? flat.structure : [],
      sections: Array.isArray(flat.sections) ? flat.sections : [],
      tabLibrary: Array.isArray(flat.tabLibrary) ? flat.tabLibrary : [],
      updatedAt: Date.now(),
    }],
    updatedAt: Date.now(),
  };
}
