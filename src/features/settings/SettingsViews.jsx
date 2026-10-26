import { useId, useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';
import { Toggle } from '@/ui/shadcn/toggle';
import { Alert } from '@/ui/shadcn/alert';
import { Sheet } from '@/ui/shadcn/sheet';
import { Avatar } from '@/app/AppTopBar';
import {
  BackIcon, ChevronRightIcon, UserIcon, MoonIcon, BellIcon, SparkIcon, HelpIcon,
  SignOutIcon, CalendarIcon, MusicIcon,
} from '@/app/navIcons';

// Settings, rebuilt (owner, 2026-10-25): four groups — Profile, this device,
// the church (admins only) and the app — and every row opens a page of its
// own. Chart settings live in the reader's Aa, never here. Pure views: the
// container (SettingsPage.jsx) owns the data.

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

/** Every settings page: Back, a title, then the page. */
export function SettingsShell({ title, onBack, backLabel = 'Back', children, embedded = false }) {
  return (
    <div data-slot="settings-page" className={cn('bg-background font-sans text-foreground', embedded && 'absolute inset-0 overflow-y-auto')}>
      <div className="mx-auto flex w-full max-w-[600px] flex-col px-4 pb-12 sm:px-6 sm:pt-6">
        <div className="flex h-14 items-center" style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="-ml-2 flex h-11 min-h-0 cursor-pointer items-center gap-1.5 rounded-control border-0 bg-transparent pl-2 pr-3 font-sans text-[15px] font-medium text-muted-foreground outline-none hover:bg-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <BackIcon />
              {backLabel}
            </button>
          )}
        </div>
        <h1 className="m-0 pb-2 pt-1 text-[26px] font-semibold tracking-[-0.5px]">{title}</h1>
        {children}
      </div>
    </div>
  );
}

// ── Icons only Settings uses ────────────────────────────────────────────────

