import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { resolveSongView } from '@/arrangements';
import { transposeKey } from '@/music';
import { normalizeRibbonStyle, resolveViewCapabilities } from '@/lib/readerConfig';
import { capoFor as capoForJs, withCapo as withCapoJs } from '@/lib/capo';
import { KeySheet, type KeyScope } from './KeySheet';
import { useMediaQuery } from './ui';
import { ChartFooter } from './ChartFooter';
import { ChartHeader, SetlistBar } from './ChartHeader';
import { ChartSettings } from './ChartSettings';
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

const capoFor = capoForJs as (settings: unknown, songId: string, key?: string | null) => number;
const withCapo = withCapoJs as (settings: unknown, songId: string, capo: number, key?: string | null) => unknown;

interface RawSong { id: string; title: string; [key: string]: unknown }

interface Props {
  setlist: Setlist;
  songs: RawSong[];
  settings: Record<string, unknown> | null;
  mode?: ChartMode;
  onUpdateSettings?: (key: string, value: unknown) => void;
  /** Saves the setlist (practice keys, tempo, time). Null when read-only. */
  onUpdateSetlist?: ((s: Setlist) => void) | null;
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
  const time = (it as { time?: unknown }).time;
  const withTempo = view && tempo > 0 ? { ...view, tempo } : view;
  const song = withTempo && typeof time === 'string' && time ? { ...withTempo, time } : withTempo;
  return { item: it, song, isBreak: false, label: song?.title || it.songTitle || 'Song' };
}

