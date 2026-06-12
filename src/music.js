// Chromatic scale and enharmonic maps
const CHROMATIC = ['A','A#','B','C','C#','D','D#','E','F','F#','G','G#'];
const FLAT_MAP = { Bb:'A#', Db:'C#', Eb:'D#', Gb:'F#', Ab:'G#' };
const SHARP_TO_FLAT = { 'A#':'Bb', 'C#':'Db', 'D#':'Eb', 'F#':'Gb', 'G#':'Ab' };

// Parse a chord into root + suffix
function parseRoot(chord) {
  let root = chord[0];
  let rest = chord.slice(1);
  if (rest[0] === '#' || rest[0] === 'b') {
    root += rest[0];
    rest = rest.slice(1);
  }
  if (FLAT_MAP[root]) root = FLAT_MAP[root];
  return { root, suffix: rest };
}

// Transpose a single chord by N semitones
export function transposeChord(chord, semitones) {
  if (!chord || semitones === 0) return chord;
  // Handle slash chords (e.g. D/F#)
  if (chord.includes('/')) {
    const [main, bass] = chord.split('/');
    return transposeChord(main, semitones) + '/' + transposeChord(bass, semitones);
  }
  const { root, suffix } = parseRoot(chord);
  const idx = CHROMATIC.indexOf(root);
  if (idx === -1) return chord;
  let newRoot = CHROMATIC[(idx + semitones + 120) % 12];
  if (SHARP_TO_FLAT[newRoot]) newRoot = SHARP_TO_FLAT[newRoot];
  return newRoot + suffix;
}

// Transpose a key signature
export function transposeKey(key, semitones) {
  if (!key || semitones === 0) return key;
  const { root, suffix } = parseRoot(key);
  const idx = CHROMATIC.indexOf(root);
  if (idx === -1) return key;
  let newRoot = CHROMATIC[(idx + semitones + 120) % 12];
  if (SHARP_TO_FLAT[newRoot]) newRoot = SHARP_TO_FLAT[newRoot];
  return newRoot + suffix;
}

// All display keys for selectors
export const ALL_KEYS = ['A','Bb','B','C','Db','D','Eb','E','F','Gb','G','Ab'];

// Calculate semitones from one key to another
export function semitonesBetween(fromKey, toKey) {
  const fromRoot = FLAT_MAP[fromKey] || fromKey;
  const toRoot = FLAT_MAP[toKey] || toKey;
  const fi = CHROMATIC.indexOf(fromRoot);
  const ti = CHROMATIC.indexOf(toRoot);
  if (fi === -1 || ti === -1) return 0;
  return (ti - fi + 12) % 12;
}

// Section type → colors, label, pre-computed bg/border
// b = base color, d = display/text color, l = compact label
// bg = low-opacity background, br = semi-transparent border
const SECTION_COLORS = {
  Intro:        { b: 'var(--ds-blue-700)',  d: 'var(--ds-blue-1000)',  l: 'I',  bg: 'var(--ds-blue-100)',  br: 'var(--ds-blue-400)', c: 'blue' },
  Refrain:      { b: 'var(--ds-purple-700)',d: 'var(--ds-purple-1000)',l: 'Rf', bg: 'var(--ds-purple-100)',br: 'var(--ds-purple-400)',c: 'purple' },
  Verse:        { b: 'var(--ds-green-700)', d: 'var(--ds-green-1000)', l: 'V',  bg: 'var(--ds-green-100)', br: 'var(--ds-green-400)', c: 'green' },
  'Pre Chorus': { b: 'var(--ds-amber-700)', d: 'var(--ds-amber-1000)', l: 'Pc', bg: 'var(--ds-amber-100)', br: 'var(--ds-amber-400)', c: 'amber' },
  Chorus:       { b: 'var(--ds-pink-700)',  d: 'var(--ds-pink-1000)',  l: 'C',  bg: 'var(--ds-pink-100)',  br: 'var(--ds-pink-400)', c: 'pink' },
  Bridge:       { b: 'var(--ds-teal-700)',  d: 'var(--ds-teal-1000)',  l: 'B',  bg: 'var(--ds-teal-100)',  br: 'var(--ds-teal-400)', c: 'teal' },
  Instrumental: { b: 'var(--ds-amber-700)', d: 'var(--ds-amber-1000)', l: 'It', bg: 'var(--ds-amber-100)', br: 'var(--ds-amber-400)', c: 'amber' },
  Ending:       { b: 'var(--ds-red-700)',   d: 'var(--ds-red-1000)',   l: 'E',  bg: 'var(--ds-red-100)',   br: 'var(--ds-red-400)',  c: 'red' },
  Tag:          { b: 'var(--ds-blue-700)',  d: 'var(--ds-blue-1000)',  l: 'T',  bg: 'var(--ds-blue-100)',  br: 'var(--ds-blue-400)', c: 'blue' },
  Interlude:    { b: 'var(--ds-purple-700)',d: 'var(--ds-purple-1000)',l: 'Il', bg: 'var(--ds-purple-100)',br: 'var(--ds-purple-400)',c: 'purple' },
  Vamp:         { b: 'var(--ds-amber-700)', d: 'var(--ds-amber-1000)', l: 'Vm', bg: 'var(--ds-amber-100)', br: 'var(--ds-amber-400)', c: 'amber' },
  Outro:        { b: 'var(--ds-red-700)',   d: 'var(--ds-red-1000)',   l: 'O',  bg: 'var(--ds-red-100)',   br: 'var(--ds-red-400)',  c: 'red' },
};

