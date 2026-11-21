import { useRef, useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Sheet } from '@/ui/shadcn/sheet';
import { CheckIcon } from '@/app/navIcons';
import { songKey } from '@/lib/songsData';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { FileText } from 'lucide-react';
import { Spinner } from '@/ui/shadcn/spinner';

// Import, rebuilt (canvas → Import + public domain). Pick files, then every
// song is listed before anything is added. A song the library already has
// updates in place; untick it to leave it alone.

const FORMATS = 'PDFs, ChordPro, OpenSong, .md or a .zip';

/**
 * Pick the files. From the iPad up a centred dialog with a drop zone; a phone
 * has no drag and drop, so it gets one line and Choose files (owner,
 * 2026-11-20). `onFiles(FileList)`; `onChoose` opens the file picker.
 */
export function ImportPickSheet({ open, onOpenChange, onFiles, onChoose, busy = false, error = '', progress = [] }) {
  const wide = useMediaQuery('(min-width: 640px)');
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const choose = (
    <Button size={wide ? 'sm' : 'default'} className={cn(wide ? 'mt-1.5' : 'w-full')} disabled={busy} onClick={onChoose}>
      {!wide && <FileText size={18} strokeWidth={1.8} aria-hidden="true" />}
      {busy ? 'Reading files…' : 'Choose files'}
    </Button>
  );
  // Reading: each file as it goes (approved mockup, import row).
  if (busy && progress.length > 1) {
    const mark = (st) => (st === 'done' ? <span className="text-muted-foreground"><CheckIcon size={16} /></span>
      : st === 'reading' ? <Spinner />
      : st === 'failed' ? <span className="text-caption text-[var(--chord)]">can’t read</span>
      : <span className="text-caption text-muted-foreground">waiting</span>);
    return (
      <Sheet open={open} onOpenChange={onOpenChange} title="Import songs" className="h-auto sm:max-w-[520px]">
        <div className="flex flex-col gap-3" aria-live="polite">
          <div className="flex items-center gap-3"><Spinner /><b className="text-body font-semibold">Reading {progress.length} files…</b></div>
          <div className="overflow-hidden rounded-card material-base">
            {progress.map(f => (
              <div key={f.name} className="flex min-h-12 items-center gap-3 border-t border-border px-4 py-2 first:border-t-0">
                <span className="min-w-0 flex-1 truncate text-body">{f.name}</span>{mark(f.state)}
              </div>
            ))}
          </div>
          <p className="m-0 text-small text-muted-foreground">Next you’ll see every song before anything is added.</p>
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Import songs" className="h-auto sm:max-w-[520px]">
      <div className="flex flex-col gap-3.5">
        {wide ? (
          <div
            onDragEnter={(e) => { e.preventDefault(); depth.current += 1; setOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); depth.current = Math.max(0, depth.current - 1); if (!depth.current) setOver(false); }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); depth.current = 0; setOver(false); onFiles?.(e.dataTransfer.files); }}
            className={cn('flex flex-col items-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-input px-5 py-9 text-center', over && 'border-foreground bg-raised')}
          >
            <span className="text-muted-foreground"><FileText size={22} strokeWidth={1.8} aria-hidden="true" /></span>
            <b className="text-body">{busy ? 'Reading files…' : 'Drop files here'}</b>
            <span className="text-small text-muted-foreground">{FORMATS}</span>
            {choose}
          </div>
        ) : (
          <>
            <p className="m-0 text-small text-muted-foreground">{FORMATS}. Pick as many as you like.</p>
            {choose}
          </>
        )}
        {error && <p role="alert" className="m-0 text-small text-danger-text">{error}</p>}
        <p className="m-0 text-small text-muted-foreground">Next you’ll see every song before anything is added.</p>
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
 * @param {string} [addTo]                a setlist's name: "Add 3 songs to Sunday"
 */
export function ImportReviewSheet({ open, onOpenChange, items = [], failed = [], source = '', onAdd, onEditFirst, addTo = '' }) {
  const [off, setOff] = useState(() => new Set());
  const n = items.length;
  const dupes = items.filter(i => i.existing).length;
  const picked = items.filter((_, i) => !off.has(i));
  const flip = (i) => setOff(prev => { const s = new Set(prev); if (s.has(i)) s.delete(i); else s.add(i); return s; });
  const allOff = off.size === n;
  const add = () => { onAdd?.(picked.map(i => i.song)); onOpenChange?.(false); };
  const title = n === 1 ? 'Import 1 song' : `Import ${n} songs`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} className="sm:max-w-[560px]"
      footer={(
        <div className="flex w-full flex-col gap-2">
          <div className="flex gap-2">
            <Button className="flex-1" disabled={!picked.length} onClick={add}>
              {n === 1 ? 'Add song' : `Add ${picked.length} song${picked.length === 1 ? '' : 's'}`}{addTo ? ` to ${addTo}` : ''}
            </Button>
            {n === 1 && onEditFirst && <Button variant="outline" className="flex-1" onClick={() => { onOpenChange?.(false); onEditFirst(items[0].song); }}>Edit first</Button>}
          </div>
          <span className="text-center text-caption text-muted-foreground">They’re tagged “To check”, so you can go through them one by one.</span>
        </div>
      )}>
      <div className="flex flex-col gap-3">
        {source && (
          <p className="m-0 text-small text-muted-foreground">
            From <b className="font-medium text-foreground">{source}</b>.{n > 1 ? ' Untick any you don’t want.' : ''}
          </p>
        )}
        {dupes > 0 && (
          <div className="flex gap-2.5 rounded-card bg-warning-fill px-3.5 py-3 text-small leading-[18px]">
            <span aria-hidden="true">⚠</span>
            <span>
              <b className="font-semibold">{dupes === 1 ? '1 is already in your library.' : `${dupes} are already in your library.`}</b>{' '}
              We’ll update {dupes === 1 ? 'it' : 'them'}, and setlists keep working. Untick to leave {dupes === 1 ? 'it' : 'them'} as {dupes === 1 ? 'it is' : 'they are'}.
            </span>
          </div>
        )}
        {n > 1 && (
          <div className="flex items-center justify-between px-0.5 text-small text-muted-foreground">
            <span>{n} songs · {n - dupes} new</span>
            <button type="button" onClick={() => setOff(allOff ? new Set() : new Set(items.map((_, i) => i)))} className="min-h-0 cursor-pointer border-0 bg-transparent p-0 font-sans text-small font-medium text-link">
              {allOff ? 'Tick all' : 'Untick all'}
            </button>
          </div>
        )}
        <div className="overflow-hidden rounded-card material-base">
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
                  <span className="truncate text-body font-semibold">{it.song.title || 'Untitled'}</span>
                  <span className={cn('truncate text-small text-muted-foreground', it.existing && 'text-[var(--chord)]')}>
                    {it.existing ? 'Already in library · will update' : (it.song.artist || 'New song')}
                  </span>
                </span>
                {k && <span className="flex h-7 min-w-9 shrink-0 items-center justify-center rounded-[6px] bg-raised px-1.5 font-mono text-small font-semibold text-[var(--chord)]">{k}</span>}
              </button>
            );
          })}
        </div>
        {failed.length > 0 && (
          <>
            <div className="px-0.5 pt-1 text-small text-muted-foreground">Couldn’t read {failed.length === 1 ? '1 file' : `${failed.length} files`}</div>
            <div className="overflow-hidden rounded-card material-base">
              {failed.map(f => (
                <div key={f} className="border-t border-border px-4 py-3 text-small first:border-t-0">{f}</div>
              ))}
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
