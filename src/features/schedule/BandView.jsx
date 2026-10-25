import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { churchInitials } from '@/lib/joinLink';
import { ChevronLeftIcon, ChevronRightIcon } from '@/app/navIcons';

// Band: the leader's people × setlists grid (canvas → Schedule → Band).
// Tapping a cell only fills a plan: an empty cell becomes an ask, a filled one
// is taken off. Nothing is sent until "Send asks", so a leader can lay out a
// whole month and send it in one go. Pure view: Schedule.jsx owns the plan.

const day = (dateStr, opts) => new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-GB', opts);

const CELL = {
  in: { cls: 'bg-link text-background', mark: '✓', label: 'in the band' },
  asked: { cls: 'border-2 border-link text-link', mark: '…', label: 'asked' },
  maybe: { cls: 'bg-warning/20 text-warning-text', mark: '?', label: 'maybe' },
  cant: { cls: 'bg-danger/15 text-danger', mark: '×', label: 'can’t' },
  free: { cls: 'bg-selected', mark: '', label: 'free' },
  none: { cls: 'border border-dashed border-input', mark: '', label: 'no answer' },
};

const LEGEND = ['in', 'asked', 'free', 'maybe', 'cant', 'none'];

function Cell({ cell, person, column, onTap }) {
  const c = CELL[cell.state];
  const add = cell.planned === 'add';
  const remove = cell.planned === 'remove';
  const label = `${person.name}, ${day(column.setlist.date, { weekday: 'long', day: 'numeric', month: 'long' })}: ${c.label}${add ? ', ask not sent yet' : ''}${remove ? ', taking off' : ''}`;
  return (
    <button
      type="button"
      disabled={!column.rowId}
      aria-label={label}
      aria-pressed={!!cell.planned}
      onClick={() => onTap?.(column.setlist.id, person.userId)}
      className="flex h-[52px] min-h-0 cursor-pointer items-center justify-center border-0 border-l border-border bg-transparent p-0 outline-none hover:bg-raised focus-visible:bg-raised disabled:cursor-default"
    >
      <span
        className={cn(
          'relative flex size-8 items-center justify-center rounded-[8px] text-[14px] font-bold',
          c.cls,
          add && 'border-warning-text text-warning-text',
          remove && 'opacity-35',
        )}
      >
        {add ? '+' : c.mark}
        {add && <span aria-hidden="true" className="absolute -right-1 -top-1 size-2.5 rounded-full bg-warning-text" />}
        {remove && <span aria-hidden="true" className="absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 rounded bg-danger" />}
      </span>
    </button>
  );
}

/**
 * @param {object} p
 * @param {Array} p.columns   bandGrid().columns for this page
 * @param {Array} p.people    bandGrid().people, cells cut to this page
 * @param {{adds:number, removes:number}} p.plan
 */
