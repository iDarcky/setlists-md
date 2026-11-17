import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { CheckIcon, PlayIcon } from '@/app/navIcons';
import { songTempo } from '@/lib/songsData';
import { mostPlayedKey } from '@/keyHistory';
import { resolveSongView } from '@/arrangements';
import { buildSongFlow } from '@/lib/songFlow';
import { sectionTone } from '@/lib/sectionTone';
import { extractInlineNotes } from '@/parser';
import { Cover, Fact, MetaLine, Played, SongMap } from '@/features/song/SongParts';

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

function arrangementOf(song) {
  const arrs = song?.arrangements || [];
  return arrs.find(a => a.id === song.defaultArrangementId) || arrs[0] || song || {};
}

// The first words of the song, chords and cues stripped: enough to recognise it.
function firstLines(arr, n = 2) {
  const out = [];
  for (const sec of arr.sections || []) {
    for (const l of sec?.lines || []) {
      if (typeof l !== 'string') continue;
      const words = extractInlineNotes(l).clean.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
      if (words) out.push(words);
      if (out.length >= n) return out;
    }
  }
  return out;
}

/** The picked song beside the table (QA 11 Nov rebuild): the song page's header, small. */
export function SongPreview({ row, nextLabel, onOpen, onEdit, customSectionTypes }) {
  if (!row) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-card border border-dashed border-border px-5 py-10 text-center text-[14px] text-muted-foreground">
        Pick a song to see it here.
      </div>
    );
  }
  const { song, stat, next } = row;
  const arr = arrangementOf(song);
  const view = song.arrangements ? resolveSongView(song, arr.id) : song;
  const codes = (buildSongFlow(view).ordered || []).map(sec => sectionTone(sec?.type, customSectionTypes));
  const arrs = song.arrangements || [];
  const lines = firstLines(arr);
  const facts = { plays: stat?.plays || 0, last: stat?.last ? short(stat.last) : null, usualKey: mostPlayedKey(song.keyHistory) || '' };
  return (
    <aside aria-label="Song preview" className="sticky top-4 flex flex-col gap-3.5 rounded-card border border-border bg-card p-5">
      <div className="flex items-center gap-4">
        <Cover song={song} size={72} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="m-0 text-[22px] font-semibold leading-[26px] tracking-[-0.3px]">{song.title || 'Untitled'}</h2>
          {song.artist && <span className="truncate text-[15px] text-muted-foreground">{song.artist}</span>}
        </div>
        {next && nextLabel && <span className="flex h-6 shrink-0 items-center self-start rounded-full bg-selected px-2.5 text-[12px] font-semibold text-link">{nextLabel}</span>}
      </div>
      <MetaLine>
        {arrs.length > 1 && <span className="inline-flex h-7 max-w-[160px] items-center truncate rounded-full border-[1.5px] border-foreground px-2.5 text-[11px] font-semibold uppercase tracking-[0.04em]">{arr.name || 'Main'}</span>}
        <Fact label="Key">{arr.key && <span className="font-mono font-semibold text-warning-text">{arr.key}</span>}</Fact>
        <Fact label="BPM">{arr.tempo}</Fact>
        <Fact label="Time">{arr.time}</Fact>
        <Fact label="Length">{arr.duration || song.duration}</Fact>
      </MetaLine>
      {onEdit && <Played facts={facts} />}
      <SongMap codes={codes} />
      <div className="flex gap-2 pt-1">
        <Button className="flex-1" onClick={() => onOpen?.(song)}><PlayIcon size={14} />Open</Button>
        {onEdit && <Button variant="outline" className="flex-1" onClick={() => onEdit(song)}>Edit</Button>}
      </div>
      {lines.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border pt-3.5 text-[15px]">
          <span className="text-[13px] text-muted-foreground">First lines</span>
          <span>{lines[0]}</span>
          {lines[1] && <span className="text-muted-foreground">{lines[1].replace(/[.,;:!?…]+$/, '')}…</span>}
        </div>
      )}
    </aside>
  );
}
