import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { resolveSongView } from '@/arrangements';
import { transposeKey } from '@/music';
import { normalizeRibbonStyle } from '@/lib/readerConfig';
import { ChartFooter } from './ChartFooter';
import { ChartHeader, SetlistBar } from './ChartHeader';
import { songPlays, structureBoxes } from './plays';
import { SongBody } from './SongBody';
import { StructureRow, type RibbonPosition, type RibbonStyle } from './StructureRow';
import type { ChartMode, Setlist, SetlistItem, SongView } from './types';

// ── The new chart (Labs: "New chart", 2026-11-18) ───────────────────────────
// Built from zero in TypeScript, holding ONLY what the owner has decided. The
// old reader (features/reader) stays what the band uses until this one
// reaches parity; App picks between them on `settings.chartV2`.
//
// Decided so far: header C, which slides away on scroll down and back on
// scroll up; the structure row pinned (Boxes by default, every style and
// position respected); LIVE at the start of that row; the ✕ always there;
// sticky section headings always on; repeats written out ("· 2nd time");
// chords-only lines as bars; raised extensions; lyrics 18 / chords 15;
// progress on the footer's top edge. Not here yet: the ☰ menu, Aa settings,
// light edit, live follow, click/track, the finale.

interface RawSong { id: string; title: string; [key: string]: unknown }

interface Props {
  setlist: Setlist;
  songs: RawSong[];
  settings: Record<string, unknown> | null;
  mode?: ChartMode;
  startIndex?: number;
  onBack: () => void;
  onFinish: (stats: { startTime: number; endTime: number }) => void;
}

interface Slot {
  item: SetlistItem;
  song: SongView | null;
  isBreak: boolean;
  label: string;
}

const POSITIONS: RibbonPosition[] = ['top', 'bottom', 'left', 'right', 'off'];

function resolveSlot(it: SetlistItem, songs: RawSong[]): Slot {
  if (it.type === 'break') return { item: it, song: null, isBreak: true, label: it.label || 'Break' };
  if (it.placeholder && !it.songId) return { item: it, song: null, isBreak: true, label: it.label ? `${it.label} (to be chosen)` : 'Song (to be chosen)' };
  const raw = songs.find(s => s.id === it.songId) || (it.songTitle ? songs.find(s => s.title === it.songTitle) : undefined);
  const view = raw ? (resolveSongView(raw, it.arrangementId) as SongView | null) : null;
  // The setlist's tempo for this slot wins over the song's (CLAUDE.md).
  const tempo = Number((it as { tempo?: unknown }).tempo);
  const song = view && tempo > 0 ? { ...view, tempo } : view;
  return { item: it, song, isBreak: false, label: song?.title || it.songTitle || 'Song' };
}

