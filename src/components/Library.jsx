import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import SongCard from './SongCard';
import SidePeek from './shell/SidePeek';
import { Button } from './ui/Button';
import { SearchBar } from './ui/SearchBar';
import { cn } from '../lib/utils';
import { useIsDesktop, useIsTablet, useIsLandscape } from '../lib/useMediaQuery';
import { useResizablePane } from '../lib/useResizablePane';

const ChartView = lazy(() => import('./ChartView'));

const SORT_MODES = [
  { key: 'title', label: 'Title' },
  { key: 'artist', label: 'Artist' },
  { key: 'key', label: 'Key' },
];

function defaultArrangementKey(song) {
  if (!Array.isArray(song?.arrangements)) return song?.key || 'C';
  const arr = song.arrangements.find(a => a.id === song.defaultArrangementId) || song.arrangements[0];
  return arr?.key || 'C';
}

function getGroupKey(song, sortMode) {
  if (sortMode === 'title') {
    const first = (song.title || '').trim()[0]?.toUpperCase();
    return first && /[A-Z]/.test(first) ? first : '#';
  }
  if (sortMode === 'artist') {
    return (song.artist || 'Unknown').trim();
  }
  if (sortMode === 'key') {
    return defaultArrangementKey(song).replace(/[#bmb]/g, '').toUpperCase();
  }
  return '#';
}

function groupAndSort(songs, sortMode, sortAsc) {
  const groups = {};
  songs.forEach(song => {
    const key = getGroupKey(song, sortMode);
    if (!groups[key]) groups[key] = [];
    groups[key].push(song);
  });

  const dir = sortAsc ? 1 : -1;

  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === '#') return 1;
    if (b === '#') return -1;
    if (sortMode === 'key') {
      const order = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
      return (order.indexOf(a) - order.indexOf(b)) * dir;
    }
    return a.localeCompare(b) * dir;
  });

  sortedKeys.forEach(key => {
    groups[key].sort((a, b) => a.title.localeCompare(b.title) * dir);
  });

  return { groups, sortedKeys };
}

