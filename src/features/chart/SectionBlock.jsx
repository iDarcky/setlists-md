import { useMemo, Fragment } from 'react';
import { notateChord, sectionStyle, sectionLabel } from '@/music';
import { parseLine, INLINE_NOTE_MAX_CHARS } from '@/parser';
import TabBlock from './TabBlock';

// ── The three numbers chord spacing is built from ─────────────────────────
// All measured in Chromium at 390px, 2026-08-10, and all used inside CSS
// `calc` against the live font-size variables rather than baked into pixels —
// the user can change either size from the Aa menu at any moment.
//
// `WORD_GAP_EM` — the gap between two words on a chorded line, in em of the
// lyric size. It was an inherited space glyph (0.25em sans / 0.6em mono
// depending on the surface, entirely by accident); 0.6em reproduced the old
// chart exactly and read as too wide once the chords stopped fighting for room
// (owner, 2026-08-10: *"the gap between words is too big now"*).
const WORD_GAP_EM = 0.4;
// `CHORD_CHAR_EM` — width of one chord character. EXACT: the chord font is
// monospace and Geist Mono at 17px measures 10.2px a character.
const CHORD_CHAR_EM = 0.6;
// `LYRIC_CHAR_EM` — width of one lyric character. The lyric font is
// proportional, so this is an estimate against a measured range of 0.41em
// ("suflet,") to 0.63em ("Ca"). It shipped at the LOW end, 0.42, because
// under-estimating the room a line offers errs toward a gap that is slightly
// too wide — the old behaviour, and safe — while over-estimating it lets two
// chords touch, which is not.
//
// ⚠ 0.50 was asked for (owner, 2026-08-10: *"Can we try 0.50?"*) and MEASURED
// TO COLLIDE. Swept against the 15-line hostile corpus in Chromium:
//
//     0.42  ok everywhere      total dead 340.1px
//     0.46  ok everywhere      total dead 326.0px
//     0.48  ok everywhere      total dead 320.0px
//     0.50  G and D land 0.2px apart at lyric size 28  dead 314.6px
//
// So 0.48 is the ceiling this corpus allows, and it ships at the ceiling.
//
// The more useful finding is the right-hand column: the whole 0.42 -> 0.50
// range moves the total dead space by **8%**. This constant is not where the
// remaining gaps come from — they are chords genuinely wider than the words
// before the next chord (`Gmaj7` over "I"), which is the one case where a gap
// is correct. Tuning it further buys almost nothing and risks a touch.
const LYRIC_CHAR_EM = 0.48;
// The clear air left between one chord's last glyph and the next chord's first.
const CHORD_MIN_GAP_PX = 4;

const NOTE_SEPARATORS = {
  dashes: ' ---- ',
  dots:   ' ...... ',
  arrow:  ' ----> ',
};

// Group chord+text pairs into whole words so a lyric line only ever wraps at a
// space — never in the middle of a word, even when a chord sits mid-word.
// Returns a list of items: { segments: [{chord, text}] } for a word, or
// { space: '…' } for the breakable gap between words. A chord that lands on a
// space carries forward to the start of the next word.
//
// ⚠ IT USED TO DELETE CHORDS. `pending = pending ?? p.chord` reads as "keep the
// one we are already carrying", and that is right for the case it was written
// for — a chord landing mid-gap belongs to the word after it. But a chord
// arriving while one is still held is not a duplicate; it is the NEXT chord, and
// `??` threw it away. Any chord standing alone between two spaces on a line that
// has lyrics took the following chord with it:
//
//     [C]word [G] [D]more     rendered   C G      — D gone
//     [Ab]mea [Cm] [Bb]       rendered   Ab Cm    — Bb gone
//     [C]a [G] [D] [Em]b      rendered   C G      — D and Em gone
//
// Measured in Chromium 2026-08-10, and it is the shape of a real line: a
// trailing turnaround (`…mea [Cm] [Bb]`) is how half the worship charts in the
// library end a chorus. Nothing showed on screen — the chart simply drew fewer
// chords than the song had, so you play the wrong one and the app never says a
// word. `parser.js` was innocent throughout: `parseLine` returns all four pairs
// and `lineToPlacement`/`placementToLine` round-trip the line byte-exact. The
// loss was here, in the renderer, and only on screen.
//
// A held chord that meets another chord has nothing left to attach to, so it is
// emitted where it stands, with no word under it. The carry-forward that the
// `??` was protecting still happens — it is the `/^\s+$/` branch below that
// deliberately leaves `pending` alone.
function groupChordWords(pairs) {
  const words = [];
  let cur = [];
  let pending = null;
  const flush = () => { if (cur.length) { words.push({ segments: cur }); cur = []; } };
  for (const p of pairs) {
    if (p.chord) {
      if (pending) cur.push({ chord: pending, text: '' });
      pending = p.chord;
    }
    const parts = (p.text ?? '').split(/(\s+)/);
    for (const part of parts) {
      if (part === '') continue;
      if (/^\s+$/.test(part)) {
        flush();
        words.push({ space: part });
      } else {
        cur.push({ chord: pending, text: part });
        pending = null;
      }
    }
  }
  if (pending) cur.push({ chord: pending, text: '' });
  flush();
  return words;
}

