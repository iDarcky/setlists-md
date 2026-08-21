// Element 8 — a key change is an OVERLAY on the play order, not a thing inside
// a section.
//
// ── Why not in the section body ─────────────────────────────────────────────
// `{modulate: +2}` lives in `section.lines[]`, and a section that plays three
// times replays its body three times. That is why `once`/`every` had to be
// invented, and it still cannot say the commonest shape of all — "Chorus in C,
// Verse 2, Chorus in D" — because both choruses are the same object.
//
// ── Why not an entry in `structure` ─────────────────────────────────────────
// That was the next proposal and the owner rejected it, correctly: *"What if a
// song modulates in the middle of the chorus? What would we do there?"* A
// `structure` entry sits BETWEEN slots, so a mid-section change is unsayable in
// it. His model instead: *"modulate should be an outside influence that can
// live anywhere and we can do it anywhere from practice."*
//
// ── So: an anchor of (slot, line) ───────────────────────────────────────────
// `slot` indexes the PLAY ORDER, not `sections[]`. That is the whole point —
// the same chorus can be slot 1 and slot 5, and only slot 5 lifts. `line`
// indexes that section's `lines[]`, so a change can land mid-section. An entry
// applies to its own line and everything after it, cumulatively, until the next
// entry.
//
//   { slot: 3, line: 0 }  — from the top of slot 3 (i.e. between sections)
//   { slot: 3, line: 4 }  — from the fifth line of slot 3 (mid-section)
//
// ⚠ The rendering machinery for this ALREADY EXISTS. `sectionModPlan` computes
// a per-slot offset and `SectionBlock` computes a per-line offset inside a
// section; both are fed from body markers today. This module is a different
// source for the same two numbers, not a new renderer.

/**
 * Semitones, not the arrival key.
 *
 * ⚠ Storing "D" would be wrong the moment the song is transposed: a song in C
 * that lifts to D is a song in E that lifts to F#. The interval survives
 * transposition; the letter does not. The chip DISPLAYS the arrival key —
 * element 8's rule, "we're in B now" beats "+2" — it just computes it.
 */

/** A usable entry, or null. Anchors are non-negative ints; a 0 shift is nothing. */
function clean(e) {
  if (!e || typeof e !== 'object') return null;
  const slot = Math.trunc(Number(e.slot));
  const line = Math.trunc(Number(e.line ?? 0));
  const semitones = Math.trunc(Number(e.semitones));
  if (!Number.isFinite(slot) || slot < 0) return null;
  if (!Number.isFinite(line) || line < 0) return null;
  if (!Number.isFinite(semitones) || semitones === 0) return null;
  return { slot, line, semitones };
}

/**
 * Sorted, de-duplicated, and with same-position entries summed.
 *
 * Two changes at one anchor is not an error — it is what "+2 then +2 again"
 * looks like after an edit — but it must render as one chip saying +4 rather
 * than two chips fighting over the same line.
 */
export function normalizeKeyChanges(list) {
  const byPos = new Map();
  for (const raw of list || []) {
    const e = clean(raw);
    if (!e) continue;
    const k = `${e.slot}:${e.line}`;
    byPos.set(k, (byPos.get(k) || 0) + e.semitones);
  }
  const out = [];
  for (const [k, semitones] of byPos) {
    if (semitones === 0) continue;   // +2 then -2 at one spot is no change
    const [slot, line] = k.split(':').map(Number);
    out.push({ slot, line, semitones });
  }
  out.sort((a, b) => (a.slot - b.slot) || (a.line - b.line));
  return out;
}

/**
 * The overlay, resolved against a play order.
 *
 * @returns {{ slotOffsets: number[], slotMarks: Array<Array<{line:number,semitones:number,offset:number}>> }}
 *   slotOffsets[s] — the shift going IN to slot `s`, i.e. what its lines carry
 *                    before any of its own entries fire.
 *   slotMarks[s]   — this slot's entries, each with the CUMULATIVE offset that
 *                    applies from that line onward. `SectionBlock` draws the
 *                    chip at `line` and shifts from there.
 *
 * ⚠ Entries anchored past the end of the play order are DROPPED, and entries
 * past the end of a section CLAMP to its last line. An overlay outliving the
 * song it points into is not hypothetical — the full editor rewrites sections
 * wholesale — and the two honest failures are "gone" and "at the end", never a
 * crash and never a silent shift of the wrong half of the song.
 */
