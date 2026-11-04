import { Fragment, useMemo } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { buildSongFlow, repeatFirstIndex, repeatRuns } from '@/lib/songFlow';
import { resolveKeyChanges, fromBodyMarkers } from '@/lib/keyChanges';
import { parseLine, extractInlineNotes } from '@/parser';
import { transposeChord, transposeKey, compactLabel } from '@/music';
import TabBlock from '@/features/chart/TabBlock';

// The chart on the song page, drawn new (owner, 2026-11-04: the old chart
// "looks sad on this new page"). Song page ONLY: setlists and live still read
// through the Reader, whose decisions live in docs/READER.md.
//
// What it is: the page's own warm black, gold chords in Geist Mono (the design system's gold, `warning-text`, not the reader's chart-theme `--chord`), each
// section named by the same chip as the Order row, a chords-only line as bar
// boxes, cues and inline notes as gold pills on the name row. One column on a
// phone; two on a wide screen, and a section never splits across them.
//
// What it shares with the Reader is the arithmetic, not the drawing: play
// order, the key-change overlay (stored, else the body's {modulate} markers)
// and which plays are repeats all come from the same lib functions, so the two
// never disagree about what the song IS.

const chipCls = 'inline-flex h-7 min-w-8 shrink-0 items-center justify-center rounded-[7px] bg-selected px-1.5 text-[12px] font-semibold text-link';
const pillCls = 'inline-flex h-6 shrink-0 items-center rounded-full bg-warning-fill px-2.5 text-[12px] font-medium text-warning-text';

/** One line of words with its chords over the letters they start on. */
function ChordLine({ line, shift, sharps, show }) {
  const { clean, notes } = extractInlineNotes(line);
  const parts = parseLine(clean);
  const words = parts.map(p => p.text).join('');
  const hasChords = parts.some(p => p.chord);
  const tr = (c) => transposeChord(c, shift, sharps);
  const noteEls = notes.filter(n => n.trim()).map((n, k) => <span key={`n${k}`} className={cn(pillCls, 'ml-2 align-middle')}>{n.trim()}</span>);

  // Chords and nothing to sing: bar boxes, | G | C | G | D |.
  if (!words.trim()) {
    if (!hasChords) return notes.length ? <div className="py-1">{noteEls}</div> : <div className="h-3" aria-hidden="true" />;
    if (show === 'lyrics') return null;
    return (
      <div className="flex flex-wrap items-center gap-1.5 py-1">
        {parts.filter(p => p.chord).map((p, k) => (
          <span key={k} className="inline-flex h-9 min-w-12 items-center justify-center rounded-[8px] border border-border bg-card px-2.5 font-mono text-[15px] font-semibold text-warning-text">{tr(p.chord)}</span>
        ))}
        {noteEls}
      </div>
    );
  }

  if (show === 'lyrics' || !hasChords) {
    return <p className="m-0 whitespace-pre-wrap py-[3px] text-[17px] leading-[26px] text-foreground">{words}{noteEls}</p>;
  }

  // Each chord stands on the first letter of its piece; a piece too short for
  // its chord is padded so the next chord never touches it.
  return (
    <div className="flex flex-wrap items-end pb-1 pt-0.5">
      {parts.map((p, k) => {
        const chord = p.chord ? tr(p.chord) : '';
        // A chord wider than its piece of a word ("[G]A[G7]mazing") pushes
        // the rest of the word along; a dash in the gap keeps it one word.
        const midWord = /\p{L}$/u.test(p.text) && /^\p{L}/u.test(parts[k + 1]?.text || '') && !!parts[k + 1]?.chord;
        const short = chord.length + 1 > p.text.length;
        return (
          <span key={k} className="inline-flex flex-col">
            <span className={cn('h-[22px] whitespace-pre font-mono text-[15px] font-semibold leading-[22px] text-warning-text', chord && 'pr-1.5')}>{chord}</span>
            <span className="flex whitespace-pre text-[17px] leading-[26px] text-foreground">
              {p.text || '\u00a0'}
              {midWord && short && <span aria-hidden="true" className="flex-1 text-center text-muted-foreground">-</span>}
            </span>
          </span>
        );
      })}
      {noteEls.length > 0 && <span className="pb-0.5">{noteEls}</span>}
    </div>
  );
}

/**
 * @param {object} p
 * @param {object} p.song   the resolved arrangement view (sections, structure, key, keyChanges)
 * @param {number} p.semis  the page's transpose, in semitones
 * @param {boolean} p.sharps
 * @param {'chords'|'lyrics'} p.show
 */
