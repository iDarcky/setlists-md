import { useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Sheet } from '@/ui/shadcn/sheet';
import { Avatar } from '@/app/AppTopBar';
import { PersonAddIcon, PlusIcon } from '@/app/navIcons';
import { partName, ADDABLE_PARTS } from '@/lib/bandParts';

// The leader's Band on the setlist page (canvas → Setlist → Band, Part).
// One row per part; tap a row to pick who plays it. Picks are only a plan
// until Send asks, so a leader can shape the whole band before anyone is
// notified.

const STATUS = {
  available: ['Yes', 'bg-selected text-link'],
  maybe: ['Maybe', 'bg-warning/15 text-warning-text'],
  unavailable: ['Can’t', 'bg-danger/15 text-danger'],
  pending: ['Asked', 'bg-warning/15 text-warning-text'],
  notsent: ['Not sent', 'bg-warning/15 text-warning-text'],
};

const Caps = ({ children }) => <span className="pt-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{children}</span>;

/**
 * @param {Array} slots        from bandSlots()
 * @param {(uid) => {name,url}} person
 */
export function BandPlanner({ slots, person, note, onSlot, onAddPart, pending = 0, sendLabel, onSend, sending = false, error }) {
  return (
    <div className="flex flex-col">
      {slots.map(s => {
        const p = s.userId ? person(s.userId) : null;
        const st = STATUS[s.status];
        return (
          <button key={s.key} type="button" onClick={() => onSlot(s)}
            className="flex min-h-14 w-full cursor-pointer items-center gap-3 border-0 border-t border-solid border-border bg-transparent py-2 text-left font-sans text-foreground outline-none first:border-t-0 focus-visible:bg-raised">
            <span className={cn('w-[112px] shrink-0 truncate text-[13px] font-semibold', s.status === 'empty' ? 'text-danger' : 'text-muted-foreground')}>{partName(s.part)}</span>
            {p ? (
              <>
                <Avatar name={p.name} url={p.url} size={28} />
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{p.name}</span>
                {st && <span className={cn('flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold', st[1])}>{st[0]}</span>}
              </>
            ) : (
              <span className="flex flex-1 items-center gap-2 text-[15px] font-semibold text-link"><PersonAddIcon />Pick someone</span>
            )}
          </button>
        );
      })}
      {!slots.length && <p className="m-0 py-3 text-[14px] text-muted-foreground">Nobody is on this one yet. Add the parts you need.</p>}
      <button type="button" onClick={onAddPart}
        className="flex min-h-12 cursor-pointer items-center gap-2 border-0 border-t border-solid border-border bg-transparent py-2 text-left font-sans text-[14px] font-medium text-link outline-none">
        <PlusIcon size={16} />Add a part
      </button>
      {note && <p className="m-0 pt-1 text-[12px] text-muted-foreground">{note}</p>}
      {pending > 0 && (
        <div className="flex flex-col gap-1.5 pt-3">
          <Button className="h-11 w-full" disabled={sending} onClick={onSend}>{sending ? 'Sending…' : sendLabel}</Button>
          <span className="text-center text-[12px] text-muted-foreground">{error || 'Nobody is notified until you send.'}</span>
        </div>
      )}
    </div>
  );
}

function Person({ p, on, onPick, dim }) {
  return (
    <button type="button" onClick={() => onPick(p.userId)} aria-pressed={on}
      className={cn('flex min-h-14 w-full cursor-pointer items-center gap-3 border-0 border-t border-solid border-border bg-transparent py-2 text-left font-sans text-foreground outline-none first:border-t-0', dim && 'opacity-60')}>
      <Avatar name={p.name} url={p.url} size={32} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-medium">{p.name}</span>
        <span className="truncate text-[13px] text-muted-foreground">{p.note}</span>
        {p.warn && <span className="text-[12px] font-medium text-warning-text">⚠ {p.warn}</span>}
      </span>
      <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-link' : 'border-input')}>
        {on && <span className="size-2.5 rounded-full bg-link" />}
      </span>
    </button>
  );
}

/** Tap a part: who plays it, free first. Re-mount (key) per slot. */
export function PartSheet({ open, onOpenChange, title, groups, current, currentName, onChoose, onRemove }) {
  const [pick, setPick] = useState(null);
  const all = [...groups.free, ...groups.none, ...groups.cant];
  const chosen = all.find(p => p.userId === pick);
  const sections = [['Free that day', groups.free], ['No answer yet', groups.none], ['Can’t', groups.cant]].filter(([, xs]) => xs.length);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} className="h-auto max-h-[90dvh] sm:max-w-[480px]">
      <div className="flex flex-col">
        {current && (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-card bg-raised px-4 py-3">
            <span className="text-[14px]"><b className="font-semibold">{currentName}</b> is on this part</span>
            <Button variant="outline" size="sm" className="text-danger" onClick={onRemove}>Take off</Button>
          </div>
        )}
        {sections.map(([label, xs]) => (
          <div key={label} className="flex flex-col">
            <Caps>{label}</Caps>
            {xs.map(p => <Person key={p.userId} p={p} on={pick === p.userId} onPick={setPick} dim={label === 'Can’t'} />)}
          </div>
        ))}
        {!all.length && <p className="m-0 py-4 text-[14px] text-muted-foreground">Nobody else in the church plays this. Add it to someone’s instruments in Church settings → People.</p>}
        <Button className="mt-4 h-11 w-full" disabled={!chosen} onClick={() => onChoose(chosen.userId)}>
          {chosen ? `${current ? 'Swap to' : 'Add'} ${chosen.name.split(' ')[0]}` : 'Pick someone'}
        </Button>
      </div>
    </Sheet>
  );
}

export function AddPartSheet({ open, onOpenChange, onAdd }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Add a part" className="h-auto max-h-[80dvh] sm:max-w-[400px]">
      <div className="flex flex-col">
        {ADDABLE_PARTS.map(p => (
          <button key={p} type="button" onClick={() => onAdd(p)}
            className="flex min-h-12 w-full cursor-pointer items-center border-0 border-t border-solid border-border bg-transparent text-left font-sans text-[15px] font-medium text-foreground outline-none first:border-t-0">
            {partName(p)}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
