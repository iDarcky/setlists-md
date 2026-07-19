import React from 'react';
import { Chip } from './ui/Chip';
import { cn, selectPad } from '../lib/utils';
import { formatClockTime } from '../lib/dateFormat';
import { SelectCircle } from './ui/SelectCircle';
import { useLongPress } from '../lib/useLongPress';

const Chevron = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--modes-text-dim)]"><polyline points="9 18 15 12 9 6" /></svg>
);

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

// Small leading badge: weekday over day-number, the card's visual anchor.
function DateBadge({ dateStr, size = 'md' }) {
  const big = size === 'md';
  const d = dateStr ? new Date(dateStr + 'T12:00:00') : null;
  const valid = d && !isNaN(d);
  const wd = valid ? d.toLocaleDateString('en-US', { weekday: 'short' }) : '—';
  const day = valid ? d.getDate() : '·';
  return (
    <span
      className={cn(
        'shrink-0 rounded-xl flex flex-col items-center justify-center text-white bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-vetiver)]',
        big ? 'w-14 h-14' : 'w-10 h-10',
      )}
    >
      <span className={cn('uppercase tracking-wide leading-none', big ? 'text-[10px]' : 'text-[8px]')}>{wd}</span>
      <span className={cn('font-bold leading-none', big ? 'text-heading-20 mt-0.5' : 'text-label-14 mt-0.5')}>{day}</span>
    </span>
  );
}

function DraftBadge() {
  return (
    <span className="shrink-0 text-label-11 font-semibold px-1.5 py-0.5 rounded bg-[var(--ds-amber-100)] text-[var(--ds-amber-1000)] border border-[var(--ds-amber-400)]">Draft</span>
  );
}

