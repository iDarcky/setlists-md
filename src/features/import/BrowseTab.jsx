import { useMemo, useState } from 'react';
import { Input } from '@/ui/Input';
import { DEMO_SONGS_MD } from '@/data/demos';
import { parseSongMd } from '@/parser';

// Browse a built-in collection of public-domain songs. For now this is our
// three bundled songs; selecting one creates a new song from its chart.
export default function BrowseTab({ onSelect }) {
  const [query, setQuery] = useState('');

  const songs = useMemo(() => DEMO_SONGS_MD.map((md, i) => {
    let meta = { title: 'Untitled', artist: '', key: '' };
    try { const p = parseSongMd(md); meta = { title: p.title, artist: p.artist, key: p.key }; } catch { /* keep defaults */ }
    return { md, ...meta, id: i };
  }), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter(s => `${s.title} ${s.artist}`.toLowerCase().includes(q));
  }, [songs, query]);

  return (
    <div className="flex-1 min-h-0 p-5 overflow-y-auto">
      <Input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search songs…"
      />

      <div className="mt-4 flex flex-col gap-2">
        {filtered.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect?.(s.md)}
            className="group flex items-center gap-3 text-left rounded-xl border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] p-3 cursor-pointer transition-all hover:border-[var(--color-brand-border)] hover:bg-[var(--ds-gray-100)]"
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[var(--ds-gray-200)] text-[var(--ds-gray-700)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-copy-14 font-semibold text-[var(--ds-gray-1000)] truncate">{s.title}</div>
              <div className="text-copy-12 text-[var(--ds-gray-600)] truncate">
                {s.artist}{s.artist && s.key ? ' · ' : ''}{s.key ? `Key of ${s.key}` : ''}
              </div>
            </div>
            <span className="shrink-0 text-label-11 font-semibold text-[var(--ds-gray-500)] group-hover:text-[var(--color-brand-text)]">Add →</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-copy-13 text-[var(--ds-gray-600)] italic m-0 py-6 text-center">No songs match “{query}”.</p>
        )}
      </div>

      <p className="text-label-11 text-[var(--ds-gray-500)] mt-4">
        More public-domain hymns and worship songs are on the way.
      </p>
    </div>
  );
}
