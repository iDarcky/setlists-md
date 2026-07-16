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
  const subheading = isEmpty
    ? 'Songs your team hasn’t played in a while.'
    : 'Songs that pair well with your last pick, by key, tempo and freshness.';

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-label-12 font-semibold text-[var(--ds-gray-600)] m-0">{heading}</p>
        <p className="text-copy-12 text-[var(--ds-gray-600)] m-0 mt-0.5">{subheading}</p>
      </div>

      <div className="rounded-xl border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] overflow-hidden divide-y divide-[var(--ds-gray-200)]">
        {recs.map(rec => (
          <div
            key={rec.song.id}
            role="button"
            tabIndex={0}
            onClick={() => onAddSong(rec.song, rec.suggestedKey)}
            onKeyDown={(e) => e.key === 'Enter' && onAddSong(rec.song, rec.suggestedKey)}
            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[var(--ds-gray-alpha-100)] transition-colors"
            aria-label={`Add ${rec.song.title} in ${rec.suggestedKey}`}
            title={`Score: ${rec.score.toFixed(2)}`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-heading-14 m-0 truncate text-[var(--ds-gray-1000)]">
                {rec.song.title}
              </p>
              <p className="text-copy-12 text-[var(--ds-gray-700)] m-0 mt-0.5 truncate">
                <span className="text-[var(--chord)] font-semibold">{rec.suggestedKey}</span>
                {rec.arrangement?.tempo && (
                  <> · {rec.arrangement.tempo} BPM</>
                )}
                {rec.song.artist && (
                  <> · {rec.song.artist}</>
                )}
              </p>
              {rec.reason && (
                <p className="text-copy-12 text-[var(--color-brand-text)] m-0 mt-0.5 truncate">
                  {rec.reason}
                </p>
              )}
            </div>
            <span
              aria-hidden="true"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-label-13 font-bold shrink-0"
              style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-text)' }}
            >
              +
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
