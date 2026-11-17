import { Fragment, useMemo } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { buildSongFlow, repeatFirstIndex, repeatRuns } from '@/lib/songFlow';
import { resolveKeyChanges, fromBodyMarkers } from '@/lib/keyChanges';
import { extractInlineNotes } from '@/parser';
import PlainLines from './PlainLines';

// The song page's lyrics and chords. PLAIN (owner, 2026-11-17): "the song is
// using a version of the chart, and it should not, it should just be plain
// lyrics and chords based on the theme". So no Reader renderer here: the body
// is PlainLines (app theme colours, one type size, chords above words), and
// the section name is a quiet label, not the Reader's coloured chip. The
// Reader's look (Aa: chart theme, fonts, bar boxes) lives in Play only.
//
// Play order, the key-change overlay (stored, else the body's {modulate}
// markers) and which plays are repeats still come from the same lib functions
// as the Reader, so the two never disagree about what the song IS.

// A section's band cue: quiet grey text at the right of its name.
const pillCls = 'ml-auto text-right text-[13px] italic text-muted-foreground';
const nameCls = 'text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground';

/**
 * @param {object} p
 * @param {object} p.song   the resolved arrangement view (sections, structure, key, keyChanges)
 * @param {number} p.semis  the page's transpose, in semitones
 * @param {boolean} p.sharps
 * @param {'chords'|'lyrics'} p.show
 */
export default function SongChart({ song, semis = 0, sharps, show = 'chords', layout = 'auto' }) {
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

  if (!ordered.length) {
    return <p className="m-0 px-3 py-6 text-[15px] text-muted-foreground">No chart yet.</p>;
  }

  const blocks = [];
  const skip = new Set();
  ordered.forEach((sec, i) => {
    const run = runs[i];
    if (skip.has(i) || (run && !run.lead)) return; // folded into a play before it
    const type = String(sec?.type || '');
    const name = <span className={nameCls}>{type}</span>;
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
    const cue = typeof sec?.note === 'string' ? sec.note.trim() : '';

    if (repeats[i] >= 0) {
      // Sung before, same key: a one-row reminder, not the words again.
      blocks.push({
        slot: i,
        el: (
          <div key={i} className="flex flex-wrap items-center gap-2 py-2">
            {name}
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

    const body = (
      <PlainLines
        section={sec}
        semis={semis}
        sharps={sharps}
        songKey={song?.key}
        keyMarks={marks}
        modOffset={slotOffsets[i] ?? 0}
        showChords={show !== 'lyrics'}
        showTabs={show !== 'lyrics'}
      />
    );

    blocks.push({
      slot: i,
      el: (
        <section key={i} className="break-inside-avoid pb-5">
          <div className="flex flex-wrap items-center gap-2 pb-1">
            {name}
            {times > 1 && <span className="text-[12px] font-semibold text-muted-foreground">×{times}</span>}
            {cue && <span className={pillCls}>{cue}</span>}
          </div>
          {body}
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
