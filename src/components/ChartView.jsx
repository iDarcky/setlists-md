import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { transposeChord, ALL_KEYS, semitonesBetween, normalizeSectionName } from '../music';
import { resolveSongView } from '../arrangements';
import SectionBlock from './SectionBlock';
import ChordDiagram from './ChordDiagram';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { Card } from './ui/Card';
import { SegmentedControl } from './ui/SegmentedControl';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/Select';
import { cn } from '../lib/utils';
import { useIsTablet, useIsLandscape } from '../lib/useMediaQuery';
import { StructureRibbon } from './StructureRibbon';
import { exportSongPdf } from '../pdf/exportSongPdf';
import { OverflowMenu } from './ui/OverflowMenu';
import BottomSheet, { SheetField } from './ui/BottomSheet';
import ChartStyleControls from './ChartStyleControls';
import {
  CHART_THEMES,
  CHART_FONTS,
  CHART_FONT_MAP,
  CHART_THEME_MAP,
  DEFAULT_CHART_THEME_ID,
  DEFAULT_CHORD_FONT_ID,
  DEFAULT_LYRIC_FONT_ID,
} from '../data/chartThemes';
import { useEntitlement } from '../hooks/useEntitlement';
import { STAGE_MODES, STAGE_MODE_MAP } from '../data/stageModes';
import { resolveChartDisplay, resolveColumns, FONT_SIZES } from '../lib/chartDisplay';

// Tokens written by useChartTheme (App.jsx) live on :root and decide the
// chart's bg/text/chord colours plus the chord and lyric font stacks.
// Falling back to the existing Geist tokens means free-plan users see no
// visual change until they pick a theme.
const CHART_THEME_STYLE = {
  background: 'var(--chart-bg, var(--ds-background-100))',
  color: 'var(--chart-text, var(--ds-gray-1000))',
  fontFamily: 'var(--chart-font-lyric, var(--font-sans))',
};

