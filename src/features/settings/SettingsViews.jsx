import { useId, useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';
import { Toggle } from '@/ui/shadcn/toggle';
import { Alert } from '@/ui/shadcn/alert';
import { Sheet } from '@/ui/shadcn/sheet';
import { Avatar } from '@/app/AppTopBar';
import { PartsPicker } from '@/features/team/PartsPicker';
import {
  BackIcon, ChevronRightIcon, UserIcon, BellIcon, CalendarIcon, ClockIcon, CloseIcon, PlusIcon,
} from '@/app/navIcons';

// Settings (owner, 2026-10-25; reworked 2026-11-14): this device, the
// church's setup (leaders only) and Labs once unlocked. Every row opens a page
// of its own. Profile, Team, Subscription, theme, help and legal live on the
// You page; chart settings live in the reader's Aa, never here. Pure views:
// the container (SettingsPage.jsx) owns the data.

// ── Pieces ──────────────────────────────────────────────────────────────────

export const Group = ({ children, className }) => (
  <div className={cn('overflow-hidden rounded-card border border-border bg-card', className)}>{children}</div>
);
export const GroupLabel = ({ children }) => (
  <div className="px-1 pb-2 pt-6 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground first:pt-2">{children}</div>
);
const Note = ({ children }) => <p className="m-0 px-1 pt-2 text-[13px] leading-[18px] text-muted-foreground">{children}</p>;

const rowBase = 'flex min-h-[56px] w-full items-center gap-3.5 border-0 border-t border-border bg-transparent px-4 py-2.5 text-left font-sans text-foreground first:border-t-0';

/** A row that opens a page. */
export function NavRow({ icon, label, detail, badge, onClick, danger = false }) {
  return (
    <button type="button" onClick={onClick} className={cn(rowBase, 'cursor-pointer outline-none hover:bg-raised focus-visible:bg-raised', danger && 'text-danger-text')}>
      {icon && <span className={danger ? 'text-danger-text' : 'text-muted-foreground'}>{icon}</span>}
      <span className="min-w-0 flex-1 truncate text-[16px] sm:text-[15px]">{label}</span>
      {detail && <span className="max-w-[45%] truncate text-[14px] text-muted-foreground">{detail}</span>}
      {badge && <span className="rounded-full bg-selected px-2 py-0.5 text-[12px] font-semibold text-link">{badge}</span>}
      {!danger && <span className="text-input"><ChevronRightIcon /></span>}
    </button>
  );
}

/** A label (and a line under it) with its control on the right — or below on a phone when `stack`. */
export function Row({ label, sub, children, stack = false }) {
  return (
    <div className={cn(rowBase, stack && 'flex-col items-stretch gap-2.5 py-3.5')}>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[16px] sm:text-[15px]">{label}</span>
        {sub && <span className="text-[13px] leading-[18px] text-muted-foreground">{sub}</span>}
      </span>
      {children}
    </div>
  );
}

/** Two or three choices in one pill. */
export function Segmented({ value, options, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex shrink-0 gap-0.5 rounded-control bg-raised p-0.5">
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange?.(o.id)}
          className={cn(
            'h-[34px] min-h-0 cursor-pointer rounded-[7px] border-0 px-3 font-sans text-[14px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === o.id ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.15)]' : 'bg-transparent text-muted-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** On/off switch. */
export function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'relative h-[30px] w-[50px] min-h-0 shrink-0 cursor-pointer rounded-full border-0 p-0 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
        checked ? 'bg-link' : 'bg-input',
      )}
    >
      <span className={cn('absolute top-[3px] size-6 rounded-full bg-white shadow transition-[left]', checked ? 'left-[23px]' : 'left-[3px]')} />
    </button>
  );
}

