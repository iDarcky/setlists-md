import { useState, useMemo, useCallback, useEffect } from 'react';
import { resolveSongView } from '../arrangements';
import { transposeKey, semitonesBetween, keysInQualityOf } from '../music';
import ChartView from './ChartView';
import SongDetails from './SongDetails';
import FullscreenChartViewer from './FullscreenChartViewer';
import { StructureRibbon } from './StructureRibbon';
import SongPlayerBar from './SongPlayerBar';
import { OverflowMenu } from './ui/OverflowMenu';
import { useConfirm } from './ui/useConfirmHook';
import { Select, SelectTrigger, SelectContent, SelectItem } from './ui/Select';
import { exportSongPdf } from '../pdf/exportSongPdf';
import { useWakeLock } from '../hooks/useWakeLock';
import { youtubeThumb, youtubeId, spotifyArt } from '../lib/coverArt';
import { cn } from '../lib/utils';

// ── Song Hub ─────────────────────────────────────────────────────────────────
// The library's song-open target: a "hub card" (art · title + gold key dropdown
// · byline · meta pills · arrangement · ⋯ · Edit · Campfire) stacked above a
// "reader card" whose header carries the Chart/Lyrics/Details tabs plus the
// chart-only Aa + full-screen controls, with a backing-track player card pinned
// to the bottom.

const HUB_TABS = [
  { id: 'chart', label: 'Chart' },
  { id: 'lyrics', label: 'Lyrics' },
  { id: 'details', label: 'Details' },
];

const ART_GRADIENT = 'radial-gradient(120% 120% at 20% 10%, #1f5f4f 0%, #0e2c30 55%, #150f1f 100%)';

const PrintIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);
const EditIcon = (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>);
const PlayIcon = (<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>);
const MoveIcon = (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
const CopyIcon = (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>);
const TrashIcon = (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>);

export default function SongHub({
  song: songInput,
  onBack,
  onEdit,
  onPlay,
  onMoveSong, onCopySong, onDelete,
  onUpdateSong,
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
  onTransposed,
}) {
  const confirm = useConfirm();
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
  const accidentals = settings?.accidentals;
  const sharps = accidentals === 'sharps';
  const transpose = song ? semitonesBetween(song.key, selectedKey) : 0;
  const keyValue = (song && transposeKey(selectedKey, 0, sharps)) || selectedKey;
  const keyOptions = useMemo(() => (song ? keysInQualityOf(song.key, accidentals) : []), [song, accidentals]);

  const [aaAnchor, setAaAnchor] = useState(null);
  const [displayMode, setDisplayMode] = useState('chords');
  const [chartStructure, setChartStructure] = useState([]);
  const [fsMode, setFsMode] = useState(null); // null | 'chart' | 'lyrics' → WIP fullscreen viewer
  const closeAa = useCallback(() => setAaAnchor(null), []);
  const toggleAa = (e) => setAaAnchor(aaAnchor ? null : e.currentTarget.getBoundingClientRect());

  // Cover art priority: Spotify album art → YouTube thumbnail → gradient
  // placeholder. YouTube is derived synchronously; Spotify goes through the
  // cover-art edge function (keyed to the URL so a stale result is never shown).
  const ytArt = useMemo(() => youtubeThumb(song?.youtube), [song?.youtube]);
  const [spotifyResult, setSpotifyResult] = useState({ key: null, url: null });
  useEffect(() => {
    const url = song?.spotify;
    if (!url) return undefined;
    let cancelled = false;
    spotifyArt(url).then(img => { if (!cancelled) setSpotifyResult({ key: url, url: img }); });
    return () => { cancelled = true; };
  }, [song?.spotify]);
  const [failedArt, setFailedArt] = useState({});
  const spotifyPending = !!song?.spotify && spotifyResult.key !== song?.spotify;
  const spotifyUrl = spotifyResult.key === song?.spotify ? spotifyResult.url : null;
  const artUrl = [
    spotifyUrl,
    spotifyPending ? null : ytArt,
  ].find(u => u && !failedArt[u]) || null;

  // Settings → General → "Keep screen awake" while a song is open.
  useWakeLock(settings?.keepAwake === true);

  const arrangements = song?._allArrangements || [];
  const hasMultipleArrangements = arrangements.length > 1;
  const arrName = arrangements.find(a => a.id === activeArrId)?.name || 'Arrangement';

  const switchArrangement = (id) => {
    setActiveArrId(id);
    const next = songInput?.arrangements ? resolveSongView(songInput, id) : null;
    if (next?.key) setSelectedKey(next.key);
  };
  const scrollToSection = (i) => {
    const el = document.getElementById(`section-${i}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!song) return null;

  const cleanAddedBy = addedBy && addedBy.trim() && addedBy.trim() !== 'Guest' ? addedBy.trim() : '';
  const byline = [song.artist, cleanAddedBy && `added by ${cleanAddedBy}`].filter(Boolean).join('  ·  ');
  const showRibbon = chartStructure.length > 0;
  const chartDisplayMode = activeTab === 'lyrics' ? 'lyrics' : displayMode;
  const isReaderTab = activeTab === 'chart' || activeTab === 'lyrics';
  const hasPlayer = !!youtubeId(song.youtube);

  // Shared ChartView props (the inline reader + the fullscreen viewer use the
  // same config and transpose state).
  const chartProps = {
    song: songInput,
    arrangementId: activeArrId,
    selectedKey,
    onSelectKey: setSelectedKey,
    settings,
    onUpdateSettings,
    onOpenAdvancedStyle,
    defaultColumns,
    defaultFontSize,
    showInlineNotes,
    inlineNoteStyle,
    duplicateSections,
    chartLayout,
    onTransposed,
  };

  // Overflow actions. Edit / Full screen / Play-live / View are intentionally
  // NOT here on desktop (they have dedicated controls). On mobile we fold
  // Campfire + Edit into the menu since the header has no room for them.
  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete song?',
      description: `"${song?.title || 'Untitled'}" will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (ok) onDelete?.();
  };
  const baseOverflow = [
    { label: 'Print / Save as PDF', icon: PrintIcon, onClick: () => exportSongPdf(song, { transpose }) },
    onMoveSong && { label: 'Move to…', icon: MoveIcon, onClick: () => onMoveSong() },
    onCopySong && { label: 'Copy to…', icon: CopyIcon, onClick: () => onCopySong() },
    onDelete && { label: 'Delete song', icon: TrashIcon, onClick: handleDelete, danger: true },
  ].filter(Boolean);
  const overflowDesktop = baseOverflow;
  const overflowMobile = [
    onPlay && { label: 'Campfire', icon: PlayIcon, onClick: () => onPlay(activeArrId) },
    onEdit && { label: 'Edit', icon: EditIcon, onClick: () => onEdit(activeArrId) },
    ...baseOverflow,
  ].filter(Boolean);

  // Key chip that doubles as the transpose control (dropdown + chevron). Its
  // fill follows the chord colour (--chord) so it tracks the theme/palette.
  const keyChip = (cls) => (
    <Select value={keyValue} onValueChange={setSelectedKey}>
      <SelectTrigger
        aria-label="Key (transpose)"
        className={cn('!border-0 gap-0.5 font-mono font-bold focus:!ring-0 shrink-0 hover:!opacity-90', cls)}
        style={{ background: 'var(--chord)', color: '#0a0a0a' }}
      >
        <span>{keyValue}</span>
      </SelectTrigger>
      <SelectContent>
        {keyOptions.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
      </SelectContent>
    </Select>
  );

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

  const metaPills = (arrTriggerClass) => (
    <>
      <MonoPill k="Original key">{song.key}</MonoPill>
      {song.tempo && <MonoPill k="BPM">{song.tempo}</MonoPill>}
      {song.time && <MonoPill k="Time Sig">{song.time}</MonoPill>}
      {song.duration && <MonoPill k="Len">{song.duration}</MonoPill>}
      {hasMultipleArrangements && arrangementSelect(arrTriggerClass)}
    </>
  );

  const artTile = (sizeCls) => (
    <div className={cn('shrink-0 rounded-xl border border-[var(--border-2)] grid place-items-center overflow-hidden', sizeCls)} style={{ background: ART_GRADIENT }} aria-hidden="true">
      {artUrl
        ? <img key={artUrl} src={artUrl} alt="" className="w-full h-full object-cover" onError={() => setFailedArt(f => ({ ...f, [artUrl]: true }))} />
        : <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#cfeee2" strokeWidth="1.5" className="w-1/2 h-1/2"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>}
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-[var(--ds-background-200)]" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="flex-1 min-h-0 flex flex-col w-full mx-auto px-3 pt-3 pb-3 gap-3 sm:px-7 sm:pt-6 sm:pb-5 sm:gap-4">

        {/* ════ HUB CARD ════ */}
        <div
          className="shrink-0 overflow-hidden border border-[var(--border-1)] rounded-2xl"
          style={{ background: 'linear-gradient(180deg, var(--ds-background-100), var(--ds-background-200))' }}
        >
          {/* ── Desktop / tablet hub-top (≥ sm) ── */}
          <div className="hidden sm:flex gap-5 px-5 pt-5 pb-4 items-start flex-wrap">
            {artTile('w-[88px] h-[88px]')}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="m-0 truncate font-[650] leading-[1.1] tracking-[-0.01em] text-[28px] text-[var(--text-1)]">{song.title}</h1>
                {keyChip('!h-7 !min-h-[28px] !w-auto !px-2 !py-0 !rounded-lg text-[13px]')}
              </div>
              {byline && <div className="text-[var(--text-2)] text-[13.5px] mt-1.5 truncate">{byline}</div>}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {metaPills('h-[30px] px-2.5 rounded-[9px] border border-[var(--border-1)] bg-[var(--bg-1)] text-[12.5px] font-medium text-[var(--text-1)] gap-1 max-w-[200px] w-auto focus:ring-0 hover:bg-[var(--bg-2)]')}
              </div>
            </div>

            <div className="shrink-0 ml-auto flex items-center gap-2 flex-wrap justify-end">
              <div className="inline-grid place-items-center w-9 h-9 rounded-[9px] border border-[var(--border-2)] bg-[var(--bg-1)] text-[var(--text-2)]">
                <OverflowMenu ariaLabel="Song actions" items={overflowDesktop} />
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
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[9px] text-[13px] font-[650] cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ background: 'var(--color-brand)', color: '#ffffff' }}>
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
          <div className="sm:hidden p-3">
            <div className="flex items-center gap-2">
              {onBack && (
                <button type="button" onClick={onBack} aria-label="Back"
                  className="shrink-0 -ml-1.5 w-10 grid place-items-center rounded-xl text-[var(--text-1)] active:bg-[var(--bg-2)] cursor-pointer" style={{ WebkitTapHighlightColor: 'transparent' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                </button>
              )}
              {artTile('w-11 h-11')}
              <div className="min-w-0 flex-1 flex items-center gap-1.5">
                <h1 className="m-0 truncate font-bold leading-tight text-heading-17 text-[var(--text-1)]">{song.title}</h1>
                {keyChip('!h-6 !min-h-[24px] !w-auto !px-1.5 !py-0 !rounded-md text-[12px]')}
              </div>
              <div className="shrink-0"><OverflowMenu ariaLabel="Song actions" items={overflowMobile} size="md" /></div>
            </div>
            {byline && <p className="m-0 mt-1.5 text-label-12 text-[var(--text-2)] truncate">{byline}</p>}
            <div className="mt-2 flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar">
              {metaPills('h-[30px] px-2.5 rounded-[9px] border border-[var(--border-1)] bg-[var(--bg-1)] text-[12.5px] font-medium text-[var(--text-1)] gap-1 max-w-[150px] w-auto focus:ring-0 shrink-0')}
            </div>
          </div>

          {/* ── Song map (static codes — does not follow the chart) ── */}
          {showRibbon && (
            <div className="px-3 sm:px-5 pb-3 sm:pb-3.5 flex items-center gap-2">
              <span className="hidden sm:inline text-[10px] uppercase tracking-[0.12em] text-[var(--text-2)] shrink-0">Song map</span>
              <div className="min-w-0 flex-1 overflow-x-auto no-scrollbar">
                <StructureRibbon
                  structure={chartStructure}
                  compact
                  orientation="horizontal"
                  collapse
                  activeIndex={null}
                  style="codes"
                  sectionColors={settings?.sectionColors}
                  sectionLabels={settings?.sectionLabels}
                  customSectionTypes={settings?.customSectionTypes}
                  onSelect={scrollToSection}
                />
              </div>
            </div>
          )}

        </div>

        {/* ════ READER CARD (tabs + chart-only Aa / full screen live here) ════ */}
        <div
          className="flex-1 min-h-0 flex flex-col overflow-hidden border border-[var(--border-1)] rounded-2xl"
          style={{
            background: 'var(--chart-bg, var(--ds-background-100))',
            color: 'var(--chart-text, var(--ds-gray-1000))',
            '--text-1': 'var(--chart-text, var(--ds-gray-1000))',
            '--text-2': 'var(--chart-subtle, var(--ds-gray-900))',
          }}
        >
          {/* Tab header: brand pills (left) + chart-only Aa / full screen (right). */}
          <div className="shrink-0 flex items-center justify-between gap-2 px-2 sm:px-3 py-2 border-b border-[var(--border-1)]">
            <div className="flex gap-1 min-w-0">
              {HUB_TABS.map(t => {
                const active = activeTab === t.id;
                return (
                  <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'h-9 px-3.5 sm:px-4 rounded-lg text-[13.5px] cursor-pointer transition-colors',
                      active
                        ? 'text-white font-semibold'
                        : 'font-medium text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--bg-2)]',
                    )}
                    style={{ WebkitTapHighlightColor: 'transparent', background: active ? 'var(--color-brand)' : undefined }}>
                    {t.label}
                  </button>
                );
              })}
            </div>
            {isReaderTab && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button type="button" aria-label="Display options" aria-expanded={!!aaAnchor} onClick={toggleAa}
                  className="w-9 h-9 grid place-items-center rounded-lg border border-[var(--border-2)] bg-[var(--bg-1)] text-[13px] font-bold text-[var(--text-1)] hover:bg-[var(--bg-2)] cursor-pointer" style={{ WebkitTapHighlightColor: 'transparent' }}>Aa</button>
                <button type="button" aria-label="Full screen" onClick={() => setFsMode(activeTab)}
                  className="w-9 h-9 grid place-items-center rounded-lg border border-[var(--border-2)] bg-[var(--bg-1)] text-[var(--text-2)] hover:text-[var(--text-1)] cursor-pointer" style={{ WebkitTapHighlightColor: 'transparent' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" /></svg>
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0">
            {activeTab === 'details' ? (
              <SongDetails
                song={song}
                onSave={onUpdateSong ? (patch) => onUpdateSong({ ...songInput, ...patch, updatedAt: Date.now() }) : null}
              />
            ) : (
              <ChartView
                embedded
                {...chartProps}
                displayMode={chartDisplayMode}
                onDisplayMode={activeTab === 'chart' ? setDisplayMode : undefined}
                aaAnchor={aaAnchor}
                onAaClose={closeAa}
                onReportStructure={setChartStructure}
              />
            )}
          </div>
        </div>

        {/* ════ BACKING-TRACK PLAYER (YouTube) — inset card pinned to bottom ════ */}
        {hasPlayer && (
          <div className="shrink-0">
            <SongPlayerBar youtubeUrl={song.youtube} title={song.title} artist={song.artist} />
          </div>
        )}
      </div>

      {fsMode && (
        <FullscreenChartViewer
          title={song.title}
          keyLabel={keyValue}
          displayMode={fsMode === 'lyrics' ? 'lyrics' : displayMode}
          chartProps={chartProps}
          onClose={() => setFsMode(null)}
        />
      )}
    </div>
  );
}

function MonoPill({ k, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-[9px] border border-[var(--border-1)] bg-[var(--bg-1)] font-mono text-[12.5px] text-[var(--text-1)] shrink-0">
      {k && <span className="font-sans text-[11px] text-[var(--text-2)]">{k}</span>}
      <span className="tabular-nums">{children}</span>
    </span>
  );
}
