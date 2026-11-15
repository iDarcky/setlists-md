import { useState } from 'react';
import { ListRow, KeyBadge, listRowShell } from '@/ui/shadcn/list-row';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Avatar } from '@/app/AppTopBar';
import { BackIcon, ClockIcon, PinIcon, PlayIcon, MoreIcon, ListIcon, ChevronRightIcon } from '@/app/navIcons';
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
  pending: { label: 'Invited', cls: 'bg-warning/15 text-warning-text' },
};

const Chip = ({ className, children }) => (
  <span className={cn('flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold', className)}>{children}</span>
);

// The row the clock says is on now (service day only).
const NowDot = () => <span role="img" aria-label="Now" className="mt-0.5 size-2.5 animate-pulse rounded-full bg-link" />;

function OrderRow({ row, onOpen, now = false }) {
  if (row.kind === 'moment') {
    // Style D from the QA mockups (owner, 11 Nov): a thin bar where the number
    // would be and an italic name, so a moment reads as a pause, not a song.
    const body = (
      <>
        <span className="flex w-5 shrink-0 justify-end self-stretch py-1">
          {now ? <span className="self-center"><NowDot /></span> : <span aria-hidden="true" className="w-[3px] rounded-full bg-border" />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-small font-medium italic text-muted-foreground">{row.title}</span>
          <span className="truncate text-small text-muted-foreground">
            {row.minutes ? `${row.minutes} min` : 'Moment'}{row.note && <> · <span className="text-foreground">{firstLine(row.note)}</span></>}
          </span>
        </span>
      </>
    );
    const cls = cn(listRowShell('compact', false), now && 'bg-selected');
    // A moment with a note opens it; one without has nothing more to show.
    return row.note
      ? <button type="button" onClick={() => onOpen(row)} className={cn(cls, 'cursor-pointer outline-none focus-visible:bg-raised')}>{body}<ChevronRightIcon /></button>
      : <div className={cls}>{body}</div>;
  }
  if (row.placeholder) {
    return (
      <ListRow
        inset={false}
        weight="strong"
        leading={<span className="flex w-5 justify-end text-small tabular-nums">{row.n}</span>}
        title={row.title}
        titleClassName="text-muted-foreground"
        sub="To be chosen"
      />
    );
  }
  const sub = [row.tempo ? `${row.tempo} BPM` : '', row.leads && `${row.leads} leads`, row.time, row.capo ? `capo ${row.capo}` : ''].filter(Boolean).join(' · ');
  return (
    <ListRow
      onClick={() => onOpen?.(row)}
      inset={false}
      selected={now}
      weight="strong"
      leading={<span className="flex w-5 justify-end text-small tabular-nums">{now ? <NowDot /> : row.n}</span>}
      title={row.title}
      titleClassName={cn(row.missing && 'italic text-muted-foreground')}
      sub={(sub || row.note) ? <>{sub}{sub && row.note && ' · '}{row.note && <span className="text-foreground">{firstLine(row.note)}</span>}</> : null}
      trailing={row.key ? <KeyBadge>{row.key}</KeyBadge> : null}
    />
  );
}

const firstLine = (md) => String(md).split('\n').map(l => l.replace(/^#+\s*|\*\*/g, '').trim()).find(Boolean) || '';

export function Order({ order, onOpenRow, empty, nowIdx = null }) {
  if (!order.rows.length) {
    return <p className="m-0 rounded-card border border-dashed border-border px-5 py-8 text-center text-[14px] text-muted-foreground">{empty}</p>;
  }
  return (
    <>
      <div className="flex flex-col">{order.rows.map(r => <OrderRow key={r.idx} row={r} onOpen={onOpenRow} now={r.idx === nowIdx} />)}</div>
      <div className="flex justify-between px-0.5 pt-1 text-[13px] text-muted-foreground">
        <span>{order.songCount} {order.songCount === 1 ? 'song' : 'songs'}</span>
        <span>{totalLabel(order.totalSeconds, order.estimated)}</span>
      </div>
    </>
  );
}

function Band({ band, leader, onBand, myId = null, onChangeMine = null }) {
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
        const mine = myId && b.userId === myId;
        // Your own row is the "you're on Vocals" card now (QA 11 Nov): a soft
        // highlight and a Change link, instead of a banner above the order.
        return (
          <ListRow
            key={b.id}
            inset={false}
            className={cn(mine && '-mx-2 w-[calc(100%+16px)] rounded-control border-t-transparent bg-selected px-2')}
            leading={<Avatar name={b.name} url={b.url} size={32} />}
            title={<>{b.name}{mine && <span className="font-normal text-muted-foreground"> · you</span>}</>}
            sub={b.part}
            trailing={<>
              {mine && onChangeMine && b.status !== 'pending' && (
                <Button variant="link" size="sm" className="h-8 px-1 text-small text-link" onClick={onChangeMine}>Change</Button>
              )}
              <Chip className={a.cls}>{a.label}</Chip>
            </>}
          />
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
  // Answered: nothing up here. Your row in the band list shows it (QA 11 Nov,
  // owner: "we can still show yourself but not that big").
  return null;
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
  onBack, backLabel = 'Back', onPlay, onEdit, onMarkReady, onAnswer, onRunSheet, onMenu, onBand, bandSlot = null, changes = [], nowIdx = null,
  myId = null,
}) {
  const [tab, setTab] = useState('order');
  const [moment, setMoment] = useState(null);
  const ready = setlist.status === 'ready';
  // No "8 songs · 42 min" on the Order tab: the same line closes the list
  // (QA 11 Nov, owner: "it's double anyway").
  const tabs = [['order', 'Order', ''], ['band', 'Band', band.length || '']];
  const orderEl = <Order order={order} nowIdx={nowIdx} onOpenRow={(r) => (r.kind === 'moment' ? setMoment(r) : onPlay?.(r.idx))} empty={leader ? 'No songs yet. Tap Edit to add some.' : 'No songs yet.'} />;
  const bandEl = bandSlot || <Band band={band} leader={leader} onBand={onBand} myId={myId} onChangeMine={onAnswer ? () => onAnswer(null) : null} />;

  return (
    <div data-slot="setlist-view" className={cn('@container bg-background font-sans text-foreground', embedded && 'absolute inset-0 overflow-y-auto')}>
      <div className={cn('mx-auto flex w-full max-w-[1180px] flex-col px-4 pb-32 @min-[640px]:px-6 @min-[1024px]:grid @min-[1024px]:grid-cols-[minmax(0,1fr)_360px] @min-[1024px]:gap-x-8 @min-[1024px]:gap-y-4 @min-[1024px]:pb-12')}>
        <div className="flex min-w-0 flex-col gap-3 @min-[1024px]:col-start-1 @min-[1024px]:row-start-1">
          {/* QA 11 Nov (owner): the back button had a whole row to itself —
              "good space that's lost". It is a small ← on the title's row now,
              with the actions on the same row at the other end. */}
          <div className="flex items-start gap-2 pt-3 @min-[640px]:pt-6" style={{ marginTop: 'max(env(safe-area-inset-top, 0px), 0px)' }}>
            <Button variant="ghost" size="icon" className="-ml-2.5 shrink-0" aria-label={backLabel} title={backLabel} onClick={onBack}><BackIcon /></Button>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1.5">
              <div className="flex items-center gap-2">
                {head.date && <span className="text-label text-muted-foreground">{head.date}</span>}
                <Chip className={ready ? 'bg-selected text-link' : 'bg-raised text-muted-foreground'}>{ready ? 'Ready' : 'Draft'}</Chip>
              </div>
              <h1 className="m-0 text-[26px] font-semibold leading-8 tracking-[-0.6px] @min-[640px]:text-[32px] @min-[640px]:leading-10 @min-[640px]:tracking-[-1px]">{setlist.name || 'Untitled setlist'}</h1>
              <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[14px] text-muted-foreground">
                {head.service && <span>{head.service}</span>}
                {head.time && <span className="flex items-center gap-1.5"><ClockIcon size={16} />{head.time}</span>}
                {head.place && <span className="flex items-center gap-1.5"><PinIcon size={16} />{head.place}</span>}
                {head.rehearsal && <span className="flex items-center gap-1.5"><ClockIcon size={16} />Rehearsal {head.rehearsal}</span>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {leader && <span className="hidden gap-2 @min-[1024px]:flex">
                {!ready && onMarkReady && <Button variant="outline" size="sm" onClick={onMarkReady}>Mark ready</Button>}
                {onEdit && <Button variant="outline" size="sm" onClick={onEdit}>Edit</Button>}
              </span>}
              {onRunSheet && <Button variant="ghost" size="icon" aria-label="Service order" title="Service order" onClick={onRunSheet}><ListIcon /></Button>}
              {onMenu && <Button variant="ghost" size="icon" aria-label="More" onClick={onMenu}><MoreIcon /></Button>}
            </div>
          </div>

          <Mine me={me} onAnswer={onAnswer} />
          {changes.length > 0 && (
            <div className="flex flex-col gap-1 rounded-card bg-warning/12 px-4 py-3">
              <b className="text-[15px] font-semibold">Changed since Ready</b>
              <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5 text-[14px] text-muted-foreground">
                {changes.slice(0, 5).map(c => <li key={c}>{c}</li>)}
                {changes.length > 5 && <li>and {changes.length - 5} more</li>}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <Button className="h-12 flex-1 text-[16px]" disabled={!order.songCount} onClick={() => onPlay?.(0)}><PlayIcon />Play</Button>
            {leader && onEdit && <Button variant="outline" className="h-12 flex-1 text-[16px] @min-[1024px]:hidden" onClick={onEdit}>Edit</Button>}
          </div>

          {/* Style C (owner, 11 Nov): each tab takes half the width, green underline. */}
          <div role="tablist" className="-mx-4 grid grid-cols-2 border-b border-border @min-[640px]:-mx-6 @min-[1024px]:hidden">
            {tabs.map(([id, label, extra]) => (
              <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)}
                className={cn('-mb-px flex h-11 min-h-0 cursor-pointer items-center justify-center gap-1.5 border-0 border-b-2 border-solid bg-transparent px-0 font-sans text-[15px] font-semibold outline-none focus-visible:bg-raised', tab === id ? 'border-link text-foreground' : 'border-transparent text-muted-foreground')}>
                {label}{extra !== '' && <span className="text-[12px] font-medium text-muted-foreground">{extra}</span>}
              </button>
            ))}
          </div>
          <div className="@min-[1024px]:hidden">{tab === 'order' ? orderEl : bandEl}</div>
        </div>
        {/* Order and band share a row on desktop, so the band starts level
            with the first song (QA 11 Nov: "the band is higher than the
            songs"). */}
        <div className="hidden @min-[1024px]:col-start-1 @min-[1024px]:row-start-2 @min-[1024px]:block @min-[1024px]:self-start @min-[1024px]:rounded-card @min-[1024px]:border @min-[1024px]:border-border @min-[1024px]:bg-card @min-[1024px]:px-4 @min-[1024px]:py-1">{orderEl}</div>

        <aside className="hidden @min-[1024px]:col-start-2 @min-[1024px]:row-start-2 @min-[1024px]:flex @min-[1024px]:flex-col @min-[1024px]:gap-2 @min-[1024px]:self-start @min-[1024px]:rounded-card @min-[1024px]:border @min-[1024px]:border-border @min-[1024px]:bg-card @min-[1024px]:p-5">
          <div className="flex items-center justify-between pb-1 text-label text-muted-foreground">
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
