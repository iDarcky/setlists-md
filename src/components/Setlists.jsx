import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import SetlistCard from './SetlistCard';
import SidePeek from './shell/SidePeek';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { SearchBar } from './ui/SearchBar';
import { cn } from '../lib/utils';
import { useIsDesktop, useIsTablet, useIsLandscape } from '../lib/useMediaQuery';
import { useResizablePane } from '../lib/useResizablePane';
import { useEntitlement } from '../hooks/useEntitlement';

const SetlistOverview = lazy(() => import('./SetlistOverview'));

function songCount(sl) {
  return (sl.items || []).filter(i => i.songId).length;
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
function TableGroup({ title, count, rows, renderRow, readOnly, allChecked, onToggleAll, sortMode, sortAsc, onSort, compact = false, showService = false }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2 px-1">
        <h2 className="text-heading-20 font-bold text-[var(--modes-text)] m-0">{title}</h2>
        <span className="text-label-12 text-[var(--modes-text-dim)]">{count}</span>
      </div>
      <div className="modes-card overflow-hidden">
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr className="border-b border-[var(--modes-border)]">
              <th className="w-[44px] px-4 py-3">
                {!readOnly && <input type="checkbox" checked={allChecked} onChange={onToggleAll} aria-label={`Select all ${title.toLowerCase()}`} className="w-4 h-4 rounded accent-[var(--color-brand)] cursor-pointer align-middle" />}
              </th>
              <th className="text-left px-5 py-3"><HeaderSort label="Name" modeKey="name" sortMode={sortMode} sortAsc={sortAsc} onSort={onSort} /></th>
              <th className="text-left px-5 py-3 w-[180px]"><HeaderSort label="Date" modeKey="date" sortMode={sortMode} sortAsc={sortAsc} onSort={onSort} /></th>
              <th className="text-left px-5 py-3 hidden md:table-cell w-[90px]"><HeaderSort label="Songs" modeKey="songs" sortMode={sortMode} sortAsc={sortAsc} onSort={onSort} /></th>
              {showService && <th className="text-left px-5 py-3 hidden md:table-cell w-[150px] text-[var(--modes-text-dim)] uppercase tracking-wider text-label-12 font-semibold">Service</th>}
              {!compact && <th className="text-left px-5 py-3 hidden lg:table-cell w-[200px] text-[var(--modes-text-dim)] uppercase tracking-wider text-label-12 font-semibold">Tags</th>}
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
  onExportSetlistZip,
  onExportSetlistPdfOverview,
  onExportSetlistPdfFull,
  onDeleteSetlist,
  onDeleteSetlists,
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
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'gallery'
  const [sortMode, setSortMode] = useState('date');   // 'name' | 'date' | 'songs'
  const [sortAsc, setSortAsc] = useState(false);
  const [selected, setSelected] = useState([]);
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
    const handler = (e) => { if (e.key === 'Escape') setFabOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Distinct services across all setlists (church tier) — powers the filter.
  const serviceOptions = useMemo(
    () => [...new Set(setlists.map(s => s.service).filter(Boolean))].sort(),
    [setlists],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return setlists.filter(sl => {
      if (showService && serviceFilter !== 'all' && (sl.service || '') !== serviceFilter) return false;
      if (!q) return true;
      return (
        (sl.name || '').toLowerCase().includes(q) ||
        (sl.service || '').toLowerCase().includes(q) ||
        (sl.tags || []).some(t => t.toLowerCase().includes(q))
      );
    });
  }, [setlists, query, showService, serviceFilter]);

  useEffect(() => { setSelected([]); }, [query, sortMode, sortAsc, serviceFilter]);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  // Gallery grouping (Upcoming / Past)
  const { upcoming, past } = useMemo(() => {
    const up = [], pa = [];
    filtered.forEach(sl => {
      const slDate = new Date(sl.date + 'T12:00:00');
      if (slDate >= today) up.push(sl); else pa.push(sl);
    });
    up.sort((a, b) => new Date(a.date) - new Date(b.date));
    pa.sort((a, b) => new Date(b.date) - new Date(a.date));
    return { upcoming: up, past: pa };
  }, [filtered, today]);

  // Flat table rows
  const flatRows = useMemo(() => {
    const dir = sortAsc ? 1 : -1;
    const val = (s) =>
      sortMode === 'name' ? (s.name || '').toLowerCase() :
      sortMode === 'songs' ? songCount(s) :
      (s.date || '');
    return [...filtered].sort((a, b) => {
      const av = val(a), bv = val(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return cmp * dir;
    });
  }, [filtered, sortMode, sortAsc]);

  // Table view splits the (sorted) rows into Upcoming / Past, preserving the
  // active column sort within each group. Undated setlists fall into Past.
  const { tableUpcoming, tablePast } = useMemo(() => {
    const up = [], pa = [];
    flatRows.forEach(sl => {
      const d = new Date((sl.date || '') + 'T12:00:00');
      if (!isNaN(d) && d >= today) up.push(sl); else pa.push(sl);
    });
    return { tableUpcoming: up, tablePast: pa };
  }, [flatRows, today]);

  const handleSortClick = (modeKey) => {
    if (sortMode === modeKey) setSortAsc(p => !p);
    else { setSortMode(modeKey); setSortAsc(modeKey === 'name'); }
  };

  const closePeek = () => {
    if (isFullscreen) onToggleFullscreen?.();
    onSelectPreview?.(null);
  };

  // Table view + master-detail on desktop and tablet; phones keep the gallery.
  const effectiveView = advanced ? viewMode : 'gallery';

  // Selection
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const toggleSelect = (id, e) => { e?.stopPropagation(); setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };
  const toggleSelectGroup = (rows) => {
    const ids = rows.map(r => r.id);
    const allIn = ids.every(id => selectedSet.has(id));
    setSelected(prev => allIn ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]);
  };
  const clearSelection = () => setSelected([]);
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
            {onSelectPreview && !isTablet && (
              <button onClick={(e) => openPeek(sl, e)} aria-label="Open in pane" title="Open in pane"
                className="hidden lg:inline-flex ml-auto items-center justify-center w-7 h-7 rounded-md border-none bg-transparent text-[var(--modes-text-muted)] opacity-0 group-hover:opacity-100 hover:bg-[var(--modes-surface-strong)] hover:text-[var(--modes-text)] transition-all cursor-pointer">
                <PaneIcon />
              </button>
            )}
          </div>
        </td>
        <td className="px-5 py-3.5 text-copy-14 text-[var(--modes-text-muted)] whitespace-nowrap">{formatDate(sl.date)}</td>
        <td className="px-5 py-3.5 text-copy-14 text-[var(--modes-text-muted)] hidden md:table-cell">{songCount(sl)}</td>
        {showService && (
          <td className="px-5 py-3.5 hidden md:table-cell">
            {sl.service
              ? <span className="text-label-12 px-2 py-0.5 rounded-full bg-[var(--modes-surface)] text-[var(--modes-text-muted)] border border-[var(--modes-border)] whitespace-nowrap">{sl.service}</span>
              : <span className="text-copy-14 text-[var(--modes-text-dim)]">—</span>}
          </td>
        )}
        {!splitDock && (
          <td className="px-5 py-3.5 hidden lg:table-cell">
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
    <div data-theme-variant="modes" className={cn(splitDock ? 'absolute inset-0 flex overflow-hidden' : 'relative h-full overflow-y-auto')}>
      {/* List column — own scroller when a pane is docked beside it. */}
      <div className={splitDock ? 'flex-1 min-w-0 min-h-0 overflow-y-auto' : 'contents'}>
      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-md bg-[color-mix(in_srgb,var(--ds-background-100)_80%,transparent)] border-b border-[var(--modes-border)] hidden sm:block">
        <div className="w-full max-w-[1320px] mx-auto px-5 sm:px-8 pt-5 sm:pt-7 pb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-heading-32 font-bold text-[var(--modes-text)] m-0 mr-2">Setlists</h1>
          <SearchBar
            className="flex-1 min-w-[200px]"
            placeholder="Search setlists by name, location, or tag…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />

          {showService && serviceOptions.length > 0 && (
            <select
              value={serviceFilter}
              onChange={e => setServiceFilter(e.target.value)}
              aria-label="Filter by service"
              className={cn(
                'h-9 px-3 rounded-lg border text-label-14 cursor-pointer bg-[var(--modes-surface)] outline-none transition-colors focus:border-[var(--color-brand)]',
                serviceFilter !== 'all'
                  ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
                  : 'border-[var(--modes-border)] text-[var(--modes-text)] hover:bg-[var(--modes-surface-strong)]',
              )}
            >
              <option value="all">All services</option>
              {serviceOptions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}

          <div className={cn('items-center rounded-lg border border-[var(--modes-border)] overflow-hidden', advanced ? 'flex' : 'hidden')}>
            <button onClick={() => setViewMode('table')} aria-label="Table view" title="Table view"
              className={cn('w-9 h-9 flex items-center justify-center cursor-pointer border-none transition-colors',
                viewMode === 'table' ? 'bg-[var(--modes-surface-strong)] text-[var(--color-brand)]' : 'bg-transparent text-[var(--modes-text-muted)] hover:bg-[var(--modes-surface)]')}>
              <TableViewIcon />
            </button>
            <button onClick={() => setViewMode('gallery')} aria-label="Gallery view" title="Gallery view"
              className={cn('w-9 h-9 flex items-center justify-center cursor-pointer border-none transition-colors',
                viewMode === 'gallery' ? 'bg-[var(--modes-surface-strong)] text-[var(--color-brand)]' : 'bg-transparent text-[var(--modes-text-muted)] hover:bg-[var(--modes-surface)]')}>
              <GalleryViewIcon />
            </button>
          </div>

          {!readOnly && (
            <div className="hidden lg:flex items-center gap-2 shrink-0">
              {onImportSetlist && (
                <IconButton variant="default" size="sm" onClick={() => fileInputRef.current?.click()} aria-label="Import .zip" title="Import .zip">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </IconButton>
              )}
              {onNewSetlist && (
                <Button variant="brand" size="sm" onClick={onNewSetlist}>+ New Setlist</Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-[1320px] mx-auto px-5 sm:px-8 py-5">
        {!loaded ? (
          <SkeletonRows />
        ) : filtered.length === 0 ? (
          query ? (
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
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {upcoming.length > 0 && (
              <section className="flex flex-col gap-4">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-heading-20 font-bold text-[var(--modes-text)] m-0">Upcoming</h2>
                  <span className="text-label-12 text-[var(--modes-text-dim)]">{upcoming.length}</span>
                </div>
                <div className="flex flex-col gap-4">
                  {upcoming.map(sl => (
                    <SetlistCard key={sl.id} setlist={sl} selected={advanced && sl.id === previewSetlistId} onPlay={() => onPlaySetlist(sl)} onView={() => onRowActivate(sl)} clockFormat={clockFormat} />
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
                <div className="flex flex-col gap-4">
                  {past.map(sl => (
                    <SetlistCard key={sl.id} setlist={sl} selected={advanced && sl.id === previewSetlistId} onPlay={() => onPlaySetlist(sl)} onView={() => onRowActivate(sl)} clockFormat={clockFormat} />
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

      {/* Bulk action bar — desktop + tablet. On touch tablets it must clear the
          floating bottom nav, so lift it above the nav there. */}
      {advanced && !readOnly && selected.length > 0 && (
        <div
          className="fixed left-1/2 -translate-x-1/2 bottom-6 z-[160] flex items-center gap-2 pl-4 pr-2 py-2 rounded-full bg-[var(--ds-background-200)] border border-[var(--ds-gray-300)] shadow-2xl"
          style={isTablet ? { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' } : undefined}
        >
          <span className="text-label-14 font-semibold text-[var(--ds-gray-1000)] whitespace-nowrap">{selected.length} selected</span>
          <span className="w-px h-5 bg-[var(--ds-gray-300)]" />
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
