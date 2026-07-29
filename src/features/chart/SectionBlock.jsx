import { useMemo } from 'react';
import { notateChord, sectionStyle, sectionLabel } from '@/music';
import { parseLine } from '@/parser';
import TabBlock from './TabBlock';

const NOTE_SEPARATORS = {
  dashes: ' ---- ',
  dots:   ' ...... ',
  arrow:  ' ----> ',
};

// The note a bassist actually plays: the slash bass (e.g. C/E → E) when there
// is one, otherwise the chord root (Gsus4 → G, Bbm7 → Bb).
function bassNote(chord) {
  if (!chord) return chord;
  const parts = String(chord).split('/');
  const base = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  const m = base.match(/^[A-G][#b]?/);
  return m ? m[0] : base;
}

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
  section, transpose, modOffset = 0, nns, notation, songKey, accidentals = 'auto',
  showChords = true, showLyrics = true, showTabs = true, inlineNotes = true, noteStyle = 'dashes',
  sectionColors, sectionLabels, customSectionTypes, tabScale = 1, tabColors, tabInstrument = 'all', chordEmphasis = 'full',
  condensed = false, onJumpToFirst,
  // The reader renders its own (sticky) heading above this block, so it asks
  // for the body only. Default false keeps every existing caller unchanged.
  hideHeading = false,
  // Where a {!note} goes relative to its lyric line:
  //   'inline' — trailing the line, separated by dashes (default, unchanged)
  //   'above'  — on its own line ABOVE, so it is read before the line is sung
  //   'leader' — pushed to the right edge, joined by a dotted leader
  notePlacement = 'inline',
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
      if (line.type === 'tab') return showTabs && tabMatches(line.instrument) ? <TabBlock key={idx} data={line} scale={tabScale} colors={tabColors} /> : null;
      if (line.type === 'tabref') return showTabs && line.tab && tabMatches(line.tab.instrument) ? <TabBlock key={idx} data={line.tab} scale={tabScale} colors={tabColors} /> : null;
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
        <div key={idx}>
          {showNote && notePlacement === 'above' && noteAbove(inlineNote)}
          <div
            className={notePlacement === 'leader' ? 'min-h-[1.3em] flex items-baseline opacity-90' : 'min-h-[1.3em] whitespace-pre-wrap opacity-90'}
            style={{
              color: 'var(--chart-text, var(--text-1))',
              lineHeight: 'var(--chart-line-height-lyric, 1.35)',
            }}
          >
            <span className="whitespace-pre-wrap">{displayLine}</span>
            {showNote && notePlacement === 'inline' && (
              <span className="italic text-[0.8em]" style={{ color: 'var(--chart-subtle, var(--text-2))' }}>
                {NOTE_SEPARATORS[noteStyle] || NOTE_SEPARATORS.dashes}{inlineNote}
              </span>
            )}
            {showNote && notePlacement === 'leader' && noteLeader(inlineNote)}
          </div>
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
    const renderChord = (rawChord, padded) => {
      let chord = notateChord(rawChord, { key: songKey, notation: notationMode, transpose: effectiveTranspose, accidentals });
      // Bass "root emphasis": collapse each chord to the note a bassist plays —
      // the slash bass if present, otherwise the chord root.
      if (chordEmphasis === 'root') chord = bassNote(chord);
      return (
        <span
          className="font-bold text-[var(--chord)] leading-none select-none whitespace-nowrap"
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
          marginBottom: hasLyrics ? 'calc(var(--chart-section-gap, 24px) / 3)' : 0,
          lineHeight: 1,
        }}
      >
        {inlineNotes && inlineNote && notePlacement === 'above' && noteAbove(inlineNote)}
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
                return words.map((w, wi) => (
                w.space ? (
                  <span key={wi} style={{ whiteSpace: 'pre' }}>{w.space}</span>
                ) : (
                  <span key={wi} className="inline-flex items-end" style={{ whiteSpace: 'nowrap' }}>
                    {w.segments.map((seg, si) => (
                      <span key={si} className="inline-flex flex-col justify-end">
                        {seg.chord && renderChord(seg.chord, chordFollows(wi, si))}
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
              )); })()
            : pairs.map((p, i) => (
                <span key={i} className="inline-flex flex-col justify-end">
                  {p.chord && renderChord(p.chord, true)}
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
