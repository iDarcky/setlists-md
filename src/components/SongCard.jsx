import React from 'react';
import { Card } from './ui/Card';
import { cn } from '../lib/utils';
import Highlight from './ui/Highlight';
import { StructureRibbon } from './StructureRibbon';

const EditGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

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

function SongCard({
  song, onClick, variant = 'card', showTags = false, selected = false, highlight,
  // songsLibraryPlus 'row' extras — all optional so other callers are unaffected.
  songMap = null, songMapSettings = null, onEdit = null,
  selectable = false, selectActive = false, isSelected = false, onToggleSelect = null,
}) {
  const arr = defaultArr(song);
  const songKey = arr?.key || song?.key || 'C';
  const songTempo = arr?.tempo ?? song?.tempo;
  const arrCount = Array.isArray(song?.arrangements) ? song.arrangements.length : 1;
  if (variant === 'compact') {
    const tempo = arr?.tempo ?? song?.tempo;
    return (
      <div
        onClick={onClick}
        className={cn(
          'flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer transition-colors duration-150 hover:bg-[var(--bg-2)] active:bg-[var(--bg-2)]',
          selected && 'bg-[var(--ds-teal-100)] hover:bg-[var(--ds-teal-100)]',
        )}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <div className="min-w-0 flex-1">
          <span className="block text-copy-15 font-medium text-[var(--text-1)] truncate">
            {highlight ? <Highlight text={song.title} query={highlight} /> : (song.title || 'Untitled')}
          </span>
          {song.artist && (
            <span className="block text-label-12 text-[var(--text-2)] truncate">
              {highlight ? <Highlight text={song.artist} query={highlight} /> : song.artist}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {arrCount > 1 && (
            <span className="text-label-11 text-[var(--text-2)] px-1.5 py-0.5 rounded border border-[var(--border-1)]">{arrCount}</span>
          )}
          <span className="text-label-12-mono text-[var(--chord)] font-semibold">{songKey}</span>
          {tempo && <span className="text-label-12-mono text-[var(--text-2)]">{tempo}</span>}
        </div>
      </div>
    );
  }
  if (variant === 'row') {
    const hasMap = Array.isArray(songMap) && songMap.length > 0;
    return (
      <div
        onClick={onClick}
        className={cn(
          "group flex items-center justify-between px-5 py-4 cursor-pointer transition-[background-color,transform] duration-150 hover:bg-[var(--bg-2)] active:scale-[0.99]",
          (selected || isSelected) && "bg-[var(--ds-teal-100)] hover:bg-[var(--ds-teal-100)]",
        )}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {/* Selection checkbox — shown in select mode or on hover (plus). */}
        {selectable && (
          <label
            onClick={(e) => e.stopPropagation()}
            className={cn('mr-3 shrink-0 flex items-center transition-opacity',
              (selectActive || isSelected) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect?.()}
              aria-label={`Select ${song.title || 'song'}`}
              className="w-4 h-4 rounded accent-[var(--color-brand)] cursor-pointer"
            />
          </label>
        )}
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <span className="text-heading-16 text-[var(--text-1)] truncate">
            {highlight ? <Highlight text={song.title} query={highlight} /> : song.title}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {song.artist && (
              <span className="text-copy-14 text-[var(--color-brand)] truncate">
                {highlight ? <Highlight text={song.artist} query={highlight} /> : song.artist}
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
          {/* Section-code song map — a quiet structure glance (plus). */}
          {hasMap && (
            <div className="mt-1 overflow-x-auto no-scrollbar max-w-full">
              <StructureRibbon
                structure={songMap}
                compact
                collapse
                style="codes"
                activeIndex={null}
                sectionColors={songMapSettings?.sectionColors}
                sectionLabels={songMapSettings?.sectionLabels}
                customSectionTypes={songMapSettings?.customSectionTypes}
              />
            </div>
          )}
        </div>
        {/* Quick edit — revealed on hover, hidden in select mode (plus). */}
        {onEdit && !selectActive && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            aria-label="Edit song" title="Edit"
            className="ml-3 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border-none bg-transparent text-[var(--text-2)] opacity-0 group-hover:opacity-100 hover:bg-[var(--modes-surface-strong)] hover:text-[var(--text-1)] transition-all cursor-pointer"
          >
            <EditGlyph />
          </button>
        )}
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
