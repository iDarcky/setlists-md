import React from 'react';
import { Chip } from './ui/Chip';
import { Button } from './ui/Button';
import { cn } from '../lib/utils';

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

function formatTimeFriendly(timeStr) {
  if (!timeStr) return '';
  return new Date(`1970-01-01T${timeStr}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric' });
}

export default function SetlistCard({ setlist, onPlay, onView, selected = false, variant = 'card' }) {
  const songCount = setlist.items?.filter(it => it.type !== 'break').length || 0;

  const displayTags = setlist.tags?.length
    ? setlist.tags
    : setlist.service
      ? [setlist.service]
      : [];

  const timeStr = formatTimeFriendly(setlist.time);
  const dateLabel = `${formatDateFriendly(setlist.date)}${timeStr ? ` • ${timeStr}` : ''}`;

  if (variant === 'row') {
    return (
      <div
        onClick={onView}
        className={cn(
          "flex items-center justify-between px-5 py-4 cursor-pointer transition-colors duration-150 hover:bg-[var(--notion-bg-hover)] active:bg-[var(--notion-bg-hover)] border-b border-[var(--notion-border)] last:border-b-0",
          selected && "bg-[var(--notion-bg-hover)]"
        )}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          <span className="text-copy-16 font-bold text-[var(--notion-text-main)] truncate">
            {setlist.name || 'Untitled Setlist'}
          </span>
          <div className="flex items-center gap-2 text-copy-13 text-[var(--notion-text-dim)] truncate">
            <span>{dateLabel}</span>
            {setlist.location && (
              <>
                <span>•</span>
                <span className="truncate">{setlist.location}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0 ml-4">
          <div className="flex items-center gap-1.5">
            {displayTags.length > 0 && (
              <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded border border-[var(--notion-border)] bg-[var(--notion-bg-hover)] text-[var(--notion-text-dim)]">
                {displayTags[0]}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0 min-w-0 rounded-full text-[var(--color-brand)] border border-[var(--notion-border)]"
              onClick={(e) => { e.stopPropagation(); onPlay(); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </Button>
          </div>
          <span className="text-copy-12 text-[var(--notion-text-dim)] tabular-nums">
            {songCount} {songCount === 1 ? 'song' : 'songs'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onView}
      className={cn(
        "flex flex-col md:flex-row w-full overflow-hidden shadow-[0_8px_28px_rgba(0,0,0,0.35)] h-auto md:h-64 cursor-pointer group transition-transform duration-150 active:scale-[0.99]",
        selected && "ring-2 ring-[var(--color-brand)]",
      )}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Left gradient panel */}
      <div className="w-full md:w-1/3 bg-gradient-to-br from-[var(--color-brand)] to-[#3a1a3b] h-28 md:h-full relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-black/10"></div>
      </div>

      {/* Right details */}
      <div className="flex-1 min-w-0 p-6 md:p-8 flex flex-col justify-center group-hover:bg-white/[0.02] transition-colors">
        {/* Tags */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {displayTags.length > 0 ? (
            displayTags.slice(0, 2).map(tag => (
              <Chip key={tag} variant="success" size="sm">{tag}</Chip>
            ))
          ) : (
            <Chip variant="success" size="sm">Live Show</Chip>
          )}
        </div>

        {/* Setlist Name */}
        <h3 className="text-heading-20 md:text-heading-24 font-bold text-[var(--notion-text-main)] m-0 mb-3 tracking-tight truncate">
          {setlist.name || 'Untitled Setlist'}
        </h3>

        {/* Date & Location */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-label-14 text-[var(--notion-text-dim)] mb-6 font-medium">
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
          <div className="text-label-13 text-[var(--notion-text-dim)] font-medium">
            {songCount} Song{songCount !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
