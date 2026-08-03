import { sectionIdentity, headingText, resolveSectionColors } from '@/lib/sectionIdentity';
import SectionBlock from '@/features/chart/SectionBlock';

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
function EditHandle({ label, onClick, disabled = false, danger = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="min-h-0 w-[22px] h-[22px] grid place-items-center rounded-md border cursor-pointer bg-transparent text-[13px] leading-none disabled:opacity-25 disabled:cursor-not-allowed"
      style={{
        borderColor: 'var(--chart-rule, var(--ds-gray-400))',
        color: danger ? 'var(--ds-red-900)' : 'var(--chart-subtle, var(--ds-gray-700))',
      }}
    >
      {children}
    </button>
  );
}

export default function ReaderSection({
  section, index, config, songKey, settings, transpose, modOffset,
  repeatOf = -1, onJumpToFirst, tabColors, stickyTop = 0, onChordTap = null,
  // Resolved by the Reader: the host's tab choice beats the global setting.
  showChords,
  // Edit mode — the structure handles ride on the heading, so the play order is
  // edited where the play order IS rather than in a list that re-describes it.
  editing = false, onMove = null, onRemove = null, canMoveUp = false, canMoveDown = false,
}) {
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

  // The play-order handles. Deliberately ↑/↓ rather than drag: on a phone the
  // chart is inside a scroll container and (in a setlist) can be inside a swipe
  // gesture, so a long-press-drag has two things to fight before it starts —
  // and losing a section to a mis-drag mid-rehearsal is a much worse failure
  // than two taps being slower than one.
  const handles = editing && (onMove || onRemove) ? (
    <span className="inline-flex items-center gap-0.5 ml-2 align-middle">
      {onMove && (
        <>
          <EditHandle label={`Move ${id.name} earlier`} disabled={!canMoveUp} onClick={() => onMove(-1)}>↑</EditHandle>
          <EditHandle label={`Move ${id.name} later`} disabled={!canMoveDown} onClick={() => onMove(1)}>↓</EditHandle>
        </>
      )}
      {onRemove && (
        <EditHandle label={`Take ${id.name} out of the play order`} onClick={onRemove} danger>×</EditHandle>
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
        showLyrics
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
    </div>
  );
}
