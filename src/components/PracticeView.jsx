import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { transposeKey, transposeChord, keysInQualityOf, semitonesBetween } from '../music';
import { resolveSongView } from '../arrangements';
import SectionBlock from './SectionBlock';
import SongMap from './SongMap';
import { TAB_INSTRUMENTS } from './editor/tabInstruments';
import ChordDiagram from './ChordDiagram';
import { StructureRibbon } from './StructureRibbon';
import FloatingStructure from './ui/FloatingStructure';
import FloatingNavPill from './ui/FloatingNavPill';
import { IconButton } from './ui/IconButton';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import PerformanceLayoutSheet from './PerformanceLayoutSheet';
import PerformanceSetlistSheet, { SetlistList } from './PerformanceSetlistSheet';
import NotesStack from './ui/NotesStack';
import { OverflowMenu } from './ui/OverflowMenu';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/Select';
import NoteContent from './ui/NoteContent';
import StageHeader from './ui/StageHeader';
import EdgeNavArrows from './ui/EdgeNavArrows';
import { useIsTablet, useIsLandscape, useIsDesktop } from '../lib/useMediaQuery';
import { STAGE_MODE_MAP } from '../data/stageModes';
import { resolveChartDisplay, resolveColumns } from '../lib/chartDisplay';
import { useStageHeaderCollapse } from '../hooks/useStageHeaderCollapse';
import { useActiveSection } from '../hooks/useActiveSection';
import { usePrivateNotes } from '../notes/usePrivateNotes';

const RAIL_OPEN_KEY = 'setlists-md:perf-rail-open';

