import { useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Avatar } from '@/app/AppTopBar';
import { BackIcon, ClockIcon, PinIcon, PlayIcon, MoreIcon, EditIcon, ListIcon, ChevronRightIcon } from '@/app/navIcons';
import { Sheet } from '@/ui/shadcn/sheet';
import { Markdown } from '@/ui/Markdown';
import { totalLabel } from '@/lib/setlistView';

// The setlist page, View (canvas → Setlist). Everyone reads it; leaders also
// get Edit and Mark ready. Pure view: SetlistPage works out the order, the band
// and your own row.

const ANSWER = {
  available: { label: 'Yes', cls: 'bg-selected text-link' },
  maybe: { label: 'Maybe', cls: 'bg-warning/15 text-warning-text' },
  unavailable: { label: 'Can’t', cls: 'bg-danger/15 text-danger' },
  pending: { label: 'Asked', cls: 'bg-warning/15 text-warning-text' },
};

const Chip = ({ className, children }) => (
  <span className={cn('flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold', className)}>{children}</span>
);

function OrderRow({ row, onOpen }) {
  if (row.kind === 'moment') {
    const body = (
      <>
        <span className="w-5 shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-medium text-muted-foreground">{row.title}</span>
          <span className="truncate text-[13px] text-muted-foreground">
            Moment{row.minutes ? ` · ${row.minutes} min` : ''}{row.note && <> · <span className="text-foreground">{firstLine(row.note)}</span></>}
          </span>
        </span>
      </>
    );
    const cls = 'flex min-h-[58px] w-full items-center gap-3 border-0 border-t border-solid border-border bg-transparent py-2 text-left font-sans text-foreground first:border-t-0';
    // A moment with a note opens it; one without has nothing more to show.
    return row.note
      ? <button type="button" onClick={() => onOpen(row)} className={cn(cls, 'cursor-pointer outline-none focus-visible:bg-raised')}>{body}<ChevronRightIcon /></button>
      : <div className={cls}>{body}</div>;
  }
  const sub = [row.leads && `${row.leads} leads`, row.time, row.capo ? `capo ${row.capo}` : ''].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      onClick={() => onOpen?.(row)}
      className="flex min-h-[58px] w-full min-w-0 cursor-pointer items-center gap-3 border-0 border-t border-border bg-transparent py-2 text-left font-sans text-foreground outline-none first:border-t-0 focus-visible:bg-raised"
    >
      <span className="w-5 shrink-0 text-right text-[13px] tabular-nums text-muted-foreground">{row.n}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn('truncate text-[15px] font-semibold', row.missing && 'italic text-muted-foreground')}>{row.title}</span>
        {(sub || row.note) && (
          <span className="truncate text-[13px] text-muted-foreground">
            {sub}{sub && row.note && ' · '}{row.note && <span className="text-foreground">{firstLine(row.note)}</span>}
          </span>
        )}
      </span>
      {row.key && <span className="flex h-7 w-9 shrink-0 items-center justify-center rounded-md bg-raised font-mono text-[13px] font-semibold text-[var(--chord)]">{row.key}</span>}
      <span className="w-8 shrink-0 text-right text-[13px] tabular-nums text-muted-foreground">{row.tempo || ''}</span>
    </button>
  );
}

