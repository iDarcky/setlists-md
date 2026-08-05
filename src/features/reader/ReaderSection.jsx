import { useState } from 'react';
import { sectionIdentity, headingText, resolveSectionColors } from '@/lib/sectionIdentity';
import SectionBlock from '@/features/chart/SectionBlock';
import { serializeTabBlock, lineToPlacement, placementToLine } from '@/parser';

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
  repeatOf = -1, onJumpToFirst, tabColors, stickyTop = 0, onChordTap = null,
  // Resolved by the Reader: the host's tab choice beats the global setting.
  showChords, showLyrics,
  // Edit mode. Only REMOVE lives here now: the owner retired ↑/↓ once the song
  // map got a `+` and drag (2026-08-04, "we don't need the ↑ ↓"). Removing
  // stays on the heading because you decide to cut a section while looking at
  // it, not while looking at its chip.
  editing = false, onRemove = null, onEditLines = null,
}) {
  const [writing, setWriting] = useState(false);
  const id = sectionIdentity(section.type, settings);
  const style = config.sectionStyle;
  const colour = id.color;
  const heavy = id.heavy;

  // Their team writes "!!! sing up an octave !!!" because the .md format has
  // no emphasis. A leading ! is that convention, made real.
  const rawCue = String(section.note || '');
  const loud = /^!/.test(rawCue.trim());
  // Element 4 is a cue, not an essay. Long enough for a real instruction,
  // short enough that it can never push the song off the screen.
  const CUE_MAX = 240;
  const cue = rawCue.length > CUE_MAX ? `${rawCue.slice(0, CUE_MAX).trimEnd()}…` : rawCue;
  // One repeat treatment, one name. 'ref' and 'condensed' had converged on
  // the same pill, so 'ref' is gone from the knob entirely.
  const condensed = repeatOf >= 0 && config.repeats === 'condensed';
  // 'hide' — the repeat isn't drawn at all. The div stays so the ribbon's
  // scroll-spy still has something to point at (it keeps the chip); it just
  // has no height of its own.
  const hidden = repeatOf >= 0 && config.repeats === 'hide';

  const frame = {
    bar: { borderLeft: `${heavy ? 5 : 3}px solid ${colour}`, paddingLeft: '0.75rem' },
    // No rule at all — the section is carried by its heading alone, which is
    // how the original chart read.
    plain: {},
    block: { background: id.fill, borderRadius: '0.6rem', padding: '0.6rem 0.75rem' },
    card: {
      background: 'color-mix(in srgb, var(--chart-text, #808080) 5%, transparent)',
      border: '1px solid var(--chart-rule, var(--ds-gray-300))',
      borderTop: `3px solid ${colour}`,
      borderRadius: '0.6rem',
      padding: '0.65rem 0.8rem',
    },
  }[style] || {};

  const HEADING_CLASS = {
    code: 'font-bold uppercase tracking-wider font-mono',
    // The original chart's heading: heavy, all caps, wide tracking.
    caps: 'font-black uppercase tracking-[0.15em]',
    name: 'font-semibold tracking-wide first-letter:text-[1.15em]',
  };
  const label = (
    <span
      className={HEADING_CLASS[config.heading] || HEADING_CLASS.name}
      style={{
        color: colour,
        fontSize: config.heading === 'caps'
          ? (heavy ? '0.95rem' : '0.86rem')
          : (heavy ? '0.86rem' : '0.76rem'),
      }}
    >
      {headingText(id, config.heading)}
    </span>
  );

  const outer = {
    ...frame,
    breakInside: 'avoid',
    // Land the section below the sticky chrome, not underneath it.
    scrollMarginTop: stickyTop + 8,
    // A chorus gets more air above it than a verse, so the page has a shape
    // you can read without reading the words.
    marginBottom: heavy ? '1.6rem' : '1rem',
    // ...and it steps IN. `heavy` is Chorus/Refrain/Bridge (songFlow's HEAVY
    // set) — the sections a song leans on. A small step is enough to make the
    // verse/chorus alternation visible at a glance from a music stand; more
    // than this and long chorus lines start wrapping earlier than the verses
    // around them, which costs more than the shape gains.
    marginLeft: heavy ? '0.85rem' : undefined,
  };

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
  // of space to say it. Still tappable — element 3's decision is that a repeat
  // jumps you to the first one.
  if (hidden && !editing) {
    return <div id={`section-${index}`} data-section-index={index} aria-hidden="true" />;
  }

  // In edit mode a hidden repeat has to come BACK, as its pill: you cannot
  // reorder or remove a slot in the play order that draws nothing at all.
  if (hidden || condensed) {
    return (
      <div id={`section-${index}`} data-section-index={index} style={outer}>
        <button
          type="button"
          onClick={editing ? undefined : onJumpToFirst}
          aria-label={`${id.name} — same as before, go to the first one`}
          className="min-h-0 inline-flex items-center gap-1.5 bg-transparent cursor-pointer"
          style={{
            fontSize: '0.72em',
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
        </button>
        {handles}
      </div>
    );
  }

  return (
    <div id={`section-${index}`} data-section-index={index} style={outer}>
      {/* Element 3 + 4. NOT flex: the cue starts on the section's own line and
          wraps from there like a sentence continuing, rather than being forced
          onto a row of its own the moment it gets long. */}
      <div
        className="mb-1.5"
        style={config.sticky ? {
          position: 'sticky',
          // Pin ONE PIXEL HIGH, and pad that pixel back. Two sticky edges that
          // merely ABUT will show a sliver of whatever scrolls between them on
          // any device whose pixel ratio isn't a whole number — the header
          // measures 73.33px, the heading pins at 73.33px, and the rounding
          // falls either side of the seam. Overlapping by a pixel cannot fail;
          // the extra padding keeps the text exactly where it was.
          top: stickyTop - 1,
          zIndex: 5,
          // Opaque, or lyrics scroll visibly through the pinned heading.
          background: 'var(--chart-bg, var(--ds-background-100))',
          paddingTop: 'calc(0.2rem + 1px)',
          paddingBottom: '0.2rem',
          marginLeft: '-0.25rem',
          paddingLeft: '0.25rem',
        } : undefined}
      >
        {label}
        {handles}
        {cue && config.notes && (
          <span
            className="text-label-11 ml-2"
            style={{
              color: loud ? 'var(--ds-red-900)' : 'var(--chart-subtle, var(--ds-gray-700))',
              fontStyle: loud ? 'normal' : 'italic',
              fontWeight: loud ? 600 : 400,
            }}
          >
            {cue}
          </span>
        )}
      </div>

      {/* The words, as text. Replaces the rendered chart for this section only
          while it is open, so you are never editing one thing and reading
          another. */}
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
        // `condensed` is handled by the repeat pill above; never reaches here.
        condensed={false}
        onJumpToFirst={onJumpToFirst}
        showChords={showChords ?? config.display.showChords}
        showLyrics={showLyrics ?? true}
        showTabs
        tabInstrument="all"
        // The sticky heading above already renders the name and cue.
        hideHeading
        inlineNotes={config.notes}
        notePlacement={config.notePlacement}
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
  );
}
