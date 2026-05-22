import React, { useState, useMemo, useEffect, useRef } from 'react';
import SongCard from './SongCard';

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function GlobalSearchModal({
  open,
  onClose,
  songs = [],
  setlists = [],
  onSelectSong,
  onSelectSetlist
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }
  }, [open, onClose]);

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return { songs: [], setlists: [] };
    const matchedSongs = songs
      .filter(s =>
        s.title?.toLowerCase().includes(q) ||
        s.artist?.toLowerCase().includes(q) ||
        (s.tags || []).some(t => t.toLowerCase().includes(q))
      )
      .slice(0, 8);
    const matchedSetlists = setlists
      .filter(sl =>
        (sl.name || '').toLowerCase().includes(q) ||
        (sl.service || '').toLowerCase().includes(q) ||
        (sl.tags || []).some(t => t.toLowerCase().includes(q))
      )
      .slice(0, 5);
    return { songs: matchedSongs, setlists: matchedSetlists };
  }, [q, songs, setlists]);

  if (!open) return null;

  const hasAnyResults = results.songs.length > 0 || results.setlists.length > 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4 sm:pt-[15vh]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-[var(--ds-background-100)] rounded-2xl shadow-2xl border border-[var(--ds-gray-200)] overflow-hidden flex flex-col max-h-[80vh] animate-[slideDown_150ms_ease-out]">
        <div className="flex items-center px-4 py-3 border-b border-[var(--ds-gray-200)] shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--ds-gray-500)] mr-3 shrink-0">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search songs and setlists..."
            className="flex-1 bg-transparent border-none outline-none text-copy-16 text-[var(--ds-gray-1000)] placeholder:text-[var(--ds-gray-500)]"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--ds-gray-200)] text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-300)] transition-colors border-none cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {q ? (
          <div className="overflow-y-auto overflow-x-hidden flex-1 bg-[var(--ds-background-50)]">
            {hasAnyResults ? (
              <div className="divide-y divide-[var(--ds-gray-200)]">
                {results.songs.length > 0 && (
                  <div>
                    <div className="px-5 py-2 text-label-12 uppercase tracking-wider font-semibold text-[var(--ds-gray-500)] bg-[var(--ds-gray-100)]">
                      Songs
                    </div>
                    <div className="divide-y divide-[var(--ds-gray-200)]">
                      {results.songs.map(song => (
                        <div key={song.id} className="active:bg-[var(--ds-gray-100)] sm:hover:bg-[var(--ds-gray-100)] cursor-pointer">
                          <SongCard
                            song={song}
                            variant="row"
                            onClick={() => {
                              onClose();
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
                    <div className="px-5 py-2 text-label-12 uppercase tracking-wider font-semibold text-[var(--ds-gray-500)] bg-[var(--ds-gray-100)]">
                      Setlists
                    </div>
                    <div className="divide-y divide-[var(--ds-gray-200)]">
                      {results.setlists.map(sl => (
                        <button
                          key={sl.id}
                          onClick={() => {
                            onClose();
                            onSelectSetlist?.(sl);
                          }}
                          className="w-full flex items-center justify-between gap-3 px-5 py-4 bg-transparent border-none cursor-pointer active:bg-[var(--ds-gray-100)] sm:hover:bg-[var(--ds-gray-100)] text-left transition-colors"
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="text-copy-15 font-medium text-[var(--ds-gray-1000)] truncate">
                              {sl.name || 'Untitled setlist'}
                            </span>
                            <span className="text-label-13 text-[var(--ds-gray-600)] truncate mt-0.5">
                              {(sl.items?.length || 0)} songs{sl.date ? ` • ${formatDateShort(sl.date)}` : ''}
                            </span>
                          </div>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--ds-gray-400)] shrink-0">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="px-6 py-16 text-center flex flex-col items-center justify-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--ds-gray-400)] mb-4">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <div className="text-copy-15 text-[var(--ds-gray-800)]">
                  No matches found for "<span className="font-semibold text-[var(--ds-gray-1000)]">{query}</span>"
                </div>
                <div className="text-copy-13 text-[var(--ds-gray-500)] mt-1">
                  Try adjusting your search.
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="px-6 py-10 flex flex-col items-center justify-center text-center bg-[var(--ds-background-50)]">
             <div className="text-copy-14 text-[var(--ds-gray-500)]">
               Type to search your songs and setlists
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
