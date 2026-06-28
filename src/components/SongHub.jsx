import { useState, useMemo, useCallback } from 'react';
import { resolveSongView } from '../arrangements';
import { transposeKey, semitonesBetween } from '../music';
import ChartView from './ChartView';
import SongDetails from './SongDetails';
import { StructureRibbon } from './StructureRibbon';
import { Button } from './ui/Button';
import { OverflowMenu } from './ui/OverflowMenu';
import { Select, SelectTrigger, SelectContent, SelectItem } from './ui/Select';
import { VIEW_MODES } from './ui/viewModes';
import { exportSongPdf } from '../pdf/exportSongPdf';
import { cn } from '../lib/utils';

// ── Song Hub ─────────────────────────────────────────────────────────────────
// The library's song-open target — a faithful, theme-aware build of
// docs/mockups/song-hub-v2.html: a contained gradient "hub card" (art · title +
// gold key chip · byline · mono meta pills · arrangement · transpose/Aa/full
// screen/⋯/Edit/Campfire · song map · dotted tabs) stacked above a bordered
// "reader card" holding the chart / lyrics / details surface.
//
// The mockup's hard-coded dark palette is mapped onto the app theme tokens so
// light / dark / paper all work. Desktop/tablet (≥ sm) get the carded mockup
// layout; phones keep a bespoke full-bleed header (cards-in-cards waste width).

const HUB_TABS = [
  { id: 'chart', label: 'Chart' },
  { id: 'lyrics', label: 'Lyrics' },
  { id: 'details', label: 'Details' },
];

// Decorative art gradient — reused as the per-song placeholder until real art
// lands. Looks right on every theme (it's "album art", not chrome).
const ART_GRADIENT = 'radial-gradient(120% 120% at 20% 10%, #1f5f4f 0%, #0e2c30 55%, #150f1f 100%)';

