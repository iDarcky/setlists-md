// The song on the wire — docs/SYNC-REDESIGN.md, step 5.
//
// A song travels as ONE JSON document: the v2 object with every arrangement,
// its key-change overlay, its length, its tab library and any frontmatter the
// build does not model. Markdown is what the `.md` format flattens a song to
// — one arrangement, no overlay — and it is now import/export (and the
// content the older builds still read), never the source of truth between
// devices. A field the app gains tomorrow rides along without a format change.
//
// THREE RULES, so that two devices holding "the same song" produce the SAME
// bytes and nothing device-derived ever counts as an edit:
//   1. Play histories (`keyHistory`, `tempoHistory`) are per-device counts,
//      never on the wire. A pulled song keeps the local ones.
//   2. `updatedAt` (song and arrangement) is a stamp, not content. Stripped on
//      the way out; on the way in, stamped from the server's `updated_at`, so
//      a pulled-but-unedited song does not read as freshly edited.
//   3. The document is NORMALIZED: at the song and arrangement level an empty
//      string, null, an empty array, a zero and the default `structureMode`
//      ('auto') are dropped. A legacy object that lacks a field and a freshly
//      parsed one that carries its default then serialize identically, which
//      is what keeps the three-way merge from calling a build difference a
//      conflict. `songFromDoc` puts the defaults back (the in-app shape is the
//      one `songFromFlat` builds), so `songDoc(songFromDoc(d)) === d`.
// Section bodies (`sections[].lines[]`) are carried verbatim: they are the
// parser's own output on every path.

import { inferStructureMode } from '@/music';
import { EXTRA_META_FIELDS } from '@/parser';
import { stableStringify } from './canonical';

const EXTRA_KEYS = EXTRA_META_FIELDS.map(([k]) => k);

const SONG_STAMPS = new Set(['keyHistory', 'tempoHistory', 'updatedAt']);
const ARR_STAMPS = new Set(['updatedAt']);

function isEmpty(v) {
  return v === '' || v == null || v === 0 || (Array.isArray(v) && v.length === 0);
}

function normalizeLevel(obj, stamps) {
  const out = {};
  for (const k of Object.keys(obj)) {
    if (stamps.has(k) || k.startsWith('_')) continue;
    const v = obj[k];
    if (isEmpty(v)) continue;
    if (k === 'structureMode' && v === 'auto') continue;
    out[k] = v;
  }
  return out;
}

/** The wire form of a song. */
export function songDoc(song) {
  if (!song || typeof song !== 'object') return null;
  const doc = normalizeLevel(song, SONG_STAMPS);
  doc.id = song.id;
  doc.arrangements = (Array.isArray(song.arrangements) ? song.arrangements : [])
    .filter(a => a && typeof a === 'object')
    .map(a => normalizeLevel(a, ARR_STAMPS));
  return doc;
}

/** The wire bytes of a song — the comparison form for "did it change?". */
export function docString(song) {
  const doc = songDoc(song);
  return doc ? stableStringify(doc) : null;
}

function hydrateArrangement(a, ts) {
  const structure = Array.isArray(a.structure) ? a.structure : [];
  const sections = Array.isArray(a.sections) ? a.sections : [];
  return {
    ...a,
    id: a.id,
    name: typeof a.name === 'string' && a.name ? a.name : 'Main Arrangement',
    key: a.key || 'C',
    tempo: a.tempo ?? null,
    time: a.time ?? '',
    duration: a.duration || '',
    capo: a.capo || 0,
    notes: a.notes || '',
    structure,
    keyChanges: Array.isArray(a.keyChanges) ? a.keyChanges : [],
    structureMode: a.structureMode || inferStructureMode(structure, sections),
    sections,
    tabLibrary: Array.isArray(a.tabLibrary) ? a.tabLibrary : [],
    updatedAt: ts,
  };
}

/**
 * A song object from its wire document. `key` is the identity the feed spoke
 * (it wins over anything inside the document). Returns null for a document
 * the app cannot hold (no arrangement, an arrangement without an id).
 * @param {object} doc
 * @param {string} key
 * @param {number} [updatedAt]  the server's edit time (ms)
 * @param {object|null} [local] the copy this device holds — its play histories carry over
 */
export function songFromDoc(doc, key, updatedAt, local) {
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.arrangements) || doc.arrangements.length === 0) return null;
  if (doc.arrangements.some(a => !a || typeof a !== 'object' || typeof a.id !== 'string' || !a.id)) return null;
  const ts = updatedAt || Date.now();
  const arrangements = doc.arrangements.map(a => hydrateArrangement(a, ts));
  const defaultArrangementId = arrangements.some(a => a.id === doc.defaultArrangementId)
    ? doc.defaultArrangementId
    : arrangements[0].id;
  return {
    ...doc,
    id: key,
    title: typeof doc.title === 'string' && doc.title ? doc.title : 'Untitled',
    artist: typeof doc.artist === 'string' && doc.artist ? doc.artist : 'Unknown',
    ccli: doc.ccli || '',
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    spotify: doc.spotify || '',
    youtube: doc.youtube || '',
    ...Object.fromEntries(EXTRA_KEYS.map(k => [k, doc[k] ?? ''])),
    keyHistory: local?.keyHistory || {},
    tempoHistory: local?.tempoHistory || {},
    defaultArrangementId,
    arrangements,
    updatedAt: ts,
  };
}

/** Is `value` a wire document (as opposed to a markdown string)? */
export function isSongDoc(value) {
  return !!value && typeof value === 'object' && Array.isArray(value.arrangements);
}
