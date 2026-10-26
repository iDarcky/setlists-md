import { useRef, useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Sheet } from '@/ui/shadcn/sheet';
import { CheckIcon } from '@/app/navIcons';
import { songKey } from '@/lib/songsData';

// Import, rebuilt (canvas → Import + public domain). Pick files (a drop zone
// from the iPad up; a phone goes straight to the file picker), then every song
// is listed before anything is added. A song the library already has updates
// in place; untick it to leave it alone.

const FileIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M12 12v6M9 15l3 3 3-3" /></svg>
);

/** The drop zone. `onFiles(FileList)`; `onChoose` opens the file picker. */
export function ImportPickSheet({ open, onOpenChange, onFiles, onChoose, busy = false, error = '' }) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Import songs" className="h-auto sm:max-w-[520px]">
      <div className="flex flex-col gap-3.5">
        <div
          onDragEnter={(e) => { e.preventDefault(); depth.current += 1; setOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); depth.current = Math.max(0, depth.current - 1); if (!depth.current) setOver(false); }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); depth.current = 0; setOver(false); onFiles?.(e.dataTransfer.files); }}
          className={cn('flex flex-col items-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-input px-5 py-9 text-center', over && 'border-link bg-selected')}
        >
          <span className="text-link"><FileIcon /></span>
          <b className="text-[16px]">{busy ? 'Reading files…' : 'Drop files here'}</b>
          <span className="text-[13px] text-muted-foreground">ChordPro, OpenSong, .md, text, PDF, or a .zip of many songs</span>
          <Button size="sm" className="mt-1.5" disabled={busy} onClick={onChoose}>Choose files</Button>
        </div>
        {error && <p role="alert" className="m-0 text-[13px] text-danger">{error}</p>}
        <p className="m-0 text-[14px] text-muted-foreground">Next you’ll see every song before anything is added.</p>
      </div>
    </Sheet>
  );
}

function Box({ on }) {
  return (
    <span aria-hidden="true" className={cn('flex size-[22px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] border-input', on && 'border-foreground bg-foreground text-background')}>
      {on && <CheckIcon size={14} />}
    </span>
  );
}

/**
 * @param {Array<{song, existing}>} items  parsed songs; `existing` = the library song it updates
 * @param {string[]} failed               files that could not be read ("name (why)")
 * @param {(songs) => void} onAdd          the ticked songs
 * @param {(song) => void} [onEditFirst]   one song: open it in the editor instead
 */
export function ImportReviewSheet({ open, onOpenChange, items = [], failed = [], source = '', onAdd, onEditFirst }) {
  const [off, setOff] = useState(() => new Set());
  const n = items.length;
  const dupes = items.filter(i => i.existing).length;
  const picked = items.filter((_, i) => !off.has(i));
  const flip = (i) => setOff(prev => { const s = new Set(prev); if (s.has(i)) s.delete(i); else s.add(i); return s; });
  const allOff = off.size === n;
  const add = () => { onAdd?.(picked.map(i => i.song)); onOpenChange?.(false); };
  const title = n === 1 ? 'Import 1 song' : `Import ${n} songs`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} className="sm:max-w-[560px]">
      <div className="flex min-h-full flex-col gap-3">
        {source && (
          <p className="m-0 text-[14px] text-muted-foreground">
            From <b className="font-medium text-foreground">{source}</b>.{n > 1 ? ' Untick any you don’t want.' : ''}
          </p>
        )}
        {dupes > 0 && (
          <div className="flex gap-2.5 rounded-card bg-warning-fill px-3.5 py-3 text-[13px] leading-[18px]">
            <span aria-hidden="true">⚠</span>
            <span>
              <b className="font-semibold">{dupes === 1 ? '1 is already in your library.' : `${dupes} are already in your library.`}</b>{' '}
              We’ll update {dupes === 1 ? 'it' : 'them'}, and setlists keep working. Untick to leave {dupes === 1 ? 'it' : 'them'} as {dupes === 1 ? 'it is' : 'they are'}.
            </span>
          </div>
        )}
        {n > 1 && (
          <div className="flex items-center justify-between px-0.5 text-[13px] text-muted-foreground">
            <span>{n} songs · {n - dupes} new</span>
            <button type="button" onClick={() => setOff(allOff ? new Set() : new Set(items.map((_, i) => i)))} className="min-h-0 cursor-pointer border-0 bg-transparent p-0 font-sans text-[13px] font-medium text-link">
              {allOff ? 'Tick all' : 'Untick all'}
            </button>
          </div>
        )}
        <div className="overflow-hidden rounded-card border border-border bg-card">
          {items.map((it, i) => {
            const on = !off.has(i);
            const k = songKey(it.song);
            return (
              <button
                key={i}
                type="button"
                aria-pressed={n > 1 ? on : undefined}
                onClick={() => n > 1 && flip(i)}
                className={cn('flex min-h-[58px] w-full min-w-0 cursor-pointer items-center gap-3 border-0 border-t border-border bg-transparent px-4 py-2 text-left font-sans text-foreground outline-none first:border-t-0 hover:bg-raised focus-visible:bg-raised', !on && 'opacity-55')}
              >
                {n > 1 && <Box on={on} />}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold">{it.song.title || 'Untitled'}</span>
                  <span className={cn('truncate text-[13px] text-muted-foreground', it.existing && 'text-[var(--chord)]')}>
                    {it.existing ? 'Already in library · will update' : (it.song.artist || 'New song')}
                  </span>
                </span>
                {k && <span className="flex h-7 min-w-9 shrink-0 items-center justify-center rounded-[6px] bg-raised px-1.5 font-mono text-[13px] font-semibold text-[var(--chord)]">{k}</span>}
              </button>
            );
          })}
        </div>
        {failed.length > 0 && (
          <>
            <div className="px-0.5 pt-1 text-[13px] text-muted-foreground">Couldn’t read {failed.length === 1 ? '1 file' : `${failed.length} files`}</div>
            <div className="overflow-hidden rounded-card border border-border bg-card">
              {failed.map(f => (
                <div key={f} className="border-t border-border px-4 py-3 text-[14px] first:border-t-0">{f}</div>
              ))}
            </div>
          </>
        )}
        <div className="sticky bottom-0 -mx-6 mt-auto flex flex-col gap-2 border-t border-border bg-card px-6 pb-1 pt-3">
          <div className="flex gap-2">
            <Button className="flex-1" disabled={!picked.length} onClick={add}>
              {n === 1 ? 'Add song' : `Add ${picked.length} song${picked.length === 1 ? '' : 's'}`}
            </Button>
            {n === 1 && onEditFirst && <Button variant="outline" className="flex-1" onClick={() => { onOpenChange?.(false); onEditFirst(items[0].song); }}>Edit first</Button>}
          </div>
          <span className="text-center text-[12px] text-muted-foreground">You can edit any of them later.</span>
        </div>
      </div>
    </Sheet>
  );
}