/** Every settings page: ← and the title on one row, then the page. */
export function SettingsShell({ title, onBack, backLabel = 'Back', children, embedded = false }) {
  return (
    <div data-slot="settings-page" className={cn('bg-background font-sans text-foreground', embedded && 'absolute inset-0 overflow-y-auto')}>
      <div className="mx-auto flex w-full max-w-[600px] flex-col px-4 pb-12 sm:px-6 sm:pt-6">
        {/* Back is a small ← on the title row, everywhere (QA 2026-11-11). */}
        <div className="flex min-h-14 items-center gap-1 pb-2 pt-3" style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}>
          {onBack && <button type="button" onClick={onBack} aria-label={backLabel} title={backLabel} className="-ml-2.5 flex size-11 min-h-0 shrink-0 cursor-pointer items-center justify-center rounded-control border-0 bg-transparent text-muted-foreground outline-none hover:bg-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><BackIcon /></button>}
          <h1 className="m-0 min-w-0 text-[26px] font-semibold tracking-[-0.5px]">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Icons only Settings uses ────────────────────────────────────────────────

const Svg = ({ children, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const DownloadIcon = () => <Svg><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></Svg>;
const DataIcon = () => <Svg><ellipse cx="12" cy="5.5" rx="8" ry="3" /><path d="M4 5.5v13c0 1.66 3.6 3 8 3s8-1.34 8-3v-13M4 12c0 1.66 3.6 3 8 3s8-1.34 8-3" /></Svg>;
const LabsIcon = () => <Svg><path d="M9 3h6M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3" /><path d="M7.5 15h9" /></Svg>;
const TrashIcon = () => <Svg><path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></Svg>;

// ── The hub ─────────────────────────────────────────────────────────────────

/**
 * Settings (owner, 2026-11-14): what this device does, then the church's
 * own setup for its leaders, then Labs once it has been unlocked. Account
 * things (profile, team, subscription) live on the You page.
 * @param {{ name }} [church]   shown only to the church's leaders
 * @param {{ library?: boolean }} [own]  your own library (no church): its Data row
 * @param {boolean} [labs]      Labs unlocked on this device
 */
export function SettingsHubView({ signedIn = true, summary = {}, church, own, labs = false, onOpen, onLogIn, onBack, embedded }) {
  return (
    <SettingsShell title="Settings" onBack={onBack} embedded={embedded}>
      {!signedIn && (
        <Group className="mt-2"><NavRow icon={<UserIcon />} label="Log in or create an account" onClick={onLogIn} /></Group>
      )}

      <Group className="mt-2">
        <NavRow icon={<ClockIcon size={20} />} label="Date and time" detail={summary.dateTime} onClick={() => onOpen('datetime')} />
        <NavRow icon={<BellIcon />} label="Notifications" detail={summary.notifications} onClick={() => onOpen('notifications')} />
      </Group>

      {church && (
        <>
          <GroupLabel>{church.name} · leaders</GroupLabel>
          <Group>
            <NavRow icon={<CalendarIcon />} label="Templates" detail={summary.services} onClick={() => onOpen('services')} />
            <NavRow icon={<DataIcon />} label="Data" detail={summary.data} onClick={() => onOpen('data')} />
          </Group>
        </>
      )}
      {!church && own?.library && (
        <>
          <GroupLabel>Your library</GroupLabel>
          <Group><NavRow icon={<DataIcon />} label="Data" detail={summary.data} onClick={() => onOpen('data')} /></Group>
        </>
      )}

      {labs && (
        <>
          <GroupLabel>Labs</GroupLabel>
          <Group><NavRow icon={<LabsIcon />} label="Labs" detail="Try things early" onClick={() => onOpen('labs')} /></Group>
        </>
      )}
    </SettingsShell>
  );
}

// ── Profile ─────────────────────────────────────────────────────────────────

/**
 * @param {string[]} parts                   what you play and sing (tokens)
 * @param {(next: string[]) => void} onParts every tap saves the whole list
 * @param {React.ReactNode} [photo]          the uploader (needs Supabase)
 */
export function ProfileView({
  me, photo, nameDraft, onNameDraft, onSaveName, nameBusy = false, nameSaved = false,
  church, parts = [], onParts, partsBusy = false, partsError = '',
  onChangePassword, onDeleteAccount, onBack, embedded,
}) {
  const uid = useId();
  const dirty = (nameDraft || '').trim() !== (me?.name || '').trim();
  return (
    <SettingsShell title="Profile" onBack={onBack} embedded={embedded}>
      <div className="flex flex-col items-center gap-2 pb-2 pt-3">
        {photo || <Avatar name={me?.name} url={me?.url} size={88} />}
        {me?.email && <span className="text-[14px] text-muted-foreground">{me.email}</span>}
      </div>

      <GroupLabel>Your name</GroupLabel>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (dirty) onSaveName?.(); }}>
        <label htmlFor={`${uid}-name`} className="sr-only">Your name</label>
        <Input id={`${uid}-name`} autoComplete="name" maxLength={80} value={nameDraft} onChange={e => onNameDraft?.(e.target.value)} className="flex-1" />
        {(dirty || nameBusy) && <Button type="submit" loading={nameBusy} disabled={!nameDraft?.trim()}>Save</Button>}
      </form>
      {nameSaved && !dirty && <Note>Saved. Your church sees this name.</Note>}

      {church && (
        <>
          <GroupLabel>What you do at {church.name}</GroupLabel>
          <PartsPicker tokens={parts} onChange={onParts} busy={partsBusy} error={partsError} playLabel="You play" singLabel="You sing" />
          <Note>Pick all that apply. Charts open with the first instrument’s tabs.</Note>
        </>
      )}

      <GroupLabel>Account</GroupLabel>
      <Group>
        {onChangePassword && <NavRow icon={<KeyIcon />} label="Change password" onClick={onChangePassword} />}
      </Group>
      {onDeleteAccount && (
        <>
          <div className="h-6" />
          <Group><NavRow label="Delete account" danger onClick={onDeleteAccount} /></Group>
          <Note>Removes your account and everything only you can see. Church songs and setlists stay with the church.</Note>
        </>
      )}
    </SettingsShell>
  );
}
const KeyIcon = () => <Svg><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3M15 8l2 2" /></Svg>;

/** New password, twice. */
export function PasswordSheet({ open, onOpenChange, onSave, busy = false, error = '' }) {
  const uid = useId();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const short = a.length > 0 && a.length < 8;
  const mismatch = b.length > 0 && a !== b;
  const ok = a.length >= 8 && a === b;
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { setA(''); setB(''); } onOpenChange?.(o); }} title="Change password" className="h-auto sm:max-w-[440px]">
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (ok) onSave?.(a); }}>
        <label htmlFor={`${uid}-a`} className="text-[14px] font-medium">New password</label>
        <Input id={`${uid}-a`} type="password" autoComplete="new-password" value={a} onChange={e => setA(e.target.value)} />
        <label htmlFor={`${uid}-b`} className="text-[14px] font-medium">Type it again</label>
        <Input id={`${uid}-b`} type="password" autoComplete="new-password" value={b} onChange={e => setB(e.target.value)} />
        {(short || mismatch || error) && (
          <Alert variant="danger">{error || (short ? 'At least 8 characters.' : 'The two don’t match.')}</Alert>
        )}
        <Button type="submit" className="mt-1" disabled={!ok} loading={busy}>Save password</Button>
      </form>
    </Sheet>
  );
}

