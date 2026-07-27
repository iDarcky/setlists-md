import { useState, useMemo } from 'react';
import { Input } from '@/ui/Input';
import { getArrangement } from '@/arrangements';
import { searchSongs } from '@/lib/search';

/**
 * Song library picker — search and click to add songs.
 * Songs already in the set show an "Added" badge with a count, and tapping
 * the row again appends another instance to the end. Worship sets reprise
 * songs all the time (open with the chorus, close with the same chorus),
 * so duplicates are intentional rather than blocked.
 */
export default function SetlistSongPicker({ songs, currentItems, onAddSong }) {
  const [search, setSearch] = useState('');

  // How many times each song already appears in the set.
  const countById = useMemo(() => {
    const map = new Map();
    currentItems.forEach(it => {
      if (!it.songId) return;
      map.set(it.songId, (map.get(it.songId) || 0) + 1);
    });
    return map;
  }, [currentItems]);

  const results = useMemo(() => {
    const base = searchSongs(songs, search);
    // Alphabetical by title so the picker is predictable to scan.
    return [...base].sort((a, b) =>
      (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })
    );
  }, [songs, search]);

  return (
    <div className="flex flex-col gap-3">
      <Input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search songs…"
        prefix={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
        }
        suffix={search ? (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="-mr-1 w-5 h-5 grid place-items-center rounded-full text-[var(--ds-gray-500)] hover:text-[var(--ds-gray-900)] hover:bg-[var(--ds-gray-100)] cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        ) : null}
      />

      <div className="max-h-[420px] overflow-y-auto -mx-1">
        {results.map(song => {
          const count = countById.get(song.id) || 0;
          const added = count > 0;
          return (
            <div
              key={song.id}
              role="button"
              tabIndex={0}
              onClick={() => onAddSong(song)}
              onKeyDown={(e) => e.key === 'Enter' && onAddSong(song)}
              className="group flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer hover:bg-[var(--ds-gray-alpha-100)] transition-colors"
              aria-label={added ? `Add ${song.title} again (currently ×${count})` : `Add ${song.title}`}
            >
              <div className="flex-1 min-w-0">
                <p className={`text-heading-14 m-0 truncate ${added ? 'text-[var(--color-brand-text)]' : 'text-[var(--ds-gray-1000)]'}`}>
                  {song.title}
                </p>
                <p className="text-copy-12 text-[var(--ds-gray-600)] m-0 mt-0.5 truncate">
                  {song.artist} · {getArrangement(song)?.key || song.key || 'C'}
                  {Array.isArray(song.arrangements) && song.arrangements.length > 1 && (
                    <span className="ml-1 opacity-70">· {song.arrangements.length} arr</span>
                  )}
                </p>
              </div>
              {/* Circular add / count control (mockup style) */}
              {added ? (
                <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded-lg text-label-11 font-bold text-white shrink-0" style={{ background: 'var(--color-brand)' }} aria-hidden="true">×{count}</span>
              ) : (
                <span className="w-7 h-7 rounded-lg border border-[var(--border-1)] bg-[var(--ds-background-100)] grid place-items-center shrink-0 text-[var(--color-brand)] group-hover:border-[var(--color-brand-border)] transition-colors" aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                </span>
              )}
            </div>
          );
        })}
        {results.length === 0 && (
          <div className="py-8 text-center text-copy-13 text-[var(--ds-gray-600)]">No songs found</div>
        )}
      </div>
    </div>
  );
}
