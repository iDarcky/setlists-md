import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import PageHeader from './PageHeader';
import SongCard from './SongCard';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { SearchBar } from './ui/SearchBar';
import SidePeekOverlay from './SidePeekOverlay';
import { cn } from '../lib/utils';
import { useIsDesktop } from '../lib/useMediaQuery';

const ChartView = lazy(() => import('./ChartView'));

const SORT_MODES = [
  { key: 'title', label: 'Title' },
  { key: 'artist', label: 'Artist' },
  { key: 'key', label: 'Key' },
];

function formatRelativeTime(ts) {
  if (!ts) return null;
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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

// Skeleton rows for loading state
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
  viewMode = 'card',
  onViewModeChange,
}) {
  const isDesktop = useIsDesktop();
  const previewSong = useMemo(
    () => songs.find(s => s.id === previewSongId) || null,
    [songs, previewSongId],
  );

  const handleRowClick = (song) => {
    if (isDesktop && onSelectPreview) {
      onSelectPreview(song.id);
    } else {
      onSelectSong(song);
    }
  };

  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState('title');
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const tagsRef = useRef(null);
  const fabRef = useRef(null);
  const sentinelRef = useRef(null);

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
      if (e.key === 'Escape') setTagsOpen(false);
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

  const sortedFiltered = useMemo(() => {
    const dir = sortAsc ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortMode === 'key') {
        const order = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
        const valA = a.key || 'C';
        const valB = b.key || 'C';
        const aIdx = order.findIndex(k => valA.toUpperCase().startsWith(k));
        const bIdx = order.findIndex(k => valB.toUpperCase().startsWith(k));
        return (aIdx - bIdx) * dir;
      }
      const valA = (a[sortMode] || '').toLowerCase();
      const valB = (b[sortMode] || '').toLowerCase();
      return valA.localeCompare(valB) * dir;
    });
  }, [filtered, sortMode, sortAsc]);

  // Reset pagination when filter criteria change so the user doesn't stay
  // scrolled into a stale reveal window.
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [query, selectedTags, sortMode, sortAsc]);

  const truncated = useMemo(
    () => sortedFiltered.length > visibleCount ? sortedFiltered.slice(0, visibleCount) : sortedFiltered,
    [sortedFiltered, visibleCount]
  );
  const hasMore = sortedFiltered.length > truncated.length;

  const { groups, sortedKeys } = useMemo(
    () => groupAndSort(truncated, sortMode, sortAsc),
    [truncated, sortMode, sortAsc]
  );

  const toggleSelection = (e, id) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === truncated.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(truncated.map(s => s.id)));
    }
  };

  // Lazy-reveal the next page when the sentinel enters the viewport.
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

  return (
    <div className="flex flex-col lg:flex-row lg:h-screen w-full relative">
      <div
        data-theme-variant="modes"
        className={cn(
          "relative min-w-0 pb-8 flex-1 w-full",
          "lg:h-screen lg:overflow-y-auto",
          isFullscreen && "lg:hidden",
        )}
      >
      <div className="flex flex-col gap-0">
        {/* Desktop Header & Search */}
        <div className="hidden sm:block sticky top-0 z-20 backdrop-blur-md bg-[color-mix(in_srgb,var(--ds-background-100)_80%,transparent)] border-b border-[var(--modes-border)]">
          <div className="w-full px-4 sm:px-8 max-w-[1400px] mx-auto pt-6 pb-4 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-3xl font-bold text-[var(--ds-gray-1000)] m-0 tracking-tight">Library</h1>
            </div>
            
            <div className="flex gap-3 items-stretch justify-between">
              <div className="flex gap-3 items-stretch flex-1">
              <SearchBar
                className="flex-1 hidden sm:flex"
                placeholder="Search songs by title, artist, key, or tag…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />

            {/* Tags Dropdown */}
            {allTags.length > 0 && (
              <div ref={tagsRef} className="relative">
                <button
                  onClick={() => setTagsOpen(!tagsOpen)}
                  className={`
                    h-11 px-4 rounded-xl border cursor-pointer
                    flex items-center gap-2
                    text-label-14 transition-all duration-150
                    ${selectedTags.length > 0
                      ? 'border-[var(--color-brand)] text-[var(--color-brand)] bg-[var(--modes-surface)]'
                      : 'border-[var(--modes-border)] text-[var(--modes-text)] bg-[var(--modes-surface)] hover:bg-[var(--modes-surface-strong)]'
                    }
                  `}
                >
                  {selectedTags.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-[var(--color-brand)]" />
                  )}
                  Tags{selectedTags.length > 0 ? ` (${selectedTags.length})` : ''}
                  <svg
                    width="14" height="14" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={`transition-transform duration-150 ${tagsOpen ? 'rotate-180' : ''}`}
                  >
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
                        const selected = filteredTags.filter(t => selectedTags.includes(t));
                        const unselected = filteredTags.filter(t => !selectedTags.includes(t)).slice(0, 10 - selected.length);
                        const visible = [...selected, ...unselected];
                        const hasMore = filteredTags.length > visible.length;
                        return (
                          <>
                            {visible.map(tag => (
                              <label
                                key={tag}
                                className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-[var(--bg-2)] transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedTags.includes(tag)}
                                  onChange={() => toggleTag(tag)}
                                  className="w-4 h-4 rounded accent-[var(--color-brand)] cursor-pointer"
                                />
                                <span className="text-copy-14 text-[var(--text-1)]">{tag}</span>
                              </label>
                            ))}
                            {visible.length === 0 && (
                              <div className="px-4 py-3 text-copy-13 text-[var(--text-2)]">No tags found</div>
                            )}
                            {hasMore && (
                              <div className="px-4 py-2 text-copy-12 text-[var(--ds-gray-600)]">
                                {filteredTags.length - visible.length} more — refine search
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    {selectedTags.length > 0 && (
                      <>
                        <div className="border-t border-[var(--border-1)]" />
                        <button
                          onClick={() => { setSelectedTags([]); setTagQuery(''); }}
                          className="w-full px-4 py-2.5 text-copy-14 text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--ds-gray-alpha-100)] transition-colors cursor-pointer bg-transparent border-none text-center"
                        >
                          Clear all
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            </div>
              
            <div className="flex items-center gap-2 shrink-0">
                {onViewModeChange && (
                  <div className="hidden sm:flex bg-[var(--modes-surface)] rounded-md border border-[var(--modes-border)] p-0.5 mr-2">
                    <button
                      onClick={() => onViewModeChange('table')}
                      className={`w-8 h-8 flex items-center justify-center rounded-sm transition-colors border-none cursor-pointer ${
                        viewMode === 'table' ? 'bg-[var(--modes-surface-strong)] shadow-sm text-[var(--modes-text)]' : 'bg-transparent text-[var(--modes-text-muted)] hover:text-[var(--modes-text)]'
                      }`}
                      title="Table view"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/></svg>
                    </button>
                    <button
                      onClick={() => onViewModeChange('card')}
                      className={`w-8 h-8 flex items-center justify-center rounded-sm transition-colors border-none cursor-pointer ${
                        viewMode === 'card' ? 'bg-[var(--modes-surface-strong)] shadow-sm text-[var(--modes-text)]' : 'bg-transparent text-[var(--modes-text-muted)] hover:text-[var(--modes-text)]'
                      }`}
                      title="Card view"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="4" y="4" width="16" height="4"/><rect x="4" y="12" width="16" height="4"/></svg>
                    </button>
                  </div>
                 )}
                <button
                  onClick={() => { /* import logic here or trigger a modal if there is one */ }}
                  className="hidden md:flex items-center gap-2 h-11 px-4 rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] hover:bg-[var(--ds-gray-100)] text-label-14 font-medium transition-colors border-solid cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Import
                </button>
                {!readOnly && onNewSong && (
                  <button
                    onClick={onNewSong}
                    className="flex items-center gap-2 h-11 px-4 rounded-xl bg-[var(--ds-gray-1000)] text-[var(--ds-background-100)] hover:bg-[var(--ds-gray-800)] text-label-14 font-medium transition-colors border-none cursor-pointer"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    New Song
                  </button>
                )}
              </div>
            </div>

            {/* Sort Pills Row */}
            {viewMode === 'card' && (
              <div className="flex items-center gap-2 w-full mt-2">
                {SORT_MODES.map(mode => (
                  <button
                    key={mode.key}
                    onClick={() => handleSortClick(mode.key)}
                    className={`
                      px-4 py-2 rounded-full text-label-14 font-semibold cursor-pointer
                      transition-all duration-150 border-none flex items-center gap-1.5
                      ${sortMode === mode.key
                        ? 'bg-[var(--ds-gray-100)] text-[var(--color-brand)]'
                        : 'bg-transparent text-[var(--modes-text-muted)] hover:bg-[var(--modes-surface)]'
                      }
                    `}
                  >
                    {mode.label}
                    {sortMode === mode.key && (
                      <svg
                        width="12" height="12" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round"
                        className={`transition-transform duration-200 ${sortAsc ? '' : 'rotate-180'}`}
                      >
                        <path d="m18 15-6-6-6 6" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="w-full px-4 sm:px-8 max-w-[1400px] mx-auto py-4">
          {!loaded ? (
            <SkeletonRows />
          ) : sortedFiltered.length > 0 ? (
            <div className="flex flex-col gap-10">
              {viewMode === 'table' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead>
                      <tr className="border-b border-[var(--modes-border)] text-label-12 text-[var(--modes-text-muted)] select-none">
                        <th className="py-2 px-4 w-10">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-[var(--ds-gray-300)] accent-[var(--color-brand)] cursor-pointer"
                            checked={selectedIds.size > 0 && selectedIds.size === truncated.length}
                            onChange={toggleAll}
                          />
                        </th>
                        <th className="py-2 px-4 font-semibold w-1/3 cursor-pointer hover:text-[var(--modes-text)]" onClick={() => handleSortClick('title')}>
                          <div className="flex items-center gap-1">
                            Title
                            {sortMode === 'title' && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={sortAsc ? '' : 'rotate-180'}><path d="m18 15-6-6-6 6"/></svg>
                            )}
                          </div>
                        </th>
                        <th className="py-2 px-4 font-semibold w-1/4 cursor-pointer hover:text-[var(--modes-text)]" onClick={() => handleSortClick('artist')}>
                          <div className="flex items-center gap-1">
                            Artist
                            {sortMode === 'artist' && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={sortAsc ? '' : 'rotate-180'}><path d="m18 15-6-6-6 6"/></svg>
                            )}
                          </div>
                        </th>
                        <th className="py-2 px-4 font-semibold w-1/6 cursor-pointer hover:text-[var(--modes-text)]" onClick={() => handleSortClick('key')}>
                          <div className="flex items-center gap-1">
                            Key
                            {sortMode === 'key' && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={sortAsc ? '' : 'rotate-180'}><path d="m18 15-6-6-6 6"/></svg>
                            )}
                          </div>
                        </th>
                        <th className="py-2 px-4 font-semibold flex-1">Tags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--modes-border)]">
                      {truncated.map(song => (
                        <tr 
                          key={song.id} 
                          onClick={() => handleRowClick(song)}
                          className={cn(
                            "cursor-pointer transition-colors",
                            selectedIds.has(song.id) ? "bg-[var(--ds-gray-alpha-100)] hover:bg-[var(--ds-gray-alpha-200)]" : "hover:bg-[var(--modes-surface)]"
                          )}
                        >
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox"
                              className="w-4 h-4 rounded border-[var(--ds-gray-300)] accent-[var(--color-brand)] cursor-pointer"
                              checked={selectedIds.has(song.id)}
                              onChange={(e) => toggleSelection(e, song.id)}
                            />
                          </td>
                          <td className="py-3 px-4 text-copy-15 font-medium text-[var(--modes-text)]">{song.title}</td>
                          <td className="py-3 px-4 text-copy-14 text-[var(--modes-text-muted)]">{song.artist || 'Unknown'}</td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-label-12 font-bold bg-[var(--modes-surface-strong)] text-[var(--modes-text-muted)]">
                              {song.key || 'C'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1.5">
                              {(song.tags || []).slice(0, 3).map(tag => (
                                <span key={tag} className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--ds-gray-200)] text-[var(--ds-gray-700)]">
                                  {tag}
                                </span>
                              ))}
                              {(song.tags || []).length > 3 && (
                                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--ds-gray-200)] text-[var(--ds-gray-700)]">
                                  +{(song.tags || []).length - 3}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <>
                  {sortedKeys.map(groupKey => (
                    <div key={groupKey} className="flex flex-col gap-3">
                      <div className="flex items-baseline gap-2 px-1">
                        <h3 className="text-heading-20 font-bold text-[var(--modes-text)] m-0">
                          {groupKey}
                        </h3>
                        <span className="text-label-12 text-[var(--modes-text-dim)]">
                          {groups[groupKey].length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {groups[groupKey].map(song => (
                          <div key={song.id} className="modes-card border border-[var(--modes-border)] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            <SongCard
                              song={song}
                              variant="card"
                              showTags={true}
                              selected={isDesktop && song.id === previewSongId}
                              onClick={() => handleRowClick(song)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
              {hasMore && (
                <div ref={sentinelRef} className="py-6 text-center text-copy-12 text-[var(--modes-text-dim)]">
                  Loading more… ({truncated.length} of {filtered.length})
                </div>
              )}
            </div>
          ) : query || selectedTags.length > 0 ? (
            <div className="modes-card py-14 text-center flex flex-col items-center gap-3 border-dashed">
              <p className="text-copy-14 text-[var(--modes-text-muted)] font-medium">
                No songs matching your filters.
              </p>
            </div>
          ) : (
            <div className="modes-card py-16 px-6 flex flex-col items-center text-center border-dashed">
              <div className="w-14 h-14 mb-4 rounded-full bg-[var(--modes-surface-strong)] border border-[var(--modes-border)] flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--modes-text-muted)]">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <h2 className="text-heading-20 text-[var(--modes-text)] m-0 mb-1.5">Your library is empty</h2>
              <p className="text-copy-14 text-[var(--modes-text-muted)] max-w-sm mb-5">
                Create a new chord chart or import one from a .md file you already have.
              </p>
              {canEdit && (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="primary" onClick={onNewSong}>New song</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* FAB Cluster — tablet only; mobile uses top-bar +, desktop uses header button.
          Single tap opens the unified New Song modal. */}
      {!readOnly && onNewSong && (
        <div
          ref={fabRef}
          className="fixed right-6 z-[150] hidden sm:block lg:hidden"
          style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            onClick={onNewSong}
            aria-label="New song"
            className="w-14 h-14 rounded-full bg-[var(--color-brand)] text-white shadow-lg flex items-center justify-center cursor-pointer hover:opacity-90 transition-all duration-150 active:scale-95 border-none"
          >
            <svg
              width="24" height="24" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      )}

      </div>

      {/* Floating Selection Toast */}
      {selectedIds.size > 0 && viewMode === 'table' && (
        <div className="fixed bottom-28 sm:bottom-12 left-1/2 -translate-x-1/2 z-[150] animate-[slideUp_200ms_ease-out]">
          <div className="bg-[var(--ds-gray-1000)] text-[var(--ds-background-100)] rounded-full px-6 py-3 flex items-center gap-6 shadow-2xl">
            <span className="text-label-14 font-medium whitespace-nowrap">
              {selectedIds.size} selected
            </span>
            <div className="flex items-center gap-2 border-l border-[var(--ds-gray-700)] pl-6">
              <button className="px-4 py-2 text-label-13 font-semibold text-[var(--ds-background-100)] hover:text-white bg-transparent border border-[var(--ds-gray-700)] rounded-full hover:bg-[var(--ds-gray-800)] transition-colors cursor-pointer whitespace-nowrap">
                Add to Setlist...
              </button>
              <button className="px-4 py-2 text-label-13 font-semibold text-[var(--ds-background-100)] hover:text-white bg-transparent border border-[var(--ds-gray-700)] rounded-full hover:bg-[var(--ds-gray-800)] transition-colors cursor-pointer whitespace-nowrap">
                Copy to...
              </button>
              <button className="px-4 py-2 text-label-13 font-semibold text-[var(--ds-background-100)] hover:text-white bg-transparent border border-[var(--ds-gray-700)] rounded-full hover:bg-[var(--ds-gray-800)] transition-colors cursor-pointer whitespace-nowrap">
                Move to...
              </button>
              <button className="px-4 py-2 text-label-13 font-semibold text-red-400 bg-transparent border border-[var(--ds-gray-700)] rounded-full hover:bg-red-500/10 hover:border-red-500/50 transition-colors cursor-pointer whitespace-nowrap">
                Delete
              </button>
              <button 
                onClick={() => setSelectedIds(new Set())}
                className="w-8 h-8 ml-2 flex items-center justify-center rounded-full bg-transparent border-none text-[var(--ds-gray-400)] hover:text-white hover:bg-[var(--ds-gray-800)] transition-colors cursor-pointer"
                title="Clear selection"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Side Peek Preview */}
      <SidePeekOverlay
        open={!!previewSong}
        onClose={() => onSelectPreview?.(null)}
        onOpenFull={() => {
          if (previewSong) {
            onEditSong?.(previewSong);
            onSelectPreview?.(null);
          }
        }}
      >
        {previewSong && (
          <Suspense fallback={<div className="p-8 text-copy-14 text-[var(--ds-gray-700)]">Loading…</div>}>
            <ChartView
              key={previewSong.id}
              song={previewSong}
              onBack={() => {
                if (isFullscreen) onToggleFullscreen?.();
                onSelectPreview?.(null);
              }}
              onEdit={onEditSong ? () => onEditSong(previewSong) : null}
              isFullscreen={isFullscreen}
              onToggleFullscreen={onToggleFullscreen}
              {...chartDefaults}
            />
          </Suspense>
        )}
      </SidePeekOverlay>
    </div>
  );
}
