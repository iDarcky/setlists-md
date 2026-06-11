import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { transposeKey, transposeChord, ALL_KEYS, semitonesBetween, normalizeSectionName } from '../music';
import { resolveSongView } from '../arrangements';
import { resolveChartDisplay, resolveColumns } from '../lib/chartDisplay';
import ChordDiagram from './ChordDiagram';
import { Card } from './ui/Card';
import SectionBlock from './SectionBlock';
import SongMap from './SongMap';
import { StructureRibbon } from './StructureRibbon';
import FloatingNavPill from './ui/FloatingNavPill';
import { IconButton } from './ui/IconButton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/Select';
import NoteContent from './ui/NoteContent';
import { useWakeLock } from '../hooks/useWakeLock';
import { headerFrostStyle } from '../lib/headerFrost';
import { useIsTablet, useIsLandscape, useIsDesktop } from '../lib/useMediaQuery';

const RAIL_OPEN_KEY = 'setlists-md:perf-rail-open';

export default function PerformanceView({ setlist, songs, onBack, onFinish, defaultFontSize, railEnabled = true, navStyle = 'pill', settings }) {
  useWakeLock(true);
  const [idx, setIdx] = useState(0);
  const [selectedKey, setSelectedKey] = useState(null);
  // Device-global chart display (size, chords, columns…) — same source the
  // Library chart writes to, so customizing a song carries into live mode.
  const disp = resolveChartDisplay(settings, { fallbackLyric: defaultFontSize || 18 });
  const fontSize = disp.lyricFontSize;
  // Live display mode (chords / lyrics / tabs / song map) — session-local, set
  // from the header view picker.
  const [displayMode, setDisplayMode] = useState('chords');
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const scrollRef = useRef(null);

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
        const raw = songs.find(s => s.id === it.songId);
        const song = resolveSongView(raw, it.arrangementId);
        return song ? { ...it, song } : { ...it, isMissing: true };
      }),
    [setlist, songs]
  );

  const cur = resolved[idx] || null;
  const next = resolved[idx + 1] || null;

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
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) goNext(); else goPrev();
    }
  }, [goNext, goPrev]);

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
  const navButtons = navStyle === 'header' ? (
    <div className="flex items-center gap-1 shrink-0 pr-2 mr-1 border-r border-[var(--ds-gray-300)]">
      <IconButton size="md" variant="ghost" onClick={goPrev} disabled={idx === 0} aria-label="Previous song">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      </IconButton>
      <span className="text-label-13 text-[var(--ds-gray-700)] tabular-nums px-1 select-none min-w-[2.5rem] text-center">{idx + 1}/{resolved.length}</span>
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

  // Chevron + close X — anchored to the right end of the title row in both
  // expanded and collapsed states. Same variant and size so they render
  // with matching color and weight.
  const headerControls = (
    <div className="flex items-center gap-1 shrink-0">
      <IconButton
        size="sm"
        variant="ghost"
        onClick={() => setHeaderCollapsed(c => !c)}
        aria-label={headerCollapsed ? 'Expand header' : 'Collapse header'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d={headerCollapsed ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'} />
        </svg>
      </IconButton>
      <IconButton variant="ghost" size="sm" onClick={onBack} aria-label="Close live view">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      </IconButton>
    </div>
  );

  return (
    <div
      className="h-full flex overflow-hidden"
      style={{ background: 'var(--chart-bg, var(--ds-background-100))' }}
    >
    <div
      ref={scrollRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="flex-1 min-w-0 h-full overflow-y-auto overflow-x-hidden relative"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        color: 'var(--chart-text, var(--ds-gray-1000))',
        fontFamily: 'var(--chart-font-lyric, var(--font-sans))',
      }}
    >
      {/* ── Minimal sticky header ──
          When collapsed, the structure ribbon takes the title's slot so the
          slim row stays useful (you can still jump between sections). The
          dedicated ribbon row below only renders when the header is
          expanded. */}
      {(() => {
        const structRibbon = !cur.isBreak && !cur.isMissing && cur.song.sections?.length > 0 ? (
          <StructureRibbon
            structure={cur.song.structure || cur.song.sections.map(s => s.type)}
            compact
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
          <div className="material-header" style={{ zIndex: 50, ...headerFrostStyle }}>
            <div className={`wide-container flex items-center gap-2 ${headerCollapsed ? 'py-1.5' : 'py-3'}`}>
              {navButtons}
              {!headerCollapsed && (
                <>
                  {/* Title */}
                  <h1 className="text-heading-16 text-[var(--ds-gray-1000)] m-0 flex-1 min-w-0 truncate">
                    {cur.isBreak ? (cur.label || 'Break') : cur.song.title}
                  </h1>

                  {/* Meta: view mode + key picker + tempo + time */}
                  {!cur.isBreak && !cur.isMissing && displayKey && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Select value={displayMode} onValueChange={setDisplayMode}>
                        <SelectTrigger className="h-7 px-2 border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] rounded-lg text-label-13 font-bold text-[var(--ds-gray-1000)] gap-1 min-w-0 w-auto focus:ring-0" aria-label="Display mode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="chords">Chords</SelectItem>
                          <SelectItem value="lyrics">Lyrics</SelectItem>
                          <SelectItem value="tabs">Tabs</SelectItem>
                          <SelectItem value="songmap">Song map</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={displayKey} onValueChange={setSelectedKey}>
                        <SelectTrigger className="h-7 px-2 border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] rounded-lg text-label-13 font-bold text-[var(--ds-gray-1000)] gap-1 min-w-0 w-auto focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_KEYS.map(k => (
                            <SelectItem key={k} value={k}>
                              {k}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {cur.capo > 0 && (
                        <span className="text-label-12 font-bold text-[var(--color-brand)] whitespace-nowrap bg-[var(--color-brand-soft)] px-1.5 py-0.5 rounded border border-[var(--color-brand-border)]">
                          Capo {cur.capo}
                        </span>
                      )}
                      {cur.song.tempo && (
                        <span className="text-label-12 text-[var(--ds-gray-700)] whitespace-nowrap">
                          ♩ {cur.song.tempo}
                        </span>
                      )}
                      {cur.song.time && (
                        <span className="text-label-12 text-[var(--ds-gray-700)] whitespace-nowrap">
                          {cur.song.time}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
              {headerCollapsed && (
                <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar">
                  {structRibbon}
                </div>
              )}
              {headerControls}
            </div>

            {/* Dedicated structure-ribbon row — only when expanded. */}
            {!headerCollapsed && structRibbon && (
              <div className="wide-container flex items-center gap-1 pb-2 pt-0">
                <div className="flex-1 overflow-x-auto no-scrollbar">
                  {structRibbon}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Content ── */}
      <div className="wide-container pt-4 pb-32">
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
            {/* Per-song note from the setlist builder — surfaced inline so
                the leader sees their cue ("Slow intro", "Skip bridge", etc.)
                the moment the song lands on screen. */}
            {cur.note && (
              <div className="mb-3 px-3 py-1.5 rounded-md bg-[var(--ds-warning-soft)] border border-[var(--ds-warning-border)] text-label-13 text-[var(--ds-warning-900)]">
                {cur.note}
              </div>
            )}
            <SongChart
              song={cur.song}
              selectedKey={displayKey}
              capo={cur.capo || 0}
              fontSize={fontSize}
              columns={columns}
              chordFontSize={disp.chordFontSize}
              nashville={disp.nashville}
              showChords={disp.showChords}
              showDiagrams={disp.showDiagrams}
              displayMode={displayMode}
              sectionColors={settings?.sectionColors}
              sectionLabels={settings?.sectionLabels}
              customSectionTypes={settings?.customSectionTypes}
            />
          </>
        ) : null}
      </div>

      {/* ── Floating nav pill (unless the leader chose header buttons) ── */}
      {navStyle !== 'header' && (
        <FloatingNavPill
          current={idx + 1}
          total={resolved.length}
          nextLabel={next?.isBreak ? (next.label || 'Break') : next?.song?.title}
          onPrev={goPrev}
          onNext={goNext}
          hasPrev={idx > 0}
          hasNext={idx < resolved.length - 1}
          onFinish={onFinish ? handleFinish : undefined}
        />
      )}
    </div>

    {/* ── Parallel-browsing setlist rail (tablet landscape) ── */}
    {showRail && (
      <aside
        className="shrink-0 h-full border-l border-[var(--ds-gray-300)] flex flex-col"
        style={{ width: railOpen ? 288 : 44, background: 'var(--ds-background-200)', transition: 'width 200ms ease' }}
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
            <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-1">
              {resolved.map((r, i) => {
                const active = i === idx;
                const title = r.isBreak ? (r.label || 'Break') : (r.isMissing ? 'Missing song' : r.song.title);
                const k = (!r.isBreak && !r.isMissing) ? transposeKey(r.song.key, r.transpose || 0) : null;
                return (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    aria-current={active ? 'true' : undefined}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      active
                        ? 'bg-[var(--color-brand)] text-white'
                        : 'text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)] hover:text-[var(--ds-gray-1000)]'
                    }`}
                  >
                    <span className={`text-label-11-mono shrink-0 ${active ? 'text-white/80' : 'text-[var(--ds-gray-500)]'}`}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="flex-1 min-w-0 truncate text-copy-14">{title}</span>
                    {k && (
                      <span className={`text-label-11-mono shrink-0 ${active ? 'text-white/90' : 'text-[var(--chord)]'}`}>{k}</span>
                    )}
                  </button>
                );
              })}
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
    </div>
  );
}

function SongChart({ song, selectedKey, capo, fontSize, columns, chordFontSize, nashville = false, showChords = true, showDiagrams = false, displayMode = 'chords', sectionColors, sectionLabels, customSectionTypes }) {
  const transpose = semitonesBetween(song.key, selectedKey) - (capo || 0);
  const [notesOpen, setNotesOpen] = useState(false);
  const viewChords = displayMode === 'chords';
  const viewLyrics = displayMode !== 'tabs';
  const viewTabs = displayMode !== 'lyrics';

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
      {song.notes && (
        <div className="mb-3" style={{ columnSpan: 'all', WebkitColumnSpan: 'all' }}>
          {notesOpen ? (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-[var(--ds-gray-300)] bg-[var(--ds-gray-alpha-100)]" style={{ fontFamily: 'var(--font-sans)' }}>
              <span className="shrink-0 mt-0.5 text-[var(--ds-gray-600)]" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                  <path d="M8 13h6" />
                  <path d="M8 17h4" />
                </svg>
              </span>
              <p className="flex-1 m-0 text-copy-13 text-[var(--ds-gray-1000)] whitespace-pre-wrap">
                {song.notes}
              </p>
              <button
                type="button"
                onClick={() => setNotesOpen(false)}
                aria-label="Hide notes"
                className="shrink-0 text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-1000)]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setNotesOpen(true)}
              aria-label="Show song notes"
              aria-expanded="false"
              className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full border border-[var(--ds-gray-300)] bg-[var(--ds-gray-alpha-100)] text-label-11 text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)] hover:text-[var(--ds-gray-1000)] transition-colors"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
              Notes
            </button>
          )}
        </div>
      )}
      {orderedSections.map((section, i) => (
        <div
          key={`${section.id || section.type}-${i}`}
          id={`perf-section-${i}`}
          style={{ breakInside: 'avoid', scrollMarginTop: '7rem' }}
        >
          <SectionBlock
            section={section}
            transpose={transpose}
            modOffset={sectionModOffsets[i]}
            nns={nashville}
            songKey={song.key}
            showChords={showChords && viewChords}
            showLyrics={viewLyrics}
            showTabs={viewTabs}
            inlineNotes
            noteStyle="dashes"
          />
        </div>
      ))}
    </div>
  );
}
