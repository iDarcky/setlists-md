import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import PageHeader from './PageHeader';
import SetlistCard from './SetlistCard';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { SearchBar } from './ui/SearchBar';
import SidePeekOverlay from './SidePeekOverlay';
import { cn } from '../lib/utils';
import { useIsDesktop } from '../lib/useMediaQuery';

const SetlistOverview = lazy(() => import('./SetlistOverview'));

function SkeletonCards() {
  return (
    <div className="flex flex-col gap-8">
      {[1, 2].map(section => (
        <div key={section} className="flex flex-col gap-4">
          <div className="h-5 w-28 bg-[var(--modes-surface-strong)] rounded animate-pulse" />
          <div className="flex flex-col gap-4">
            {[1, 2].map(c => (
              <div key={c} className="modes-card-strong flex flex-col md:flex-row h-auto md:h-64 overflow-hidden">
                <div className="w-full md:w-1/3 h-32 md:h-full bg-[var(--modes-surface-strong)] animate-pulse" />
                <div className="flex-1 p-8 flex flex-col gap-3">
                  <div className="h-5 w-20 bg-[var(--modes-surface-strong)] rounded animate-pulse" />
                  <div className="h-8 w-56 bg-[var(--modes-surface-strong)] rounded animate-pulse" />
                  <div className="h-4 w-40 bg-[var(--modes-surface-strong)] rounded animate-pulse" />
                  <div className="h-10 w-32 bg-[var(--modes-surface-strong)] rounded-md animate-pulse mt-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
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
  onExportSetlistZip,
  onExportSetlistPdfOverview,
  onExportSetlistPdfFull,
  onDeleteSetlist,
  canEdit = true,
  viewMode = 'card',
  onViewModeChange,
}) {
  const isDesktop = useIsDesktop();
  const previewSetlist = useMemo(
    () => setlists.find(s => s.id === previewSetlistId) || null,
    [setlists, previewSetlistId],
  );

  const handleView = (sl) => {
    if (isDesktop && onSelectPreview) onSelectPreview(sl.id);
    else onViewSetlist(sl);
  };
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [fabOpen, setFabOpen] = useState(false);
  const fabRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (fabRef.current && !fabRef.current.contains(e.target)) setFabOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') setFabOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const filtered = useMemo(() => {
    if (!query) return setlists;
    const q = query.toLowerCase();
    return setlists.filter(sl =>
      (sl.name || '').toLowerCase().includes(q) ||
      (sl.service || '').toLowerCase().includes(q) ||
      (sl.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }, [setlists, query]);

  const sortedFiltered = useMemo(() => {
    const dir = sortAsc ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortMode === 'date') {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        return (da - db) * dir;
      }
      if (sortMode === 'songs') {
        const cA = a.items?.length || 0;
        const cB = b.items?.length || 0;
        return (cA - cB) * dir;
      }
      const valA = (a[sortMode] || '').toLowerCase();
      const valB = (b[sortMode] || '').toLowerCase();
      return valA.localeCompare(valB) * dir;
    });
  }, [filtered, sortMode, sortAsc]);

  const toggleSelection = (e, id) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === sortedFiltered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedFiltered.map(s => s.id)));
    }
  };

  const handleSortClick = (modeKey) => {
    if (sortMode === modeKey) {
      setSortAsc(prev => !prev);
    } else {
      setSortMode(modeKey);
      setSortAsc(modeKey !== 'date'); // Default to desc for dates, asc for others
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { upcoming, past } = useMemo(() => {
    const upcoming = [];
    const past = [];
    filtered.forEach(sl => {
      const slDate = new Date(sl.date + 'T12:00:00');
      if (slDate >= today) {
        upcoming.push(sl);
      } else {
        past.push(sl);
      }
    });
    upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
    past.sort((a, b) => new Date(b.date) - new Date(a.date));
    return { upcoming, past };
  }, [filtered]);

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
              <h1 className="text-3xl font-bold text-[var(--ds-gray-1000)] m-0 tracking-tight">Setlists</h1>
              <div className="flex items-center gap-2">
                {onImportSetlist && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] hover:bg-[var(--ds-gray-100)] text-label-14 font-medium transition-colors border-solid"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Import
                  </button>
                )}
                {!readOnly && (
                  <button
                    onClick={onNewSetlist}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--ds-gray-1000)] text-[var(--ds-background-100)] hover:bg-[var(--ds-gray-800)] text-label-14 font-medium transition-colors border-none"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    New Setlist
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex gap-3 items-stretch">
              <SearchBar
                className="flex-1"
                placeholder="Search setlists by name, location, or tag…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              
              {/* View Mode Toggles */}
              {onViewModeChange && (
                <div className="hidden sm:flex bg-[var(--modes-surface)] rounded-md border border-[var(--modes-border)] p-0.5 ml-2">
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
            </div>
          </div>
        </div>

        {/* Content */}
        {selectedIds.size > 0 && viewMode === 'table' && (
          <div className="w-full px-4 sm:px-8 max-w-[1400px] mx-auto py-2">
            <div className="bg-[var(--ds-gray-100)] border border-[var(--ds-gray-300)] rounded-md px-4 py-2 flex items-center justify-between">
              <span className="text-label-14 font-medium text-[var(--ds-gray-800)]">
                {selectedIds.size} item{selectedIds.size > 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 text-label-12 font-semibold text-[var(--ds-gray-700)] bg-[var(--ds-background-100)] border border-[var(--ds-gray-300)] rounded hover:bg-[var(--ds-gray-200)] transition-colors cursor-pointer">
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="w-full px-4 sm:px-8 max-w-[1400px] mx-auto py-4 flex flex-col gap-10">
          {!loaded ? (
            <SkeletonCards />
          ) : (
            <>
              {viewMode === 'table' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-[var(--modes-border)] text-label-12 text-[var(--modes-text-muted)] select-none">
                        <th className="py-2 px-4 w-10">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-[var(--ds-gray-300)] accent-[var(--color-brand)] cursor-pointer"
                            checked={selectedIds.size > 0 && selectedIds.size === sortedFiltered.length}
                            onChange={toggleAll}
                          />
                        </th>
                        <th className="py-2 px-4 font-semibold cursor-pointer hover:text-[var(--modes-text)]" onClick={() => handleSortClick('name')}>
                          <div className="flex items-center gap-1">
                            Name
                            {sortMode === 'name' && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={sortAsc ? '' : 'rotate-180'}><path d="m18 15-6-6-6 6"/></svg>
                            )}
                          </div>
                        </th>
                        <th className="py-2 px-4 font-semibold cursor-pointer hover:text-[var(--modes-text)]" onClick={() => handleSortClick('date')}>
                          <div className="flex items-center gap-1">
                            Date
                            {sortMode === 'date' && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={sortAsc ? '' : 'rotate-180'}><path d="m18 15-6-6-6 6"/></svg>
                            )}
                          </div>
                        </th>
                        <th className="py-2 px-4 font-semibold cursor-pointer hover:text-[var(--modes-text)]" onClick={() => handleSortClick('songs')}>
                          <div className="flex items-center gap-1">
                            Songs
                            {sortMode === 'songs' && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={sortAsc ? '' : 'rotate-180'}><path d="m18 15-6-6-6 6"/></svg>
                            )}
                          </div>
                        </th>
                        <th className="py-2 px-4 font-semibold flex-1">Tags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--modes-border)]">
                      {sortedFiltered.map(sl => (
                        <tr 
                          key={sl.id} 
                          onClick={() => handleView(sl)}
                          className={cn(
                            "cursor-pointer transition-colors",
                            selectedIds.has(sl.id) ? "bg-[var(--ds-gray-alpha-100)] hover:bg-[var(--ds-gray-alpha-200)]" : "hover:bg-[var(--modes-surface)]"
                          )}
                        >
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox"
                              className="w-4 h-4 rounded border-[var(--ds-gray-300)] accent-[var(--color-brand)] cursor-pointer"
                              checked={selectedIds.has(sl.id)}
                              onChange={(e) => toggleSelection(e, sl.id)}
                            />
                          </td>
                          <td className="py-3 px-4 text-copy-15 font-medium text-[var(--modes-text)]">{sl.name || 'Untitled Setlist'}</td>
                          <td className="py-3 px-4 text-copy-14 text-[var(--modes-text-muted)]">
                            {new Date(sl.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </td>
                          <td className="py-3 px-4 text-copy-14 text-[var(--modes-text-muted)]">
                            {sl.items?.length || 0}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1.5">
                              {(sl.tags || []).slice(0, 3).map(tag => (
                                <span key={tag} className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--ds-gray-200)] text-[var(--ds-gray-700)]">
                                  {tag}
                                </span>
                              ))}
                              {(sl.tags || []).length > 3 && (
                                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--ds-gray-200)] text-[var(--ds-gray-700)]">
                                  +{(sl.tags || []).length - 3}
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
                  {/* Upcoming Section */}
                  {upcoming.length > 0 && (
                    <section className="flex flex-col gap-4">
                      <div className="flex items-baseline gap-2">
                        <h2 className="text-heading-20 font-bold text-[var(--modes-text)] m-0">
                          Upcoming
                        </h2>
                        <span className="text-label-12 text-[var(--modes-text-dim)]">
                          {upcoming.length}
                        </span>
                      </div>
                    </section>
                  )}
                </>
              )}

              {/* Empty State */}
              {filtered.length === 0 && (
                query ? (
                  <div className="modes-card py-14 text-center flex flex-col items-center gap-3 border-dashed">
                    <p className="text-copy-14 text-[var(--modes-text-muted)] font-medium">
                      No setlists matching your search.
                    </p>
                  </div>
                ) : (
                  <div className="modes-card py-16 px-6 flex flex-col items-center text-center border-dashed">
                    <div className="w-14 h-14 mb-4 rounded-full bg-[var(--modes-surface-strong)] border border-[var(--modes-border)] flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--modes-text-muted)]">
                        <line x1="8" y1="6" x2="21" y2="6" />
                        <line x1="8" y1="12" x2="21" y2="12" />
                        <line x1="8" y1="18" x2="21" y2="18" />
                        <line x1="3" y1="6" x2="3.01" y2="6" />
                        <line x1="3" y1="12" x2="3.01" y2="12" />
                        <line x1="3" y1="18" x2="3.01" y2="18" />
                      </svg>
                    </div>
                    <h2 className="text-heading-20 text-[var(--modes-text)] m-0 mb-1.5">No setlists yet</h2>
                    <p className="text-copy-14 text-[var(--modes-text-muted)] max-w-sm mb-5">
                      Organize your songs into setlists for rehearsals or live performances.
                    </p>
                    {canEdit && (
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button variant="brand" onClick={onNewSetlist}>Create setlist</Button>
                        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Import .zip</Button>
                      </div>
                    )}
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>

      {/* FAB Cluster — tablet only; mobile uses top-bar +, desktop uses header button */}
      {!readOnly && (onNewSetlist || onImportSetlist) && (
        <div
          ref={fabRef}
          className="fixed right-6 z-[150] hidden sm:block lg:hidden"
          style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
        >
          {fabOpen && (
            <div className="absolute bottom-full right-0 mb-3 flex flex-col gap-2">
              {onNewSetlist && (
                <button
                  onClick={() => { setFabOpen(false); onNewSetlist(); }}
                  className="px-5 py-3 rounded-xl bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] shadow-lg cursor-pointer hover:border-[var(--ds-gray-600)] transition-all duration-150 whitespace-nowrap text-label-14 text-[var(--text-1)] text-left"
                >
                  Create Setlist
                </button>
              )}
              {onImportSetlist && (
                <button
                  onClick={() => { setFabOpen(false); fileInputRef.current?.click(); }}
                  className="px-5 py-3 rounded-xl bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] shadow-lg cursor-pointer hover:border-[var(--ds-gray-600)] transition-all duration-150 whitespace-nowrap text-label-14 text-[var(--text-1)] text-left"
                >
                  Import Setlist
                </button>
              )}
            </div>
          )}

          <button
            onClick={() => setFabOpen(!fabOpen)}
            className="w-14 h-14 rounded-full bg-[var(--color-brand)] text-white shadow-lg flex items-center justify-center cursor-pointer hover:opacity-90 transition-all duration-150 active:scale-95 border-none"
          >
            <svg
              width="24" height="24" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform duration-200 ${fabOpen ? 'rotate-45' : ''}`}
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        onChange={(e) => {
          const file = e.target.files[0];
          if (file) onImportSetlist?.(file);
          e.target.value = '';
        }}
        className="hidden"
      />
      </div>

      {/* Side Peek Preview */}
      <SidePeekOverlay
        open={!!previewSetlist}
        onClose={() => onSelectPreview?.(null)}
        onOpenFull={() => {
          if (previewSetlist) {
            onEditSetlist?.(previewSetlist);
            onSelectPreview?.(null);
          }
        }}
      >
        {previewSetlist && (
          <Suspense fallback={<div className="p-8 text-copy-14 text-[var(--ds-gray-700)]">Loading…</div>}>
            <SetlistOverview
              key={previewSetlist.id}
              setlist={previewSetlist}
              songs={songs}
              clockFormat={clockFormat}
              onBack={() => {
                if (isFullscreen) onToggleFullscreen?.();
                onSelectPreview?.(null);
              }}
              onEdit={canEdit ? () => onEditSetlist?.(previewSetlist) : undefined}
              onExportZip={() => onExportSetlistZip?.(previewSetlist)}
              onExportPdfOverview={() => onExportSetlistPdfOverview?.(previewSetlist)}
              onExportPdfFull={() => onExportSetlistPdfFull?.(previewSetlist)}
              onPlay={() => onPlaySetlist(previewSetlist)}
              onPractice={() => onPracticeSetlist?.(previewSetlist)}
              onDelete={canEdit ? () => onDeleteSetlist?.(previewSetlist.id) : undefined}
              isFullscreen={isFullscreen}
              onToggleFullscreen={onToggleFullscreen}
              canEdit={canEdit}
            />
          </Suspense>
        )}
      </SidePeekOverlay>
    </div>
  );
}
