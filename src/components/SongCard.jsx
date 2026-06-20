import React from 'react';
import { Card } from './ui/Card';
import { cn } from '../lib/utils';

function defaultArr(song) {
  if (!Array.isArray(song?.arrangements)) return song;
  return song.arrangements.find(a => a.id === song.defaultArrangementId) || song.arrangements[0] || song;
}

function formatRelativeTime(ts) {
  if (!ts) return null;
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function SongCard({ song, onClick, variant = 'card', showTags = false, selected = false }) {
  const arr = defaultArr(song);
  const songKey = arr?.key || song?.key || 'C';
  const songTempo = arr?.tempo ?? song?.tempo;
  const arrCount = Array.isArray(song?.arrangements) ? song.arrangements.length : 1;
  if (variant === 'row') {
    return (
      <div
        onClick={onClick}
        className={cn(
          "flex items-center justify-between px-5 py-4 cursor-pointer transition-[background-color,transform] duration-150 hover:bg-[var(--bg-2)] active:scale-[0.99]",
          selected && "bg-[var(--ds-teal-100)] hover:bg-[var(--ds-teal-100)]",
        )}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <span className="text-heading-16 text-[var(--text-1)] truncate">
            {song.title}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {song.artist && (
              <span className="text-copy-14 text-[var(--color-brand)] truncate">
                {song.artist}
              </span>
            )}
            {arrCount > 1 && (
              <span className="text-label-11 text-[var(--text-2)] px-2 py-0.5 rounded-md border border-[var(--border-1)] bg-[var(--bg-1)]">
                {arrCount} arrangements
              </span>
            )}
            {showTags && song.tags?.length > 0 && song.tags.map(tag => (
              <span
                key={tag}
                className="text-label-11 text-[var(--text-2)] px-2 py-0.5 rounded-md border border-[var(--border-1)] bg-[var(--bg-1)]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 ml-4 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-label-12-mono text-[var(--chord)] font-semibold">
              {songKey}
            </span>
            <span className="text-[var(--text-2)] text-[12px] opacity-60">•</span>
            <span className="text-label-12-mono text-[var(--text-2)]">
              {songTempo ? `${songTempo} BPM` : 'No Tempo'}
            </span>
          </div>
          {song.updatedAt && (
            <span className="text-label-12 text-[var(--text-2)]">
              {formatRelativeTime(song.updatedAt)}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer flex flex-col gap-2"
    >
      <h3 className="text-heading-18 text-[var(--text-1)] m-0 leading-tight truncate">
        {song.title}
      </h3>
      <div className="flex items-center gap-2">
        <span className="text-label-12 text-[var(--text-2)] uppercase font-semibold">
          {song.key || 'C'}
        </span>
        <span className="text-[var(--text-2)] text-[12px] opacity-60">•</span>
        <span className="text-label-12 text-[var(--text-2)]">
          {song.tempo ? `${song.tempo} BPM` : 'No Tempo'}
        </span>
      </div>
      {song.artist && (
        <p className="text-copy-14 text-[var(--text-2)] mt-1 line-clamp-1">
          {song.artist}
        </p>
      )}
    </Card>
  );
}

// Memoized: the Library re-renders on every keystroke (search) and selection
// change, but a card's props only change when its own song/selection does.
export default React.memo(SongCard);