/** Type DELETE to go on. */
export function DeleteAccountSheet({ open, onOpenChange, onDelete, busy = false, error = '' }) {
  const uid = useId();
  const [word, setWord] = useState('');
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) setWord(''); onOpenChange?.(o); }} title="Delete your account?" className="h-auto sm:max-w-[440px]">
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[15px] leading-[22px] text-muted-foreground">
          This can’t be undone. Your login, profile, private notes and anything only you can see are removed. Songs and setlists in your church stay with the church.
        </p>
        <label htmlFor={`${uid}-w`} className="text-[14px] font-medium">Type DELETE to confirm</label>
        <Input id={`${uid}-w`} autoComplete="off" autoCapitalize="characters" value={word} onChange={e => setWord(e.target.value)} />
        {error && <Alert variant="danger">{error}</Alert>}
        <Button variant="destructive" className="mt-1" disabled={word.trim() !== 'DELETE'} loading={busy} onClick={onDelete}>Delete my account</Button>
      </div>
    </Sheet>
  );
}

// ── This device ─────────────────────────────────────────────────────────────

export function DateTimeView({ firstDay = 'sunday', onFirstDay, clock = '12h', onClock, onBack, embedded }) {
  return (
    <SettingsShell title="Date and time" onBack={onBack} backLabel="Settings" embedded={embedded}>
      <Group className="mt-2">
        <Row label="Time">
          <Segmented label="Time" value={clock} options={[{ id: '12h', label: '12-hour' }, { id: '24h', label: '24-hour' }]} onChange={onClock} />
        </Row>
        <Row label="Week starts on">
          <Segmented label="Week starts on" value={firstDay} options={[{ id: 'sunday', label: 'Sunday' }, { id: 'monday', label: 'Monday' }]} onChange={onFirstDay} />
        </Row>
      </Group>
      <Note>Used on the schedule, setlists and reminders.</Note>
    </SettingsShell>
  );
}

/**
 * @param {{ supported, subscribed, denied, busy }} push  this device
 * @param {Array<{value,label}>} reminderOptions  in time order, nearest first
 */