// Flat sort for the table view (no letter grouping).
function flatSort(songs, sortMode, sortAsc) {
  const dir = sortAsc ? 1 : -1;
  const val = (s) =>
    sortMode === 'artist' ? (s.artist || '') :
    sortMode === 'key' ? defaultArrangementKey(s) :
    (s.title || '');
  return [...songs].sort((a, b) => {
    const cmp = val(a).localeCompare(val(b));
    return (cmp !== 0 ? cmp : (a.title || '').localeCompare(b.title || '')) * dir;
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
}) {
  // Responsive shell. Touch tablets (pointer: coarse) get the two-pane master-
  // detail; true desktops (fine pointer) keep the Phase 1 overlay peek.
  const wide = useIsDesktop();              // ≥ 1024px
  const isTablet = useIsTablet();           // touch tablet, 768–1366px
  const isLandscape = useIsLandscape();
  const isDesktop = wide && !isTablet;      // mouse-driven desktop
  const advanced = isDesktop || isTablet;   // table view + master-detail
  // Pinned second pane: tablet in landscape with room for two columns.
  const splitDock = isTablet && isLandscape && wide && !isFullscreen;
  const { width: paneWidth, onPointerDown: onPaneResize } = useResizablePane({ storageKey: 'setlists-md:library-pane-w' });

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
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'gallery'
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [selected, setSelected] = useState([]);
  const [bulkMenu, setBulkMenu] = useState(null); // 'setlist' | 'copy' | 'move' | null

  const tagsRef = useRef(null);
  const fabRef = useRef(null);
  const sentinelRef = useRef(null);
  const bulkBarRef = useRef(null);

  const allTags = useMemo(() => {
    const tagSet = new Set();
    songs.forEach(s => s.tags?.forEach(t => tagSet.add(t)));
    return [...tagSet].sort();
  }, [songs]);

  useEffect(() => {
    const handler = (e) => {
      if (tagsRef.current && !tagsRef.current.contains(e.target)) setTagsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { setTagsOpen(false); setBulkMenu(null); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const filtered = useMemo(() => {
    let result = songs;
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.artist?.toLowerCase().includes(q) ||
        (s.key || '').toLowerCase().includes(q) ||
        s.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    if (selectedTags.length > 0) {
      result = result.filter(s =>
        selectedTags.every(tag => s.tags?.includes(tag))
      );
    }
    return result;
  }, [songs, query, selectedTags]);

  // Reset pagination + selection when filter criteria change.
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
    setSelected([]);
  }, [query, selectedTags, sortMode, sortAsc]);

  const truncated = useMemo(
    () => filtered.length > visibleCount ? filtered.slice(0, visibleCount) : filtered,
    [filtered, visibleCount]
  );
  const hasMore = filtered.length > truncated.length;

  const { groups, sortedKeys } = useMemo(
    () => groupAndSort(truncated, sortMode, sortAsc),
    [truncated, sortMode, sortAsc]
  );

  const flatRows = useMemo(
    () => flatSort(truncated, sortMode, sortAsc),
    [truncated, sortMode, sortAsc]
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

  // Table view + master-detail are available on desktop and tablet; phones keep
  // the grouped card list.
  const effectiveView = advanced ? viewMode : 'gallery';
  // On tablet a row tap loads the detail pane; desktop keeps row → full chart
  // with a dedicated pane button.
  const onRowActivate = isTablet ? openPeek : openFull;

  const runBulk = (fn, ...args) => {
    fn?.(selected, ...args);
    clearSelection();
  };

  return (
    <div data-theme-variant="modes" className={cn(splitDock ? 'absolute inset-0 flex overflow-hidden' : 'relative h-full overflow-y-auto')}>
      {/* List column — own scroller when a pane is docked beside it. */}
      <div className={splitDock ? 'flex-1 min-w-0 min-h-0 overflow-y-auto' : 'contents'}>
      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-md bg-[color-mix(in_srgb,var(--ds-background-100)_80%,transparent)] border-b border-[var(--modes-border)]">
        <div className="w-full max-w-[1320px] mx-auto px-5 sm:px-8 pt-5 sm:pt-7 pb-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-heading-32 font-bold text-[var(--modes-text)] m-0 mr-2 hidden sm:block">Library</h1>

            <SearchBar
              className="flex-1 min-w-[200px] hidden sm:flex"
              placeholder="Search songs by title, artist, key, or tag…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />

            {/* View switcher — desktop + tablet */}
            <div className={cn('items-center rounded-lg border border-[var(--modes-border)] overflow-hidden', advanced ? 'flex' : 'hidden')}>
              <button
                onClick={() => setViewMode('table')}
                aria-label="Table view" title="Table view"
                className={cn('w-9 h-9 flex items-center justify-center cursor-pointer border-none transition-colors',
                  viewMode === 'table' ? 'bg-[var(--modes-surface-strong)] text-[var(--color-brand)]' : 'bg-transparent text-[var(--modes-text-muted)] hover:bg-[var(--modes-surface)]')}
              >
                <TableViewIcon />
              </button>
              <button
                onClick={() => setViewMode('gallery')}
                aria-label="List view" title="List view"
                className={cn('w-9 h-9 flex items-center justify-center cursor-pointer border-none transition-colors',
                  viewMode === 'gallery' ? 'bg-[var(--modes-surface-strong)] text-[var(--color-brand)]' : 'bg-transparent text-[var(--modes-text-muted)] hover:bg-[var(--modes-surface)]')}
              >
                <GalleryViewIcon />
              </button>
            </div>

            {/* Tags filter */}
            {allTags.length > 0 && (
              <div ref={tagsRef} className="relative hidden sm:block">
                <button
                  onClick={() => setTagsOpen(!tagsOpen)}
                  className={`h-9 px-4 rounded-lg border cursor-pointer flex items-center gap-2 text-label-14 transition-all duration-150 ${
                    selectedTags.length > 0
                      ? 'border-[var(--color-brand)] text-[var(--color-brand)] bg-[var(--modes-surface)]'
                      : 'border-[var(--modes-border)] text-[var(--modes-text)] bg-[var(--modes-surface)] hover:bg-[var(--modes-surface-strong)]'
                  }`}
                >
                  {selectedTags.length > 0 && <span className="w-2 h-2 rounded-full bg-[var(--color-brand)]" />}
                  Tags{selectedTags.length > 0 ? ` (${selectedTags.length})` : ''}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-150 ${tagsOpen ? 'rotate-180' : ''}`}>
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {tagsOpen && (
                  <div className="absolute right-0 top-full mt-2 w-[220px] rounded-xl border border-[var(--modes-border)] bg-[var(--ds-background-100)] shadow-lg z-50 overflow-hidden">
                    {allTags.length > 5 && (
                      <div className="px-3 pt-3 pb-2">
                        <input
                          type="text"
                          placeholder="Search tags…"
                          value={tagQuery}
                          onChange={e => setTagQuery(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="w-full h-8 px-3 rounded-lg border border-[var(--border-1)] bg-[var(--bg-2)] text-copy-13 text-[var(--text-1)] placeholder:text-[var(--text-2)] outline-none focus:border-[var(--border-3)] transition-colors"
                        />
                      </div>
                    )}
                    <div className="flex flex-col py-1 max-h-[320px] overflow-y-auto">
                      {(() => {
                        const tq = tagQuery.toLowerCase();
                        const filteredTags = allTags.filter(t => t.toLowerCase().includes(tq));
                        const sel = filteredTags.filter(t => selectedTags.includes(t));
                        const unsel = filteredTags.filter(t => !selectedTags.includes(t)).slice(0, 10 - sel.length);
                        const visible = [...sel, ...unsel];
                        const more = filteredTags.length > visible.length;
                        return (
                          <>
                            {visible.map(tag => (
                              <label key={tag} className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-[var(--bg-2)] transition-colors">
                                <input type="checkbox" checked={selectedTags.includes(tag)} onChange={() => toggleTag(tag)} className="w-4 h-4 rounded accent-[var(--color-brand)] cursor-pointer" />
                                <span className="text-copy-14 text-[var(--text-1)]">{tag}</span>
                              </label>
                            ))}
                            {visible.length === 0 && <div className="px-4 py-3 text-copy-13 text-[var(--text-2)]">No tags found</div>}
                            {more && <div className="px-4 py-2 text-copy-12 text-[var(--ds-gray-600)]">{filteredTags.length - visible.length} more — refine search</div>}
                          </>
                        );
                      })()}
                    </div>
                    {selectedTags.length > 0 && (
                      <>
                        <div className="border-t border-[var(--border-1)]" />
                        <button onClick={() => { setSelectedTags([]); setTagQuery(''); }} className="w-full px-4 py-2.5 text-copy-14 text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--ds-gray-alpha-100)] transition-colors cursor-pointer bg-transparent border-none text-center">
                          Clear all
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Import + New song (desktop) */}
            {!readOnly && onNewSong && (
              <div className="hidden lg:block">
                <Button variant="brand" size="sm" onClick={onNewSong}>+ New Song</Button>
              </div>
            )}
          </div>

          {effectiveView === 'gallery' && (
            <div className="hidden sm:flex items-center gap-2">
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
        {!loaded ? (
          <SkeletonRows />
        ) : filtered.length === 0 ? (
          query || selectedTags.length > 0 ? (
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
          <div className="modes-card overflow-hidden">
            <table className="w-full border-collapse table-fixed">
              <thead>
                <tr className="border-b border-[var(--modes-border)]">
                  <th className="w-[44px] px-4 py-3">
                    {!readOnly && (
                      <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all" className="w-4 h-4 rounded accent-[var(--color-brand)] cursor-pointer align-middle" />
                    )}
                  </th>
                  <th className="text-left px-5 py-3">
                    <button onClick={() => handleSortClick('title')} className="inline-flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer text-[var(--modes-text-dim)] uppercase tracking-wider text-label-12 font-semibold hover:text-[var(--modes-text)]">
                      Name {sortMode === 'title' && <SortArrow asc={sortAsc} />}
                    </button>
                  </th>
                  {!splitDock && (
                    <th className="text-left px-5 py-3 hidden md:table-cell w-[34%]">
                      <button onClick={() => handleSortClick('artist')} className="inline-flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer text-[var(--modes-text-dim)] uppercase tracking-wider text-label-12 font-semibold hover:text-[var(--modes-text)]">
                        Artist {sortMode === 'artist' && <SortArrow asc={sortAsc} />}
                      </button>
                    </th>
                  )}
                  <th className="text-left px-5 py-3 w-[72px]">
                    <button onClick={() => handleSortClick('key')} className="inline-flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer text-[var(--modes-text-dim)] uppercase tracking-wider text-label-12 font-semibold hover:text-[var(--modes-text)]">
                      Key {sortMode === 'key' && <SortArrow asc={sortAsc} />}
                    </button>
                  </th>
                  {!splitDock && (
                    <th className="text-left px-5 py-3 hidden lg:table-cell w-[200px] text-[var(--modes-text-dim)] uppercase tracking-wider text-label-12 font-semibold">Tags</th>
                  )}
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
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        {!readOnly && (
                          <input type="checkbox" checked={isSel} onChange={(e) => toggleSelect(song.id, e)} aria-label={`Select ${song.title}`} className="w-4 h-4 rounded accent-[var(--color-brand)] cursor-pointer align-middle" />
                        )}
                      </td>
                      <td className="px-5 py-3.5">
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
                        <div className="md:hidden text-copy-13 text-[var(--modes-text-muted)] truncate mt-0.5">{song.artist}</div>
                      </td>
                      {!splitDock && (
                        <td className="px-5 py-3.5 hidden md:table-cell text-copy-14 text-[var(--modes-text-muted)] truncate">{song.artist}</td>
                      )}
                      <td className="px-5 py-3.5"><KeyChip value={defaultArrangementKey(song)} /></td>
                      {!splitDock && (
                        <td className="px-5 py-3.5 hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {(song.tags || []).slice(0, 3).map(t => (
                              <span key={t} className="text-label-12 px-2 py-0.5 rounded-full bg-[var(--modes-surface)] text-[var(--modes-text-muted)] border border-[var(--modes-border)]">{t}</span>
                            ))}
                          </div>
                        </td>
                      )}
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
                    <SongCard key={song.id} song={song} variant="row" showTags={true} selected={advanced && song.id === previewSongId} onClick={() => onRowActivate(song)} />
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

      {/* Draggable divider — resize the pane, Spotify-style. */}
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

      {/* Pinned detail pane — tablet landscape (Phase 3 two-pane split) */}
      {splitDock && (
        <aside
          style={{ width: paneWidth }}
          className="h-full min-h-0 shrink-0 border-l border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] overflow-hidden flex flex-col"
        >
          {previewSong ? (
            <Suspense fallback={<div className="p-8 text-copy-14 text-[var(--ds-gray-700)]">Loading…</div>}>
              <ChartView
                key={previewSong.id}
                song={previewSong}
                onBack={closePeek}
                onEdit={onEditSong ? () => onEditSong(previewSong) : null}
                isFullscreen={false}
                onToggleFullscreen={onToggleFullscreen}
                {...chartDefaults}
              />
            </Suspense>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-3">
              <div className="w-12 h-12 rounded-full bg-[var(--modes-surface-strong)] border border-[var(--modes-border)] flex items-center justify-center">
                <PaneIcon />
              </div>
              <p className="text-copy-14 text-[var(--modes-text-muted)] m-0">Select a song to preview it here.</p>
            </div>
          )}
        </aside>
      )}

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

      {/* Bulk action bar — desktop + tablet */}
      {advanced && !readOnly && selected.length > 0 && (
        <div
          ref={bulkBarRef}
          className="fixed left-1/2 -translate-x-1/2 bottom-6 z-[160] flex items-center gap-2 pl-4 pr-2 py-2 rounded-full bg-[var(--ds-background-200)] border border-[var(--ds-gray-300)] shadow-2xl"
          style={isTablet ? { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' } : undefined}
        >
          <span className="text-label-14 font-semibold text-[var(--ds-gray-1000)] whitespace-nowrap">{selected.length} selected</span>
          <span className="w-px h-5 bg-[var(--ds-gray-300)]" />

          {onAddSongsToSetlist && (
            <div className="relative">
              <button onClick={() => setBulkMenu(bulkMenu === 'setlist' ? null : 'setlist')} className="h-8 px-3 rounded-full text-label-14 font-medium cursor-pointer border-none bg-transparent text-[var(--ds-gray-900)] hover:bg-[var(--ds-gray-200)] transition-colors">Add to Setlist…</button>
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

          {canMoveCopy && onCopySongs && (
            <div className="relative">
              <button onClick={() => setBulkMenu(bulkMenu === 'copy' ? null : 'copy')} className="h-8 px-3 rounded-full text-label-14 font-medium cursor-pointer border-none bg-transparent text-[var(--ds-gray-900)] hover:bg-[var(--ds-gray-200)] transition-colors">Copy to…</button>
              {bulkMenu === 'copy' && (
                <div className="absolute bottom-full mb-2 left-0 w-[220px] rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] shadow-lg py-1">
                  {otherWorkspaces.map(w => (
                    <button key={w.id} onClick={() => runBulk(onCopySongs, w.id)} className="w-full text-left px-4 py-2.5 cursor-pointer border-none bg-transparent text-label-14 text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-200)] transition-colors truncate">{w.name}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {canMoveCopy && onMoveSongs && (
            <div className="relative">
              <button onClick={() => setBulkMenu(bulkMenu === 'move' ? null : 'move')} className="h-8 px-3 rounded-full text-label-14 font-medium cursor-pointer border-none bg-transparent text-[var(--ds-gray-900)] hover:bg-[var(--ds-gray-200)] transition-colors">Move to…</button>
              {bulkMenu === 'move' && (
                <div className="absolute bottom-full mb-2 left-0 w-[220px] rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] shadow-lg py-1">
                  {otherWorkspaces.map(w => (
                    <button key={w.id} onClick={() => runBulk(onMoveSongs, w.id)} className="w-full text-left px-4 py-2.5 cursor-pointer border-none bg-transparent text-label-14 text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-200)] transition-colors truncate">{w.name}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {onDeleteSongs && (
            <button onClick={() => runBulk(onDeleteSongs)} className="h-8 px-3 rounded-full text-label-14 font-medium cursor-pointer border-none bg-transparent text-[var(--ds-red-700)] hover:bg-[var(--ds-red-100)] transition-colors">Delete</button>
          )}

          <button onClick={clearSelection} aria-label="Clear selection" className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer border-none bg-transparent text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>
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
              {...chartDefaults}
            />
          </Suspense>
        )}
      </SidePeek>
    </div>
  );
}
