import { useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Sheet } from '@/ui/shadcn/sheet';
import { Input } from '@/ui/shadcn/input';
import { NewSongForm } from '@/features/song-edit/NewSongForm';
import { detailsMissing, EMPTY_DETAILS } from '@/features/song-edit/newSongDetails';
import { normalizeText } from '@/lib/search';

// The Songs page's smaller sheets: New song, Tag, and Move/Copy to another church.

/**
 * New song: the details first, then Next: Chart opens the editor with them
 * filled in and the chart gets the whole screen. The + menu opens it directly
 * (the old Add a song chooser was dropped, owner 2026-11-20).
 */
export function AddSongSheet({ open, onOpenChange, onBlank, songs = [], artists = [] }) {
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const close = (o) => { onOpenChange?.(o); if (!o) setDetails(EMPTY_DETAILS); };
  const missing = detailsMissing(details);
  const sameTitle = (() => {
    const t = normalizeText(details.title || '').trim();
    return t ? songs.find(x => normalizeText(x.title || '').trim() === t) || null : null;
  })();
  const next = () => { if (missing) return; const d = details; close(false); onBlank?.(d); };

  return (
    <Sheet open={open} onOpenChange={close} title="New song" className="h-auto max-h-[92dvh] sm:max-w-[480px]">
      <form className="flex flex-col gap-3.5" onSubmit={(e) => { e.preventDefault(); next(); }}>
        <NewSongForm value={details} onChange={setDetails} artists={artists} sameTitle={sameTitle} />
        {missing && <p className="m-0 text-small text-muted-foreground">Still needs {missing}.</p>}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={() => close(false)}>Cancel</Button>
          <Button type="submit" className="flex-[2]" disabled={!!missing}>Next: Chart</Button>
        </div>
      </form>
    </Sheet>
  );
}

/** Add a tag to every picked song. Tags already in the library are one tap. */
export function TagSheet({ open, onOpenChange, count = 0, tags = [], onAdd }) {
  const [text, setText] = useState('');
  const add = (t) => { const v = t.trim(); if (!v) return; onAdd?.(v); setText(''); onOpenChange?.(false); };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`Tag ${count} song${count === 1 ? '' : 's'}`} className="h-auto sm:max-w-[440px]">
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); add(text); }}>
        <div className="flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="New tag, e.g. Christmas" aria-label="Tag" />
          <Button type="submit" disabled={!text.trim()}>Add</Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 20).map(t => (
              <button key={t} type="button" onClick={() => add(t)} className="flex h-8 min-h-0 cursor-pointer items-center rounded-full border border-border bg-transparent px-3 font-sans text-small font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">{t}</button>
            ))}
          </div>
        )}
      </form>
    </Sheet>
  );
}

/** Move or copy to another church the user leads. */
export function ChurchPickerSheet({ open, onOpenChange, action = 'copy', count = 0, songTitle, churches = [], onPick }) {
  const [busy, setBusy] = useState(null);
  const pick = async (id) => {
    setBusy(id);
    try { await onPick?.(id); onOpenChange?.(false); } finally { setBusy(null); }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`${action === 'move' ? 'Move' : 'Copy'} ${songTitle ? `“${songTitle}”` : `${count} song${count === 1 ? '' : 's'}`} to…`} className="h-auto sm:max-w-[440px]">
      <div className="flex flex-col gap-2">
        <p className="m-0 text-small text-muted-foreground">
          {action === 'move'
            ? (songTitle || count === 1 ? 'It leaves this church’s library.' : 'They leave this church’s library.')
            : 'This church keeps its copy.'}
        </p>
        <div className="flex flex-col overflow-hidden rounded-card border border-border">
          {churches.map(c => (
            <button
              key={c.id}
              type="button"
              disabled={!!busy}
              onClick={() => pick(c.id)}
              className={cn('flex h-12 min-h-0 cursor-pointer items-center justify-between border-0 border-t border-border bg-transparent px-3.5 text-left font-sans text-body font-medium text-foreground outline-none first:border-t-0 hover:bg-raised focus-visible:bg-raised disabled:opacity-50')}
            >
              {c.name}
              {busy === c.id && <span className="text-small text-muted-foreground">…</span>}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