export default function BandView({
  columns = [], people = [], range, onPrev, onNext, canPrev, canNext,
  onTap, onOpen, plan = { adds: 0, removes: 0 }, onSend, onClear, sending = false, error,
}) {
  if (!columns.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-card border border-border bg-card px-5 py-7 text-center">
        <b className="text-[17px]">Nothing to plan yet</b>
        <p className="m-0 max-w-[320px] text-[15px] leading-[21px] text-muted-foreground">Make a setlist with a date, then pick its band here.</p>
      </div>
    );
  }
  const cols = `minmax(120px,1fr) repeat(${columns.length}, 52px)`;
  const pending = plan.adds + plan.removes;
  const navBtn = 'flex size-8 min-h-0 cursor-pointer items-center justify-center rounded-full border border-border bg-transparent p-0 text-muted-foreground outline-none hover:bg-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40';
  const sendLabel = [
    plan.adds && `Send ${plan.adds} ask${plan.adds === 1 ? '' : 's'}`,
    plan.removes && `${plan.adds ? 'take' : 'Take'} ${plan.removes} off`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{range}</span>
        <div className="flex gap-1">
          <button type="button" aria-label="Earlier setlists" disabled={!canPrev} onClick={onPrev} className={navBtn}><ChevronLeftIcon /></button>
          <button type="button" aria-label="Later setlists" disabled={!canNext} onClick={onNext} className={navBtn}><ChevronRightIcon /></button>
        </div>
      </div>

      <div role="grid" aria-label="Band" className="overflow-hidden rounded-card border border-border bg-card">
        <div role="row" className="grid border-b border-border bg-raised" style={{ gridTemplateColumns: cols }}>
          <span role="columnheader" className="flex items-center px-3 text-[13px] text-muted-foreground">{people.length} {people.length === 1 ? 'person' : 'people'}</span>
          {columns.map(c => (
            <button
              key={c.setlist.id}
              type="button"
              role="columnheader"
              title={c.setlist.name || 'Setlist'}
              onClick={() => onOpen?.(c.setlist)}
              className="flex h-[52px] min-h-0 cursor-pointer flex-col items-center justify-center border-0 border-l border-border bg-transparent p-0 font-sans leading-none text-foreground outline-none hover:bg-card focus-visible:bg-card"
            >
              <span className="text-[11px] font-semibold uppercase text-muted-foreground">{day(c.setlist.date, { weekday: 'short' })}</span>
              <span className="mt-1 text-[17px] font-semibold">{day(c.setlist.date, { day: 'numeric' })}</span>
            </button>
          ))}
        </div>
        {people.map(p => (
          <div key={p.userId} role="row" className="grid border-b border-border" style={{ gridTemplateColumns: cols }}>
            <span role="rowheader" className="flex min-w-0 items-center gap-2 px-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-raised text-[10px] font-semibold">{churchInitials(p.name)}</span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[14px] font-medium">{p.name}</span>
                {p.part && <span className="truncate text-[12px] text-muted-foreground">{p.part}</span>}
              </span>
            </span>
            {p.cells.map((cell, i) => <Cell key={cell.setlistId} cell={cell} person={p} column={columns[i]} onTap={onTap} />)}
          </div>
        ))}
        <div role="row" className="grid border-b border-border" style={{ gridTemplateColumns: cols }}>
          <span role="rowheader" className="flex h-11 items-center px-3 text-[13px] text-muted-foreground">In the band</span>
          {columns.map(c => <span key={c.setlist.id} className="flex items-center justify-center border-l border-border text-[14px] font-semibold">{c.inBand}</span>)}
        </div>
        <div role="row" className="grid" style={{ gridTemplateColumns: cols }}>
          <span role="rowheader" className="flex min-h-11 items-center px-3 text-[13px] font-medium text-danger">Missing</span>
          {columns.map(c => (
            <span key={c.setlist.id} className={cn('flex flex-col items-center justify-center gap-0.5 border-l border-border px-0.5 py-2 text-center text-[11px] font-semibold leading-tight', c.missing?.length !== 0 ? 'text-danger' : 'text-muted-foreground')}>
              {!c.rowId ? 'Not synced' : c.missing === null ? 'No band' : c.missing.length ? c.missing.map(m => <span key={m}>{m}</span>) : '–'}
            </span>
          ))}
        </div>
      </div>

      {(pending > 0 || error) && (
        <div className="flex flex-col gap-2 rounded-card border border-border bg-card p-3">
          {pending > 0 && (
            <>
              <p className="m-0 text-[14px] text-muted-foreground">
                {plan.adds ? 'Everyone you ask gets a notification to say yes or no.' : 'They come off the band for that setlist.'}
              </p>
              <div className="flex gap-2">
                <Button className="flex-1" disabled={sending} onClick={onSend}>{sending ? 'Sending…' : sendLabel}</Button>
                <Button variant="outline" disabled={sending} onClick={onClear}>Undo</Button>
              </div>
            </>
          )}
          {error && <p role="alert" className="m-0 text-[14px] text-danger">{error}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[12px] text-muted-foreground" aria-hidden="true">
        {LEGEND.map(k => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={cn('flex size-4 items-center justify-center rounded-[4px] text-[10px] font-bold', CELL[k].cls)}>{CELL[k].mark}</span>
            {k === 'in' ? 'In the band' : k === 'none' ? 'No answer' : CELL[k].label[0].toUpperCase() + CELL[k].label.slice(1)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span className="flex size-4 items-center justify-center rounded-[4px] border-2 border-warning-text text-[10px] font-bold text-warning-text">+</span>Not sent yet</span>
      </div>
      <p className="m-0 text-[13px] text-muted-foreground">Tap an empty square to ask someone, or a filled one to take them off. Nothing is sent until you tap Send.</p>
    </div>
  );
}
