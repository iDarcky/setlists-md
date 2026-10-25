import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { CheckIcon, PlayIcon } from '@/app/navIcons';
import { songTempo } from '@/lib/songsData';
import { mostPlayedKey } from '@/keyHistory';

// Songs from 1024px: a table with the columns that matter for planning, and
// the picked song on the right (canvas → Songs → Desktop). Pure view parts,
// used by SongsView.

const short = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const COLS = 'grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_48px_52px_minmax(0,1fr)_48px_minmax(0,1.2fr)]';

export function SongsTable({ rows = [], picked, selecting, selected, onPick, onOpen, onToggle, sort, onSort }) {
  const head = 'flex h-10 min-h-0 items-center border-0 bg-transparent p-0 text-left font-sans text-[12px] font-semibold text-muted-foreground';
  return (
    <div role="table" aria-label="Songs" className="overflow-hidden rounded-card border border-border bg-card">
      <div role="row" className={cn('grid items-center gap-3 bg-raised px-4', selecting && 'pl-12', COLS)}>
        <button type="button" role="columnheader" onClick={() => onSort?.('az')} className={cn(head, 'cursor-pointer')}>Title{sort === 'az' ? ' ↑' : ''}</button>
        <span role="columnheader" className={head}>Artist</span>
        <span role="columnheader" className={head}>Key</span>
        <span role="columnheader" className={head}>BPM</span>
        <button type="button" role="columnheader" onClick={() => onSort?.('stale')} className={cn(head, 'cursor-pointer')}>Last played{sort === 'stale' ? ' ↑' : ''}</button>
        <button type="button" role="columnheader" onClick={() => onSort?.('most')} className={cn(head, 'cursor-pointer')}>Plays{sort === 'most' ? ' ↓' : ''}</button>
        <span role="columnheader" className={head}>Themes</span>
      </div>
      {rows.map(r => {
        const on = selected?.has(r.song.id);
        return (
          <div key={r.song.id} role="row" className={cn('relative border-t border-border', (picked === r.song.id || on) && 'bg-selected')}>
            {selecting && (
              <button type="button" aria-label={`Select ${r.song.title}`} aria-pressed={on} onClick={() => onToggle?.(r.song)}
                className="absolute left-4 top-1/2 flex size-[18px] min-h-0 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[5px] border-[1.5px] border-input bg-transparent p-0 text-background outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-foreground aria-pressed:bg-foreground">
                {on && <CheckIcon size={12} />}
              </button>
            )}
            <button
              type="button"
              onClick={() => (selecting ? onToggle : onPick)?.(r.song)}
              onDoubleClick={() => !selecting && onOpen?.(r.song)}
              className={cn('grid h-[52px] w-full min-h-0 cursor-pointer items-center gap-3 border-0 bg-transparent px-4 text-left font-sans text-[14px] text-foreground outline-none hover:bg-raised focus-visible:bg-raised', selecting && 'pl-12', COLS)}
            >
              <span className="truncate font-semibold">{r.song.title || 'Untitled'}</span>
              <span className="truncate text-muted-foreground">{r.song.artist}</span>
              <span className="font-mono text-[13px] font-semibold text-[var(--chord)]">{r.keyName}</span>
              <span className="text-muted-foreground">{songTempo(r.song) || ''}</span>
              <span className={cn('truncate text-muted-foreground', r.line.stale && 'text-[var(--chord)]')}>{r.stat?.last ? short(r.stat.last) : '—'}</span>
              <span className="text-muted-foreground">{r.stat?.plays || 0}</span>
              <span className="truncate text-muted-foreground">{[r.song.themes, r.song.genres].filter(Boolean).join(', ')}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

// "[G]Amazing [D]grace" → chord over each piece of lyric, so the chords sit
// where they belong in any font.
function ChordLine({ line }) {
  const parts = line.split(/(\[[^\]]+\])/).filter(Boolean);
  const segs = [];
  let chord = '';
  for (const p of parts) {
    if (/^\[[^\]]+\]$/.test(p)) { if (chord) segs.push({ chord, text: '' }); chord = p.slice(1, -1); }
    else { segs.push({ chord, text: p }); chord = ''; }
  }
  if (chord) segs.push({ chord, text: '' });
  const hasChords = segs.some(s => s.chord);
  return (
    <div className="flex flex-wrap">
      {segs.map((s, i) => (
        <span key={i} className="inline-flex flex-col whitespace-pre">
          {hasChords && <span className="h-[18px] pr-1 font-mono text-[13px] font-semibold text-[var(--chord)]">{s.chord}</span>}
          <span>{s.text}</span>
        </span>
      ))}
    </div>
  );
}

function arrangementOf(song) {
  const arrs = song?.arrangements || [];
  return arrs.find(a => a.id === song.defaultArrangementId) || arrs[0] || song || {};
}

export function SongPreview({ row, nextLabel, onOpen, onEdit }) {
  if (!row) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-card border border-dashed border-border px-5 py-10 text-center text-[14px] text-muted-foreground">
        Pick a song to see it here.
      </div>
    );
  }
  const { song, stat, next } = row;
  const arr = arrangementOf(song);
  const meta = [arr.key && `Key ${arr.key}`, arr.tempo && `${arr.tempo} BPM`, arr.time, song.ccli && `CCLI ${song.ccli}`].filter(Boolean).join(' · ');
  const usual = mostPlayedKey(song.keyHistory) || arr.key || '—';
  const sections = (arr.sections || []).slice(0, 2);
  return (
    <aside aria-label="Song preview" className="sticky top-4 flex flex-col gap-3.5 rounded-card border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {song.artist && <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{song.artist}</span>}
          <h2 className="m-0 text-[24px] font-semibold leading-7 tracking-[-0.5px]">{song.title || 'Untitled'}</h2>
          {meta && <span className="text-[13px] text-muted-foreground">{meta}</span>}
        </div>
        {next && nextLabel && <span className="flex h-6 shrink-0 items-center rounded-full bg-selected px-2.5 text-[12px] font-semibold text-link">{nextLabel}</span>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[[`${stat?.plays || 0}×`, 'played'], [stat?.last ? short(stat.last) : '—', 'last time'], [usual, 'usual key']].map(([v, l]) => (
          <div key={l} className="flex flex-col gap-0.5 rounded-[10px] bg-raised px-3 py-2.5">
            <b className="text-[17px] font-semibold">{v}</b>
            <span className="text-[12px] text-muted-foreground">{l}</span>
          </div>
        ))}
      </div>
      {sections.length > 0 && (
        <div className="flex flex-col gap-0.5 text-[14px] leading-[1.5]">
          {sections.map((sec, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <span className="mt-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground first:mt-0">{sec.type}</span>
              {(sec.lines || []).filter(l => typeof l === 'string' && l.trim()).slice(0, 4).map((l, j) => <ChordLine key={j} line={l} />)}
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => onOpen?.(song)}><PlayIcon size={14} />Open</Button>
        {onEdit && <Button variant="outline" className="flex-1" onClick={() => onEdit(song)}>Edit</Button>}
      </div>
    </aside>
  );
}