export default function SongHub({
  song: songInput,
  onBack,
  onEdit,
  onPlay,
  onMoveSong, onCopySong,
  addedBy,
  settings,
  onUpdateSettings,
  onOpenAdvancedStyle,
  defaultColumns,
  defaultFontSize,
  showInlineNotes = true,
  inlineNoteStyle = 'dashes',
  duplicateSections = 'full',
  chartLayout = 'columns',
  isFullscreen = false,
  onToggleFullscreen,
  onTransposed,
}) {
  const [activeTab, setActiveTab] = useState('chart');
  const [activeArrId, setActiveArrId] = useState(
    songInput?.arrangements ? songInput.defaultArrangementId : undefined
  );
  const song = useMemo(
    () => (songInput?.arrangements ? resolveSongView(songInput, activeArrId) : songInput),
    [songInput, activeArrId],
  );
  // Transpose lives on the hub (resets on close — the hub unmounts on nav-away).
  const [selectedKey, setSelectedKey] = useState(song?.key || 'C');
  const sharps = settings?.accidentals === 'sharps';
  const transpose = song ? semitonesBetween(song.key, selectedKey) : 0;

  const [aaAnchor, setAaAnchor] = useState(null);
  const [displayMode, setDisplayMode] = useState('chords');
  const [chartStructure, setChartStructure] = useState([]);
  const [activeSection, setActiveSection] = useState(0);
  const closeAa = useCallback(() => setAaAnchor(null), []);

  const arrangements = song?._allArrangements || [];
  const hasMultipleArrangements = arrangements.length > 1;
  const arrName = arrangements.find(a => a.id === activeArrId)?.name || 'Arrangement';

  const hasTabs = useMemo(
    () => (song?.sections || []).some(s => (s.lines || []).some(
      l => l && typeof l === 'object' && (l.type === 'tab' || l.type === 'tabref'),
    )),
    [song],
  );

  const switchArrangement = (id) => {
    setActiveArrId(id);
    const next = songInput?.arrangements ? resolveSongView(songInput, id) : null;
    if (next?.key) setSelectedKey(next.key);
  };
  const stepTranspose = (dir) => setSelectedKey(k => transposeKey(k, dir, sharps));
  const transposeLabel = transpose === 0 ? 'Tr' : `${transpose > 0 ? '+' : ''}${transpose}`;
  const scrollToSection = (i) => {
    const el = document.getElementById(`section-${i}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!song) return null;

  const cleanAddedBy = addedBy && addedBy.trim() && addedBy.trim() !== 'Guest' ? addedBy.trim() : '';
  const byline = [song.artist, cleanAddedBy && `added by ${cleanAddedBy}`].filter(Boolean).join('  ·  ');
  const mobileSubtitle = [song.artist, song.tempo && `♩${song.tempo}`, song.time, song.duration]
    .filter(Boolean).join('  ·  ');
  const showRibbon = activeTab !== 'details' && chartStructure.length > 0;
  const chartDisplayMode = activeTab === 'lyrics' ? 'lyrics' : displayMode;

  const overflowItems = [
    { heading: true, label: 'View' },
    ...VIEW_MODES.filter(m => m.id !== 'tabs' || hasTabs).map(m => ({
      label: m.label,
      selected: activeTab === 'chart' && displayMode === m.id,
      onClick: () => { setActiveTab('chart'); setDisplayMode(m.id); },
    })),
    { divider: true },
    onPlay && {
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
    onToggleFullscreen && {
      label: isFullscreen ? 'Exit full screen' : 'Full screen',
      icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" /></svg>),
      onClick: onToggleFullscreen,
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
  ];

  const arrangementSelect = (triggerClass) => (
    <Select value={activeArrId} onValueChange={switchArrangement}>
      <SelectTrigger className={triggerClass} aria-label="Switch arrangement">
        <span className="truncate">{arrName}</span>
      </SelectTrigger>
      <SelectContent>
        {arrangements.map(a => (
          <SelectItem key={a.id} value={a.id}>
            <span className="inline-flex items-center gap-1.5">
              {a.id === song._defaultArrangementId && (<span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" title="Default" aria-label="Default" />)}
              {a.name || 'Untitled arrangement'}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="h-full flex flex-col bg-[var(--ds-background-200)]">
      <div className="flex-1 min-h-0 flex flex-col w-full sm:max-w-[1200px] sm:mx-auto sm:px-7 sm:pt-6 sm:pb-5 sm:gap-4">

        {/* ════ HUB CARD ════ */}
        <div
          className="shrink-0 overflow-hidden border-b border-[var(--border-1)] sm:border sm:border-[var(--border-1)] sm:rounded-2xl"
          style={{ background: 'linear-gradient(180deg, var(--ds-background-100), var(--ds-background-200))' }}
        >
          {/* ── Desktop / tablet hub-top (≥ sm) ── */}
          <div className="hidden sm:flex gap-5 px-5 pt-5 pb-4 items-start flex-wrap">
            {/* Art */}
            <div className="shrink-0 w-[88px] h-[88px] rounded-xl border border-[var(--border-2)] grid place-items-center" style={{ background: ART_GRADIENT }} aria-hidden="true">
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#cfeee2" strokeWidth="1.5"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="m-0 truncate font-[650] leading-[1.1] tracking-[-0.01em] text-[28px] text-[var(--text-1)]">{song.title}</h1>
                <span className="shrink-0 inline-flex items-center font-mono text-[13px] font-bold px-2 py-[3px] rounded-lg" style={{ background: '#e0b341', color: '#0a0a0a' }}>{selectedKey}</span>
              </div>
              {byline && <div className="text-[var(--text-2)] text-[13.5px] mt-1.5 truncate">{byline}</div>}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <MonoPill k="Key">{selectedKey}</MonoPill>
                {song.tempo && <MonoPill icon="♩">{song.tempo}</MonoPill>}
                {song.time && <MonoPill k="Time">{song.time}</MonoPill>}
                {song.duration && <MonoPill k="Len">{song.duration}</MonoPill>}
                {hasMultipleArrangements && arrangementSelect('h-[30px] px-2.5 rounded-[9px] border border-[var(--border-1)] bg-[var(--bg-1)] text-[12.5px] font-medium text-[var(--text-1)] gap-1 max-w-[200px] w-auto focus:ring-0 hover:bg-[var(--bg-2)]')}
              </div>
            </div>

            {/* Actions */}
            <div className="shrink-0 ml-auto flex items-center gap-2 flex-wrap justify-end">
              <div className="inline-flex items-center h-9 rounded-[9px] border border-[var(--border-2)] bg-[var(--bg-1)] overflow-hidden">
                <button type="button" aria-label="Transpose down" onClick={() => stepTranspose(-1)} className="w-[30px] h-9 grid place-items-center text-base text-[var(--text-2)] hover:text-[var(--text-1)] cursor-pointer">−</button>
                <span className="px-1 min-w-[1.75rem] text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-2)] tabular-nums select-none" title="Transpose">{transposeLabel}</span>
                <button type="button" aria-label="Transpose up" onClick={() => stepTranspose(1)} className="w-[30px] h-9 grid place-items-center text-base text-[var(--text-2)] hover:text-[var(--text-1)] cursor-pointer">+</button>
              </div>
              <button type="button" aria-label="Display options" aria-expanded={!!aaAnchor}
                onClick={(e) => setAaAnchor(aaAnchor ? null : e.currentTarget.getBoundingClientRect())}
                className="w-9 h-9 grid place-items-center rounded-[9px] border border-[var(--border-2)] bg-[var(--bg-1)] text-[13px] font-bold text-[var(--text-1)] hover:bg-[var(--bg-2)] cursor-pointer">Aa</button>
              {onToggleFullscreen && (
                <button type="button" aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'} onClick={onToggleFullscreen}
                  className="w-9 h-9 grid place-items-center rounded-[9px] border border-[var(--border-2)] bg-[var(--bg-1)] text-[var(--text-2)] hover:text-[var(--text-1)] cursor-pointer">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" /></svg>
                </button>
              )}
              <div className="inline-grid place-items-center w-9 h-9 rounded-[9px] border border-[var(--border-2)] bg-[var(--bg-1)] text-[var(--text-2)]">
                <OverflowMenu ariaLabel="Song actions" items={overflowItems} />
              </div>
              {onEdit && (
                <button type="button" onClick={() => onEdit(activeArrId)}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[9px] border border-[var(--border-2)] bg-[var(--bg-1)] text-[13px] text-[var(--text-1)] hover:bg-[var(--bg-2)] cursor-pointer">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                  Edit
                </button>
              )}
              {onPlay && (
                <button type="button" onClick={() => onPlay(activeArrId)}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[9px] text-[13px] font-[650] cursor-pointer"
                  style={{ background: 'var(--color-brand)', color: '#062018' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  Campfire
                </button>
              )}
              {onBack && (
                <button type="button" onClick={onBack} aria-label="Close"
                  className="w-9 h-9 grid place-items-center rounded-[9px] text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--bg-2)] cursor-pointer">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          </div>

          {/* ── Mobile hub-top (< sm) ── */}
          <div className="sm:hidden px-3 pb-1" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
            <div className="flex items-center gap-1">
              {onBack && (
                <button type="button" onClick={onBack} aria-label="Back"
                  className="shrink-0 -ml-1.5 w-11 grid place-items-center rounded-xl text-[var(--text-1)] active:bg-[var(--bg-2)] cursor-pointer" style={{ WebkitTapHighlightColor: 'transparent' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                </button>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h1 className="m-0 truncate font-bold leading-tight text-heading-17 text-[var(--text-1)]">{song.title}</h1>
                  <span className="shrink-0 inline-flex items-center font-mono h-5 px-1.5 rounded text-[11px] font-bold" style={{ background: '#e0b341', color: '#0a0a0a' }}>{selectedKey}</span>
                </div>
                {mobileSubtitle && <p className="m-0 text-label-12 text-[var(--text-2)] truncate">{mobileSubtitle}</p>}
              </div>
              <button type="button" aria-label="Display options" aria-expanded={!!aaAnchor}
                onClick={(e) => setAaAnchor(aaAnchor ? null : e.currentTarget.getBoundingClientRect())}
                className="shrink-0 w-11 grid place-items-center rounded-xl text-label-15 font-bold text-[var(--text-1)] active:bg-[var(--bg-2)] cursor-pointer" style={{ WebkitTapHighlightColor: 'transparent' }}>Aa</button>
              <div className="shrink-0"><OverflowMenu ariaLabel="Song actions" items={overflowItems} size="md" /></div>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="inline-flex items-center rounded-xl border border-[var(--border-1)] bg-[var(--bg-1)] overflow-hidden shrink-0">
                <button type="button" aria-label="Transpose down" onClick={() => stepTranspose(-1)} className="w-11 grid place-items-center text-xl leading-none text-[var(--text-1)] active:bg-[var(--bg-2)] cursor-pointer" style={{ WebkitTapHighlightColor: 'transparent' }}>−</button>
                <span className="px-1 text-label-13 font-semibold text-[var(--text-1)] tabular-nums select-none min-w-[2.75rem] text-center">{transpose === 0 ? 'Tr' : `Tr ${transpose > 0 ? '+' : ''}${transpose}`}</span>
                <button type="button" aria-label="Transpose up" onClick={() => stepTranspose(1)} className="w-11 grid place-items-center text-xl leading-none text-[var(--text-1)] active:bg-[var(--bg-2)] cursor-pointer" style={{ WebkitTapHighlightColor: 'transparent' }}>+</button>
              </div>
              {hasMultipleArrangements && arrangementSelect('min-w-0 px-3 border border-[var(--border-1)] bg-[var(--bg-1)] rounded-xl text-label-13 font-semibold text-[var(--text-1)] gap-1 w-auto focus:ring-0 shrink')}
              <div className="flex-1" />
              {onPlay && (
                <Button variant="brand" size="sm" onClick={() => onPlay(activeArrId)} className="px-4 rounded-xl shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="mr-1"><path d="M8 5v14l11-7z" /></svg>
                  Campfire
                </Button>
              )}
            </div>
          </div>

          {/* ── Song map ── */}
          {showRibbon && (
            <div className="px-3 sm:px-5 pt-1 sm:pt-0 pb-3 sm:pb-3.5 flex items-center gap-2">
              <span className="hidden sm:inline text-[10px] uppercase tracking-[0.12em] text-[var(--text-2)] shrink-0">Song map</span>
              <div className="min-w-0 flex-1 overflow-x-auto no-scrollbar">
                <StructureRibbon
                  structure={chartStructure}
                  compact
                  orientation="horizontal"
                  collapse
                  activeIndex={activeSection}
                  style={settings?.ribbonStyle || 'chips'}
                  sectionColors={settings?.sectionColors}
                  sectionLabels={settings?.sectionLabels}
                  customSectionTypes={settings?.customSectionTypes}
                  onSelect={scrollToSection}
                />
              </div>
            </div>
          )}

          {/* ── Tabs (dotted, mockup-style) ── */}
          <div className="flex gap-0.5 px-2 sm:px-3.5 border-t border-[var(--border-1)]">
            {HUB_TABS.map(t => {
              const active = activeTab === t.id;
              return (
                <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 sm:px-3.5 py-3 text-[13.5px] border-b-2 bg-transparent cursor-pointer transition-colors',
                    active ? 'text-[var(--text-1)] border-[var(--color-brand)] font-semibold' : 'text-[var(--text-2)] border-transparent hover:text-[var(--text-1)]',
                  )}>
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', active ? 'bg-[var(--color-brand)]' : 'bg-[var(--text-2)] opacity-50')} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ════ READER CARD ════ */}
        <div className="flex-1 min-h-0 overflow-hidden bg-[var(--ds-background-100)] sm:border sm:border-[var(--border-1)] sm:rounded-2xl">
          {activeTab === 'details' ? (
            <div className="h-full overflow-y-auto">
              <div className="px-5 sm:px-8 py-5 sm:py-6 max-w-[900px]">
                <SongDetails song={song} onEdit={onEdit ? () => onEdit(activeArrId) : null} />
              </div>
            </div>
          ) : (
            <ChartView
              embedded
              song={songInput}
              arrangementId={activeArrId}
              selectedKey={selectedKey}
              onSelectKey={setSelectedKey}
              displayMode={chartDisplayMode}
              onDisplayMode={activeTab === 'chart' ? setDisplayMode : undefined}
              aaAnchor={aaAnchor}
              onAaClose={closeAa}
              onReportStructure={setChartStructure}
              onActiveSection={setActiveSection}
              settings={settings}
              onUpdateSettings={onUpdateSettings}
              onOpenAdvancedStyle={onOpenAdvancedStyle}
              defaultColumns={defaultColumns}
              defaultFontSize={defaultFontSize}
              showInlineNotes={showInlineNotes}
              inlineNoteStyle={inlineNoteStyle}
              duplicateSections={duplicateSections}
              chartLayout={chartLayout}
              onTransposed={onTransposed}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function MonoPill({ k, icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-[9px] border border-[var(--border-1)] bg-[var(--bg-1)] font-mono text-[12.5px] text-[var(--text-1)]">
      {k && <span className="font-sans text-[11px] uppercase tracking-wide text-[var(--text-2)]">{k}</span>}
      {icon && <span className="text-[var(--text-2)]" aria-hidden="true">{icon}</span>}
      <span className="tabular-nums">{children}</span>
    </span>
  );
}
