import React from 'react';
import { Chip } from './ui/Chip';
import { Button } from './ui/Button';
import { cn } from '../lib/utils';
import { formatClockTime } from '../lib/dateFormat';

function formatDateFriendly(dateStr) {
  if (!dateStr) return 'TBA';
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.getTime() === today.getTime()) return 'Tonight';
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function SetlistCard({ setlist, onPlay, onView, selected = false, clockFormat = '12h' }) {
  const songCount = setlist.items?.filter(it => it.type !== 'break').length || 0;

  // Tags are optional — when none are set we render no chip at all instead
  // of falling back to a generic "Live Show" pill, which made every card
  // look tagged.
  const displayTags = setlist.tags?.length
    ? setlist.tags
    : setlist.service
      ? [setlist.service]
      : [];

  const timeStr = formatClockTime(setlist.time, clockFormat);
  const dateLabel = `${formatDateFriendly(setlist.date)}${timeStr ? ` • ${timeStr}` : ''}`;

  return (
    <div
      onClick={onView}
      className={cn(
        "modes-card-strong flex flex-col md:flex-row w-full overflow-hidden shadow-[0_8px_28px_rgba(0,0,0,0.35)] h-auto md:h-64 cursor-pointer group transition-transform duration-150 active:scale-[0.99]",
        selected && "ring-2 ring-[var(--color-brand)]",
      )}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Left gradient panel */}
      <div className="w-full md:w-1/3 bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-vetiver)] h-28 md:h-full relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-black/10"></div>
      </div>

      {/* Right details */}
      <div className="flex-1 min-w-0 p-6 md:p-8 flex flex-col justify-center group-hover:bg-white/[0.02] transition-colors">
        {/* Tags — rendered only when the setlist actually has any. */}
        {displayTags.length > 0 && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {displayTags.slice(0, 2).map(tag => (
              <Chip key={tag} variant="success" size="sm">{tag}</Chip>
            ))}
          </div>
        )}

        {/* Setlist Name */}
        <h3 className="text-heading-20 md:text-heading-24 font-bold text-[var(--modes-text)] m-0 mb-3 tracking-tight truncate">
          {setlist.name || 'Untitled Setlist'}
        </h3>

        {/* Date & Location */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-label-14 text-[var(--modes-text-muted)] mb-6 font-medium">
          <div className="flex items-center gap-2 min-w-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            <span className="truncate">{dateLabel}</span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span className="truncate">{setlist.location || 'No Location Set'}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-6 mt-auto">
          <Button
            variant="brand"
            className="border-none text-white shadow-sm px-6 font-bold"
            onClick={(e) => { e.stopPropagation(); onPlay(); }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="mr-2"><path d="M8 5v14l11-7z"/></svg>
            Play Live
          </Button>
          <div className="text-label-13 text-[var(--modes-text-dim)] font-medium">
            {songCount} Song{songCount !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
