import { useState, useMemo } from 'react';
import { resolveSongView } from '../arrangements';
import { transposeKey, semitonesBetween } from '../music';
import ChartView from './ChartView';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { Tabs } from './ui/Tabs';
import { OverflowMenu } from './ui/OverflowMenu';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/Select';
import { VIEW_MODES } from './ui/viewModes';
import { exportSongPdf } from '../pdf/exportSongPdf';
import { cn } from '../lib/utils';

// ── Song Hub ─────────────────────────────────────────────────────────────────
// The library's song-open target. Owns identity + navigation; the chart is just
// the reader inside the "Chart" tab. Phase 1: Chart (default) + Lyrics/Details
// stubs. The hub header hosts title/meta/arrangement/transpose/Aa/full-screen/
// overflow/Edit/Campfire; the embedded ChartView renders the reader body, its
// song-map ribbon and notes peek.
//
// Phase-1.x follow-ups (see docs/song-hub-build.md): promote the song-map ribbon
// onto the hub header proper, per-song art, "added by".

const HUB_TABS = [
  { id: 'chart', label: 'Chart' },
  { id: 'lyrics', label: 'Lyrics' },
  { id: 'details', label: 'Details' },
];

export default function SongHub({
  song: songInput,
  onBack,
  onEdit,
  onPlay,
  onMoveSong, onCopySong,
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
  // Resolve the flat single-arrangement view the chart/identity render against.
  const song = useMemo(
    () => (songInput?.arrangements ? resolveSongView(songInput, activeArrId) : songInput),
    [songInput, activeArrId],
  );
  // Transpose lives on the hub (resets on close — the hub unmounts on nav-away).
  const [selectedKey, setSelectedKey] = useState(song?.key || 'C');
  const sharps = settings?.accidentals === 'sharps';
  const transpose = song ? semitonesBetween(song.key, selectedKey) : 0;

  // Aa popover + view mode are owned here but the popover itself renders inside
  // the embedded ChartView (which keeps all the size/column/notation wiring).
  const [aaAnchor, setAaAnchor] = useState(null);
  const [displayMode, setDisplayMode] = useState('chords');

  const arrangements = song?._allArrangements || [];
  const hasMultipleArrangements = arrangements.length > 1;

  const hasTabs = useMemo(
    () => (song?.sections || []).some(s => (s.lines || []).some(
      l => l && typeof l === 'object' && (l.type === 'tab' || l.type === 'tabref'),
    )),
    [song],
  );

  const switchArrangement = (id) => {
    setActiveArrId(id);
    // Each arrangement carries its own source key — reset transpose so we don't
    // leak the old transposition into the new chart.
    const next = songInput?.arrangements ? resolveSongView(songInput, id) : null;
    if (next?.key) setSelectedKey(next.key);
  };

  const stepTranspose = (dir) => setSelectedKey(k => transposeKey(k, dir, sharps));

  const transposeLabel = transpose === 0 ? 'TR' : `TR ${transpose > 0 ? '+' : ''}${transpose}`;

  if (!song) return null;

  // ── Overflow (⋮) — view modes + secondary song actions. Edit / Campfire /
  // Full screen are dedicated buttons, so they're not duplicated here.
  const overflowItems = [
    { heading: true, label: 'View' },
    ...VIEW_MODES.filter(m => m.id !== 'tabs' || hasTabs).map(m => ({
      label: m.label,
      selected: displayMode === m.id,
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

  return (
    <div className="h-full flex flex-col bg-[var(--ds-background-100)]">
      {/* ── Hub header ── */}
      <header className="shrink-0 border-b border-[var(--border-1)] bg-[var(--ds-background-100)]">
        <div className="wide-container pt-3 pb-2 flex items-start gap-3">
          {/* Art placeholder (no per-song art yet — Phase-1 placeholder). */}
          <div
            className="hidden sm:flex shrink-0 w-16 h-16 rounded-xl items-center justify-center text-[var(--text-2)]"
            style={{ background: 'linear-gradient(135deg, var(--bg-1), var(--bg-2))', border: '1px solid var(--border-1)' }}
            aria-hidden="true"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            {/* Title row: title + key chip (left) · actions (right). */}
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                <h1 className="m-0 truncate font-bold leading-tight text-heading-18 sm:text-heading-22 text-[var(--text-1)]">
                  {song.title}
                </h1>
                <span className="shrink-0 inline-flex items-center h-6 px-2 rounded-md text-label-12 font-bold bg-[var(--color-brand-soft)] text-[var(--color-brand-text)]">
                  {selectedKey}
                </span>
              </div>

              <div className="shrink-0 flex items-center gap-1.5">
                {/* Transpose stepper */}
                <div className="inline-flex items-center h-9 rounded-lg border border-[var(--border-1)] bg-[var(--bg-1)]">
                  <button type="button" aria-label="Transpose down" onClick={() => stepTranspose(-1)}
                    className="w-9 h-9 grid place-items-center text-lg leading-none text-[var(--text-1)] hover:bg-[var(--bg-2)] rounded-l-lg cursor-pointer">−</button>
                  <span className="px-1.5 text-label-12 font-semibold text-[var(--text-1)] tabular-nums select-none min-w-[2.5rem] text-center" title="Transpose">{transposeLabel}</span>
                  <button type="button" aria-label="Transpose up" onClick={() => stepTranspose(1)}
                    className="w-9 h-9 grid place-items-center text-lg leading-none text-[var(--text-1)] hover:bg-[var(--bg-2)] rounded-r-lg cursor-pointer">+</button>
                </div>
                {/* Aa display popover trigger (popover renders in ChartView) */}
                <button type="button" aria-label="Display options" aria-expanded={!!aaAnchor}
                  onClick={(e) => setAaAnchor(aaAnchor ? null : e.currentTarget.getBoundingClientRect())}
                  className="h-9 px-3 rounded-lg border border-[var(--border-1)] bg-[var(--bg-1)] text-label-14 font-bold text-[var(--text-1)] hover:bg-[var(--bg-2)] cursor-pointer">
                  Aa
                </button>
                {onToggleFullscreen && (
                  <button type="button" aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'} onClick={onToggleFullscreen}
                    className="w-9 h-9 grid place-items-center rounded-lg border border-[var(--border-1)] bg-[var(--bg-1)] text-[var(--text-1)] hover:bg-[var(--bg-2)] cursor-pointer">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8V3h5" /><path d="M21 8V3h-5" /><path d="M3 16v5h5" /><path d="M21 16v5h-5" /></svg>
                  </button>
                )}
                <div className="inline-flex items-center h-9 rounded-lg border border-[var(--border-1)] bg-[var(--bg-1)]">
                  <OverflowMenu ariaLabel="Song actions" items={overflowItems} />
                </div>
                {onEdit && (
                  <Button variant="secondary" size="sm" onClick={() => onEdit(activeArrId)}
                    className="hidden sm:inline-flex">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                    Edit
                  </Button>
                )}
                {onPlay && (
                  <Button variant="brand" size="sm" onClick={() => onPlay(activeArrId)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="mr-1"><path d="M8 5v14l11-7z" /></svg>
                    Campfire
                  </Button>
                )}
                {onBack && (
                  <IconButton variant="ghost" size="sm" onClick={onBack} aria-label="Close">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </IconButton>
                )}
              </div>
            </div>

            {/* Subtitle + meta line */}
            {song.artist && (
              <p className="m-0 mt-0.5 text-copy-14 text-[var(--text-2)] truncate">{song.artist}</p>
            )}
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <MetaPill label="KEY" value={selectedKey} />
              {song.tempo && <MetaPill icon="♩" value={song.tempo} />}
              {song.time && <MetaPill label="TIME" value={song.time} />}
              {song.duration && <MetaPill label="LEN" value={song.duration} />}
              {hasMultipleArrangements && (
                <Select value={activeArrId} onValueChange={switchArrangement}>
                  <SelectTrigger className="h-7 px-2.5 border border-[var(--border-1)] bg-[var(--bg-1)] hover:bg-[var(--bg-2)] rounded-lg text-label-12 font-semibold text-[var(--text-1)] gap-1 max-w-[180px] w-auto focus:ring-0" aria-label="Switch arrangement">
                    <span className="truncate">{arrangements.find(a => a.id === activeArrId)?.name || 'Arrangement'}</span>
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
              )}
            </div>
          </div>
        </div>

        {/* ── Tab row ── */}
        <div className="wide-container">
          <Tabs tabs={HUB_TABS} activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 min-h-0">
        {activeTab === 'chart' ? (
          <ChartView
            embedded
            song={songInput}
            arrangementId={activeArrId}
            selectedKey={selectedKey}
            onSelectKey={setSelectedKey}
            displayMode={displayMode}
            onDisplayMode={setDisplayMode}
            aaAnchor={aaAnchor}
            onAaClose={() => setAaAnchor(null)}
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
        ) : (
          <ComingSoon tab={HUB_TABS.find(t => t.id === activeTab)?.label || ''} />
        )}
      </div>
    </div>
  );
}

function MetaPill({ label, icon, value }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-[var(--border-1)] bg-[var(--bg-1)] text-label-12',
    )}>
      {label && <span className="text-[var(--text-2)] font-medium tracking-wide">{label}</span>}
      {icon && <span className="text-[var(--text-2)]" aria-hidden="true">{icon}</span>}
      <span className="text-[var(--text-1)] font-semibold tabular-nums">{value}</span>
    </span>
  );
}

function ComingSoon({ tab }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-2">
      <div className="w-12 h-12 rounded-2xl grid place-items-center bg-[var(--bg-1)] border border-[var(--border-1)] text-[var(--text-2)]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
      </div>
      <h2 className="m-0 text-heading-16 font-semibold text-[var(--text-1)]">{tab} — coming soon</h2>
      <p className="m-0 text-copy-14 text-[var(--text-2)] max-w-sm">
        This surface is on the way. For now, everything lives in the Chart tab.
      </p>
    </div>
  );
}
