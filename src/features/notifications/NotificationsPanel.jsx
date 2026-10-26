import { useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { BellIcon, CalendarIcon, MusicIcon, TeamIcon } from '@/app/navIcons';
import { timeLabel } from '@/lib/notifData';

// The bell's list (canvas → Notifications). Pure view: buildNotifs() makes the
// sections; the bell wraps this in a drawer on a phone, a dropdown from 640px.

const ICONS = { cal: CalendarIcon, music: MusicIcon, team: TeamIcon };

function Face({ avatar, tone }) {
  const Icon = avatar?.icon ? ICONS[avatar.icon] : null;
  return (
    <span className={cn('flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-raised text-[12px] font-semibold', tone === 'no' ? 'text-danger' : Icon ? 'text-link' : 'text-foreground')}>
      {avatar?.url ? <img src={avatar.url} alt="" className="size-full object-cover" /> : Icon ? <Icon size={18} /> : avatar?.initials}
    </span>
  );
}

const pillBtn = 'flex h-9 min-h-0 cursor-pointer items-center justify-center rounded-full border border-input bg-card px-3.5 font-sans text-[14px] font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';
const pillInk = 'border-foreground bg-foreground text-background';

function Actions({ items }) {
  const [busy, setBusy] = useState(null);
  const run = async (label, fn) => {
    setBusy(label);
    try { await fn(); } finally { setBusy(null); }
  };
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map(([label, fn], i) => (
        <button key={label} type="button" disabled={!!busy} onClick={() => run(label, fn)} className={cn(pillBtn, i === 0 && pillInk)}>
          {busy === label ? '…' : label}
        </button>
      ))}
    </div>
  );
}

function Item({ it, now, onAnswer, onApprove, onDecline, onOpen }) {
  const actions = it.kind === 'ask'
    ? [['Yes', () => onAnswer?.(it, 'available')], ['Maybe', () => onAnswer?.(it, 'maybe')], ['No', () => onAnswer?.(it, 'unavailable')]]
    : it.kind === 'join' && onApprove
      ? [['Let in', () => onApprove(it)], ['Not now', () => onDecline?.(it)]]
      : null;
  const body = (
    <>
      {it.unread && <span aria-hidden="true" className="absolute left-1.5 top-[30px] size-1.5 rounded-full bg-link" />}
      <Face avatar={it.avatar} tone={it.tone} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span className="text-[15px] font-semibold leading-5">{it.title}</span>
        {it.sub && <span className="text-[13px] leading-[18px] text-muted-foreground">{it.sub}</span>}
        {actions && <Actions items={actions} />}
      </span>
      {it.time && <span className="shrink-0 pt-0.5 text-[12px] text-muted-foreground">{timeLabel(it.time, now)}</span>}
    </>
  );
  const cls = 'relative flex w-full items-start gap-3 border-0 border-t border-border bg-transparent px-4 py-3 font-sans text-foreground first:border-t-0';
  return actions
    ? <div className={cls}>{body}</div>
    : <button type="button" onClick={() => onOpen?.(it)} className={cn(cls, 'min-h-0 cursor-pointer outline-none hover:bg-raised focus-visible:bg-raised')}>{body}</button>;
}

const Label = ({ children }) => (
  <div className="px-1 pb-2 pt-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground first:pt-0">{children}</div>
);
const Group = ({ children }) => <div className="overflow-hidden rounded-card border border-border bg-card">{children}</div>;

/**
 * @param {{ needs, groups }} data          from buildNotifs()
 * @param {{ show: boolean, onEnable, onDismiss }} [push]  the lock-screen card
 */
export default function NotificationsPanel({ data, now = Date.now(), push, onMarkAllRead, onAnswer, onApprove, onDecline, onOpen, onSettings, compact = false }) {
  const empty = !data.needs.length && !data.groups.length;
  return (
    <div className="flex flex-col font-sans text-foreground">
      {!empty && onMarkAllRead && (
        <div className="flex justify-end pb-2">
          <button type="button" onClick={onMarkAllRead} className="min-h-0 cursor-pointer border-0 bg-transparent p-0 font-sans text-[14px] font-medium text-link">Mark all read</button>
        </div>
      )}
      {push?.show && (
        <div className="mb-3 flex items-center gap-3 rounded-card bg-selected px-4 py-3.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-link"><BellIcon size={18} /></span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <b className="text-[15px] font-semibold">Get these on your lock screen</b>
            <span className="text-[13px] text-muted-foreground">So you see an ask even when the app is closed.</span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            <button type="button" onClick={push.onEnable} className={cn(pillBtn, pillInk)}>Turn on</button>
            <button type="button" onClick={push.onDismiss} className="min-h-0 cursor-pointer border-0 bg-transparent p-0 font-sans text-[12px] text-muted-foreground">Not now</button>
          </span>
        </div>
      )}
      {empty ? (
        <div className="flex flex-col items-center gap-2 rounded-card border border-border bg-card px-5 py-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-raised text-link"><BellIcon /></span>
          <b className="text-[17px]">You’re all caught up</b>
          <p className="m-0 max-w-[280px] text-[15px] leading-[21px] text-muted-foreground">When someone asks you to play, or a setlist you’re on changes, it shows up here.</p>
        </div>
      ) : (
        <>
          {data.needs.length > 0 && (
            <>
              <Label>Needs you</Label>
              <Group>{data.needs.map(it => <Item key={it.id} it={it} now={now} onAnswer={onAnswer} onApprove={onApprove} onDecline={onDecline} onOpen={onOpen} />)}</Group>
            </>
          )}
          {data.groups.map(g => (
            <div key={g.label} className="contents">
              <Label>{g.label}</Label>
              <Group>{(compact ? g.items.slice(0, 6) : g.items).map(it => <Item key={it.id} it={it} now={now} onOpen={onOpen} />)}</Group>
            </div>
          ))}
        </>
      )}
      {onSettings && (
        <button type="button" onClick={onSettings} className="mt-3 min-h-0 cursor-pointer self-center border-0 bg-transparent p-1 font-sans text-[14px] font-medium text-link">Notification settings</button>
      )}
    </div>
  );
}
