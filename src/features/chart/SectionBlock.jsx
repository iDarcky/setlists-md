import { useMemo } from 'react';
import { notateChord, sectionStyle, sectionLabel } from '@/music';
import { parseLine, INLINE_NOTE_MAX_CHARS } from '@/parser';
import TabBlock from './TabBlock';

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
  section, transpose, modOffset = 0, nns, notation, songKey, accidentals = 'auto',
  showChords = true, showLyrics = true, showTabs = true, inlineNotes = true, noteStyle = 'dashes',
  sectionColors, sectionLabels, customSectionTypes, tabScale = 1, tabColors, tabInstrument = 'all',
  condensed = false, onJumpToFirst,
  // The reader renders its own (sticky) heading above this block, so it asks
  // for the body only. Default false keeps every existing caller unchanged.
  hideHeading = false,
  // Where a {!note} goes relative to its lyric line:
  //   'inline' — trailing the line, separated by dashes (default, unchanged)
  //   'above'  — on its own line ABOVE, so it is read before the line is sung
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

  // Pre-compute per-line modulate offsets (cumulative within this section)
  const lineOffsets = useMemo(() => {
    const acc = { running: modOffset };
    return (section.lines || []).map(line => {
      if (typeof line === 'object' && line.type === 'modulate') {
        acc.running += line.semitones;
      }
      return acc.running;
    });
  }, [section.lines, modOffset]);

  // Strip trailing colon from section type and apply user label overrides
  // (e.g. Verse → Strofa, preserving trailing numbers).
  const displayLabel = sectionLabel(section.type, sectionLabels);

  // A note above its line reads as an instruction you act on before singing;
  // a leader-dotted one sits at the right edge like the margin notes on a
  // printed chart, without costing a separate column.
  const noteAbove = (text) => (
    <div
      className="italic text-[0.8em] leading-snug"
      style={{ color: text.trim().startsWith('!') ? 'var(--ds-red-900)' : 'var(--chart-subtle, var(--text-2))',
               fontStyle: text.trim().startsWith('!') ? 'normal' : 'italic',
               fontWeight: text.trim().startsWith('!') ? 600 : 400 }}
    >
      {text}
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

  const noteGutterHint = (lineIdx, hasChordRow = false) => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onNoteOpen(lineIdx, ''); }}
      aria-label="Add a note to this line"
      className="min-h-0 self-start text-left bg-transparent border-none cursor-pointer p-0"
      style={{
        ...(gutterRule || {}),
        fontSize: '0.72em', lineHeight: 1.3, opacity: 0.4,
        color: 'var(--chart-subtle, var(--text-2))',
        // ⚠ `--chart-font-size-chord`, not `--chart-chord-size`. The latter is
        // written by nobody, so this resolved to `1em` — and `1em` HERE is the
        // button's own 0.72em text, i.e. 12.96px + 3px = 16px against the
        // committed note's 20px. The `+` and the field you typed in sat 4px
        // above the note they turned into.
        marginTop: hasChordRow ? 'calc(var(--chart-font-size-chord, 17px) + 3px)' : undefined,
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
        // Same var, same reason as `noteGutterHint` above — the field has to
        // sit exactly where the note it becomes will sit.
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
      {text}
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
        // Element 8. Was a full-width brand pill between two rules — the
        // loudest thing on the page for an event that lasts one bar. Now a
        // compact inline chip that names the key you are ARRIVING IN, because
        // that is what a player needs ("we're in Bb now"), not the interval.
        const arriveAt = songKey
          ? notateChord(songKey, {
              key: songKey,
              notation: notationMode === 'nashville' ? 'letters' : notationMode,
              transpose: transpose + lineOffsets[idx],
              accidentals,
            })
          : null;
        return (
          <div key={idx} className="mt-5 mb-4 flex items-center gap-2">
            <span
              className="inline-flex items-baseline gap-1.5 font-black px-2.5 py-1 rounded-lg"
              style={{
                // Solid, not tinted: this is a moment the whole band has to
                // hit together, so it reads as loud as it is rare.
                color: 'var(--chart-bg, #fff)',
                background: 'var(--chord)',
                fontSize: 'calc(var(--chart-font-size-chord, 1em) * 1.05)',
                letterSpacing: '0.02em',
              }}
            >
              <span aria-hidden="true">↗</span>
              {arriveAt || `${line.semitones > 0 ? '+' : ''}${line.semitones}`}
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
        // the column boundary — which is how the comma under a Romanian ț
        // (U+021B, a real descender, not an accent) ended up alone at the top
        // of the next column, reading as a mystery dot on somebody's chart
        // mid-rehearsal. It also kept a chord from being cut off its own words.
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
            marginBottom: showChords ? 'var(--chart-line-gap, 8px)' : 0,
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
            {showNote && notePlacement === 'inline' && (
              <span className="italic text-[0.8em]" style={{ color: 'var(--chart-subtle, var(--text-2))' }}>
                {NOTE_SEPARATORS[noteStyle] || NOTE_SEPARATORS.dashes}{inlineNote}
              </span>
            )}
            {showNote && notePlacement === 'leader' && noteLeader(inlineNote)}
          </div>
          {notePlacement === 'gutter' && (
            noteDraft?.lineIdx === idx ? noteGutterEditor()
              : showNote ? noteGutter(inlineNote, false, idx)
              : (noteHint && onNoteOpen) ? noteGutterHint(idx)
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
    // So: a chord keeps a real gap whenever ANY chord follows it later on the
    // line, and only overhangs (contributing no width) when it is the last
    // chord there — where nothing on the chord row can collide with it.
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
    const renderChord = (rawChord, padded, ordinal = -1) => {
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
            // `padded === false` means this is the last chord on the line, so
            // it contributes no width and simply overhangs the words after it.
            ...(padded
              ? { marginRight: '0.6em' }
              : { display: 'block', width: 0, overflow: 'visible' }),
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
          // ⚠ It used to be `hasLyrics ? gap : 0`, so a CHORD-ONLY line — an
          // intro or an instrumental, `[G] [C] [D] [Em]` — got no gap at all and
          // sat directly on the lyric of the line beneath it, reading as that
          // line's chords. A line is a line; the gap below it does not depend on
          // whether anybody sings during it.
          marginBottom: 'var(--chart-line-gap, 8px)',
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
                // Flatten to decide, per chord, whether another chord follows
                // right after it. Only then does it need trailing clearance.
                const flat = [];
                words.forEach((w, wi) => {
                  if (w.space) { flat.push({ wi, si: -1, chord: null }); return; }
                  w.segments.forEach((seg, si) => flat.push({ wi, si, chord: seg.chord }));
                });
                // Any chord later on this line — not merely the next segment.
                // Checking only the neighbour let a chord two segments away
                // overlap the one overhanging into its space.
                const chordFollows = (wi, si) => {
                  const at = flat.findIndex(f => f.wi === wi && f.si === si);
                  return flat.slice(at + 1).some(f => f.chord);
                };
                // `groupChordWords` regroups pairs into words but preserves
                // their order, so counting chords across `flat` gives the same
                // ordinal as counting `[...]` tokens in the source line.
                const chordsInOrder = flat.filter(f => f.chord);
                const ordinalOf = (wi, si) => chordsInOrder.findIndex(f => f.wi === wi && f.si === si);
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
                  // an inherited-font accident. 0.6em of the lyric size is
                  // 10.8px at the 18px default, i.e. what the old chart drew.
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
                      width: 'var(--chart-word-gap, 0.6em)',
                      flexShrink: 0,
                    }}
                  >
                    {w.space}
                  </span>
                ) : (
                  <span key={wi} className="inline-flex items-end" style={{ whiteSpace: 'nowrap' }}>
                    {w.segments.map((seg, si) => (
                      <span key={si} className="inline-flex flex-col justify-end">
                        {/* ⚠ `|| !seg.text` — a chord with NO WORD under it
                            always takes its real width.
                            Overhanging (width 0) exists so the last chord does
                            not shove the words after it apart; a chord with no
                            word has nothing after it to shove, so the overhang
                            buys nothing — and it costs the chart the only thing
                            that keeps a chord on screen. A zero-width box is
                            invisible to the flex row, so the row never wraps on
                            its account and the chart's right padding does not
                            contain it: the ink just paints out of the box and
                            off the edge. Measured at 390px on "Apă vie" (owner,
                            2026-08-10: *"the chords are almost exiting the
                            screen in the right side"*) — a trailing `Bb` ended
                            6.0px past the chart's content edge, a `Cm` 9.3px
                            past with 2.7px of window left, and a `Cmaj9`
                            27.1px past the content edge and **15.1px beyond the
                            window** — genuinely off the phone. With a real
                            width the row wraps it instead, which is the correct
                            answer to "it does not fit". */}
                        {seg.chord && renderChord(seg.chord, chordFollows(wi, si) || !seg.text, ordinalOf(wi, si))}
                        <span
                          className="whitespace-pre"
                          style={{
                            color: 'var(--chart-lyric, var(--chart-text, var(--text-1)))',
                            fontFamily: 'var(--chart-font-lyric, var(--font-sans))',
                            lineHeight: 'var(--chart-line-height-lyric, 1.25)',
                          }}
                        >
                          {seg.text || (seg.chord ? '\u00A0' : '')}
                        </span>
                      </span>
                    ))}
                  </span>
                )
              )); })()
            : pairs.map((p, i) => (
                <span key={i} className="inline-flex flex-col justify-end">
                  {p.chord && renderChord(p.chord, true, pairs.slice(0, i).filter(q => q.chord).length)}
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
        </div>
        {notePlacement === 'gutter' && (
          noteDraft?.lineIdx === idx ? noteGutterEditor(true)
            : (inlineNotes && inlineNote) ? noteGutter(inlineNote, true, idx)
            : (noteHint && onNoteOpen) ? noteGutterHint(idx, true)
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
        marginBottom: 'var(--chart-section-gap, 24px)',
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
        {(section.lines || []).map((line, i) => renderLine(line, i))}
      </div>
    </div>
  );
}