export default function ChartV2({ setlist, songs, settings, mode: clockMode = 'practice', onUpdateSettings, onUpdateSetlist, startIndex = 0, onBack, onFinish }: Props) {
  const [startTime] = useState(() => Date.now());
  const slots = useMemo(() => (setlist?.items || []).map(it => resolveSlot(it, songs)), [setlist, songs]);
  const total = slots.length;
  const [idx, setIdx] = useState(() => Math.max(0, Math.min(total - 1, startIndex)));
  const cur = slots[idx];
  const song = cur?.song || null;
  // "Just for me" keys, by slot (a reprise is its own decision), this session only.
  const [myTranspose, setMyTranspose] = useState<Record<number, number>>({});
  const transpose = myTranspose[idx] ?? (Number(cur?.item.transpose) || 0);
  const [keyOpen, setKeyOpen] = useState(false);
  const shownKey = song?.key ? (transpose ? (transposeKey(song.key, transpose) as string) : song.key) : undefined;

  const storedStyle = normalizeRibbonStyle(settings?.ribbonStyle) as RibbonStyle;
  const stored = settings?.structurePosition as RibbonPosition;
  const position: RibbonPosition = POSITIONS.includes(stored) ? stored : 'top';
  // Chips carry whole names and do not fit down a side: there they draw as Boxes.
  const ribbonStyle: RibbonStyle = storedStyle === 'chips' && (position === 'left' || position === 'right') ? 'codes' : storedStyle;
  const setlistBarOn = settings?.readerTopBar === 'setlist';
  const showSetlistBar = setlistBarOn && total > 1;
  const barItems = useMemo(() => slots.map(s => {
    const t = Number(s.item.transpose) || 0;
    const k = s.song?.key;
    return { label: s.label, isBreak: s.isBreak, songKey: k ? (t ? (transposeKey(k, t) as string) : k) : undefined };
  }), [slots]);
  // Two columns from the iPad up when they fit (`defaultColumns`: 1, 2 or auto),
  // as today. The same setting the old chart's Aa writes.
  const wide = useMediaQuery('(min-width: 768px)');
  const colSetting = settings?.defaultColumns;
  const twoCols = wide && !!song && (colSetting === 2 || (colSetting !== 1 && wide));
  const accidentals = String(settings?.accidentals || 'auto');
  // A preview from the settings popover wins until the chart closes.
  const [previewMode, setPreviewMode] = useState<ChartMode | null>(null);
  const mode = previewMode ?? clockMode;
  const live = mode === 'live';
  const canSave = !!(resolveViewCapabilities(mode) as { saveKey?: boolean }).saveKey && !!onUpdateSetlist;
  // Capo is yours, per song, synced with your account (the existing songCapos map).
  const capo = song ? capoFor(settings, song.id, shownKey) : 0;

  const writeItem = (patch: (raw: SetlistItem) => SetlistItem) => {
    if (!onUpdateSetlist) return;
    onUpdateSetlist({ ...setlist, items: (setlist.items || []).map((raw, i) => (i === idx ? patch(raw) : raw)) });
  };
  const pickKey = (semis: number, scope: KeyScope) => {
    if (scope === 'band' && canSave) {
      setMyTranspose(prev => { const next = { ...prev }; delete next[idx]; return next; });
      writeItem(raw => ({ ...raw, transpose: semis }));
    } else {
      setMyTranspose(prev => ({ ...prev, [idx]: semis }));
    }
  };
  const pickTempo = (bpm: number | null) => writeItem(raw => {
    const { tempo: _old, ...rest } = raw as SetlistItem & { tempo?: number };
    void _old;
    return bpm ? { ...rest, tempo: bpm } : rest;
  });
  const pickTime = (t: string) => writeItem(raw => ({ ...raw, time: t }) as SetlistItem);
  const pickCapo = (n: number) => song && onUpdateSettings?.('songCapos', withCapo(settings, song.id, n, shownKey));

  const plays = useMemo(() => (song ? songPlays(song) : []), [song]);
  const boxes = useMemo(() => structureBoxes(plays), [plays]);
  const hasRow = position !== 'off' && boxes.length > 0;
  const rowOnTop = hasRow && position === 'top';
  const rowOnSide = hasRow && (position === 'left' || position === 'right');
  // Room for the floating pill (written out whole so Tailwind sees the classes).
  const sideInset = !rowOnSide ? undefined
    : position === 'left' ? (ribbonStyle === 'dots' ? 'pl-11' : 'pl-16')
      : (ribbonStyle === 'dots' ? 'pr-11' : 'pr-16');


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
    // Measured on screen, so it also works in two columns (where a section in
    // the second column has no meaningful offsetTop). In one column: the last
    // section that starts above the pinned edge. In two: the first one still
    // in view, reading down the first column then the second.
    const edge = el.getBoundingClientRect().top + (hide ? 0 : headH) + rowH + 12;
    let cur = 0;
    if (twoCols) {
      const seen = [...sections.current].filter(([, s]) => s.getBoundingClientRect().bottom > edge).map(([slot]) => slot);
      cur = seen.length ? Math.min(...seen) : 0;
    } else {
      for (const [slot, s] of sections.current) if (s.getBoundingClientRect().top <= edge && slot > cur) cur = slot;
    }
    // At the very bottom the last section is current even if it is short.
    if (y + el.clientHeight >= el.scrollHeight - 2 && sections.current.size) cur = Math.max(...sections.current.keys());
    setActive(cur);
  }, [headH, rowH, twoCols]);

  const jump = useCallback((slot: number) => {
    const el = scroller.current;
    const s = sections.current.get(slot);
    if (!el || !s) return;
    const top = Math.max(0, s.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - rowH);
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
      // Esc first closes whatever is open over the chart (the settings popover, the key sheet).
      if (e.key === 'Escape' && !document.querySelector('[data-slot="popover-content"], [role="dialog"], dialog[open]')) onBack();
    };
    // Capture: runs before the popover's own Esc handler has removed it.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
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
              <SongBody inset={sideInset} plays={plays} songKey={song.key} transpose={transpose - capo} accidentals={accidentals} stickyTop={pinned} columns={twoCols ? 2 : 1} sectionRef={sectionRef} />
            )}
          </div>
          {/* The chrome sits over the scroller: the header part moves up out of
              view, the structure row under it rides up to the top and stays. */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-chrome transition-transform duration-200 ease-out motion-reduce:transition-none"
            style={{ transform: `translateY(${hidden ? -headH : 0}px)` }}
          >
            <div ref={headRef} className="pointer-events-auto bg-background" aria-hidden={hidden || undefined} inert={hidden || undefined}>
              {showSetlistBar && <SetlistBar items={barItems} current={idx} onPick={go} />}
              <ChartHeader
                title={cur.label}
                songKey={shownKey}
                tempo={song?.tempo}
                time={song?.time}
                capo={capo}
                onPills={song?.key ? () => setKeyOpen(true) : undefined}
                onClose={onBack}
                leading={onUpdateSettings ? (
                  <ChartSettings
                    style={storedStyle}
                    position={position}
                    setlistBar={setlistBarOn}
                    mode={mode}
                    columns={wide ? (twoCols ? 2 : 1) : undefined}
                    onSetting={onUpdateSettings}
                    onMode={setPreviewMode}
                  />
                ) : undefined}
              />
            </div>
            {rowOnTop && <div className="pointer-events-auto">{row}</div>}
          </div>
          {rowOnSide && row}
        </div>
      </div>
      {hasRow && position === 'bottom' && row}
      {song?.key && (
        <KeySheet
          open={keyOpen}
          onOpenChange={setKeyOpen}
          songKey={song.key}
          transpose={transpose}
          capo={capo}
          tempo={Number(song.tempo) || undefined}
          time={song.time}
          canSaveForBand={canSave}
          accidentals={accidentals}
          onKey={pickKey}
          onCapo={pickCapo}
          onTempo={pickTempo}
          onTime={pickTime}
        />
      )}
      <ChartFooter
        index={idx}
        total={total}
        // With no structure row, LIVE has nowhere else to show.
        live={live && !hasRow}
        prevTitle={slots[idx - 1]?.label}
        nextTitle={slots[idx + 1]?.label}
        onPrev={() => go(idx - 1)}
        onNext={() => go(idx + 1)}
        onFinish={finish}
      />
    </div>
  );
}
