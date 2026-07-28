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
export default function ReaderSection({
  section, index, config, settings, transpose, modOffset,
  repeatOf = -1, onJumpToFirst, tabColors,
}) {
  const id = sectionIdentity(section.type, settings);
  const style = config.sectionStyle;
  const colour = style === 'mono' ? 'var(--chart-subtle, var(--ds-gray-700))' : id.color;
  const heavy = id.heavy;

  // Their team writes "!!! sing up an octave !!!" because the .md format has
  // no emphasis. A leading ! is that convention, made real.
  const rawCue = String(section.note || '');
  const loud = /^!/.test(rawCue.trim());
  // Element 4 is a cue, not an essay. Long enough for a real instruction,
  // short enough that it can never push the song off the screen.
  const CUE_MAX = 240;
  const cue = rawCue.length > CUE_MAX ? `${rawCue.slice(0, CUE_MAX).trimEnd()}…` : rawCue;
  const asReference = repeatOf >= 0 && config.repeats === 'ref';
  const condensed = repeatOf >= 0 && config.repeats === 'condensed';

  const frame = {
    bar: { borderLeft: `${heavy ? 5 : 3}px solid ${colour}`, paddingLeft: '0.75rem' },
    mono: { borderLeft: '2px solid var(--chart-rule, var(--ds-gray-400))', paddingLeft: '0.75rem' },
    block: { background: id.fill, borderRadius: '0.6rem', padding: '0.6rem 0.75rem' },
    card: {
      background: 'color-mix(in srgb, var(--chart-text, #808080) 5%, transparent)',
      border: '1px solid var(--chart-rule, var(--ds-gray-300))',
      borderTop: `3px solid ${colour}`,
      borderRadius: '0.6rem',
      padding: '0.65rem 0.8rem',
    },
  }[style] || {};

  const label = (
    <span
      className={config.heading === 'code'
        ? 'font-bold uppercase tracking-wider font-mono'
        : 'font-semibold tracking-wide first-letter:text-[1.15em]'}
      style={{ color: colour, fontSize: heavy ? '0.86rem' : '0.76rem' }}
    >
      {headingText(id, config.heading)}
    </span>
  );

  const outer = {
    ...frame,
    breakInside: 'avoid',
    scrollMarginTop: '0.5rem',
    // A chorus gets more air above it than a verse, so the page has a shape
    // you can read without reading the words.
    marginBottom: heavy ? '1.6rem' : '1rem',
  };

  if (asReference) {
    return (
      <div id={`section-${index}`} data-section-index={index} style={outer}>
        <button
          type="button"
          onClick={onJumpToFirst}
          className="flex items-center gap-2 w-full text-left bg-transparent border-none p-0 cursor-pointer"
        >
          {label}
          <span className="text-label-11 text-[var(--chart-subtle,var(--ds-gray-700))]">— as before</span>
        </button>
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
          top: 0,
          zIndex: 5,
          // Opaque, or lyrics scroll visibly through the pinned heading.
          background: 'var(--chart-bg, var(--ds-background-100))',
          paddingTop: '0.2rem',
          paddingBottom: '0.2rem',
          marginLeft: '-0.25rem',
          paddingLeft: '0.25rem',
        } : undefined}
      >
        {label}
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
        songKey={config.songKey}
        accidentals={settings?.accidentals}
        condensed={condensed}
        onJumpToFirst={onJumpToFirst}
        showChords={config.display.showChords}
        showLyrics
        showTabs
        tabInstrument="all"
        chordEmphasis={settings?.stageMode === 'bassist' ? 'root' : 'full'}
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
      />
    </div>
  );
}
