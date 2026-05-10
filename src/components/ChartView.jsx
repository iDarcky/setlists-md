import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { transposeChord, ALL_KEYS, semitonesBetween } from '../music';
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

const FONT_SIZES = { S: 14, M: 18, L: 22 };

const FONT_FAMILIES = {
  'Geist Sans': "var(--font-sans)",
  'Geist Mono': "var(--font-mono)",
  'JetBrains Mono': "'JetBrains Mono', monospace",
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
  const [fontFamily, setFontFamily] = useState('Geist Mono');
  const [nns, setNns] = useState(false);
  const [showChords, setShowChords] = useState(true);
  const [showDiagrams, setShowDiagrams] = useState(false);
  const [activeSheet, setActiveSheet] = useState(null); // 'layout' | 'music' | 'info' | null
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

  // Compute cumulative modulate offsets per section
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
  const hasMetadata = song.capo > 0 || song.ccli || (song.tags?.length > 0) || song.notes || song.spotify || song.youtube;

  return (
    <div
      ref={scrollContainerRef}
      className={cn(
        "h-screen overflow-y-auto overflow-x-hidden bg-[var(--ds-background-100)]",
        isPreview && "h-auto overflow-visible bg-transparent"
      )}
    >
      {/* ── Sticky Header ── */}
      {!isPreview && (
        <div className="material-header transition-all duration-200" style={headerFrostStyle}>
          {/* Line 1: Title + meta (compact) or Title only (expanded) + buttons */}
          <div className="a4-container flex items-center justify-between pt-3 pb-1 gap-3">
            <div className="min-w-0 flex-1 flex items-center gap-3">
              <h1 className={cn(
                "text-[var(--text-1)] m-0 truncate transition-all duration-200",
                scrolled ? "text-heading-16" : "text-heading-24"
              )}>{song.title}</h1>
              {/* Inline meta — visible only in compact mode */}
              {scrolled && (
                <div className="flex items-center gap-2 flex-shrink-0 text-label-12 text-[var(--text-2)]">
                  <span className="text-[var(--text-2)] text-[12px] opacity-60">•</span>
                  <span className="font-bold text-[var(--text-1)]">{selectedKey}</span>
                  {song.tempo && <span>{song.tempo} bpm</span>}
                  {song.time && <span>{song.time}</span>}
                </div>
              )}
            </div>
            <div className="flex gap-1.5 items-center flex-shrink-0">
              <div className="relative">
                <IconButton
                  ref={menuTriggerRef}
                  variant={menuOpen ? 'active' : 'default'}
                  size="sm"
                  onClick={() => setMenuOpen(o => !o)}
                  aria-label="More options"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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
                      onClick={() => openSheet('music')}
                      label="Music"
                      icon={(
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                        </svg>
                      )}
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
            {song._arrangementCount > 1 ? (
              <>
                <select
                  value={song._arrangementId || ''}
                  onChange={(e) => {
                    setInternalArrId(e.target.value);
                    onArrangementChange?.(e.target.value);
                  }}
                  className="bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded-md px-2 py-1 text-label-12 font-semibold text-[var(--ds-gray-1000)] outline-none cursor-pointer shrink-0"
                  aria-label="Arrangement"
                  title="Switch arrangement"
                >
                  {song._allArrangements?.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <div className="w-px h-3.5 bg-[var(--border-1)]" />
              </>
            ) : song._arrangementId ? (
              <>
                <span className="text-copy-14 text-[var(--text-2)]">{song._arrangementName}</span>
                <div className="w-px h-3.5 bg-[var(--border-1)]" />
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
              structure={song.sections.map(s => s.type)}
              compact
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
              <SheetField label="Font size">
                <div className="flex items-center bg-[var(--bg-1)] border border-[var(--border-1)] rounded-lg p-0.5 w-fit">
                  <IconButton variant="ghost" size="sm" onClick={() => setFontSize(prev => Math.max(10, prev - 2))} aria-label="Decrease font size">−</IconButton>
                  <span className="px-2 text-label-12-mono text-[var(--text-1)] font-semibold">{fontSize}px</span>
                  <IconButton variant="ghost" size="sm" onClick={() => setFontSize(prev => Math.min(30, prev + 2))} aria-label="Increase font size">+</IconButton>
                </div>
              </SheetField>
              <SheetField label="Font family">
                <Select value={fontFamily} onValueChange={setFontFamily}>
                  <SelectTrigger className="h-9 px-3 text-label-13 font-medium text-[var(--text-1)] gap-1 min-w-[200px] w-auto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(FONT_FAMILIES).map(name => (
                      <SelectItem key={name} value={name}>
                        <span style={{ fontFamily: FONT_FAMILIES[name] }}>{name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SheetField>
            </div>
          </BottomSheet>

          <BottomSheet
            open={activeSheet === 'music'}
            onClose={() => setActiveSheet(null)}
            title="Music"
          >
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
          </BottomSheet>

          <BottomSheet
            open={activeSheet === 'info'}
            onClose={() => setActiveSheet(null)}
            title="Song info"
          >
            {hasMetadata ? (
              <dl className="flex flex-col gap-3 text-copy-14 m-0">
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
            fontFamily: FONT_FAMILIES[fontFamily],
            ...(chartLayout !== 'rows' || columns !== 2 ? { columnCount: columns, columnGap: '3rem' } : {}),
          }}
        >
          {song.sections.map((section, idx) => (
            <div key={section.id || idx} id={`section-${idx}`} style={{ scrollMarginTop: '10rem', breakInside: 'avoid' }}>
              <SectionBlock
                section={section}
                transpose={transpose}
                modOffset={sectionModOffsets[idx]}
                nns={nns}
                songKey={song.key}
                showChords={showChords}
                inlineNotes={showInlineNotes}
                noteStyle={inlineNoteStyle}
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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[200] flex items-end justify-center animate-in fade-in duration-150"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-[640px] bg-[var(--ds-background-100)] border-t border-x border-[var(--ds-gray-400)] rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom-8 duration-200"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2 pb-1">
          <span className="block w-10 h-1 rounded-full bg-[var(--ds-gray-400)]" aria-hidden="true" />
        </div>
        <div className="flex items-center justify-between px-5 pt-1 pb-3">
          <h2 className="text-heading-18 font-semibold text-[var(--ds-gray-1000)] m-0">{title}</h2>
          <IconButton variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </IconButton>
        </div>
        <div className="px-5 pb-4">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