const firstLine = (md) => String(md).split('\n').map(l => l.replace(/^#+\s*|\*\*/g, '').trim()).find(Boolean) || '';

function Order({ order, onOpenRow, empty }) {
  if (!order.rows.length) {
    return <p className="m-0 rounded-card border border-dashed border-border px-5 py-8 text-center text-[14px] text-muted-foreground">{empty}</p>;
  }
  return (
    <>
      <div className="flex flex-col">{order.rows.map(r => <OrderRow key={r.idx} row={r} onOpen={onOpenRow} />)}</div>
      <div className="flex justify-between px-0.5 pt-1 text-[13px] text-muted-foreground">
        <span>{order.songCount} {order.songCount === 1 ? 'song' : 'songs'}</span>
        <span>{totalLabel(order.totalSeconds, order.estimated)}</span>
      </div>
    </>
  );
}

function Band({ band, leader, onBand }) {
  if (!band.length) {
    return (
      <div className="flex flex-col items-start gap-2 py-2 text-[14px] text-muted-foreground">
        <span>Nobody is on this one yet.</span>
        {leader && onBand && <Button variant="outline" size="sm" onClick={onBand}>Pick the band</Button>}
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      {band.map(b => {
        const a = ANSWER[b.status] || ANSWER.pending;
        return (
          <div key={b.id} className="flex min-h-14 items-center gap-3 border-t border-border py-2 first:border-t-0">
            <Avatar name={b.name} url={b.url} size={32} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[15px] font-medium">{b.name}</span>
              {b.part && <span className="truncate text-[13px] text-muted-foreground">{b.part}</span>}
            </span>
            <Chip className={a.cls}>{a.label}</Chip>
          </div>
        );
      })}
    </div>
  );
}

function Mine({ me, onAnswer }) {
  if (!me) return null;
  if (me.status === 'pending') {
    return (
      <div className="flex flex-col gap-2.5 rounded-card bg-warning/12 px-4 py-3">
        <span className="flex flex-col gap-0.5">
          <b className="text-[15px] font-semibold">Can you play{me.part ? ` ${me.part}` : ''}?</b>
          <span className="text-[13px] text-muted-foreground">Your answer goes to the leader.</span>
        </span>
        <div className="flex gap-2">
          {[['available', 'Yes'], ['maybe', 'Maybe'], ['unavailable', 'No']].map(([v, l], i) => (
            <Button key={v} className="flex-1" size="sm" variant={i === 0 ? 'default' : 'outline'} onClick={() => onAnswer?.(v)}>{l}</Button>
          ))}
        </div>
      </div>
    );
  }
  const a = ANSWER[me.status] || ANSWER.pending;
  return (
    <div className="flex items-center gap-3 rounded-card bg-selected px-4 py-3">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="text-[15px] font-semibold">{me.status === 'unavailable' ? 'You said you can’t' : `You’re on ${me.part || 'this one'}`}</b>
        <span className="text-[13px] text-muted-foreground">You said {a.label.toLowerCase()}</span>
      </span>
      <Button variant="link" className="text-[14px] text-link" onClick={() => onAnswer?.(null)}>Change</Button>
    </div>
  );
}

/**
 * @param {object} setlist
 * @param {{ rows, songCount, totalSeconds, estimated }} order   from buildOrder()
 * @param {{ date, time, place, rehearsal }} head                 labels, ready to show
 * @param {{ part, status }|null} me                              your schedule row
 * @param {Array<{ id, name, url, part, status }>} band
 */
export default function SetlistView({
  setlist, order, head, me, band = [], leader = false, embedded = false,
  onBack, backLabel = 'Back', onPlay, onEdit, onMarkReady, onAnswer, onRunSheet, onMenu, onBand, bandSlot = null,
}) {
  const [tab, setTab] = useState('order');
  const [moment, setMoment] = useState(null);
  const ready = setlist.status === 'ready';
  const tabs = [['order', 'Order', order.songCount ? `${order.songCount} ${order.songCount === 1 ? 'song' : 'songs'} · ${totalLabel(order.totalSeconds, order.estimated)}` : ''], ['band', 'Band', band.length || '']];
  const orderEl = <Order order={order} onOpenRow={(r) => (r.kind === 'moment' ? setMoment(r) : onPlay?.(r.idx))} empty={leader ? 'No songs yet. Tap Edit to add some.' : 'No songs yet.'} />;
  const bandEl = bandSlot || <Band band={band} leader={leader} onBand={onBand} />;

  return (
    <div data-slot="setlist-view" className={cn('@container bg-background font-sans text-foreground', embedded && 'absolute inset-0 overflow-y-auto')}>
      <div className={cn('mx-auto flex w-full max-w-[1180px] flex-col px-4 pb-32 @min-[640px]:px-6 @min-[1024px]:grid @min-[1024px]:grid-cols-[minmax(0,1fr)_360px] @min-[1024px]:gap-x-8 @min-[1024px]:pb-12')}>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex h-14 items-center justify-between @min-[640px]:mt-4" style={{ marginTop: 'max(env(safe-area-inset-top, 0px), 0px)' }}>
            <button type="button" onClick={onBack} className="-ml-2 flex h-11 min-h-0 cursor-pointer items-center gap-1.5 rounded-control border-0 bg-transparent pl-2 pr-3 font-sans text-[15px] font-medium text-muted-foreground outline-none hover:bg-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              <BackIcon />{backLabel}
            </button>
            <div className="flex items-center gap-2">
              {leader && <span className="hidden gap-2 @min-[1024px]:flex">
                {!ready && onMarkReady && <Button variant="outline" size="sm" onClick={onMarkReady}>Mark ready</Button>}
                {onEdit && <Button variant="outline" size="sm" onClick={onEdit}><EditIcon size={16} />Edit</Button>}
              </span>}
              {onRunSheet && <Button variant="ghost" size="icon" aria-label="Run sheet" title="Run sheet" onClick={onRunSheet}><ListIcon /></Button>}
              {onMenu && <Button variant="ghost" size="icon" aria-label="More" onClick={onMenu}><MoreIcon /></Button>}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {head.date && <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{head.date}</span>}
              <Chip className={ready ? 'bg-selected text-link' : 'bg-raised text-muted-foreground'}>{ready ? 'Ready' : 'Draft'}</Chip>
            </div>
            <h1 className="m-0 text-[26px] font-semibold leading-8 tracking-[-0.6px] @min-[640px]:text-[32px] @min-[640px]:leading-10 @min-[640px]:tracking-[-1px]">{setlist.name || 'Untitled setlist'}</h1>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[14px] text-muted-foreground">
              {head.time && <span className="flex items-center gap-1.5"><ClockIcon size={16} />{head.time}</span>}
              {head.place && <span className="flex items-center gap-1.5"><PinIcon size={16} />{head.place}</span>}
              {head.rehearsal && <span className="flex items-center gap-1.5"><ClockIcon size={16} />Rehearsal {head.rehearsal}</span>}
            </div>
          </div>

          <Mine me={me} onAnswer={onAnswer} />

          <div className="flex gap-2">
            <Button className="h-12 flex-1 text-[16px]" disabled={!order.songCount} onClick={() => onPlay?.(0)}><PlayIcon />Play</Button>
            {leader && onEdit && <Button variant="outline" className="h-12 flex-1 text-[16px] @min-[1024px]:hidden" onClick={onEdit}><EditIcon />Edit</Button>}
          </div>

          <div role="tablist" className="-mx-4 flex gap-5 border-b border-border px-4 @min-[640px]:-mx-6 @min-[640px]:px-6 @min-[1024px]:hidden">
            {tabs.map(([id, label, extra]) => (
              <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)}
                className={cn('-mb-px flex h-10 min-h-0 cursor-pointer items-center gap-1.5 border-0 border-b-2 bg-transparent px-0 font-sans text-[15px] outline-none', tab === id ? 'border-foreground font-semibold text-foreground' : 'border-transparent font-medium text-muted-foreground')}>
                {label}{extra !== '' && <span className="text-[12px] font-medium text-muted-foreground">{extra}</span>}
              </button>
            ))}
          </div>
          <div className="@min-[1024px]:hidden">{tab === 'order' ? orderEl : bandEl}</div>
          <div className="hidden @min-[1024px]:block @min-[1024px]:rounded-card @min-[1024px]:border @min-[1024px]:border-border @min-[1024px]:bg-card @min-[1024px]:px-4 @min-[1024px]:py-1">{orderEl}</div>
        </div>

        <aside className="hidden @min-[1024px]:mt-[76px] @min-[1024px]:flex @min-[1024px]:flex-col @min-[1024px]:gap-2 @min-[1024px]:self-start @min-[1024px]:rounded-card @min-[1024px]:border @min-[1024px]:border-border @min-[1024px]:bg-card @min-[1024px]:p-5">
          <div className="flex items-center justify-between pb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <span>Band{band.length ? ` · ${band.filter(b => b.status === 'available').length} of ${band.length} said yes` : ''}</span>
          </div>
          {bandEl}
        </aside>
      </div>

      {leader && !ready && onMarkReady && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-1.5 border-t border-border bg-background px-4 pt-3 @min-[1024px]:hidden" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}>
          <Button variant="outline" className="h-12 w-full" onClick={onMarkReady}>Mark ready</Button>
          <span className="text-center text-[12px] text-muted-foreground">The band sees it’s final</span>
        </div>
      )}
      <Sheet open={!!moment} onOpenChange={(o) => { if (!o) setMoment(null); }} title={moment?.title || 'Moment'} className="h-auto max-h-[85dvh] sm:max-w-[520px]">
        {moment && (
          <div className="flex flex-col gap-3">
            {moment.minutes > 0 && <span className="text-[13px] text-muted-foreground">{moment.minutes} min</span>}
            <Markdown text={moment.note} className="text-[16px] leading-6" />
          </div>
        )}
      </Sheet>
    </div>
  );
}