export default function ChartView({
  song: songInput, onBack, onEdit, isPreview,
  defaultFontSize = 16,
  showInlineNotes = true, inlineNoteStyle = 'dashes',
  displayRole = 'leader', duplicateSections = 'full',
  chartLayout = 'columns',
  isFullscreen = false, onToggleFullscreen,
  onTransposed,
  notesPeekDefaultOpen = true,
  arrangementId,
  onArrangementChange,
  onSongChange,
  settings,
  onUpdateSettings,
  onOpenAdvancedStyle,
  onMoveSong, onCopySong,
}) {
  const initialFontSize = FONT_SIZES[defaultFontSize] || (typeof defaultFontSize === 'number' ? defaultFontSize : 16);

  // Internal active arrangement id for v2 songs viewed without an external
  // controller (e.g. from the Library). Setlist contexts pass arrangementId
  // and/or a pre-resolved view; both cases bypass this state.
  const [internalArrId, setInternalArrId] = useState(
    arrangementId || (songInput?.arrangements ? songInput.defaultArrangementId : undefined)
  );
  useEffect(() => {
    if (arrangementId) setInternalArrId(arrangementId);
  }, [arrangementId]);

  const activeArrId = arrangementId || internalArrId;
  const song = useMemo(() => {
    if (songInput && Array.isArray(songInput.arrangements)) {
      return resolveSongView(songInput, activeArrId);
    }
    return songInput;
  }, [songInput, activeArrId]);

  const [selectedKey, setSelectedKey] = useState(song?.key || 'C');
  // Reset transpose when the user switches arrangement (each arrangement has
  // its own source key — preserving an old selectedKey would leak the wrong
  // transposition into the new chart).
  const lastArrIdRef = useRef(activeArrId);
  useEffect(() => {
    if (lastArrIdRef.current !== activeArrId) {
      lastArrIdRef.current = activeArrId;
      if (song?.key) setSelectedKey(song.key);
    }
  }, [activeArrId, song?.key]);
  // Display options are device-global now: they live in `settings` (persisted +
  // synced) and are resolved here, falling back to the active stage-mode preset.
  // Every change writes straight back through onUpdateSettings, so a tweak on
  // one song shows up on every song and in the live / practice views too. Local
  // mirrors keep the controls snappy and re-seed when settings change.
  const stageMode = settings?.stageMode || 'leader';
  const disp = resolveChartDisplay(settings, { fallbackLyric: initialFontSize });

  // Tablet adaptive reflow: a wide landscape reading area reads better in two
  // columns; a narrow one (portrait, or the embedded dock/peek preview pane)
  // stays single column. We key off the chart's *actual* width (measured
  // below). Explicit 1/2 from settings wins; 'auto'/unset uses this hint.
  const isTablet = useIsTablet();
  const isLandscape = useIsLandscape();
  const [chartWidth, setChartWidth] = useState(0);
  const wantTwo = isTablet && isLandscape && chartWidth >= 700;
  const userSetColumnsRef = useRef(false);

  const [columns, setColumns] = useState(resolveColumns(disp.columns, wantTwo));
  const setColumnsManually = (v) => {
    userSetColumnsRef.current = true;
    setColumns(v);
    onUpdateSettings?.('defaultColumns', v);
  };
  // Re-seed when the reading width / orientation / setting changes, unless the
  // user has overridden the column count by hand this session.
  useEffect(() => {
    if (!userSetColumnsRef.current) setColumns(resolveColumns(disp.columns, wantTwo));
  }, [disp.columns, wantTwo]);

  const [fontSize, setFontSize] = useState(disp.lyricFontSize);
  const [chordFontSize, setChordFontSize] = useState(disp.chordFontSize);
  const [nns, setNns] = useState(disp.nashville);
  const [showChords, setShowChords] = useState(disp.showChords);
  const [showDiagrams, setShowDiagrams] = useState(disp.showDiagrams);
  // Quick view mode (session-local) from the structure row:
  //   chords → chords + lyrics (+ tabs); lyrics → lyrics only; tabs → tabs only.
  const [displayMode, setDisplayMode] = useState('chords');
  const viewChords = displayMode === 'chords';
  const viewLyrics = displayMode !== 'tabs';
  const viewTabs = displayMode !== 'lyrics';

  // Re-seed local mirrors when the persisted display settings change — another
  // song, a role preset, or an edit made on a different surface.
  useEffect(() => {
    setFontSize(disp.lyricFontSize);
    setChordFontSize(disp.chordFontSize);
    setNns(disp.nashville);
    setShowChords(disp.showChords);
    setShowDiagrams(disp.showDiagrams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.defaultFontSize, settings?.chordFontSize, settings?.nashville, settings?.showChords, settings?.showDiagrams, settings?.stageMode]);

  // Persisting helpers — update the snappy local mirror and the device setting.
  const changeFontSize = (v) => { const n = Math.max(10, Math.min(30, v)); setFontSize(n); onUpdateSettings?.('defaultFontSize', n); };
  const changeChordFontSize = (v) => { const n = Math.max(8, Math.min(30, v)); setChordFontSize(n); onUpdateSettings?.('chordFontSize', n); };
  const toggleNns = () => { const v = !nns; setNns(v); onUpdateSettings?.('nashville', v); };
  const toggleShowChords = () => { const v = !showChords; setShowChords(v); onUpdateSettings?.('showChords', v); };
  const toggleShowDiagrams = () => { const v = !showDiagrams; setShowDiagrams(v); onUpdateSettings?.('showDiagrams', v); };

  // Picking a role applies its preset by writing every value through to
  // settings, so the role choice persists across songs and views too.
  const applyRole = (id) => {
    const preset = STAGE_MODE_MAP[id]?.settings || {};
    onUpdateSettings?.('stageMode', id);
    if (preset.lyricFontSize != null) onUpdateSettings?.('defaultFontSize', preset.lyricFontSize);
    if (preset.chordFontSize != null) onUpdateSettings?.('chordFontSize', preset.chordFontSize);
    onUpdateSettings?.('nashville', !!preset.nashville);
    onUpdateSettings?.('showChords', preset.showChords !== false);
    onUpdateSettings?.('showDiagrams', !!preset.showDiagrams);
  };
  const [activeSheet, setActiveSheet] = useState(null); // 'layout' | 'music' | 'arrangements' | null
  const [showInfo, setShowInfo] = useState(false); // inline song-details panel toggled from the title chevron
  const [scrolled, setScrolled] = useState(false);
  const [notesPeekOpen, setNotesPeekOpen] = useState(notesPeekDefaultOpen);

  const scrollContainerRef = useRef(null);

  const transpose = semitonesBetween(song.key, selectedKey);

  // Notify parent the first time a user transposes this song. Used by the
  // onboarding checklist to mark the "Transpose a song" task complete.
  const transposedFiredRef = useRef(false);
  useEffect(() => {
    if (transposedFiredRef.current) return;
    if (selectedKey !== song.key) {
      transposedFiredRef.current = true;
      onTransposed?.();
    }
  }, [selectedKey, song.key, onTransposed]);

  const handleSwitchArrangement = (id) => {
    setInternalArrId(id);
    onArrangementChange?.(id);
  };

  const openSheet = (name) => setActiveSheet(name);

  // Detect scroll position for collapsing header. Uses a wide hysteresis
  // band (must drop under 20 to expand, must climb past 140 to collapse)
  // plus a rAF guard so iOS Safari's momentum scroll can't fire scrollTop
  // reads back-to-back fast enough to swap the state mid-frame.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    let pending = false;
    const onScroll = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        const y = el.scrollTop;
        setScrolled((prev) => {
          if (prev && y < 20) return false;
          if (!prev && y > 140) return true;
          return prev;
        });
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Track the reading area's width so the adaptive column default (above) can
  // react to the real space available — fullscreen vs. a narrow dock pane vs.
  // rotation — without each call site having to know.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w) setChartWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Intercept Cmd/Ctrl+P so the keyboard shortcut routes through the
  // dedicated PDF exporter instead of dumping the whole window to paper.
  useEffect(() => {
    if (isPreview) return;
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        exportSongPdf(song, { transpose });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [song, transpose, isPreview]);

  // Resolve playback order: if `song.structure` is set and the section
  // types in the body are unique, use it as the ordered list of section
  // references (each entry maps to a section by its `type` label,
  // sections may repeat). When the body has duplicate section names
  // (e.g. two `## Verse` blocks) the by-name lookup is ambiguous and
  // would hide the duplicates, so we fall back to document order. That
  // preserves the pre-structure-rework behaviour for legacy songs.
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
    // If the structure list doesn't fully resolve against the actual
    // sections (typo, removed section, etc.), drop back to doc order
    // rather than partially hiding the song.
    if (resolved.length !== song.structure.length) return song.sections;
    return resolved;
  }, [song.structure, song.sections]);

  // Cumulative modulate offsets follow playback order so a repeated
  // section after a `{modulate}` block plays back in the new key.
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

  // Extract all unique chords for diagrams
  const allChords = Array.from(new Set(
    song.sections.flatMap(s => s.lines)
      .filter(l => typeof l === 'string')
      .flatMap(l => {
        const matches = l.match(/\[(.*?)\]/g);
        return matches ? matches.map(m => m.slice(1, -1)) : [];
      })
  ));

  // Check if any metadata exists
  const hasMetadata = !!song.artist || song.capo > 0 || !!song.ccli || (song.tags?.length > 0) || !!song.notes || !!song.spotify || !!song.youtube
    || !!song.originaltitle || !!song.language || !!song.translator || !!song.vocalrange || !!song.year
    || !!song.writers || !!song.publishers || !!song.album || !!song.label || !!song.copyright
    || !!song.themes || !!song.genres || !!song.scripture || !!song.moment || !!song.story;

  // Song details body — shown inline in the header (toggled by the title
  // chevron). Defined once so the header panel stays readable.
  const songInfoBody = hasMetadata ? (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-copy-13 m-0">
      {song.artist && <InfoRow label="Artist">{song.artist}</InfoRow>}
      {song.originaltitle && <InfoRow label="Original title">{song.originaltitle}</InfoRow>}
      {song.language && <InfoRow label="Language">{song.language}</InfoRow>}
      {song.translator && <InfoRow label="Translator">{song.translator}</InfoRow>}
      {song.tempo && <InfoRow label="Tempo">{song.tempo} bpm</InfoRow>}
      {song.time && <InfoRow label="Time">{song.time}</InfoRow>}
      {song.capo > 0 && <InfoRow label="Capo">{song.capo}</InfoRow>}
      {song.vocalrange && <InfoRow label="Vocal range">{song.vocalrange}</InfoRow>}
      {song.year && <InfoRow label="Release year">{song.year}</InfoRow>}
      {song.writers && <InfoRow label="Writers">{song.writers}</InfoRow>}
      {song.publishers && <InfoRow label="Publishers">{song.publishers}</InfoRow>}
      {song.album && <InfoRow label="Album">{song.album}</InfoRow>}
      {song.label && <InfoRow label="Label">{song.label}</InfoRow>}
      {song.ccli && <InfoRow label="CCLI">{song.ccli}</InfoRow>}
      {song.copyright && <InfoRow label="Copyright">{song.copyright}</InfoRow>}
      {song.themes && <InfoRow label="Themes">{song.themes}</InfoRow>}
      {song.genres && <InfoRow label="Genres">{song.genres}</InfoRow>}
      {song.scripture && <InfoRow label="Bible verses">{song.scripture}</InfoRow>}
      {song.moment && <InfoRow label="Liturgical moment">{song.moment}</InfoRow>}
      {song.tags?.length > 0 && <InfoRow label="Tags">{song.tags.join(', ')}</InfoRow>}
      {song.story && <InfoRow label="Story behind"><span className="whitespace-pre-wrap">{song.story}</span></InfoRow>}
      {song.notes && <InfoRow label="Notes"><span className="whitespace-pre-wrap">{song.notes}</span></InfoRow>}
      {song.spotify && <InfoRow label="Spotify"><a href={song.spotify} target="_blank" rel="noopener noreferrer" className="text-[var(--color-brand-text)] hover:underline">Open ↗</a></InfoRow>}
      {song.youtube && <InfoRow label="YouTube"><a href={song.youtube} target="_blank" rel="noopener noreferrer" className="text-[var(--color-brand-text)] hover:underline">Open ↗</a></InfoRow>}
    </dl>
  ) : (
    <p className="text-copy-13 text-[var(--text-2)] italic m-0">No additional song info</p>
  );

  return (
    <div
      ref={scrollContainerRef}
      style={CHART_THEME_STYLE}
      className={cn(
        // h-full (not 100dvh) so the chart fills its parent slot and owns the
        // *only* scrollbar — `<main>` already scrolls, and 100dvh overflowed it
        // by the header's height, producing a second scrollbar.
        "h-full overflow-y-auto overflow-x-hidden",
        isPreview && "px-4 py-4"
      )}
    >
      {/* ── Sticky Header ── */}
      {/* Header stays in the app shell theme regardless of which chart
          theme is active. Children use the app's --text-1/--text-2
          tokens which already follow light/dark/midnight. */}
      {!isPreview && (
        <div
          className="material-header transition-all duration-200"
          style={{
            color: 'var(--text-1)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {/* Line 1: Title + close + dot menu. Title size stays stable on
              scroll — toggling font-size against the synchronous Line-2
              collapse was causing the title to flicker for some users.
              Compact "Line-2" content collapses on scroll but the title
              itself doesn't resize. */}
          <div className="wide-container flex items-center justify-between gap-3 pt-3 pb-0.5">
            <div className="min-w-0 flex-1 flex items-baseline gap-3">
              <button
                type="button"
                onClick={() => setShowInfo(v => !v)}
                aria-expanded={showInfo}
                aria-label="Song details"
                className="min-w-0 flex items-baseline gap-1.5 bg-transparent border-none cursor-pointer p-0 text-left"
              >
                <h1
                  className="m-0 truncate font-bold leading-tight text-heading-24"
                  style={{ color: 'var(--text-1)' }}
                >
                  {song.title}
                </h1>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 self-center text-[var(--text-2)] transition-transform duration-200 ${showInfo ? 'rotate-180' : ''}`}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {/* Always-mounted inline meta — visibility toggled via
                  CSS so the DOM doesn't reflow on scroll. Without this
                  the flex container reflowed at the moment `scrolled`
                  toggled and the title's truncate point jumped. */}
              <div
                className="flex items-center gap-2 flex-shrink-0 text-label-12 transition-opacity duration-150"
                style={{
                  color: 'var(--text-2)',
                  opacity: scrolled ? 1 : 0,
                  pointerEvents: scrolled ? 'auto' : 'none',
                  maxWidth: scrolled ? '100%' : 0,
                  overflow: 'hidden',
                }}
                aria-hidden={!scrolled}
              >
                <span aria-hidden="true">·</span>
                <span className="font-bold whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{selectedKey}</span>
                {song.tempo && <span className="whitespace-nowrap">{song.tempo} bpm</span>}
                {song.time && <span className="whitespace-nowrap">{song.time}</span>}
              </div>
            </div>
            <div className="flex gap-0.5 items-center flex-shrink-0">
              <OverflowMenu
                ariaLabel="Song actions"
                items={[
                  {
                    label: 'Print / Save as PDF',
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 6 2 18 2 18 9" />
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                        <rect x="6" y="14" width="12" height="8" />
                      </svg>
                    ),
                    onClick: () => exportSongPdf(song, { transpose }),
                  },
                  onEdit && {
                    label: 'Edit',
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                      </svg>
                    ),
                    onClick: () => onEdit(activeArrId),
                  },
                  {
                    label: 'Customize',
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
                        <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
                        <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                        <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
                      </svg>
                    ),
                    onClick: () => openSheet('layout'),
                  },
                  onMoveSong && {
                    label: 'Move to…',
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    ),
                    onClick: () => onMoveSong(),
                  },
                  onCopySong && {
                    label: 'Copy to…',
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    ),
                    onClick: () => onCopySong(),
                  },
                ]}
              />
              {onToggleFullscreen && (
                <IconButton variant="ghost" size="sm" onClick={onToggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                  {isFullscreen ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 3v4a1 1 0 0 1-1 1H3" /><path d="M21 8h-4a1 1 0 0 1-1-1V3" /><path d="M3 16h4a1 1 0 0 1 1 1v4" /><path d="M16 21v-4a1 1 0 0 1 1-1h4" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 8V3h5" /><path d="M21 8V3h-5" /><path d="M3 16v5h5" /><path d="M21 16v5h-5" />
                    </svg>
                  )}
                </IconButton>
              )}
              {onBack && (
                <IconButton variant="ghost" size="sm" onClick={onBack} aria-label="Close">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </IconButton>
              )}
            </div>
          </div>

          {/* Line 2: Arrangement + Key / Tempo / Time — collapses when scrolled */}
          <div className={cn(
            "wide-container flex flex-wrap items-center gap-3 transition-all duration-200 overflow-hidden",
            scrolled ? "max-h-0 opacity-0 pb-0" : "max-h-12 opacity-100 pb-1.5"
          )}>
            {song._arrangementId && (song._allArrangements?.length || 0) > 1 ? (
              <>
                <Select value={activeArrId} onValueChange={handleSwitchArrangement}>
                  <SelectTrigger
                    className="h-7 px-1.5 border-transparent bg-transparent hover:bg-[var(--bg-2)] text-label-13 font-semibold text-[var(--text-1)] gap-1.5 max-w-[180px] min-w-0 w-auto focus:ring-0"
                    aria-label="Switch arrangement"
                  >
                    <span className="truncate">
                      {song._allArrangements.find(a => a.id === activeArrId)?.name || 'Arrangement'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {song._allArrangements.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="inline-flex items-center gap-1.5">
                          {a.id === song._defaultArrangementId && (
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" title="Default" aria-label="Default" />
                          )}
                          {a.name || 'Untitled arrangement'}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-label-12" style={{ color: 'var(--text-2)' }}>·</span>
              </>
            ) : song._arrangementId ? (
              <>
                <span className="text-label-13 font-semibold truncate max-w-[180px]" style={{ color: 'var(--text-1)' }}>
                  {song._arrangementName}
                </span>
                <span className="text-label-12" style={{ color: 'var(--text-2)' }}>·</span>
              </>
            ) : null}
            <Select value={selectedKey} onValueChange={setSelectedKey}>
              <SelectTrigger className="h-6 px-1.5 border-transparent bg-transparent text-label-14 font-bold text-[var(--text-1)] hover:bg-[var(--bg-2)] gap-1 min-w-0 w-auto focus:ring-0">
                <span className="text-label-12 font-semibold text-[var(--text-2)] mr-0.5">Key</span>
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
            {song.tempo && (
              <span className="text-label-14 text-[var(--text-2)]">
                <span className="text-label-12 font-semibold mr-0.5">Tempo</span>
                <span className="font-bold">{song.tempo}</span>
              </span>
            )}
            {song.time && (
              <span className="text-label-14 text-[var(--text-2)]">
                <span className="text-label-12 font-semibold mr-0.5">Time</span>
                <span className="font-bold">{song.time}</span>
              </span>
            )}
          </div>

          {/* Inline song details — toggled by the title chevron (like the editor) */}
          {showInfo && (
            <div className="wide-container pb-2 mt-1 max-h-[40vh] overflow-y-auto border-t border-[var(--border-1)] pt-2">
              {songInfoBody}
            </div>
          )}

          {/* Structure ribbon (left) + display filters (right) */}
          <div className="wide-container pb-2 flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <StructureRibbon
                structure={orderedSections.map(s => s.type)}
                compact
                sectionColors={settings?.sectionColors}
                sectionLabels={settings?.sectionLabels}
                customSectionTypes={settings?.customSectionTypes}
                onSelect={(i) => {
                  const el = document.getElementById(`section-${i}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              />
            </div>
            <div className="shrink-0 flex items-center gap-0.5 pt-0.5 p-0.5 rounded-lg bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)]">
              {[
                { id: 'chords', label: 'Chords' },
                { id: 'lyrics', label: 'Lyrics' },
                { id: 'tabs', label: 'Tabs' },
              ].map(b => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setDisplayMode(b.id)}
                  aria-pressed={displayMode === b.id}
                  className={`px-2.5 py-0.5 rounded-md text-label-11 font-semibold cursor-pointer border-none transition-colors ${
                    displayMode === b.id
                      ? 'bg-[var(--ds-background-100)] text-[var(--ds-gray-1000)] shadow-sm'
                      : 'bg-transparent text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-1000)]'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Song notes peek strip — collapsible, hidden when song has no notes */}
          {song.notes && (
            <div className="wide-container pb-2">
              {notesPeekOpen ? (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-[var(--ds-gray-300)] bg-[var(--ds-gray-alpha-100)]">
                  <span className="shrink-0 mt-0.5 text-[var(--ds-gray-600)]" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                      <path d="M8 13h6" />
                      <path d="M8 17h4" />
                    </svg>
                  </span>
                  <p className="flex-1 m-0 text-copy-13 text-[var(--text-1)] whitespace-pre-wrap">
                    {song.notes}
                  </p>
                  <button
                    type="button"
                    onClick={() => setNotesPeekOpen(false)}
                    aria-label="Hide notes"
                    className="shrink-0 text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-1000)] -mr-1 -mt-1 px-1 py-0.5"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setNotesPeekOpen(true)}
                  aria-label="Show song notes"
                  aria-expanded="false"
                  className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full border border-[var(--ds-gray-300)] bg-[var(--ds-gray-alpha-100)] text-label-11 text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)] hover:text-[var(--ds-gray-1000)] transition-colors"
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

        </div>
      )}

      {/* ── Bottom-sheet modals (Layout / Music / Song info) ── */}
      {!isPreview && (
        <>
          <BottomSheet
            open={activeSheet === 'layout'}
            onClose={() => setActiveSheet(null)}
            title="Layout"
          >
            <div className="flex flex-col gap-4">
              <SheetField label="Role">
                <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 py-0.5">
                  {STAGE_MODES.map(m => {
                    const active = stageMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => applyRole(m.id)}
                        className={cn(
                          "shrink-0 px-3 h-8 rounded-lg border transition-all text-label-12 font-semibold",
                          active
                            ? "border-[var(--color-brand)] text-[var(--color-brand)] bg-[var(--color-brand-soft)]"
                            : "border-[var(--border-1)] text-[var(--text-1)] bg-[var(--bg-1)] hover:border-[var(--border-3)]"
                        )}
                        title={m.description}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </SheetField>

              <SheetField label="Display">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={nns ? 'brand' : 'secondary'}
                    size="sm"
                    onClick={toggleNns}
                  >Numbers</Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={toggleShowChords}
                    className={cn(!showChords && "opacity-40")}
                  >Chords</Button>
                  <Button
                    variant={showDiagrams ? 'brand' : 'secondary'}
                    size="sm"
                    onClick={toggleShowDiagrams}
                  >Diagrams</Button>
                </div>
              </SheetField>

              <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                <SheetField label="Columns">
                  <SegmentedControl
                    value={columns}
                    onChange={setColumnsManually}
                    options={[
                      { value: 1, label: '1 col' },
                      { value: 2, label: '2 col' },
                    ]}
                    size="sm"
                  />
                </SheetField>
                <SheetField label="Lyric size">
                  <div className="flex items-center bg-[var(--bg-1)] border border-[var(--border-1)] rounded-lg p-0.5 w-fit">
                    <IconButton variant="ghost" size="sm" onClick={() => changeFontSize(fontSize - 2)} aria-label="Decrease lyric size">−</IconButton>
                    <span className="w-6 text-center text-label-12-mono text-[var(--text-1)] font-semibold tabular-nums">{fontSize}</span>
                    <IconButton variant="ghost" size="sm" onClick={() => changeFontSize(fontSize + 2)} aria-label="Increase lyric size">+</IconButton>
                  </div>
                </SheetField>
                <SheetField label="Chord size">
                  <div className="flex items-center bg-[var(--bg-1)] border border-[var(--border-1)] rounded-lg p-0.5 w-fit">
                    <IconButton variant="ghost" size="sm" onClick={() => changeChordFontSize(chordFontSize - 2)} aria-label="Decrease chord size">−</IconButton>
                    <span className="w-6 text-center text-label-12-mono text-[var(--text-1)] font-semibold tabular-nums">{chordFontSize}</span>
                    <IconButton variant="ghost" size="sm" onClick={() => changeChordFontSize(chordFontSize + 2)} aria-label="Increase chord size">+</IconButton>
                  </div>
                </SheetField>
              </div>

              <ChartStyleControls
                settings={settings}
                onUpdateSettings={onUpdateSettings}
              />

              {onOpenAdvancedStyle && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveSheet(null);
                    onOpenAdvancedStyle();
                  }}
                  className="mt-2 w-full h-11 rounded-xl bg-[var(--ds-background-100)] border border-[var(--border-1)] text-copy-14 font-semibold text-[var(--text-1)] flex items-center justify-center gap-2 hover:bg-[var(--bg-1)] transition-all"
                  style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)' }}
                >
                  Advanced settings
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              )}
            </div>
          </BottomSheet>

          {/* Arrangement add/rename/delete now lives in the editor only.
              The chart view's dropdown above handles read-only switching. */}

        </>
      )}

      <div className={cn(
        "pt-4 pb-24 wide-container",
        isPreview && "px-0 pt-0 pb-0 wide-container"
      )}>
        {/* ── Chord Diagrams Strip ── */}
        {showDiagrams && !isPreview && (
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-8 mb-8 border-b border-[var(--border-1)]">
            {allChords.map(chord => (
              <div key={chord} className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className="text-label-10-mono font-bold text-[var(--text-2)]">{transposeChord(chord, transpose)}</div>
                <Card className="w-24 h-28 flex items-center justify-center p-2">
                   <ChordDiagram chord={transposeChord(chord, transpose)} />
                </Card>
              </div>
            ))}
          </div>
        )}

        {/* ── Sections ── */}
        <div
          data-print-target="chart"
          className={chartLayout === 'rows' && columns === 2 ? "grid grid-cols-2 gap-x-12 items-start" : undefined}
          style={{
            fontSize,
            ['--chart-font-size-lyric']: `${fontSize}px`,
            ['--chart-font-size-chord']: `${chordFontSize}px`,
            ['--chart-line-height-lyric']: settings?.lyricLineHeight ?? 1.35,
            ['--chart-section-gap']: `${settings?.sectionSpacing ?? 24}px`,
            fontFamily: 'var(--chart-font-lyric, var(--font-sans))',
            ...(chartLayout !== 'rows' || columns !== 2 ? { columnCount: columns, columnGap: '3rem' } : {}),
          }}
        >
          {orderedSections.map((section, idx) => (
            <div
              key={`${section.id || section.type}-${idx}`}
              id={`section-${idx}`}
              style={{ scrollMarginTop: '10rem', breakInside: 'avoid' }}
            >
              <SectionBlock
                section={section}
                transpose={transpose}
                modOffset={sectionModOffsets[idx]}
                nns={nns}
                songKey={song.key}
                showChords={showChords && viewChords}
                showLyrics={viewLyrics}
                showTabs={viewTabs}
                inlineNotes={showInlineNotes}
                noteStyle={inlineNoteStyle}
                sectionColors={settings?.sectionColors}
                sectionLabels={settings?.sectionLabels}
                customSectionTypes={settings?.customSectionTypes}
                tabScale={settings?.tabSize || 1}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, children }) {
  return (
    <div className="flex gap-2 min-w-0">
      <dt className="w-24 shrink-0 text-label-12 font-semibold text-[var(--text-2)] leading-tight pt-0.5">{label}</dt>
      <dd className="flex-1 min-w-0 m-0 text-[var(--text-1)] break-words">{children}</dd>
    </div>
  );
}

