import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import PageHeader from './PageHeader';
import SetlistCard from './SetlistCard';
import { DesktopSetlistsTable } from './DesktopSetlistsTable';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { Input } from './ui/Input';
import { cn } from '../lib/utils';
import { useIsDesktop } from '../lib/useMediaQuery';

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const SetlistOverview = lazy(() => import('./SetlistOverview'));

function SkeletonCards() {
  return (
    <div className="flex flex-col gap-8">
      {[1, 2].map(section => (
        <div key={section} className="flex flex-col gap-4">
          <div className="h-5 w-28 bg-[var(--modes-surface-strong)] rounded animate-pulse" />
          <div className="flex flex-col gap-4">
            {[1, 2].map(c => (
              <div key={c} className="border border-[var(--notion-border)] rounded-lg bg-[var(--notion-bg)]-strong flex flex-col md:flex-row h-auto md:h-64 overflow-hidden">
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
  onExportSetlistZip,
  onExportSetlistPdfOverview,
  onExportSetlistPdfFull,
  onDeleteSetlist,
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
    <div className="flex flex-col lg:flex-row lg:h-screen bg-[var(--ds-background-100)] lg:bg-[var(--notion-bg)]" style={{ color: 'var(--notion-text-main)' }}>
      {/* Mobile / Tablet View (Preserved) */}
      <div
        data-theme-variant="modes"
        className={cn(
          "relative min-w-0 pb-8 lg:hidden",
          "flex-1",
          isFullscreen && "hidden",
        )}
      >
      <div className="flex flex-col gap-0">

        {/* Sticky Search — hidden on mobile (global top-bar covers it) */}
        <div className="sticky top-0 z-20 backdrop-blur-md bg-[color-mix(in_srgb,var(--ds-background-100)_80%,transparent)] border-b border-[var(--modes-border)] hidden sm:block">
          <div className="a4-container pt-6 pb-4 flex items-center gap-2">
            <Input
              className="flex-1"
              placeholder="Search setlists…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              prefix={<SearchIcon />}
            />

            {/* Desktop-only quick actions (FAB is hidden on lg+) */}
            <div className="hidden lg:flex items-center gap-1 shrink-0">
              <IconButton variant="default" size="sm" onClick={() => fileInputRef.current?.click()} aria-label="Import .zip" title="Import .zip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </IconButton>
              <IconButton variant="default" size="sm" onClick={onNewSetlist} aria-label="New setlist" title="New setlist">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </IconButton>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="a4-container py-4 flex flex-col gap-10">
          {!loaded ? (
            <SkeletonCards />
          ) : (
            <>
              {/* Upcoming Section */}
              {upcoming.length > 0 && (
                <section className="flex flex-col gap-4">
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-heading-20 font-bold text-[var(--notion-text-main)] m-0">
                      Upcoming
                    </h2>
                    <span className="text-label-12 text-[var(--notion-text-dim)]">
                      {upcoming.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-4">
                    {upcoming.map(sl => (
                      <SetlistCard
                        key={sl.id}
                        setlist={sl}
                        selected={isDesktop && sl.id === previewSetlistId}
                        onPlay={() => onPlaySetlist(sl)}
                        onView={() => handleView(sl)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Past Section */}
              {past.length > 0 && (
                <section className="flex flex-col gap-4">
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-heading-20 font-bold text-[var(--notion-text-main)] m-0">
                      Past
                    </h2>
                    <span className="text-label-12 text-[var(--notion-text-dim)]">
                      {past.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-4">
                    {past.map(sl => (
                      <SetlistCard
                        key={sl.id}
                        setlist={sl}
                        selected={isDesktop && sl.id === previewSetlistId}
                        onPlay={() => onPlaySetlist(sl)}
                        onView={() => handleView(sl)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Empty State */}
              {filtered.length === 0 && (
                query ? (
                  <div className="border border-[var(--notion-border)] rounded-lg bg-[var(--notion-bg)] py-14 text-center flex flex-col items-center gap-3 border-dashed">
                    <p className="text-copy-14 text-[var(--notion-text-dim)] font-medium">
                      No setlists matching your search.
                    </p>
                  </div>
                ) : (
                  <div className="border border-[var(--notion-border)] rounded-lg bg-[var(--notion-bg)] py-16 px-6 flex flex-col items-center text-center border-dashed">
                    <div className="w-14 h-14 mb-4 rounded-full bg-[var(--modes-surface-strong)] border border-[var(--modes-border)] flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--notion-text-dim)]">
                        <line x1="8" y1="6" x2="21" y2="6" />
                        <line x1="8" y1="12" x2="21" y2="12" />
                        <line x1="8" y1="18" x2="21" y2="18" />
                        <line x1="3" y1="6" x2="3.01" y2="6" />
                        <line x1="3" y1="12" x2="3.01" y2="12" />
                        <line x1="3" y1="18" x2="3.01" y2="18" />
                      </svg>
                    </div>
                    <h2 className="text-heading-20 text-[var(--notion-text-main)] m-0 mb-1.5">No setlists yet</h2>
                    <p className="text-copy-14 text-[var(--notion-text-dim)] max-w-sm mb-5">
                      Organize your songs into setlists for rehearsals or live performances.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button variant="brand" onClick={onNewSetlist}>Create setlist</Button>
                      <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Import .zip</Button>
                    </div>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>

      {/* FAB Cluster — tablet only; mobile uses top-bar +, desktop uses header button */}
      <div
        ref={fabRef}
        className="fixed right-6 z-[150] hidden sm:block lg:hidden"
        style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
      >
        {fabOpen && (
          <div className="absolute bottom-full right-0 mb-3 flex flex-col gap-2">
            <button
              onClick={() => { setFabOpen(false); onNewSetlist(); }}
              className="px-5 py-3 rounded-xl bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] shadow-lg cursor-pointer hover:border-[var(--ds-gray-600)] transition-all duration-150 whitespace-nowrap text-label-14 text-[var(--text-1)] text-left"
            >
              Create Setlist
            </button>
            <button
              onClick={() => { setFabOpen(false); fileInputRef.current?.click(); }}
              className="px-5 py-3 rounded-xl bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] shadow-lg cursor-pointer hover:border-[var(--ds-gray-600)] transition-all duration-150 whitespace-nowrap text-label-14 text-[var(--text-1)] text-left"
            >
              Import Setlist
            </button>
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

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        onChange={(e) => {
          const file = e.target.files[0];
          if (file) onImportSetlist(file);
          e.target.value = '';
        }}
        className="hidden"
      />
      </div>

      {/* Desktop View (Notion-style Table) */}
      <div className={cn(
        "hidden lg:flex flex-col relative h-screen w-full transition-all duration-300",
        previewSetlist ? "lg:w-[calc(100%-400px)] xl:w-[calc(100%-500px)]" : "w-full"
      )}>
        {/* Header Area */}
        <div className="pt-8 pb-4 px-8 border-b" style={{ borderColor: 'var(--notion-border)' }}>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-heading-32 m-0 font-bold" style={{ color: 'var(--notion-text-main)' }}>Setlists</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 h-9 px-4 rounded-md text-label-13 font-semibold bg-[var(--notion-bg-hover)] text-[var(--notion-text-main)] border-none cursor-pointer hover:opacity-90 transition-opacity"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Import
              </button>
              <button
                onClick={onNewSetlist}
                className="flex items-center gap-2 h-9 px-4 rounded-md text-label-13 font-semibold bg-[var(--color-brand)] text-white border-none cursor-pointer hover:opacity-90 transition-opacity"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Input
                placeholder="Search setlists..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                prefix={<SearchIcon />}
                className="w-full bg-[var(--notion-bg-hover)] border-none text-[var(--notion-text-main)]"
              />
            </div>
          </div>
        </div>

        {/* Database Table */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {!loaded ? (
            <div className="p-8">Loading database...</div>
          ) : (
            <div className="pb-16 px-4 py-4 flex flex-col gap-8">
              {upcoming.length > 0 && (
                <section>
                  <h2 className="text-heading-20 font-bold px-4 mb-2" style={{ color: 'var(--notion-text-main)' }}>Upcoming</h2>
                  <DesktopSetlistsTable
                    setlists={upcoming}
                    onSelectSetlist={handleView}
                  />
                </section>
              )}
              {past.length > 0 && (
                <section>
                  <h2 className="text-heading-20 font-bold px-4 mb-2" style={{ color: 'var(--notion-text-main)' }}>Past</h2>
                  <DesktopSetlistsTable
                    setlists={past}
                    onSelectSetlist={handleView}
                  />
                </section>
              )}
              {filtered.length === 0 && (
                <div className="p-8 text-center text-copy-14" style={{ color: 'var(--notion-text-dim)' }}>
                  No setlists found.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Side-Peek Modal — Desktop only */}
      <div
        className={cn(
          "hidden lg:flex fixed top-0 right-0 h-screen bg-[var(--ds-background-100)] border-l shadow-2xl transition-all duration-300 ease-in-out z-[100] overflow-y-auto",
          previewSetlist ? "translate-x-0" : "translate-x-full"
        )}
        style={{
          width: isFullscreen ? '100vw' : 'min(500px, 40vw)',
          borderColor: 'var(--notion-border)'
        }}
      >
        {previewSetlist ? (
          <Suspense fallback={<div className="p-8 text-copy-14 text-[var(--ds-gray-700)]">Loading…</div>}>
            <SetlistOverview
              key={previewSetlist.id}
              setlist={previewSetlist}
              songs={songs}
              onBack={() => {
                if (isFullscreen) onToggleFullscreen?.();
                onSelectPreview?.(null);
              }}
              onEdit={() => onEditSetlist?.(previewSetlist)}
              onExportZip={() => onExportSetlistZip?.(previewSetlist)}
              onExportPdfOverview={() => onExportSetlistPdfOverview?.(previewSetlist)}
              onExportPdfFull={() => onExportSetlistPdfFull?.(previewSetlist)}
              onPlay={() => onPlaySetlist(previewSetlist)}
              onPractice={() => onPracticeSetlist?.(previewSetlist)}
              onDelete={() => onDeleteSetlist?.(previewSetlist.id)}
              isFullscreen={isFullscreen}
              onToggleFullscreen={onToggleFullscreen}
            />
          </Suspense>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 px-8 py-16">
            <div className="w-14 h-14 rounded-full bg-[var(--ds-background-200)] border border-[var(--ds-gray-400)] flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--ds-gray-700)]">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </div>
            <p className="text-copy-14 text-[var(--ds-gray-700)] max-w-xs">
              Select a setlist from the list to preview it here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
