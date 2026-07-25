import React, { useState, useEffect, useRef, useMemo, useDeferredValue, lazy, Suspense } from 'react';
import SongCard from './SongCard';
import SidePeek from './shell/SidePeek';
import { Button } from './ui/Button';
import WorkspacePickerDialog from './ui/WorkspacePickerDialog';
import { SearchBar } from './ui/SearchBar';
import { cn } from '../lib/utils';
import { searchSongs, normalizeText } from '../lib/search';
import { buildFacetOptions, matchesFacets, countActiveFacets } from '../lib/songFacets';
import LibraryFilters from './library/LibraryFilters';
import { orderedVisibleColumns } from '../lib/tableColumns';
import ColumnsMenu from './ui/ColumnsMenu';
import CardFieldsMenu from './ui/CardFieldsMenu';
import { SelectionBar } from './ui/SelectionBar';
import { selectionActionClass, selectionDangerClass } from '../lib/glass';
import { resolveCardFields } from '../lib/cardFields';
import { useIsDesktop, useIsTablet } from '../lib/useMediaQuery';
import { usePersistentView, usePersistentJSON } from '../lib/usePersistentView';
import {
  buildSongUsage,
  DATA_QUALITY,
  matchesDataQuality,
  songColumnValue,
} from '../lib/libraryPlus';
import { splitMulti } from '../lib/songFacets';

const ChartView = lazy(() => import('./ChartView'));

const SORT_MODES = [
  { key: 'title', label: 'Title' },
  { key: 'artist', label: 'Artist' },
  { key: 'key', label: 'Key' },
];