const PlayGlyph = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
);
export default function SetlistCard({
  setlist, onPlay, onView, selected = false, clockFormat = '12h',
  variant = 'card', durationLabel = null,
  // setlistsLibraryPlus display + selection (shared shell with SongCard).
  fields = null,             // Set of visible field ids; null = legacy defaults
  showPlay = true,           // compact play button (off in the plus library view)
  selectable = false, selectActive = false, isSelected = false, onToggleSelect = null, onLongPress = null,
}) {
  const songCount = setlist.items?.filter(it => it.type !== 'break').length || 0;
  const displayTags = setlist.tags?.length
    ? setlist.tags
    : setlist.service
      ? [setlist.service]
      : [];
  const timeStr = formatClockTime(setlist.time, clockFormat);
  const dateLabel = `${formatDateFriendly(setlist.date)}${timeStr ? ` • ${timeStr}` : ''}`;
  const has = (id) => (fields ? fields.has(id) : true);

  // Rehearsal — surfaced only while it's still upcoming (irrelevant for past sets).
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const rehUpcoming = setlist.rehearsalDate && !isNaN(new Date(setlist.rehearsalDate + 'T00:00:00')) && new Date(setlist.rehearsalDate + 'T00:00:00') >= today;
  const rehearsalLabel = rehUpcoming
    ? `Rehearsal ${new Date(setlist.rehearsalDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}${setlist.rehearsalTime ? ` ${formatClockTime(setlist.rehearsalTime, clockFormat)}` : ''}`
    : null;

  const lp = useLongPress(onLongPress);
  const handleClick = (e) => {
    if (lp.consumeClick()) return;
    if (selectActive) { onToggleSelect?.(); return; }
    onView?.(e);
  };

  // Compact one-line row — the date badge carries the date, so the text line is
  // just service · songs.
  if (variant === 'compact') {
    const metaBits = [
      has('service') && setlist.service ? setlist.service : null,
      has('songs') ? `${songCount} song${songCount !== 1 ? 's' : ''}` : null,
      has('duration') && durationLabel ? durationLabel : null,
    ].filter(Boolean);
    return (
      <div
        onClick={handleClick}
        {...(onLongPress ? lp.bind : {})}
        className={cn(
          'group relative flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-[background-color,padding] duration-150 hover:bg-[var(--bg-2)] active:bg-[var(--bg-2)]',
          (selected || isSelected) && 'bg-[var(--ds-teal-100)] hover:bg-[var(--ds-teal-100)]',
          selectPad(selectable, selectActive),
        )}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {selectable && <SelectCircle active={selectActive} selected={isSelected} onToggle={onToggleSelect} label={`Select ${setlist.name || 'setlist'}`} />}
        <DateBadge dateStr={setlist.date} size="sm" />
        <div className="min-w-0 flex-1">
          <span className="flex items-center gap-2 min-w-0">
            <span className="block text-copy-15 font-medium text-[var(--text-1)] truncate">{setlist.name || 'Untitled setlist'}</span>
            {setlist.status === 'draft' && <DraftBadge />}
          </span>
          {metaBits.length > 0 && <span className="block text-label-12 text-[var(--text-2)] truncate">{metaBits.join(' · ')}</span>}
        </div>
        {showPlay && !selectActive && (
          <button
            onClick={(e) => { e.stopPropagation(); onPlay(); }}
            aria-label="Play live"
            className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg border-none bg-[var(--modes-surface)] text-[var(--color-brand)] hover:bg-[var(--modes-surface-strong)] cursor-pointer transition-colors"
          >
            <PlayGlyph size={15} />
          </button>
        )}
      </div>
    );
  }

  // Row variant (setlistsLibraryPlus) — a divided-list row sharing the SongCard
  // row chrome, with a big date badge as the anchor. Browse-first: title →
  // draft → (service · songs · rehearsal) → tags. No date/location text (the
  // badge already carries the date).
  if (variant === 'row') {
    const meta = [
      has('service') && setlist.service ? setlist.service : null,
      has('songs') ? `${songCount} song${songCount !== 1 ? 's' : ''}` : null,
      has('duration') && durationLabel ? durationLabel : null,
    ].filter(Boolean);
    return (
      <div
        onClick={handleClick}
        {...(onLongPress ? lp.bind : {})}
        className={cn(
          'group relative flex items-center gap-4 px-5 py-4 cursor-pointer transition-[background-color,padding] duration-150 hover:bg-[var(--bg-2)]',
          (selected || isSelected) && 'bg-[var(--ds-teal-100)] hover:bg-[var(--ds-teal-100)]',
          selectPad(selectable, selectActive),
        )}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {selectable && <SelectCircle active={selectActive} selected={isSelected} onToggle={onToggleSelect} label={`Select ${setlist.name || 'setlist'}`} />}
        <DateBadge dateStr={setlist.date} />
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <h3 className="text-heading-16 sm:text-heading-18 text-[var(--text-1)] font-bold m-0 truncate flex items-center gap-2 min-w-0">
            <span className="truncate">{setlist.name || 'Untitled Setlist'}</span>
            {setlist.status === 'draft' && <DraftBadge />}
          </h3>
          {meta.length > 0 && (
            <div className="text-label-13 text-[var(--modes-text-muted)] truncate">{meta.join(' · ')}</div>
          )}
          {rehearsalLabel && (
            <div className="inline-flex items-center gap-1 text-label-12 text-[var(--ds-blue-600)]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              {rehearsalLabel}
            </div>
          )}
          {has('tags') && setlist.tags?.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              {setlist.tags.slice(0, 3).map(tag => (
                <Chip key={tag} variant="success" size="sm" className="normal-case tracking-normal">{tag}</Chip>
              ))}
            </div>
          )}
        </div>
        {!selectActive && <Chevron />}
      </div>
    );
  }

  // Default card — compact horizontal layout (non-plus).
  return (
    <div
      onClick={onView}
      className={cn(
        'modes-card-strong rounded-2xl p-4 sm:p-5 flex items-center gap-4 w-full cursor-pointer group transition-transform duration-150 active:scale-[0.99]',
        selected && 'ring-2 ring-[var(--color-brand)]',
      )}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <DateBadge dateStr={setlist.date} />

      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <h3 className="text-heading-18 sm:text-heading-20 font-bold text-[var(--modes-text)] m-0 tracking-tight flex items-center gap-2 min-w-0">
          <span className="truncate">{setlist.name || 'Untitled Setlist'}</span>
          {setlist.status === 'draft' && <DraftBadge />}
        </h3>
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-label-13 text-[var(--modes-text-muted)] font-medium min-w-0">
          <span className="truncate">{dateLabel}</span>
          {setlist.location && (
            <>
              <span className="opacity-40">•</span>
              <span className="truncate">{setlist.location}</span>
            </>
          )}
        </div>
        {displayTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            {displayTags.slice(0, 2).map(tag => (
              <Chip key={tag} variant="success" size="sm" className="normal-case tracking-normal">{tag}</Chip>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 flex flex-col items-end gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
          className="inline-flex items-center justify-center gap-2 h-9 px-3 sm:px-4 rounded-lg border-none bg-[var(--color-brand)] text-white font-bold text-label-14 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
        >
          <PlayGlyph size={16} />
          <span className="hidden sm:inline">Play Live</span>
        </button>
        <span className="text-label-12 text-[var(--modes-text-dim)] font-medium">
          {songCount} Song{songCount !== 1 ? 's' : ''}{durationLabel ? ` • ${durationLabel}` : ''}
        </span>
      </div>
    </div>
  );
}