export default function PracticeView({ setlist, songs, onBack, onFinish, onUpdateSong, onUpdateSetlist, defaultFontSize, railEnabled = true, navStyle = 'pill', settings, onUpdateSettings, onOpenAdvancedStyle, startIndex = 0, teamId = null, userId = null, canEditShared = true }) {
  const privateNotes = usePrivateNotes(teamId, userId);
  const [layoutOpen, setLayoutOpen] = useState(false);
  // Start at the requested item (e.g. tapping a song in the overview) clamped
  // into range; defaults to the top of the set.
  const [idx, setIdx] = useState(() => {
    const n = setlist.items?.length || 0;
    return Number.isInteger(startIndex) && startIndex >= 0 && startIndex < n ? startIndex : 0;
  });
  const [selectedKey, setSelectedKey] = useState(null);
  // Device-global chart display, shared with the Library chart & live view.
  // Local mirrors keep the Layout controls snappy; every change writes straight
  // back through onUpdateSettings so a tweak here shows up on every song and in
  // the chart / live views too. They re-seed when the persisted settings change.
  const disp = resolveChartDisplay(settings, { fallbackLyric: defaultFontSize || 18 });
  const stageMode = settings?.stageMode || 'leader';
  const [fontSize, setFontSize] = useState(disp.lyricFontSize);
  const [chordFontSize, setChordFontSize] = useState(disp.chordFontSize);
  const [notation, setNotation] = useState(disp.notation);
  const [showChords, setShowChords] = useState(disp.showChords);
  const [showDiagrams, setShowDiagrams] = useState(disp.showDiagrams);
  // What to show in the chart body: chords / lyrics-only / tabs / song map.
  // Persisted device-wide so the choice carries into the live view (which no
  // longer has its own picker) and the library chart.
  const [displayMode, setDisplayMode] = useState(settings?.displayMode || 'chords');
  // Per-session tab-instrument filter (e.g. acoustic player sees acoustic tabs).
  const [tabInstrument, setTabInstrument] = useState('all');
  useEffect(() => {
    setFontSize(disp.lyricFontSize);
    setChordFontSize(disp.chordFontSize);
    setNotation(disp.notation);
    setShowChords(disp.showChords);
    setShowDiagrams(disp.showDiagrams);
    setDisplayMode(settings?.displayMode || 'chords');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.defaultFontSize, settings?.chordFontSize, settings?.nashville, settings?.notation, settings?.showChords, settings?.showDiagrams, settings?.stageMode, settings?.displayMode]);

  // Persisting helpers — update the snappy local mirror and the device setting.
  const changeFontSize = (v) => { const n = Math.max(10, Math.min(30, v)); setFontSize(n); onUpdateSettings?.('defaultFontSize', n); };
  const changeChordFontSize = (v) => { const n = Math.max(8, Math.min(30, v)); setChordFontSize(n); onUpdateSettings?.('chordFontSize', n); };
  const changeNotation = (v) => { setNotation(v); onUpdateSettings?.('notation', v); onUpdateSettings?.('nashville', v === 'nashville'); };
  const toggleShowChords = () => { const v = !showChords; setShowChords(v); onUpdateSettings?.('showChords', v); };
  const toggleShowDiagrams = () => { const v = !showDiagrams; setShowDiagrams(v); onUpdateSettings?.('showDiagrams', v); };
  const changeDisplayMode = (v) => { setDisplayMode(v); onUpdateSettings?.('displayMode', v); };

  // Picking a role applies its preset by writing every value through to
  // settings, so the role choice persists across songs and views too.
  const applyRole = (id) => {
    const preset = STAGE_MODE_MAP[id]?.settings || {};
    onUpdateSettings?.('stageMode', id);
    if (preset.lyricFontSize != null) onUpdateSettings?.('defaultFontSize', preset.lyricFontSize);
    if (preset.chordFontSize != null) onUpdateSettings?.('chordFontSize', preset.chordFontSize);
    onUpdateSettings?.('nashville', !!preset.nashville);
    onUpdateSettings?.('notation', preset.notation || (preset.nashville ? 'nashville' : 'letters'));
    onUpdateSettings?.('showChords', preset.showChords !== false);
    onUpdateSettings?.('showDiagrams', !!preset.showDiagrams);
  };
  const [showStructureEditor, setShowStructureEditor] = useState(false);
  const [setlistSheetOpen, setSetlistSheetOpen] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);
  const scrollRef = useRef(null);
  const [headerCollapsed, setHeaderCollapsed, revealHeader] = useStageHeaderCollapse(scrollRef, settings?.autoHideHeader === true);

  // Parallel-browsing setlist rail — same affordance as the live Performance
  // view, so the leader can jump songs mid-practice without leaving the chart.
  // Collapsed by default; the choice is shared with Performance per device.
  const isTablet = useIsTablet();
  const isLandscape = useIsLandscape();
  const isDesktop = useIsDesktop();
  const showRail = ((isTablet && isLandscape) || isDesktop) && railEnabled;
  // Where the rail can't fit (phone / portrait tablet) the setlist is reachable
  // from a header button that opens it as a bottom sheet instead.
  const showSetlistButton = railEnabled && !showRail && (navStyle === 'edge' || navStyle === 'swipe');
  // Explicit 1/2 from settings wins; 'auto'/unset goes two-up when the reading
  // area is comfortably wide. A manual pick in the Layout sheet overrides for
  // the session and persists the choice device-wide.
  const wantTwo = chartWidth >= 700;
  const userSetColumnsRef = useRef(false);
  const [columns, setColumns] = useState(resolveColumns(disp.columns, wantTwo));
  const setColumnsManually = (v) => {
    userSetColumnsRef.current = true;
    setColumns(v);
    onUpdateSettings?.('defaultColumns', v);
  };
  useEffect(() => {
    if (!userSetColumnsRef.current) setColumns(resolveColumns(disp.columns, wantTwo));
  }, [disp.columns, wantTwo]);

  // Swipe left/right to advance — matches the live Performance view.
  const touchRef = useRef(null);
  const [railOpen, setRailOpen] = useState(() => {
    try { return localStorage.getItem(RAIL_OPEN_KEY) === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(RAIL_OPEN_KEY, railOpen ? '1' : '0'); } catch { /* private mode */ }
  }, [railOpen]);

  // Session metrics for the finale screen.
  const [sessionStartTime] = useState(() => Date.now());
  const startTimeRef = useRef(sessionStartTime);
  const transposeCountRef = useRef(0);
  const cueCountRef = useRef(0);
  const farthestIdxRef = useRef(0);
  const touchedSongIdsRef = useRef(new Set());

  const resolved = useMemo(() =>
    setlist.items
      .map((it, rawIdx) => {
        if (it.type === 'break') return { ...it, isBreak: true, _rawIdx: rawIdx };
        let raw = songs.find(s => s.id === it.songId);
        if (!raw && it.songTitle) raw = songs.find(s => s.title === it.songTitle);
        if (!raw) return { ...it, isMissing: true, _rawIdx: rawIdx };
        const song = resolveSongView(raw, it.arrangementId);
        return song ? { ...it, song, _rawIdx: rawIdx } : { ...it, isMissing: true, _rawIdx: rawIdx };
      }),
    [setlist, songs]
  );

  const cur = resolved[idx] || null;
  const next = resolved[idx + 1] || null;
  // Scroll-sync: highlight the section currently in view in the ribbon.
  const activeSection = useActiveSection(scrollRef, `${cur?.song?.id || ''}:${displayMode}:${columns}`);

  // Union of tab instruments across the whole set — drives the filter chip.
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
  useEffect(() => {
    if (cur && !cur.isBreak) {
      setSelectedKey(transposeKey(cur.song.key, cur.transpose || 0));
    }
  }, [idx, cur?.song?.id]);

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
      transposeCount: transposeCountRef.current,
      cueCount: cueCountRef.current,
      touchedSongIds: Array.from(touchedSongIdsRef.current),
    });
  }, [onFinish]);

  // Keyboard navigation (ignore when editing text)
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

  // Measure the reading width so 'auto' columns can reflow two-up when wide.
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

  // Save key change → persists to setlist item transpose
  const handleKeyChange = useCallback((newKey) => {
    setSelectedKey(newKey);
    if (!cur || cur.isBreak) return;
    const semitones = semitonesBetween(cur.song.key, newKey);
    if (semitones !== (cur.transpose || 0)) {
      transposeCountRef.current += 1;
      touchedSongIdsRef.current.add(cur.song.id);
    }
    onUpdateSetlist?.({
      ...setlist,
      items: setlist.items.map((it, i) =>
        i === cur._rawIdx ? { ...it, transpose: semitones } : it
      ),
    });
  }, [cur, setlist, onUpdateSetlist]);

  // Save band cue (section.note) → persists to song
  const handleSaveCue = useCallback((sectionIdx, newNote) => {
    if (!cur || cur.isBreak) return;
    cueCountRef.current += 1;
    touchedSongIdsRef.current.add(cur.song.id);
    onUpdateSong?.({
      ...cur.song,
      sections: cur.song.sections.map((sec, i) =>
        i === sectionIdx ? { ...sec, note: newNote } : sec
      ),
    });
  }, [cur, onUpdateSong]);

  // Save setlist note → persists to setlist item. Canonical field is `note`;
  // older builds wrote `notes` here (which the builder/overview/Live never
  // read), so we write `note` and strip any legacy `notes`.
  const handleSaveNote = useCallback((newNote) => {
    if (!cur || cur.isBreak) return;
    touchedSongIdsRef.current.add(cur.song.id);
    onUpdateSetlist?.({
      ...setlist,
      items: setlist.items.map((it, i) => {
        if (i !== cur._rawIdx) return it;
        const { notes: _legacy, ...rest } = it;
        return { ...rest, note: newNote };
      }),
    });
  }, [cur, setlist, onUpdateSetlist]);

  // Save structure update → persists to song
  const handleUpdateStructure = useCallback((newStructure) => {
    if (!cur || cur.isBreak) return;
    onUpdateSong?.({
      ...cur.song,
      structure: newStructure,
    });
  }, [cur, onUpdateSong]);

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
  // pill. Rendered at the far LEFT of the header (clear of the collapse / menu /
  // close controls on the right) with comfortable tap targets. The last step
  // turns into Finish.
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

  // Chevron + dot menu + close X — anchored to the right end of the title
  // row in both expanded and collapsed states. Same variant and size so
  // they render with matching color and weight.
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
          (!cur.isBreak && !cur.isMissing) && {
            label: 'Edit structure',
            icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>),
            onClick: () => setShowStructureEditor(true),
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

  // Structure ribbon placement (Settings → Structure position).
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
          const el = document.getElementById(`practice-section-${sectionIdx}`);
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
      className="flex-1 min-w-0 h-full overflow-y-auto overflow-x-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        color: 'var(--chart-text, var(--ds-gray-1000))',
        fontFamily: 'var(--chart-font-lyric, var(--font-sans))',
      }}
    >
      {/* ── Minimal sticky header ──
          The title row always renders so the chevron + X stay anchored to
          the same spot regardless of collapse state. When collapsed, the
          structure ribbon takes the title's slot so the row stays useful
          (you can still jump between sections), and the title + meta +
          badge tuck away. The dedicated ribbon row below only renders
          when the header is expanded. */}
      <StageHeader
        collapsed={headerCollapsed}
        onExpand={() => setHeaderCollapsed(false)}
        close={(
          <IconButton variant="ghost" size="sm" onClick={onBack} aria-label="Close practice">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </IconButton>
        )}
        title={(
          <>
            {navButtons}
            <h1 className="text-heading-15 text-[var(--ds-gray-1000)] m-0 flex-1 min-w-0 truncate">
              {cur.isBreak ? (cur.label || 'Break') : cur.song.title}
            </h1>
            <span
              className="hidden sm:inline-flex shrink-0 items-center px-2 py-0.5 rounded-md text-label-10 font-black uppercase tracking-widest"
              style={{ background: 'var(--color-brand)', color: 'white' }}
            >
              Practice
            </span>
          </>
        )}
        meta={!cur.isBreak && !cur.isMissing && displayKey ? (
          <>
            <Select value={displayKey} onValueChange={handleKeyChange}>
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
                className="w-full max-w-xl mt-4 px-5 py-4 rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-gray-alpha-100)] text-copy-15 text-[var(--ds-gray-900)]"
              />
            )}
          </div>
        ) : cur.isMissing ? (
          <div className="flex flex-col items-center justify-center py-20 min-h-[50vh]">
            <div className="text-heading-32 text-[var(--ds-gray-1000)] mb-2 text-center">Missing Song</div>
            <div className="text-copy-16 text-[var(--ds-gray-600)] text-center">Waiting for sync</div>
          </div>
        ) : displayKey ? (
          <PracticeChart
            song={cur.song}
            selectedKey={displayKey}
            capo={cur.capo || 0}
            fontSize={fontSize}
            columns={columns}
            chordFontSize={chordFontSize}
            notation={notation}
            accidentals={settings?.accidentals}
            showChords={showChords}
            showDiagrams={showDiagrams}
            displayMode={displayMode}
            tabInstrument={tabInstrument}
            chordEmphasis={settings?.stageMode === 'bassist' ? 'root' : 'full'}
            sectionColors={settings?.sectionColors}
            sectionLabels={settings?.sectionLabels}
            customSectionTypes={settings?.customSectionTypes}
            onSaveCue={handleSaveCue}
            canEditShared={canEditShared}
            privateNotes={privateNotes}
          />
        ) : null}

        {/* Setlist note for this song — Team (shared, canonical `note`) + My
            note (private). Shared editing is gated to those who can write the
            library; My note is always editable by its owner. */}
        {!cur.isBreak && !cur.isMissing && (
          <div className="mt-6">
            <NotesStack
              pillLabel="Setlist note"
              entries={[
                {
                  key: 'team',
                  label: privateNotes.enabled ? 'Team' : undefined,
                  value: cur.note ?? cur.notes ?? '',
                  editable: canEditShared,
                  onSave: handleSaveNote,
                  placeholder: 'Setlist note for this song…',
                  addLabel: 'Add setlist note for this song',
                },
                ...(privateNotes.enabled ? [{
                  key: 'mine',
                  label: 'Mine',
                  value: privateNotes.getNote({ setlistId: setlist.id, songId: cur.song.id }),
                  editable: true,
                  onSave: (t) => privateNotes.setNote({ setlistId: setlist.id, songId: cur.song.id }, t),
                  placeholder: 'Private note (only you)…',
                  addLabel: 'Add a private note',
                }] : []),
              ]}
            />
          </div>
        )}
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

    {showStructureEditor && (
      <StructureEditor
        structure={cur.song.structure || cur.song.sections.map(s => s.type)}
        availableSections={[...new Set(cur.song.sections.map(s => s.type))]}
        onUpdate={(newStruct) => {
          handleUpdateStructure(newStruct);
          setShowStructureEditor(false);
        }}
        onClose={() => setShowStructureEditor(false)}
      />
    )}

    <PerformanceLayoutSheet
      open={layoutOpen}
      onClose={() => setLayoutOpen(false)}
      variant="practice"
      stageMode={stageMode}
      onApplyRole={applyRole}
      displayMode={displayMode}
      onChangeDisplayMode={changeDisplayMode}
      tabInstrumentsPresent={tabInstrumentsPresent}
      tabInstrument={tabInstrument}
      onChangeTabInstrument={setTabInstrument}
      notation={notation}
      onChangeNotation={changeNotation}
      showChords={showChords}
      onToggleShowChords={toggleShowChords}
      showDiagrams={showDiagrams}
      onToggleShowDiagrams={toggleShowDiagrams}
      columns={columns}
      onChangeColumns={setColumnsManually}
      fontSize={fontSize}
      onChangeFontSize={changeFontSize}
      chordFontSize={chordFontSize}
      onChangeChordFontSize={changeChordFontSize}
      settings={settings}
      onUpdateSettings={onUpdateSettings}
      onOpenAdvancedStyle={onOpenAdvancedStyle}
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

