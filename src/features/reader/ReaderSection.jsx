import { useState, useRef, useEffect } from 'react';
import { sectionIdentity, headingText, resolveSectionColors } from '@/lib/sectionIdentity';
import SectionBlock from '@/features/chart/SectionBlock';
import { serializeTabBlock, lineToPlacement, placementToLine, CUE_MAX_CHARS } from '@/parser';

/**
 * One section — elements 3, 4 and 5.
 *
 * The chart body is `SectionBlock`, unchanged: it is still the only place that
 * knows about chords, tabs, modulate markers and word-grouping. This owns the
 * frame, the sticky heading, and the cue that rides on it.
 *
 * The heading is half the "where am I" mechanic; the structure ribbon is the
 * other half. Both read their colour and code from `sectionIdentity`, so the
 * highlighted chip and the heading it points at are the same object.
 */
/**
 * A play-order handle. `min-h-0` because the global `button { min-height: 44px }`
 * on phones would turn each of these into a slab beside a 12px heading —
 * READER.md's min-h-0 box, and the reason this is not a plain <button>'s
 * default size.
 */
function EditHandle({ label, onClick, danger = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      // GHOST — no border (owner, 2026-08-04: "I don't know if I like the x to
      // the sections to be like that, maybe we can add a trash can ghost
      // button"). A bordered × beside a 12px heading read as a control competing
      // with the section's own name; a bare glyph that only fills on hover sits
      // under it instead.
      className="min-h-0 w-[24px] h-[24px] grid place-items-center rounded-md border-none cursor-pointer bg-transparent hover:bg-[var(--ds-gray-200)]"
      style={{ color: danger ? 'var(--ds-red-900)' : 'var(--chart-subtle, var(--ds-gray-700))' }}
    >
      {children}
    </button>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" /><path d="M8 6V4h8v2" />
      <path d="M6 6l1 14h10l1-14" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

const asText = (l) => {
  if (typeof l === 'string') return l;
  if (l?.type === 'tab') return serializeTabBlock(l);
  if (l?.type === 'modulate') return `{modulate: ${l.semitones > 0 ? '+' : ''}${l.semitones}}`;
  return '';
};

/**
 * A section's words — **Lyrics** or **Source**, the same two the song editor
 * offers (owner, 2026-08-04: *"we have two options, edit lyrics and edit raw
 * source, we can follow the same model here too"*).
 *
 * - **Lyrics** (default) shows the words with the chord markers stripped, and
 *   puts the chords back on save by CHARACTER POSITION — `lineToPlacement` /
 *   `placementToLine` in `parser.js`, the same pair `ArrangeTabV2` uses. A
 *   position past the end of a shortened line is clamped to the end rather than
 *   dropped, which is what the editor means by "nudged to fit".
 * - **Source** is the raw `.md`, brackets and all, for anything that isn't a
 *   word: adding a chord where there is none, a tab block, a key change.
 *
 * > **Lyrics mode is refused when the section holds a tab or a modulate
 * > marker.** Those are lines with no words, so stripping chords from them is
 * > meaningless and rebuilding them from an edited word list would destroy
 * > them. The editor sidesteps this by editing one line at a time; a whole
 * > section in one box cannot, so it says so and opens in Source.
 *
 * Committed on Save, not per keystroke: a song update per character is a sync
 * per character, and a half-typed `[Cm` is a chord the chart would try to draw.
 */
function LyricEditor({ section, onSave, onCancel }) {
  const lines = section.lines || [];
  // A tab or a modulate marker anywhere in the section rules out Lyrics mode.
  const wordsOnly = lines.every(l => typeof l === 'string');
  const [mode, setMode] = useState(wordsOnly ? 'lyrics' : 'source');
  const [text, setText] = useState(() => (wordsOnly
    ? lines.map(l => lineToPlacement(l).plainText).join('\n')
    : lines.map(asText).join('\n')));

  const switchTo = (next) => {
    if (next === mode) return;
    // Re-derive from the CURRENT text so a switch never silently discards what
    // was just typed.
    if (next === 'source') {
      const src = text.split('\n').map((plainText, i) => {
        const original = typeof lines[i] === 'string' ? lines[i] : '';
        const { chords } = lineToPlacement(original);
        return placementToLine({ plainText, chords: clampChords(chords, plainText) });
      });
      setText(src.join('\n'));
    } else {
      setText(text.split('\n').map(l => lineToPlacement(l).plainText).join('\n'));
    }
    setMode(next);
  };

  const commit = () => {
    if (mode === 'source') { onSave(text); return; }
    // Lyrics: re-attach each line's original chords at their old positions.
    onSave(text.split('\n').map((plainText, i) => {
      const original = typeof lines[i] === 'string' ? lines[i] : '';
      const { chords } = lineToPlacement(original);
      return placementToLine({ plainText, chords: clampChords(chords, plainText) });
    }).join('\n'));
  };

  return (
    <div className="mt-1.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        <ModeTab id="lyrics" label="Lyrics" active={mode} onPick={switchTo} disabled={!wordsOnly} />
        <ModeTab id="source" label="Source" active={mode} onPick={switchTo} />
        <span className="text-label-10" style={{ color: 'var(--chart-subtle, var(--ds-gray-700))' }}>
          {mode === 'lyrics'
            ? 'Your chords stay attached'
            : (wordsOnly ? 'Chords go in square brackets' : 'This section has a tab or a key change')}
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label={mode === 'lyrics' ? 'Section lyrics' : 'Section lyrics and chords'}
        spellCheck={false}
        rows={Math.min(16, Math.max(3, text.split('\n').length + 1))}
        className="w-full rounded-lg border p-2 font-mono text-[13px] leading-[1.5] bg-transparent outline-none focus:border-[var(--color-brand)]"
        style={{ borderColor: 'var(--chart-rule, var(--ds-gray-400))', color: 'var(--chart-text, var(--ds-gray-1000))' }}
      />
      <div className="mt-1.5 flex items-center gap-1.5">
        <button
          type="button" onClick={commit}
          className="min-h-0 h-[26px] px-2.5 rounded-lg border-none cursor-pointer text-label-11 font-semibold"
          style={{ background: 'var(--color-brand)', color: '#fff' }}
        >
          Save
        </button>
        {/* "Discard", not "Cancel". The edit row at the bottom already has a
            Cancel that throws away the WHOLE session; two buttons reading
            "Cancel" a few centimetres apart, meaning different amounts of lost
            work, is the kind of ambiguity you only notice after losing some. */}
        <button
          type="button" onClick={onCancel}
          className="min-h-0 h-[26px] px-2.5 rounded-lg border cursor-pointer text-label-11 font-semibold bg-transparent"
          style={{ borderColor: 'var(--chart-rule, var(--ds-gray-400))', color: 'var(--chart-subtle, var(--ds-gray-700))' }}
        >
          Discard
        </button>
      </div>
    </div>
  );
}

// Declared at module scope, not inside `LyricEditor`. A component created
// during render is a NEW type every render, so React unmounts and remounts it —
// it would lose focus and any state on every keystroke.
function ModeTab({ id, label, active, onPick, disabled = false }) {
  const on = active === id;
  return (
    <button
      type="button" onClick={() => onPick(id)} aria-pressed={on} disabled={disabled}
      className="min-h-0 h-[22px] px-2 rounded-md border text-label-11 font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      style={on
        ? { background: 'var(--color-brand)', borderColor: 'var(--color-brand)', color: '#fff' }
        : { background: 'transparent', borderColor: 'var(--chart-rule, var(--ds-gray-400))', color: 'var(--chart-subtle, var(--ds-gray-700))' }}
    >
      {label}
    </button>
  );
}

// A chord whose position is past the end of a shortened line moves to the end
// rather than disappearing — the editor's "nudged to fit".
function clampChords(chords, plainText) {
  const max = (plainText || '').length;
  return chords.map(c => ({ ...c, pos: Math.min(c.pos, max) }));
}

export default function ReaderSection({
  section, index, config, songKey, settings, transpose, modOffset,
  repeatOf = -1, onOpenHere, onCollapse = null, tabColors, stickyTop = 0, onChordTap = null,
  // Where this slot sits in a run of back-to-back repeats — `songFlow.runs`.
  // The lead slot draws one pill for the whole run; the rest draw nothing.
  run = null,
  // Element 3, 2026-08-05: a Tag you have tapped is OPEN, right where it is.
  // The Reader owns the set of opened slots — it is a fact about this reading
  // of this song, not about the song.
  expanded = false,
  // Resolved by the Reader: the host's tab choice beats the global setting.
  showChords, showLyrics,
  // Edit mode. Only REMOVE lives here now: the owner retired ↑/↓ once the song
  // map got a `+` and drag (2026-08-04, "we don't need the ↑ ↓"). Removing
  // stays on the heading because you decide to cut a section while looking at
  // it, not while looking at its chip.
  editing = false, onRemove = null, onEditLines = null,
  // Element 5. Present only in practice, and only when the host can save.
  // Absent → the heading behaves exactly as it always has.
  onEditCue = null,
  // Element 5: write an inline note. `(lineIdx, text)`; null → read-only.
  onEditNote = null,
  // Show the `+` on this section's empty lines. Driven by the FAB's mode.
  noteHintHere = false,
  // Show the `+ cue` placeholder on the heading. Also the FAB's mode — an
  // EXISTING cue stays tappable at all times, only the empty affordance waits
  // to be asked for, so a song with no cues carries no chrome until you ask.
  cueHintHere = false,
}) {
  const [writing, setWriting] = useState(false);
  // Element 5: null = not editing the cue; a string = the draft.
  const [cueDraft, setCueDraft] = useState(null);
  // Element 5: `{ lineIdx, text }` while a line's note is being written.
  // ⚠ Owned HERE, not in SectionBlock, because the gutter's existence is
  // decided here — a section with no note yet has no gutter to type into.
  const [noteDraft, setNoteDraft] = useState(null);
  // ── A short section must not pin ────────────────────────────────────────────
  // Owner, 2026-08-06: *"there's a bug with pinning on one verse sections. It
  // automatically hides the verse."* Measured at maximum scroll on a 390px
  // phone, an Outro of one chord line: the section box ran 64.3 → 121.7, its
  // heading pinned at 79 → 113.4 (opaque, z-5), and the only line in the
  // section sat at 104.7 → 121.7. **Half of the one line was behind its own
  // heading**, and there is a ~22px band of scroll where it is behind it
  // completely.
  //
  // A pinned heading covering lines is normal and harmless while those lines
  // are ones you have already sung past. It stops being harmless the moment the
  // section's whole body fits under the heading — then the heading is hiding
  // the thing it is naming. So: a section pins only when its body is taller
  // than its heading. Measured, not counted from `lines.length`, because a
  // chord-only row is 17px and a chord+lyric row is 50px.
  //
  // The +8 is hysteresis. Pinning ADDS 7.4px of padding to the heading, so a
  // body within a few pixels of the boundary would toggle the pin, resize the
  // heading, and flip the comparison back — an observer feeding its own input.
  const headRef = useRef(null);
  const bodyRef = useRef(null);
  const [tallEnough, setTallEnough] = useState(true);
  useEffect(() => {
    if (!config.sticky || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      const bh = bodyRef.current?.getBoundingClientRect().height || 0;
      const hh = headRef.current?.getBoundingClientRect().height || 0;
      // Nothing has laid out yet (jsdom, or a section inside a closed panel) —
      // decide nothing rather than deciding wrongly.
      if (!bh && !hh) return;
      setTallEnough(bh >= hh + 8);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (bodyRef.current) ro.observe(bodyRef.current);
    if (headRef.current) ro.observe(headRef.current);
    return () => ro.disconnect();
  }, [config.sticky]);
  const pinned = config.sticky && tallEnough;

  const id = sectionIdentity(section.type, settings);
  const style = config.sectionStyle;
  const colour = id.color;
  const heavy = id.heavy;

  // Their team writes "!!! sing up an octave !!!" because the .md format has
  // no emphasis. A leading ! is that convention, made real.
  const rawCue = String(section.note || '');
  const loud = /^!/.test(rawCue.trim());
  // Element 4b is a cue, not an essay — and the heading PINS with its cue, so
  // every row it wraps to is a row of song hidden behind it. New cues are
  // capped at the INPUT (`CUE_MAX_CHARS`, measured to fit two rows on a 360px
  // phone), and the heading row is clamped to two rows for everything else.
  //
  // The clamp, not a character cut, is the answer for a cue that already exists
  // — the owner's question was *"what are we doing with users that might have
  // had longer notes?"*. Cutting at 70 characters would show `…` and hide the
  // rest of a note somebody wrote before there was a limit; clamping shows two
  // full rows, bounds the pin exactly the same, and leaves the text untouched
  // in the file and in the editor, which is where it gets shortened.
  const cue = rawCue;
  // One repeat treatment, one name. 'ref' and 'condensed' had converged on
  // the same pill, so 'ref' is gone from the knob entirely.
  const condensed = repeatOf >= 0 && config.repeats === 'condensed' && !expanded;
  // 'hide' — the repeat isn't drawn at all. The div stays so the ribbon's
  // scroll-spy still has something to point at (it keeps the chip); it just
  // has no height of its own.
  const hidden = repeatOf >= 0 && config.repeats === 'hide' && !expanded;

  // ── Who pays for the note gutter ────────────────────────────────────────────
  // The strip down the right costs width, and width is height: measured on a
  // 390px phone, a permanent gutter took the same eight lines from 549px to
  // 682px — **+24%**, about one extra screen every four. So only a section that
  // actually has an inline note reserves it (owner, 2026-08-06: *"if no notes
  // we use for lyrics if notes we have a space for them"*). A section with none
  // uses the full width, and the strip simply isn't there.
  //
  // Wide screens never take this branch — a note goes out on a dotted leader
  // inside its own ~594px column, which costs nothing and is what a printed
  // chart does.
  const hasInlineNote = (section.lines || []).some(
    l => typeof l === 'string' && /\{!.*?\}/.test(l)
  );
  const notePlacement = config.notePlacement === 'gutter'
    // ⚠ `|| noteDraft` — the strip is reserved only by sections that already
    // carry a note, so the FIRST note in a section would otherwise have no
    // gutter to be typed into. Drafting reserves it for the duration.
    ? ((hasInlineNote || noteDraft || (noteHintHere && onEditNote)) && config.inlineNotes ? 'gutter' : 'above')
    : config.notePlacement;

  // ── The four frames ─────────────────────────────────────────────────────────
  // Redesigned 2026-08-06. A frame is only about WHERE THE SECTION'S COLOUR
  // LIVES, and **not one of them takes a pixel of width from the lyrics** —
  // which is the whole reason `block` and `card` are gone. They boxed the text:
  // on a 390px phone a Card chorus spent 32px of chart padding + 12.8px of card
  // padding + 13.6px of chorus indent before a lyric started, and the pinned
  // heading was an opaque slab inset 10px from the card it lived in, with the
  // card's own colour rule floating above it, disconnected. Three edges that
  // never lined up. Owner: *"We need a complete redesign for blocks and cards."*
  //
  // The bar hangs in the MARGIN (`position: absolute`, negative left), so it
  // costs nothing either — it used to be a `border-left` plus 12px of padding,
  // which is 15px of lyric width for a 3px mark.
  const frame = {
    // Nothing. The coloured heading carries the section, which is how the
    // original chart read. The default.
    plain: {},
    // A hairline under the heading, in the section's colour. Applied to the
    // heading row, not here — see `headRule`.
    rule: {},
    // Colour in the left margin. `position: relative` is the anchor; the mark
    // itself is drawn as a child so it can sit outside the text column.
    bar: { position: 'relative' },
    // A wash behind the section, EDGE TO EDGE. No radius, no side padding, no
    // border: a tint is a change of paper, not a box on it. The negative
    // margins pull it out to the chart's own padding so it bleeds to the screen
    // edges the way a highlighted passage does.
    tint: {
      background: id.fill,
      paddingTop: '0.45rem',
      paddingBottom: '0.45rem',
      marginLeft: 'calc(-1 * var(--chart-pad-left, 12px))',
      marginRight: 'calc(-1 * var(--chart-pad-right, 12px))',
      paddingLeft: 'var(--chart-pad-left, 12px)',
      paddingRight: 'var(--chart-pad-right, 12px)',
    },
  }[style] || {};
  // The section's colour as a hairline under its heading.
  const headRule = style === 'rule'
    ? { borderBottom: `1px solid color-mix(in srgb, ${colour} 45%, transparent)`, paddingBottom: '0.25rem' }
    : null;

  const HEADING_CLASS = {
    code: 'font-bold uppercase tracking-wider font-mono',
    // The original chart's heading: heavy, all caps, wide tracking.
    caps: 'font-black uppercase tracking-[0.15em]',
    name: 'font-semibold tracking-wide first-letter:text-[1.15em]',
  };
  // ── How big a section's name is ─────────────────────────────────────────────
  // Measured on 2026-08-06: the heading was 12.16px against 18px lyrics and a
  // **13px cue** — the smallest text on the page was the one naming where you
  // are, and the instruction riding on it was set larger than the section it
  // belonged to. Owner: *"I agree that it should be heading > cue."*
  //
  // Fixed sizes, not a fraction of the lyric size (owner's instinct, and it is
  // the right one: a heading is chrome for the page, not another voice in it).
  // The step from light to heavy is REAL now — 14 → 17px is 21%, where 12.16 →
  // 13.76 was 13% and read as a rendering accident.
  const HEADING_PX = {
    name: heavy ? 17 : 14,
    code: heavy ? 17 : 14,
    // Caps read smaller at the same size — all-uppercase has no descenders and
    // no x-height contrast — so this one runs a point above the others.
    caps: heavy ? 18 : 15,
  };
  const labelPx = HEADING_PX[config.heading] ?? HEADING_PX.name;
  const label = (
    <span
      className={HEADING_CLASS[config.heading] || HEADING_CLASS.name}
      style={{ color: colour, fontSize: `${labelPx}px` }}
    >
      {headingText(id, config.heading)}
    </span>
  );

  const outer = {
    ...frame,
    breakInside: 'avoid',
    // Land the section below the sticky chrome, not underneath it.
    scrollMarginTop: stickyTop + 8,
    // ⚠ A frame with vertical padding BLOCKS margin collapse, so this margin
    // stops being absorbed into the chart's own section gap and starts adding
    // to it. Measured on a 390px phone: `tint` came out 35% taller than `plain`
    // (779px → 1048px), and only a third of that was its own padding — the
    // rest was 16px of margin per section that had been collapsing away
    // invisibly under every other frame. The gap is the Section-spacing
    // setting's job; a framed section leaves it to it.
    marginBottom: frame.paddingTop ? 0 : '1rem',
  };

  // ── The air above a heavy section, and its step in ──────────────────────────
  // ⚠ PADDING, not margin, and ABOVE, not below.
  //
  // This was `marginBottom: heavy ? '1.6rem' : '1rem'`, and measured on
  // 2026-08-06 it was worth **1.6px**. A section's bottom margin COLLAPSES
  // against `SectionBlock`'s own `--chart-section-gap` (the Section spacing
  // setting, 24px by default), so the real gap is `max(spacing, margin)`:
  //
  //   spacing  8px → 16.0 after a verse · 25.6 after a chorus
  //   spacing 24px → 24.0 · 25.6          ← the default: 1.6px of "shape"
  //   spacing 48px → 48.0 · 48.0          ← no difference at all
  //
  // It was also on the wrong side: air BELOW a chorus is air above whatever
  // follows it, so the one thing it did was start the next verse 1.6px lower.
  // Padding cannot collapse, so this survives at every spacing.
  //
  // ⚠ ADDED to what the frame already asked for, never assigned over it. Writing
  // `marginLeft: heavy ? '0.85rem' : undefined` after `...frame` set the key to
  // undefined for every light section, and React serialises that as "remove"
  // — which silently deleted `tint`'s negative margin. Measured in Chromium:
  // the wash stopped bleeding on the left, the words started at 24px instead of
  // 12px, and the song grew **30% taller** (779px → 1018px) from the extra
  // wrapping. The frame and the weight both have a claim on these two
  // properties; they have to be composed, not overwritten.
  if (heavy) {
    outer.paddingTop = frame.paddingTop ? `calc(${frame.paddingTop} + 0.85rem)` : '0.85rem';
    // A tint bleeds to the screen edge, so a heavy tinted section steps its
    // WORDS in rather than its wash — the alternative pulls the colour back off
    // the edge, which is the one thing the frame exists to do.
    if (style === 'tint') {
      outer.paddingLeft = `calc(${frame.paddingLeft} + 0.85rem)`;
    } else {
      outer.marginLeft = frame.marginLeft ? `calc(${frame.marginLeft} + 0.85rem)` : '0.85rem';
    }
  }

  // The margin bar — `bar`'s colour, drawn OUTSIDE the text column so it costs
  // no width. It used to be a `border-left` with 12px of padding beside it:
  // 15px of lyric width to show a 3px mark, on the side of the screen the
  // owner wants the words to start from.
  const marginBar = style === 'bar' ? (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: heavy ? '-0.75rem' : '-0.7rem',
        top: 0,
        bottom: 0,
        width: heavy ? 4 : 2,
        borderRadius: 999,
        background: colour,
      }}
    />
  ) : null;

  // Reordering moved to the song map — drag a chip there. What is left is the
  // one decision you make while looking at the section itself: cut it.
  const handles = editing && (onRemove || onEditLines) ? (
    <span className="inline-flex items-center gap-0.5 ml-2 align-middle">
      {onEditLines && (
        <EditHandle label={`Edit ${id.name}`} onClick={() => setWriting(w => !w)}>
          <PencilIcon />
        </EditHandle>
      )}
      {onRemove && (
        <EditHandle label={`Take ${id.name} out of the play order`} onClick={onRemove} danger>
          <TrashIcon />
        </EditHandle>
      )}
    </span>
  ) : null;

  // A repeated section renders as the PDF export's pill — `↩ CHORUS`, small,
  // rounded, tinted with the section's own colour. Copied deliberately rather
  // than reinvented: the reader used to hand `condensed` down to SectionBlock,
  // which drew a full-width bordered box that outweighed the sections it was
  // standing in for. The pill says "this again" without taking a section's worth
  // of space to say it.
  //
  // Tapping it OPENS IT HERE (owner, 2026-08-05, option B). It used to throw
  // you back to the first time the section was played, which reads on stage as
  // the app losing your place: you tap chip six and land at chip two, and the
  // ribbon's highlight follows you backwards. You asked to see the chorus where
  // you are singing it, so you get it where you are singing it — the page does
  // not move, and every other repeat stays a tag.
  if (hidden && !editing) {
    return <div id={`section-${index}`} data-section-index={index} aria-hidden="true" />;
  }

  // In edit mode a hidden repeat has to come BACK, as its pill: you cannot
  // reorder or remove a slot in the play order that draws nothing at all.
  if (hidden || condensed) {
    // A run of back-to-back repeats is ONE pill (owner, 2026-08-06: four
    // bridges drew a bridge and three identical tags, *"they look ugly"*). The
    // slots it stands for still exist — empty, keeping their
    // `data-section-index` — because the ribbon is the map of the song and a
    // slot missing from the map breaks the one job. Edit mode gets them back as
    // individual pills: you cannot reorder or remove a slot you cannot see.
    if (!editing && run && !run.lead) {
      return <div id={`section-${index}`} data-section-index={index} aria-hidden="true" />;
    }
    const times = !editing && run?.lead ? run.count : 1;
    return (
      <div id={`section-${index}`} data-section-index={index} style={outer}>
        <button
          type="button"
          onClick={editing ? undefined : onOpenHere}
          aria-label={times > 1
            ? `${id.name} — same as before, ${times} times, show it here`
            : `${id.name} — same as before, show it here`}
          className="min-h-0 inline-flex items-center gap-1.5 bg-transparent cursor-pointer"
          style={{
            fontSize: `${Math.max(11, labelPx - 2)}px`,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '0.25em 0.85em',
            borderRadius: '999px',
            color: colour,
            border: `1px solid color-mix(in srgb, ${colour} 35%, transparent)`,
            background: `color-mix(in srgb, ${colour} 8%, transparent)`,
          }}
        >
          <span aria-hidden="true">↩</span>
          {id.name}
          {times > 1 && <span style={{ opacity: 0.75 }}>×{times}</span>}
          {/* Say that it opens. It has been tappable since 2026-08-05 and read
              as dead text — owner: *"I think a show should be visible so the
              user knows"*. The chevron is the affordance; the ribbon chip keeps
              the other behaviour (jump to where the words are), so both things
              he liked survive, each in the place it belongs. */}
          {!editing && (
            <span aria-hidden="true" style={{ opacity: 0.7, fontSize: '0.85em', marginLeft: '0.15em' }}>▾</span>
          )}
        </button>
        {handles}
      </div>
    );
  }

  return (
    <div id={`section-${index}`} data-section-index={index} style={outer}>
      {marginBar}
      {/* Element 4 + 4b. NOT flex: the cue starts on the section's own line and
          wraps from there like a sentence continuing, rather than being forced
          onto a row of its own the moment it gets long. */}
      <div
        ref={headRef}
        data-section-anchor=""
        className="mb-1.5"
        style={{
          // ── The row's own type metrics ──────────────────────────────────────
          // Measured 2026-08-06: this row was **34.4px tall to hold a 16px
          // word**. It inherited the chart's 18px/27px body type, so the line
          // box was a 27px strut with a 12–18px label floating in it — ~9px of
          // nothing per section, 80px on a nine-section song, and it grew as
          // the lyric size grew. Sized off the heading itself instead: the row
          // is now as tall as the tallest thing in it.
          fontSize: `${labelPx}px`,
          lineHeight: 1.25,
          // TWO ROWS, name and cue together. The clamp is on the ROW, not on
          // the cue, because the cue starts on the heading's own line and wraps
          // from there — clamping the cue alone would first have to make it a
          // block, which is the layout element 4b explicitly rejected.
          // ⚠ The clamp comes OFF while the cue is being written. A
          // `-webkit-box` with `line-clamp` hides the second row, and an input
          // that scrolls its own text out of a clamped box is a field you
          // cannot read what you typed into.
          ...(cue && config.notes && cueDraft === null ? {
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
          } : null),
          ...(pinned ? {
          position: 'sticky',
          // Pin ONE PIXEL HIGH, and pad that pixel back. Two sticky edges that
          // merely ABUT will show a sliver of whatever scrolls between them on
          // any device whose pixel ratio isn't a whole number — the header
          // measures 73.33px, the heading pins at 73.33px, and the rounding
          // falls either side of the seam. Overlapping by a pixel cannot fail;
          // the extra padding keeps the text exactly where it was.
          top: stickyTop - 1,
          zIndex: 5,
          // ── A pinned heading wears its section's frame ────────────────────
          // Opaque, or lyrics scroll visibly through it — but opaque in WHAT.
          // It used to be `--chart-bg` always, which on a tinted section was a
          // slab of bare paper cut out of the wash. It takes the tint now, and
          // paints it edge to edge like the section does, so pinning changes
          // nothing about how the section looks.
          background: style === 'tint'
            ? `linear-gradient(${id.fill}, ${id.fill}), var(--chart-bg, var(--ds-background-100))`
            : 'var(--chart-bg, var(--ds-background-100))',
          paddingTop: 'calc(0.2rem + 1px)',
          paddingBottom: '0.2rem',
          marginLeft: style === 'tint' ? 'calc(-1 * var(--chart-pad-left, 12px))' : '-0.25rem',
          marginRight: style === 'tint' ? 'calc(-1 * var(--chart-pad-right, 12px))' : undefined,
          paddingLeft: style === 'tint' ? 'var(--chart-pad-left, 12px)' : '0.25rem',
          paddingRight: style === 'tint' ? 'var(--chart-pad-right, 12px)' : undefined,
          } : null),
          ...(headRule || null),
        }}
      >
        {label}
        {handles}
        {/* Close it again. A repeat you opened had no way back — it stayed open
            until the song changed (owner, 2026-08-06: *"Is there a way to
            collapse back sections?"*). The pill opens with ▾, so the opened
            section closes with ▴, on the heading it opened into. */}
        {expanded && repeatOf >= 0 && !editing && onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label={`Collapse ${id.name} back to a tag`}
            className="min-h-0 ml-1.5 px-1 bg-transparent border-none cursor-pointer align-middle"
            style={{ color: colour, opacity: 0.7, fontSize: `${Math.max(11, labelPx - 3)}px`, lineHeight: 1 }}
          >
            ▴
          </button>
        )}
        {/* ── Element 5: the cue, and writing one ────────────────────────────
            Three states on one row, all at the cue's own size so the heading
            never changes height: the cue as text, the cue as a field, and —
            only when a cue could be written and there is none — a quiet `+`.
            The `+` is at cue size and cue colour on purpose: it is not a
            control competing with the section's name, it is the empty shape of
            the thing it makes. */}
        {cueDraft !== null ? (
          <input
            autoFocus
            value={cueDraft}
            maxLength={CUE_MAX_CHARS}
            aria-label={`Cue for ${id.name}`}
            placeholder="Band cue…"
            onChange={(e) => setCueDraft(e.target.value)}
            onBlur={() => { onEditCue?.(cueDraft); setCueDraft(null); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
              // Escape abandons the draft. Clearing the draft BEFORE blur means
              // the blur handler sees `null` and writes nothing.
              if (e.key === 'Escape') { e.preventDefault(); setCueDraft(null); }
            }}
            className="ml-2 min-h-0 bg-transparent border-0 border-b outline-none"
            style={{
              fontSize: `${Math.max(11, labelPx - 2)}px`,
              fontStyle: 'italic',
              fontWeight: 400,
              color: 'var(--chart-text, var(--ds-gray-1000))',
              borderColor: 'var(--color-brand)',
              width: `min(22ch, 60%)`,
            }}
          />
        ) : cue && config.notes ? (
          <span
            className="ml-2"
            {...(onEditCue ? {
              role: 'button', tabIndex: 0,
              onClick: () => setCueDraft(cue),
              onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCueDraft(cue); } },
              title: 'Edit this cue',
              style: { cursor: 'pointer' },
            } : null)}
            style={{
              // Smaller than the name it rides on, always. It used to be 13px
              // beside a 12.16px heading — the instruction set larger than the
              // section (owner: *"heading > cue"*).
              fontSize: `${Math.max(11, labelPx - 2)}px`,
              color: loud ? 'var(--ds-red-900)' : 'var(--chart-subtle, var(--ds-gray-700))',
              fontStyle: loud ? 'normal' : 'italic',
              fontWeight: loud ? 600 : 400,
              ...(onEditCue ? { cursor: 'pointer' } : null),
            }}
          >
            {cue}
          </span>
        ) : onEditCue && config.notes && cueHintHere ? (
          // A bare `+` was too small to aim at on a phone (owner, 2026-08-07)
          // — a 7px glyph with 4px of padding, in a row whose height is set by
          // a 14px heading. It says the WORD now, so it is both a bigger target
          // and self-explanatory, and it sits in the cue's own slot at the
          // cue's own size so the row height still never moves.
          <button
            type="button"
            onClick={() => setCueDraft('')}
            aria-label={`Add a cue to ${id.name}`}
            className="min-h-0 ml-2 px-2 py-0.5 rounded-md bg-transparent cursor-pointer align-middle"
            style={{
              fontSize: `${Math.max(11, labelPx - 2)}px`,
              lineHeight: 1.2,
              fontStyle: 'italic',
              color: 'var(--chart-subtle, var(--ds-gray-700))',
              border: '1px dashed var(--chart-rule, var(--ds-gray-400))',
              opacity: 0.75,
            }}
          >
            + cue
          </button>
        ) : null}
      </div>

      {/* The words, as text. Replaces the rendered chart for this section only
          while it is open, so you are never editing one thing and reading
          another. */}
      {/* A plain wrapper, only so the body can be MEASURED against the heading
          (see `tallEnough`). No padding, no border — margins still collapse
          through it, so the section gaps are exactly what they were. */}
      <div ref={bodyRef}>
      {writing && onEditLines ? (
        <LyricEditor
          section={section}
          onSave={(text) => { onEditLines(text); setWriting(false); }}
          onCancel={() => setWriting(false)}
        />
      ) : (
      <>
      {/* Elements 5 + 6 */}
      <SectionBlock
        section={section}
        transpose={transpose}
        modOffset={modOffset}
        notation={config.display.notation}
        songKey={songKey}
        accidentals={settings?.accidentals}
        // `condensed` is handled by the repeat pill above; never reaches here,
        // which is also why SectionBlock's own jump-to-first is dead weight in
        // the reader — the pill opens the repeat in place instead.
        condensed={false}
        showChords={showChords ?? config.display.showChords}
        showLyrics={showLyrics ?? true}
        showTabs
        tabInstrument="all"
        // The sticky heading above already renders the name and cue.
        hideHeading
        inlineNotes={config.inlineNotes}
        onNoteOpen={onEditNote ? (lineIdx, text) => setNoteDraft({ lineIdx, text }) : null}
        noteHint={!!onEditNote && noteHintHere}
        noteDraft={noteDraft}
        onNoteDraftChange={(text) => setNoteDraft(text === null ? null : (d) => (d ? { ...d, text } : d))}
        onNoteCommit={() => {
          setNoteDraft((d) => { if (d) onEditNote?.(d.lineIdx, d.text); return null; });
        }}
        notePlacement={notePlacement}
        noteStyle={settings?.inlineNoteStyle || 'dashes'}
        sectionColors={resolveSectionColors(settings)}
        sectionLabels={settings?.sectionLabels}
        customSectionTypes={settings?.customSectionTypes}
        tabScale={settings?.tabSize || 1}
        tabColors={tabColors}
        myInstrument={config.myInstrument}
        tabTranspose={transpose}
        onChordTap={onChordTap}
      />
      </>
      )}
      </div>
    </div>
  );
}
