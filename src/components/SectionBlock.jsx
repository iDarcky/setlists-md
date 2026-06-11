import { useMemo } from 'react';
import { transposeChord, sectionStyle, sectionLabel, getNashvilleNumber } from '../music';
import { parseLine } from '../parser';
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
function groupChordWords(pairs) {
  const words = [];
  let cur = [];
  let pending = null;
  const flush = () => { if (cur.length) { words.push({ segments: cur }); cur = []; } };
  for (const p of pairs) {
    if (p.chord) pending = pending ?? p.chord;
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
  section, transpose, modOffset = 0, nns, songKey,
  showChords = true, showLyrics = true, showTabs = true, inlineNotes = true, noteStyle = 'dashes',
  sectionColors, sectionLabels, customSectionTypes, tabScale = 1, tabColors, tabInstrument = 'all',
}) {
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

  const renderLine = (line, idx) => {
    if (typeof line !== 'string') {
      if (line.type === 'tab') return showTabs && tabMatches(line.instrument) ? <TabBlock key={idx} data={line} scale={tabScale} colors={tabColors} /> : null;
      if (line.type === 'tabref') return showTabs && line.tab && tabMatches(line.tab.instrument) ? <TabBlock key={idx} data={line.tab} scale={tabScale} colors={tabColors} /> : null;
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

    // Plain text line (no chords) or chords hidden — this branch only renders
    // lyric text, so skip it entirely when lyrics are hidden.
    if (!cleanLine.includes('[') || !showChords) {
      if (!showLyrics) return null;
      const displayLine = !showChords ? cleanLine.replace(/\[.*?\]/g, '') : cleanLine;
      return (
        <div
          key={idx}
          className="min-h-[1.3em] whitespace-pre-wrap opacity-90"
          style={{
            color: 'var(--chart-text, var(--text-1))',
            lineHeight: 'var(--chart-line-height-lyric, 1.35)',
          }}
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

    // Parse into chord+text pairs using the parser. When lyrics are hidden,
    // drop the text so the line renders chords-only.
    const parsedPairs = parseLine(cleanLine);
    const pairs = showLyrics ? parsedPairs : parsedPairs.map(p => ({ ...p, text: '' }));
    const hasLyrics = pairs.some(p => p.text.trim());

    const renderChord = (rawChord, padded) => {
      const chord = nns ? getNashvilleNumber(rawChord, songKey) : transposeChord(rawChord, effectiveTranspose);
      return (
        <span
          className="font-bold text-[var(--chord)] leading-none select-none whitespace-nowrap"
          style={{
            paddingBottom: hasLyrics ? 3 : 0,
            fontFamily: 'var(--chart-font-chord, var(--font-mono))',
            fontSize: 'var(--chart-font-size-chord, 0.95em)',
          }}
        >
          {chord}{padded ? '\u2003' : ''}
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
          marginBottom: hasLyrics ? 'calc(var(--chart-section-gap, 24px) / 3)' : 0,
          lineHeight: 1,
        }}
      >
        <div className="flex flex-wrap items-end">
          {hasLyrics
            ? groupChordWords(pairs).map((w, wi) => (
                w.space ? (
                  <span key={wi} style={{ whiteSpace: 'pre' }}>{w.space}</span>
                ) : (
                  <span key={wi} className="inline-flex items-end" style={{ whiteSpace: 'nowrap' }}>
                    {w.segments.map((seg, si) => (
                      <span key={si} className="inline-flex flex-col justify-end">
                        {seg.chord && renderChord(seg.chord, true)}
                        <span
                          className="whitespace-pre"
                          style={{
                            color: 'var(--chart-text, var(--text-1))',
                            lineHeight: 'var(--chart-line-height-lyric, 1.25)',
                          }}
                        >
                          {seg.text || (seg.chord ? '\u00A0' : '')}
                        </span>
                      </span>
                    ))}
                  </span>
                )
              ))
            : pairs.map((p, i) => (
                <span key={i} className="inline-flex flex-col justify-end">
                  {p.chord && renderChord(p.chord, true)}
                </span>
              ))}
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
    <div
      className="break-inside-avoid"
      style={{
        marginBottom: 'var(--chart-section-gap, 24px)',
        lineHeight: 'var(--chart-line-height-lyric, 1.35)',
      }}
    >
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
