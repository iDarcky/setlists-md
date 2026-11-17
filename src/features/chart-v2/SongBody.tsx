import { Fragment, type ComponentType } from 'react';
import { notateChord as notateChordJs, transposeKey } from '@/music';
import { sectionTone } from '@/lib/sectionTone';
import TabBlockJs from '@/features/chart/TabBlock';
import { Chord } from './Chord';
import { playName, viewLine } from './lines';
import type { LineView, Play, TabLine } from './types';

// music.js is untyped; this is the shape the chart relies on.
const notateChord = notateChordJs as (chord: string, opts: { key?: string; transpose?: number; accidentals?: string }) => string;

// The old tab renderer, used as it is until tabs get their own pass.
const TabBlock = TabBlockJs as unknown as ComponentType<{ data: TabLine; transpose?: number; writtenKey?: string }>;

interface Props {
  plays: Play[];
  songKey?: string;
  /** The setlist's transpose for this song, in semitones. */
  transpose: number;
  accidentals: string;
  /** Where sticky headings pin: the height of whatever is pinned above them. */
  stickyTop: number;
  sectionRef: (slot: number, el: HTMLElement | null) => void;
  /** Room for the floating structure pill on its side. */
  inset?: 'pl-11' | 'pr-11' | 'pl-16' | 'pr-16' | string;
}

function LyricLine({ view, show }: { view: Extract<LineView, { kind: 'lyrics' }>; show: (c: string) => string }) {
  return (
    <div className="flex flex-wrap items-end">
      {view.groups.map((g, gi) => (
        <span key={gi} className="inline-flex items-end">
          {g.map((t, ti) => (
            <span key={ti} className="inline-flex flex-col">
              {view.hasChords && (
                <span className="whitespace-pre pr-1.5 text-[15px] leading-[1.3] font-semibold text-warning-text">
                  {t.chord ? <Chord name={show(t.chord)} /> : ' '}
                </span>
              )}
              <span className="whitespace-pre text-[18px] leading-[1.45] text-foreground">{t.text || ' '}</span>
            </span>
          ))}
        </span>
      ))}
      {view.notes.map((n, i) => (
        <span key={`n${i}`} className="ml-2 self-end text-small leading-[1.45] italic text-muted-foreground">{n}</span>
      ))}
    </div>
  );
}

/** A chords-only line (intro, solo) as bars: | G | G/B | C | G | */
function Bars({ chords, notes, show }: { chords: string[]; notes: string[]; show: (c: string) => string }) {
  return (
    <div className="flex flex-wrap items-center gap-y-1">
      {chords.map((c, i) => (
        <Fragment key={i}>
          <span aria-hidden className="h-5 w-px bg-border" />
          <span className="min-w-14 px-3 text-[15px] font-semibold text-warning-text"><Chord name={show(c)} /></span>
        </Fragment>
      ))}
      <span aria-hidden className="h-5 w-px bg-border" />
      {notes.map((n, i) => <span key={`n${i}`} className="ml-2 text-small italic text-muted-foreground">{n}</span>)}
    </div>
  );
}

export function SongBody({ inset, plays, songKey, transpose, accidentals, stickyTop, sectionRef }: Props) {
  return (
    <div className={`flex flex-col gap-6 px-5 pt-4 pb-10 ${inset ?? ''}`}>
      {plays.map(p => {
        const tone = sectionTone(p.section.type) as { fg: string };
        let offset = p.offset;
        return (
          <section key={p.slot} ref={el => sectionRef(p.slot, el)} data-slot={p.slot} aria-label={playName(p)}>
            {/* Always sticky (owner, 2026-11-18: the setting goes). It pins under
                whatever is pinned above, or the top of the screen if nothing is. */}
            <h2
              className="sticky z-[1] -mx-5 flex h-8 items-center gap-2 bg-background px-5 text-[13px] font-semibold tracking-[0.02em] transition-[top] duration-200"
              style={{ top: stickyTop, color: tone.fg }}
            >
              {playName(p)}
              {p.runCount > 1 && <span className="text-caption font-medium text-muted-foreground">plays {p.runCount} times</span>}
            </h2>
            {p.section.note && (
              <p className="mb-1 text-small italic text-muted-foreground">{p.section.note}</p>
            )}
            <div className="flex flex-col gap-1">
              {p.section.lines.map((line, li) => {
                const marks = p.marks.filter(m => m.line === li);
                if (marks.length) offset = marks[marks.length - 1].offset;
                const t = transpose + offset;
                const show = (c: string) => notateChord(c, { key: songKey, transpose: t, accidentals });
                const view = viewLine(line);
                return (
                  <Fragment key={li}>
                    {marks.map((m, mi) => (
                      <div key={`k${mi}`} className="my-1 text-small font-semibold text-warning-text">
                        Key change {m.semitones > 0 ? '↑' : '↓'} {songKey ? transposeKey(songKey, transpose + m.offset) : `${Math.abs(m.semitones)}`}
                      </div>
                    ))}
                    {view.kind === 'gap' && <div className="h-3" />}
                    {view.kind === 'lyrics' && <LyricLine view={view} show={show} />}
                    {view.kind === 'bars' && <Bars chords={view.chords} notes={view.notes} show={show} />}
                    {view.kind === 'tab' && <TabBlock data={view.tab} transpose={t} writtenKey={songKey} />}
                  </Fragment>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