function defaultArrangement(song) {
  if (!Array.isArray(song?.arrangements)) return song || {};
  return song.arrangements.find(a => a.id === song.defaultArrangementId) || song.arrangements[0] || song;
}
function defaultArrangementKey(song) {
  return defaultArrangement(song).key || song?.key || 'C';
}
function defaultArrangementTempo(song) {
  return defaultArrangement(song).tempo ?? song?.tempo ?? null;
}
function formatUpdated(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getGroupKey(song, groupMode) {
  if (groupMode === 'title') {
    // Fold accents so "Împărate" groups under I (not #); digits/symbols → #.
    const first = normalizeText(song.title || '')[0];
    return first && /[a-z]/.test(first) ? first.toUpperCase() : '#';
  }
  if (groupMode === 'artist') {
    return (song.artist || 'Unknown').trim();
  }
  if (groupMode === 'key') {
    return defaultArrangementKey(song).replace(/[#bmb]/g, '').toUpperCase();
  }
  if (groupMode === 'theme') {
    const themes = splitMulti(song.themes, song.genres);
    return themes[0] || 'No theme';
  }
  if (groupMode === 'year') {
    return song.year ? String(song.year).trim() : 'No year';
  }
  return '#';
}

function groupAndSort(songs, groupMode, sortAsc) {
  const groups = {};
  songs.forEach(song => {
    const key = getGroupKey(song, groupMode);
    if (!groups[key]) groups[key] = [];
    groups[key].push(song);
  });

  const dir = sortAsc ? 1 : -1;
  const CATCHALL = new Set(['#', 'No theme', 'No year', 'Unknown']);

  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (CATCHALL.has(a)) return 1;
    if (CATCHALL.has(b)) return -1;
    if (groupMode === 'key') {
      const order = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
      return (order.indexOf(a) - order.indexOf(b)) * dir;
    }
    if (groupMode === 'year') {
      return (Number(b) - Number(a)) * dir; // newest first
    }
    return a.localeCompare(b) * dir;
  });

  sortedKeys.forEach(key => {
    groups[key].sort((a, b) => (a.title || '').localeCompare(b.title || '') * dir);
  });

  return { groups, sortedKeys };
}

// Flat sort for the table view (no letter grouping). Numeric modes (tempo /
// year / updated / usage) compare as numbers; the rest fold to strings. Ties
// break on title so the order is stable.
function flatSort(songs, sortMode, sortAsc, usage) {
  const dir = sortAsc ? 1 : -1;
  const numeric = new Set(['tempo', 'year', 'updated', 'usage']);
  const num = (s) =>
    sortMode === 'tempo' ? (defaultArrangementTempo(s) ?? -1) :
    sortMode === 'year' ? (Number(s.year) || -1) :
    sortMode === 'updated' ? (s.updatedAt || 0) :
    sortMode === 'usage' ? (usage?.get(s.id) || 0) :
    0;
  const str = (s) =>
    sortMode === 'artist' ? (s.artist || '') :
    sortMode === 'key' ? defaultArrangementKey(s) :
    (s.title || '');
  return [...songs].sort((a, b) => {
    let cmp;
    if (numeric.has(sortMode)) cmp = num(a) - num(b);
    else cmp = str(a).localeCompare(str(b));
    if (cmp === 0) cmp = (a.title || '').localeCompare(b.title || '');
    return cmp * dir;
  });
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-8">
      {[1, 2, 3].map(g => (
        <div key={g} className="flex flex-col gap-3">
          <div className="h-5 w-8 bg-[var(--modes-surface-strong)] rounded animate-pulse mx-1" />
          <div className="modes-card overflow-hidden divide-y divide-[var(--modes-border)]" style={{ borderColor: 'var(--modes-border)' }}>
            {[1, 2, 3].map(r => (
              <div key={r} className="flex items-center justify-between px-5 py-4">
                <div className="flex flex-col gap-2 flex-1">
                  <div className="h-4 w-40 bg-[var(--modes-surface-strong)] rounded animate-pulse" />
                  <div className="h-3 w-24 bg-[var(--modes-surface-strong)] rounded animate-pulse" />
                </div>
                <div className="flex gap-2 ml-4">
                  <div className="h-3 w-6 bg-[var(--modes-surface-strong)] rounded animate-pulse" />
                  <div className="h-3 w-14 bg-[var(--modes-surface-strong)] rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Media-card skeletons (songsLibraryPlus) — mirror the grid so there's no
// Active-filter pills (songsLibraryPlus) — the current facet/tag selections as
// removable chip-cards, so the active filter set reads as its own row.
function ActiveFacetChips({ facetSel, selectedTags, onRemoveFacet, onRemoveTag, onClearAll }) {
  const chips = [];
  for (const [facetKey, values] of Object.entries(facetSel || {})) {
    (values || []).forEach(v => chips.push({ id: `${facetKey}:${v}`, label: v, onRemove: () => onRemoveFacet(facetKey, v) }));
  }
  (selectedTags || []).forEach(t => chips.push({ id: `tag:${t}`, label: `#${t}`, onRemove: () => onRemoveTag(t) }));
  if (chips.length === 0) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      {chips.map(c => (
        <button
          key={c.id}
          onClick={c.onRemove}
          className="inline-flex items-center gap-1.5 pl-3 pr-2 h-8 rounded-full modes-card-strong text-label-13 text-[var(--modes-text)] hover:border-[var(--color-brand)] transition-colors cursor-pointer"
        >
          {c.label}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--modes-text-dim)]"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </button>
      ))}
      <button onClick={onClearAll} className="text-label-13 text-[var(--modes-text-muted)] hover:text-[var(--modes-text)] underline underline-offset-2 cursor-pointer bg-transparent border-none">Clear all</button>
    </div>
  );
}

const INITIAL_VISIBLE = 100;
const VISIBLE_PAGE_SIZE = 100;

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
// Open-in-pane (split panel) icon, per row.
const PaneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="15" y1="3" x2="15" y2="21" />
  </svg>
);
// Layers icon for the arrangement-count indicator.
const ArrangementsIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" />
  </svg>
);

function KeyChip({ value }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[26px] h-6 px-1.5 rounded-md bg-[var(--modes-surface-strong)] text-[var(--color-brand)] text-label-12 font-bold">
      {value}
    </span>
  );
}

function ArrangementsBadge({ count }) {
  if (!count || count < 2) return null;
  return (
    <span
      className="shrink-0 inline-flex items-center gap-1 text-label-12 px-1.5 py-0.5 rounded bg-[var(--modes-surface-strong)] text-[var(--modes-text-dim)]"
      title={`${count} arrangements`}
    >
      <ArrangementsIcon />
      {count}
    </span>
  );
}

function SortArrow({ asc }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={asc ? '' : 'rotate-180'}>
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

// A tiny pill list for the multi-value metadata columns (Themes/Language/…).
function MiniTags({ values, max = 2 }) {
  if (!values || values.length === 0) return <span className="text-[var(--modes-text-dim)]">—</span>;
  const shown = values.slice(0, max);
  const rest = values.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {shown.map(v => (
        <span key={v} className="text-label-12 px-2 py-0.5 rounded-full bg-[var(--modes-surface)] text-[var(--modes-text-muted)] border border-[var(--modes-border)] whitespace-nowrap">{v}</span>
      ))}
      {rest > 0 && <span className="text-label-12 text-[var(--modes-text-dim)]">+{rest}</span>}
    </div>
  );
}

// Row-density segmented control (songsLibraryPlus, table view).
// Per-column render config for the Songs table. `sortKey` (when set) makes the
// header a sort toggle; `floor` is the responsive-visibility class applied on
// desktop (dropped in mobile-table mode). The Name column is rendered
// separately (always first). Extra ids beyond artist/key/tags/tempo/updated are
// unlocked by the songsLibraryPlus flag.
const LIB_COL = {
  artist:       { header: 'Artist', sortKey: 'artist', width: 'w-[200px]', px: 200, floor: 'hidden md:table-cell' },
  key:          { header: 'Key', sortKey: 'key', width: 'w-[72px]', px: 72 },
  tempo:        { header: 'Tempo', sortKey: 'tempo', width: 'w-[90px]', px: 90, floor: 'hidden lg:table-cell' },
  usage:        { header: 'Setlists', sortKey: 'usage', width: 'w-[92px]', px: 92, floor: 'hidden lg:table-cell' },
  tags:         { header: 'Tags', width: 'w-[200px]', px: 200, floor: 'hidden lg:table-cell' },
  ccli:         { header: 'CCLI', width: 'w-[112px]', px: 112, floor: 'hidden lg:table-cell' },
  year:         { header: 'Year', sortKey: 'year', width: 'w-[74px]', px: 74, floor: 'hidden lg:table-cell' },
  capo:         { header: 'Capo', width: 'w-[64px]', px: 64, floor: 'hidden xl:table-cell' },
  duration:     { header: 'Length', width: 'w-[84px]', px: 84, floor: 'hidden xl:table-cell' },
  arrangements: { header: 'Arr.', width: 'w-[64px]', px: 64, floor: 'hidden xl:table-cell' },
  themes:       { header: 'Themes', width: 'w-[190px]', px: 190, floor: 'hidden xl:table-cell' },
  language:     { header: 'Language', width: 'w-[120px]', px: 120, floor: 'hidden xl:table-cell' },
  scripture:    { header: 'Scripture', width: 'w-[150px]', px: 150, floor: 'hidden xl:table-cell' },
  updated:      { header: 'Updated', sortKey: 'updated', width: 'w-[130px]', px: 130, floor: 'hidden xl:table-cell' },
};

// Cell content for a Songs-table column id.
function songCellContent(id, song, usage) {
  switch (id) {
    case 'artist': return <span className="text-copy-14 text-[var(--modes-text-muted)] truncate">{song.artist}</span>;
    case 'key': return <KeyChip value={defaultArrangementKey(song)} />;
    case 'tempo': return <span className="text-copy-14 text-[var(--modes-text-muted)] tabular-nums">{defaultArrangementTempo(song) || '—'}</span>;
    case 'usage': {
      const n = usage?.get(song.id) || 0;
      return n > 0
        ? <span className="text-copy-14 text-[var(--modes-text)] tabular-nums">{n}</span>
        : <span className="text-copy-14 text-[var(--modes-text-dim)]">—</span>;
    }
    case 'tags': return (
      <div className="flex flex-wrap gap-1">
        {(song.tags || []).slice(0, 3).map(t => (
          <span key={t} className="text-label-12 px-2 py-0.5 rounded-full bg-[var(--modes-surface)] text-[var(--modes-text-muted)] border border-[var(--modes-border)]">{t}</span>
        ))}
      </div>
    );
    case 'ccli': {
      const v = songColumnValue(song, 'ccli');
      return v ? <span className="text-copy-13 font-mono text-[var(--modes-text-muted)] truncate">{v}</span> : <span className="text-[var(--modes-text-dim)]">—</span>;
    }
    case 'year': {
      const v = songColumnValue(song, 'year');
      return v ? <span className="text-copy-14 text-[var(--modes-text-muted)] tabular-nums">{v}</span> : <span className="text-[var(--modes-text-dim)]">—</span>;
    }
    case 'capo': {
      const v = songColumnValue(song, 'capo');
      return v ? <span className="text-copy-14 text-[var(--modes-text-muted)] tabular-nums">{v}</span> : <span className="text-[var(--modes-text-dim)]">—</span>;
    }
    case 'duration': {
      const v = songColumnValue(song, 'duration');
      return v ? <span className="text-copy-14 text-[var(--modes-text-muted)] tabular-nums">{v}</span> : <span className="text-[var(--modes-text-dim)]">—</span>;
    }
    case 'arrangements': {
      const n = songColumnValue(song, 'arrangements');
      return <span className="text-copy-14 text-[var(--modes-text-muted)] tabular-nums">{n}</span>;
    }
    case 'themes': return <MiniTags values={songColumnValue(song, 'themes')} />;
    case 'language': return <MiniTags values={songColumnValue(song, 'language')} max={2} />;
    case 'scripture': return <MiniTags values={songColumnValue(song, 'scripture')} max={1} />;
    case 'updated': return <span className="text-copy-14 text-[var(--modes-text-muted)] whitespace-nowrap">{formatUpdated(song.updatedAt)}</span>;
    default: return null;
  }
}

export default function Library({
  songs,
  loaded = true,
  onSelectSong,
  onNewSong,
  previewSongId = null,
  onSelectPreview,
  isFullscreen = false,
  onToggleFullscreen,
  onEditSong,
  readOnly = false,
  chartDefaults = {},
  canEdit = true,
  // Bulk actions
  setlists = [],
  workspaces = [],
  activeLibrary = 'personal',
  onDeleteSongs,
  onMoveSongs,
  onCopySongs,
  onAddSongsToSetlist,
  onTagSongs,
  tableColumns,
  onSetTableColumns,
  chartMoveCopy,
  plus = false,
}) {
  // Responsive shell. Touch tablets (pointer: coarse) get the two-pane master-
  // detail; true desktops (fine pointer) keep the Phase 1 overlay peek.
  const wide = useIsDesktop();              // ≥ 1024px
  const isTablet = useIsTablet();           // touch tablet, 768–1366px
  const isDesktop = wide && !isTablet;      // mouse-driven desktop
  const advanced = isDesktop || isTablet;   // table view + master-detail
  // Tablet two-pane split removed — songs now open in the full Song Hub. The
  // desktop side-peek (explicit per-row button) stays. Kept as a const so the
  // column-visibility guards (`!splitDock`) read cleanly.
  const splitDock = false;

  const previewSong = useMemo(
    () => songs.find(s => s.id === previewSongId) || null,
    [songs, previewSongId],
  );

  // Row click opens the full chart; a dedicated row button opens the peek.
  const openFull = (song) => onSelectSong?.(song);
  const openPeek = (song, e) => {
    e?.stopPropagation();
    onSelectPreview?.(song.id);
  };

  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState('title');
  const [sortAsc, setSortAsc] = useState(true);
  // Persisted per device (localStorage); null = auto per-device default.
  const [viewMode, setViewMode] = usePersistentView('setlists-md:songs-view'); // 'table' | 'compact' | 'gallery'
  const [selectedTags, setSelectedTags] = useState([]);
  const [facetSel, setFacetSel] = useState({}); // { facetKey: string[] }
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [selected, setSelected] = useState([]);
  const [bulkMenu, setBulkMenu] = useState(null); // 'setlist' | 'tags' | null
  const [bulkPicker, setBulkPicker] = useState(null); // 'copy' | 'move' | null — workspace modal
  // songsLibraryPlus state — data-quality "issues" filters (in the Filters popover).
  const [dataQuality, setDataQuality] = useState([]);   // ['untagged','noTempo']
  const [bulkTagInput, setBulkTagInput] = useState('');
  // Per-device "what shows on cards" selection (Card + Compact views).
  // Card fields are stored per view ({ card: [...], compact: [...] }) so the
  // Card and Compact lists can show different details.
  const [cardFieldsSaved, setCardFieldsSaved] = usePersistentJSON('setlists-md:songs-card-fields');

  const fabRef = useRef(null);
  const sentinelRef = useRef(null);
  const bulkBarRef = useRef(null);

  const allTags = useMemo(() => {
    const tagSet = new Set();
    songs.forEach(s => s.tags?.forEach(t => tagSet.add(t)));
    return [...tagSet].sort();
  }, [songs]);

  // Available facet values (Key / Tempo / Theme / Language / Year / Scripture /
  // Moment) with counts, derived from the current library.
  const facetOptions = useMemo(() => buildFacetOptions(songs), [songs]);
  const activeFacetCount = countActiveFacets(facetSel);

  const toggleFacet = (facetKey, value) => {
    setFacetSel(prev => {
      const cur = prev[facetKey] || [];
      const next = cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value];
      return { ...prev, [facetKey]: next };
    });
  };
  const clearAllFilters = () => { setSelectedTags([]); setFacetSel({}); setDataQuality([]); };

  // Song usage across setlists (songsLibraryPlus — for the Setlists column/sort).
  const usage = useMemo(() => buildSongUsage(setlists), [setlists]);

  // Customizable table columns (synced via settings.tableColumns). The plus
  // context unlocks the extra CCLI/Year/… columns + drag-reorder.
  const colCtx = useMemo(() => ({ plus }), [plus]);
  const orderedCols = useMemo(() => orderedVisibleColumns('library', tableColumns, colCtx), [tableColumns, colCtx]);
  // Min width of the table = checkbox + name + every visible column, so extra
  // columns push the table wider and its scroller kicks in instead of crushing.
  const tableMinWidth = useMemo(
    () => 300 + orderedCols.reduce((sum, c) => sum + (LIB_COL[c.id]?.px || 100), 0),
    [orderedCols],
  );

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') setBulkMenu(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Deferred so typing stays responsive: the input updates immediately while
  // the (potentially large) filtered list recomputes at a lower priority.
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(() => {
    // Apply tag chips (AND) and the faceted metadata filters first — both
    // orthogonal to the text query — then run the shared ultra-search. The list
    // is re-sorted below by the user's chosen sortMode, so we only need search
    // membership here.
    let result = songs;
    if (selectedTags.length > 0) {
      result = result.filter(s => selectedTags.every(tag => s.tags?.includes(tag)));
    }
    if (activeFacetCount > 0) {
      result = result.filter(s => matchesFacets(s, facetSel));
    }
    if (plus && dataQuality.length > 0) {
      result = result.filter(s => matchesDataQuality(s, dataQuality));
    }
    return searchSongs(result, deferredQuery);
  }, [songs, deferredQuery, selectedTags, facetSel, activeFacetCount, plus, dataQuality]);

  // Reset pagination + selection when filter criteria change.
  const [prevFilterKey, setPrevFilterKey] = useState(null);
  const filterKey = JSON.stringify([deferredQuery, selectedTags, facetSel, sortMode, sortAsc, dataQuality]);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setVisibleCount(INITIAL_VISIBLE);
    setSelected([]);
  }

  const truncated = useMemo(
    () => filtered.length > visibleCount ? filtered.slice(0, visibleCount) : filtered,
    [filtered, visibleCount]
  );
  const hasMore = filtered.length > truncated.length;

  // Card gallery grouping follows the active sort mode.
  const { groups, sortedKeys } = useMemo(
    () => groupAndSort(truncated, sortMode, sortAsc),
    [truncated, sortMode, sortAsc]
  );

  const flatRows = useMemo(
    () => flatSort(truncated, sortMode, sortAsc, usage),
    [truncated, sortMode, sortAsc, usage]
  );

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        setVisibleCount(c => c + VISIBLE_PAGE_SIZE);
      }
    }, { rootMargin: '400px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore]);

  useEffect(() => {
    if (!bulkMenu) return;
    const handler = (e) => {
      if (bulkBarRef.current && !bulkBarRef.current.contains(e.target)) setBulkMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [bulkMenu]);

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSortClick = (modeKey) => {
    if (sortMode === modeKey) {
      setSortAsc(prev => !prev);
    } else {
      setSortMode(modeKey);
      setSortAsc(true);
    }
  };

  const closePeek = () => {
    if (isFullscreen) onToggleFullscreen?.();
    onSelectPreview?.(null);
  };

  // ----- Selection -----
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const visibleIds = flatRows.map(s => s.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedSet.has(id));
  const toggleSelect = (id, e) => {
    e?.stopPropagation();
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleSelectAll = () => setSelected(allSelected ? [] : visibleIds);
  const clearSelection = () => { setSelected([]); setBulkMenu(null); };

  const otherWorkspaces = workspaces.filter(w => w.id !== activeLibrary);
  const canMoveCopy = otherWorkspaces.length > 0;

  // Phones can pick Cards / Compact / Table. Default per device: desktop/tablet
  // open in Table, phones open in Cards (the friendly default). Compact is a
  // mobile-only mode; if a phone choice carries to desktop it falls back to
  // the card gallery.
  const autoView = advanced ? 'table' : 'gallery';
  const vm = viewMode ?? autoView;
  // Table is desktop/tablet only — phones get Cards + Compact. A stored 'table'
  // choice falls back to the card gallery on phones.
  const effectiveView = advanced
    ? (vm === 'compact' ? 'gallery' : vm)
    : (vm === 'table' ? 'gallery' : vm);
  // Desktop table horizontally scrolls when the chosen columns overflow (plus).
  const mobileTable = false;
  // In plus mode every table column is user-chosen, so never hide any by
  // breakpoint — the horizontal scroller carries them instead.
  const colFloor = (cls) => (plus ? '' : (mobileTable ? '' : cls));
  const rowPad = 'py-3.5';
  // Per-view card fields (Card vs Compact). Legacy array format applies to both.
  const cardViewKey = effectiveView === 'compact' ? 'compact' : 'card';
  const savedCardFields = Array.isArray(cardFieldsSaved) ? cardFieldsSaved : (cardFieldsSaved?.[cardViewKey] ?? null);
  const cardFields = resolveCardFields('songs', savedCardFields);
  const setCardFieldsForView = (ids) => setCardFieldsSaved({
    ...(cardFieldsSaved && !Array.isArray(cardFieldsSaved) ? cardFieldsSaved : {}),
    [cardViewKey]: ids,
  });
  // In the plus card/compact views, once anything is selected a tap toggles
  // selection instead of opening (iOS-style multi-select mode).
  const selectionActive = plus && !readOnly && selected.length > 0;
  const enterSelect = (id) => setSelected(prev => prev.includes(id) ? prev : [...prev, id]);
  // Shared plus-card props for the gallery + compact SongCards.
  const songCardPlus = (song) => (plus ? {
    fields: cardFields,
    songMapSettings: chartDefaults?.settings,
    onEdit: onEditSong ? () => onEditSong(song) : null,
    selectable: !readOnly,
    selectActive: selectionActive,
    isSelected: selectedSet.has(song.id),
    onToggleSelect: !readOnly ? () => toggleSelect(song.id) : null,
    onLongPress: !readOnly ? () => enterSelect(song.id) : null,
  } : {});
  // A row tap opens the full Song Hub on every device. Desktop also keeps a
  // dedicated per-row button that opens the side-peek preview.
  const onRowActivate = openFull;

  const runBulk = (fn, ...args) => {
    fn?.(selected, ...args);
    clearSelection();
  };

  return (
    <div data-theme-variant="modes" className={cn(splitDock ? 'absolute inset-0 flex overflow-hidden' : 'relative min-h-full')}>
      {/* List column — own scroller when a pane is docked beside it. */}
      <div className={splitDock ? 'flex-1 min-w-0 min-h-0 overflow-y-auto' : 'contents'}>
      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-md bg-[color-mix(in_srgb,var(--ds-background-100)_80%,transparent)] border-b border-[var(--modes-border)]">
        <div className="w-full max-w-[1320px] mx-auto px-5 sm:px-8 pt-5 sm:pt-7 pb-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-heading-32 font-bold text-[var(--modes-text)] m-0 mr-2 hidden sm:block">Songs</h1>

            <SearchBar
              className="flex-1 min-w-[200px] hidden sm:flex"
              placeholder="Search songs & setlists…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />

            {/* View switcher — Table (desktop only) / Compact (mobile only) / Cards. */}
            <div className="flex items-center rounded-lg border border-[var(--modes-border)] overflow-hidden">
              {advanced && (
                <button
                  onClick={() => setViewMode('table')}
                  aria-label="Table view" title="Table view"
                  className={cn('w-9 h-9 flex items-center justify-center cursor-pointer border-none transition-colors',
                    effectiveView === 'table' ? 'bg-[var(--modes-surface-strong)] text-[var(--color-brand)]' : 'bg-transparent text-[var(--modes-text-muted)] hover:bg-[var(--modes-surface)]')}
                >
                  <TableViewIcon />
                </button>
              )}
              <button
                onClick={() => setViewMode('compact')}
                aria-label="Compact list view" title="Compact list"
                className={cn('w-9 h-9 sm:hidden items-center justify-center cursor-pointer border-none transition-colors flex',
                  vm === 'compact' ? 'bg-[var(--modes-surface-strong)] text-[var(--color-brand)]' : 'bg-transparent text-[var(--modes-text-muted)] hover:bg-[var(--modes-surface)]')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('gallery')}
                aria-label="Card view" title="Card view"
                className={cn('w-9 h-9 flex items-center justify-center cursor-pointer border-none transition-colors',
                  effectiveView === 'gallery' ? 'bg-[var(--modes-surface-strong)] text-[var(--color-brand)]' : 'bg-transparent text-[var(--modes-text-muted)] hover:bg-[var(--modes-surface)]')}
              >
                <GalleryViewIcon />
              </button>
            </div>

            {/* Unified filters — tags (AND) + faceted metadata (OR per facet) +
                (songsLibraryPlus) data-quality "issues" folded into the popover. */}
            <LibraryFilters
              facetOptions={facetOptions}
              selected={facetSel}
              onToggleFacet={toggleFacet}
              allTags={allTags}
              selectedTags={selectedTags}
              onToggleTag={toggleTag}
              activeCount={selectedTags.length + activeFacetCount + (plus ? dataQuality.length : 0)}
              onClearAll={clearAllFilters}
              issues={plus ? { active: dataQuality, defs: DATA_QUALITY } : null}
              onToggleIssue={(key) => setDataQuality(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])}
            />

            {effectiveView === 'table' && onSetTableColumns && (
              <ColumnsMenu
                table="library"
                context={colCtx}
                saved={tableColumns}
                onChange={(ids) => onSetTableColumns('library', ids)}
                orderable={plus}
              />
            )}

            {plus && effectiveView !== 'table' && (
              <CardFieldsMenu kind="songs" saved={savedCardFields} onChange={setCardFieldsForView} label={effectiveView === 'compact' ? 'Compact' : 'Card'} />
            )}

            {/* Import + New song (desktop) */}
            {!readOnly && onNewSong && (
              <div className="hidden lg:block">
                <Button variant="brand" size="sm" onClick={onNewSong}>+ New Song</Button>
              </div>
            )}
          </div>

          {effectiveView === 'gallery' && (
            <div className="hidden sm:flex items-center gap-2 flex-wrap">
              {SORT_MODES.map(mode => (
                <button
                  key={mode.key}
                  onClick={() => handleSortClick(mode.key)}
                  className={`px-4 py-2 rounded-full text-label-14 font-semibold cursor-pointer transition-all duration-150 border-none flex items-center gap-1.5 ${
                    sortMode === mode.key ? 'bg-[var(--ds-gray-100)] text-[var(--color-brand)]' : 'bg-transparent text-[var(--modes-text-muted)] hover:bg-[var(--modes-surface)]'
                  }`}
                >
                  {mode.label}
                  {sortMode === mode.key && <SortArrow asc={sortAsc} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-[1320px] mx-auto px-5 sm:px-8 py-5">
        {plus && (activeFacetCount > 0 || selectedTags.length > 0) && (
          <ActiveFacetChips
            facetSel={facetSel}
            selectedTags={selectedTags}
            onRemoveFacet={toggleFacet}
            onRemoveTag={toggleTag}
            onClearAll={clearAllFilters}
          />
        )}
        {!loaded ? (
          <SkeletonRows />
        ) : filtered.length === 0 ? (
          (query || selectedTags.length > 0 || activeFacetCount > 0 || dataQuality.length > 0) ? (
            <div className="modes-card py-14 text-center flex flex-col items-center gap-3 border-dashed">
              <p className="text-copy-14 text-[var(--modes-text-muted)] font-medium">No songs matching your filters.</p>
            </div>
          ) : (
            <div className="modes-card py-16 px-6 flex flex-col items-center text-center border-dashed">
              <div className="w-14 h-14 mb-4 rounded-full bg-[var(--modes-surface-strong)] border border-[var(--modes-border)] flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--modes-text-muted)]">
                  <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <h2 className="text-heading-20 text-[var(--modes-text)] m-0 mb-1.5">Your library is empty</h2>
              <p className="text-copy-14 text-[var(--modes-text-muted)] max-w-sm mb-5">Create a new chord chart or import one from a .md file you already have.</p>
              {canEdit && <Button variant="brand" onClick={onNewSong}>New song</Button>}
            </div>
          )
        ) : effectiveView === 'table' ? (
          <div className={cn('modes-card', (plus || mobileTable) ? 'overflow-x-auto' : 'overflow-hidden')}>
            <table
              className="w-full border-collapse table-fixed"
              style={(plus || mobileTable) ? { minWidth: tableMinWidth } : undefined}
            >
              <thead>
                <tr className="border-b border-[var(--modes-border)]">
                  <th className={cn('w-[44px] px-4', rowPad)}>
                    {!readOnly && (
                      <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all" className="w-4 h-4 rounded accent-[var(--color-brand)] cursor-pointer align-middle" />
                    )}
                  </th>
                  <th className={cn('text-left px-5', rowPad)}>
                    <button onClick={() => handleSortClick('title')} className="inline-flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer text-[var(--modes-text-dim)] uppercase tracking-wider text-label-12 font-semibold hover:text-[var(--modes-text)]">
                      Name {sortMode === 'title' && <SortArrow asc={sortAsc} />}
                    </button>
                  </th>
                  {orderedCols.map(col => {
                    const cfg = LIB_COL[col.id];
                    if (!cfg) return null;
                    return (
                      <th key={col.id} className={cn('text-left px-5 text-[var(--modes-text-dim)] uppercase tracking-wider text-label-12 font-semibold', rowPad, cfg.width, colFloor(cfg.floor))}>
                        {cfg.sortKey ? (
                          <button onClick={() => handleSortClick(cfg.sortKey)} className="inline-flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer text-[var(--modes-text-dim)] uppercase tracking-wider text-label-12 font-semibold hover:text-[var(--modes-text)]">
                            {cfg.header} {sortMode === cfg.sortKey && <SortArrow asc={sortAsc} />}
                          </button>
                        ) : cfg.header}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {flatRows.map(song => {
                  const arrCount = Array.isArray(song.arrangements) ? song.arrangements.length : 1;
                  const isSel = selectedSet.has(song.id);
                  const isPreview = advanced && song.id === previewSongId;
                  return (
                    <tr
                      key={song.id}
                      role="button"
                      onClick={(e) => onRowActivate(song, e)}
                      className={cn('group cursor-pointer border-b border-[var(--modes-border)] transition-colors',
                        isSel || isPreview ? 'bg-[var(--modes-surface-strong)]' : 'hover:bg-[var(--modes-surface)]')}
                    >
                      <td className={cn('px-4', rowPad)} onClick={(e) => e.stopPropagation()}>
                        {!readOnly && (
                          <input type="checkbox" checked={isSel} onChange={(e) => toggleSelect(song.id, e)} aria-label={`Select ${song.title}`} className="w-4 h-4 rounded accent-[var(--color-brand)] cursor-pointer align-middle" />
                        )}
                      </td>
                      <td className={cn('px-5', rowPad)}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-copy-15 font-semibold text-[var(--modes-text)] truncate">{song.title || 'Untitled'}</span>
                          <ArrangementsBadge count={arrCount} />
                          {onSelectPreview && !isTablet && (
                            <button
                              onClick={(e) => openPeek(song, e)}
                              aria-label="Open in pane"
                              title="Open in pane"
                              className="hidden lg:inline-flex ml-auto items-center justify-center w-7 h-7 rounded-md border-none bg-transparent text-[var(--modes-text-muted)] opacity-0 group-hover:opacity-100 hover:bg-[var(--modes-surface-strong)] hover:text-[var(--modes-text)] transition-all cursor-pointer"
                            >
                              <PaneIcon />
                            </button>
                          )}
                        </div>
                        {/* Mobile artist sub-line — only when the Artist column
                            is responsively hidden (non-plus; plus always shows it). */}
                        {(plus || mobileTable || !orderedCols.some(c => c.id === 'artist')) ? null : (
                          <div className="text-copy-13 text-[var(--modes-text-muted)] truncate mt-0.5 md:hidden">{song.artist}</div>
                        )}
                      </td>
                      {orderedCols.map(col => {
                        const cfg = LIB_COL[col.id];
                        if (!cfg) return null;
                        return (
                          <td key={col.id} className={cn('px-5', rowPad, colFloor(cfg.floor))}>
                            {songCellContent(col.id, song, usage)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {hasMore && (
              <div ref={sentinelRef} className="py-5 text-center text-copy-12 text-[var(--modes-text-dim)]">
                Loading more… ({truncated.length} of {filtered.length})
              </div>
            )}
          </div>
        ) : effectiveView === 'compact' ? (
          <div className="flex flex-col gap-8">
            {sortedKeys.map(groupKey => (
              <div key={groupKey} className="flex flex-col gap-3">
                <div className="flex items-baseline gap-2 px-1">
                  <h3 className="text-heading-18 font-bold text-[var(--modes-text)] m-0">{groupKey}</h3>
                  <span className="text-label-12 text-[var(--modes-text-dim)]">{groups[groupKey].length}</span>
                </div>
                <div className="modes-card overflow-hidden divide-y divide-[var(--modes-border)]" style={{ borderColor: 'var(--modes-border)' }}>
                  {groups[groupKey].map(song => (
                    <SongCard
                      key={song.id}
                      song={song}
                      variant="compact"
                      highlight={deferredQuery}
                      selected={advanced && song.id === previewSongId}
                      onClick={() => onRowActivate(song)}
                      {...songCardPlus(song)}
                    />
                  ))}
                </div>
              </div>
            ))}
            {hasMore && (
              <div ref={sentinelRef} className="py-5 text-center text-copy-12 text-[var(--modes-text-dim)]">
                Loading more… ({truncated.length} of {filtered.length})
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {sortedKeys.map(groupKey => (
              <div key={groupKey} className="flex flex-col gap-3">
                <div className="flex items-baseline gap-2 px-1">
                  <h3 className="text-heading-20 font-bold text-[var(--modes-text)] m-0">{groupKey}</h3>
                  <span className="text-label-12 text-[var(--modes-text-dim)]">{groups[groupKey].length}</span>
                </div>
                <div className="modes-card overflow-hidden divide-y divide-[var(--modes-border)]" style={{ borderColor: 'var(--modes-border)' }}>
                  {groups[groupKey].map(song => (
                    <SongCard
                      key={song.id}
                      song={song}
                      variant="row"
                      showTags={true}
                      selected={advanced && song.id === previewSongId}
                      onClick={() => onRowActivate(song)}
                      {...songCardPlus(song)}
                    />
                  ))}
                </div>
              </div>
            ))}
            {hasMore && (
              <div ref={sentinelRef} className="py-6 text-center text-copy-12 text-[var(--modes-text-dim)]">
                Loading more… ({truncated.length} of {filtered.length})
              </div>
            )}
          </div>
        )}
      </div>

      </div>{/* /list column */}

      {/* FAB — narrow mouse-driven windows only. Touch tablets get the
          bottom-nav FAB instead, so gating on !isTablet avoids a duplicate. */}
      {!readOnly && onNewSong && !isTablet && (
        <div ref={fabRef} className="fixed right-6 z-[150] hidden sm:block lg:hidden" style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
          <button onClick={onNewSong} aria-label="New song" className="w-14 h-14 rounded-full bg-[var(--color-brand)] text-white shadow-lg flex items-center justify-center cursor-pointer hover:opacity-90 transition-all duration-150 active:scale-95 border-none">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      )}

      {/* Bulk action bar — desktop + tablet, plus phones when songsLibraryPlus
          multi-select is active (the card gallery lets you select on mobile). */}
      {!readOnly && selected.length > 0 && (advanced || plus) && (
        <SelectionBar
          barRef={bulkBarRef}
          count={selected.length}
          onClear={clearSelection}
          liftAboveNav={!advanced || isTablet}
        >
          {onAddSongsToSetlist && (
            <div className="relative shrink-0">
              <button onClick={() => setBulkMenu(bulkMenu === 'setlist' ? null : 'setlist')} className={selectionActionClass}>Add to Setlist…</button>
              {bulkMenu === 'setlist' && (
                <div className="absolute bottom-full mb-2 left-0 w-[240px] max-h-[280px] overflow-y-auto rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] shadow-lg py-1">
                  {setlists.length === 0 ? (
                    <div className="px-4 py-3 text-copy-13 text-[var(--ds-gray-600)]">No setlists yet.</div>
                  ) : setlists.map(sl => (
                    <button key={sl.id} onClick={() => runBulk(onAddSongsToSetlist, sl.id)} className="w-full text-left px-4 py-2.5 cursor-pointer border-none bg-transparent text-label-14 text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-200)] transition-colors truncate">{sl.name || 'Untitled setlist'}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {plus && onTagSongs && (
            <div className="relative shrink-0">
              <button onClick={() => setBulkMenu(bulkMenu === 'tags' ? null : 'tags')} className={selectionActionClass}>Tags…</button>
              {bulkMenu === 'tags' && (
                <div className="absolute bottom-full mb-2 left-0 w-[260px] rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] shadow-lg p-3 flex flex-col gap-2">
                  <form
                    onSubmit={(e) => { e.preventDefault(); const t = bulkTagInput.trim(); if (t) { onTagSongs(selected, { add: [t] }); setBulkTagInput(''); clearSelection(); } }}
                    className="flex gap-2"
                  >
                    <input
                      value={bulkTagInput}
                      onChange={(e) => setBulkTagInput(e.target.value)}
                      placeholder="Add a tag…"
                      className="flex-1 min-w-0 h-8 px-2.5 rounded-lg border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] text-label-14 text-[var(--ds-gray-1000)] outline-none focus:border-[var(--color-brand)]"
                      autoFocus
                    />
                    <button type="submit" className="h-8 px-3 rounded-lg text-label-14 font-medium cursor-pointer border-none bg-[var(--color-brand)] text-white">Add</button>
                  </form>
                  {allTags.length > 0 && (
                    <div className="max-h-[160px] overflow-y-auto flex flex-col">
                      <div className="text-label-11 uppercase tracking-wider text-[var(--ds-gray-600)] px-0.5 pb-1">Remove a tag</div>
                      {allTags.map(t => (
                        <button key={t} onClick={() => { onTagSongs(selected, { remove: [t] }); clearSelection(); }} className="w-full text-left px-2 py-1.5 rounded-md cursor-pointer border-none bg-transparent text-label-14 text-[var(--ds-gray-900)] hover:bg-[var(--ds-red-100)] hover:text-[var(--ds-red-700)] transition-colors flex items-center gap-2">
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

          {canMoveCopy && onCopySongs && (
            <button onClick={() => setBulkPicker('copy')} className={selectionActionClass}>Copy to…</button>
          )}

          {canMoveCopy && onMoveSongs && (
            <button onClick={() => setBulkPicker('move')} className={selectionActionClass}>Move to…</button>
          )}

          {onDeleteSongs && (
            <button onClick={() => runBulk(onDeleteSongs)} className={selectionDangerClass}>Delete</button>
          )}
        </SelectionBar>
      )}

      {/* Right-side overlay peek — desktop + tablet portrait (landscape docks) */}
      <SidePeek
        open={advanced && !!previewSong && !splitDock}
        onClose={closePeek}
        expanded={isFullscreen}
        label="Song preview"
      >
        {previewSong && (
          <Suspense fallback={<div className="p-8 text-copy-14 text-[var(--ds-gray-700)]">Loading…</div>}>
            <ChartView
              key={previewSong.id}
              song={previewSong}
              onBack={closePeek}
              onEdit={onEditSong ? () => onEditSong(previewSong) : null}
              isFullscreen={isFullscreen}
              onToggleFullscreen={onToggleFullscreen}
              {...(chartMoveCopy ? chartMoveCopy(previewSong.id) : {})}
              {...chartDefaults}
            />
          </Suspense>
        )}
      </SidePeek>

      {/* Bulk move/copy destination picker (shared modal). */}
      {bulkPicker && (
        <WorkspacePickerDialog
          open
          title={bulkPicker === 'move' ? `Move ${selected.length} song${selected.length === 1 ? '' : 's'} to…` : `Copy ${selected.length} song${selected.length === 1 ? '' : 's'} to…`}
          description={bulkPicker === 'move'
            ? 'The selected songs will be moved out of the current workspace.'
            : 'Copies will be added. The originals stay put.'}
          confirmLabel={bulkPicker === 'move' ? 'Move' : 'Copy'}
          workspaces={otherWorkspaces}
          onSelect={(target) => runBulk(bulkPicker === 'move' ? onMoveSongs : onCopySongs, target)}
          onClose={() => setBulkPicker(null)}
        />
      )}
    </div>
  );
}
