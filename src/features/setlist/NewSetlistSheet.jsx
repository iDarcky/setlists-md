import { useMemo, useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Sheet } from '@/ui/shadcn/sheet';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';
import { serviceStarts, newSetlistFrom, blankDate, dayLabel } from '@/lib/newSetlist';

// "New setlist" (canvas → Setlist, SetNew): start from a service the church
// already runs, or blank. Drawer on a phone, dialog from the iPad up. Create
// opens the new edit page with the draft; nothing is saved until Done.

function Row({ id, name, sub, right, pick, onPick }) {
  return (
    <button type="button" role="radio" aria-checked={pick === id} onClick={() => onPick(id)}
      className={cn('flex w-full cursor-pointer items-center gap-3 rounded-card border px-4 py-2.5 text-left font-sans text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring',
        pick === id ? 'border-link bg-selected' : 'border-border bg-transparent hover:bg-raised/50')}>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">{name}</span>
        {sub && <span className="text-[13px] leading-5 text-muted-foreground">{sub}</span>}
      </span>
      {right && <span className="shrink-0 text-[13px] font-semibold text-link">{right}</span>}
    </button>
  );
}

export function NewSetlistBody({ starts, onCreate, onEditTemplates }) {
  const [pick, setPick] = useState(starts[0]?.id || 'blank');
  const chosen = starts.find(s => s.id === pick) || null;
  const [dates, setDates] = useState({});
  const date = dates[pick] ?? (chosen ? chosen.date : blankDate());
  const [changing, setChanging] = useState(false);
  const onPick = (id) => { setPick(id); setChanging(false); };

  return (
    <div className="flex flex-col gap-4 font-sans">
      {starts.length > 0 && <h3 className="m-0 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Start from a service</h3>}
      <div role="radiogroup" aria-label="Start from" className="flex flex-col gap-2">
        {starts.map(s => <Row key={s.id} id={s.id} name={s.name} sub={s.sub} right={dayLabel(dates[s.id] ?? s.date)} pick={pick} onPick={onPick} />)}
        <Row id="blank" name="Blank setlist" sub="No template" right={pick === 'blank' ? dayLabel(date) : ''} pick={pick} onPick={onPick} />
      </div>
      <div className="flex items-center justify-between gap-3 text-[14px]">
        {onEditTemplates ? <Button variant="link" onClick={onEditTemplates}>Edit templates</Button> : <span />}
        <span className="text-muted-foreground">
          {changing ? null : <>Date: {chosen ? 'next free day' : 'next Sunday'} · <Button variant="link" onClick={() => setChanging(true)}>change it</Button></>}
        </span>
      </div>
      {changing && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[14px] font-medium">Date</span>
          <Input type="date" value={date} onChange={(e) => setDates(prev => ({ ...prev, [pick]: e.target.value }))} />
        </label>
      )}
      <Button onClick={() => onCreate(newSetlistFrom(chosen?.from || null, date))}>
        {date ? `Create for ${dayLabel(date)}` : 'Create'}
      </Button>
    </div>
  );
}

export default function NewSetlistSheet({ open, onOpenChange, setlists = [], onCreate, onEditTemplates }) {
  const starts = useMemo(() => (open ? serviceStarts(setlists) : []), [open, setlists]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="New setlist" className="h-auto max-h-[90dvh] sm:max-w-[480px]">
      {open && <NewSetlistBody starts={starts} onCreate={onCreate} onEditTemplates={onEditTemplates} />}
    </Sheet>
  );
}
