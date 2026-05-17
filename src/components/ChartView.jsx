import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HexColorPicker } from 'react-colorful';
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
import { StructureRibbon } from './StructureRibbon';
import { exportSongPdf } from '../pdf/exportSongPdf';
import { headerFrostStyle } from '../lib/headerFrost';
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

const FONT_SIZES = { S: 14, M: 18, L: 22 };

const FONT_FAMILIES = {
  'Geist Sans': "var(--font-sans)",
  'Geist Mono': "var(--font-mono)",
  'JetBrains Mono': "'JetBrains Mono', monospace",
};

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
  defaultColumns = 1, defaultFontSize = 16,
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
  const [columns, setColumns] = useState(defaultColumns);
  const [fontSize, setFontSize] = useState(initialFontSize);
  const [chordFontSize, setChordFontSize] = useState(() => Math.round(initialFontSize * 0.95));
  const [fontFamily, setFontFamily] = useState('Geist Mono');
  const [nns, setNns] = useState(false);
  const [showChords, setShowChords] = useState(true);
  const [showDiagrams, setShowDiagrams] = useState(false);
  const [activeSheet, setActiveSheet] = useState(null); // 'layout' | 'music' | 'info' | 'arrangements' | null
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [notesPeekOpen, setNotesPeekOpen] = useState(notesPeekDefaultOpen);

  const scrollContainerRef = useRef(null);
  const menuTriggerRef = useRef(null);
  const menuPanelRef = useRef(null);

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

  // Close the kebab menu on outside click and Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e) => {
      const t = menuTriggerRef.current;
      const p = menuPanelRef.current;
      if (t && t.contains(e.target)) return;
      if (p && p.contains(e.target)) return;
      setMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const openSheet = (name) => { setActiveSheet(name); setMenuOpen(false); };
  const runAndClose = (fn) => { fn?.(); setMenuOpen(false); };

  // Detect scroll position for collapsing header
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 40);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
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
  const hasMetadata = !!song.artist || song.capo > 0 || !!song.ccli || (song.tags?.length > 0) || !!song.notes || !!song.spotify || !!song.youtube;

  return (
    <div
      ref={scrollContainerRef}
      style={isPreview ? undefined : CHART_THEME_STYLE}
      className={cn(
        "h-screen overflow-y-auto overflow-x-hidden",
        isPreview && "h-auto overflow-visible bg-transparent"
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
            ...headerFrostStyle,
            color: 'var(--text-1)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {/* Line 1: Hero title (shrinks on scroll) + close + dot menu. */}
          <div className="a4-container flex items-center justify-between gap-3 pt-3 pb-0.5">
            <div className="min-w-0 flex-1 flex items-baseline gap-3">
              <h1
                className={cn(
                  "m-0 truncate transition-all duration-200 font-bold leading-tight",
                  scrolled ? "text-heading-16" : "text-heading-32",
                )}
                style={{ color: 'var(--text-1)' }}
              >
                {song.title}
              </h1>
              {/* Inline meta — visible only in compact mode. */}
              {scrolled && (
                <div className="flex items-center gap-2 flex-shrink-0 text-label-12" style={{ color: 'var(--text-2)' }}>
                  <span aria-hidden="true">·</span>
                  <span className="font-bold" style={{ color: 'var(--text-1)' }}>{selectedKey}</span>
                  {song.tempo && <span>{song.tempo} bpm</span>}
                  {song.time && <span>{song.time}</span>}
                </div>
              )}
            </div>
            <div className="flex gap-0.5 items-center flex-shrink-0">
              <div className="relative">
                <IconButton
                  ref={menuTriggerRef}
                  variant="ghost"
                  size="sm"
                  onClick={() => setMenuOpen(o => !o)}
                  aria-label="More options"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="12" cy="5" r="1.6" />
                    <circle cx="12" cy="12" r="1.6" />
                    <circle cx="12" cy="19" r="1.6" />
                  </svg>
                </IconButton>
                {menuOpen && (
                  <div
                    ref={menuPanelRef}
                    role="menu"
                    className="absolute z-40 right-0 mt-1 min-w-[220px] rounded-xl bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-150"
                  >
                    <MenuItem
                      onClick={() => openSheet('layout')}
                      label="Layout"
                      icon={<span className="text-label-12 font-semibold">Aa</span>}
                    />
                    <MenuItem
                      onClick={() => openSheet('info')}
                      label="Song info"
                      icon={(
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 16v-4" />
                          <path d="M12 8h.01" />
                        </svg>
                      )}
                    />
                    <div className="my-1 h-px bg-[var(--border-1)]" />
                    <MenuItem
                      onClick={() => runAndClose(() => exportSongPdf(song, { transpose }))}
                      label="Print / Save as PDF"
                      icon={(
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 6 2 18 2 18 9" />
                          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                          <rect x="6" y="14" width="12" height="8" />
                        </svg>
                      )}
                    />
                    <MenuItem
                      onClick={() => runAndClose(onEdit)}
                      label="Edit"
                      icon={(
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                      )}
                    />
                    {onToggleFullscreen && (
                      <MenuItem
                        onClick={() => runAndClose(onToggleFullscreen)}
                        label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                        icon={isFullscreen ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M8 3v4a1 1 0 0 1-1 1H3" />
                            <path d="M21 8h-4a1 1 0 0 1-1-1V3" />
                            <path d="M3 16h4a1 1 0 0 1 1 1v4" />
                            <path d="M16 21v-4a1 1 0 0 1 1-1h4" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 8V3h5" />
                            <path d="M21 8V3h-5" />
                            <path d="M3 16v5h5" />
                            <path d="M21 16v5h-5" />
                          </svg>
                        )}
                      />
                    )}
                  </div>
                )}
              </div>
              <IconButton variant="ghost" size="sm" onClick={onBack} aria-label="Close">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </IconButton>
            </div>
          </div>

          {/* Line 2: Arrangement + Key / Tempo / Time — collapses when scrolled */}
          <div className={cn(
            "a4-container flex flex-wrap items-center gap-3 transition-all duration-200 overflow-hidden",
            scrolled ? "max-h-0 opacity-0 pb-0" : "max-h-12 opacity-100 pb-1.5"
          )}>
            {song._arrangementId && (song._allArrangements?.length || 0) > 1 ? (
              <>
                <Select value={activeArrId} onValueChange={handleSwitchArrangement}>
                  <SelectTrigger
                    className="h-7 px-1.5 border-transparent bg-transparent hover:bg-[var(--bg-2)] text-label-13 font-semibold text-[var(--text-1)] gap-1.5 max-w-[200px] w-auto focus:ring-0"
                    aria-label="Switch arrangement"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {song._allArrangements.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name || 'Untitled arrangement'}
                        {a.id === song._defaultArrangementId && (
                          <span className="ml-1.5 text-label-10 text-[var(--text-2)]">default</span>
                        )}
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

          {/* Structure ribbon — always visible */}
          <div className="a4-container pb-2">
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

          {/* Song notes peek strip — collapsible, hidden when song has no notes */}
          {song.notes && (
            <div className="a4-container pb-2">
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
              <SheetField label="Display">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={nns ? 'brand' : 'secondary'}
                    size="sm"
                    onClick={() => setNns(!nns)}
                  >NUMBERS</Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowChords(!showChords)}
                    className={cn(!showChords && "opacity-40")}
                  >CHORDS</Button>
                  <Button
                    variant={showDiagrams ? 'brand' : 'secondary'}
                    size="sm"
                    onClick={() => setShowDiagrams(!showDiagrams)}
                  >DIAGRAMS</Button>
                </div>
              </SheetField>

              <div className="flex flex-wrap items-end gap-4">
                <SheetField label="Columns">
                  <SegmentedControl
                    value={columns}
                    onChange={setColumns}
                    options={[
                      { value: 1, label: '1 COL' },
                      { value: 2, label: '2 COL' },
                    ]}
                    size="sm"
                  />
                </SheetField>
                <SheetField label="Lyric size">
                  <div className="flex items-center bg-[var(--bg-1)] border border-[var(--border-1)] rounded-lg p-0.5 w-fit">
                    <IconButton variant="ghost" size="sm" onClick={() => setFontSize(prev => Math.max(10, prev - 2))} aria-label="Decrease lyric size">−</IconButton>
                    <span className="px-2 text-label-12-mono text-[var(--text-1)] font-semibold">{fontSize}px</span>
                    <IconButton variant="ghost" size="sm" onClick={() => setFontSize(prev => Math.min(30, prev + 2))} aria-label="Increase lyric size">+</IconButton>
                  </div>
                </SheetField>
                <SheetField label="Chord size">
                  <div className="flex items-center bg-[var(--bg-1)] border border-[var(--border-1)] rounded-lg p-0.5 w-fit">
                    <IconButton variant="ghost" size="sm" onClick={() => setChordFontSize(prev => Math.max(8, prev - 2))} aria-label="Decrease chord size">−</IconButton>
                    <span className="px-2 text-label-12-mono text-[var(--text-1)] font-semibold">{chordFontSize}px</span>
                    <IconButton variant="ghost" size="sm" onClick={() => setChordFontSize(prev => Math.min(30, prev + 2))} aria-label="Increase chord size">+</IconButton>
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

          <BottomSheet
            open={activeSheet === 'info'}
            onClose={() => setActiveSheet(null)}
            title="Song info"
          >
            {hasMetadata ? (
              <dl className="flex flex-col gap-3 text-copy-14 m-0">
                {song.artist && (
                  <InfoRow label="Artist">{song.artist}</InfoRow>
                )}
                {song.tempo && (
                  <InfoRow label="Tempo">{song.tempo} bpm</InfoRow>
                )}
                {song.time && (
                  <InfoRow label="Time">{song.time}</InfoRow>
                )}
                {song.capo > 0 && (
                  <InfoRow label="Capo">{song.capo}</InfoRow>
                )}
                {song.ccli && (
                  <InfoRow label="CCLI">{song.ccli}</InfoRow>
                )}
                {song.tags?.length > 0 && (
                  <InfoRow label="Tags">{song.tags.join(', ')}</InfoRow>
                )}
                {song.notes && (
                  <InfoRow label="Notes">
                    <span className="whitespace-pre-wrap">{song.notes}</span>
                  </InfoRow>
                )}
                {song.spotify && (
                  <InfoRow label="Spotify">
                    <a href={song.spotify} target="_blank" rel="noopener noreferrer" className="text-[var(--color-brand-text)] hover:underline">
                      Open ↗
                    </a>
                  </InfoRow>
                )}
                {song.youtube && (
                  <InfoRow label="YouTube">
                    <a href={song.youtube} target="_blank" rel="noopener noreferrer" className="text-[var(--color-brand-text)] hover:underline">
                      Open ↗
                    </a>
                  </InfoRow>
                )}
              </dl>
            ) : (
              <p className="text-copy-14 text-[var(--text-2)] italic m-0">No additional song info</p>
            )}
          </BottomSheet>
        </>
      )}

      <div className={cn(
        "pt-4 pb-24 a4-container",
        isPreview && "px-0 pt-0 pb-0 a4-container"
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
            fontFamily: FONT_FAMILIES[fontFamily],
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
                showChords={showChords}
                inlineNotes={showInlineNotes}
                noteStyle={inlineNoteStyle}
                sectionColors={settings?.sectionColors}
                sectionLabels={settings?.sectionLabels}
                customSectionTypes={settings?.customSectionTypes}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MenuItem({ onClick, icon, label }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 text-left text-copy-14 text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-100)] transition-colors"
    >
      <span className="inline-flex items-center justify-center w-5 text-[var(--ds-gray-700)]" aria-hidden="true">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
    </button>
  );
}

function SheetField({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-label-12 font-semibold uppercase tracking-wide text-[var(--text-2)]">{label}</span>
      {children}
    </div>
  );
}

function InfoRow({ label, children }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-label-12 font-semibold uppercase tracking-wide text-[var(--text-2)] pt-0.5">{label}</dt>
      <dd className="flex-1 m-0 text-[var(--text-1)]">{children}</dd>
    </div>
  );
}

function BottomSheet({ open, onClose, title, children }) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef(0);

  // When the sheet reopens, reset any leftover drag offset from the previous
  // close — otherwise dragging it down past the threshold leaves dragY > 120
  // baked into state and the next open renders translated halfway down the
  // screen.
  useEffect(() => {
    if (open) {
      setDragY(0);
      setDragging(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const onTouchStart = (e) => {
    startYRef.current = e.touches[0].clientY;
    setDragging(true);
  };
  const onTouchMove = (e) => {
    const dy = e.touches[0].clientY - startYRef.current;
    setDragY(dy > 0 ? dy : 0);
  };
  const onTouchEnd = () => {
    setDragging(false);
    if (dragY > 120) {
      onClose?.();
    } else {
      setDragY(0);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[200] flex items-end justify-center animate-in fade-in duration-150"
    >
      <div
        className="absolute inset-0 bg-black/20"
        onClick={() => onClose?.()}
      />
      <div
        className="relative w-full sm:max-w-[640px] bg-[var(--ds-background-100)] border-t border-x border-[var(--ds-gray-400)] rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom-8 duration-200 flex flex-col"
        style={{
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          maxHeight: '85vh',
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? 'none' : 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div
          className="pt-2 pb-3 px-5 cursor-grab active:cursor-grabbing select-none"
          style={{ touchAction: 'none' }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          <div className="flex justify-center pb-2">
            <span className="block w-10 h-1 rounded-full bg-[var(--ds-gray-400)]" aria-hidden="true" />
          </div>
          <h2 className="text-heading-18 font-semibold text-[var(--ds-gray-1000)] m-0">{title}</h2>
        </div>
        <div className="px-5 pb-4 overflow-y-auto flex-1 min-h-0">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Chart Style controls (themes / fonts / chord colour) ────────────────
// Rendered inside the Layout bottom sheet. Gated behind the chart-style
// entitlement so free users see a soft upgrade nudge instead of the
// pickers themselves.

function ChartStyleControls({ settings, onUpdateSettings }) {
  const { allowed } = useEntitlement('chart-style');
  const update = (k, v) => onUpdateSettings?.(k, v);

  const themeId = settings?.chartTheme || DEFAULT_CHART_THEME_ID;
  const customThemes = settings?.customChartThemes || [];
  const allThemes = [...CHART_THEMES, ...customThemes];
  const preset = allThemes.find(t => t.id === themeId) || CHART_THEME_MAP[DEFAULT_CHART_THEME_ID];
  const activeCustom = customThemes.find(t => t.id === themeId);
  const isCustom = !!activeCustom;

  // Colours come straight from whichever theme record is active (preset
  // or custom). On built-ins they're read-only; on custom we mutate the
  // record in place so colour changes persist to the saved theme.
  const bgColor = preset.bg;
  const lyricColor = preset.text;
  const chordColor = preset.chord;

  const patchActive = (patch) => {
    if (!activeCustom) return;
    update('customChartThemes', customThemes.map(t => t.id === activeCustom.id ? { ...t, ...patch } : t));
  };
  const duplicateActive = () => {
    const id = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    update('customChartThemes', [
      ...customThemes,
      { id, name: `${preset.name} (custom)`, bg: preset.bg, text: preset.text, chord: preset.chord, subtle: preset.subtle },
    ]);
    update('chartTheme', id);
  };

  const chordFontId = settings?.chartChordFont || DEFAULT_CHORD_FONT_ID;
  const lyricFontId = settings?.chartLyricFont || DEFAULT_LYRIC_FONT_ID;
  const chordFont = CHART_FONT_MAP[chordFontId];
  const lyricFont = CHART_FONT_MAP[lyricFontId];

  // Only one colour picker open at a time so the sheet doesn't stretch
  // past the viewport and trap the user above the next field.
  const [openColor, setOpenColor] = useState(null); // 'bg' | 'text' | 'chord' | null

  if (!allowed) {
    return (
      <SheetField label="Style (Pro)">
        <div className="text-copy-13 text-[var(--text-2)]">
          Upgrade to Pro to unlock themes, custom fonts for chords and lyrics, and a chord colour picker.
        </div>
      </SheetField>
    );
  }

  return (
    <>
      <SheetField label="Theme">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {allThemes.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => update('chartTheme', t.id)}
              className="shrink-0 flex flex-col items-stretch rounded-lg overflow-hidden border transition-all"
              style={{
                borderColor: themeId === t.id ? 'var(--color-brand)' : 'var(--border-1)',
                boxShadow: themeId === t.id ? '0 0 0 2px var(--color-brand)' : 'none',
                width: 96,
              }}
              aria-label={`Theme: ${t.name}`}
              title={t.name}
            >
              <div
                className="h-10 flex items-end justify-end px-2 py-1"
                style={{ background: t.bg, color: t.chord, fontFamily: 'var(--font-mono)' }}
              >
                <span className="text-label-11 font-bold">Am</span>
              </div>
              <div className="px-2 py-1 text-label-11 font-medium text-[var(--text-1)] truncate" style={{ background: 'var(--bg-1)' }}>
                {t.name}
              </div>
            </button>
          ))}
        </div>
      </SheetField>

      <div className="flex flex-wrap items-end gap-4">
        <SheetField label="Chord font">
          <Select value={chordFontId} onValueChange={(v) => update('chartChordFont', v)}>
            <SelectTrigger className="h-9 px-3 text-label-13 font-medium text-[var(--text-1)] gap-1 min-w-[180px] w-auto">
              <SelectValue>
                <span style={{ fontFamily: chordFont?.stack }}>{chordFont?.name || 'System'}</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CHART_FONTS.map(f => (
                <SelectItem key={f.id} value={f.id}>
                  <span style={{ fontFamily: f.stack }}>{f.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SheetField>

        <SheetField label="Lyric font">
          <Select value={lyricFontId} onValueChange={(v) => update('chartLyricFont', v)}>
            <SelectTrigger className="h-9 px-3 text-label-13 font-medium text-[var(--text-1)] gap-1 min-w-[180px] w-auto">
              <SelectValue>
                <span style={{ fontFamily: lyricFont?.stack }}>{lyricFont?.name || 'System'}</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CHART_FONTS.map(f => (
                <SelectItem key={f.id} value={f.id}>
                  <span style={{ fontFamily: f.stack }}>{f.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SheetField>
      </div>

      {isCustom ? (
        <>
          <SheetField label="Colours">
            <div className="grid grid-cols-3 gap-2">
              <ColorSwatchButton
                label="Background"
                color={bgColor}
                open={openColor === 'bg'}
                onToggle={() => setOpenColor(o => o === 'bg' ? null : 'bg')}
              />
              <ColorSwatchButton
                label="Lyric"
                color={lyricColor}
                open={openColor === 'text'}
                onToggle={() => setOpenColor(o => o === 'text' ? null : 'text')}
              />
              <ColorSwatchButton
                label="Chord"
                color={chordColor}
                open={openColor === 'chord'}
                onToggle={() => setOpenColor(o => o === 'chord' ? null : 'chord')}
              />
            </div>
          </SheetField>
          {openColor && (
            <InlineColorPicker
              color={openColor === 'bg' ? bgColor : openColor === 'text' ? lyricColor : chordColor}
              onChange={(v) => patchActive(
                openColor === 'bg' ? { bg: v }
                : openColor === 'text' ? { text: v }
                : { chord: v }
              )}
              onClose={() => setOpenColor(null)}
            />
          )}
        </>
      ) : (
        <SheetField label="Colours">
          <div className="flex flex-col gap-2 items-start">
            <span className="text-label-12 text-[var(--text-2)]">
              Built-in themes are read-only.
            </span>
            <Button size="sm" variant="secondary" onClick={duplicateActive}>
              Customise {preset.name}…
            </Button>
          </div>
        </SheetField>
      )}
    </>
  );
}

function ColorSwatchButton({ label, color, open, onToggle }) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <button
        type="button"
        onClick={onToggle}
        className="h-9 w-full rounded-lg border transition-all"
        style={{ background: color, borderColor: open ? 'var(--color-brand)' : 'var(--border-1)' }}
        aria-label={`Pick ${label.toLowerCase()} colour`}
      />
      <span className="text-label-10 text-[var(--text-2)] uppercase tracking-wider truncate">{label}</span>
    </div>
  );
}

function InlineColorPicker({ color, onChange, onClose }) {
  return (
    <div className="px-1 pb-1 -mt-2 flex flex-col gap-2 items-end">
      <HexColorPicker
        color={color}
        onChange={onChange}
        style={{ width: '100%', height: 180 }}
      />
      <div className="flex items-center gap-2 self-stretch">
        <span className="text-label-11 text-[var(--text-2)] uppercase tracking-wider">Hex</span>
        <input
          type="text"
          value={color}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (/^#?[0-9a-fA-F]{6}$/.test(v)) onChange(v.startsWith('#') ? v : `#${v}`);
          }}
          className="flex-1 h-8 px-2 rounded-md bg-[var(--bg-1)] text-copy-13 text-[var(--text-1)] border border-[var(--border-1)] font-mono"
        />
        <Button size="sm" variant="ghost" onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}
