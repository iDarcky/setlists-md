import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import SetlistCard from './SetlistCard';
import SidePeek from './shell/SidePeek';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { SearchBar } from './ui/SearchBar';
import { cn } from '../lib/utils';
import { searchSetlists } from '../lib/search';
import { resolveVisibleColumns } from '../lib/tableColumns';
import ColumnsMenu from './ui/ColumnsMenu';
import SetlistFilters from './setlist/SetlistFilters';
import { useIsDesktop, useIsTablet, useIsLandscape } from '../lib/useMediaQuery';
import { useResizablePane } from '../lib/useResizablePane';
import { usePersistentView, usePersistentJSON } from '../lib/usePersistentView';
import CardFieldsMenu from './ui/CardFieldsMenu';
import { resolveCardFields } from '../lib/cardFields';
import { setlistStartMs, isSetlistUpcoming } from '../lib/setlistTime';
import { searchSetlistsPlus, setlistDurationSeconds } from '../lib/libraryPlus';
import { formatTotalDuration } from '../lib/duration';
import { formatClockTime } from '../lib/dateFormat';
import { useEntitlement } from '../hooks/useEntitlement';
import { useTeam } from '../auth/useTeam';
import { useTeamSchedules } from '../hooks/useTeamSchedules';
import { useTeamSetlistMap } from '../hooks/useTeamSetlistMap';

const SetlistOverview = lazy(() => import('./SetlistOverview'));

function songCount(sl) {
  return (sl.items || []).filter(i => i.songId).length;
}

// setlistStartMs + the upcoming/past split now live in lib/setlistTime (shared
// with the dashboard, and end-time aware).
// Sort key for the Past group: newest day first, but earliest service first
// within a day (so Sun AM reads above Sun PM under that day).
function comparePast(a, b) {
  const da = a.date || '', db = b.date || '';
  if (da !== db) return da < db ? 1 : -1;          // date descending
  return setlistStartMs(a) - setlistStartMs(b);     // time ascending within day
}