const Svg = ({ children, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const CardIcon = () => <Svg><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6.5 15h4" /></Svg>;
const DataIcon = () => <Svg><ellipse cx="12" cy="5.5" rx="8" ry="3" /><path d="M4 5.5v13c0 1.66 3.6 3 8 3s8-1.34 8-3v-13M4 12c0 1.66 3.6 3 8 3s8-1.34 8-3" /></Svg>;
const LabsIcon = () => <Svg><path d="M9 3h6M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3" /><path d="M7.5 15h9" /></Svg>;
const TrashIcon = () => <Svg><path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></Svg>;

// ── The hub ─────────────────────────────────────────────────────────────────

/**
 * @param {{ name, email?, url? }} me
 * @param {{ name }} [church]   shown only to the church's admins
 * @param {{ library?: boolean }} [own]  your own library (no church): its Data row
 */
export function SettingsHubView({ signedIn = true, summary = {}, church, own, onOpen, onLogIn, onBack, embedded }) {
  return (
    <SettingsShell title="Settings" onBack={onBack} embedded={embedded}>
      {!signedIn && (
        <Group className="mt-2"><NavRow icon={<UserIcon />} label="Log in or create an account" onClick={onLogIn} /></Group>
      )}

      <GroupLabel>This device</GroupLabel>
      <Group>
        <NavRow icon={<MoonIcon />} label="Appearance" detail={summary.appearance} onClick={() => onOpen('appearance')} />
        <NavRow icon={<BellIcon />} label="Notifications" detail={summary.notifications} onClick={() => onOpen('notifications')} />
      </Group>

      {church && (
        <>
          <GroupLabel>{church.name}</GroupLabel>
          <Group>
            <NavRow icon={<CardIcon />} label="Plan and billing" detail={summary.plan} onClick={() => onOpen('plan')} />
            <NavRow icon={<CalendarIcon />} label="Services" detail={summary.services} onClick={() => onOpen('services')} />
            <NavRow icon={<DataIcon />} label="Data" detail={summary.data} onClick={() => onOpen('data')} />
          </Group>
          <Note>Only leaders see this.</Note>
        </>
      )}
      {!church && own?.library && (
        <>
          <GroupLabel>Your library</GroupLabel>
          <Group><NavRow icon={<DataIcon />} label="Data" detail={summary.data} onClick={() => onOpen('data')} /></Group>
        </>
      )}

      <GroupLabel>App</GroupLabel>
      <Group>
        <NavRow icon={<LabsIcon />} label="Labs" detail="Try things early" onClick={() => onOpen('labs')} />
      </Group>
    </SettingsShell>
  );
}

// ── Profile ─────────────────────────────────────────────────────────────────

/**
 * @param {Array<{id,label}>} instruments    any number may be picked
 * @param {Array<{id,label}>} vocalParts     "I sing" — one part, or none
 * @param {string[]} picked                  the instruments picked
 * @param {string|null} vocal                the sung part
 * @param {React.ReactNode} [photo]          the uploader (needs Supabase)
 */
export function ProfileView({
  me, photo, nameDraft, onNameDraft, onSaveName, nameBusy = false, nameSaved = false,
  church, instruments = [], vocalParts = [], picked = [], vocal = null, onInstrument, onVocal, partsBusy = false, partsError = '',
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
          <GroupLabel>What you play at {church.name}</GroupLabel>
          <div className="grid grid-cols-2 gap-2">
            {instruments.map(i => (
              <Toggle key={i.id} variant="option" disabled={partsBusy} pressed={picked.includes(i.id)} onPressedChange={() => onInstrument?.(i.id)}>
                {i.label}
              </Toggle>
            ))}
          </div>
          <Note>Pick all you play. Charts open with the first one’s tabs.</Note>
          <GroupLabel>Do you sing?</GroupLabel>
          <div className="grid grid-cols-2 gap-2">
            {vocalParts.map(p => (
              <Toggle key={p.id} variant="option" disabled={partsBusy} pressed={vocal === p.id} onPressedChange={() => onVocal?.(vocal === p.id ? null : p.id)}>
                {p.label}
              </Toggle>
            ))}
          </div>
          {partsError && <Alert variant="danger" className="mt-2">{partsError}</Alert>}
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

const THEMES = [{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }, { id: 'default', label: 'Auto' }];

export function AppearanceView({ theme, onTheme, firstDay = 'sunday', onFirstDay, clock = '12h', onClock, onBack, embedded }) {
  const current = theme === 'midnight' ? 'dark' : (theme || 'dark');
  return (
    <SettingsShell title="Appearance" onBack={onBack} backLabel="Settings" embedded={embedded}>
      <Group className="mt-2">
        <Row label="Theme" sub="Auto follows your phone."><Segmented label="Theme" value={current} options={THEMES} onChange={onTheme} /></Row>
        <Row label="Week starts on">
          <Segmented label="Week starts on" value={firstDay} options={[{ id: 'sunday', label: 'Sunday' }, { id: 'monday', label: 'Monday' }]} onChange={onFirstDay} />
        </Row>
        <Row label="Times">
          <Segmented label="Times" value={clock} options={[{ id: '12h', label: '9:30 AM' }, { id: '24h', label: '09:30' }]} onChange={onClock} />
        </Row>
      </Group>
    </SettingsShell>
  );
}

/**
 * @param {{ supported, subscribed, denied, busy }} push  this device
 * @param {Array<{value,label}>} reminderOptions
 */
export function NotificationsSettingsView({ push = {}, onPush, reminderOptions = [], serviceReminders = [], onServiceReminders, rehearsalReminders = [], onRehearsalReminders, onBack, embedded }) {
  const status = !push.supported ? 'Not available here'
    : push.denied ? 'Blocked in your phone’s settings'
      : push.subscribed ? 'On' : 'Off';
  return (
    <SettingsShell title="Notifications" onBack={onBack} backLabel="Settings" embedded={embedded}>
      <Group className="mt-2">
        <Row label="Lock-screen alerts" sub={`On this phone or computer · ${status}`}>
          {push.supported && !push.denied && (
            <Switch label="Lock-screen alerts" checked={!!push.subscribed} onChange={(on) => !push.busy && onPush?.(on)} />
          )}
        </Row>
      </Group>
      {!push.supported && <Note>On an iPhone or iPad, put the app on your home screen first (Share → Add to Home Screen), open it from there, then come back here.</Note>}
      {push.supported && push.denied && <Note>Turn notifications back on for this app in your phone’s settings, then come back.</Note>}
      {push.supported && !push.denied && <Note>You get one when you’re asked to play, when a setlist you’re on is ready, and before a service.</Note>}

      <GroupLabel>Remind me</GroupLabel>
      <Group>
        <ReminderRow label="Before a service" value={serviceReminders} options={reminderOptions} onChange={onServiceReminders} />
        <ReminderRow label="Before a rehearsal" value={rehearsalReminders} options={reminderOptions} onChange={onRehearsalReminders} />
      </Group>
      <Note>Tap to turn a time on or off. These apply to every setlist you’re on.</Note>
    </SettingsShell>
  );
}

function ReminderRow({ label, value = [], options, onChange }) {
  const on = new Set(value);
  return (
    <Row label={label} stack>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => (
          <Toggle key={o.value} pressed={on.has(o.value)} onPressedChange={() => {
            const next = new Set(on);
            if (next.has(o.value)) next.delete(o.value); else next.add(o.value);
            onChange?.(options.map(x => x.value).filter(v => next.has(v)));
          }}>
            {o.label}
          </Toggle>
        ))}
      </div>
    </Row>
  );
}

// ── The church (admins) ─────────────────────────────────────────────────────

/**
 * @param {{ label, status, tone?, seats? }} plan
 * @param {'subscribe'|'manage'|null} action  what the owner can do here
 */
export function PlanView({ church, plan, isOwner = false, billingLive = false, onSubscribe, onManage, onComparePlans, busy = false, error = '', onBack, embedded }) {
  return (
    <SettingsShell title="Plan and billing" onBack={onBack} backLabel="Settings" embedded={embedded}>
      <Group className="mt-2 p-5">
        <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{church?.name}</div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <b className="text-[22px] font-semibold tracking-[-0.4px]">{plan?.label}</b>
          <span className={cn('rounded-full px-2.5 py-1 text-[12px] font-semibold', plan?.tone === 'bad' ? 'bg-danger-fill text-danger-text' : 'bg-selected text-link')}>{plan?.status}</span>
        </div>
        {plan?.seats && <p className="m-0 pt-1 text-[14px] text-muted-foreground">{plan.seats}</p>}
      </Group>
      {isOwner && billingLive ? (
        <div className="flex flex-col gap-2 pt-4">
          {onSubscribe && <Button loading={busy} onClick={onSubscribe}>Subscribe</Button>}
          <Button variant="outline" loading={busy && !onSubscribe} onClick={onManage}>Manage billing</Button>
          {error && <Alert variant="danger">{error}</Alert>}
        </div>
      ) : (
        <Note>{isOwner ? 'Billing isn’t switched on yet. Nothing to pay for now.' : 'Only the person who set up the church can change the plan.'}</Note>
      )}
      {onComparePlans && <Button variant="link" className="mt-4 self-start text-[15px]" onClick={onComparePlans}>Compare plans</Button>}
    </SettingsShell>
  );
}

/** The kinds of service setlists belong to (Sunday Morning, Youth…). */
export function ServicesView({ services = [], onRename, onRemove, onBack, embedded }) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  return (
    <SettingsShell title="Services" onBack={onBack} backLabel="Settings" embedded={embedded}>
      <p className="m-0 pb-2 text-[15px] leading-[22px] text-muted-foreground">The kinds of service your setlists are for. Rename one and every setlist follows.</p>
      {services.length === 0 ? (
        <Group className="p-6 text-center text-[15px] text-muted-foreground">None yet. Pick a service on a setlist and it shows up here.</Group>
      ) : (
        <Group>
          {services.map(s => (
            editing === s.name ? (
              <form key={s.name} className={cn(rowBase, 'gap-2')} onSubmit={(e) => { e.preventDefault(); const v = draft.trim(); if (v && v !== s.name) onRename?.(s.name, v); setEditing(null); }}>
                <Input autoFocus value={draft} onChange={e => setDraft(e.target.value)} className="flex-1" aria-label="Service name" />
                <Button type="submit" size="sm" disabled={!draft.trim()}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              </form>
            ) : (
              <div key={s.name} className={cn(rowBase, 'gap-1 py-0 pr-1')}>
                <button type="button" onClick={() => { setEditing(s.name); setDraft(s.name); }} aria-label={`Rename ${s.name}`}
                  className="flex min-h-[56px] min-w-0 flex-1 cursor-pointer items-center gap-3.5 border-0 bg-transparent p-0 py-2.5 text-left font-sans text-foreground outline-none focus-visible:underline">
                  <span className="text-muted-foreground"><MusicIcon size={20} /></span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[16px] sm:text-[15px]">{s.name}</span>
                    <span className="text-[13px] text-muted-foreground">{s.count === 1 ? '1 setlist' : `${s.count} setlists`} · tap to rename</span>
                  </span>
                </button>
                <Button size="icon" variant="ghost" className="text-danger-text" onClick={() => onRemove?.(s.name, s.count)} aria-label={`Remove ${s.name}`}><TrashIcon /></Button>
              </div>
            )
          ))}
        </Group>
      )}
    </SettingsShell>
  );
}

/**
 * @param {Array<{ id, title, artist?, daysLeft }>} trash  newest first
 */
export function DataView({ songCount = 0, setlistCount = 0, onBackup, onExport, trash = [], onRestore, onPurge, onEmptyTrash, onBack, embedded }) {
  return (
    <SettingsShell title="Data" onBack={onBack} backLabel="Settings" embedded={embedded}>
      <p className="m-0 pb-2 text-[15px] text-muted-foreground">{songCount} songs · {setlistCount} setlists</p>
      <Group>
        <Row label="Back up everything" sub="One .zip with every song, arrangement and setlist."><Button size="sm" variant="outline" onClick={onBackup}>Download</Button></Row>
        <Row label="Export songs" sub="Every song as its own .md file."><Button size="sm" variant="outline" onClick={onExport}>Download</Button></Row>
      </Group>

      <GroupLabel>Recently deleted</GroupLabel>
      {trash.length === 0 ? (
        <Group className="p-5 text-center text-[15px] text-muted-foreground">Nothing here. Deleted songs wait 30 days before they’re gone.</Group>
      ) : (
        <>
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
          <Button variant="link" className="mt-3 self-start text-[15px] text-danger-text" onClick={onEmptyTrash}>Empty recently deleted</Button>
        </>
      )}
    </SettingsShell>
  );
}

// ── App ─────────────────────────────────────────────────────────────────────

/** @param {Array<{ id, label, sub, on }>} flags */
export function LabsView({ flags = [], onFlag, onBack, embedded }) {
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
    </SettingsShell>
  );
}