export function resolveKeyChanges(ordered, entries) {
  const n = (ordered || []).length;
  const slotOffsets = new Array(n).fill(0);
  const slotMarks = Array.from({ length: n }, () => []);
  let running = 0;
  for (const e of normalizeKeyChanges(entries)) {
    if (e.slot >= n) break;           // sorted, so everything after is too
    const lines = ordered[e.slot]?.lines || [];
    const line = lines.length ? Math.min(e.line, lines.length - 1) : 0;
    running += e.semitones;
    slotMarks[e.slot].push({ line, semitones: e.semitones, offset: running });
  }
  // Second pass for the per-slot incoming offset: a slot carries everything
  // that fired strictly before it.
  running = 0;
  for (let s = 0; s < n; s++) {
    slotOffsets[s] = running;
    for (const m of slotMarks[s]) running = m.offset;
  }
  return { slotOffsets, slotMarks };
}

// ── Anchor maintenance ──────────────────────────────────────────────────────
//
// ⚠ THE FAILURE MODE THIS EXISTS FOR. An anchor is an index, and every edit to
// the play order moves indices. Get it wrong and a key change points at a
// different section — which at least is VISIBLE (the chip moves), unlike the
// silent desyncs elsewhere in this codebase, but is still wrong.
//
// Every structure edit in the reader goes through ONE function
// (`Reader.editStructure`), so these live next to the ops it applies and are
// called in the same breath. Adding a new structure op means adding its remap
// here — `key-changes.test.js` enumerates them.

/** Slots at or after `at` shift down by `count`. Used when inserting slots. */
export function remapForInsert(entries, at, count = 1) {
  return normalizeKeyChanges(
    (entries || []).map(e => (e.slot >= at ? { ...e, slot: e.slot + count } : e)),
  );
}

/**
 * A slot is gone. Its own entries go with it — the change belonged to that
 * occurrence, and re-homing it onto the next section would move a key change
 * the user never asked to move.
 */
export function remapForRemove(entries, idx) {
  return normalizeKeyChanges(
    (entries || [])
      .filter(e => e.slot !== idx)
      .map(e => (e.slot > idx ? { ...e, slot: e.slot - 1 } : e)),
  );
}

/**
 * A run of `count` slots moved from `from` to `to`. Entries anchored inside the
 * run travel WITH it; everything else closes up behind and opens up in front.
 *
 * `to` is the destination index in the array with the run already removed,
 * which is what `moveRun` in `editStructure.js` means by it.
 */
export function remapForMove(entries, from, count, to) {
  const moved = [];
  const rest = [];
  for (const e of (entries || [])) {
    if (e.slot >= from && e.slot < from + count) moved.push({ ...e, slot: e.slot - from });
    else rest.push({ ...e, slot: e.slot > from ? e.slot - count : e.slot });
  }
  return normalizeKeyChanges([
    ...rest.map(e => (e.slot >= to ? { ...e, slot: e.slot + count } : e)),
    ...moved.map(e => ({ ...e, slot: e.slot + to })),
  ]);
}

/**
 * Legacy input: `{modulate}` markers in section bodies, read as an overlay.
 *
 * Existing songs keep working without a migration pass over stored data — the
 * markers are converted every time the song is read. `every` is honoured the
 * way `sectionModPlan` honoured it: a bare marker fires on a section's first
 * occurrence only, an `every` marker fires on each.
 *
 * ⚠ A song can carry BOTH. The overlay is authoritative for anything it names
 * and the markers fill in the rest, so converting a song by hand is a matter of
 * deleting markers rather than a flag day.
 */
export function fromBodyMarkers(ordered) {
  const out = [];
  const seen = new Set();
  (ordered || []).forEach((section, slot) => {
    const first = !seen.has(section);
    seen.add(section);
    (section?.lines || []).forEach((line, li) => {
      if (typeof line !== 'object' || line.type !== 'modulate') return;
      if (!line.every && !first) return;
      // The marker is its own line, so what it shifts starts at the NEXT one.
      out.push({ slot, line: li + 1, semitones: line.semitones });
    });
  });
  return normalizeKeyChanges(out);
}
