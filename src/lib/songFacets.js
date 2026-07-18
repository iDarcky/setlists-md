// Faceted filtering for the song library. Pure + testable: extract a song's
// values per facet, build the available options (with counts) from a list, and
// test a song against a selection. Semantics: OR within a facet, AND across
// facets — the standard faceted-search mental model.
//
// Backed entirely by existing schema fields (no migration): key/tempo come from
// the default arrangement; theme/language/year/scripture/moment are the
// song-level extended metadata (lowercase keys — see EXTRA_META_FIELDS).

function defaultArrangement(song) {
  if (!Array.isArray(song?.arrangements)) return song || {};
  return song.arrangements.find(a => a.id === song.defaultArrangementId) || song.arrangements[0] || song;
}

// Split a multi-value metadata string ("grace, redemption; advent") into trimmed
// parts. Accepts arrays too. Returns [] for empty.
export function splitMulti(...vals) {
  const out = [];
  for (const v of vals) {
    if (v == null || v === '') continue;
    const parts = Array.isArray(v) ? v : String(v).split(/[,;/]+/);
    for (const p of parts) {
      const t = String(p).trim();
      if (t) out.push(t);
    }
  }
  return out;
}

export function tempoBucket(tempo) {
  const t = Number(tempo);
  if (!t || Number.isNaN(t)) return null;
  if (t < 80) return 'Slow';
  if (t < 120) return 'Mid';
  return 'Fast';
}

// Facet definitions. `values(song)` returns the song's value(s) for that facet.
export const FACETS = [
  { key: 'key', label: 'Key', values: (s) => { const k = defaultArrangement(s).key; return k ? [String(k)] : []; } },
  { key: 'tempo', label: 'Tempo', values: (s) => { const b = tempoBucket(defaultArrangement(s).tempo); return b ? [b] : []; } },
  { key: 'theme', label: 'Theme', values: (s) => splitMulti(s.themes, s.genres) },
  { key: 'language', label: 'Language', values: (s) => splitMulti(s.language) },
  { key: 'year', label: 'Year', values: (s) => (s.year ? [String(s.year).trim()] : []) },
  { key: 'scripture', label: 'Scripture', values: (s) => splitMulti(s.scripture) },
  { key: 'moment', label: 'Moment', values: (s) => splitMulti(s.moment) },
];

export const FACET_KEYS = FACETS.map(f => f.key);
const FACET_BY_KEY = Object.fromEntries(FACETS.map(f => [f.key, f]));

export function songFacetValues(song, facetKey) {
  return FACET_BY_KEY[facetKey]?.values(song) || [];
}

// Fixed display order where the value set is bounded.
const TEMPO_ORDER = ['Slow', 'Mid', 'Fast'];
const KEY_ROOT_ORDER = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];
function keyRank(k) {
  // Sort by root note order, then minor after major of the same root.
  const root = k.replace(/m.*$/i, '').replace(/(maj|min|sus|add|dim|aug).*$/i, '');
  const i = KEY_ROOT_ORDER.indexOf(root);
  const minorBump = /m/i.test(k.slice(root.length)) ? 0.5 : 0;
  return (i === -1 ? 99 : i) + minorBump;
}

// Build the selectable options per facet from a song list: each value with how
// many songs carry it. Facets with no values are omitted.
export function buildFacetOptions(songs) {
  const counts = Object.fromEntries(FACET_KEYS.map(k => [k, new Map()]));
  for (const song of songs || []) {
    for (const facet of FACETS) {
      const seen = new Set(); // a song counts once per distinct value
      for (const v of facet.values(song)) {
        if (seen.has(v)) continue;
        seen.add(v);
        counts[facet.key].set(v, (counts[facet.key].get(v) || 0) + 1);
      }
    }
  }

  const result = {};
  for (const facet of FACETS) {
    const entries = [...counts[facet.key].entries()].map(([value, count]) => ({ value, count }));
    if (entries.length === 0) continue;
    entries.sort((a, b) => {
      if (facet.key === 'tempo') return TEMPO_ORDER.indexOf(a.value) - TEMPO_ORDER.indexOf(b.value);
      if (facet.key === 'key') return keyRank(a.value) - keyRank(b.value) || a.value.localeCompare(b.value);
      if (facet.key === 'year') return b.value.localeCompare(a.value); // newest first
      return b.count - a.count || a.value.localeCompare(b.value); // by frequency
    });
    result[facet.key] = entries;
  }
  return result;
}

// Does a song satisfy the current selection? `selected` is
// { facetKey: string[] }. OR within a facet, AND across facets.
export function matchesFacets(song, selected) {
  if (!selected) return true;
  for (const facetKey of FACET_KEYS) {
    const wanted = selected[facetKey];
    if (!wanted || wanted.length === 0) continue;
    const have = new Set(songFacetValues(song, facetKey));
    if (!wanted.some(v => have.has(v))) return false;
  }
  return true;
}

// Total number of active selections across all facets.
export function countActiveFacets(selected) {
  if (!selected) return 0;
  return FACET_KEYS.reduce((n, k) => n + (selected[k]?.length || 0), 0);
}
