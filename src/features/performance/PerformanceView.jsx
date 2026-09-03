import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { transposeKey, transposeChord, keysInQualityOf, semitonesBetween, normalizeSectionName } from '@/music';
import { resolveSongView } from '@/arrangements';
import { resolveChartDisplay, resolveColumns } from '@/lib/chartDisplay';
import ChordDiagram from '@/features/chart/ChordDiagram';
import { Card } from '@/ui/Card';
import SectionBlock from '@/features/chart/SectionBlock';
import SongMap from '@/features/chart/SongMap';
import { StructureRibbon } from '@/features/chart/StructureRibbon';
import FloatingStructure from '@/ui/FloatingStructure';
import FloatingNavPill from '@/ui/FloatingNavPill';
import { IconButton } from '@/ui/IconButton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/ui/Select';
import NoteContent from '@/ui/NoteContent';
import PerformanceLayoutSheet from './PerformanceLayoutSheet';
import PerformanceSetlistSheet, { SetlistList } from './PerformanceSetlistSheet';
import NotesStack from '@/ui/NotesStack';
import { OverflowMenu } from '@/ui/OverflowMenu';
import { usePrivateNotes } from '@/hooks/usePrivateNotes';
import { suggestNextSongs } from '@/lib/songSuggestions';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useStageHeaderCollapse } from '@/hooks/useStageHeaderCollapse';
import StageHeader from '@/ui/StageHeader';
import EdgeNavArrows from '@/ui/EdgeNavArrows';
import { useActiveSection } from '@/hooks/useActiveSection';
import { useIsTablet, useIsLandscape, useIsDesktop } from '@/lib/useMediaQuery';

const RAIL_OPEN_KEY = 'setlists-md:perf-rail-open';

