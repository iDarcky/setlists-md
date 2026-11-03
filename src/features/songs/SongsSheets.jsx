import { useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Sheet } from '@/ui/shadcn/sheet';
import { Input } from '@/ui/shadcn/input';

// The Songs page's smaller sheets: + Add, Tag, and Move/Copy to another church.

const Icon = ({ d }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const SEARCH = <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>;
const FILE = <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M12 12v6M9 15l3 3 3-3" /></>;
const PEN = <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>;

function Option({ icon, title, text, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full min-h-0 cursor-pointer items-center gap-3.5 rounded-card border border-border bg-transparent p-3.5 text-left font-sans text-foreground outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-raised"><Icon d={icon} /></span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="text-[13px] leading-[18px] text-muted-foreground">{text}</span>
      </span>
    </button>
  );
}

export function AddSongSheet({ open, onOpenChange, onSearch, onImport, onBlank }) {
  const pick = (fn) => () => { onOpenChange?.(false); fn?.(); };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Add a song" className="h-auto sm:max-w-[440px]">
      <div className="flex flex-col gap-2.5">
        {onSearch && <Option icon={SEARCH} title="Find a public-domain song" text="Hymns and old songs anyone may use, with chords." onClick={pick(onSearch)} />}
        {onImport && <Option icon={FILE} title="Import files" text="ChordPro, OpenSong, .md, or a .zip of many songs." onClick={pick(onImport)} />}
        {onBlank && <Option icon={PEN} title="Start from blank" text="Type it in yourself." onClick={pick(onBlank)} />}
        <p className="m-0 pt-1 text-[13px] text-muted-foreground">Only add songs your church has a licence for (CCLI).</p>
      </div>
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
              <button key={t} type="button" onClick={() => add(t)} className="flex h-8 min-h-0 cursor-pointer items-center rounded-full border border-border bg-transparent px-3 font-sans text-[13px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">{t}</button>
            ))}
          </div>
        )}
      </form>
    </Sheet>
  );
}

/** Move or copy to another church the user leads. */
export function ChurchPickerSheet({ open, onOpenChange, action = 'copy', count = 0, churches = [], onPick }) {
  const [busy, setBusy] = useState(null);
  const pick = async (id) => {
    setBusy(id);
    try { await onPick?.(id); onOpenChange?.(false); } finally { setBusy(null); }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`${action === 'move' ? 'Move' : 'Copy'} ${count} song${count === 1 ? '' : 's'} to…`} className="h-auto sm:max-w-[440px]">
      <div className="flex flex-col gap-2">
        <p className="m-0 text-[14px] text-muted-foreground">
          {action === 'move' ? 'They leave this church’s library.' : 'This church keeps its copy.'}
        </p>
        <div className="flex flex-col overflow-hidden rounded-card border border-border">
          {churches.map(c => (
            <button
              key={c.id}
              type="button"
              disabled={!!busy}
              onClick={() => pick(c.id)}
              className={cn('flex h-12 min-h-0 cursor-pointer items-center justify-between border-0 border-t border-border bg-transparent px-3.5 text-left font-sans text-[15px] font-medium text-foreground outline-none first:border-t-0 hover:bg-raised focus-visible:bg-raised disabled:opacity-50')}
            >
              {c.name}
              {busy === c.id && <span className="text-[13px] text-muted-foreground">…</span>}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