const DEFAULT_STYLE = { b: 'var(--ds-gray-700)', d: 'var(--ds-gray-1000)', l: '?', bg: 'var(--ds-gray-100)', br: 'var(--ds-gray-400)', c: 'gray' };

// All canonical section type keys, exported so settings panels can iterate
// over them without re-declaring the list.
export const SECTION_TYPE_KEYS = Object.keys(SECTION_COLORS);

// Resolve the canonical base type for a section header (e.g. "Verse 1" →
// "Verse", "Chorus 2" → "Chorus"). Returns null if no built-in type matches
// — used by custom user types.
export function sectionBaseType(type) {
  if (!type) return null;
  const base = type.replace(/\s*\d+$/, '');
  return Object.keys(SECTION_COLORS).find(
    k => base.toLowerCase().startsWith(k.toLowerCase())
  ) || null;
}

// Derive a translucent bg + border colour from a hex/CSS colour so user
// overrides still get the same washed-bg/strong-border treatment as the
// built-in presets.
function deriveStyleFromColor(color) {
  // We can't compute alpha variants of CSS vars at runtime, so just reuse
  // the same colour at lower opacity via color-mix (well-supported in
  // modern browsers; the calling code falls back to opaque if not).
  return {
    b: color,
    d: color,
    l: '?',
    bg: `color-mix(in srgb, ${color} 14%, transparent)`,
    br: `color-mix(in srgb, ${color} 35%, transparent)`,
    c: 'custom',
  };
}

// Get colors for a section type (e.g. "Verse 1" → Verse colors). Accepts
// optional `customColors` { Verse: '#xxx' } and `customTypes` array so
// invented section types (e.g. "Strofa") resolve too.
export function sectionStyle(type, customColors = null, customTypes = null) {
  const base = type.replace(/\s*\d+$/, '');
  const baseLower = base.toLowerCase();

  // 1. Custom (invented) types — exact base match wins.
  if (Array.isArray(customTypes)) {
    const ct = customTypes.find(t => t?.name && t.name.toLowerCase() === baseLower);
    if (ct) {
      const c = customColors?.[ct.id] || ct.color || 'var(--ds-gray-700)';
      const style = deriveStyleFromColor(c);
      return { ...style, l: ct.label?.[0]?.toUpperCase() || '?' };
    }
  }

  // 2. Built-in type, possibly with a user colour override.
  const key = Object.keys(SECTION_COLORS).find(
    k => baseLower.startsWith(k.toLowerCase())
  );
  if (!key) return DEFAULT_STYLE;

  const override = customColors?.[key];
  if (override) {
    return { ...SECTION_COLORS[key], ...deriveStyleFromColor(override) };
  }
  return SECTION_COLORS[key];
}

// Display label for a section header. Strips trailing colons and applies
// the user's custom label for the base type if any (e.g. Verse → Strofa).
// Preserves trailing numbers — "Verse 1" with { Verse: "Strofa" } becomes
// "Strofa 1".
export function sectionLabel(type, customLabels = null) {
  if (!type) return '';
  const cleaned = String(type).replace(/:+$/, '').trim();
  const numMatch = cleaned.match(/(.*?)(\s*\d+)\s*$/);
  const base = numMatch ? numMatch[1].trim() : cleaned;
  const suffix = numMatch ? numMatch[2] : '';

  if (customLabels) {
    const baseLower = base.toLowerCase();
    const hit = Object.keys(customLabels).find(k => k.toLowerCase() === baseLower);
    if (hit && customLabels[hit]) return `${customLabels[hit]}${suffix}`;
  }
  return cleaned;
}