export default function PerformanceView({ setlist, songs, onBack, onFinish, defaultFontSize, railEnabled = true, navStyle = 'pill', settings, onUpdateSettings, teamId = null, userId = null, onAppendSong }) {
  useWakeLock(true);
  const isCampfire = !!setlist?._campfire;
  const privateNotes = usePrivateNotes(teamId, userId);
  const [idx, setIdx] = useState(0);
  const [selectedKey, setSelectedKey] = useState(null);
  // Device-global chart display (size, chords, columns…) — same source the
  // Library chart writes to, so customizing a song carries into live mode.
  const disp = resolveChartDisplay(settings, { fallbackLyric: defaultFontSize || 18 });
  const fontSize = disp.lyricFontSize;
  // Live display mode (chords / lyrics / tabs / song map) — inherited from the
  // practice/chart setting so live has no inline picker; changes (via the
  // Customize sheet) write straight back to settings.
  const displayMode = settings?.displayMode || 'chords';
  const [tabInstrument, setTabInstrument] = useState('all');
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [setlistSheetOpen, setSetlistSheetOpen] = useState(false);
  const scrollRef = useRef(null);
  const [headerCollapsed, setHeaderCollapsed, revealHeader] = useStageHeaderCollapse(scrollRef, false);

  // Customize-sheet handlers — write through to settings so a mid-service tweak
  // persists and matches the practice/chart views.
  const changeDisplayMode = (v) => onUpdateSettings?.('displayMode', v);
  const changeFontSize = (v) => onUpdateSettings?.('defaultFontSize', Math.max(10, Math.min(30, v)));
  const changeChordFontSize = (v) => onUpdateSettings?.('chordFontSize', Math.max(8, Math.min(30, v)));
  const changeNotation = (v) => { onUpdateSettings?.('notation', v); onUpdateSettings?.('nashville', v === 'nashville'); };
  const toggleShowChords = () => onUpdateSettings?.('showChords', !disp.showChords);
  const toggleShowDiagrams = () => onUpdateSettings?.('showDiagrams', !disp.showDiagrams);
  const changeColumns = (v) => onUpdateSettings?.('defaultColumns', v);

  // Parallel-browsing rail: on a landscape tablet we offer a persistent
  // setlist rail on the right so the leader can jump songs without leaving the
  // chart. Collapsed by default (max focus on the chart); the choice is
  // remembered per device.
  const isTablet = useIsTablet();
  const isLandscape = useIsLandscape();
  const isDesktop = useIsDesktop();
  // Rail shows on a landscape tablet or any desktop-width window (where there's
  // room beside the chart), when the user hasn't turned it off.
  const showRail = ((isTablet && isLandscape) || isDesktop) && railEnabled;
  // On phones / portrait tablets the rail is replaced by a header button that
  // opens the setlist as a bottom sheet — but only for nav styles that have no
  // counter/pill of their own to open it (edge/swipe). Header + pill open the
  // setlist from their x/x counter instead.
  const showSetlistButton = railEnabled && !showRail && (navStyle === 'edge' || navStyle === 'swipe');
  const [railOpen, setRailOpen] = useState(() => {
    try { return localStorage.getItem(RAIL_OPEN_KEY) === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(RAIL_OPEN_KEY, railOpen ? '1' : '0'); } catch { /* private mode */ }
  }, [railOpen]);

  // Swipe left/right on the chart to advance — a tablet-native complement to
  // the keyboard / pedal nav. A horizontal-dominant gesture past the threshold
  // moves songs; anything more vertical is left to the scroll container.
  const touchRef = useRef(null);

  // Adaptive columns: a wide landscape reading area (incl. when the rail is
  // collapsed) reads better two-up. Explicit 1/2 from settings wins.
  const [chartWidth, setChartWidth] = useState(0);
  const columns = resolveColumns(disp.columns, isTablet && isLandscape && chartWidth >= 700);

  // Session metrics for the finale screen.
  const [sessionStartTime] = useState(() => Date.now());
  const startTimeRef = useRef(sessionStartTime);
  const farthestIdxRef = useRef(0);

  const resolved = useMemo(() =>
    setlist.items
      .map(it => {
        if (it.type === 'break') return { ...it, isBreak: true };
        let raw = songs.find(s => s.id === it.songId);
        // Fall back to a title match when the songId has drifted (e.g. an id
        // re-mint during sync orphaned the setlist's reference) — mirrors
        // SetlistPlayer so a stale id still resolves to the song.
        if (!raw && it.songTitle) raw = songs.find(s => s.title === it.songTitle);
        const song = resolveSongView(raw, it.arrangementId);
        return song ? { ...it, song } : { ...it, isMissing: true };
      }),
    [setlist, songs]
  );

  const cur = resolved[idx] || null;
  const next = resolved[idx + 1] || null;
  // Scroll-sync: highlight the section currently in view in the ribbon.
  const activeSection = useActiveSection(scrollRef, `${cur?.song?.id || ''}:${displayMode}:${columns}`);

  // Union of tab instruments across the set — drives the live filter.
  const tabInstrumentsPresent = useMemo(() => {
    const set = new Set();
    resolved.forEach(r => (r.song?.sections || []).forEach(sec => (sec.lines || []).forEach(l => {
      if (l && typeof l === 'object') {
        if (l.type === 'tab' && l.instrument) set.add(l.instrument);
        if (l.type === 'tabref' && l.tab?.instrument) set.add(l.tab.instrument);
      }
    })));
    return [...set];
  }, [resolved]);

  // Reset key whenever the current item changes
  const [prevItemKey, setPrevItemKey] = useState(null);
  const itemKey = `${idx}\0${cur?.song?.id ?? ''}`;
  if (itemKey !== prevItemKey) {
    setPrevItemKey(itemKey);
    if (cur && !cur.isBreak && !cur.isMissing) {
      setSelectedKey(transposeKey(cur.song.key, cur.transpose || 0));
    }
  }

  const goNext = useCallback(() => {
    setIdx(p => {
      const next = Math.min(resolved.length - 1, p + 1);
      if (next > farthestIdxRef.current) farthestIdxRef.current = next;
      return next;
    });
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [resolved.length]);

  const goPrev = useCallback(() => {
    setIdx(p => Math.max(0, p - 1));
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const goTo = useCallback((i) => {
    setIdx(() => {
      const clamped = Math.max(0, Math.min(resolved.length - 1, i));
      if (clamped > farthestIdxRef.current) farthestIdxRef.current = clamped;
      return clamped;
    });
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [resolved.length]);

  const onTouchStart = useCallback((e) => {
    const t = e.changedTouches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  }, []);
  const onTouchEnd = useCallback((e) => {
    const s = touchRef.current;
    if (!s) return;
    touchRef.current = null;
    // Swipe only navigates when the leader picked it as the nav method.
    if (navStyle !== 'swipe') return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) goNext(); else goPrev();
    }
  }, [goNext, goPrev, navStyle]);

  const handleFinish = useCallback(() => {
    onFinish?.({
      startTime: startTimeRef.current,
      farthestIdx: farthestIdxRef.current,
    });
  }, [onFinish]);

  // Keyboard / Bluetooth pedal navigation
  useEffect(() => {
    const handler = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goPrev(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev]);

  // Track the chart column's width so `columns` can react to the rail
  // opening/closing and to rotation.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w) setChartWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!resolved.length) {
    return (
      <div className="p-10 text-center text-[var(--ds-gray-600)] text-copy-14">
        No items in setlist
      </div>
    );
  }

  if (!cur) return null;

  const displayKey = cur.isBreak || cur.isMissing ? null : (selectedKey || transposeKey(cur.song.key, cur.transpose || 0));

  // Optional in-header prev/next cluster — an alternative to the floating nav
  // pill. Rendered at the far LEFT of the header (well away from the collapse /
  // close controls on the right) with comfortable tap targets. The last step
  // turns into Finish so the leader can close out the set without the pill.
  const atEnd = idx >= resolved.length - 1;
  // Opens the setlist from the nav counter/pill: toggles the rail when it's
  // available, otherwise opens the bottom sheet. Undefined when there's no
  // setlist to show.
  const openSetlist = railEnabled ? (showRail ? () => setRailOpen(o => !o) : () => setSetlistSheetOpen(true)) : undefined;
  const navButtons = navStyle === 'header' ? (
    <div className="flex items-center gap-1 shrink-0 pr-2 mr-1 border-r border-[var(--ds-gray-300)]">
      <IconButton size="md" variant="ghost" onClick={goPrev} disabled={idx === 0} aria-label="Previous song">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      </IconButton>
      {openSetlist ? (
        <button
          type="button"
          onClick={openSetlist}
          aria-label="Open setlist"
          className="text-label-13 text-[var(--ds-gray-700)] hover:text-[var(--ds-gray-1000)] tabular-nums px-1 min-w-[2.5rem] text-center bg-transparent border-none cursor-pointer transition-colors"
        >
          {idx + 1}/{resolved.length}
        </button>
      ) : (
        <span className="text-label-13 text-[var(--ds-gray-700)] tabular-nums px-1 select-none min-w-[2.5rem] text-center">{idx + 1}/{resolved.length}</span>
      )}
      {atEnd && onFinish ? (
        <IconButton size="md" variant="ghost" onClick={handleFinish} aria-label="Finish set">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        </IconButton>
      ) : (
        <IconButton size="md" variant="ghost" onClick={goNext} disabled={atEnd} aria-label="Next song">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </IconButton>
      )}
    </div>
  ) : null;

  // Secondary actions collapse into a single overflow menu so the header stays
  // uncluttered — leaving the show/hide-header toggle, the menu, and the close X.
  const headerControls = (
    <div className="flex items-center gap-1 shrink-0">
      <OverflowMenu
        ariaLabel="View options"
        items={[
          {
            label: 'Display & layout',
            icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>),
            onClick: () => setLayoutOpen(true),
          },
          showSetlistButton && {
            label: 'Open setlist',
            icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>),
            onClick: () => setSetlistSheetOpen(true),
          },
        ]}
      />
      {/* Show/hide header stays a visible toggle (not buried in the menu). */}
      <IconButton
        size="sm"
        variant="ghost"
        onClick={() => setHeaderCollapsed(c => !c)}
        aria-label={headerCollapsed ? 'Show header' : 'Hide header'}
        title={headerCollapsed ? 'Show header' : 'Hide header'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d={headerCollapsed ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'} />
        </svg>
      </IconButton>
    </div>
  );

  // Structure ribbon placement (Settings → Structure position). Side docks slot
  // into the existing flex row; bottom is a sticky band; top stays in the header.
  const structurePos = settings?.structurePosition || 'top';
  const ribbonSide = structurePos === 'left' || structurePos === 'right';
  const ribbonNode = (!cur.isBreak && !cur.isMissing && cur.song.sections?.length > 0) ? (
    <StructureRibbon
      structure={cur.song.structure || cur.song.sections.map(s => s.type)}
      compact
      orientation={ribbonSide ? 'vertical' : 'horizontal'}
      collapse={!ribbonSide}
      activeIndex={activeSection}
      style={settings?.ribbonStyle || 'chips'}
      onSelect={(i) => {
        const struct = cur.song.structure || cur.song.sections.map(s => s.type);
        const name = struct[i];
        const sectionIdx = cur.song.sections.findIndex(s => s.type === name);
        if (sectionIdx !== -1) {
          const el = document.getElementById(`perf-section-${sectionIdx}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }}
    />
  ) : null;

  return (
    <div
      className="h-full flex overflow-hidden"
      style={{ background: 'var(--chart-bg, var(--ds-background-100))' }}
    >
    {structurePos !== 'top' && ribbonNode && (
      <FloatingStructure position={structurePos} raised={navStyle === 'pill'}>{ribbonNode}</FloatingStructure>
    )}
    <div
      ref={scrollRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClick={revealHeader}
      className="flex-1 min-w-0 h-full overflow-y-auto overflow-x-hidden relative"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        color: 'var(--chart-text, var(--ds-gray-1000))',
        fontFamily: 'var(--chart-font-lyric, var(--font-sans))',
      }}
    >
      {/* ── Three-row stage header (collapses to just the ribbon) ── */}
      <StageHeader
        collapsed={headerCollapsed}
        onExpand={() => setHeaderCollapsed(false)}
        close={(
          <IconButton variant="ghost" size="sm" onClick={onBack} aria-label="Close live view">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </IconButton>
        )}
        title={(
          <>
            {navButtons}
            <h1 className="text-heading-15 text-[var(--ds-gray-1000)] m-0 flex-1 min-w-0 truncate">
              {cur.isBreak ? (cur.label || 'Break') : cur.isMissing ? 'Missing Song' : cur.song.title}
            </h1>
          </>
        )}
        meta={!cur.isBreak && !cur.isMissing && displayKey ? (
          <>
            <Select value={displayKey} onValueChange={setSelectedKey}>
              <SelectTrigger className="h-7 px-2 border-none bg-transparent hover:bg-[var(--ds-gray-200)] rounded-lg text-label-14 font-bold text-[var(--ds-gray-1000)] gap-1 min-w-0 w-auto focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {keysInQualityOf(cur.song.key).map(k => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cur.capo > 0 && (
              <span className="text-label-12 font-bold text-[var(--color-brand)] whitespace-nowrap bg-[var(--color-brand-soft)] px-1.5 py-0.5 rounded border border-[var(--color-brand-border)]">
                Capo {cur.capo}
              </span>
            )}
            {cur.song.tempo && (
              <span className="text-label-12 text-[var(--ds-gray-700)] whitespace-nowrap">♩ {cur.song.tempo}</span>
            )}
            {cur.song.time && (
              <span className="text-label-12 text-[var(--ds-gray-700)] whitespace-nowrap">{cur.song.time}</span>
            )}
          </>
        ) : null}
        actions={headerControls}
        ribbon={structurePos === 'top' ? ribbonNode : null}
      />

      {/* ── Content ── */}
      <div className={`wide-container pt-4 ${structurePos === 'bottom' ? 'pb-[14rem]' : 'pb-32'}`}>
        {cur.isBreak ? (
          <div className="flex flex-col items-center justify-center py-20 min-h-[50vh]">
            <div className="text-heading-32 text-[var(--ds-gray-1000)] mb-2">{cur.label || 'Break'}</div>
            {cur.duration > 0 && (
              <div className="text-copy-16 text-[var(--ds-gray-600)] font-mono">{cur.duration} min</div>
            )}
            {cur.note && (
              <NoteContent
                text={cur.note}
                className="w-full max-w-xl mt-4 px-5 py-4 rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-gray-alpha-100)] text-copy-16 text-[var(--ds-gray-900)]"
              />
            )}
          </div>
        ) : cur.isMissing ? (
          <div className="flex flex-col items-center justify-center py-20 min-h-[50vh]">
            <div className="text-heading-32 text-[var(--ds-gray-1000)] mb-2 text-center">Missing Song</div>
            <div className="text-copy-16 text-[var(--ds-gray-600)] text-center">Waiting for sync</div>
          </div>
        ) : displayKey ? (
          <>
            {/* Per-song setlist note (view-only in Live) — Team (canonical
                `note`, legacy `notes` fallback) + My note (private). */}
            {(() => {
              const team = cur.note ?? cur.notes ?? '';
              const mine = privateNotes.enabled ? privateNotes.getNote({ setlistId: setlist.id, songId: cur.song.id }) : '';
              if (!team && !mine) return null;
              return (
                <div className="mb-3">
                  <NotesStack
                    pillLabel="Setlist note"
                    entries={[
                      { key: 'team', label: privateNotes.enabled ? 'Team' : undefined, value: team },
                      ...(privateNotes.enabled ? [{ key: 'mine', label: 'Mine', value: mine }] : []),
                    ]}
                  />
                </div>
              );
            })()}
            <SongChart
              song={cur.song}
              selectedKey={displayKey}
              capo={cur.capo || 0}
              fontSize={fontSize}
              columns={columns}
              chordFontSize={disp.chordFontSize}
              notation={disp.notation}
              accidentals={settings?.accidentals}
              showChords={disp.showChords}
              showDiagrams={disp.showDiagrams}
              displayMode={displayMode}
              tabInstrument={tabInstrument}
                            sectionColors={settings?.sectionColors}
              sectionLabels={settings?.sectionLabels}
              customSectionTypes={settings?.customSectionTypes}
              privateNotes={privateNotes}
            />
            {/* Campfire "Up next" — key/tag/tempo suggestions to keep playing
                without a setlist; tapping one appends it to the ad-hoc queue. */}
            {isCampfire && idx >= resolved.length - 1 && (() => {
              const suggestions = suggestNextSongs(cur.song, songs, {
                excludeIds: resolved.map((r) => r.songId).filter(Boolean),
              });
              if (!suggestions.length) return null;
              return (
                <div className="mt-8 pt-6 border-t border-[var(--ds-gray-300)]">
                  <div className="text-label-11 uppercase tracking-wider font-semibold text-[var(--ds-gray-600)] mb-3">Up next</div>
                  <div className="flex flex-col gap-2 max-w-xl">
                    {suggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          const target = resolved.length;
                          onAppendSong?.(s.id);
                          setIdx(target);
                          scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-gray-alpha-100)] hover:bg-[var(--ds-gray-200)] text-left transition-colors"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-[var(--color-brand)]"><path d="M8 5v14l11-7z" /></svg>
                        <span className="flex-1 min-w-0">
                          <span className="block truncate text-copy-15 font-semibold text-[var(--ds-gray-1000)]">{s.title}</span>
                          <span className="block text-label-12 text-[var(--ds-gray-600)]">{[s.key, s.tempo ? `${s.tempo} bpm` : null].filter(Boolean).join(' · ')}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
          </>
        ) : null}
      </div>

      {/* ── Floating nav pill (only when the leader chose the pill) ── */}
      {navStyle === 'pill' && (
        <FloatingNavPill
          current={idx + 1}
          total={resolved.length}
          nextLabel={next?.isBreak ? (next.label || 'Break') : next?.song?.title}
          onPrev={goPrev}
          onNext={goNext}
          hasPrev={idx > 0}
          hasNext={idx < resolved.length - 1}
          onFinish={onFinish ? handleFinish : undefined}
          onOpenSetlist={openSetlist}
        />
      )}
      {navStyle === 'edge' && (
        <EdgeNavArrows
          onPrev={goPrev}
          onNext={goNext}
          hasPrev={idx > 0}
          hasNext={idx < resolved.length - 1}
          onFinish={onFinish ? handleFinish : undefined}
          nextLabel={next?.isBreak ? (next.label || 'Break') : next?.song?.title}
          prevLabel={idx > 0 ? (resolved[idx - 1]?.isBreak ? (resolved[idx - 1].label || 'Break') : resolved[idx - 1]?.song?.title) : undefined}
        />
      )}
    </div>

    {/* ── Parallel-browsing setlist rail (tablet landscape) ── */}
    {showRail && (
      <aside
        className="shrink-0 h-full border-l border-[var(--ds-gray-300)] flex flex-col"
        style={{ width: railOpen ? 288 : 44, background: 'color-mix(in srgb, var(--ds-background-100) 55%, transparent)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', transition: 'width 200ms ease' }}
      >
        {railOpen ? (
          <>
            <div className="flex items-center gap-2 px-3 py-3 border-b border-[var(--ds-gray-300)]">
              <span className="flex-1 min-w-0 truncate text-label-11 uppercase tracking-wider font-semibold text-[var(--ds-gray-600)]">
                {setlist.name || 'Setlist'}
              </span>
              <IconButton variant="ghost" size="sm" onClick={() => setRailOpen(false)} aria-label="Collapse setlist">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 17l5-5-5-5M6 17l5-5-5-5" />
                </svg>
              </IconButton>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2">
              <SetlistList resolved={resolved} idx={idx} onSelect={goTo} />
            </div>
          </>
        ) : (
          <button
            onClick={() => setRailOpen(true)}
            aria-label="Open setlist"
            className="w-full flex-1 flex items-start justify-center pt-4 text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-1000)] transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
            </svg>
          </button>
        )}
      </aside>
    )}

    <PerformanceLayoutSheet
      open={layoutOpen}
      onClose={() => setLayoutOpen(false)}
      variant="live"
      displayMode={displayMode}
      onChangeDisplayMode={changeDisplayMode}
      tabInstrumentsPresent={tabInstrumentsPresent}
      tabInstrument={tabInstrument}
      onChangeTabInstrument={setTabInstrument}
      notation={disp.notation}
      onChangeNotation={changeNotation}
      showChords={disp.showChords}
      onToggleShowChords={toggleShowChords}
      showDiagrams={disp.showDiagrams}
      onToggleShowDiagrams={toggleShowDiagrams}
      columns={columns}
      onChangeColumns={changeColumns}
      fontSize={fontSize}
      onChangeFontSize={changeFontSize}
      chordFontSize={disp.chordFontSize}
      onChangeChordFontSize={changeChordFontSize}
    />

    <PerformanceSetlistSheet
      open={setlistSheetOpen}
      onClose={() => setSetlistSheetOpen(false)}
      title={setlist.name}
      resolved={resolved}
      idx={idx}
      onSelect={goTo}
    />
    </div>
  );
}

function SongChart({ song, selectedKey, capo, fontSize, columns, chordFontSize, notation = 'letters', accidentals = 'auto', showChords = true, showDiagrams = false, displayMode = 'chords', tabInstrument = 'all', sectionColors, sectionLabels, customSectionTypes, privateNotes }) {
  const transpose = semitonesBetween(song.key, selectedKey) - (capo || 0);
  const myNotesEnabled = !!privateNotes?.enabled;
  const viewChords = displayMode === 'chords' || displayMode === 'chordsonly';
  const viewLyrics = displayMode === 'chords' || displayMode === 'lyrics';
  const viewTabs = displayMode === 'chords' || displayMode === 'tabs';

  const allChords = useMemo(() => Array.from(new Set(
    song.sections.flatMap(s => s.lines)
      .filter(l => typeof l === 'string')
      .flatMap(l => { const m = l.match(/\[(.*?)\]/g); return m ? m.map(x => x.slice(1, -1)) : []; })
  )), [song.sections]);

  // Playback order honours an explicit `structure` (Proclaim-style)
  // only when the body's section names are unique and the structure
  // list resolves cleanly. Otherwise we fall back to document order so
  // a song with two `## Verse` blocks (legacy data) doesn't silently
  // collapse to one.
  const orderedSections = useMemo(() => {
    const types = song.sections.map(s => normalizeSectionName(s.type));
    const uniqueTypes = new Set(types).size === types.length;
    if (
      !uniqueTypes ||
      !Array.isArray(song.structure) ||
      song.structure.length === 0
    ) {
      return song.sections;
    }
    const resolved = song.structure
      .map(name => song.sections.find(s => normalizeSectionName(s.type) === normalizeSectionName(name)))
      .filter(Boolean);
    if (resolved.length !== song.structure.length) return song.sections;
    return resolved;
  }, [song.structure, song.sections]);

  const sectionModOffsets = useMemo(() => {
    const acc = { total: 0 };
    return orderedSections.map(section => {
      const offset = acc.total;
      (section.lines || []).forEach(line => {
        if (typeof line === 'object' && line.type === 'modulate') {
          acc.total += line.semitones;
        }
      });
      return offset;
    });
  }, [orderedSections]);

  if (displayMode === 'songmap') {
    return (
      <SongMap
        sections={orderedSections}
        modOffsets={sectionModOffsets}
        transpose={transpose}
        sectionColors={sectionColors}
        sectionLabels={sectionLabels}
        customSectionTypes={customSectionTypes}
        onSelect={(i) => {
          const el = document.getElementById(`perf-section-${i}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      />
    );
  }

  return (
    <div
      style={{
        fontSize,
        columnCount: columns,
        columnGap: '3rem',
        fontFamily: "var(--font-mono)",
        ['--chart-font-size-lyric']: `${fontSize}px`,
        ...(chordFontSize ? { ['--chart-font-size-chord']: `${chordFontSize}px` } : {}),
      }}
    >
      {showDiagrams && viewChords && allChords.length > 0 && (
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-6 mb-6 border-b border-[var(--ds-gray-300)]" style={{ columnSpan: 'all', WebkitColumnSpan: 'all' }}>
          {allChords.map(chord => (
            <div key={chord} className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="text-label-10-mono font-bold text-[var(--ds-gray-600)]">{transposeChord(chord, transpose)}</div>
              <Card className="w-24 h-28 flex items-center justify-center p-2">
                <ChordDiagram chord={transposeChord(chord, transpose)} />
              </Card>
            </div>
          ))}
        </div>
      )}
      {(song.notes || (myNotesEnabled && privateNotes.getNote({ songId: song.id }))) && (
        <div className="mb-3" style={{ columnSpan: 'all', WebkitColumnSpan: 'all' }}>
          <NotesStack
            pillLabel="Song notes"
            entries={[
              { key: 'team', label: myNotesEnabled ? 'Team' : undefined, value: song.notes || '' },
              ...(myNotesEnabled ? [{ key: 'mine', label: 'Mine', value: privateNotes.getNote({ songId: song.id }) }] : []),
            ]}
          />
        </div>
      )}
      {orderedSections.map((section, i) => (
        <div
          key={`${section.id || section.type}-${i}`}
          id={`perf-section-${i}`}
          data-section-index={i}
          style={{ breakInside: 'avoid', scrollMarginTop: '7rem' }}
        >
          <SectionBlock
            section={section}
            transpose={transpose}
            modOffset={sectionModOffsets[i]}
            notation={notation}
            songKey={song.key}
            accidentals={accidentals}
            showChords={showChords && viewChords}
            showLyrics={viewLyrics}
            showTabs={viewTabs}
            tabInstrument={tabInstrument}
            inlineNotes
            noteStyle="dashes"
          />
        </div>
      ))}
    </div>
  );
}
