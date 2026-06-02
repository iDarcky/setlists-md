import React, { useEffect, useMemo, useRef, useState } from 'react';
import SongCard from './SongCard';

const HamburgerIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="7" x2="21" y2="7" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="17" x2="21" y2="17" />
  </svg>
);

const PlusIcon = ({ open = false }) => (
  <svg
    width="26" height="26" viewBox="0 0 24 24"
    fill="none" stroke="white" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round"
    className={`transition-transform duration-200 ${open ? 'rotate-45' : ''}`}
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function MobileTopBar({
  view,
  songs,
  setlists,
  onOpenDrawer,
  onSelectSong,
  onSelectSetlist,
  onNewSong,
  onNewSetlist,
}) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const inputRef = useRef(null);
  const addRef = useRef(null);
  const containerRef = useRef(null);

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return { songs: [], setlists: [] };
    const matchedSongs = songs
      .filter(s =>
        s.title?.toLowerCase().includes(q) ||
        s.artist?.toLowerCase().includes(q) ||
        (s.tags || []).some(t => t.toLowerCase().includes(q))
      )
      .slice(0, 6);
    const matchedSetlists = setlists
      .filter(sl =>
        (sl.name || '').toLowerCase().includes(q) ||
        (sl.service || '').toLowerCase().includes(q) ||
        (sl.tags || []).some(t => t.toLowerCase().includes(q))
      )
      .slice(0, 4);
    return { songs: matchedSongs, setlists: matchedSetlists };
  }, [q, songs, setlists]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setFocused(false);
      }
      if (addRef.current && !addRef.current.contains(e.target)) {
        setAddOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        setFocused(false);
        setAddOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handlePlus = () => {
    if (view === 'library') onNewSong?.();
    else if (view === 'setlists') onNewSetlist?.();
    else setAddOpen(o => !o);
  };

  const placeholder =
    view === 'setlists' ? 'Search setlists & songs…'
    : view === 'library' ? 'Search songs & setlists…'
    : 'Search my library…';

  const closeSearch = () => {
    setQuery('');
    setFocused(false);
    inputRef.current?.blur();
  };

  const showResults = focused && q.length > 0;
  const hasAnyResults = results.songs.length > 0 || results.setlists.length > 0;

  return (
    <div
      ref={containerRef}
      className="sm:hidden"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <div>
        <div className="flex items-center gap-2 px-3 py-3">
          {/* Search card — hamburger lives inside on the left. Creating items
              is handled by the morphing FAB in the glass bottom bar. */}
          <div className="flex-1 flex items-stretch h-14 rounded-xl bg-[var(--ds-gray-100)] overflow-hidden">
            {/* Hamburger as an embedded card */}
            <button
              onClick={onOpenDrawer}
              aria-label="Open menu"
              className="shrink-0 w-12 flex items-center justify-center bg-transparent text-[var(--text-1)] cursor-pointer active:bg-[var(--ds-gray-200)] transition-colors border-none"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <HamburgerIcon />
            </button>
            {/* Search input */}
            <div className="relative flex-1 min-w-0 flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                placeholder={placeholder}
                className="w-full h-full px-4 bg-transparent border-none text-copy-15 text-[var(--text-1)] placeholder:text-[var(--text-2)] outline-none"
              />
            </div>
          </div>

          {/* + button — context-aware create (mirrors the bottom FAB) */}
          {(onNewSong || onNewSetlist) && (
            <div ref={addRef} className="relative shrink-0">
              <button
                onClick={handlePlus}
                aria-label={view === 'library' ? 'New song' : view === 'setlists' ? 'New setlist' : 'New'}
                className="w-14 h-14 rounded-xl flex items-center justify-center bg-[var(--color-brand)] shadow-[0_1px_2px_rgba(0,0,0,0.2)] cursor-pointer active:scale-95 transition-transform border-none"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <PlusIcon open={addOpen} />
              </button>
              {addOpen && (
                <div className="absolute top-full right-0 mt-2 w-52 rounded-xl border border-[var(--border-1)] bg-[var(--bg-1)] shadow-xl overflow-hidden z-50">
                  {onNewSong && (
                    <button
                      onClick={() => { setAddOpen(false); onNewSong?.(); }}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-transparent border-none text-left text-copy-14 text-[var(--text-1)] cursor-pointer hover:bg-[var(--bg-2)]"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                      </svg>
                      New Song
                    </button>
                  )}
                  {onNewSong && onNewSetlist && <div className="h-px bg-[var(--border-1)]" />}
                  {onNewSetlist && (
                    <button
                      onClick={() => { setAddOpen(false); onNewSetlist?.(); }}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-transparent border-none text-left text-copy-14 text-[var(--text-1)] cursor-pointer hover:bg-[var(--bg-2)]"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                        <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                      </svg>
                      New Setlist
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Search results dropdown */}
      {showResults && (
        <div className="absolute left-0 right-0 top-full bg-[var(--ds-background-100)] border-b border-[var(--ds-gray-200)] shadow-lg max-h-[70vh] overflow-y-auto">
          {hasAnyResults ? (
            <div className="divide-y divide-[var(--border-1)]">
              {results.songs.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1 text-label-12 uppercase tracking-wider text-[var(--text-2)]">
                    Songs
                  </div>
                  <div className="divide-y divide-[var(--border-1)]">
                    {results.songs.map(song => (
                      <div key={song.id} className="active:bg-[var(--bg-2)]">
                        <SongCard
                          song={song}
                          variant="row"
                          onClick={() => {
                            closeSearch();
                            onSelectSong?.(song);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {results.setlists.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1 text-label-12 uppercase tracking-wider text-[var(--text-2)]">
                    Setlists
                  </div>
                  <div className="divide-y divide-[var(--border-1)]">
                    {results.setlists.map(sl => (
                      <button
                        key={sl.id}
                        onClick={() => {
                          closeSearch();
                          onSelectSetlist?.(sl);
                        }}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-transparent border-none cursor-pointer active:bg-[var(--bg-2)] text-left"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-copy-14 text-[var(--text-1)] truncate">
                            {sl.name || 'Untitled setlist'}
                          </span>
                          <span className="text-label-12 text-[var(--text-2)] truncate">
                            {(sl.items?.length || 0)} songs{sl.date ? ` • ${formatDateShort(sl.date)}` : ''}
                          </span>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-2)] shrink-0">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="px-6 py-10 text-center text-copy-14 text-[var(--text-2)]">
              No matches for "<span className="text-[var(--text-1)]">{query}</span>".
            </div>
          )}
        </div>
      )}
    </div>
  );
}