export default function SectionBlock({
  section, transpose, modOffset = 0,
  // Whether THIS occurrence applies its own `{modulate}` markers. False on the
  // repeat of a section whose markers are once-only — see `sectionModPlan`.
  // Defaults true so every existing caller behaves exactly as it did.
  modFires = true,
  nns, notation, songKey, accidentals = 'auto',
  showChords = true, showLyrics = true, showTabs = true, inlineNotes = true, noteStyle = 'dashes',
  sectionColors, sectionLabels, customSectionTypes, tabScale = 1, tabColors, tabInstrument = 'all',
  condensed = false, onJumpToFirst,
  // The reader renders its own (sticky) heading above this block, so it asks
  // for the body only. Default false keeps every existing caller unchanged.
  hideHeading = false,
  // Where a {!note} goes relative to its lyric line:
  //   'inline' — trailing the line, separated by dashes (default, unchanged)
  //   'above'  — on its own line ABOVE, so it is read before the line is sung
  //   'below'  — on its own line UNDER its words, full width, no gutter cost
  //   'leader' — pushed to the right edge, joined by a dotted leader
  //   'gutter' — in a reserved strip down the right; the words stop before it
  notePlacement = 'inline',
  // ── Element 5: writing an inline note ────────────────────────────────────
  // All three are null on every surface but the Reader in practice, and when
  // `onNoteOpen` is null this component behaves exactly as it always has.
  // `noteDraft` is `{ lineIdx, text }` — owned by ReaderSection, because it
  // also has to force the gutter open for a section that has no note yet.
  onNoteOpen = null, noteDraft = null, onNoteDraftChange = null, onNoteCommit = null,
  // Show a `+` in the gutter of lines with no note. True only for the section
  // being read — one per line, over a whole song, is ~30 of them.
  noteHint = false,
  // Element 9. `myInstrument` is what YOU play this service (from the band);
  // a tab for another instrument collapses to one line instead of taking a
  // block of screen you scroll past every section. Null = show everything.
  myInstrument = null,
  // Element 8's overlay, resolved for THIS slot: `[{ line, semitones, offset }]`.
  // When present it REPLACES the section's own `{modulate}` markers as the
  // source of both the chip and the shift — see `lib/keyChanges.js`. Null means
  // "this caller has no overlay", not "this slot has none", so the legacy path
  // stays live for the hub, the tests and anything not yet converted.
  keyMarks = null,
  // The SOUNDING transpose — what the band is in, before the capo is taken off
  // to make shapes. Only the key-change chip uses it; everything else renders
  // from `transpose`. Defaults to `transpose` so a caller with no capo concept
  // (the hub, tests) behaves exactly as before.
  keyTranspose = null,
  tabTranspose = 0,
  // Element 11. When wired, every chord becomes tappable and calls back with
  // the chord AS WRITTEN (letter names, transposed, capo NOT applied) plus the
  // rect to anchor a popover to. Null = chords stay inert, as they always were.
  onChordTap = null,
}) {
  // Reader notation: prefer the explicit `notation` prop; fall back to the
  // legacy boolean `nns` (Nashville on/off) for callers not yet migrated.
  const notationMode = notation ?? (nns ? 'nashville' : 'letters');
  const s = sectionStyle(section.type, sectionColors, customSectionTypes);
  // When an instrument filter is active, only show tabs tagged for it. Untagged
  // tabs are only shown under "all".
  const tabMatches = (inst) => !tabInstrument || tabInstrument === 'all' || inst === tabInstrument;

  // Pre-compute per-line modulate offsets (cumulative within this section).
  //
  // ⚠ `modFires` is what makes a repeat hold its key instead of climbing again.
  // A `{modulate}` lives in the section BODY, so replaying the section replayed
  // the shift — the owner hit this immediately: *"I have C1 and I wanted to add
  // another C1 but because C1 already had the modulate it modulated again."*
  // `sectionModPlan` decides per SLOT whether this occurrence's markers fire;
  // this has to agree with it exactly, or the incoming offset and the in-section
  // offsets describe two different songs.
  const lineOffsets = useMemo(() => {
    // ── The overlay, when the caller has one ────────────────────────────────
    // A mark applies to ITS OWN line and everything after — "the key changes
    // here" means this line is already in the new key. The body-marker path
    // below shifts from the line AFTER the marker instead, because there the
    // marker is a line of its own; `fromBodyMarkers` bridges the two by
    // anchoring to `markerIndex + 1`.
    if (keyMarks) {
      const acc = { running: modOffset };
      return (section.lines || []).map((_, i) => {
        for (const m of keyMarks) if (m.line === i) acc.running = m.offset;
        return acc.running;
      });
    }
    const acc = { running: modOffset };
    return (section.lines || []).map(line => {
      if (typeof line === 'object' && line.type === 'modulate' && (line.every || modFires)) {
        acc.running += line.semitones;
      }
      return acc.running;
    });
  }, [section.lines, modOffset, modFires, keyMarks]);

  // Strip trailing colon from section type and apply user label overrides
  // (e.g. Verse → Strofa, preserving trailing numbers).
  const displayLabel = sectionLabel(section.type, sectionLabels);

  // A note above its line reads as an instruction you act on before singing;
  // a leader-dotted one sits at the right edge like the margin notes on a
  // printed chart, without costing a separate column.
  // ── The `>` ─────────────────────────────────────────────────────────────
  // A note is not a lyric, and until now nothing on screen said so — grey
  // italic text sitting level with the words reads as words (owner, 2026-08-10:
  // *"it acts like a lyric not a note"*, and the same objection to putting one
  // under its line: *"some might think it's a lyric and read it"*).
  //
  // `>` is the mark, and it is the owner's (*"maybe we can use '>' in front of
  // the note"*). It is the right one because the reader ALREADY uses it one
  // level up: `> text` in the `.md` is a band cue on a section heading. Same
  // glyph, same meaning — someone is talking to the band rather than singing —
  // one level down. Nothing new to learn.
  //
  // `aria-hidden` on the mark: a screen reader announcing "greater-than" before
  // every note is noise, and the note's own text is already distinct in the
  // reading order.
  const noteMark = () => (
    <span aria-hidden="true" className="not-italic font-semibold" style={{ opacity: 0.6, marginRight: '0.35em' }}>
      &gt;
    </span>
  );
  const noteAbove = (text) => (
    <div
      className="italic text-[0.8em] leading-snug"
      style={{ color: text.trim().startsWith('!') ? 'var(--ds-red-900)' : 'var(--chart-subtle, var(--text-2))',
               fontStyle: text.trim().startsWith('!') ? 'normal' : 'italic',
               fontWeight: text.trim().startsWith('!') ? 600 : 400 }}
    >
      {noteMark()}{text}
    </div>
  );
  // ── The note gutter ────────────────────────────────────────────────────────
  // A strip down the right that the words stop before, with the notes in it —
  // the owner's *"the right side should be for inline notes"*, made real on a
  // phone. The line becomes a two-cell grid rather than the note being another
  // inline thing on the lyric's row: a grid keeps the strip's edge STRAIGHT
  // down the section, which is what makes it read as a margin instead of as
  // ragged text with words hanging off it.
  //
  // Lines with no note still take the grid, so the text stops at the same
  // place. That is the point — a margin that only some lines respect is not a
  // margin.
  // ⚠ A note must land on ITS OWN LINE, and neither end of the cell is that
  // line. A rendered line is a CHORD ROW ABOVE A LYRIC ROW: align the note to
  // the top and it sits level with the chords (measured 2026-08-06 — note at
  // y=122.9, its words at y=142.9, **20px adrift**, which is what the owner
  // saw); align it to the bottom and a line that wraps to two rows drops it to
  // the last one (50.8px adrift, worse). `baseline` does not help — a flex row
  // of chord-over-lyric columns has no baseline the grid can see.
  //
  // So: top-aligned, offset down by exactly one chord row (`noteGutter`).
  // Re-measured after: note 142.9, lyric 142.9 — 0.0px.
  const gutterGrid = notePlacement === 'gutter'
    ? { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) var(--note-gutter, 88px)', columnGap: '0.5rem', alignItems: 'start' }
    : null;
  // `hasChordRow` — a line rendered with chords ABOVE its words puts a row of
  // chords between the cell's top and the lyric the note belongs to, so the
  // note has to start one chord-row down. `leading-none` on the chord means
  // that row is exactly the chord font size; the +3px is the gap the chord
  // wrapper leaves under it. Measured, then checked back to 0.0px of drift.
  // The field, in the gutter cell, sharing `noteGutter`'s alignment exactly —
  // same size, same one-chord-row offset — so committing does not make the note
  // jump to a different place than the one you typed it in.
  // The empty gutter cell, when a note COULD go there. Same slot, same
  // one-chord-row offset as the note itself, so the `+` stands exactly where
  // its note will.
  // While the gutter is WRITABLE it gets a hairline down its left edge. One
  // rule the length of the section says "this strip is a place" far better than
  // thirty `+` marks say it individually — the marks then read as contents of a
  // column instead of as litter on the chart. Off while reading: a margin you
  // cannot write in does not need announcing.
  const gutterRule = notePlacement === 'gutter' && noteHint && onNoteOpen
    ? { borderLeft: '1px solid var(--chart-rule, var(--border-1))', paddingLeft: '0.5rem' }
    : null;

  const noteInlineHint = (lineIdx) => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onNoteOpen(lineIdx, ''); }}
      aria-label="Add a note to this line"
      title="Add a note to this line"
      // ⚠ `em` on a button resolves against the BUTTON's own font-size, not the
      // line's. `1.7em` at `fontSize: 0.7em` measured 21px, not the ~32 it
      // reads like. The two numbers have to be multiplied on purpose.
      // The `::after` grows the target past the mark, the same trick the ribbon
      // chips use — 32px of chip, ~44px of hit area, no extra line height.
      className="min-h-0 shrink-0 self-end inline-flex items-center justify-center rounded-md border border-dashed bg-transparent cursor-pointer p-0 leading-none font-bold align-middle relative outline-offset-2 after:content-[''] after:absolute after:-inset-[6px]"
      style={{
        width: '2.4em', height: '2.4em', marginLeft: '0.5em',
        fontSize: '0.75em', opacity: 0.85,
        borderColor: 'var(--chart-rule, var(--ds-gray-400))',
        color: 'var(--chart-subtle, var(--text-2))',
      }}
    >
      +
    </button>
  );

  const noteGutterEditor = (hasChordRow = false) => (
    <input
      autoFocus
      value={noteDraft?.text ?? ''}
      maxLength={INLINE_NOTE_MAX_CHARS}
      aria-label="Note for this line"
      placeholder="Note…"
      onChange={(e) => onNoteDraftChange?.(e.target.value)}
      onBlur={() => onNoteCommit?.({ fromBlur: true })}
      onKeyDown={(e) => {
        // Enter commits and OPENS THE NEXT LINE'S note. Marking up a chart is
        // never one note, it is a verse; without this every note costs a tap to
        // re-aim at a line you were already looking at. Escape cancels the
        // draft, blur commits and stops.
        if (e.key === 'Enter') { e.preventDefault(); onNoteCommit?.({ advance: true }); }
        if (e.key === 'Escape') { e.preventDefault(); onNoteDraftChange?.(null); }
      }}
      className="w-full min-h-0 bg-transparent border-0 border-b outline-none self-start"
      style={{
        ...(gutterRule || {}),
        fontSize: '0.72em', fontStyle: 'italic', lineHeight: 1.3,
        color: 'var(--chart-text, var(--text-1))',
        borderColor: 'var(--color-brand)',
        // Same var, same reason as the committed note — the field has to sit
        // exactly where the note it becomes will sit.
        marginTop: hasChordRow
          ? 'calc(var(--chart-font-size-chord, 17px) + 3px)'
          : undefined,
      }}
    />
  );

  // ⚠ An EXISTING note needs no arming. `noteHint` exists to answer "which
  // line?" for a note that isn't there yet; a note that IS there has already
  // answered it, and the mode disarms itself after every write — so gating this
  // on the mode meant the note you had just finished typing was untappable the
  // instant you pressed Enter (owner, 2026-08-09: *"I put a note then I want to
  // re-edit that note and I cannot"*). It shipped carrying `role="button"` and
  // `title="Edit this note"` with no handler at all: a control that announced
  // itself as editable, to sighted users and to a screen reader, and did
  // nothing. Say it does something or say nothing.
  const noteGutter = (text, hasChordRow = false, lineIdx = null) => (
    <span
      {...(onNoteOpen && lineIdx != null ? {
        role: 'button', tabIndex: 0, title: 'Edit this note',
        style: { cursor: 'pointer' },
        onClick: (e) => { e.stopPropagation(); onNoteOpen(lineIdx, text); },
        onKeyDown: (e) => {
          if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onNoteOpen(lineIdx, text); }
        },
      } : null)}
      className="text-[0.72em] leading-snug self-start whitespace-pre-wrap"
      data-note-gutter=""
      style={{ ...(gutterRule || {}),
               color: text.trim().startsWith('!') ? 'var(--ds-red-900)' : 'var(--chart-subtle, var(--text-2))',
               fontStyle: text.trim().startsWith('!') ? 'normal' : 'italic',
               fontWeight: text.trim().startsWith('!') ? 600 : 400,
               marginTop: hasChordRow ? 'calc(var(--chart-font-size-chord, 17px) + 3px)' : 0 }}
    >
      {noteMark()}{text}
    </span>
  );
  const noteLeader = (text) => (
    <span className="flex-1 inline-flex items-baseline gap-1.5 min-w-0 pl-2">
      <span
        aria-hidden="true"
        className="flex-1 self-end mb-[0.35em]"
        style={{ borderBottom: '1px dotted var(--chart-rule, var(--border-1))', minWidth: '1.5rem' }}
      />
      <span
        className="text-[0.78em] shrink-0 leading-snug"
        style={{ color: text.trim().startsWith('!') ? 'var(--ds-red-900)' : 'var(--chart-subtle, var(--text-2))',
                 fontStyle: text.trim().startsWith('!') ? 'normal' : 'italic',
                 fontWeight: text.trim().startsWith('!') ? 600 : 400 }}
      >
        {text}
      </span>
    </span>
  );

  /**
   * The key-change chip. ONE renderer, two callers — the section's own
   * `{modulate}` markers (legacy) and element 8's overlay. They disagreed once
   * already (the capo bug), and a chip drawn twice by two code paths is how
   * that happens again.
   *
   * `offset` is the CUMULATIVE shift in force from this point on; `semitones`
   * is only the fallback label for a song with no key to name an arrival in.
   */
  const keyChangeChip = (key, semitones, offset) => {
    const arriveIn = (t) => notateChord(songKey, {
      key: songKey,
      notation: notationMode === 'nashville' ? 'letters' : notationMode,
      transpose: t + offset,
      accidentals,
    });
    const arriveAt = songKey ? arriveIn(keyTranspose ?? transpose) : null;
    // ── Both keys, when they differ ─────────────────────────────────────────
    // Owner, 2026-08-21: *"we need to do something like ↗ D (E) or show the key
    // that you're supposed to play."* With a capo on, two things are true at
    // once and a guitarist needs both: the band arrives in D, your hands arrive
    // in C. Sounding first, shapes bracketed — the same order and subordination
    // the top bar uses between the key pill and the capo chip. Nothing bracketed
    // without a capo, when it would be the same letter twice.
    const arriveShapes = songKey && (keyTranspose ?? transpose) !== transpose
      ? arriveIn(transpose)
      : null;
    return (
      // ── Trimmed twice, 2026-08-11 ─────────────────────────────────────────
      // It was 68.1px of vertical space against a 22px section heading — 3.1×
      // the heading it sits under, ~8% of a phone viewport, for an event that
      // lasts one bar. Owner: *"it's a bit too big in the reader."* Then again
      // at 46.9: *"I still think we can make it a bit smaller."* The type stays
      // at the chart's chord size — going under it would announce a key change
      // more quietly than the chart names a chord — so the fat that came off
      // was padding and margin, never the arrow, the words or the rule.
      <div key={key} className="mt-2 mb-1 flex items-center gap-2">
        <span
          className="inline-flex items-baseline gap-1 font-black px-2 py-px rounded-md"
          style={{
            // Solid, not tinted: this is a moment the whole band has to hit
            // together, so it reads as loud as it is rare.
            color: 'var(--chart-bg, #fff)',
            background: 'var(--chord)',
            fontSize: 'var(--chart-font-size-chord, 1em)',
            letterSpacing: '0.02em',
          }}
        >
          <span aria-hidden="true">↗</span>
          {arriveAt || `${semitones > 0 ? '+' : ''}${semitones}`}
          {arriveShapes && <span style={{ opacity: 0.72, fontWeight: 700 }}>({arriveShapes})</span>}
        </span>
        <span
          className="text-label-10 uppercase tracking-[0.14em] font-bold"
          style={{ color: 'var(--chord)' }}
        >
          key change
        </span>
        <span className="flex-1 h-px" style={{ background: 'var(--chord)', opacity: 0.35 }} />
      </div>
    );
  };

  const renderLine = (line, idx) => {
    if (typeof line !== 'string') {
      const tabProps = (t) => ({
        data: t,
        scale: tabScale,
        colors: tabColors,
        transpose: tabTranspose,
        writtenKey: songKey,
        // Collapse only when we know what you play AND this is not it.
        collapsible: !!myInstrument,
        defaultOpen: !myInstrument || !t.instrument || t.instrument === myInstrument,
      });
      if (line.type === 'tab') return showTabs && tabMatches(line.instrument) ? <TabBlock key={idx} {...tabProps(line)} /> : null;
      if (line.type === 'tabref') return showTabs && line.tab && tabMatches(line.tab.instrument) ? <TabBlock key={idx} {...tabProps(line.tab)} /> : null;
      if (line.type === 'modulate') {
        // ⚠ SILENT when the caller has an overlay. The overlay replaced these
        // as the source of truth, and a song mid-conversion carries both — so
        // rendering this branch too would draw the same key change twice.
        if (keyMarks) return null;
        // Inert on this occurrence — the key change already happened the first
        // time through. Drawing "↗ A" over a chorus that does not change key is
        // the chart telling a story the chords do not support.
        if (!line.every && !modFires) return null;
        return keyChangeChip(idx, line.semitones, lineOffsets[idx]);
      }
      return null;
    }

    const effectiveTranspose = transpose + lineOffsets[idx];

    // What a tap needs to identify the chord in the STORED song, not on screen.
    // `transpose` travels with it because the chart shows a transposed chord
    // and the `.md` holds the written one — the caller has to invert exactly
    // this number, and composing it again at the other end (user transpose +
    // section modulate + mid-section modulate) is three chances to be wrong.
    const tapMeta = (ordinal) => ({ line: idx, chord: ordinal, transpose: effectiveTranspose });

    // Extract inline notes {!...}
    const noteMatch = line.match(/\{!(.*?)\}/);
    const inlineNote = noteMatch ? noteMatch[1] : null;
    const cleanLine = line.replace(/\{!.*?\}/g, '');

    // Plain text line (no chords) or chords hidden — this branch only renders
    // lyric text, so skip it entirely when lyrics are hidden.
    if (!cleanLine.includes('[') || !showChords) {
      if (!showLyrics) return null;
      const displayLine = !showChords ? cleanLine.replace(/\[.*?\]/g, '') : cleanLine;
      const showNote = inlineNotes && inlineNote;
      return (
        // ⚠ `break-inside: avoid`. A rendered line is a chord row over a lyric
        // row, and in a two-column layout a line box was free to FRAGMENT at
        // the column boundary. It also keeps a chord from being cut off its own
        // words, which is reason enough to have it.
        //
        // ⚠ IT DOES NOT FIX THE ROMANIAN STRAY DOT, and this comment used to
        // claim it did. Re-measured 2026-08-21, after the owner reported it
        // again on every song with ș or ț ON THE LAST LINE, in both
        // orientations:
        //
        //   section box bottom  258.4
        //   last line box bottom 258.4   ← the same pixel, padding-bottom 0
        //
        // The comma under ț / ș (U+021B, U+0219) is INK THAT OVERFLOWS the line
        // box's bottom, and an unfragmented box overflows exactly as happily as
        // a fragmented one. A two-column chart paints that overflow at the top
        // of the NEXT COLUMN, which is the mystery dot. Interior lines never
        // show it — their ink lands in the gap above the next line, where
        // nothing is drawn — so only a section's LAST line has nothing beneath
        // it to hide in.
        //
        // Two fixes were tried and REVERTED, both measured:
        //   · a trailing spacer child in `ReaderSection` — blocked a margin that
        //     had been collapsing out of the section, +26.7px per section
        //     (this file's trap 15, from the other side);
        //   · padding-bottom HERE, on the line row, with a matching negative
        //     margin on the same row — net layout zero, which is also net
        //     EFFECT zero: a section's height is set by its last child's MARGIN
        //     box, so the negative margin pulled the section's bottom edge back
        //     up and the box never grew.
        //
        // ⚠ FIXED 2026-08-23, on the SECTION rather than on this row — see
        // `--chart-ink-slack` at the section root below. The section's bottom
        // margin is external and collapses out of its border box, so moving a
        // couple of pixels from that margin into the section's padding grows
        // the box without moving anything on screen. Measured in the reader,
        // lyrics mode (the exposed case — a chorded row already carries 8px
        // under it): section box bottom 255.98 / last line box bottom 255.98
        // before, 257.98 / 255.98 after.
        //
        // ⚠ So do NOT give this row a bottom margin of 0 and assume the ink is
        // safe — it is safe because the SECTION holds room for it.
        <div
          key={idx}
          style={{
            ...(gutterGrid || {}),
            breakInside: 'avoid',
            // ⚠ A lyric-only line had NO gap under it while a chorded line had
            // 8px, so on a chart a plain line ran straight into the chord row of
            // the line below it — measured 2026-08-10: "Amazing grace…" bottom
            // 167.2 → next line 175.2 (8px), but "That saved a wretch like me"
            // bottom 199.5 → the next line's chords at 199.5 (0px). It reads as
            // that line having grabbed the chords underneath it.
            //
            // Only when chords are on. In Lyrics mode every line comes through
            // here and the tight 24.3px rhythm is what a lyric sheet should be —
            // measured before and after to be byte-identical there.
            marginBottom: showChords ? 8 : 0,
          }}
        >
          {showNote && notePlacement === 'above' && noteAbove(inlineNote)}
          <div
            className={notePlacement === 'leader' ? 'min-h-[1.3em] flex items-baseline opacity-90' : 'min-h-[1.3em] whitespace-pre-wrap opacity-90'}
            style={{
              // `--chart-lyric`, not `--chart-text`: the ink token paints the
              // reader's chrome too. See `useChartTheme`.
              color: 'var(--chart-lyric, var(--chart-text, var(--text-1)))',
              // The FONT has to be here, not on an ancestor. `ChartView` put it
              // on its own wrapper (`CHART_THEME_STYLE`), so the lyric font
              // worked there and silently did nothing in the Reader, which has
              // no such wrapper — the picker wrote a setting nobody read. Chords
              // always worked because their font is set on the chord span below.
              fontFamily: 'var(--chart-font-lyric, var(--font-sans))',
              lineHeight: 'var(--chart-line-height-lyric, 1.35)',
            }}
          >
            {/* Not a note target either — see the chorded branch below. */}
            <span className="whitespace-pre-wrap">{displayLine}</span>
            {noteHint && onNoteOpen && !showNote && noteDraft?.lineIdx !== idx && noteInlineHint(idx)}
            {showNote && notePlacement === 'inline' && (
              <span className="italic text-[0.8em]" style={{ color: 'var(--chart-subtle, var(--text-2))' }}>
                {NOTE_SEPARATORS[noteStyle] || NOTE_SEPARATORS.dashes}{inlineNote}
              </span>
            )}
            {showNote && notePlacement === 'leader' && noteLeader(inlineNote)}
          </div>
          {showNote && notePlacement === 'below' && noteAbove(inlineNote)}
          {notePlacement === 'gutter' && (
            noteDraft?.lineIdx === idx ? noteGutterEditor()
              : showNote ? noteGutter(inlineNote, false, idx)
              : <span />
          )}
        </div>
      );
    }

    // Parse into chord+text pairs using the parser. When lyrics are hidden,
    // drop the text so the line renders chords-only.
    const parsedPairs = parseLine(cleanLine);
    const pairs = showLyrics ? parsedPairs : parsedPairs.map(p => ({ ...p, text: '' }));
    const hasLyrics = pairs.some(p => p.text.trim());

    // Chord spacing, which is a balance of two failures:
    //   - a fixed trailing space on EVERY chord shoves lyrics apart whenever
    //     one chord is long (Asus7maj3) and nothing follows it
    //   - no spacing at all lets neighbouring chords collide
    //
    // The rule used to be all-or-nothing: a chord kept a FIXED 0.6em gap
    // whenever any chord followed it later on the line, and only overhung when
    // it was the last one. Measured on "Apă vie" at 390px, that fixed gap was
    // the whole problem — every chord demanded `ink 20.4px + margin 10.2px =
    // 30.6px`, so every word narrower than 30.6px was padded out to it:
    //
    //     "va"  ink 19.2 -> box 30.6   10.2px dead
    //     "Ca"  ink 22.5 -> box 30.6    8.1px dead
    //     "Mă"  ink 25.5 -> box 30.6    5.1px dead
    //
    // 10.2 / 28.4 / 56.1px of dead space on three consecutive lines, and the
    // clearance was being demanded from the chord's OWN word while the next
    // chord was often five words away with nothing in between to collide with
    // (owner, 2026-08-10: *"I'm ok with some spaces if there are some crowded
    // sections, but on empty sections I don't think that is a problem if a
    // chord overflows to an empty word that doesn't have another chord"*).
    //
    // So clearance is now what is MISSING, not a constant: a chord asks only
    // for the room its own name needs beyond the room the words between it and
    // the next chord already provide. Sparse line -> nothing is asked for and
    // the chord overhangs. Crowded line -> exactly the shortfall.
    //
    // ⚠ It is arithmetic in CSS `calc`, not in JS, on purpose: the two font
    // SIZES are CSS variables the user can change at any moment (`Aa`), and a
    // number baked in at render would be stale the instant they did. JS
    // contributes only what CSS cannot count — how many characters are in the
    // way. `max(0px, …)` is what makes "there is already enough room" mean zero
    // rather than a negative margin that would pull the next word backwards.
    //
    // The two per-character constants are measured, and deliberately asymmetric:
    // the chord font is monospace, so 0.6em is EXACT (Geist Mono at 17px
    // measures 10.2px a character); the lyric font is proportional and measured
    // between 0.41em ("suflet,") and 0.63em ("Ca"), so the room estimate uses
    // the LOW end. Under-estimating the room a line offers errs toward a gap
    // that is slightly too big — which is the old behaviour, i.e. safe. Over-
    // estimating it would let two chords touch, which is not.
    //
    // `ordinal` is the chord's index among the chords ON THIS LINE, counted in
    // document order. Edit mode needs it: `onChordTap` used to hand back only
    // the DISPLAYED chord name, which cannot say *which* G was tapped when a
    // line has three of them.
    //
    // It is computed explicitly from `pairs`, never from the order these
    // callbacks happen to fire in — a counter incremented inside this function
    // would be correct today and wrong the moment anything renders a line twice
    // or out of order, and a chord edit landing on the wrong occurrence is
    // invisible until somebody plays it.
    // `clearance` is a CSS length (possibly `0px`), or `null` for "overhang":
    // contribute no width at all and simply paint across whatever follows.
    const renderChord = (rawChord, clearance, ordinal = -1) => {
      let chord = notateChord(rawChord, { key: songKey, notation: notationMode, transpose: effectiveTranspose, accidentals });
      // Shapes are keyed by letter name, so a chart displayed in Nashville
      // still has to look up "G" — you cannot finger a "1".
      const shapeName = notationMode === 'letters'
        ? chord
        : notateChord(rawChord, { key: songKey, notation: 'letters', transpose: effectiveTranspose, accidentals });
      // `role="button"`, not <button>: these sit inside lyric lines, and the
      // app's `button { min-height: 36px }` base rule would give every chord a
      // 36px box (44px on a phone) and blow the line spacing apart.
      const tap = onChordTap
        ? {
          role: 'button',
          tabIndex: 0,
          'aria-label': `${shapeName} chord shape`,
          // How `ChordPopover` recognises a chord under its backdrop. Without
          // it the backdrop swallows every tap while the popover is open, so
          // moving from one chord to the next costs two taps — see the note
          // there.
          'data-chord-tap': '',
          onClick: (e) => {
            // ⚠ Stop the bubble. Element 5 puts a note-opening click on the
            // line wrapper, and a chord sits INSIDE it — without this, tapping
            // a chord would fire both, opening a note behind the chord popover.
            e.stopPropagation();
            onChordTap(shapeName, e.currentTarget.getBoundingClientRect(), tapMeta(ordinal));
          },
          onKeyDown: (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            onChordTap(shapeName, e.currentTarget.getBoundingClientRect(), tapMeta(ordinal));
          },
        }
        : {};
      return (
        <span
          {...tap}
          className={`font-bold text-[var(--chord)] leading-none select-none whitespace-nowrap${onChordTap ? ' cursor-pointer' : ''}`}
          style={{
            paddingBottom: hasLyrics ? 3 : 0,
            fontFamily: 'var(--chart-font-chord, var(--font-mono))',
            fontSize: 'var(--chart-font-size-chord, 0.95em)',
            // `clearance === null` — nothing on the chord row can collide with
            // it, so it contributes no width and overhangs the words after it.
            ...(clearance === null
              ? { display: 'block', width: 0, overflow: 'visible' }
              : { marginRight: clearance }),
          }}
        >
          {chord}
        </span>
      );
    };

    // With lyrics: group into whole words so wrapping happens only at spaces.
    // Without lyrics (chord-only / instrumental): render chords inline as-is.
    return (
      <div
        key={idx}
        className="last:mb-0"
        style={{
          // The gap between LINES, and it is its own number.
          //
          // It used to be `calc(var(--chart-section-gap) / 3)`, so "Between
          // sections" quietly moved the lyrics apart too — take the section gap
          // from 24 to 48 and every line inside every section went from 8px to
          // 16px (owner, 2026-08-04: "I think that between sections also
          // increases the distance between lyrics, can you make sure it only
          // does for the sections?"). 8px IS 24/3, so the default look is
          // unchanged; the two are simply no longer wired together.
          //
          // ⚠ It is a plain 8px now. It used to read a `--chart-line-gap`
          // custom property that NOTHING ever wrote — set nowhere, so the
          // fallback was the only value it ever had. A var nobody writes tells
          // the next reader "this is configurable" and it is not, which is a
          // more expensive lie than a number. There is already "Line spacing"
          // (the space INSIDE a wrapped line) and "Between sections"; a third
          // slider would be indistinguishable from the first to anyone not
          // holding the code. If a user ever asks for more room between lines,
          // that is the moment it becomes a setting with a reason.
          //
          // ⚠ It used to be `hasLyrics ? gap : 0`, so a CHORD-ONLY line — an
          // intro or an instrumental, `[G] [C] [D] [Em]` — got no gap at all and
          // sat directly on the lyric of the line beneath it, reading as that
          // line's chords. A line is a line; the gap below it does not depend on
          // whether anybody sings during it.
          marginBottom: 8,
          lineHeight: 1,
        }}
      >
        {inlineNotes && inlineNote && notePlacement === 'above' && noteAbove(inlineNote)}
        <div style={{ ...(gutterGrid || {}), breakInside: 'avoid' }}>
        {/* ⚠ The lyric is NOT a note target. It was, while notes had their own
            arming mode: "tap the line your note belongs to" made the whole line
            the button. That mode is gone, and with it the biggest tap target on
            the page listening for a gesture nobody aimed at it — which is what
            opened a note field on any tap anywhere, gutter included. The note
            lives in the gutter; the gutter is where you tap for it. */}
        <div className="flex flex-wrap items-end">
          {hasLyrics
            ? (() => {
                const words = groupChordWords(pairs);
                // One list in document order — segments and the gaps between
                // words — so each chord can be asked what lies between it and
                // the next one.
                const flat = [];
                words.forEach((w, wi) => {
                  if (w.space) { flat.push({ wi, si: -1, chord: null, space: true, text: '' }); return; }
                  w.segments.forEach((seg, si) => flat.push({
                    wi, si, chord: seg.chord, space: false,
                    // An empty segment still renders one NBSP (see the lyric
                    // span below), so it is one character wide, not zero.
                    text: seg.text || (seg.chord ? ' ' : ''),
                  }));
                });
                // How much room a chord has before the NEXT chord starts — the
                // characters and word gaps it may paint across. It counts from
                // the chord's own segment, because a chord is drawn from the
                // left edge of its own word.
                //
                // ⚠ Every chord LATER on the line, not merely the next segment.
                // Checking only the neighbour let a chord two segments away
                // overlap the one overhanging into its space.
                const roomAfter = (wi, si) => {
                  const at = flat.findIndex(f => f.wi === wi && f.si === si);
                  let chars = 0;
                  let gaps = 0;
                  let more = false;
                  for (let i = at; i < flat.length; i++) {
                    if (i > at && flat[i].chord) { more = true; break; }
                    if (flat[i].space) gaps += 1;
                    else chars += flat[i].text.length;
                  }
                  return { chars, gaps, more };
                };
                // `groupChordWords` regroups pairs into words but preserves
                // their order, so counting chords across `flat` gives the same
                // ordinal as counting `[...]` tokens in the source line.
                const chordsInOrder = flat.filter(f => f.chord);
                const ordinalOf = (wi, si) => chordsInOrder.findIndex(f => f.wi === wi && f.si === si);

                // What trailing clearance this chord needs, as a CSS length —
                // or `null` for "none at all, overhang freely".
                const clearanceFor = (seg, wi, si) => {
                  const { chars, gaps, more } = roomAfter(wi, si);
                  // Nothing on the chord row can collide with it.
                  if (!more) {
                    // ⚠ …but a chord with NO WORD under it still takes a real
                    // width. Overhanging costs nothing to lose here — there are
                    // no words after it to shove — and it costs the one thing
                    // that keeps the chord ON SCREEN: a zero-width box is
                    // invisible to the flex row, so the row cannot wrap on its
                    // account and the chart's right padding cannot contain it.
                    // Measured at 390px on "Apă vie" (owner: *"the chords are
                    // almost exiting the screen in the right side"*) — a
                    // trailing `Bb` painted 6.0px past the content edge, a `Cm`
                    // 9.3px past with 2.7px of window left, and a `Cmaj9` 27.1px
                    // past it and 15.1px BEYOND THE WINDOW. A real width makes
                    // the row wrap it, which is the right answer to "it does not
                    // fit"; the clearance is still 0, so it costs no air.
                    //
                    // ⚠ `gaps > 0` — overhang only when there is another WORD
                    // after this one to paint across. A chord over the last word
                    // on the line has nothing to overhang into, so a zero-width
                    // box buys it nothing and costs it the same containment:
                    // measured in solfège (whose names run to four characters —
                    // "Fa#m", "Sol") a final chord painted 7.3px off the right
                    // edge. Everywhere else the overhang is exactly what the
                    // owner asked for (2026-08-10: *"I don't think that is a
                    // problem if a chord overflows to an empty word that doesn't
                    // have another chord"*).
                    return seg.text && gaps > 0 ? null : '0px';
                  }
                  // The shortfall, in CSS so it tracks both font sizes live.
                  // ⚠ The length of the chord AS DISPLAYED — "1maj7" in
                  // Nashville and "Gmaj7" in letters are not the same width, and
                  // an Ab respelled G# is not the same width as Ab.
                  const shown = notateChord(seg.chord, {
                    key: songKey, notation: notationMode, transpose: effectiveTranspose, accidentals,
                  });
                  const need = `${shown.length} * ${CHORD_CHAR_EM} * var(--chart-font-size-chord, 17px) + ${CHORD_MIN_GAP_PX}px`;
                  const have = `${chars} * ${LYRIC_CHAR_EM} * var(--chart-font-size-lyric, 18px) + ${gaps} * var(--chart-word-gap-em, ${WORD_GAP_EM}) * var(--chart-font-size-lyric, 18px)`;
                  return `max(0px, calc(${need} - (${have})))`;
                };
                return words.map((w, wi) => (
                w.space ? (
                  // ── The word gap, and why it is named ──────────────────────
                  // This span carries no font of its own, so until now the gap
                  // between two words on a CHORDED line was whatever space
                  // glyph the surrounding surface happened to supply. Measured
                  // 2026-08-10 on the same song at 390px: the old PracticeView
                  // hard-codes `fontFamily: var(--font-mono)` on its chart
                  // wrapper, so its spaces were Geist Mono — **10.81px** — while
                  // the Reader sets no font, so its spaces were Geist Sans —
                  // **4.50px**. Same words (Geist Sans 18px, "Amazing" = 71.97px
                  // in both), gaps 2.4× apart. That difference, and nothing
                  // else, is the "the old chart feels more airy" the owner
                  // reported: the old surface was accidentally setting words in
                  // one font and the spaces between them in another.
                  //
                  // A chord line wants the wider gap — it is the room a chord
                  // sits in — so it is kept, as a real declared width instead of
                  // an inherited-font accident. It shipped at the old chart's
                  // 0.6em and came back as too wide once the chords stopped
                  // fighting for room; `WORD_GAP_EM` is the one place it lives.
                  // Plain lyric lines are one text run and never reach here, so
                  // prose keeps its natural spacing exactly as before.
                  //
                  // `flexShrink: 0`: the words either side are `nowrap` and
                  // cannot shrink, so a shrinkable gap would be the only thing
                  // giving way under pressure — the gaps would quietly close up
                  // on the longest line of the song, which is the one line that
                  // most needs them.
                  <span
                    key={wi}
                    style={{
                      whiteSpace: 'pre',
                      display: 'inline-block',
                      width: `calc(var(--chart-word-gap-em, ${WORD_GAP_EM}) * 1em)`,
                      flexShrink: 0,
                    }}
                  >
                    {w.space}
                  </span>
                ) : (
                  <span key={wi} className="inline-flex items-end" style={{ whiteSpace: 'nowrap' }}>
                    {w.segments.map((seg, si) => (
                      <span key={si} className="inline-flex flex-col justify-end">
                        {seg.chord && renderChord(seg.chord, clearanceFor(seg, wi, si), ordinalOf(wi, si))}
                        <span
                          className="whitespace-pre"
                          style={{
                            position: 'relative',
                            color: 'var(--chart-lyric, var(--chart-text, var(--text-1)))',
                            fontFamily: 'var(--chart-font-lyric, var(--font-sans))',
                            lineHeight: 'var(--chart-line-height-lyric, 1.25)',
                          }}
                        >
                          {seg.text || (seg.chord ? '\u00A0' : '')}
                          {/* \u2500\u2500 The word-join mark \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
                              A chord can land in the MIDDLE of a word, and when
                              its name needs more room than the syllable under it
                              the clearance opens a gap inside the word itself:
                              measured, `[Cmaj7]ran[G]somed` renders "ran" +
                              56.9px + "somed", which reads as two words (owner,
                              2026-08-10: *"if we break words we should use a
                              form of --- or something so that users know that is
                              a single word"*).

                              \u26A0 It cannot be a JS decision. Whether the gap
                              EXISTS is decided by a CSS `max(0px, calc(\u2026))` that
                              only the browser resolves, so the mark decides for
                              itself: a box of exactly the clearance width, sat
                              on the gap (which is always at the RIGHT of the
                              syllable, because the text is left-aligned in a
                              column the chord widened), with the dash centred
                              and `overflow: hidden`. Zero clearance, zero width,
                              nothing drawn \u2014 the three other mid-word cases
                              measured on the same run resolve to 0px and stay
                              invisible.

                              \u26A0 ABSOLUTE, and that is the whole trick. In flow it
                              was measured adding **7.5px** \u2014 the dash's own
                              width \u2014 to every syllable it was meant to say
                              nothing about, because a flex item's `flex-basis:
                              0` still contributes its max-content size to the
                              COLUMN's intrinsic width. Out of flow it costs
                              exactly nothing when there is nothing to say.

                              `aria-hidden`: it repairs a layout artefact, not
                              the text. A screen reader reads "ransomed" from two
                              adjacent nodes and was never confused; a spoken
                              "ran-dash-somed" would be the only broken reading
                              of that word on the page. */}
                          {si < w.segments.length - 1 && seg.chord && (
                            <span
                              aria-hidden="true"
                              style={{
                                position: 'absolute',
                                right: 0,
                                // A RULE, not a hyphen character. A glyph in a
                                // box narrower than itself is a clipped glyph:
                                // measured, `Hallelu[jah]` left 2.1px of
                                // clearance and drew a 2.1px sliver of a "-",
                                // which reads as damage rather than as a mark. A
                                // rule is the same shape at every width — 32px
                                // of it is a long dash, 2px of it is a tick, and
                                // neither is broken. It also cannot be mistaken
                                // for a hyphen the writer actually typed.
                                width: clearanceFor(seg, wi, si) || 0,
                                top: '45%',
                                height: 0,
                                borderTopWidth: 1,
                                borderTopStyle: 'solid',
                                borderTopColor: 'currentColor',
                                opacity: 0.4,
                              }}
                            />
                          )}
                        </span>
                      </span>
                    ))}
                  </span>
                )
              )); })()
            : pairs.map((p, i) => (
                <span key={i} className="inline-flex flex-col justify-end">
                  {/* Chord-only line (an intro, an instrumental): there are no
                      words to overhang across, so every chord takes its width
                      and one word gap of air. */}
                  {p.chord && renderChord(
                    p.chord,
                    `calc(var(--chart-word-gap-em, ${WORD_GAP_EM}) * 1em)`,
                    pairs.slice(0, i).filter(q => q.chord).length,
                  )}
                </span>
              ))}
          {inlineNotes && inlineNote && notePlacement === 'inline' && (
            <span
              className="italic text-[0.8em] self-end"
              style={{ color: 'var(--chart-subtle, var(--text-2))' }}
            >
              {NOTE_SEPARATORS[noteStyle] || NOTE_SEPARATORS.dashes}{inlineNote}
            </span>
          )}
          {inlineNotes && inlineNote && notePlacement === 'leader' && noteLeader(inlineNote)}
          {noteHint && onNoteOpen && !(inlineNotes && inlineNote) && noteDraft?.lineIdx !== idx && noteInlineHint(idx)}
        </div>
        {inlineNotes && inlineNote && notePlacement === 'below' && noteAbove(inlineNote)}
        {notePlacement === 'gutter' && (
          noteDraft?.lineIdx === idx ? noteGutterEditor(true)
            : (inlineNotes && inlineNote) ? noteGutter(inlineNote, true, idx)
            : <span />
        )}
        </div>
      </div>
    );
  };

  // Condensed: a repeated section collapses to just its header + a "repeat"
  // affordance (no chords/lyrics/tabs). Tapping jumps to the first occurrence.
  if (condensed) {
    const Tag = onJumpToFirst ? 'button' : 'div';
    return (
      <Tag
        type={onJumpToFirst ? 'button' : undefined}
        onClick={onJumpToFirst}
        aria-label={onJumpToFirst ? `${displayLabel} — repeat, jump to first occurrence` : undefined}
        className={`break-inside-avoid w-full flex items-center gap-3 text-left rounded-lg px-3 py-2 border bg-[var(--bg-1)] ${onJumpToFirst ? 'cursor-pointer hover:border-[var(--border-3)] transition-colors' : ''}`}
        style={{ marginBottom: 'var(--chart-section-gap, 24px)', borderColor: s.br }}
      >
        <span className="text-label-14 font-black uppercase tracking-[0.15em]" style={{ color: s.b }}>
          {displayLabel}
        </span>
        {section.note && (
          <span className="text-label-11 italic px-1 border-l-2" style={{ borderColor: s.br, color: 'var(--chart-subtle, var(--text-2))' }}>
            {section.note}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-label-11 text-[var(--text-2)] shrink-0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          Repeat
        </span>
      </Tag>
    );
  }

  return (
    <div
      className="break-inside-avoid"
      style={{
        // ── The Romanian dot, second mechanism ─────────────────────────────
        // A ț (U+021B) carries a real descender comma, and MEASURED in Geist
        // its ink sits BELOW the line box at ordinary settings:
        //
        //   18px / 1.35  →  0.65px of clearance
        //   18px / 1.25  →  −0.25px   ← ink is outside the box
        //   24px / 1.25  →  −0.5px
        //   18px / 1.00  →  −2.5px
        //
        // (Line spacing is a stepper from 100% to 240%, so 1.00 is reachable,
        // and even the DEFAULT has under a pixel to spare.)
        //
        // The section's border box therefore ends ABOVE its own last line's
        // ink. `break-inside: avoid` keeps the border box in one column — but
        // the ink hanging below it is not in any column. In the tallest column
        // of a balanced pair the bottom margin is truncated at the break, so
        // the column ends exactly at that border box, and WebKit paints the
        // overhang at the TOP OF THE NEXT COLUMN: a comma alone above the next
        // section's heading, at the same x-offset as the word it came from.
        //
        // ⚠ This is NOT the bug 76d713d fixed. That one was the LINE BOX
        // fragmenting (`break-inside: auto`), and the `avoid` it added is still
        // right and still needed. This is the ink of an UNFRAGMENTED line
        // escaping an unfragmented box — the same symptom by a second route,
        // which is why it came back.
        //
        // The fix is to make the border box taller than the ink and take the
        // difference back out of the margin, so the rhythm is IDENTICAL and
        // only the box grows. Sized from the same two variables the shortfall
        // is: `fs × (0.68 − lh/2)` is the overhang, floored at 2px because the
        // default's sub-pixel clearance is one rounding away from zero.
        //
        // ⚠ The difference from the attempt that was tried and reverted is
        // WHICH BOX carries the padding. That one put it on the LINE row with a
        // matching negative margin on the same row — and a section's height is
        // set by its last child's MARGIN box, so the negative margin pulled the
        // section's own bottom edge straight back up and the section box never
        // grew. Here the padding is on the SECTION, whose bottom margin is
        // external and collapses out of the box entirely; taking 2px out of a
        // margin that lives outside the border box cannot pull the border box
        // up after it. Same visual gap, and this time the box really is taller.
        ['--chart-ink-slack']:
          'max(2px, calc(var(--chart-font-size-lyric, 18px) * (0.68 - var(--chart-line-height-lyric, 1.35) / 2)))',
        paddingBottom: 'var(--chart-ink-slack)',
        marginBottom: 'max(0px, calc(var(--chart-section-gap, 24px) - var(--chart-ink-slack)))',
        lineHeight: 'var(--chart-line-height-lyric, 1.35)',
      }}
    >
      {!hideHeading && (
        <div className="flex items-center gap-4 mb-2">
          <div className="flex flex-col">
            <span className="text-label-14 font-black uppercase tracking-[0.15em]" style={{ color: s.b }}>
              {displayLabel}:
            </span>
            {section.note && (
              <span
                className="text-label-11 italic mt-1 px-1 ml-0.5 border-l-2"
                style={{ borderColor: s.br, color: 'var(--chart-subtle, var(--text-2))' }}
              >
                {section.note}
              </span>
            )}
          </div>
          <div className="h-[1px] flex-1 bg-[var(--border-1)] opacity-20" />
        </div>
      )}
      <div>
        {(section.lines || []).map((line, i) => {
          // An overlay mark is drawn BEFORE the line it applies to, because
          // "the key changes here" means this line is already in the new key.
          const marks = keyMarks ? keyMarks.filter(m => m.line === i) : null;
          const body = renderLine(line, i);
          if (!marks || marks.length === 0) return body;
          return (
            <Fragment key={`l${i}`}>
              {marks.map((m, j) => keyChangeChip(`kc${i}-${j}`, m.semitones, m.offset))}
              {body}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