export function AboutView({ version, onWhatsNew, onHelp, onLegal, onBack, embedded }) {
  return (
    <SettingsShell title="About" onBack={onBack} embedded={embedded}>
      <Group className="mt-2 flex items-center gap-3.5 p-5">
        <img src="/setlists-md-mark.svg" alt="" aria-hidden="true" width="48" height="48" className="rounded-[12px]" />
        <span className="flex flex-col gap-0.5">
          <b className="text-[17px] font-semibold">Setlists.md</b>
          <span className="text-[14px] text-muted-foreground">Version {version}</span>
        </span>
      </Group>
      <Note>Chord charts and setlists for your church’s worship team. Your songs stay plain text you can open anywhere.</Note>
      <div className="h-4" />
      <Group>
        {onWhatsNew && <NavRow icon={<SparkIcon />} label="What’s new" onClick={onWhatsNew} />}
        {onHelp && <NavRow icon={<HelpIcon />} label="Help and feedback" onClick={onHelp} />}
      </Group>
      <GroupLabel>Legal</GroupLabel>
      <Group>
        <NavRow label="Privacy policy" onClick={() => onLegal?.('privacy')} />
        <NavRow label="Terms of service" onClick={() => onLegal?.('terms')} />
        <NavRow label="Copyright and takedowns" onClick={() => onLegal?.('copyright')} />
      </Group>
    </SettingsShell>
  );
}
