import { sectionIdentity, headingText, resolveSectionColors } from '@/lib/sectionIdentity';
import SectionBlock from '@/features/chart/SectionBlock';

/**
 * One section, wrapped in the user's chosen section style.
 *
 * The chart body itself is `SectionBlock` — unchanged, and still the only place
 * that knows about chords, tabs, modulate markers and word-grouping. This owns
 * the frame around it, and the heading that is half the "where am I" mechanic
 * (the structure ribbon is the other half; both read from `sectionIdentity`).
 */
export default function ReaderSection({
  section, index, style = 'bar', transpose, modOffset, config, settings,
  repeatOf = -1, onJumpToFirst, tabColors, keepWhole = true, stickyTop = 0,
}) {
  const id = sectionIdentity(section.type, settings);
  const colour = style === 'mono' ? 'var(--chart-subtle, var(--ds-gray-700))' : id.color;
  const heavy = id.heavy;

  const asReference = repeatOf >= 0 && config.duplicateSections === 'ref';
  const condensed = repeatOf >= 0 && config.duplicateSections === 'condensed';

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

  // Sticky: the heading pins under the ribbon and stays until the next section
  // pushes it out, so the section name is on screen even mid-scroll. This is
  // the single strongest defence against losing your place.
  const heading = (
    <div
      className="flex items-baseline gap-2 mb-1.5"
      style={config.stickyHeadings ? {
        position: 'sticky',
        top: stickyTop,
        zIndex: 5,
        // Opaque, or the lyrics scroll visibly through the pinned heading.
        background: 'var(--chart-bg, var(--ds-background-100))',
        paddingTop: '0.2rem',
        paddingBottom: '0.2rem',
        marginLeft: '-0.25rem',
        paddingLeft: '0.25rem',
      } : undefined}
    >
      {/* Full names read as words, not shouting — capitalised with a slightly
          larger initial. Codes stay uppercase, since "c2" is not a word. */}
      <span
        className={config.headingStyle === 'code'
          ? 'font-bold uppercase tracking-wider font-mono'
          : 'font-semibold tracking-wide first-letter:text-[1.15em]'}
        style={{ color: colour, fontSize: heavy ? '0.86rem' : '0.76rem' }}
      >
        {headingText(id, config.headingStyle)}
      </span>
      {section.note && config.notePosition === 'inline' && (
        <span className="text-label-11 italic text-[var(--chart-subtle,var(--ds-gray-700))]">
          {section.note}
        </span>
      )}
    </div>
  );

  if (asReference) {
    return (
      <div
        id={`section-${index}`}
        data-section-index={index}
        style={{ ...frame, breakInside: keepWhole ? 'avoid' : 'auto', marginBottom: heavy ? '1.5rem' : '1.1rem' }}
      >
        <button
          type="button"
          onClick={onJumpToFirst}
          className="flex items-center gap-2 w-full text-left bg-transparent border-none p-0 cursor-pointer"
        >
          <span
            className={config.headingStyle === 'code'
              ? 'font-bold uppercase tracking-wider font-mono text-label-11'
              : 'font-semibold tracking-wide text-label-11 first-letter:text-[1.15em]'}
            style={{ color: colour }}
          >
            {headingText(id, config.headingStyle)}
          </span>
          <span className="text-label-11 text-[var(--chart-subtle,var(--ds-gray-700))]">— as before</span>
        </button>
      </div>
    );
  }

  return (
    <div
      id={`section-${index}`}
      data-section-index={index}
      style={{
        ...frame,
        // 'section' keeps a chorus whole across the gutter; 'balanced' lets
        // the columns even out and split it.
        breakInside: keepWhole ? 'avoid' : 'auto',
        scrollMarginTop: stickyTop,
        // A chorus gets more air above it than a verse, so the page has a
        // shape you can read without reading the words.
        marginBottom: heavy ? '1.6rem' : '1rem',
      }}
    >
      {heading}
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
        tabInstrument={config.tabInstrument || 'all'}
        chordEmphasis={settings?.stageMode === 'bassist' ? 'root' : 'full'}
        // The heading above already renders the section name and cue, so
        // SectionBlock must not render its own or they double up.
        hideHeading
        inlineNotes={config.notePosition === 'inline' && settings?.showInlineNotes !== false}
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
