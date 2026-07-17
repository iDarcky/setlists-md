import { useMemo } from 'react';
import { recommendNextSongs } from '../../recommendations';

/**
 * Right-rail panel below the song picker that suggests the next song to add.
 * Recomputes whenever the setlist changes (length or last item identity).
 *
 * Cards are intentionally dense — title, suggested key, tempo, +Add — so the
 * leader can scan them without breaking flow. Empty-setlist state shows the
 * three least-played songs as a "pick something fresh" prompt.
 */
export default function RecommendedNextPanel({ songs, currentItems, onAddSong }) {
  const recs = useMemo(
    () => recommendNextSongs(songs, { items: currentItems }, { limit: 3 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [songs, currentItems.length, currentItems[currentItems.length - 1]?.songId, currentItems[currentItems.length - 1]?.arrangementId, currentItems[currentItems.length - 1]?.transpose],
  );

  if (!recs || recs.length === 0) return null;

  const isEmpty = !currentItems.some(i => i && i.type !== 'break' && i.songId);
  const heading = isEmpty ? 'Fresh picks' : 'Recommended next';

  return (
    <div className="flex flex-col gap-1.5 pt-3 mt-1 border-t border-[var(--border-1)]">
      <p className="text-label-11 font-semibold uppercase tracking-wide text-[var(--ds-gray-600)] m-0 px-2">
        {heading}
      </p>
      <div className="-mx-1">
        {recs.map(rec => (
          <div
            key={rec.song.id}
            role="button"
            tabIndex={0}
            onClick={() => onAddSong(rec.song, rec.suggestedKey)}
            onKeyDown={(e) => e.key === 'Enter' && onAddSong(rec.song, rec.suggestedKey)}
            className="group flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer hover:bg-[var(--ds-gray-alpha-100)] transition-colors"
            aria-label={`Add ${rec.song.title} in ${rec.suggestedKey}`}
            title={`Score: ${rec.score.toFixed(2)}`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-heading-14 m-0 truncate text-[var(--ds-gray-1000)]">{rec.song.title}</p>
              <p className="text-copy-12 text-[var(--ds-gray-600)] m-0 mt-0.5 truncate">
                <span className="text-[var(--chord)] font-semibold">{rec.suggestedKey}</span>
                {rec.arrangement?.tempo && <> · {rec.arrangement.tempo} BPM</>}
                {rec.song.artist && <> · {rec.song.artist}</>}
              </p>
              {rec.reason && <p className="text-copy-12 text-[var(--color-brand-text)] m-0 mt-0.5 truncate">{rec.reason}</p>}
            </div>
            <span className="w-7 h-7 rounded-lg border border-[var(--border-1)] bg-[var(--ds-background-100)] grid place-items-center shrink-0 text-[var(--color-brand)] group-hover:border-[var(--color-brand-border)] transition-colors" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
