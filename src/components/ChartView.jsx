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
import { StructureRibbon } from './StructureRibbon';
import { exportSongPdf } from '../pdf/exportSongPdf';
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
  // Stage mode seeds the local visibility + size state. The user picks a
  // role in the Layout sheet and we reapply the preset whenever that
  // changes; the local toggles still let them fine-tune within the
  // session without persisting back.
  const stageMode = settings?.stageMode || 'leader';
  const stagePreset = STAGE_MODE_MAP[stageMode]?.settings || STAGE_MODE_MAP.leader.settings;

  const [columns, setColumns] = useState(defaultColumns);
  const [fontSize, setFontSize] = useState(stagePreset.lyricFontSize ?? initialFontSize);
  const [chordFontSize, setChordFontSize] = useState(stagePreset.chordFontSize ?? Math.round(initialFontSize * 0.95));
  const [fontFamily, setFontFamily] = useState('Geist Mono');
  const [nns, setNns] = useState(!!stagePreset.nashville);
  const [showChords, setShowChords] = useState(stagePreset.showChords !== false);
  const [showDiagrams, setShowDiagrams] = useState(!!stagePreset.showDiagrams);

  // Reapply the stage mode preset to local state whenever the active
  // mode changes — the picker in the Layout sheet writes settings.stageMode
  // and we mirror that into the live toggles.
  useEffect(() => {
    setFontSize(stagePreset.lyricFontSize ?? initialFontSize);
    setChordFontSize(stagePreset.chordFontSize ?? Math.round(initialFontSize * 0.95));
    setNns(!!stagePreset.nashville);
    setShowChords(stagePreset.showChords !== false);
    setShowDiagrams(!!stagePreset.showDiagrams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageMode]);
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
      style={CHART_THEME_STYLE}
      className={cn(
        "h-[100dvh] overflow-y-auto overflow-x-hidden",
        isPreview && "h-full overflow-y-auto overflow-x-hidden px-4 py-4"
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
              <h1
                className="m-0 truncate font-bold leading-tight text-heading-24"
                style={{ color: 'var(--text-1)' }}
              >
                {song.title}
              </h1>
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
            "wide-container flex flex-wrap items-center gap-3 transition-all duration-200 overflow-hidden",
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
          <div className="wide-container pb-2">
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
                        onClick={() => onUpdateSettings?.('stageMode', m.id)}
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
                    onClick={() => setNns(!nns)}
                  >Numbers</Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowChords(!showChords)}
                    className={cn(!showChords && "opacity-40")}
                  >Chords</Button>
                  <Button
                    variant={showDiagrams ? 'brand' : 'secondary'}
                    size="sm"
                    onClick={() => setShowDiagrams(!showDiagrams)}
                  >Diagrams</Button>
                </div>
              </SheetField>

              <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                <SheetField label="Columns">
                  <SegmentedControl
                    value={columns}
                    onChange={setColumns}
                    options={[
                      { value: 1, label: '1 col' },
                      { value: 2, label: '2 col' },
                    ]}
                    size="sm"
                  />
                </SheetField>
                <SheetField label="Lyric size">
                  <div className="flex items-center bg-[var(--bg-1)] border border-[var(--border-1)] rounded-lg p-0.5 w-fit">
                    <IconButton variant="ghost" size="sm" onClick={() => setFontSize(prev => Math.max(10, prev - 2))} aria-label="Decrease lyric size">−</IconButton>
                    <span className="w-6 text-center text-label-12-mono text-[var(--text-1)] font-semibold tabular-nums">{fontSize}</span>
                    <IconButton variant="ghost" size="sm" onClick={() => setFontSize(prev => Math.min(30, prev + 2))} aria-label="Increase lyric size">+</IconButton>
                  </div>
                </SheetField>
                <SheetField label="Chord size">
                  <div className="flex items-center bg-[var(--bg-1)] border border-[var(--border-1)] rounded-lg p-0.5 w-fit">
                    <IconButton variant="ghost" size="sm" onClick={() => setChordFontSize(prev => Math.max(8, prev - 2))} aria-label="Decrease chord size">−</IconButton>
                    <span className="w-6 text-center text-label-12-mono text-[var(--text-1)] font-semibold tabular-nums">{chordFontSize}</span>
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

function InfoRow({ label, children }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-label-12 font-semibold uppercase tracking-wide text-[var(--text-2)] pt-0.5">{label}</dt>
      <dd className="flex-1 m-0 text-[var(--text-1)]">{children}</dd>
    </div>
  );
}