export default function ChartV2({ setlist, songs, settings, mode = 'practice', startIndex = 0, onBack, onFinish }: Props) {
  const [startTime] = useState(() => Date.now());
  const slots = useMemo(() => (setlist?.items || []).map(it => resolveSlot(it, songs)), [setlist, songs]);
  const total = slots.length;
  const [idx, setIdx] = useState(() => Math.max(0, Math.min(total - 1, startIndex)));
  const cur = slots[idx];
  const song = cur?.song || null;
  const transpose = Number(cur?.item.transpose) || 0;
  const shownKey = song?.key ? (transpose ? (transposeKey(song.key, transpose) as string) : song.key) : undefined;

  const ribbonStyle = normalizeRibbonStyle(settings?.ribbonStyle) as RibbonStyle;
  const stored = settings?.structurePosition as RibbonPosition;
  const position: RibbonPosition = POSITIONS.includes(stored) ? stored : 'top';
  const showSetlistBar = settings?.readerTopBar === 'setlist' && total > 1;
  const accidentals = String(settings?.accidentals || 'auto');
  const live = mode === 'live';

  const plays = useMemo(() => (song ? songPlays(song) : []), [song]);
  const boxes = useMemo(() => structureBoxes(plays), [plays]);
  const hasRow = position !== 'off' && boxes.length > 0;
  const rowOnTop = hasRow && position === 'top';
  const rowOnSide = hasRow && (position === 'left' || position === 'right');

  // ── Header slides away on scroll down, back on scroll up ──────────────
  const scroller = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const [headH, setHeadH] = useState(64);
  const [hidden, setHidden] = useState(false);
  const hiddenRef = useRef(false);
  const jumpingUntil = useRef(0);
  const [active, setActive] = useState(0);
  const lastY = useRef(0);
  const sections = useRef(new Map<number, HTMLElement>());
  const rowH = rowOnTop ? 40 : 0;

  useLayoutEffect(() => {
    const el = headRef.current;
    if (!el) return;
    const measure = () => setHeadH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A new song starts at its top with the header back.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    lastY.current = 0;
  }, [idx]);

  const pinned = (hidden ? 0 : headH) + rowH;

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const y = el.scrollTop;
    const d = y - lastY.current;
    let hide = hiddenRef.current;
    // A tap on the structure row scrolls on its own; its direction is not the reader's.
    if (Date.now() < jumpingUntil.current) {
      lastY.current = y;
      return;
    }
    if (y < headH) hide = false;
    else if (d > 6) hide = true;
    else if (d < -6) hide = false;
    if (Math.abs(d) > 6 || y < headH) lastY.current = y;
    hiddenRef.current = hide;
    setHidden(hide);
    // The section just under the pinned chrome is the current one.
    const line = y + (hide ? 0 : headH) + rowH + 12;
    let cur = 0;
    for (const [slot, s] of sections.current) if (s.offsetTop <= line && slot > cur) cur = slot;
    // At the very bottom the last section is current even if it is short.
    if (y + el.clientHeight >= el.scrollHeight - 2 && sections.current.size) cur = Math.max(...sections.current.keys());
    setActive(cur);
  }, [headH, rowH]);

  const jump = useCallback((slot: number) => {
    const el = scroller.current;
    const s = sections.current.get(slot);
    if (!el || !s) return;
    const top = Math.max(0, s.offsetTop - rowH);
    const hide = top >= headH;
    hiddenRef.current = hide;
    setHidden(hide);
    jumpingUntil.current = Date.now() + 800;
    setActive(slot);
    el.scrollTo({ top: hide ? top : 0, behavior: 'smooth' });
  }, [rowH, headH]);

  const sectionRef = useCallback((slot: number, el: HTMLElement | null) => {
    if (el) sections.current.set(slot, el);
    else sections.current.delete(slot);
  }, []);

  const go = useCallback((n: number) => {
    setIdx(Math.max(0, Math.min(total - 1, n)));
    hiddenRef.current = false;
    setHidden(false);
    setActive(0);
  }, [total]);
  const finish = () => onFinish({ startTime, endTime: Date.now() });

  // Arrow keys and Bluetooth pedals (PageUp/PageDown) move between songs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go(idx + 1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(idx - 1);
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, idx, onBack]);

  const row = hasRow ? (
    <StructureRow boxes={boxes} activeSlot={active} style={ribbonStyle} position={position} live={live} onJump={jump} />
  ) : null;

  if (!cur) {
    return (
      <div className="fixed inset-0 z-fullscreen flex flex-col items-center justify-center gap-4 bg-background text-foreground">
        <p className="text-body text-muted-foreground">This setlist has no songs yet.</p>
        <button type="button" onClick={onBack} className="h-11 rounded-control bg-raised px-4 text-small font-medium">Back</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-fullscreen flex flex-col bg-background pt-[env(safe-area-inset-top)] text-foreground" data-chart="v2">
      <div className="flex min-h-0 flex-1">
        {rowOnSide && position === 'left' && row}
        <div className="relative min-w-0 flex-1">
          <div ref={scroller} onScroll={onScroll} className="absolute inset-0 overflow-y-auto overscroll-contain">
            {/* A spacer, not padding: a sticky heading measures its `top` from
                inside the scroller's padding, so padding would double it. */}
            <div aria-hidden style={{ height: headH + rowH }} />
            {cur.isBreak ? (
              <div className="flex min-h-full flex-col items-center justify-center gap-2 px-6 pb-16 text-center">
                <span className="text-label text-muted-foreground">Moment</span>
                <p className="text-title font-semibold">{cur.label}</p>
                {typeof cur.item.label === 'string' && cur.item.label !== cur.label && <p className="text-body text-muted-foreground">{cur.item.label}</p>}
              </div>
            ) : !song ? (
              <div className="flex min-h-full items-center justify-center px-6 pb-16 text-center text-body text-muted-foreground">
                “{cur.label}” is not in this library.
              </div>
            ) : (
              <SongBody plays={plays} songKey={song.key} transpose={transpose} accidentals={accidentals} stickyTop={pinned} sectionRef={sectionRef} />
            )}
          </div>
          {/* The chrome sits over the scroller: the header part moves up out of
              view, the structure row under it rides up to the top and stays. */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-chrome transition-transform duration-200 ease-out motion-reduce:transition-none"
            style={{ transform: `translateY(${hidden ? -headH : 0}px)` }}
          >
            <div ref={headRef} className="pointer-events-auto bg-background" aria-hidden={hidden || undefined} inert={hidden || undefined}>
              {showSetlistBar && <SetlistBar titles={slots.map(s => s.label)} current={idx} onPick={go} />}
              <ChartHeader
                title={cur.label}
                songKey={shownKey}
                tempo={song?.tempo}
                time={song?.time}
                onClose={onBack}
              />
            </div>
            {rowOnTop && <div className="pointer-events-auto">{row}</div>}
          </div>
        </div>
        {rowOnSide && position === 'right' && row}
      </div>
      {hasRow && position === 'bottom' && row}
      <ChartFooter
        index={idx}
        total={total}
        prevTitle={slots[idx - 1]?.label}
        nextTitle={slots[idx + 1]?.label}
        onPrev={() => go(idx - 1)}
        onNext={() => go(idx + 1)}
        onFinish={finish}
      />
    </div>
  );
}
