import { useState, useMemo, useRef, useEffect } from 'react';
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
  const [showSettings, setShowSettings] = useState(false);
  const [showMusicSettings, setShowMusicSettings] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
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

  const toggleInfo = () => { setShowInfo(s => !s); setShowSettings(false); setShowMusicSettings(false); };
  const toggleAa = () => { setShowSettings(s => !s); setShowInfo(false); setShowMusicSettings(false); };
  const toggleMusic = () => { setShowMusicSettings(s => !s); setShowInfo(false); setShowSettings(false); };

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

  // Close expanded panels when header collapses
  const panelOpen = showSettings || showMusicSettings || showInfo;

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
              {song._arrangementCount > 1 && (
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
              )}
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
              <div className={cn(
                "flex gap-1.5 items-center transition-all duration-200 overflow-hidden",
                scrolled ? "max-w-0 opacity-0 pointer-events-none" : "max-w-[200px] opacity-100"
              )}>
                <IconButton
                  variant={showInfo ? 'active' : 'default'}
                  size="sm"
                  onClick={toggleInfo}
                  aria-label="Song info"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                </IconButton>
                <IconButton
                  variant={showSettings ? 'active' : 'default'}
                  size="sm"
                  onClick={toggleAa}
                  aria-label="Layout settings"
                >Aa</IconButton>
                <IconButton
                  variant={showMusicSettings ? 'active' : 'default'}
                  size="sm"
                  onClick={toggleMusic}
                  aria-label="Music display settings"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                  </svg>
                </IconButton>
                <div className="w-px h-5 bg-[var(--border-1)]" />
              </div>

              <IconButton variant="default" size="sm" onClick={() => exportSongPdf(song, { transpose })} aria-label="Print chart" title="Print / Save as PDF">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
              </IconButton>
              <IconButton variant="default" size="sm" onClick={onEdit} aria-label="Edit chart">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
              </IconButton>
              {onToggleFullscreen && (
                <IconButton
                  variant={isFullscreen ? 'active' : 'default'}
                  size="sm"
                  onClick={onToggleFullscreen}
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? (
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
                </IconButton>
              )}
              <IconButton variant="ghost" size="sm" onClick={onBack} aria-label="Close">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </IconButton>
            </div>
          </div>

          {/* Line 2: Artist + Key / Tempo / Time — collapses when scrolled */}
          <div className={cn(
            "a4-container flex flex-wrap items-center gap-3 transition-all duration-200 overflow-hidden",
            scrolled ? "max-h-0 opacity-0 pb-0" : "max-h-12 opacity-100 pb-1.5"
          )}>
            <span className="text-copy-14 text-[var(--text-2)]">{song.artist}</span>
            <div className="w-px h-3.5 bg-[var(--border-1)]" />
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

          {/* Expanded controls sub-row — collapses when scrolled */}
          {panelOpen && (
            <div className={cn(
              "a4-container flex flex-wrap items-center gap-1.5 transition-all duration-200 overflow-hidden",
              scrolled ? "max-h-0 opacity-0 pb-0" : "max-h-24 opacity-100 pb-3"
            )}>
              {showSettings && (
                <>
                  <SegmentedControl
                    value={columns}
                    onChange={setColumns}
                    options={[
                      { value: 1, label: '1 COL' },
                      { value: 2, label: '2 COL' },
                    ]}
                    size="xs"
                  />
                  <div className="flex items-center bg-[var(--bg-1)] border border-[var(--border-1)] rounded-lg p-0.5">
                    <IconButton variant="ghost" size="xs" onClick={() => setFontSize(prev => Math.max(10, prev - 2))} aria-label="Decrease font size">-</IconButton>
                    <span className="px-1.5 text-label-10-mono text-[var(--text-2)]">{fontSize}px</span>
                    <IconButton variant="ghost" size="xs" onClick={() => setFontSize(prev => Math.min(30, prev + 2))} aria-label="Increase font size">+</IconButton>
                  </div>
                  <Select value={fontFamily} onValueChange={setFontFamily}>
                    <SelectTrigger className="h-7 px-2 text-label-11 font-medium text-[var(--text-1)] gap-1 min-w-0 w-auto">
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
                </>
              )}
              {showMusicSettings && (
                <>
                  <Button
                    variant={nns ? 'brand' : 'secondary'}
                    size="xs"
                    onClick={() => setNns(!nns)}
                  >NUMBERS</Button>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => setShowChords(!showChords)}
                    className={cn(!showChords && "opacity-40")}
                  >CHORDS</Button>
                  <Button
                    variant={showDiagrams ? 'brand' : 'secondary'}
                    size="xs"
                    onClick={() => setShowDiagrams(!showDiagrams)}
                  >DIAGRAMS</Button>
                </>
              )}
              {showInfo && (
                hasMetadata ? (
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-label-14 text-[var(--text-2)]">
                    {song.capo > 0 && (
                      <span><span className="font-semibold text-[var(--text-1)]">Capo</span> {song.capo}</span>
                    )}
                    {song.ccli && (
                      <span><span className="font-semibold text-[var(--text-1)]">CCLI</span> {song.ccli}</span>
                    )}
                    {song.tags?.length > 0 && (
                      <span><span className="font-semibold text-[var(--text-1)]">Tags</span> {song.tags.join(', ')}</span>
                    )}
                    {song.notes && (
                      <span><span className="font-semibold text-[var(--text-1)]">Notes</span> {song.notes}</span>
                    )}
                    {song.spotify && (
                      <a href={song.spotify} target="_blank" rel="noopener noreferrer" className="text-[var(--color-brand-text)] hover:underline">
                        Spotify ↗
                      </a>
                    )}
                    {song.youtube && (
                      <a href={song.youtube} target="_blank" rel="noopener noreferrer" className="text-[var(--color-brand-text)] hover:underline">
                        YouTube ↗
                      </a>
                    )}
                  </div>
                ) : (
                  <span className="text-label-14 text-[var(--text-2)] italic">No additional song info</span>
                )
              )}
            </div>
          )}
        </div>
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
