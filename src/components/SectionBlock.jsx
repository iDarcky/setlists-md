import { useMemo } from 'react';
import { transposeChord, sectionStyle, sectionLabel, getNashvilleNumber } from '../music';
import { parseLine } from '../parser';
import TabBlock from './TabBlock';

const NOTE_SEPARATORS = {
  dashes: ' ---- ',
  dots:   ' ...... ',
  arrow:  ' ----> ',
};

export default function SectionBlock({
  section, transpose, modOffset = 0, nns, songKey,
  showChords = true, inlineNotes = true, noteStyle = 'dashes',
  sectionColors, sectionLabels, customSectionTypes,
}) {
  const s = sectionStyle(section.type, sectionColors, customSectionTypes);

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

  const renderLine = (line, idx) => {
    if (typeof line !== 'string') {
      if (line.type === 'tab') return <TabBlock key={idx} data={line} />;
      if (line.type === 'modulate') {
        return (
          <div key={idx} className="my-4 flex items-center gap-4">
            <div className="h-[1px] flex-1 bg-[var(--color-brand-border)]" />
            <span className="text-label-10 font-black uppercase tracking-[0.2em] px-3 py-1 bg-[var(--color-brand)] text-white rounded-full shadow-sm">
              Key Change: {line.semitones > 0 ? '+' : ''}{line.semitones}
            </span>
            <div className="h-[1px] flex-1 bg-[var(--color-brand-border)]" />
          </div>
        );
      }
      return null;
    }

    const effectiveTranspose = transpose + lineOffsets[idx];

    // Extract inline notes {!...}
    const noteMatch = line.match(/\{!(.*?)\}/);
    const inlineNote = noteMatch ? noteMatch[1] : null;
    const cleanLine = line.replace(/\{!.*?\}/g, '');

    // Plain text line (no chords) or chords hidden
    if (!cleanLine.includes('[') || !showChords) {
      const displayLine = !showChords ? cleanLine.replace(/\[.*?\]/g, '') : cleanLine;
      return (
        <div
          key={idx}
          className="min-h-[1.3em] whitespace-pre-wrap opacity-90"
          style={{ color: 'var(--chart-text, var(--text-1))' }}
        >
          {displayLine}
          {inlineNotes && inlineNote && (
            <span
              className="italic text-[0.8em]"
              style={{ color: 'var(--chart-subtle, var(--text-2))' }}
            >
              {NOTE_SEPARATORS[noteStyle] || NOTE_SEPARATORS.dashes}{inlineNote}
            </span>
          )}
        </div>
      );
    }

    // Parse into chord+text pairs using the parser
    const pairs = parseLine(cleanLine);
    const hasLyrics = pairs.some(p => p.text.trim());

    // Render each chord+text pair as inline-block so they wrap naturally
    // while keeping each chord positioned above its syllable
    return (
      <div key={idx} className={hasLyrics ? "mb-2 last:mb-0" : "last:mb-0"} style={{ lineHeight: 1 }}>
        <div className="flex flex-wrap items-end">
          {pairs.map((p, i) => {
            const chord = p.chord
              ? (nns ? getNashvilleNumber(p.chord, songKey) : transposeChord(p.chord, effectiveTranspose))
              : null;

            return (
              <span key={i} className="inline-flex flex-col justify-end">
                {chord && (
                  <span
                    className="font-bold text-[var(--chord)] leading-none select-none whitespace-nowrap"
                    style={{
                      paddingBottom: hasLyrics ? 3 : 0,
                      fontFamily: 'var(--chart-font-chord, var(--font-mono))',
                      fontSize: 'var(--chart-font-size-chord, 0.95em)',
                    }}
                  >
                    {chord}{'\u2003'}
                  </span>
                )}
                {hasLyrics && (
                  <span
                    className="whitespace-pre-wrap leading-tight"
                    style={{ color: 'var(--chart-text, var(--text-1))' }}
                  >
                    {p.text || (chord ? '\u00A0' : '')}
                  </span>
                )}
              </span>
            );
          })}
          {inlineNotes && inlineNote && (
            <span
              className="italic text-[0.8em] self-end"
              style={{ color: 'var(--chart-subtle, var(--text-2))' }}
            >
              {NOTE_SEPARATORS[noteStyle] || NOTE_SEPARATORS.dashes}{inlineNote}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mb-6 md:mb-8 break-inside-avoid">
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
      <div>
        {(section.lines || []).map((line, i) => renderLine(line, i))}
      </div>
    </div>
  );
}