export function NotificationsSettingsView({ push = {}, onPush, reminderOptions = [], serviceReminders = [], onServiceReminders, rehearsalReminders = [], onRehearsalReminders, onBack, embedded }) {
  const [adding, setAdding] = useState(null); // 'service' | 'rehearsal'
  const status = !push.supported ? 'Not available here'
    : push.denied ? 'Blocked in your phone’s settings'
      : null;
  const lists = {
    service: { title: 'Before a service', value: serviceReminders, onChange: onServiceReminders },
    rehearsal: { title: 'Before a rehearsal', value: rehearsalReminders, onChange: onRehearsalReminders },
  };
  const open = adding ? lists[adding] : null;
  const left = open ? reminderOptions.filter(o => !open.value.includes(o.value)) : [];
  return (
    <SettingsShell title="Notifications" onBack={onBack} backLabel="Settings" embedded={embedded}>
      <Group className="mt-2">
        <Row label="Notifications on this device" sub={status || 'Asked to play, setlist ready, reminders'}>
          {push.supported && !push.denied && (
            <Switch label="Notifications on this device" checked={!!push.subscribed} onChange={(on) => !push.busy && onPush?.(on)} />
          )}
        </Row>
      </Group>
      {!push.supported && <Note>On an iPhone or iPad, put the app on your home screen first (Share → Add to Home Screen), open it from there, then come back here.</Note>}
      {push.supported && push.denied && <Note>Turn notifications back on for this app in your phone’s settings, then come back.</Note>}

      {['service', 'rehearsal'].map(kind => (
        <ReminderList key={kind} title={lists[kind].title} value={lists[kind].value} options={reminderOptions}
          onRemove={(v) => lists[kind].onChange?.(lists[kind].value.filter(x => x !== v))}
          onAdd={() => setAdding(kind)} />
      ))}
      <Note>These apply to every setlist you’re on.</Note>

      <Sheet open={!!open} onOpenChange={(o) => { if (!o) setAdding(null); }} title={open ? `Remind me ${open.title.toLowerCase()}` : ''} className="h-auto sm:max-w-[440px]">
        {open && (left.length ? (
          <Group>
            {left.map(o => (
              <button key={o.value} type="button" onClick={() => {
                const next = new Set([...open.value, o.value]);
                open.onChange?.(reminderOptions.map(x => x.value).filter(v => next.has(v)));
                setAdding(null);
              }} className={cn(rowBase, 'min-h-12 cursor-pointer text-[16px] outline-none hover:bg-raised focus-visible:bg-raised sm:text-[15px]')}>
                {o.long}
              </button>
            ))}
          </Group>
        ) : <p className="m-0 text-[15px] text-muted-foreground">You already have every time.</p>)}
      </Sheet>
    </SettingsShell>
  );
}

function ReminderList({ title, value = [], options, onRemove, onAdd }) {
  // Furthest ahead first: "1 day before" above "1 hour before".
  const picked = options.filter(o => value.includes(o.value)).reverse();
  return (
    <>
      <GroupLabel>{title}</GroupLabel>
      <Group>
        {picked.map(o => (
          <div key={o.value} className={cn(rowBase, 'min-h-12 py-1 pr-1.5')}>
            <span className="flex-1 text-[16px] sm:text-[15px]">{o.long}</span>
            <Button size="icon" variant="ghost" className="text-muted-foreground" aria-label={`Remove ${o.long}`} onClick={() => onRemove?.(o.value)}><CloseIcon size={18} /></Button>
          </div>
        ))}
        {picked.length < options.length && (
          <button type="button" onClick={onAdd} className={cn(rowBase, 'min-h-12 cursor-pointer text-link outline-none hover:bg-raised focus-visible:bg-raised')}>
            <PlusIcon size={18} />
            <span className="text-[16px] sm:text-[15px]">Add reminder</span>
          </button>
        )}
      </Group>
    </>
  );
}

// ── The church ──────────────────────────────────────────────────────────────

/**
 * Owner only (2026-11-14). Plans and prices live on the website.
 * @param {{ label, status, tone?, maxSeats?, usedSeats? }} plan
 */
export function PlanView({ church, plan, billingLive = false, onSubscribe, onManage, busy = false, error = '', onBack, embedded }) {
  const pct = plan?.maxSeats ? Math.min(100, Math.round((plan.usedSeats / plan.maxSeats) * 100)) : 0;
  return (
    <SettingsShell title="Subscription" onBack={onBack} embedded={embedded}>
      <Group className="mt-2 p-5">
        <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{church?.name}</div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <b className="text-[22px] font-semibold tracking-[-0.4px]">{plan?.label}</b>
          <span className={cn('rounded-full px-2.5 py-1 text-[12px] font-semibold', plan?.tone === 'bad' ? 'bg-danger-fill text-danger-text' : 'bg-selected text-link')}>{plan?.status}</span>
        </div>
        {plan?.maxSeats ? (
          <>
            <p className="m-0 pt-1 text-[14px] text-muted-foreground">{plan.usedSeats} of {plan.maxSeats} seats used</p>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuemin={0} aria-valuemax={plan.maxSeats} aria-valuenow={plan.usedSeats} aria-label="Seats used">
              <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-danger' : 'bg-link')} style={{ width: `${pct}%` }} />
            </div>
          </>
        ) : null}
      </Group>
      {billingLive ? (
        <div className="flex flex-col gap-2 pt-4">
          {onSubscribe && <Button loading={busy} onClick={onSubscribe}>Subscribe</Button>}
          <Button variant="outline" loading={busy && !onSubscribe} onClick={onManage}>Manage billing</Button>
          {error && <Alert variant="danger">{error}</Alert>}
        </div>
      ) : null}
      <Note>{billingLive ? '' : 'Billing isn’t switched on yet. Nothing to pay for now. '}Only you see this, because you set up {church?.name}. Plans and prices are on setlists.md.</Note>
    </SettingsShell>
  );
}

