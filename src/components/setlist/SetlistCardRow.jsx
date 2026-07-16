import { useState } from 'react';
import { transposeKey, keysInQualityOf, semitonesBetween } from '../../music';
import { IconButton } from '../ui/IconButton';
import { Input } from '../ui/Input';

const GRIP = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
    <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
    <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
  </svg>
);

function fmtDuration(sec) {
  const s = Math.round(Number(sec));
  if (!s || Number.isNaN(s) || s <= 0) return null;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * A single Set-card row in the card-language setlist editor — a song or a
 * brand-green break. Tapping the chevron expands per-setlist overrides (key,
 * capo, tempo, structure, note) that write to the item, never the shared song.
 */
export default function SetlistCardRow({
  item, idx, song, songNum, rawSong,
  onRemove, onUpdateField, onSelectArrangement,
  gripProps, dragging, dragOver,
}) {
  const [expanded, setExpanded] = useState(false);
  const [breakNotesOpen, setBreakNotesOpen] = useState(() => Boolean(item.type === 'break' && item.note));

  const wrapStyle = {
    opacity: dragging ? 0.4 : 1,
    boxShadow: dragOver ? 'inset 0 0 0 2px var(--color-brand)' : undefined,
  };

  /* ── Break row — brand-green slide ── */
  if (item.type === 'break') {
    const note = item.note || '';
    return (
      <div
        className="rounded-xl border border-dashed overflow-hidden"
        style={{ ...wrapStyle, borderColor: 'var(--color-brand-border)', background: 'var(--color-brand-soft)' }}
        role="listitem"
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span {...gripProps} className="shrink-0 text-[var(--color-brand-text)] opacity-70" aria-label="Drag to reorder">{GRIP}</span>
          <span className="text-[var(--color-brand-text)] shrink-0" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          </span>
          <span className="text-label-11 font-semibold text-[var(--color-brand-text)] shrink-0">Break</span>
          <div className="flex-1 min-w-0">
            <Input
              value={item.label}
              onChange={e => onUpdateField(idx, 'label', e.target.value)}
              placeholder="e.g. Welcome & offering"
              size="sm"
              variant="ghost"
              className="font-medium"
            />
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              value={item.duration || ''}
              onChange={e => onUpdateField(idx, 'duration', parseInt(e.target.value) || 0)}
              placeholder="0"
              aria-label="Break duration in minutes"
              className="w-10 px-1 py-0.5 text-center text-label-12-mono bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] rounded-md text-[var(--ds-gray-1000)] outline-none"
              style={{ minHeight: 'auto' }}
            />
            <span className="text-label-10 text-[var(--color-brand-text)]">min</span>
          </div>
          <button
            type="button"
            onClick={() => setBreakNotesOpen(v => !v)}
            aria-label={breakNotesOpen ? 'Hide notes' : 'Add notes'}
            aria-expanded={breakNotesOpen}
            className={`shrink-0 flex items-center gap-1 px-1.5 h-7 rounded-md border transition-colors ${note ? 'border-[var(--color-brand)] text-[var(--color-brand-text)]' : 'border-[var(--ds-gray-400)] text-[var(--ds-gray-600)]'} bg-[var(--ds-background-100)]`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h6" /><path d="M8 17h4" /></svg>
            {note && <span className="text-label-10-mono tabular-nums">{note.length}</span>}
          </button>
          <IconButton size="xs" variant="error" onClick={() => onRemove(idx)} aria-label="Remove break">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>
          </IconButton>
        </div>
        {breakNotesOpen && (
          <div className="border-t border-dashed border-[var(--color-brand-border)] px-3 py-2 bg-[var(--ds-background-100)]">
            <textarea
              value={note}
              onChange={e => onUpdateField(idx, 'note', e.target.value.slice(0, 500))}
              maxLength={500}
              placeholder={"# Heading\n\nParagraph text."}
              rows={3}
              className="w-full px-2 py-1.5 text-copy-13 bg-transparent border-none outline-none resize-y text-[var(--ds-gray-1000)] placeholder:text-[var(--ds-gray-500)]"
              style={{ minHeight: '3rem' }}
            />
            <div className="flex items-center justify-end">
              <span className={`text-label-10-mono tabular-nums ${note.length >= 500 ? 'text-[var(--ds-error-600)]' : 'text-[var(--ds-gray-500)]'}`}>{note.length}/500</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Missing song ── */
  if (!song) {
    return (
      <div className="rounded-xl border border-[var(--border-1)] bg-[var(--ds-background-100)] px-3 py-3 flex items-center gap-3" style={wrapStyle} role="listitem">
        <span {...gripProps} className="shrink-0 text-[var(--ds-gray-500)]" aria-label="Drag to reorder">{GRIP}</span>
        <span className="text-label-13 text-[var(--ds-gray-500)] tabular-nums w-6 text-center shrink-0">{String(songNum ?? idx + 1).padStart(2, '0')}</span>
        <p className="flex-1 min-w-0 text-heading-14 text-[var(--ds-gray-700)] m-0 truncate italic">Missing song (waiting for sync)</p>
        <IconButton size="xs" variant="error" onClick={() => onRemove(idx)} aria-label="Remove">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </IconButton>
      </div>
    );
  }

  const num = String(songNum ?? idx + 1).padStart(2, '0');
  const displayKey = transposeKey(song.key, item.transpose || 0);
  const effTempo = item.tempo ?? song.tempo;
  const effStructure = Array.isArray(item.structure) && item.structure.length
    ? item.structure
    : (song.structure || song.sections?.map(s => s.type) || []);
  const dur = fmtDuration(song.duration);
  const subtitle = [song.artist, item.capo > 0 ? `capo ${item.capo}` : null].filter(Boolean).join(' · ');

  return (
    <div className="rounded-xl border border-[var(--border-1)] bg-[var(--ds-background-100)] overflow-hidden" style={wrapStyle} role="listitem">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span {...gripProps} className="shrink-0 text-[var(--ds-gray-500)]" aria-label="Drag to reorder">{GRIP}</span>
        <span className="text-label-13 text-[var(--ds-gray-500)] tabular-nums w-6 text-center shrink-0">{num}</span>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex-1 min-w-0 text-left bg-transparent border-none cursor-pointer p-0"
        >
          <p className="text-heading-14 text-[var(--ds-gray-1000)] m-0 truncate">{song.title}</p>
          {subtitle && <p className="text-copy-12 text-[var(--ds-gray-600)] m-0 mt-0.5 truncate">{subtitle}</p>}
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="font-mono text-[12px] font-bold px-1.5 py-0.5 rounded-md"
            style={{ background: 'var(--chord)', color: '#0a0a0a' }}
          >{displayKey}</span>
          {dur && <span className="hidden sm:inline text-label-11 text-[var(--ds-gray-600)] tabular-nums">{dur}</span>}
          <IconButton size="xs" variant="ghost" onClick={() => setExpanded(v => !v)} aria-label={expanded ? 'Hide options' : 'Song options'} aria-expanded={expanded}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${expanded ? 'rotate-90' : ''}`}><path d="m9 18 6-6-6-6" /></svg>
          </IconButton>
          <IconButton size="xs" variant="error" onClick={() => onRemove(idx)} aria-label="Remove song">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </IconButton>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[var(--ds-gray-300)] px-3 py-3 flex flex-wrap items-end gap-3 bg-[var(--ds-gray-alpha-100)]">
          {/* Key */}
          <label className="flex flex-col gap-0.5">
            <span className="text-label-10 text-[var(--ds-gray-600)]">Key</span>
            <select
              value={displayKey}
              onChange={e => onUpdateField(idx, 'transpose', semitonesBetween(song.key, e.target.value))}
              className={`px-2 py-1 rounded-md text-label-13-mono font-bold outline-none cursor-pointer bg-[var(--ds-background-100)] border ${item.transpose ? 'border-[var(--chord)] text-[var(--chord)]' : 'border-[var(--ds-gray-400)] text-[var(--ds-gray-1000)]'}`}
              style={{ minHeight: 'auto' }}
            >
              {keysInQualityOf(song.key).map(k => (<option key={k} value={k}>{k}{k === song.key ? ' (orig)' : ''}</option>))}
            </select>
          </label>

          {/* Arrangement */}
          {rawSong && Array.isArray(rawSong.arrangements) && rawSong.arrangements.length > 1 && onSelectArrangement && (
            <label className="flex flex-col gap-0.5">
              <span className="text-label-10 text-[var(--ds-gray-600)]">Arrangement</span>
              <select
                value={item.arrangementId || rawSong.defaultArrangementId}
                onChange={e => onSelectArrangement(e.target.value)}
                className="px-2 py-1 rounded-md text-label-13 font-bold outline-none cursor-pointer bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] text-[var(--ds-gray-1000)]"
                style={{ minHeight: 'auto' }}
              >
                {rawSong.arrangements.map(a => (<option key={a.id} value={a.id}>{a.name}</option>))}
              </select>
            </label>
          )}

          {/* Capo */}
          <label className="flex flex-col gap-0.5">
            <span className="text-label-10 text-[var(--ds-gray-600)]">Capo</span>
            <select
              value={item.capo || 0}
              onChange={e => onUpdateField(idx, 'capo', parseInt(e.target.value))}
              className={`px-2 py-1 rounded-md text-label-13-mono font-bold outline-none cursor-pointer bg-[var(--ds-background-100)] border ${item.capo ? 'border-[var(--color-brand)] text-[var(--color-brand-text)]' : 'border-[var(--ds-gray-400)] text-[var(--ds-gray-1000)]'}`}
              style={{ minHeight: 'auto' }}
            >
              {[0,1,2,3,4,5,6,7,8,9].map(n => (<option key={n} value={n}>{n === 0 ? 'None' : n}</option>))}
            </select>
          </label>

          {/* Tempo — per-setlist override */}
          <label className="flex flex-col gap-0.5">
            <span className="text-label-10 text-[var(--ds-gray-600)]">Tempo</span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={effTempo ?? ''}
              onChange={e => {
                const v = e.target.value.trim() === '' ? null : parseInt(e.target.value, 10);
                onUpdateField(idx, 'tempo', Number.isFinite(v) ? v : null);
              }}
              placeholder={song.tempo ? String(song.tempo) : '120'}
              aria-label="Tempo (BPM)"
              className={`w-16 px-2 py-1 rounded-md text-label-13-mono font-bold outline-none bg-[var(--ds-background-100)] border ${item.tempo != null ? 'border-[var(--color-brand)] text-[var(--color-brand-text)]' : 'border-[var(--ds-gray-400)] text-[var(--ds-gray-1000)]'}`}
              style={{ minHeight: 'auto' }}
            />
          </label>

          {/* Note */}
          <div className="flex flex-col gap-0.5 flex-1 min-w-[140px]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-label-10 text-[var(--ds-gray-600)]">Note</span>
              <span className={`text-label-10 tabular-nums ${(item.note?.length || 0) >= 100 ? 'text-[var(--ds-error-600)]' : 'text-[var(--ds-gray-500)]'}`}>{item.note?.length || 0}/100</span>
            </div>
            <Input
              value={item.note || ''}
              onChange={e => onUpdateField(idx, 'note', e.target.value.slice(0, 100))}
              placeholder="Cue for the band…"
              size="sm"
              variant="ghost"
              maxLength={100}
            />
          </div>

          {/* Structure — per-setlist override */}
          <div className="flex flex-col gap-0.5 w-full">
            <span className="text-label-10 text-[var(--ds-gray-600)]">Structure {Array.isArray(item.structure) && item.structure.length ? '(custom)' : ''}</span>
            <Input
              value={effStructure.join(', ')}
              onChange={e => {
                const parts = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                onUpdateField(idx, 'structure', parts);
              }}
              placeholder="Verse, Chorus, Bridge…"
              size="sm"
              variant="ghost"
            />
            <span className="text-label-10 text-[var(--ds-gray-500)] mt-0.5">Tempo & structure here apply to this setlist only.</span>
          </div>
        </div>
      )}
    </div>
  );
}
