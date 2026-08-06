import { normalizeSectionName } from '@/music';

/**
 * Playback-order derivations, as pure functions.
 *
 * These three live inline in `ChartView` today and are re-derived (slightly
 * differently) in the performance views. The reader uses these; ChartView's
 * copies go when the `unifiedReader` flag graduates.
 */

/**
 * The sections in playback order.
 *
 * A song's `structure` names sections in the order they're played, and a name
 * may repeat. If the structure doesn't fully resolve — a typo, a section that
 * was deleted — fall back to document order rather than partially hiding the
 * song, which is the worse failure on a stage.
 */
export function orderSections(song) {
  const sections = song?.sections || [];
  const structure = song?.structure;
  if (!structure?.length || song?.structureMode === 'doc') return sections;

  const resolved = structure
    .map(name => sections.find(
      s => normalizeSectionName(s.type) === normalizeSectionName(typeof name === 'string' ? name : name?.type)
    ))
    .filter(Boolean);

  return resolved.length === structure.length ? resolved : sections;
}

/**
 * Cumulative modulate offset entering each ordered section.
 *
 * `{modulate: +2}` markers stack across the whole playback order, so a section
 * repeated after a key change plays in the new key. Returns the offset *going
 * in* to each section — offsets from markers inside a section apply to the
 * lines after them, which `SectionBlock` handles.
 */
export function sectionModOffsets(ordered) {
  const acc = { total: 0 };
  return (ordered || []).map(section => {
    const offset = acc.total;
    (section.lines || []).forEach(line => {
      if (typeof line === 'object' && line.type === 'modulate') acc.total += line.semitones;
    });
    return offset;
  });
}

/**
 * For each playback slot, the index of the first slot it repeats — or -1 when
 * it's the first (or only) time through.
 *
 * A repeat only counts when it renders *identically*: same section AND the same
 * cumulative modulate offset. A chorus after a key change has different chords
 * and must render in full, however many times it has been sung already.
 */
export function repeatFirstIndex(ordered, offsets) {
  const firstSeen = new Map();
  return (ordered || []).map((section, idx) => {
    const key = section.id || normalizeSectionName(section.type);
    const prior = firstSeen.get(key);
    if (prior != null && prior.mod === offsets[idx]) return prior.idx;
    if (prior == null) firstSeen.set(key, { idx, mod: offsets[idx] });
    return -1;
  });
}

// Sections that carry the weight of a song. The old chart gave every section
// identical visual weight, which is why a page of verses and choruses read as
// one undifferentiated block — there was no shape to find your place in.
// LOWERCASE, because `normalizeSectionName` lowercases. This set was
// capitalised, so `HEAVY.has('chorus')` was always false and `sectionWeight`
// never once returned 'hi' — meaning element 3's "a chorus is clearly heavier
// than a verse" (extra air above it) silently did nothing from the day it
// shipped, and so did the chorus indent built on top of it.
const HEAVY = new Set(['chorus', 'refrain', 'bridge']);

/** 'hi' for the sections a song leans on, 'base' for the rest. */
export function sectionWeight(type) {
  // Real charts number their sections — "Chorus 1", "Bridge 2". Strip a
  // trailing index so the second chorus is as heavy as the first; matching the
  // bare word only would have left "Bridge 1" reading as a verse.
  const base = normalizeSectionName(type).replace(/\s*\d+$/, '');
  return HEAVY.has(base) ? 'hi' : 'base';
}

/**
 * Runs of back-to-back repeats, collapsed the way the ribbon already collapses
 * its chips.
 *
 * Owner, 2026-08-06: *"if we repeats a bridge x4 we have the bridge once and
 * the 3 tags and they look ugly, can we unify them somehow?"* — yes, and it is
 * the rule element 3 settled for the map: **consecutive only, never a global
 * tally**. `B B B B` is one Bridge and one `↩ BRIDGE ×3`; `C V2 C` is two
 * separate tags, because they are not the same moment in the song.
 *
 * Returns one entry per slot:
 *   `{ lead: true, count: n }` — draw the pill here; it stands for `n` plays
 *   `{ lead: false }`          — inside a run that has already been drawn
 *   `null`                     — not a repeat at all
 */
export function repeatRuns(ordered, repeats) {
  const out = (ordered || []).map(() => null);
  let i = 0;
  while (i < out.length) {
    if (!(repeats[i] >= 0)) { i += 1; continue; }
    // Walk forward while each slot repeats the SAME first play as this one and
    // sits immediately next to the previous — `repeats[]` already encodes
    // "identical section, identical modulate offset".
    let j = i;
    while (j + 1 < out.length && repeats[j + 1] === repeats[i]) j += 1;
    out[i] = { lead: true, count: j - i + 1, slots: Array.from({ length: j - i + 1 }, (_, k) => i + k) };
    for (let k = i + 1; k <= j; k += 1) out[k] = { lead: false, of: i };
    i = j + 1;
  }
  return out;
}

/** All of it in one pass — what the reader actually wants. */
export function buildSongFlow(song) {
  const ordered = orderSections(song);
  const offsets = sectionModOffsets(ordered);
  const repeats = repeatFirstIndex(ordered, offsets);
  return { ordered, offsets, repeats, runs: repeatRuns(ordered, repeats) };
}
