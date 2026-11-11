import { Fragment, useMemo } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { buildSongFlow, repeatFirstIndex, repeatRuns } from '@/lib/songFlow';
import { resolveKeyChanges, fromBodyMarkers } from '@/lib/keyChanges';
import { extractInlineNotes } from '@/parser';
import { sectionTone } from '@/lib/sectionTone';
import SectionBlock from '@/features/chart/SectionBlock';

// The chart on the song page, drawn new (owner, 2026-11-04: the old chart
// "looks sad on this new page").
//
// It draws the same sections as the Reader's new look (owner, 2026-11-04: "the
// song page uses the same section drawing"): the section BODY is the Reader's
// own SectionBlock, so chords, the Aa fonts, sizes and colours, bar boxes,
// key-change pills and tabs come from one renderer. What is drawn here is only
// what a scrolling page needs and the Reader does differently: the heading row
// (same chip, same gold cue pill, not sticky), "again" rows for repeats, ×N,
// and two columns on a wide screen.
//
// Play order, the key-change overlay (stored, else the body's {modulate}
// markers) and which plays are repeats come from the same lib functions as the
// Reader, so the two never disagree about what the song IS.

const chipCls = 'inline-flex h-7 min-w-8 shrink-0 items-center justify-center rounded-[7px] px-1.5 text-[12px] font-semibold';
// A section's band cue: quiet grey text at the right of its name, the way
// MultiTracks prints it (QA 11 Nov: the gold pills shouted).
const pillCls = 'ml-auto text-right text-[13px] italic text-muted-foreground';

/**
 * @param {object} p
 * @param {object} p.song   the resolved arrangement view (sections, structure, key, keyChanges)
 * @param {number} p.semis  the page's transpose, in semitones
 * @param {boolean} p.sharps
 * @param {'chords'|'lyrics'} p.show
 */
// The section heading follows the Reader's own Heading setting, so the song
// page and the Reader never disagree (QA 11 Nov: "still uses chip then name,
// remove one of them"). 'chip' = the name alone in the section's colour (the
// default, shown as "Name"), 'chipOnly' = the chip alone, 'both' = chip + name.
// Retired values read the way the Reader reads them.
const HEADING_ALIAS = { code: 'chipOnly', caps: 'chip', name: 'chip' };

export default function SongChart({ song, semis = 0, sharps, show = 'chords', layout = 'auto', customSectionTypes = null, heading = 'chip' }) {
  const look = HEADING_ALIAS[heading] || heading || 'chip';
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
    const tone = sectionTone(type, customSectionTypes);
    const chip = look !== 'chip' && <span className={chipCls} style={{ color: tone.fg, background: tone.bg }} {...(look === 'chipOnly' ? { 'aria-label': type, role: 'img' } : null)}>{tone.code}</span>;
    const name = look !== 'chipOnly' && <b className={`text-[15px] font-semibold${look === 'chip' ? '' : ' text-foreground'}`} style={look === 'chip' ? { color: tone.fg } : undefined}>{type}</b>;
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
            {chip}
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

    // The body is the Reader's own SectionBlock (owner, 2026-11-04: the song
    // page uses the same section drawing as the reader), so chord placement,
    // the Aa fonts and sizes, bar boxes, key-change pills and tabs are one
    // renderer in both places. Only the heading row is drawn here.
    const body = (
      <SectionBlock
        section={sec}
        transpose={semis}
        keyTranspose={semis}
        modOffset={slotOffsets[i] ?? 0}
        keyMarks={marks}
        songKey={song?.key}
        accidentals={sharps ? 'sharps' : 'flats'}
        showChords={show !== 'lyrics'}
        showLyrics
        showTabs={show !== 'lyrics'}
        tabInstrument="all"
        hideHeading
        notePlacement={wide ? 'leader' : 'above'}
        customSectionTypes={customSectionTypes}
        tabTranspose={semis}
        chordBars
      />
    );

    blocks.push({
      slot: i,
      el: (
        <section key={i} className="break-inside-avoid pb-1">
          <div className="flex flex-wrap items-center gap-2 pb-1.5">
            {chip}
            {name}
            {times > 1 && <span className="text-[13px] font-semibold text-muted-foreground">×{times}</span>}
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