export function DataView({ songCount = 0, setlistCount = 0, deletedCount = 0, onBackup, onDeleted, onBack, embedded }) {
  return (
    <SettingsShell title="Data" onBack={onBack} backLabel="Settings" embedded={embedded}>
      <p className="m-0 pb-3 text-[15px] text-muted-foreground">{songCount} songs · {setlistCount} setlists</p>
      <Group className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3.5">
          <span className="pt-0.5 text-muted-foreground"><DownloadIcon /></span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[16px] sm:text-[15px]">Download a backup</span>
            <span className="text-[13px] leading-[18px] text-muted-foreground">Every song and setlist in one .zip. Songs are plain .md files you can open anywhere.</span>
          </span>
        </div>
        <Button variant="outline" onClick={onBackup}>Download backup</Button>
      </Group>

      <GroupLabel>Recently deleted</GroupLabel>
      <Group><NavRow icon={<TrashIcon />} label="Deleted songs" detail={String(deletedCount)} onClick={onDeleted} /></Group>
      <Note>Deleted songs wait 30 days, then they’re gone.</Note>
    </SettingsShell>
  );
}

/** @param {Array<{ id, title, artist?, daysLeft }>} trash  newest first */
export function DeletedSongsView({ trash = [], onRestore, onPurge, onEmptyTrash, onBack, embedded }) {
  return (
    <SettingsShell title="Deleted songs" onBack={onBack} backLabel="Data" embedded={embedded}>
      {trash.length === 0 ? (
        <Group className="mt-2 p-5 text-center text-[15px] text-muted-foreground">Nothing here. Deleted songs wait 30 days before they’re gone.</Group>
      ) : (
        <>
          <p className="m-0 pb-3 text-[15px] text-muted-foreground">{trash.length === 1 ? '1 song' : `${trash.length} songs`} · each one is gone for good 30 days after it was deleted.</p>
          <Group>
            {trash.map(t => (
              <div key={t.id} className={rowBase}>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[16px] font-medium sm:text-[15px]">{t.title || 'Untitled'}</span>
                  <span className="truncate text-[13px] text-muted-foreground">{[t.artist, t.daysLeft === 1 ? '1 day left' : `${t.daysLeft} days left`].filter(Boolean).join(' · ')}</span>
                </span>
                <Button size="sm" variant="outline" onClick={() => onRestore?.(t.id)}>Restore</Button>
                <Button size="icon" variant="ghost" className="text-danger-text" onClick={() => onPurge?.(t.id)} aria-label={`Delete ${t.title} for good`}><TrashIcon /></Button>
              </div>
            ))}
          </Group>
          <Button variant="link" className="mt-3 self-start text-[15px] text-danger-text" onClick={onEmptyTrash}>Delete all for good</Button>
        </>
      )}
    </SettingsShell>
  );
}

// ── Labs ────────────────────────────────────────────────────────────────────

/** @param {Array<{ id, label, sub, on }>} flags */
export function LabsView({ flags = [], onFlag, onHide, onBack, embedded }) {
  return (
    <SettingsShell title="Labs" onBack={onBack} backLabel="Settings" embedded={embedded}>
      <p className="m-0 pb-2 text-[15px] leading-[22px] text-muted-foreground">Things we’re still trying out. They may change or go away. Turn one off if it gets in the way.</p>
      {flags.length === 0 ? (
        <Group className="p-5 text-center text-[15px] text-muted-foreground">Nothing to try right now.</Group>
      ) : (
        <Group>
          {flags.map(f => (
            <Row key={f.id} label={f.label} sub={f.sub}><Switch label={f.label} checked={f.on} onChange={(on) => onFlag?.(f.id, on)} /></Row>
          ))}
        </Group>
      )}
      {onHide && <Button variant="link" className="mt-3 self-start text-[15px]" onClick={onHide}>Hide Labs again</Button>}
    </SettingsShell>
  );
}
