import { useState, useMemo, useRef, useEffect } from 'react';
import { transposeChord, transposeKey, keysInQualityOf, semitonesBetween, normalizeSectionName } from '../music';
import { resolveSongView } from '../arrangements';
import SectionBlock from './SectionBlock';
import SongMap from './SongMap';
import SongDetails from './SongDetails';
import ChordDiagram from './ChordDiagram';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { Card } from './ui/Card';
import { SegmentedControl } from './ui/SegmentedControl';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/Select';
import { cn } from '../lib/utils';
import { useIsTablet, useIsLandscape } from '../lib/useMediaQuery';
import { StructureRibbon } from './StructureRibbon';
import FloatingStructure from './ui/FloatingStructure';
import { VIEW_MODES } from './ui/viewModes';
import AaMenu from './AaMenu';
import { useActiveSection } from '../hooks/useActiveSection';
import { useStageHeaderCollapse } from '../hooks/useStageHeaderCollapse';
import StageHeader from './ui/StageHeader';
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
import { resolveChartDisplay, resolveColumns, FONT_SIZES } from '../lib/chartDisplay';
import { STAGE_MODES } from '../data/stageModes';
import { TAB_INSTRUMENTS } from './editor/tabInstruments';

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
  duplicateSections = 'full',
  chartLayout = 'columns',
  isFullscreen = false, onToggleFullscreen,
  onTransposed,
  notesPeekDefaultOpen = true,
  arrangementId,
  onArrangementChange,
  settings,
  onUpdateSettings,
  onOpenAdvancedStyle,
  onMoveSong, onCopySong,
  onPlay,
  // ── Embedded mode (Song Hub) ──────────────────────────────────────────────
  // When `embedded`, the chart is rendered as the hub's Chart tab: the hub owns
  // identity/meta/actions, so ChartView suppresses its own StageHeader title/
  // meta/actions/close and instead renders only the reader body + the song-map
  // ribbon + notes peek. Transpose, displayMode and the Aa popover become
  // *controlled* by the hub (falling back to internal state when standalone).
  embedded = false,
  selectedKey: selectedKeyProp, onSelectKey,
  displayMode: displayModeProp, onDisplayMode,
  aaAnchor: aaAnchorProp, onAaClose,
  // Embedded: report the resolved playback structure + the in-view section so
  // the hub can render the song-map ribbon above the tabs (the chart no longer
  // renders its own header/ribbon when embedded).
  onReportStructure, onActiveSection,
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

  // Transpose key: controlled by the hub when embedded, otherwise internal.
  const [internalSelectedKey, setInternalSelectedKey] = useState(song?.key || 'C');
  const selectedKey = selectedKeyProp ?? internalSelectedKey;
  const setSelectedKey = onSelectKey || setInternalSelectedKey;
  // Reset transpose when the user switches arrangement (each arrangement has
  // its own source key — preserving an old selectedKey would leak the wrong
  // transposition into the new chart).
  const lastArrIdRef = useRef(activeArrId);
  useEffect(() => {
    if (lastArrIdRef.current !== activeArrId) {
      lastArrIdRef.current = activeArrId;
      if (song?.key) setSelectedKey(song.key);
    }
  }, [activeArrId, song?.key, setSelectedKey]);
  // Display options are device-global now: they live in `settings` (persisted +
  // synced) and are resolved here, falling back to the active stage-mode preset.
  // Every change writes straight back through onUpdateSettings, so a tweak on
  // one song shows up on every song and in the live / practice views too. Local
  // mirrors keep the controls snappy and re-seed when settings change.
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
  // Aa-menu column control: supports 'auto' (clears the manual override and
  // re-resolves from width) as well as explicit 1/2.
  const setColumnsPref = (v) => {
    onUpdateSettings?.('defaultColumns', v);
    if (v === 'auto') {
      userSetColumnsRef.current = false;
      setColumns(resolveColumns('auto', wantTwo));
    } else {
      userSetColumnsRef.current = true;
      setColumns(v);
    }
  };
  // Re-seed when the reading width / orientation / setting changes, unless the
  // user has overridden the column count by hand this session.
  useEffect(() => {
    if (!userSetColumnsRef.current) setColumns(resolveColumns(disp.columns, wantTwo));
  }, [disp.columns, wantTwo]);

  const [fontSize, setFontSize] = useState(disp.lyricFontSize);
  const [chordFontSize, setChordFontSize] = useState(disp.chordFontSize);
  const [notation, setNotation] = useState(disp.notation);
  const [showChords, setShowChords] = useState(disp.showChords);
  const [showDiagrams, setShowDiagrams] = useState(disp.showDiagrams);
  // Quick view mode (session-local) from the structure row:
  //   chords → chords + lyrics (+ tabs); chordsonly → chords, no lyrics/tabs;
  //   lyrics → lyrics only; tabs → tabs only.
  const [internalDisplayMode, setInternalDisplayMode] = useState('chords');
  const displayMode = displayModeProp ?? internalDisplayMode;
  const setDisplayMode = onDisplayMode || setInternalDisplayMode;
  const viewChords = displayMode === 'chords' || displayMode === 'chordsonly';
  const viewLyrics = displayMode === 'chords' || displayMode === 'lyrics';
  const viewTabs = displayMode === 'chords' || displayMode === 'tabs';

  // Does this song actually contain any tabs? Drives whether the "Tabs" view
  // option is offered at all.
  const hasTabs = useMemo(
    () => (song?.sections || []).some(s => (s.lines || []).some(l => l && typeof l === 'object' && (l.type === 'tab' || l.type === 'tabref'))),
    [song],
  );
  // If a song loses its tabs (or never had them), don't get stuck in tabs view.
  useEffect(() => {
    if (!hasTabs && displayMode === 'tabs') setDisplayMode('chords');
  }, [hasTabs, displayMode, setDisplayMode]);

  // Instruments this song's tabs are tagged for (electric / acoustic / bass).
  // When more than one is present, the reader can filter to just theirs.
  const tabInstrumentsPresent = useMemo(() => {
    const set = new Set();
    (song?.sections || []).forEach(sec => (sec.lines || []).forEach(l => {
      if (l && typeof l === 'object') {
        if (l.type === 'tab' && l.instrument) set.add(l.instrument);
        if (l.type === 'tabref' && l.tab?.instrument) set.add(l.tab.instrument);
      }
    }));
    return [...set];
  }, [song]);
  const [tabInstrument, setTabInstrument] = useState('all');
  useEffect(() => { setTabInstrument('all'); }, [song?.id]);

  // Re-seed local mirrors when the persisted display settings change — another
  // song, a role preset, or an edit made on a different surface.
  useEffect(() => {
    setFontSize(disp.lyricFontSize);
    setChordFontSize(disp.chordFontSize);
    setNotation(disp.notation);
    setShowChords(disp.showChords);
    setShowDiagrams(disp.showDiagrams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.defaultFontSize, settings?.chordFontSize, settings?.nashville, settings?.notation, settings?.showChords, settings?.showDiagrams, settings?.stageMode]);

  // Persisting helpers — update the snappy local mirror and the device setting.
  const changeFontSize = (v) => { const n = Math.max(10, Math.min(30, v)); setFontSize(n); onUpdateSettings?.('defaultFontSize', n); };
  const changeChordFontSize = (v) => { const n = Math.max(8, Math.min(30, v)); setChordFontSize(n); onUpdateSettings?.('chordFontSize', n); };
  // Reader notation: Letters / Nashville numbers / Do-Re-Mi solfège. Also writes
  // the legacy `nashville` boolean so older surfaces/prefs stay consistent.
  const changeNotation = (v) => { setNotation(v); onUpdateSettings?.('notation', v); onUpdateSettings?.('nashville', v === 'nashville'); };
  const toggleShowDiagrams = () => { const v = !showDiagrams; setShowDiagrams(v); onUpdateSettings?.('showDiagrams', v); };
  const toggleShowChords = () => { const v = !showChords; setShowChords(v); onUpdateSettings?.('showChords', v); };

  // Instrument presets (stage modes) — pick a band role and the chart switches
  // to a layout tuned for it. Writes every value through settings so the choice
  // persists across songs and carries into Practice / Live. The re-seed effect
  // above mirrors the new values into the local display state.
  const stageMode = settings?.stageMode || 'leader';
  const applyRole = (id) => {
    const preset = STAGE_MODES.find(m => m.id === id)?.settings || {};
    onUpdateSettings?.('stageMode', id);
    if (preset.lyricFontSize != null) onUpdateSettings?.('defaultFontSize', preset.lyricFontSize);
    if (preset.chordFontSize != null) onUpdateSettings?.('chordFontSize', preset.chordFontSize);
    onUpdateSettings?.('nashville', !!preset.nashville);
    onUpdateSettings?.('notation', preset.notation || (preset.nashville ? 'nashville' : 'letters'));
    onUpdateSettings?.('showChords', preset.showChords !== false);
    onUpdateSettings?.('showDiagrams', !!preset.showDiagrams);
    if (preset.showInlineNotes != null) onUpdateSettings?.('showInlineNotes', preset.showInlineNotes);
  };
  // Spacing controls (read straight from settings; the CSS vars below reflow
  // the chart live on change).
  const sectionSpacing = settings?.sectionSpacing ?? 24;
  const lyricLineHeight = settings?.lyricLineHeight ?? 1.35;
  const changeSectionSpacing = (v) => onUpdateSettings?.('sectionSpacing', Math.max(8, Math.min(64, v)));
  const changeLineHeight = (v) => onUpdateSettings?.('lyricLineHeight', Math.max(1, Math.min(2.4, Math.round(v * 100) / 100)));

  const [activeSheet, setActiveSheet] = useState(null); // 'layout' | 'music' | 'arrangements' | null
  // Aa popover anchor. Embedded: the hub owns the Aa button and passes its rect
  // down (the popover itself still lives here, keeping all the size/column/
  // notation wiring in one place). Standalone: internal state.
  const [internalAaAnchor, setInternalAaAnchor] = useState(null); // DOMRect of the Aa button, or null
  const aaAnchor = embedded ? aaAnchorProp : internalAaAnchor;
  const setAaAnchor = setInternalAaAnchor;
  const closeAa = embedded ? (onAaClose || (() => {})) : () => setInternalAaAnchor(null);
  const [showInfo, setShowInfo] = useState(false); // inline song-details panel toggled from the title chevron
  const [notesPeekOpen, setNotesPeekOpen] = useState(notesPeekDefaultOpen);

  const scrollContainerRef = useRef(null);
  // Three-row header collapse (shared with practice/live): scroll down hides
  // title+meta, scroll up / tap reveals. Off in the editor preview.
  const [headerCollapsed, , revealHeader] = useStageHeaderCollapse(scrollContainerRef, !isPreview && settings?.autoHideHeader === true);

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
  // Scroll-sync: which section is in view (drives the ribbon highlight).
  const activeSection = useActiveSection(scrollContainerRef, `${song.id}:${displayMode}:${columns}`);

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
    // "auto" songs always follow document (section) order, so Arrange edits
    // flow straight through. Only a "custom" slide order consults structure[].
    if (song.structureMode !== 'custom') return song.sections;
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
  }, [song.structure, song.structureMode, song.sections]);

  // Embedded: feed the resolved section flow + the in-view section up to the
  // hub, which owns the song-map ribbon above the tabs.
  useEffect(() => {
    if (!embedded) return;
    onReportStructure?.(orderedSections.map(s => s.type));
  }, [embedded, orderedSections, onReportStructure]);
  useEffect(() => {
    if (!embedded) return;
    onActiveSection?.(activeSection);
  }, [embedded, activeSection, onActiveSection]);

  // Cumulative modulate offsets follow playback order so a repeated
  // section after a `{modulate}` block plays back in the new key.
  // User tab palette — only include keys the user actually set so TabBlock's
  // defaults still apply for the rest.
  const tabColors = useMemo(() => {
    const out = {};
    if (settings?.tabStringColor) { out.line = settings.tabStringColor; out.label = settings.tabStringColor; }
    if (settings?.tabNumberColor) out.number = settings.tabNumberColor;
    if (settings?.tabBg) out.bg = settings.tabBg;
    return out;
  }, [settings?.tabStringColor, settings?.tabNumberColor, settings?.tabBg]);

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

  // Condensed repeats: for each playback slot, the index of the first occurrence
  // it duplicates, or -1 when it's the first/only occurrence. A repeat only
  // condenses when its chords render identically to the first — i.e. the same
  // section id AND the same cumulative modulate offset (a repeat after a key
  // change has different chords and must render in full).
  const repeatFirstIndex = useMemo(() => {
    const firstSeen = new Map();
    return orderedSections.map((section, idx) => {
      const key = section.id || normalizeSectionName(section.type);
      const prior = firstSeen.get(key);
      if (prior != null && prior.mod === sectionModOffsets[idx]) return prior.idx;
      if (prior == null) firstSeen.set(key, { idx, mod: sectionModOffsets[idx] });
      return -1;
    });
  }, [orderedSections, sectionModOffsets]);

  // Extract all unique chords for diagrams
  const allChords = Array.from(new Set(
    song.sections.flatMap(s => s.lines)
      .filter(l => typeof l === 'string')
      .flatMap(l => {
        const matches = l.match(/\[(.*?)\]/g);
        return matches ? matches.map(m => m.slice(1, -1)) : [];
      })
  ));

  // Song details body — shown inline in the header (toggled by the title
  // chevron). Shared with the Song Hub's Details tab via SongDetails.
  const songInfoBody = <SongDetails song={song} />;

  // Where the structure ribbon lives (Labs → floating positions). Previews
  // always keep it in the header. Non-top placements render a floating overlay
  // (FloatingStructure) and drop the ribbon from the header.
  const structurePos = isPreview ? 'top' : (settings?.structurePosition || 'top');
  const ribbonSide = structurePos === 'left' || structurePos === 'right';
  // One appearance setting (ribbonStyle) drives both the header and floating
  // ribbon. Side rails stack vertically and spell out repeats.
  const ribbonNode = (
    <StructureRibbon
      structure={orderedSections.map(s => s.type)}
      compact
      orientation={ribbonSide ? 'vertical' : 'horizontal'}
      collapse={!ribbonSide}
      activeIndex={activeSection}
      style={settings?.ribbonStyle || 'codes'}
      sectionColors={settings?.sectionColors}
      sectionLabels={settings?.sectionLabels}
      customSectionTypes={settings?.customSectionTypes}
      onSelect={(i) => {
        const el = document.getElementById(`section-${i}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }}
    />
  );

  return (
    <div
      ref={scrollContainerRef}
      onClick={isPreview ? undefined : revealHeader}
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
      {!isPreview && !embedded && (
        <StageHeader
          collapsed={headerCollapsed}
          onExpand={revealHeader}
          actionsInTitle
          close={embedded ? null : (
            <>
              <OverflowMenu
                ariaLabel="Song actions"
                items={[
                  // View mode lives in the kebab now (folded out of the header).
                  { heading: true, label: 'View' },
                  ...VIEW_MODES.filter(m => m.id !== 'tabs' || hasTabs).map(m => ({
                    label: m.label,
                    selected: displayMode === m.id,
                    onClick: () => setDisplayMode(m.id),
                  })),
                  { divider: true },
                  onPlay && !isPreview && {
                    label: 'Play (live)',
                    icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>),
                    onClick: () => onPlay(activeArrId),
                  },
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
                    icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>),
                    onClick: () => onEdit(activeArrId),
                  },
                  onMoveSong && {
                    label: 'Move to…',
                    icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>),
                    onClick: () => onMoveSong(),
                  },
                  onCopySong && {
                    label: 'Copy to…',
                    icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>),
                    onClick: () => onCopySong(),
                  },
                  onToggleFullscreen && {
                    label: isFullscreen ? 'Exit fullscreen' : 'Fullscreen',
                    icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8V3h5" /><path d="M21 8V3h-5" /><path d="M3 16v5h5" /><path d="M21 16v5h-5" /></svg>),
                    onClick: onToggleFullscreen,
                  },
                ]}
              />
              {onBack && (
                <IconButton variant="ghost" size="sm" onClick={onBack} aria-label="Close">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </IconButton>
              )}
            </>
          )}
          title={embedded ? null : (
            <button
              type="button"
              onClick={() => setShowInfo(v => !v)}
              aria-expanded={showInfo}
              aria-label="Song details"
              className="min-w-0 flex-1 flex items-center gap-1.5 bg-transparent border-none cursor-pointer p-0 text-left"
            >
              <h1 className="m-0 truncate font-bold leading-tight text-heading-18 sm:text-heading-20" style={{ color: 'var(--text-1)' }}>
                {song.title}
              </h1>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 self-center text-[var(--text-2)] transition-transform duration-200 ${showInfo ? 'rotate-180' : ''}`}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          )}
          meta={embedded ? null : (
            // One muted, compact meta line: values sit in --text-1, labels/units
            // and the dot separators stay muted so the title clearly outranks it.
            <div className="flex items-center gap-1 min-w-0 text-label-11 sm:text-label-13 text-[var(--text-2)]">
              {/* The key list + the shown value follow the Accidentals setting
                  (sharps → F♯/C♯, otherwise flats) so they match the chords. */}
              <Select value={transposeKey(selectedKey, 0, settings?.accidentals === 'sharps') || selectedKey} onValueChange={setSelectedKey}>
                <SelectTrigger className="h-6 px-1 -ml-1 border-none bg-transparent hover:bg-[var(--bg-2)] rounded-md text-label-11 sm:text-label-13 font-semibold text-[var(--text-1)] gap-0.5 min-w-0 w-auto focus:ring-0" aria-label="Key">
                  <span className="text-[var(--text-2)] font-normal mr-0.5">Key</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {keysInQualityOf(song.key, settings?.accidentals).map(k => (<SelectItem key={k} value={k}>{k}</SelectItem>))}
                </SelectContent>
              </Select>
              {song.tempo && (
                <>
                  <span aria-hidden className="opacity-50">·</span>
                  <span className="whitespace-nowrap"><span className="font-semibold text-[var(--text-1)]">{song.tempo}</span><span className="ml-0.5">bpm</span></span>
                </>
              )}
              {song.time && (
                <>
                  <span aria-hidden className="opacity-50">·</span>
                  <span className="whitespace-nowrap font-semibold text-[var(--text-1)]">{song.time}</span>
                </>
              )}
              {song._arrangementId && (song._allArrangements?.length || 0) > 1 && (
                <>
                  <span aria-hidden className="opacity-50">·</span>
                  <Select value={activeArrId} onValueChange={handleSwitchArrangement}>
                    <SelectTrigger className="h-6 px-1 border-none bg-transparent hover:bg-[var(--bg-2)] rounded-md text-label-11 sm:text-label-13 font-semibold text-[var(--text-1)] gap-0.5 max-w-[110px] sm:max-w-[200px] min-w-0 w-auto focus:ring-0" aria-label="Switch arrangement">
                      <span className="truncate">{song._allArrangements.find(a => a.id === activeArrId)?.name || 'Arrangement'}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {song._allArrangements.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="inline-flex items-center gap-1.5">
                            {a.id === song._defaultArrangementId && (<span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" title="Default" aria-label="Default" />)}
                            {a.name || 'Untitled arrangement'}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          )}
          actions={embedded ? null : (
            <div className="flex items-center gap-0.5">
              {/* One "Aa" control — opens the tabbed display popover (Lyrics /
                  Chords / Page). The old Display + Layout sheets remain as the
                  "Advanced" backstop, reachable from the popover's Page tab. */}
              <IconButton
                variant="ghost"
                size="sm"
                aria-label="Display options"
                aria-expanded={!!aaAnchor}
                onClick={(e) => setAaAnchor(aaAnchor ? null : e.currentTarget.getBoundingClientRect())}
              >
                <span className="text-label-14 font-bold leading-none">Aa</span>
              </IconButton>
            </div>
          )}
          ribbon={structurePos === 'top' ? ribbonNode : null}
          info={!embedded && showInfo && (
            <div className="wide-container pb-2 mt-1 max-h-[40vh] overflow-y-auto border-t border-[var(--border-1)] pt-2">
              {songInfoBody}
            </div>
          )}
          extras={(
            <>
              {song.notes && (
                <div className="wide-container pb-2">
                  {notesPeekOpen ? (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-[var(--ds-gray-300)] bg-[var(--ds-gray-alpha-100)]">
                      <span className="shrink-0 mt-0.5 text-[var(--ds-gray-600)]" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h6" /><path d="M8 17h4" />
                        </svg>
                      </span>
                      <p className="flex-1 m-0 text-copy-13 text-[var(--text-1)] whitespace-pre-wrap">{song.notes}</p>
                      <button type="button" onClick={() => setNotesPeekOpen(false)} aria-label="Hide notes" className="shrink-0 text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-1000)] -mr-1 -mt-1 px-1 py-0.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setNotesPeekOpen(true)} aria-label="Show song notes" aria-expanded="false" className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full border border-[var(--ds-gray-300)] bg-[var(--ds-gray-alpha-100)] text-label-11 text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)] hover:text-[var(--ds-gray-1000)] transition-colors">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
                      Notes
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        />
      )}

      {/* ── Aa display popover (single header control) ── */}
      {!isPreview && aaAnchor && (
        <AaMenu
          anchorRect={aaAnchor}
          onClose={closeAa}
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          lyricSize={fontSize}
          onLyricSize={changeFontSize}
          chordSize={chordFontSize}
          onChordSize={changeChordFontSize}
          columns={settings?.defaultColumns ?? 'auto'}
          onColumns={setColumnsPref}
          notation={notation}
          onNotation={changeNotation}
          showChords={showChords}
          onToggleChords={toggleShowChords}
          showDiagrams={showDiagrams}
          onToggleDiagrams={toggleShowDiagrams}
          onAdvanced={() => openSheet('layout')}
        />
      )}

      {/* ── Bottom-sheet modals (Layout / Music / Song info) ── */}
      {!isPreview && (
        <>
          {/* ── Layout menu — how it's arranged (columns, sizes, spacing, style) ── */}
          <BottomSheet
            open={activeSheet === 'layout'}
            onClose={() => setActiveSheet(null)}
            title="Layout"
          >
            <div className="flex flex-col gap-4">
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

              <SheetField label="Spacing">
                <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-label-10 uppercase tracking-wider text-[var(--text-2)]">Section gap</span>
                    <div className="flex items-center bg-[var(--bg-1)] border border-[var(--border-1)] rounded-lg p-0.5 w-fit">
                      <IconButton variant="ghost" size="sm" onClick={() => changeSectionSpacing(sectionSpacing - 4)} aria-label="Less section gap">−</IconButton>
                      <span className="w-8 text-center text-label-12-mono text-[var(--text-1)] font-semibold tabular-nums">{sectionSpacing}</span>
                      <IconButton variant="ghost" size="sm" onClick={() => changeSectionSpacing(sectionSpacing + 4)} aria-label="More section gap">+</IconButton>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-label-10 uppercase tracking-wider text-[var(--text-2)]">Line height</span>
                    <div className="flex items-center bg-[var(--bg-1)] border border-[var(--border-1)] rounded-lg p-0.5 w-fit">
                      <IconButton variant="ghost" size="sm" onClick={() => changeLineHeight(lyricLineHeight - 0.1)} aria-label="Tighter line height">−</IconButton>
                      <span className="w-8 text-center text-label-12-mono text-[var(--text-1)] font-semibold tabular-nums">{lyricLineHeight.toFixed(2)}</span>
                      <IconButton variant="ghost" size="sm" onClick={() => changeLineHeight(lyricLineHeight + 0.1)} aria-label="Looser line height">+</IconButton>
                    </div>
                  </div>
                </div>
              </SheetField>

              <SheetField label="Repeated sections">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'full', label: 'Full' },
                    { id: 'condensed', label: 'Condensed' },
                  ].map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => onUpdateSettings?.('duplicateSections', b.id)}
                      aria-pressed={duplicateSections === b.id}
                      className={`px-3 h-8 rounded-lg border text-label-12 font-semibold cursor-pointer transition-colors ${duplicateSections === b.id ? 'border-[var(--color-brand)] text-[var(--color-brand)] bg-[var(--color-brand-soft)]' : 'border-[var(--border-1)] text-[var(--text-1)] bg-[var(--bg-1)] hover:border-[var(--border-3)]'}`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </SheetField>

              <SheetField label="Instrument">
                <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 py-0.5">
                  {STAGE_MODES.map(m => {
                    const active = stageMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => applyRole(m.id)}
                        title={m.description}
                        className={cn(
                          'shrink-0 px-3 h-8 rounded-lg border transition-all text-label-12 font-semibold',
                          active
                            ? 'border-[var(--color-brand)] text-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                            : 'border-[var(--border-1)] text-[var(--text-1)] bg-[var(--bg-1)] hover:border-[var(--border-3)]',
                        )}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </SheetField>

              {tabInstrumentsPresent.length >= 2 && (
                <SheetField label="Tab instrument">
                  <div className="flex flex-wrap gap-2">
                    {['all', ...tabInstrumentsPresent].map(id => (
                      <Button
                        key={id}
                        variant={tabInstrument === id ? 'brand' : 'secondary'}
                        size="sm"
                        onClick={() => setTabInstrument(id)}
                      >
                        {id === 'all' ? 'All' : (TAB_INSTRUMENTS[id]?.label || id)}
                      </Button>
                    ))}
                  </div>
                </SheetField>
              )}

              <div className="pt-1 border-t border-[var(--border-1)]">
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
                    className="mt-3 w-full h-11 rounded-xl bg-[var(--ds-background-100)] border border-[var(--border-1)] text-copy-14 font-semibold text-[var(--text-1)] flex items-center justify-center gap-2 hover:bg-[var(--bg-1)] transition-all"
                    style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)' }}
                  >
                    Advanced settings
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </BottomSheet>

          {/* Arrangement add/rename/delete now lives in the editor only.
              The chart view's dropdown above handles read-only switching. */}

        </>
      )}

      <div className={cn(
        "pt-4 pb-24 wide-container",
        structurePos === 'bottom' && "pb-[8rem]",
        isPreview && "px-0 pt-0 pb-0 wide-container"
      )}>
        {/* ── Chord Diagrams Strip ── */}
        {showDiagrams && !isPreview && (
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-8 mb-8 border-b border-[var(--border-1)]">
            {allChords.map(chord => (
              <div key={chord} className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className="text-label-12-mono font-bold text-[var(--text-1)]">{transposeChord(chord, transpose)}</div>
                <Card className="w-24 h-24 flex items-center justify-center p-2" style={{ background: '#f7f5f1', borderColor: '#e4e0d8' }}>
                   <ChordDiagram chord={transposeChord(chord, transpose)} />
                </Card>
              </div>
            ))}
          </div>
        )}

        {/* ── Sections ── */}
        <div
          data-print-target="chart"
          className={displayMode !== 'songmap' && chartLayout === 'rows' && columns === 2 ? "grid grid-cols-2 gap-x-12 items-start" : undefined}
          style={{
            fontSize,
            ['--chart-font-size-lyric']: `${fontSize}px`,
            ['--chart-font-size-chord']: `${chordFontSize}px`,
            ['--chart-line-height-lyric']: settings?.lyricLineHeight ?? 1.35,
            ['--chart-section-gap']: `${settings?.sectionSpacing ?? 24}px`,
            // Lyrics inherit this; chords (font-bold) + section headers keep
            // their own weight. 400 read too thin — bump to a medium.
            fontWeight: 'var(--chart-lyric-weight, 480)',
            fontFamily: 'var(--chart-font-lyric, var(--font-sans))',
            ...(displayMode !== 'songmap' && (chartLayout !== 'rows' || columns !== 2) ? { columnCount: columns, columnGap: '3rem' } : {}),
          }}
        >
          {displayMode === 'songmap' ? (
            <SongMap
              sections={orderedSections}
              modOffsets={sectionModOffsets}
              transpose={transpose}
              sectionColors={settings?.sectionColors}
              sectionLabels={settings?.sectionLabels}
              customSectionTypes={settings?.customSectionTypes}
              onSelect={(i) => {
                setDisplayMode('chords');
                requestAnimationFrame(() => {
                  const el = document.getElementById(`section-${i}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
              }}
            />
          ) : orderedSections.map((section, idx) => (
            <div
              key={`${section.id || section.type}-${idx}`}
              id={`section-${idx}`}
              data-section-index={idx}
              style={{ scrollMarginTop: '10rem', breakInside: 'avoid' }}
            >
              <SectionBlock
                section={section}
                transpose={transpose}
                modOffset={sectionModOffsets[idx]}
                notation={notation}
                songKey={song.key}
                accidentals={settings?.accidentals}
                condensed={duplicateSections === 'condensed' && repeatFirstIndex[idx] >= 0}
                onJumpToFirst={() => {
                  const el = document.getElementById(`section-${repeatFirstIndex[idx]}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                showChords={showChords && viewChords}
                showLyrics={viewLyrics}
                showTabs={viewTabs}
                tabInstrument={tabInstrument}
                chordEmphasis={settings?.stageMode === 'bassist' ? 'root' : 'full'}
                inlineNotes={showInlineNotes}
                noteStyle={inlineNoteStyle}
                sectionColors={settings?.sectionColors}
                sectionLabels={settings?.sectionLabels}
                customSectionTypes={settings?.customSectionTypes}
                tabScale={settings?.tabSize || 1}
                tabColors={tabColors}
              />
            </div>
          ))}
        </div>
      </div>
      {!embedded && structurePos !== 'top' && (
        <FloatingStructure position={structurePos} raised={false}>{ribbonNode}</FloatingStructure>
      )}
    </div>
  );
}

