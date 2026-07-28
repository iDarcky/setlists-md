import { sectionStyle, sectionLabel } from '@/music';
import { sectionWeight } from '@/lib/songFlow';
import SectionBlock from '@/features/chart/SectionBlock';

/**
 * One section, wrapped in the user's chosen section style.
 *
 * The chart body itself is `SectionBlock` — unchanged, and still the only place
 * that knows about chords, tabs, modulate markers and word-grouping. This owns
 * the frame around it.
 */
export default function ReaderSection({
  section, index, style = 'bar', transpose, modOffset, config, settings,
  repeatOf = -1, onJumpToFirst, tabColors,
}) {
  const s = sectionStyle(section.type, settings?.sectionColors, settings?.customSectionTypes);
  const weight = sectionWeight(section.type);
  const heavy = weight === 'hi';
  const colour = style === 'mono' ? 'var(--chart-subtle, var(--ds-gray-700))' : s.b;

  // A repeat renders as a one-line reference instead of the whole section.
  const asReference = repeatOf >= 0 && config.duplicateSections === 'ref';
  const condensed = repeatOf >= 0 && config.duplicateSections === 'condensed';

  const frame = {
    bar: {
      borderLeft: `${heavy ? 5 : 3}px solid ${colour}`,
      paddingLeft: '0.75rem',
    },
    mono: {
      borderLeft: '2px solid var(--chart-rule, var(--ds-gray-400))',
      paddingLeft: '0.75rem',
    },
    block: {
      background: s.bg,
      borderRadius: '0.6rem',
      padding: '0.6rem 0.75rem',
    },
    card: {
      background: 'var(--chart-card, var(--ds-background-100))',
      border: '1px solid var(--chart-rule, var(--ds-gray-300))',
      borderTop: `3px solid ${colour}`,
      borderRadius: '0.6rem',
      padding: '0.65rem 0.8rem',
    },
  }[style] || {};

  if (asReference) {
    return (
      <div
        id={`section-${index}`}
        data-section-index={index}
        style={{ ...frame, breakInside: 'avoid', marginBottom: heavy ? '1.5rem' : '1.1rem' }}
      >
        <button
          type="button"
          onClick={onJumpToFirst}
          className="flex items-center gap-2 w-full text-left bg-transparent border-none p-0 cursor-pointer"
        >
          <span
            className="text-label-11 font-bold uppercase tracking-wider"
            style={{ color: colour }}
          >
            {sectionLabel(section.type, settings?.sectionLabels)}
          </span>
          <span className="text-label-11 text-[var(--chart-subtle,var(--ds-gray-700))]">
            — as before
          </span>
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
        breakInside: 'avoid',
        scrollMarginTop: '6rem',
        marginBottom: heavy ? '1.5rem' : '1.1rem',
        // A chorus reads a shade stronger than the verses around it.
        fontWeight: heavy ? 500 : 400,
      }}
    >
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
        // Cues and inline notes leave the flow entirely when the note margin
        // is on — they are collected there instead, keyed by section.
        inlineNotes={config.notePosition === 'inline' && settings?.showInlineNotes !== false}
        noteStyle={settings?.inlineNoteStyle || 'dashes'}
        sectionColors={settings?.sectionColors}
        sectionLabels={settings?.sectionLabels}
        customSectionTypes={settings?.customSectionTypes}
        tabScale={settings?.tabSize || 1}
        tabColors={tabColors}
      />
    </div>
  );
}