export default function SongChart({ song, semis = 0, sharps, show = 'chords', layout = 'auto', customSectionTypes = null }) {
  const desk = useMediaQuery('(min-width: 1024px)');
  const wide = layout === 'desk' || (layout === 'auto' && desk);
  const { ordered } = useMemo(() => buildSongFlow(song), [song]);
  const overlay = useMemo(() => {
    const stored = song?.keyChanges;
    return Array.isArray(stored) && stored.length > 0 ? stored : fromBodyMarkers(ordered);
  }, [song?.keyChanges, ordered]);
  const { slotOffsets, slotMarks, slotSignatures } = useMemo(() => resolveKeyChanges(ordered, overlay), [ordered, overlay]);
  const repeats = useMemo(() => repeatFirstIndex(ordered, slotSignatures), [ordered, slotSignatures]);
  // Consecutive plays of the same section fold into the first: "Chorus ×2".
  const runs = useMemo(() => repeatRuns(ordered, repeats), [ordered, repeats]);
  const keyName = (offset) => transposeKey(song?.key || 'C', offset + semis, sharps);

  if (!ordered.length) {
    return <p className="m-0 px-3 py-6 text-[15px] text-muted-foreground">No chart yet.</p>;
  }

  const blocks = [];
  const skip = new Set();
  ordered.forEach((sec, i) => {
    const run = runs[i];
    if (skip.has(i) || (run && !run.lead)) return; // folded into a play before it
    const type = String(sec?.type || '');
    const code = compactLabel(type, customSectionTypes);
    // How many times in a row this is played. A first play followed straight
    // away by its own repeats carries the count ("Chorus ×2"); a repeat run
    // later in the song carries its own ("Chorus again ×2").
    let times = run?.lead ? run.count : 1;
    const next = runs[i + 1];
    if (repeats[i] < 0 && next?.lead && repeats[i + 1] === i) {
      times += next.count;
      next.slots.forEach(s => skip.add(s));
    }
    const marks = slotMarks[i] || [];
    const entry = marks.find(m => m.line === 0);
    const cue = typeof sec?.note === 'string' ? sec.note.trim() : '';

    if (repeats[i] >= 0) {
      // Sung before, same key: a one-row reminder, not the words again.
      blocks.push({
        slot: i,
        el: (
          <div key={i} className="flex flex-wrap items-center gap-2 py-2">
            <span className={chipCls}>{code}</span>
            <b className="text-[15px] font-semibold text-foreground">{type}</b>
            <span className="text-[13px] text-muted-foreground">again{times > 1 ? ` ×${times}` : ''}</span>
            {cue && <span className={pillCls}>{cue}</span>}
          </div>
        ),
      });
      return;
    }

    // Lyrics only: a section with nothing to sing (an intro, a turnaround)
    // would be a name over an empty space, so it is left out.
    const sings = (sec?.lines || []).some(l => typeof l === 'string' && extractInlineNotes(l).clean.replace(/\[[^\]]*\]/g, '').trim());
    if (show === 'lyrics' && !sings) return;

    let shift = slotOffsets[i];
    const lines = [];
    (sec?.lines || []).forEach((line, li) => {
      const mark = marks.find(m => m.line === li);
      if (mark) {
        shift = mark.offset;
        if (li > 0) lines.push(<div key={`k${li}`} className="py-1"><span className={pillCls}>↗ Key of {keyName(mark.offset)}</span></div>);
      }
      if (typeof line === 'object' && line) {
        if (line.type === 'tab' && show !== 'lyrics') {
          lines.push(<div key={li} className="overflow-x-auto py-2"><TabBlock data={line} transpose={shift + semis} writtenKey={song?.key} /></div>);
        }
        return;
      }
      const el = <ChordLine key={li} line={String(line ?? '')} shift={shift + semis} sharps={sharps} show={show} />;
      lines.push(el);
    });

    blocks.push({
      slot: i,
      el: (
        <section key={i} className="break-inside-avoid pb-5">
          <div className="flex flex-wrap items-center gap-2 pb-1.5">
            <span className={chipCls}>{code}</span>
            <b className="text-[15px] font-semibold text-foreground">{type}</b>
            {times > 1 && <span className="text-[13px] font-semibold text-muted-foreground">×{times}</span>}
            {entry && <span className={pillCls}>↗ Key of {keyName(entry.offset)}</span>}
            {cue && <span className={pillCls}>{cue}</span>}
          </div>
          {lines}
        </section>
      ),
    });
  });

  return (
    <div data-slot="song-chart" className={cn('wide-container !px-3 pb-6 pt-3 font-sans', wide && 'columns-2 gap-10')}>
      {blocks.map(b => <Fragment key={b.slot}>{b.el}</Fragment>)}
    </div>
  );
}