function formatDate(date) {
  if (!date) return '—';
  const d = new Date(date + 'T12:00:00');
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const TableViewIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" />
    <line x1="9" y1="3" x2="9" y2="21" /><rect x="3" y="3" width="18" height="18" rx="2" />
  </svg>
);
const GalleryViewIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
  </svg>
);
const PaneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="15" y1="3" x2="15" y2="21" />
  </svg>
);
function SortArrow({ asc }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={asc ? '' : 'rotate-180'}>
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function SkeletonRows() {
  return (
    <div className="modes-card overflow-hidden divide-y divide-[var(--modes-border)]" style={{ borderColor: 'var(--modes-border)' }}>
      {[1, 2, 3].map(r => (
        <div key={r} className="flex items-center gap-4 px-5 py-4">
          <div className="h-4 w-40 bg-[var(--modes-surface-strong)] rounded animate-pulse" />
          <div className="h-3 w-24 bg-[var(--modes-surface-strong)] rounded animate-pulse ml-auto" />
        </div>
      ))}
    </div>
  );
}

function HeaderSort({ label, modeKey, sortMode, sortAsc, onSort }) {
  return (
    <button onClick={() => onSort(modeKey)} className="inline-flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer text-[var(--modes-text-dim)] uppercase tracking-wider text-label-12 font-semibold hover:text-[var(--modes-text)]">
      {label} {sortMode === modeKey && <SortArrow asc={sortAsc} />}
    </button>
  );
}

// A titled table section (Upcoming / Past) sharing one column layout.
function TableGroup({ title, count, rows, renderRow, readOnly, allChecked, onToggleAll, sortMode, sortAsc, onSort, compact = false, showService = false, showSchedule = false, visibleCols, mobileScroll = false }) {
  const show = (id) => !visibleCols || visibleCols.has(id);
  const floor = (cls) => (mobileScroll ? '' : cls);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2 px-1">
        <h2 className="text-heading-20 font-bold text-[var(--modes-text)] m-0">{title}</h2>
        <span className="text-label-12 text-[var(--modes-text-dim)]">{count}</span>
      </div>
      <div className={cn('modes-card', mobileScroll ? 'overflow-x-auto' : 'overflow-hidden')}>
        <table className={cn('w-full border-collapse table-fixed', mobileScroll && 'min-w-[720px]')}>
          <thead>
            <tr className="border-b border-[var(--modes-border)]">
              <th className="w-[44px] px-4 py-3">
                {!readOnly && <input type="checkbox" checked={allChecked} onChange={onToggleAll} aria-label={`Select all ${title.toLowerCase()}`} className="w-4 h-4 rounded accent-[var(--color-brand)] cursor-pointer align-middle" />}
              </th>
              <th className="text-left px-5 py-3"><HeaderSort label="Name" modeKey="name" sortMode={sortMode} sortAsc={sortAsc} onSort={onSort} /></th>
              {show('date') && <th className="text-left px-5 py-3 w-[180px]"><HeaderSort label="Date" modeKey="date" sortMode={sortMode} sortAsc={sortAsc} onSort={onSort} /></th>}
              {show('songs') && <th className={cn('text-left px-5 py-3 w-[90px]', floor('hidden md:table-cell'))}><HeaderSort label="Songs" modeKey="songs" sortMode={sortMode} sortAsc={sortAsc} onSort={onSort} /></th>}
              {show('duration') && <th className={cn('text-left px-5 py-3 w-[100px]', floor('hidden lg:table-cell'))}><HeaderSort label="Length" modeKey="duration" sortMode={sortMode} sortAsc={sortAsc} onSort={onSort} /></th>}
              {showSchedule && (
                <>
                  {show('instr') && <th title="Instrumentalists scheduled" className={cn('text-left px-4 py-3 w-[80px] text-[var(--modes-text-dim)] uppercase tracking-wider text-label-12 font-semibold', floor('hidden lg:table-cell'))}>Instr.</th>}
                  {show('vocals') && <th title="Vocalists scheduled" className={cn('text-left px-4 py-3 w-[80px] text-[var(--modes-text-dim)] uppercase tracking-wider text-label-12 font-semibold', floor('hidden lg:table-cell'))}>Vocals</th>}
                  {show('sched') && <th title="Total members scheduled" className={cn('text-left px-4 py-3 w-[90px] text-[var(--modes-text-dim)] uppercase tracking-wider text-label-12 font-semibold', floor('hidden lg:table-cell'))}>Sched.</th>}
                </>
              )}
              {showService && show('service') && <th className={cn('text-left px-5 py-3 w-[150px] text-[var(--modes-text-dim)] uppercase tracking-wider text-label-12 font-semibold', floor('hidden md:table-cell'))}>Service</th>}
              {!compact && show('tags') && <th className={cn('text-left px-5 py-3 w-[200px] text-[var(--modes-text-dim)] uppercase tracking-wider text-label-12 font-semibold', floor('hidden lg:table-cell'))}>Tags</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(renderRow)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Setlists({
  songs,
  setlists,
  loaded = true,
  onViewSetlist,
  onPlaySetlist,
  onPracticeSetlist,
  onNewSetlist,
  onImportSetlist,
  previewSetlistId = null,
  onSelectPreview,
  isFullscreen = false,
  onToggleFullscreen,
  onEditSetlist,
  readOnly = false,
  clockFormat = '12h',
  tableColumns,
  onSetTableColumns,
  overviewV2 = false,
  overscheduleWarn = false,
  streakLimit = 3,
  onExportSetlistZip,
  onExportSetlistPdfOverview,
  onExportSetlistPdfFull,
  onDeleteSetlist,
  onDeleteSetlists,
  plus = false,
  onDuplicateSetlist,
  onSaveAsTemplate,
  onNewFromTemplate,
  onTagSetlists,
  canEdit = true,
}) {
  // Responsive shell — see Library.jsx for the breakpoint rationale.
  const wide = useIsDesktop();
  const isTablet = useIsTablet();
  const isLandscape = useIsLandscape();
  const isDesktop = wide && !isTablet;
  const advanced = isDesktop || isTablet;
  const splitDock = isTablet && isLandscape && wide && !isFullscreen;
  const { width: paneWidth, onPointerDown: onPaneResize } = useResizablePane({ storageKey: 'setlists-md:setlists-pane-w' });

  const previewSetlist = useMemo(
    () => setlists.find(s => s.id === previewSetlistId) || null,
    [setlists, previewSetlistId],
  );

  const openFull = (sl) => onViewSetlist?.(sl);
  const openPeek = (sl, e) => { e?.stopPropagation(); onSelectPreview?.(sl.id); };
  const onRowActivate = isTablet ? openPeek : openFull;

  // Service column + filter are a Church-tier feature (one service per setlist).
  const { allowed: showService } = useEntitlement('multi-service');

  const [query, setQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [selectedTags, setSelectedTags] = useState([]);
  // Persisted per device (localStorage); null = auto per-device default.
  const [viewMode, setViewMode] = usePersistentView('setlists-md:setlists-view'); // 'gallery' | 'compact' | 'table'
  const [sortMode, setSortMode] = useState('date');   // 'name' | 'date' | 'songs' | 'duration'
  const [sortAsc, setSortAsc] = useState(false);
  const [selected, setSelected] = useState([]);
  const [fabOpen, setFabOpen] = useState(false);
  // setlistsLibraryPlus state.
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'draft' | 'ready'
  const [dateFilter, setDateFilter] = useState('all');     // 'all' | 'week' | 'month'
  const [bulkMenu, setBulkMenu] = useState(null);          // 'tags' | null
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [galleryGroup, setGalleryGroup] = usePersistentView('setlists-md:setlists-groupby'); // null=auto | month | service
  // Card fields stored per view ({ card, compact }) — see Library.
  const [cardFieldsSaved, setCardFieldsSaved] = usePersistentJSON('setlists-md:setlists-card-fields');
  const fabRef = useRef(null);
  const bulkBarRef = useRef(null);
  const fileInputRef = useRef(null);

  // Song lookup + per-setlist total duration (setlistsLibraryPlus).
  const songMap = useMemo(() => new Map((songs || []).map(s => [s.id, s])), [songs]);
  const durationOf = (sl) => setlistDurationSeconds(sl, songMap);
  const durLabel = (sl) => { if (!plus) return null; const s = durationOf(sl); return s > 0 ? formatTotalDuration(s) : null; };

  useEffect(() => {
    const handler = (e) => {
      if (fabRef.current && !fabRef.current.contains(e.target)) setFabOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { setFabOpen(false); setBulkMenu(null); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!bulkMenu) return;
    const handler = (e) => { if (bulkBarRef.current && !bulkBarRef.current.contains(e.target)) setBulkMenu(null); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [bulkMenu]);

  // Distinct services across all setlists (church tier) — powers the filter.
  const serviceOptions = useMemo(
    () => [...new Set(setlists.map(s => s.service).filter(Boolean))].sort(),
    [setlists],
  );

  // Distinct tags across all setlists — powers the multi-tag filter.
  const allTags = useMemo(
    () => [...new Set(setlists.flatMap(s => s.tags || []).filter(Boolean))].sort(),
    [setlists],
  );
  const toggleTag = (tag) => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  // Templates (setlistsLibraryPlus) live in their own section, never in the
  // normal Upcoming/Past lists.
  const templates = useMemo(
    () => plus ? setlists.filter(s => s.isTemplate) : [],
    [plus, setlists],
  );

  // Captured once on mount (Date.now() is flagged impure if called in render).
  const [nowTs] = useState(() => Date.now());

  // Date-window predicate for the plus quick filters.
  const inDateWindow = (sl, window) => {
    if (window === 'all') return true;
    if (!sl.date) return false;
    const start = setlistStartMs(sl);
    if (!start) return false;
    const days = window === 'week' ? 7 : 31;
    const now = nowTs;
    const horizon = now + days * 86400000;
    // Upcoming within the window (or anything today onward up to the horizon).
    return start >= now - 86400000 && start <= horizon;
  };

  const filtered = useMemo(() => {
    // Service + tag chips are orthogonal filters; apply them first, then run
    // the shared ultra-search over the text query.
    const scoped = setlists.filter(sl => {
      if (plus && sl.isTemplate) return false; // templates have their own section
      if (showService && serviceFilter !== 'all' && (sl.service || '') !== serviceFilter) return false;
      if (selectedTags.length > 0 && !selectedTags.every(t => (sl.tags || []).includes(t))) return false;
      if (plus && statusFilter !== 'all') {
        const isDraft = sl.status === 'draft';
        if (statusFilter === 'draft' && !isDraft) return false;
        if (statusFilter === 'ready' && isDraft) return false;
      }
      if (plus && dateFilter !== 'all' && !inDateWindow(sl, dateFilter)) return false;
      return true;
    });
    // Plus: also surface setlists that CONTAIN a matched song.
    return plus ? searchSetlistsPlus(scoped, songs, query) : searchSetlists(scoped, query);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setlists, songs, query, showService, serviceFilter, selectedTags, plus, statusFilter, dateFilter, nowTs]);

  const [prevSelKey, setPrevSelKey] = useState(null);
  const selKey = JSON.stringify([query, sortMode, sortAsc, serviceFilter, selectedTags, statusFilter, dateFilter]);
  if (selKey !== prevSelKey) {
    setPrevSelKey(selKey);
    setSelected([]);
  }

  // Per-setlist schedule counts (team workspaces only). Visible by default and
  // toggleable via the shared ColumnsMenu (Instr./Vocals/Sched. columns).
  const { team } = useTeam();
  const { schedules } = useTeamSchedules(team?.id);
  const { map: setlistIdMap } = useTeamSetlistMap(team?.id);
  const showSchedule = !!team;
  const scheduleStats = useMemo(() => {
    const stats = {};
    if (!showSchedule) return stats;
    for (const sl of setlists) {
      const dbId = setlistIdMap[sl.id] || sl.id;
      const rows = schedules.filter(s => s.setlist_id === dbId);
      stats[sl.id] = {
        total: rows.length,
        instrumentalists: rows.filter(r => r.role).length,
        vocalists: rows.filter(r => r.vocal_part).length,
      };
    }
    return stats;
  }, [showSchedule, setlists, schedules, setlistIdMap]);

  // Customizable table columns (synced via settings.tableColumns). Gated by the
  // workspace context so Service (church) / Schedule (team) only appear when
  // available.
  const colCtx = useMemo(() => ({ showService, showSchedule, plus }), [showService, showSchedule, plus]);
  const columnVisible = useMemo(
    () => resolveVisibleColumns('setlists', tableColumns, colCtx),
    [tableColumns, colCtx],
  );
  const showCol = (id) => columnVisible.has(id);

  // A setlist is "upcoming" until it ends — its explicit end time, or 1h after
  // start when none is set (see lib/setlistTime).
  const isUpcoming = (sl) => isSetlistUpcoming(sl, nowTs);

  // Gallery grouping (Upcoming / Past)
  const { upcoming, past } = useMemo(() => {
    const up = [], pa = [];
    filtered.forEach(sl => { if (isUpcoming(sl)) up.push(sl); else pa.push(sl); });
    up.sort((a, b) => setlistStartMs(a) - setlistStartMs(b)); // soonest first
    pa.sort(comparePast);
    return { upcoming: up, past: pa };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, nowTs]);

  // Custom card-gallery grouping (setlistsLibraryPlus): by Month or Service,
  // replacing the Upcoming/Past split. Returns an ordered [{ key, items }].
  const customGroups = useMemo(() => {
    if (!plus || !galleryGroup) return null;
    const keyOf = (sl) => {
      if (galleryGroup === 'service') return sl.service || 'No service';
      // month
      if (!sl.date) return 'No date';
      const d = new Date(sl.date + 'T12:00:00');
      if (isNaN(d)) return 'No date';
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };
    const map = new Map();
    for (const sl of filtered) {
      const k = keyOf(sl);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(sl);
    }
    const CATCHALL = new Set(['No date', 'No service']);
    const entries = [...map.entries()].map(([key, items]) => ({ key, items }));
    entries.forEach(g => g.items.sort((a, b) => setlistStartMs(b) - setlistStartMs(a)));
    entries.sort((a, b) => {
      if (CATCHALL.has(a.key)) return 1;
      if (CATCHALL.has(b.key)) return -1;
      if (galleryGroup === 'service') return a.key.localeCompare(b.key);
      // month: newest first by the first item's start
      return (b.items[0] ? setlistStartMs(b.items[0]) : 0) - (a.items[0] ? setlistStartMs(a.items[0]) : 0);
    });
    return entries;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plus, galleryGroup, filtered, nowTs]);

  // Flat table rows
  const flatRows = useMemo(() => {
    const dir = sortAsc ? 1 : -1;
    const val = (s) =>
      sortMode === 'name' ? (s.name || '').toLowerCase() :
      sortMode === 'songs' ? songCount(s) :
      sortMode === 'duration' ? durationOf(s) :
      (s.date || '');
    return [...filtered].sort((a, b) => {
      const av = val(a), bv = val(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return cmp * dir;
    });
  // durationOf is stable within a render (derived from songMap); intentionally omitted.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortMode, sortAsc, songMap]);

  // Table view splits the (sorted) rows into Upcoming / Past. For the default
  // Date sort each group gets its own natural order — upcoming soonest-first,
  // past newest-day-first (AM before PM) — reversed when the user toggles the
  // Date header. Name/Songs sorts keep the uniform column order.
  const { tableUpcoming, tablePast } = useMemo(() => {
    const up = [], pa = [];
    flatRows.forEach(sl => { if (isUpcoming(sl)) up.push(sl); else pa.push(sl); });
    if (sortMode === 'date') {
      const flip = sortAsc ? -1 : 1;
      up.sort((a, b) => (setlistStartMs(a) - setlistStartMs(b)) * flip);
      pa.sort((a, b) => comparePast(a, b) * flip);
    }
    return { tableUpcoming: up, tablePast: pa };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatRows, nowTs, sortMode, sortAsc]);

  const handleSortClick = (modeKey) => {
    if (sortMode === modeKey) setSortAsc(p => !p);
    else { setSortMode(modeKey); setSortAsc(modeKey === 'name'); }
  };

  const closePeek = () => {
    if (isFullscreen) onToggleFullscreen?.();
    onSelectPreview?.(null);
  };

  // Phones can pick Cards / Compact / Table. Default per device: desktop/tablet
  // open in Table, phones open in Cards (the friendly default). Compact is
  // mobile-only; on desktop it falls back to the card gallery.
  const autoView = advanced ? 'table' : 'gallery';
  const vm = viewMode ?? autoView;
  // Table is desktop/tablet only — phones get Cards + Compact.
  const effectiveView = advanced
    ? (vm === 'compact' ? 'gallery' : vm)
    : (vm === 'table' ? 'gallery' : vm);
  const mobileTable = !advanced && effectiveView === 'table';
  const colFloor = (cls) => (mobileTable ? '' : cls);
  // Per-view card fields (Card vs Compact). Legacy array format applies to both.
  const cardViewKey = effectiveView === 'compact' ? 'compact' : 'card';
  const savedCardFields = Array.isArray(cardFieldsSaved) ? cardFieldsSaved : (cardFieldsSaved?.[cardViewKey] ?? null);
  const cardFields = resolveCardFields('setlists', savedCardFields);
  const setCardFieldsForView = (ids) => setCardFieldsSaved({
    ...(cardFieldsSaved && !Array.isArray(cardFieldsSaved) ? cardFieldsSaved : {}),
    [cardViewKey]: ids,
  });
  // Plus unifies the card gallery with the Songs list: divided rows (with a date
  // badge) instead of standalone cards. Non-plus keeps the standalone Play cards.
  const galleryVariant = plus ? 'row' : 'card';
  const galleryListClass = plus
    ? 'modes-card overflow-hidden divide-y divide-[var(--modes-border)]'
    : 'flex flex-col gap-4';

  // Shared view switcher — Table (desktop only) / Compact (mobile only) / Cards.
  const renderSwitcher = () => (
    <div className="flex items-center rounded-lg border border-[var(--modes-border)] overflow-hidden">
      {advanced && (
        <button onClick={() => setViewMode('table')} aria-label="Table view" title="Table view"
          className={cn('w-9 h-9 flex items-center justify-center cursor-pointer border-none transition-colors',
            effectiveView === 'table' ? 'bg-[var(--modes-surface-strong)] text-[var(--color-brand)]' : 'bg-transparent text-[var(--modes-text-muted)] hover:bg-[var(--modes-surface)]')}>
          <TableViewIcon />
        </button>
      )}
      <button onClick={() => setViewMode('compact')} aria-label="Compact list view" title="Compact list"
        className={cn('w-9 h-9 sm:hidden items-center justify-center cursor-pointer border-none transition-colors flex',
          vm === 'compact' ? 'bg-[var(--modes-surface-strong)] text-[var(--color-brand)]' : 'bg-transparent text-[var(--modes-text-muted)] hover:bg-[var(--modes-surface)]')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></svg>
      </button>
      <button onClick={() => setViewMode('gallery')} aria-label="Card view" title="Card view"
        className={cn('w-9 h-9 flex items-center justify-center cursor-pointer border-none transition-colors',
          effectiveView === 'gallery' ? 'bg-[var(--modes-surface-strong)] text-[var(--color-brand)]' : 'bg-transparent text-[var(--modes-text-muted)] hover:bg-[var(--modes-surface)]')}>
        <GalleryViewIcon />
      </button>
    </div>
  );

  // Shared filters popover — reused in the desktop header + the mobile toolbar.
  // When plus, Status / When / Group-by live inside it too (calmer header).
  const filtersEl = (
    <SetlistFilters
      showService={showService}
      serviceOptions={serviceOptions}
      serviceFilter={serviceFilter}
      onSetService={setServiceFilter}
      allTags={allTags}
      selectedTags={selectedTags}
      onToggleTag={toggleTag}
      onClearTags={() => setSelectedTags([])}
      plus={plus}
      statusFilter={statusFilter}
      onSetStatus={setStatusFilter}
      dateFilter={dateFilter}
      onSetDate={(v) => setDateFilter(v)}
      groupBy={galleryGroup}
      onSetGroup={setGalleryGroup}
      groupOptions={plus && effectiveView === 'gallery'
        ? [[null, 'Auto'], ['month', 'Month'], ...(showService ? [['service', 'Service']] : [])]
        : []}
    />
  );
  const columnsEl = effectiveView === 'table' && onSetTableColumns ? (
    <ColumnsMenu
      table="setlists"
      context={colCtx}
      saved={tableColumns}
      onChange={(ids) => onSetTableColumns('setlists', ids)}
      orderable={plus}
    />
  ) : null;

  const cardFieldsEl = plus && effectiveView !== 'table' ? (
    <CardFieldsMenu kind="setlists" saved={savedCardFields} onChange={setCardFieldsForView} label={effectiveView === 'compact' ? 'Compact' : 'Card'} />
  ) : null;

  // A single Templates toggle button (Status/When/Group now live in the filters
  // popover). Only shown when templates exist.
  const templatesToggleEl = plus && templates.length > 0 ? (
    <button
      onClick={() => setShowTemplates(v => !v)}
      className={cn('h-9 px-4 rounded-lg border cursor-pointer flex items-center gap-2 text-label-14 transition-colors',
        showTemplates ? 'border-[var(--color-brand)] text-[var(--color-brand)] bg-[var(--modes-surface)]' : 'border-[var(--modes-border)] text-[var(--modes-text)] bg-[var(--modes-surface)] hover:bg-[var(--modes-surface-strong)]')}
    >
      Templates ({templates.length})
    </button>
  ) : null;

  // The Templates panel (setlistsLibraryPlus) — starting a fresh setlist from a
  // saved template.
  const templatesPanel = plus && showTemplates && templates.length > 0 ? (
    <div className="modes-card p-4 mb-5">
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-heading-16 font-bold text-[var(--modes-text)] m-0">Templates</h2>
        <span className="text-label-12 text-[var(--modes-text-dim)]">{templates.length}</span>
      </div>
      <div className="flex flex-col divide-y divide-[var(--modes-border)]">
        {templates.map(tpl => (
          <div key={tpl.id} className="flex items-center gap-3 py-2.5">
            <div className="flex-1 min-w-0">
              <div className="text-copy-15 font-semibold text-[var(--modes-text)] truncate">{tpl.name || 'Untitled template'}</div>
              <div className="text-label-12 text-[var(--modes-text-dim)]">{songCount(tpl)} songs</div>
            </div>
            {onNewFromTemplate && !readOnly && (
              <Button variant="brand" size="sm" onClick={() => onNewFromTemplate(tpl.id)}>Use</Button>
            )}
            {onDeleteSetlist && !readOnly && (
              <button onClick={() => onDeleteSetlist(tpl.id)} aria-label="Delete template" title="Delete template" className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer border-none bg-transparent text-[var(--modes-text-dim)] hover:bg-[var(--ds-red-100)] hover:text-[var(--ds-red-700)] transition-colors">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  // Selection
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const toggleSelect = (id, e) => { e?.stopPropagation(); setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };
  const toggleSelectGroup = (rows) => {
    const ids = rows.map(r => r.id);
    const allIn = ids.every(id => selectedSet.has(id));
    setSelected(prev => allIn ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]);
  };
  const clearSelection = () => setSelected([]);
  // iOS-style card selection (plus) + shared card props.
  const selectionActive = plus && !readOnly && selected.length > 0;
  const enterSelect = (id) => setSelected(prev => prev.includes(id) ? prev : [...prev, id]);
  const setlistCardPlus = (sl) => (plus ? {
    fields: cardFields,
    showPlay: false,
    selectable: !readOnly,
    selectActive: selectionActive,
    isSelected: selectedSet.has(sl.id),
    onToggleSelect: !readOnly ? () => toggleSelect(sl.id) : null,
    onLongPress: !readOnly ? () => enterSelect(sl.id) : null,
  } : {});
  const bulkDelete = () => {
    if (onDeleteSetlists) onDeleteSetlists(selected);
    else selected.forEach(id => onDeleteSetlist?.(id));
    clearSelection();
  };

  const renderRow = (sl) => {
    const isSel = selectedSet.has(sl.id);
    const isPreview = advanced && sl.id === previewSetlistId;
    return (
      <tr
        key={sl.id}
        role="button"
        onClick={(e) => onRowActivate(sl, e)}
        className={cn('group cursor-pointer border-b border-[var(--modes-border)] transition-colors',
          isSel || isPreview ? 'bg-[var(--modes-surface-strong)]' : 'hover:bg-[var(--modes-surface)]')}
      >
        <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
          {!readOnly && (
            <input type="checkbox" checked={isSel} onChange={(e) => toggleSelect(sl.id, e)} aria-label={`Select ${sl.name}`} className="w-4 h-4 rounded accent-[var(--color-brand)] cursor-pointer align-middle" />
          )}
        </td>
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-copy-15 font-semibold text-[var(--modes-text)] truncate">{sl.name || 'Untitled'}</span>
            {sl.status === 'draft' && (
              <span className="shrink-0 text-label-11 font-semibold px-1.5 py-0.5 rounded bg-[var(--ds-amber-100)] text-[var(--ds-amber-1000)] border border-[var(--ds-amber-400)]">Draft</span>
            )}
            {plus && !isUpcoming(sl) && (
              <span className="shrink-0 text-label-11 font-semibold px-1.5 py-0.5 rounded bg-[var(--modes-surface-strong)] text-[var(--modes-text-dim)] border border-[var(--modes-border)]">Past</span>
            )}
            {onSelectPreview && !isTablet && (
              <button onClick={(e) => openPeek(sl, e)} aria-label="Open in pane" title="Open in pane"
                className="hidden lg:inline-flex ml-auto items-center justify-center w-7 h-7 rounded-md border-none bg-transparent text-[var(--modes-text-muted)] opacity-0 group-hover:opacity-100 hover:bg-[var(--modes-surface-strong)] hover:text-[var(--modes-text)] transition-all cursor-pointer">
                <PaneIcon />
              </button>
            )}
          </div>
        </td>
        {showCol('date') && <td className="px-5 py-3.5 text-copy-14 text-[var(--modes-text-muted)] whitespace-nowrap">{formatDate(sl.date)}</td>}
        {showCol('songs') && <td className={cn('px-5 py-3.5 text-copy-14 text-[var(--modes-text-muted)]', colFloor('hidden md:table-cell'))}>{songCount(sl)}</td>}
        {showCol('duration') && (() => {
          const secs = durationOf(sl);
          return <td className={cn('px-5 py-3.5 text-copy-14 text-[var(--modes-text-muted)] tabular-nums whitespace-nowrap', colFloor('hidden lg:table-cell'))}>{secs > 0 ? formatTotalDuration(secs) : '—'}</td>;
        })()}
        {showSchedule && (() => {
          const st = scheduleStats[sl.id] || { total: 0, instrumentalists: 0, vocalists: 0 };
          const cell = (n) => n > 0
            ? <span className="text-copy-14 text-[var(--modes-text)] tabular-nums">{n}</span>
            : <span className="text-copy-14 text-[var(--modes-text-dim)]">—</span>;
          return (
            <>
              {showCol('instr') && <td className={cn('px-4 py-3.5', colFloor('hidden lg:table-cell'))}>{cell(st.instrumentalists)}</td>}
              {showCol('vocals') && <td className={cn('px-4 py-3.5', colFloor('hidden lg:table-cell'))}>{cell(st.vocalists)}</td>}
              {showCol('sched') && <td className={cn('px-4 py-3.5', colFloor('hidden lg:table-cell'))}>{cell(st.total)}</td>}
            </>
          );
        })()}
        {showService && showCol('service') && (
          <td className={cn('px-5 py-3.5', colFloor('hidden md:table-cell'))}>
            {sl.service
              ? <span className="text-label-12 px-2 py-0.5 rounded-full bg-[var(--modes-surface)] text-[var(--modes-text-muted)] border border-[var(--modes-border)] whitespace-nowrap">{sl.service}</span>
              : <span className="text-copy-14 text-[var(--modes-text-dim)]">—</span>}
          </td>
        )}
        {!splitDock && showCol('tags') && (
          <td className={cn('px-5 py-3.5', colFloor('hidden lg:table-cell'))}>
            <div className="flex flex-wrap gap-1">
              {(sl.tags || []).slice(0, 3).map(t => (
                <span key={t} className="text-label-12 px-2 py-0.5 rounded-full bg-[var(--modes-surface)] text-[var(--modes-text-muted)] border border-[var(--modes-border)]">{t}</span>
              ))}
            </div>
          </td>
        )}
      </tr>
    );
  };

  return (
    <div data-theme-variant="modes" className={cn(splitDock ? 'absolute inset-0 flex overflow-hidden' : 'relative min-h-full')}>
      {/* List column — own scroller when a pane is docked beside it. */}
      <div className={splitDock ? 'flex-1 min-w-0 min-h-0 overflow-y-auto' : 'contents'}>
      {/* Header — same frosted sticky band + control layout as the Songs
          library (h1 + search hidden on phones; controls always shown). */}
      <div className="sticky top-0 z-20 backdrop-blur-md bg-[color-mix(in_srgb,var(--ds-background-100)_80%,transparent)] border-b border-[var(--modes-border)]">
        <div className="w-full max-w-[1320px] mx-auto px-5 sm:px-8 pt-5 sm:pt-7 pb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-heading-32 font-bold text-[var(--modes-text)] m-0 mr-2 hidden sm:block">Setlists</h1>
          <SearchBar
            className="flex-1 min-w-[200px] hidden sm:flex"
            placeholder="Search setlists & songs…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />

          {renderSwitcher()}

          {filtersEl}

          {columnsEl}
          {cardFieldsEl}

          {!readOnly && (
            <div className="hidden lg:flex items-center gap-2 shrink-0">
              {onImportSetlist && (
                <IconButton variant="default" size="sm" onClick={() => fileInputRef.current?.click()} aria-label="Import .zip" title="Import .zip">
                  {/* Folder + down arrow — "import a file into the library". */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8a2 2 0 0 1 2-2h3.6a1 1 0 0 1 .7.3L11 8h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <path d="M12 11v5" /><path d="m9.5 13.5 2.5 2.5 2.5-2.5" />
                  </svg>
                </IconButton>
              )}
              {onNewSetlist && (
                <Button variant="brand" size="sm" onClick={onNewSetlist}>+ New Setlist</Button>
              )}
            </div>
          )}
          {templatesToggleEl}
        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-[1320px] mx-auto px-5 sm:px-8 py-5">
        {templatesPanel}
        {plus && !query && statusFilter === 'all' && dateFilter === 'all' && upcoming.length > 0 && (() => {
          const next = upcoming[0];
          const d = next.date ? new Date(next.date + 'T12:00:00') : null;
          const valid = d && !isNaN(d);
          const timeStr = formatClockTime(next.time, clockFormat);
          return (
            <div
              role="button"
              onClick={() => onRowActivate(next)}
              className="rounded-2xl p-5 sm:p-6 mb-6 flex items-center gap-5 cursor-pointer relative overflow-hidden border border-[color-mix(in_srgb,var(--color-brand)_30%,transparent)]"
              style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-brand) 20%, var(--ds-background-100)) 0%, var(--ds-background-100) 55%)' }}
            >
              {/* Calendar tile */}
              <div className="shrink-0 w-16 h-16 rounded-2xl bg-[var(--color-brand)] text-white flex flex-col items-center justify-center shadow-md">
                <span className="text-[10px] uppercase tracking-wide leading-none opacity-90">{valid ? d.toLocaleDateString('en-US', { month: 'short' }) : '—'}</span>
                <span className="text-heading-24 font-bold leading-none mt-0.5">{valid ? d.getDate() : '·'}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-label-11 uppercase tracking-[0.16em] text-[var(--color-brand)] font-semibold mb-1">Next up</div>
                <div className="text-heading-22 sm:text-heading-24 font-bold text-[var(--modes-text)] truncate leading-tight">{next.name || 'Untitled setlist'}</div>
                <div className="text-label-13 text-[var(--modes-text-muted)] mt-1 truncate">
                  {valid ? d.toLocaleDateString('en-US', { weekday: 'long' }) : formatDate(next.date)}
                  {timeStr ? ` · ${timeStr}` : ''}
                  {next.service ? ` · ${next.service}` : ''}
                  {next.location ? ` · ${next.location}` : ''}
                </div>
              </div>
              <Button variant="brand" size="sm" onClick={(e) => { e.stopPropagation(); onPlaySetlist(next); }} className="shrink-0 hidden sm:inline-flex">Play Live</Button>
            </div>
          );
        })()}
        {!loaded ? (
          <SkeletonRows />
        ) : filtered.length === 0 ? (
          (query || selectedTags.length > 0 || (showService && serviceFilter !== 'all') || statusFilter !== 'all' || dateFilter !== 'all') ? (
            <div className="modes-card py-14 text-center flex flex-col items-center gap-3 border-dashed">
              <p className="text-copy-14 text-[var(--modes-text-muted)] font-medium">No setlists matching your search.</p>
            </div>
          ) : (
            <div className="modes-card py-16 px-6 flex flex-col items-center text-center border-dashed">
              <div className="w-14 h-14 mb-4 rounded-full bg-[var(--modes-surface-strong)] border border-[var(--modes-border)] flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--modes-text-muted)]">
                  <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </div>
              <h2 className="text-heading-20 text-[var(--modes-text)] m-0 mb-1.5">No setlists yet</h2>
              <p className="text-copy-14 text-[var(--modes-text-muted)] max-w-sm mb-5">Organize your songs into setlists for rehearsals or live performances.</p>
              {canEdit && (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="brand" onClick={onNewSetlist}>Create setlist</Button>
                  <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Import .zip</Button>
                </div>
              )}
            </div>
          )
        ) : effectiveView === 'table' ? (
          <div className="flex flex-col gap-8">
            {tableUpcoming.length > 0 && (
              <TableGroup
                title="Upcoming"
                count={tableUpcoming.length}
                rows={tableUpcoming}
                renderRow={renderRow}
                readOnly={readOnly}
                allChecked={tableUpcoming.every(s => selectedSet.has(s.id))}
                onToggleAll={() => toggleSelectGroup(tableUpcoming)}
                sortMode={sortMode}
                sortAsc={sortAsc}
                onSort={handleSortClick}
                compact={splitDock}
                showService={showService}
                showSchedule={showSchedule}
                visibleCols={columnVisible}
                mobileScroll={mobileTable}
              />
            )}
            {tablePast.length > 0 && (
              <TableGroup
                title="Past"
                count={tablePast.length}
                rows={tablePast}
                renderRow={renderRow}
                readOnly={readOnly}
                allChecked={tablePast.every(s => selectedSet.has(s.id))}
                onToggleAll={() => toggleSelectGroup(tablePast)}
                sortMode={sortMode}
                sortAsc={sortAsc}
                onSort={handleSortClick}
                compact={splitDock}
                showService={showService}
                showSchedule={showSchedule}
                visibleCols={columnVisible}
                mobileScroll={mobileTable}
              />
            )}
          </div>
        ) : effectiveView === 'compact' ? (
          <div className="flex flex-col gap-6">
            {upcoming.length > 0 && (
              <section className="flex flex-col gap-3">
                <div className="flex items-baseline gap-2 px-1">
                  <h2 className="text-heading-20 font-bold text-[var(--modes-text)] m-0">Upcoming</h2>
                  <span className="text-label-12 text-[var(--modes-text-dim)]">{upcoming.length}</span>
                </div>
                <div className="modes-card overflow-hidden divide-y divide-[var(--modes-border)]" style={{ borderColor: 'var(--modes-border)' }}>
                  {upcoming.map(sl => (
                    <SetlistCard key={sl.id} setlist={sl} variant="compact" selected={advanced && sl.id === previewSetlistId} onPlay={() => onPlaySetlist(sl)} onView={() => onRowActivate(sl)} clockFormat={clockFormat} durationLabel={durLabel(sl)} {...setlistCardPlus(sl)} />
                  ))}
                </div>
              </section>
            )}
            {past.length > 0 && (
              <section className="flex flex-col gap-3">
                <div className="flex items-baseline gap-2 px-1">
                  <h2 className="text-heading-20 font-bold text-[var(--modes-text)] m-0">Past</h2>
                  <span className="text-label-12 text-[var(--modes-text-dim)]">{past.length}</span>
                </div>
                <div className="modes-card overflow-hidden divide-y divide-[var(--modes-border)]" style={{ borderColor: 'var(--modes-border)' }}>
                  {past.map(sl => (
                    <SetlistCard key={sl.id} setlist={sl} variant="compact" selected={advanced && sl.id === previewSetlistId} onPlay={() => onPlaySetlist(sl)} onView={() => onRowActivate(sl)} clockFormat={clockFormat} durationLabel={durLabel(sl)} {...setlistCardPlus(sl)} />
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : customGroups ? (
          <div className="flex flex-col gap-10">
            {customGroups.map(group => (
              <section key={group.key} className="flex flex-col gap-4">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-heading-20 font-bold text-[var(--modes-text)] m-0">{group.key}</h2>
                  <span className="text-label-12 text-[var(--modes-text-dim)]">{group.items.length}</span>
                </div>
                <div className={galleryListClass}>
                  {group.items.map(sl => (
                    <SetlistCard key={sl.id} setlist={sl} variant={galleryVariant} selected={advanced && sl.id === previewSetlistId} onPlay={() => onPlaySetlist(sl)} onView={() => onRowActivate(sl)} clockFormat={clockFormat} durationLabel={durLabel(sl)} {...setlistCardPlus(sl)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {upcoming.length > 0 && (
              <section className="flex flex-col gap-4">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-heading-20 font-bold text-[var(--modes-text)] m-0">Upcoming</h2>
                  <span className="text-label-12 text-[var(--modes-text-dim)]">{upcoming.length}</span>
                </div>
                <div className={galleryListClass}>
                  {upcoming.map(sl => (
                    <SetlistCard key={sl.id} setlist={sl} variant={galleryVariant} selected={advanced && sl.id === previewSetlistId} onPlay={() => onPlaySetlist(sl)} onView={() => onRowActivate(sl)} clockFormat={clockFormat} durationLabel={durLabel(sl)} {...setlistCardPlus(sl)} />
                  ))}
                </div>
              </section>
            )}
            {past.length > 0 && (
              <section className="flex flex-col gap-4">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-heading-20 font-bold text-[var(--modes-text)] m-0">Past</h2>
                  <span className="text-label-12 text-[var(--modes-text-dim)]">{past.length}</span>
                </div>
                <div className={galleryListClass}>
                  {past.map(sl => (
                    <SetlistCard key={sl.id} setlist={sl} variant={galleryVariant} selected={advanced && sl.id === previewSetlistId} onPlay={() => onPlaySetlist(sl)} onView={() => onRowActivate(sl)} clockFormat={clockFormat} durationLabel={durLabel(sl)} {...setlistCardPlus(sl)} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      </div>{/* /list column */}

      {/* Pinned detail pane — tablet landscape (Phase 3 two-pane split) */}
      {splitDock && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize preview"
          onPointerDown={onPaneResize}
          className="shrink-0 w-1.5 self-stretch cursor-col-resize relative group"
        >
          <span className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-[var(--ds-gray-300)] group-hover:bg-[var(--color-brand)] transition-colors" />
        </div>
      )}

      {splitDock && (
        <aside
          style={{ width: paneWidth }}
          className="h-full min-h-0 shrink-0 border-l border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] overflow-hidden flex flex-col"
        >
          {previewSetlist ? (
            <Suspense fallback={<div className="p-8 text-copy-14 text-[var(--ds-gray-700)]">Loading…</div>}>
              <SetlistOverview
                key={previewSetlist.id}
                setlist={previewSetlist}
                embedded
                hidePlay={isTablet}
                songs={songs}
                clockFormat={clockFormat}
                v2={overviewV2}
                setlists={setlists}
                overscheduleWarn={overscheduleWarn}
                streakLimit={streakLimit}
                onBack={closePeek}
                onToggleFullscreen={onToggleFullscreen}
                onEdit={canEdit ? () => onEditSetlist?.(previewSetlist) : undefined}
                onExportZip={() => onExportSetlistZip?.(previewSetlist)}
                onExportPdfOverview={() => onExportSetlistPdfOverview?.(previewSetlist)}
                onExportPdfFull={() => onExportSetlistPdfFull?.(previewSetlist)}
                onPlay={() => onPlaySetlist(previewSetlist)}
                onPractice={(i) => onPracticeSetlist?.(previewSetlist, i)}
                onDelete={canEdit ? () => onDeleteSetlist?.(previewSetlist.id) : undefined}
                isFullscreen={false}
                canEdit={canEdit}
              />
            </Suspense>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-3">
              <div className="w-12 h-12 rounded-full bg-[var(--modes-surface-strong)] border border-[var(--modes-border)] flex items-center justify-center">
                <PaneIcon />
              </div>
              <p className="text-copy-14 text-[var(--modes-text-muted)] m-0">Select a setlist to preview it here.</p>
            </div>
          )}
        </aside>
      )}

      {/* FAB — narrow mouse-driven windows only. Touch tablets get the
          bottom-nav FAB instead, so gating on !isTablet avoids a duplicate. */}
      {!readOnly && (onNewSetlist || onImportSetlist) && !isTablet && (
        <div ref={fabRef} className="fixed right-6 z-[150] hidden sm:block lg:hidden" style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
          {fabOpen && (
            <div className="absolute bottom-full right-0 mb-3 flex flex-col gap-2">
              {onNewSetlist && (
                <button onClick={() => { setFabOpen(false); onNewSetlist(); }} className="px-5 py-3 rounded-xl bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] shadow-lg cursor-pointer hover:border-[var(--ds-gray-600)] transition-all duration-150 whitespace-nowrap text-label-14 text-[var(--text-1)] text-left">Create Setlist</button>
              )}
              {onImportSetlist && (
                <button onClick={() => { setFabOpen(false); fileInputRef.current?.click(); }} className="px-5 py-3 rounded-xl bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] shadow-lg cursor-pointer hover:border-[var(--ds-gray-600)] transition-all duration-150 whitespace-nowrap text-label-14 text-[var(--text-1)] text-left">Import Setlist</button>
              )}
            </div>
          )}
          <button onClick={() => setFabOpen(!fabOpen)} className="w-14 h-14 rounded-full bg-[var(--color-brand)] text-white shadow-lg flex items-center justify-center cursor-pointer hover:opacity-90 transition-all duration-150 active:scale-95 border-none">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${fabOpen ? 'rotate-45' : ''}`}>
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept=".zip" onChange={(e) => { const file = e.target.files[0]; if (file) onImportSetlist?.(file); e.target.value = ''; }} className="hidden" />

      {/* Bulk action bar — desktop + tablet, plus phones when setlistsLibraryPlus
          multi-select is active (long-press a card). Lift above the bottom nav. */}
      {!readOnly && selected.length > 0 && (advanced || plus) && (
        <div
          ref={bulkBarRef}
          className="fixed left-1/2 -translate-x-1/2 bottom-6 z-[160] flex items-center gap-2 pl-4 pr-2 py-2 rounded-full bg-[var(--ds-background-200)] border border-[var(--ds-gray-300)] shadow-2xl max-w-[calc(100vw-1rem)] flex-wrap justify-center"
          style={(!advanced || isTablet) ? { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' } : undefined}
        >
          <span className="text-label-14 font-semibold text-[var(--ds-gray-1000)] whitespace-nowrap">{selected.length} selected</span>
          <span className="w-px h-5 bg-[var(--ds-gray-300)]" />

          {plus && onTagSetlists && (
            <div className="relative">
              <button onClick={() => setBulkMenu(bulkMenu === 'tags' ? null : 'tags')} className="h-8 px-3 rounded-full text-label-14 font-medium cursor-pointer border-none bg-transparent text-[var(--ds-gray-900)] hover:bg-[var(--ds-gray-200)] transition-colors">Tags…</button>
              {bulkMenu === 'tags' && (
                <div className="absolute bottom-full mb-2 left-0 w-[260px] rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] shadow-lg p-3 flex flex-col gap-2">
                  <form
                    onSubmit={(e) => { e.preventDefault(); const t = bulkTagInput.trim(); if (t) { onTagSetlists(selected, { add: [t] }); setBulkTagInput(''); setBulkMenu(null); clearSelection(); } }}
                    className="flex gap-2"
                  >
                    <input value={bulkTagInput} onChange={(e) => setBulkTagInput(e.target.value)} placeholder="Add a tag…" autoFocus
                      className="flex-1 min-w-0 h-8 px-2.5 rounded-lg border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] text-label-14 text-[var(--ds-gray-1000)] outline-none focus:border-[var(--color-brand)]" />
                    <button type="submit" className="h-8 px-3 rounded-lg text-label-14 font-medium cursor-pointer border-none bg-[var(--color-brand)] text-white">Add</button>
                  </form>
                  {allTags.length > 0 && (
                    <div className="max-h-[160px] overflow-y-auto flex flex-col">
                      <div className="text-label-11 uppercase tracking-wider text-[var(--ds-gray-600)] px-0.5 pb-1">Remove a tag</div>
                      {allTags.map(t => (
                        <button key={t} onClick={() => { onTagSetlists(selected, { remove: [t] }); setBulkMenu(null); clearSelection(); }} className="w-full text-left px-2 py-1.5 rounded-md cursor-pointer border-none bg-transparent text-label-14 text-[var(--ds-gray-900)] hover:bg-[var(--ds-red-100)] hover:text-[var(--ds-red-700)] transition-colors flex items-center gap-2">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {plus && onDuplicateSetlist && selected.length === 1 && (
            <button onClick={() => { onDuplicateSetlist(selected[0]); clearSelection(); }} className="h-8 px-3 rounded-full text-label-14 font-medium cursor-pointer border-none bg-transparent text-[var(--ds-gray-900)] hover:bg-[var(--ds-gray-200)] transition-colors">Duplicate</button>
          )}

          {plus && onSaveAsTemplate && selected.length === 1 && (
            <button onClick={() => { onSaveAsTemplate(selected[0]); clearSelection(); }} className="h-8 px-3 rounded-full text-label-14 font-medium cursor-pointer border-none bg-transparent text-[var(--ds-gray-900)] hover:bg-[var(--ds-gray-200)] transition-colors">Save as template</button>
          )}

          {onDeleteSetlist && (
            <button onClick={bulkDelete} className="h-8 px-3 rounded-full text-label-14 font-medium cursor-pointer border-none bg-transparent text-[var(--ds-red-700)] hover:bg-[var(--ds-red-100)] transition-colors">Delete</button>
          )}
          <button onClick={clearSelection} aria-label="Clear selection" className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer border-none bg-transparent text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>
      )}

      {/* Right-side overlay peek — desktop + tablet portrait (landscape docks) */}
      <SidePeek
        open={advanced && !!previewSetlist && !splitDock}
        onClose={closePeek}
        expanded={isFullscreen}
        label="Setlist preview"
      >
        {previewSetlist && (
          <Suspense fallback={<div className="p-8 text-copy-14 text-[var(--ds-gray-700)]">Loading…</div>}>
            <SetlistOverview
              key={previewSetlist.id}
              setlist={previewSetlist}
              embedded
              hidePlay={isTablet}
              songs={songs}
              clockFormat={clockFormat}
              onBack={closePeek}
              onToggleFullscreen={onToggleFullscreen}
              onEdit={canEdit ? () => onEditSetlist?.(previewSetlist) : undefined}
              onExportZip={() => onExportSetlistZip?.(previewSetlist)}
              onExportPdfOverview={() => onExportSetlistPdfOverview?.(previewSetlist)}
              onExportPdfFull={() => onExportSetlistPdfFull?.(previewSetlist)}
              onPlay={() => onPlaySetlist(previewSetlist)}
              onPractice={(i) => onPracticeSetlist?.(previewSetlist, i)}
              onDelete={canEdit ? () => onDeleteSetlist?.(previewSetlist.id) : undefined}
              isFullscreen={isFullscreen}
              canEdit={canEdit}
            />
          </Suspense>
        )}
      </SidePeek>
    </div>
  );
}