// Normalize a section name for matching across the structure list and
// the actual section headers in the body. People (and older code paths)
// sometimes write `Verse 1` in the structure but `## Verse 1:` in the
// body, or pad with stray spaces. We strip trailing punctuation and
// collapse whitespace so the two match.
export function normalizeSectionName(name) {
  if (!name) return '';
  return String(name)
    .replace(/[\s:.,;]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Compact label for live mode (e.g. "Chorus 1" → "C1", "Pre Chorus" → "Pc")
export function compactLabel(name) {
  const num = name.match(/(\d+)$/)?.[1] || '';
  const style = sectionStyle(name);
  return style.l + num;
}

// Convert a chord to Nashville Number System
export function getNashvilleNumber(chord, key) {
  if (!chord || !key) return chord;
  if (chord.includes('/')) {
    const [main, bass] = chord.split('/');
    return getNashvilleNumber(main, key) + '/' + getNashvilleNumber(bass, key);
  }
  const { root, suffix } = parseRoot(chord);
  const keyRoot = parseRoot(key).root;
  const fi = CHROMATIC.indexOf(keyRoot);
  const ti = CHROMATIC.indexOf(root);
  if (fi === -1 || ti === -1) return chord;

  const semitones = (ti - fi + 12) % 12;
  const map = { 0: '1', 1: 'b2', 2: '2', 3: 'b3', 4: '3', 5: '4', 6: 'b5', 7: '5', 8: 'b6', 9: '6', 10: 'b7', 11: '7' };
  return (map[semitones] || '?') + suffix;
}
 
// Convert a chord to movable-Do solfège (Do Re Mi …), relative to the key.
export function getSolfege(chord, key) {
  if (!chord || !key) return chord;
  if (chord.includes('/')) {
    const [main, bass] = chord.split('/');
    return getSolfege(main, key) + '/' + getSolfege(bass, key);
  }
  const { root, suffix } = parseRoot(chord);
  const keyRoot = parseRoot(key).root;
  const fi = CHROMATIC.indexOf(keyRoot);
  const ti = CHROMATIC.indexOf(root);
  if (fi === -1 || ti === -1) return chord;
  const semitones = (ti - fi + 12) % 12;
  const map = { 0: 'Do', 1: 'Di', 2: 'Re', 3: 'Me', 4: 'Mi', 5: 'Fa', 6: 'Fi', 7: 'Sol', 8: 'Le', 9: 'La', 10: 'Te', 11: 'Ti' };
  return (map[semitones] || '?') + suffix;
}

// Diatonic chords for a given key (I, ii, iii, IV, V, vi, vii°)
const DIATONIC_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const DIATONIC_QUALITIES = ['', 'm', 'm', '', '', 'm', 'dim'];
 
export function getDiatonicChords(key) {
  if (!key) return ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'];
  return DIATONIC_INTERVALS.map((interval, i) =>
    transposeChord(key, interval) + DIATONIC_QUALITIES[i]
  );
}

// ─── Compatibility scoring (used by recommendations.js) ────────────────────
// Circle of fifths positions for major keys. Minors share their relative
// major's slot (Am ↔ C, Em ↔ G, etc.).
const FIFTHS_POSITIONS = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7, 'G#': 8, 'D#': 9, 'A#': 10, F: 11,
};

function normalizeKeyForFifths(key) {
  if (!key) return null;
  // Strip a trailing 'm' (minor) — for fifths distance the relative major lives
  // in the same slot. (Am → C, Em → G, …)
  const isMinor = /m$/.test(key) && !/maj/i.test(key);
  let root = isMinor ? key.slice(0, -1) : key;
  if (FLAT_MAP[root]) root = FLAT_MAP[root];
  if (isMinor) {
    // Relative major is +3 semitones from the minor root.
    const idx = CHROMATIC.indexOf(root);
    if (idx === -1) return null;
    root = CHROMATIC[(idx + 3) % 12];
  }
  return FIFTHS_POSITIONS[root] ?? null;
}

// Distance around the circle of fifths in steps (0..6). 0 = same key (or
// relative major/minor); 1 = perfect 4th/5th; up to 6 (tritone, far apart).
export function circleOfFifthsDistance(keyA, keyB) {
  const a = normalizeKeyForFifths(keyA);
  const b = normalizeKeyForFifths(keyB);
  if (a == null || b == null) return null;
  const raw = Math.abs(a - b);
  return Math.min(raw, 12 - raw);
}

// 0..1 score where 1 = identical (or relative major/minor) and 0 = tritone away.
// Decays linearly with circle-of-fifths distance.
export function keyCompatibilityScore(keyA, keyB) {
  const dist = circleOfFifthsDistance(keyA, keyB);
  if (dist == null) return 0;
  return Math.max(0, 1 - dist / 6);
}

// Gaussian-shaped tempo proximity: 1.0 at 0 BPM delta; ~0.5 around 18 BPM;
// ~0 above ~50 BPM. Returns 0..1.
export function tempoProximityScore(bpmA, bpmB) {
  const a = Number(bpmA);
  const b = Number(bpmB);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0.5;
  const d = Math.abs(a - b);
  const sigma = 18;
  return Math.exp(-(d * d) / (2 * sigma * sigma));
}