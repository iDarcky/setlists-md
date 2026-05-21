import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import PageHeader from './PageHeader';
import SongCard from './SongCard';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { SearchBar } from './ui/SearchBar';
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

  // Reset pagination when filter criteria change so the user doesn't stay
  // scrolled into a stale reveal window.
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
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
    <div className="flex flex-col lg:flex-row lg:h-screen">
      <div
        data-theme-variant="modes"
        className={cn(
          "relative min-w-0 pb-8",
          "lg:h-screen lg:overflow-y-auto lg:border-r lg:border-[var(--modes-border)]",
          "flex-1 lg:flex-none lg:w-[480px] xl:w-[560px]",
          isFullscreen && "lg:hidden",
        )}
      >
      <div className="hidden sm:block">
        <PageHeader title="Song Library" />
      </div>

      <div className="flex flex-col gap-0">

        {/* Sticky Search + Tags + Filters — full-width bg */}
        <div className="sticky top-0 z-20 backdrop-blur-md bg-[color-mix(in_srgb,var(--ds-background-100)_80%,transparent)] border-b border-[var(--modes-border)]">
          <div className="a4-container pt-4 sm:pt-6 pb-4 flex flex-col gap-4">
          {/* Search Bar + Tags */}
          <div className="flex gap-3 items-stretch">
            {/* Desktop text search — mobile uses the global top bar */}
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

          {/* Sort Pills with direction toggle */}
          <div className="flex items-center gap-2">
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

            {/* Desktop-only quick action (FAB is hidden on lg+) */}
            {!readOnly && onNewSong && (
              <div className="hidden lg:flex ml-auto items-center gap-1">
                <IconButton variant="default" size="sm" onClick={onNewSong} aria-label="New song" title="New song">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </IconButton>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Content */}
        <div className="a4-container py-4">
          {!loaded ? (
            <SkeletonRows />
          ) : sortedKeys.length > 0 ? (
            <div className="flex flex-col gap-10">
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
                  <div className="modes-card overflow-hidden divide-y divide-[var(--modes-border)]" style={{ borderColor: 'var(--modes-border)' }}>
                    {groups[groupKey].map(song => (
                      <SongCard
                        key={song.id}
                        song={song}
                        variant="row"
                        showTags={true}
                        selected={isDesktop && song.id === previewSongId}
                        onClick={() => handleRowClick(song)}
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
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" onClick={onNewSong}>New song</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FAB — tablet only; mobile uses the top-bar +, desktop uses header button.
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

      {/* Preview pane — desktop only */}
      <div className="hidden lg:flex lg:flex-1 lg:min-w-0 lg:h-screen lg:flex-col lg:bg-[var(--ds-background-100)]">
        {previewSong ? (
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
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 px-8 py-16">
            <div className="w-14 h-14 rounded-full bg-[var(--ds-background-200)] border border-[var(--ds-gray-400)] flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--ds-gray-700)]">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <p className="text-copy-14 text-[var(--ds-gray-700)] max-w-xs">
              Select a song from the library to preview it here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
