import { Fragment } from 'react';
import { notateChord } from '@/music';
import { extractInlineNotes } from '@/parser';
import { lineGroups } from '@/lib/plainLines';
import TabBlock from '@/features/chart/TabBlock';

// The song page's section body: plain lyrics with chords above them, in the
// APP's theme (owner, 2026-11-17: "the song uses a version of the chart, and
// it should not, it should just be plain lyrics and chords based on the
// theme"). It deliberately ignores the Reader's Aa settings (chart theme,
// fonts, sizes, bar boxes, chord colour): those belong to Play.
//
// Chords are the design system's gold (`--warning-text`, the same token the
// Warm chart theme uses), lyrics are `--foreground`, everything else is muted.

// "G7" → G + raised 7; "Dsus4/F#" → D + raised sus4 + /F#. Minor stays on the line.
function ChordText({ chord }) {
  const m = /^([A-G][#b♯♭]?(?:m(?!aj))?)([^/]*)(\/.*)?$/.exec(chord);
  if (!m || !m[2]) return chord;
  return <>{m[1]}<sup className="text-[0.72em] leading-none">{m[2]}</sup>{m[3] || ''}</>;
}

export default function PlainLines({
  section, semis = 0, sharps, songKey, keyMarks = null, modOffset = 0, showChords = true, showTabs = true, showNotes = true,
}) {
  const accidentals = sharps ? 'sharps' : 'flats';
  const name = (c, offset) => notateChord(c, { key: songKey, transpose: semis + offset, accidentals });
  let offset = modOffset;
  const out = [];

  (section.lines || []).forEach((line, i) => {
    for (const m of keyMarks || []) {
      if (m.line !== i) continue;
      offset = m.offset;
      const to = songKey ? notateChord(songKey, { key: songKey, transpose: semis + m.offset, accidentals }) : null;
      out.push(
        <div key={`k${i}-${m.semitones}`} className="py-1 text-[13px] font-semibold text-warning-text">
          Key change{to ? ` to ${to}` : ` ${m.semitones > 0 ? '+' : ''}${m.semitones}`}
        </div>,
      );
    }

    if (line && typeof line === 'object') {
      const tab = line.type === 'tab' ? line : line.type === 'tabref' ? line.tab : null;
      if (tab && showTabs) out.push(<div key={i} className="py-1"><TabBlock data={tab} transpose={semis} writtenKey={songKey} /></div>);
      // `modulate` objects are drawn from keyMarks above (the overlay wins).
      return;
    }

    const { clean, notes: lineNotes } = extractInlineNotes(String(line ?? ''));
    const notes = showNotes ? lineNotes : [];
    const noteEl = notes.length > 0 && (
      <span className="ml-2 text-[13px] italic text-muted-foreground">{notes.join(' · ')}</span>
    );
    const groups = lineGroups(clean);
    const hasChords = showChords && groups.some(g => g.some(t => t.chord));
    const words = clean.replace(/\[[^\]]*\]/g, '');

    if (!words.trim() && !hasChords) {
      // An empty line is a breath between lines, not nothing.
      out.push(notes.length ? <div key={i} className="leading-snug">{noteEl}</div> : <div key={i} className="h-3" aria-hidden="true" />);
      return;
    }

    if (!hasChords) {
      out.push(<div key={i} className="whitespace-pre-wrap text-[17px] leading-snug text-foreground">{words}{noteEl}</div>);
      return;
    }

    if (!words.trim()) {
      // A chords-only line (intro, solo): the chords in a row, plainly.
      const chords = groups.flat().filter(t => t.chord).map(t => t.chord);
      out.push(
        <div key={i} className="flex flex-wrap items-baseline gap-x-4 py-0.5 text-[15px] font-semibold text-warning-text">
          {chords.map((c, j) => <span key={j}><ChordText chord={name(c, offset)} /></span>)}
          {noteEl}
        </div>,
      );
      return;
    }

    out.push(
      <div key={i} className="flex flex-wrap items-end">
        {groups.map((g, gi) => (
          <span key={gi} className="inline-flex items-end">
            {g.map((t, ti) => (
              <span key={ti} className="inline-flex flex-col">
                <span className="whitespace-nowrap pr-1.5 text-[14px] font-semibold leading-tight text-warning-text">
                  {t.chord ? <ChordText chord={name(t.chord, offset)} /> : '\u00a0'}
                </span>
                <span className="whitespace-pre text-[17px] leading-snug text-foreground">{t.text || ' '}</span>
              </span>
            ))}
          </span>
        ))}
        {noteEl}
      </div>,
    );
  });

  return <Fragment>{out}</Fragment>;
}
