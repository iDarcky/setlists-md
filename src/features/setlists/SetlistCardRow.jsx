import { useState } from 'react';
import { transposeKey, keysInQualityOf, semitonesBetween } from '@/music';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';

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
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <span {...gripProps} className="shrink-0 text-[var(--color-brand-text)] opacity-70" aria-label="Drag to reorder">{GRIP}</span>
          <span className="text-[var(--color-brand-text)] shrink-0" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          </span>
          <div className="flex-1 min-w-0">
            <input
              value={item.label || ''}
              onChange={e => onUpdateField(idx, 'label', e.target.value.slice(0, 80))}
              maxLength={80}
              placeholder="Break — e.g. Welcome & offering"
              aria-label="Break label"
              className="w-full bg-transparent border-0 outline-none text-copy-14 font-medium text-[var(--color-brand-text)] placeholder:text-[var(--color-brand-text)] placeholder:opacity-60"
            />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="number"
              min="0"
              value={item.duration || ''}
              onChange={e => onUpdateField(idx, 'duration', parseInt(e.target.value) || 0)}
              placeholder="0"
              aria-label="Break duration in minutes"
              className="w-11 px-1 py-1 text-center text-label-12-mono bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] rounded-md text-[var(--ds-gray-1000)] outline-none focus:border-[var(--color-brand)]"
              style={{ minHeight: 'auto' }}
            />
            <span className="text-label-10 text-[var(--color-brand-text)]">min</span>
          </div>
          <IconButton size="xs" variant="ghost" onClick={() => setBreakNotesOpen(v => !v)} aria-label={breakNotesOpen ? 'Hide note' : 'Break note'} aria-expanded={breakNotesOpen}
            className={note ? 'text-[var(--color-brand-text)]' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${breakNotesOpen ? 'rotate-90' : ''}`}><path d="m9 18 6-6-6-6" /></svg>
          </IconButton>
          <IconButton size="xs" variant="ghost" onClick={() => onRemove(idx)} aria-label="Remove break">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </IconButton>
        </div>
        {breakNotesOpen && (
          <div className="border-t border-dashed border-[var(--color-brand-border)] px-3 py-2.5 bg-[var(--ds-background-100)]">
            <label className="text-label-10 text-[var(--ds-gray-600)] block mb-1">Note (shown during the break)</label>
            <textarea
              value={note}
              onChange={e => onUpdateField(idx, 'note', e.target.value.slice(0, 500))}
              maxLength={500}
              placeholder="What happens during this break — announcements, communion, offering…"
              rows={3}
              className="w-full px-2.5 py-2 text-copy-13 bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] rounded-lg outline-none resize-y text-[var(--ds-gray-1000)] placeholder:text-[var(--ds-gray-500)] focus:border-[var(--ds-gray-600)]"
              style={{ minHeight: '3rem' }}
            />
            <div className="flex items-center justify-end mt-0.5">
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
