import { useState } from 'react';
import { transposeKey, ALL_KEYS, semitonesBetween } from '../../music';
import { IconButton } from '../ui/IconButton';
import { Input } from '../ui/Input';

/**
 * A single row in the setlist builder — either a song item or a break.
 * Song rows expand on click to show key/capo/notes controls.
 */
export default function SetlistItemRow({
  item, idx, song, songNum,
  onRemove, onUpdateNote, onUpdateTranspose, onUpdateCapo,
  onUpdateBreakField,
  dragHandleProps,
  rawSong,
  onSelectArrangement,
  onMoveUp, onMoveDown, isFirst, isLast,
}) {
  const [expanded, setExpanded] = useState(false);
  const [breakNotesOpen, setBreakNotesOpen] = useState(() => Boolean(item.type === 'break' && item.note));

  /* ── Break row: slim dashed-border divider, no number ── */
  if (item.type === 'break') {
    const note = item.note || '';
    const noteLen = note.length;
    return (
      <div
        className="rounded-lg border border-dashed border-[var(--ds-gray-400)] bg-[var(--ds-gray-alpha-100)] overflow-hidden"
        role="separator"
        aria-label="Break"
      >
        <div className="flex items-center gap-2 px-3 py-2">
          {/* Drag handle + reorder buttons */}
          <div className="flex flex-col items-center shrink-0 gap-0" style={{ marginRight: '-2px' }}>
            <button
              type="button"
              onClick={() => onMoveUp && onMoveUp()}
              disabled={isFirst}
              aria-label="Move up"
              className="p-0 border-none bg-transparent cursor-pointer text-[var(--ds-gray-500)] hover:text-[var(--ds-gray-900)] disabled:opacity-25 disabled:cursor-default transition-colors"
              style={{ lineHeight: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
            </button>
            <span
              {...dragHandleProps}
              className="text-[var(--ds-gray-500)] cursor-grab active:cursor-grabbing select-none"
              aria-label="Drag to reorder"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
            </span>
            <button
              type="button"
              onClick={() => onMoveDown && onMoveDown()}
              disabled={isLast}
              aria-label="Move down"
              className="p-0 border-none bg-transparent cursor-pointer text-[var(--ds-gray-500)] hover:text-[var(--ds-gray-900)] disabled:opacity-25 disabled:cursor-default transition-colors"
              style={{ lineHeight: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>
          </div>

          {/* Pause icon — visual cue that this is a break, not a list item */}
          <span className="text-[var(--ds-gray-600)] shrink-0" aria-hidden="true">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          </span>

          <span className="text-label-10 text-[var(--ds-gray-600)] uppercase tracking-[0.14em] font-semibold shrink-0">
            Break
          </span>

          <div className="flex-1 min-w-0">
            <Input
              value={item.label}
              onChange={e => onUpdateBreakField(idx, 'label', e.target.value)}
              placeholder="e.g. Prayer, Announcements…"
              size="sm"
              variant="ghost"
              className="font-medium italic"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                value={item.duration || ''}
                onChange={e => onUpdateBreakField(idx, 'duration', parseInt(e.target.value) || 0)}
                placeholder="0"
                aria-label="Break duration in minutes"
                className="w-10 px-1 py-0.5 text-center text-label-12-mono bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] rounded-md text-[var(--ds-gray-1000)] outline-none focus:border-[var(--ds-gray-600)] transition-colors"
                style={{ minHeight: 'auto' }}
              />
              <span className="text-label-10 text-[var(--ds-gray-600)]">min</span>
            </div>
            <button
              type="button"
              onClick={() => setBreakNotesOpen(v => !v)}
              aria-label={breakNotesOpen ? 'Hide notes' : 'Add notes'}
              aria-expanded={breakNotesOpen}
              title={note ? 'Notes' : 'Add notes'}
              className={`flex items-center gap-1 px-1.5 h-6 rounded-md border transition-colors ${
                note
                  ? 'border-[var(--color-brand)] text-[var(--color-brand-text)] bg-[var(--ds-background-100)]'
                  : 'border-[var(--ds-gray-400)] text-[var(--ds-gray-600)] bg-[var(--ds-background-100)] hover:border-[var(--ds-gray-500)]'
              }`}
              style={{ minHeight: 'auto' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M8 13h6" />
                <path d="M8 17h4" />
              </svg>
              {note && <span className="text-label-10-mono tabular-nums">{noteLen}</span>}
            </button>
            <IconButton
              size="xs"
              variant="error"
              onClick={() => onRemove(idx)}
              aria-label="Remove break"
            >
              ✕
            </IconButton>
          </div>
        </div>

        {breakNotesOpen && (
          <div className="border-t border-dashed border-[var(--ds-gray-400)] px-3 py-2 bg-[var(--ds-background-100)]">
            <textarea
              value={note}
              onChange={e => onUpdateBreakField(idx, 'note', e.target.value.slice(0, 500))}
              maxLength={500}
              placeholder={"# Heading\n\nParagraph text. Blank lines start a new paragraph."}
              rows={3}
              className="w-full px-2 py-1.5 text-copy-13 bg-transparent border-none outline-none resize-y text-[var(--ds-gray-1000)] placeholder:text-[var(--ds-gray-500)]"
              style={{ minHeight: '3rem' }}
            />
            <div className="flex items-center justify-between">
              <span className="text-label-10 text-[var(--ds-gray-500)]">
                Supports <code className="font-mono">#</code> heading, <code className="font-mono">##</code> subheading, blank lines for paragraphs.
              </span>
              <span className={`text-label-10-mono tabular-nums ${noteLen >= 500 ? 'text-[var(--ds-error-600)]' : 'text-[var(--ds-gray-500)]'}`}>
                {noteLen}/500
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Song row ── */
  if (!song) {
    return (
      <div className="material-card overflow-hidden opacity-60">
        <div className="flex items-center gap-3 px-4 py-3 cursor-not-allowed">
          <div className="flex flex-col items-center shrink-0 gap-0" style={{ marginRight: '-2px' }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMoveUp && onMoveUp(); }}
              disabled={isFirst}
              aria-label="Move up"
              className="p-0 border-none bg-transparent cursor-pointer text-[var(--ds-gray-500)] hover:text-[var(--ds-gray-900)] disabled:opacity-25 disabled:cursor-default transition-colors"
              style={{ lineHeight: 0 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
            </button>
            <span
              {...dragHandleProps}
              className="text-[var(--ds-gray-500)] cursor-grab active:cursor-grabbing select-none"
              aria-label="Drag to reorder"
              onClick={e => e.stopPropagation()}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMoveDown && onMoveDown(); }}
              disabled={isLast}
              aria-label="Move down"
              className="p-0 border-none bg-transparent cursor-pointer text-[var(--ds-gray-500)] hover:text-[var(--ds-gray-900)] disabled:opacity-25 disabled:cursor-default transition-colors"
              style={{ lineHeight: 0 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>
          </div>
          <span className="text-label-14 text-[var(--ds-gray-500)] tabular-nums w-7 text-center shrink-0">
            {String(songNum != null ? songNum : idx + 1).padStart(2, '0')}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-heading-14 text-[var(--ds-gray-700)] m-0 truncate italic">
              Missing Song (Waiting for sync)
            </p>
          </div>
          <IconButton size="sm" variant="error" onClick={(e) => { e.stopPropagation(); onRemove(idx); }} aria-label="Remove missing song">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </IconButton>
        </div>
      </div>
    );
  }

  const num = String(songNum != null ? songNum : idx + 1).padStart(2, '0');
  const displayKey = transposeKey(song.key, item.transpose);

  return (
    <div className="material-card overflow-hidden">
      {/* Collapsed row — always visible */}
      <div
        className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-[var(--ds-gray-alpha-100)] transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Drag handle + reorder buttons */}
        <div className="flex flex-col items-center shrink-0 gap-0" style={{ marginRight: '-2px' }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMoveUp && onMoveUp(); }}
            disabled={isFirst}
            aria-label="Move up"
            className="p-0 border-none bg-transparent cursor-pointer text-[var(--ds-gray-500)] hover:text-[var(--ds-gray-900)] disabled:opacity-25 disabled:cursor-default transition-colors"
            style={{ lineHeight: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
          </button>
          <span
            {...dragHandleProps}
            className="text-[var(--ds-gray-500)] cursor-grab active:cursor-grabbing select-none"
            aria-label="Drag to reorder"
            onClick={e => e.stopPropagation()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMoveDown && onMoveDown(); }}
            disabled={isLast}
            aria-label="Move down"
            className="p-0 border-none bg-transparent cursor-pointer text-[var(--ds-gray-500)] hover:text-[var(--ds-gray-900)] disabled:opacity-25 disabled:cursor-default transition-colors"
            style={{ lineHeight: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>
        </div>

        <span className="text-label-14 text-[var(--ds-gray-500)] tabular-nums w-7 text-center shrink-0">
          {num}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-heading-14 text-[var(--ds-gray-1000)] m-0 truncate">
            {song.title}
          </p>
          {/* Show the song's arrangement name instead of structure flow */}
          {(() => {
            const hasMultiple = rawSong?.arrangements?.length > 1;
            if (!hasMultiple) return null;
            const arrangementName = rawSong.arrangements.find(a => a.id === (item.arrangementId || rawSong?.defaultArrangementId))?.name || 'Main Arrangement';
            return (
              <p className="text-copy-12 text-[var(--ds-gray-700)] m-0 mt-0.5 truncate">
                {arrangementName}
              </p>
            );
          })()}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-label-14 text-[var(--ds-gray-1000)] font-semibold">{displayKey}</span>
          <span className="text-label-11 text-[var(--ds-gray-600)] tabular-nums">{song.tempo} BPM</span>
          <span className="text-label-11 text-[var(--ds-gray-600)]">{song.time}</span>
          <svg
            width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            className={`text-[var(--ds-gray-600)] transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
          <IconButton
            size="xs"
            variant="error"
            onClick={(e) => { e.stopPropagation(); onRemove(idx); }}
            aria-label="Remove song"
          >
            ✕
          </IconButton>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-[var(--ds-gray-300)] px-4 py-3 flex flex-wrap items-end gap-4 bg-[var(--ds-gray-alpha-100)]">
          {/* Key (transpose) */}
          <div className="flex flex-col gap-0.5">
            <span className="text-label-10 text-[var(--ds-gray-600)] uppercase">Key</span>
            <select
              value={displayKey}
              onChange={e => onUpdateTranspose(idx, semitonesBetween(song.key, e.target.value))}
              className={`px-2 py-1 rounded-md text-label-13-mono font-bold outline-none cursor-pointer bg-[var(--ds-background-100)] border transition-colors ${
                item.transpose
                  ? 'border-[var(--chord)] text-[var(--chord)]'
                  : 'border-[var(--ds-gray-400)] text-[var(--ds-gray-1000)]'
              }`}
              style={{ minHeight: 'auto' }}
            >
              {ALL_KEYS.map(k => (
                <option key={k} value={k}>{k}{k === song.key ? ' (orig)' : ''}</option>
              ))}
            </select>
          </div>

          {/* Arrangement (only when the song has more than one) */}
          {rawSong && Array.isArray(rawSong.arrangements) && rawSong.arrangements.length > 1 && onSelectArrangement && (
            <div className="flex flex-col gap-0.5">
              <span className="text-label-10 text-[var(--ds-gray-600)] uppercase">Arrangement</span>
              <select
                value={item.arrangementId || rawSong.defaultArrangementId}
                onChange={e => onSelectArrangement(e.target.value)}
                className="px-2 py-1 rounded-md text-label-13 font-bold outline-none cursor-pointer bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] text-[var(--ds-gray-1000)] transition-colors"
                style={{ minHeight: 'auto' }}
              >
                {rawSong.arrangements.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Capo */}
          <div className="flex flex-col gap-0.5">
            <span className="text-label-10 text-[var(--ds-gray-600)] uppercase">Capo</span>
            <select
              value={item.capo || 0}
              onChange={e => onUpdateCapo(idx, parseInt(e.target.value))}
              className={`px-2 py-1 rounded-md text-label-13-mono font-bold outline-none cursor-pointer bg-[var(--ds-background-100)] border transition-colors ${
                item.capo
                  ? 'border-[var(--color-brand)] text-[var(--color-brand-text)]'
                  : 'border-[var(--ds-gray-400)] text-[var(--ds-gray-1000)]'
              }`}
              style={{ minHeight: 'auto' }}
            >
              {[0,1,2,3,4,5,6,7,8,9].map(n => (
                <option key={n} value={n}>{n === 0 ? 'None' : n}</option>
              ))}
            </select>
          </div>

          {/* Note — capped at 100 chars so it stays a one-liner cue and
              never overflows the row in the setlist viewer. */}
          <div className="flex flex-col gap-0.5 flex-1 min-w-[120px]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-label-10 text-[var(--ds-gray-600)] uppercase">Note</span>
              <span
                className={`text-label-10 tabular-nums ${
                  (item.note?.length || 0) >= 100
                    ? 'text-[var(--ds-error-600)]'
                    : 'text-[var(--ds-gray-500)]'
                }`}
              >
                {item.note?.length || 0}/100
              </span>
            </div>
            <Input
              value={item.note}
              onChange={e => onUpdateNote(idx, e.target.value.slice(0, 100))}
              placeholder="Add a note…"
              size="sm"
              variant="ghost"
              maxLength={100}
            />
          </div>

          {/* Structure (read-only) */}
          {(() => {
            const flow = (song.structure || song.sections?.map(s => s.type) || []).join(' · ');
            if (!flow) return null;
            return (
              <div className="flex flex-col gap-0.5 w-full mt-2">
                <span className="text-label-10 text-[var(--ds-gray-600)] uppercase">Structure</span>
                <p className="text-copy-13 text-[var(--ds-gray-900)] m-0 font-medium whitespace-normal">
                  {flow}
                </p>
              </div>
            );
          })()}

          {/* Remove */}
          <IconButton
            size="sm"
            variant="error"
            onClick={() => onRemove(idx)}
            aria-label="Remove song"
          >
            ✕
          </IconButton>
        </div>
      )}
    </div>
  );
}
