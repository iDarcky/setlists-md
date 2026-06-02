import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import SetlistCard from './SetlistCard';
import SidePeek from './shell/SidePeek';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { SearchBar } from './ui/SearchBar';
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { upcoming, past } = useMemo(() => {
    const upcoming = [];
    const past = [];
    filtered.forEach(sl => {
      const slDate = new Date(sl.date + 'T12:00:00');
      if (slDate >= today) upcoming.push(sl);
      else past.push(sl);
    });
    upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
    past.sort((a, b) => new Date(b.date) - new Date(a.date));
    return { upcoming, past };
  }, [filtered]);

  const closePeek = () => {
    if (isFullscreen) onToggleFullscreen?.();
    onSelectPreview?.(null);
  };

  return (
    <div data-theme-variant="modes" className="relative h-full overflow-y-auto">
      {/* Header: title + search + actions */}
      <div className="sticky top-0 z-20 backdrop-blur-md bg-[color-mix(in_srgb,var(--ds-background-100)_80%,transparent)] border-b border-[var(--modes-border)] hidden sm:block">
        <div className="w-full px-5 sm:px-8 pt-5 sm:pt-7 pb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-heading-32 font-bold text-[var(--modes-text)] m-0 mr-2">Setlists</h1>
          <SearchBar
            className="flex-1 min-w-[200px]"
            placeholder="Search setlists by name, location, or tag…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {!readOnly && (
            <div className="hidden lg:flex items-center gap-2 shrink-0">
              {onImportSetlist && (
                <IconButton variant="default" size="sm" onClick={() => fileInputRef.current?.click()} aria-label="Import .zip" title="Import .zip">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </IconButton>
              )}
              {onNewSetlist && (
                <Button variant="primary" size="sm" onClick={onNewSetlist}>+ New Setlist</Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-5 sm:px-8 py-5 max-w-[1100px] mx-auto flex flex-col gap-10">
        {!loaded ? (
          <SkeletonCards />
        ) : (
          <>
            {upcoming.length > 0 && (
              <section className="flex flex-col gap-4">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-heading-20 font-bold text-[var(--modes-text)] m-0">Upcoming</h2>
                  <span className="text-label-12 text-[var(--modes-text-dim)]">{upcoming.length}</span>
                </div>
                <div className="flex flex-col gap-4">
                  {upcoming.map(sl => (
                    <SetlistCard
                      key={sl.id}
                      setlist={sl}
                      selected={isDesktop && sl.id === previewSetlistId}
                      onPlay={() => onPlaySetlist(sl)}
                      onView={() => handleView(sl)}
                      clockFormat={clockFormat}
                    />
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
                    <SetlistCard
                      key={sl.id}
                      setlist={sl}
                      selected={isDesktop && sl.id === previewSetlistId}
                      onPlay={() => onPlaySetlist(sl)}
                      onView={() => handleView(sl)}
                      clockFormat={clockFormat}
                    />
                  ))}
                </div>
              </section>
            )}

            {filtered.length === 0 && (
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
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
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

      {/* Right-side peek — desktop only */}
      <SidePeek open={isDesktop && !!previewSetlist} onClose={closePeek} label="Setlist preview">
        {previewSetlist && (
          <Suspense fallback={<div className="p-8 text-copy-14 text-[var(--ds-gray-700)]">Loading…</div>}>
            <SetlistOverview
              key={previewSetlist.id}
              setlist={previewSetlist}
              songs={songs}
              clockFormat={clockFormat}
              onBack={closePeek}
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
      </SidePeek>
    </div>
  );
}