// Modal for editing the song's structure flow
function StructureEditor({ structure, availableSections, onUpdate, onClose }) {
  const [draft, setDraft] = useState([...structure]);

  const move = (idx, dir) => {
    const next = [...draft];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setDraft(next);
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--ds-background-200)] border border-[var(--ds-gray-400)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-[var(--ds-gray-300)] flex items-center justify-between bg-[var(--ds-background-100)]">
          <h2 className="text-heading-18 m-0 text-[var(--ds-gray-1000)]">Edit Song Flow</h2>
          <IconButton variant="ghost" size="sm" onClick={onClose} aria-label="Close">✕</IconButton>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-8">
          {/* Current Structure */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="text-label-12 text-[var(--ds-gray-600)] uppercase tracking-wider font-bold">
                Current Flow
              </label>
              <button 
                onClick={() => setDraft([])}
                className="text-label-11 font-bold text-[var(--ds-red-900)] hover:underline"
              >
                Clear All
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {draft.map((name, i) => (
                <div 
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] group"
                >
                  <span className="w-5 text-label-11-mono text-[var(--ds-gray-400)] font-bold">{i + 1}</span>
                  <span className="flex-1 text-label-14 font-bold text-[var(--ds-gray-900)]">{name}</span>
                  
                  <div className="flex items-center gap-1">
                    <IconButton 
                      size="xs" 
                      variant="ghost" 
                      onClick={() => move(i, -1)} 
                      disabled={i === 0}
                      className="h-7 w-7"
                    >↑</IconButton>
                    <IconButton 
                      size="xs" 
                      variant="ghost" 
                      onClick={() => move(i, 1)} 
                      disabled={i === draft.length - 1}
                      className="h-7 w-7"
                    >↓</IconButton>
                    <IconButton 
                      size="xs" 
                      variant="ghost" 
                      onClick={() => setDraft(p => p.filter((_, idx) => idx !== i))}
                      className="h-7 w-7 text-[var(--ds-red-900)] hover:bg-[var(--ds-red-100)]"
                    >✕</IconButton>
                  </div>
                </div>
              ))}
              {draft.length === 0 && (
                <div className="py-8 text-center border-2 border-dashed border-[var(--ds-gray-300)] rounded-xl text-copy-13 text-[var(--ds-gray-500)] italic">
                  Flow is empty. Add sections below.
                </div>
              )}
            </div>
          </div>

          {/* Add Sections */}
          <div>
            <label className="text-label-12 text-[var(--ds-gray-600)] uppercase tracking-wider font-bold mb-4 block">
              Add Section to Flow
            </label>
            <div className="grid grid-cols-2 gap-2">
              {availableSections.map((name, i) => (
                <button
                  key={i}
                  onClick={() => setDraft(p => [...p, name])}
                  className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] text-label-13 font-bold text-[var(--ds-gray-900)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-all"
                >
                  {name}
                  <span className="text-heading-18 leading-none opacity-40">+</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 bg-[var(--ds-gray-100)] border-t border-[var(--ds-gray-300)] flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="brand" onClick={() => onUpdate(draft)}>Apply Changes</Button>
        </div>
      </div>
    </div>
  );
}

// Chart with editable cue cards between sections
function PracticeChart({ song, selectedKey, capo, fontSize, columns = 1, chordFontSize, notation = 'letters', accidentals = 'auto', showChords = true, showDiagrams = false, displayMode = 'chords', tabInstrument = 'all', chordEmphasis = 'full', sectionColors, sectionLabels, customSectionTypes, onSaveCue, canEditShared = true, privateNotes }) {
  const myEnabled = !!privateNotes?.enabled;
  const transpose = semitonesBetween(song.key, selectedKey) - (capo || 0);
  // Mirror the chart-view display switch.
  const viewChords = displayMode === 'chords' || displayMode === 'chordsonly';
  const viewLyrics = displayMode === 'chords' || displayMode === 'lyrics';
  const viewTabs = displayMode === 'chords' || displayMode === 'tabs';

  const allChords = useMemo(() => Array.from(new Set(
    song.sections.flatMap(s => s.lines)
      .filter(l => typeof l === 'string')
      .flatMap(l => { const m = l.match(/\[(.*?)\]/g); return m ? m.map(x => x.slice(1, -1)) : []; })
  )), [song.sections]);

  const sectionModOffsets = useMemo(() => {
    const acc = { total: 0 };
    return song.sections.map(section => {
      const offset = acc.total;
      (section.lines || []).forEach(line => {
        if (typeof line === 'object' && line.type === 'modulate') {
          acc.total += line.semitones;
        }
      });
      return offset;
    });
  }, [song.sections]);

  if (displayMode === 'songmap') {
    return (
      <SongMap
        sections={song.sections}
        modOffsets={sectionModOffsets}
        transpose={transpose}
        sectionColors={sectionColors}
        sectionLabels={sectionLabels}
        customSectionTypes={customSectionTypes}
        onSelect={(i) => {
          const el = document.getElementById(`practice-section-${i}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      />
    );
  }

  return (
    <div
      style={{
        fontSize,
        fontFamily: "var(--font-mono)",
        ['--chart-font-size-lyric']: `${fontSize}px`,
        ...(chordFontSize ? { ['--chart-font-size-chord']: `${chordFontSize}px` } : {}),
        ...(columns === 2 ? { columnCount: 2, columnGap: '3rem' } : {}),
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
      {(song.notes || myEnabled) && (
        <div className="mb-4" style={{ columnSpan: 'all', WebkitColumnSpan: 'all' }}>
          <NotesStack
            pillLabel="Song notes"
            entries={[
              { key: 'team', label: myEnabled ? 'Team' : undefined, value: song.notes || '' },
              ...(myEnabled ? [{
                key: 'mine',
                label: 'Mine',
                value: privateNotes.getNote({ songId: song.id }),
                editable: true,
                onSave: (t) => privateNotes.setNote({ songId: song.id }, t),
                placeholder: 'Private note (only you)…',
                addLabel: 'Add a private note',
              }] : []),
            ]}
          />
        </div>
      )}
      {song.sections.map((section, i) => (
        <div key={section.id || i} id={`practice-section-${i}`} data-section-index={i} style={{ scrollMarginTop: '7rem', breakInside: 'avoid' }}>
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
            chordEmphasis={chordEmphasis}
            inlineNotes
            noteStyle="dashes"
          />
          <div className="mt-1 mb-6">
            <NotesStack
              pillLabel="Band cue"
              entries={[
                {
                  key: 'team',
                  label: myEnabled ? 'Team' : undefined,
                  value: section.note || '',
                  editable: canEditShared,
                  onSave: (newNote) => onSaveCue(i, newNote),
                  placeholder: 'Band cue…',
                  addLabel: `Add band cue after ${section.type}`,
                },
                ...(myEnabled ? [{
                  key: 'mine',
                  label: 'Mine',
                  value: privateNotes.getNote({ songId: song.id, sectionKey: section.id || `idx-${i}` }),
                  editable: true,
                  onSave: (t) => privateNotes.setNote({ songId: song.id, sectionKey: section.id || `idx-${i}` }, t),
                  placeholder: 'Private note (only you)…',
                  addLabel: 'Add a private cue',
                }] : []),
              ]}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
