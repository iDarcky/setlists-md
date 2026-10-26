import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import { useTeam } from '@/auth/useTeam';
import { usePushSubscription } from '@/push/usePushSubscription';
import { REMINDER_OPTIONS, normalizeReminders } from '@/lib/reminderOffsets';
import { BILLING_ENABLED, startTeamCheckout, openBillingPortal, billingError } from '@/lib/billingCheckout';
import { INSTRUMENTS, VOCAL_PARTS, normalize } from '@/data/instruments';
import { clearAll } from '@/storage';
import { useConfirm } from '@/ui/useConfirmHook';
import AvatarUploader from '@/ui/AvatarUploader';
import WhatsNewPanel from './WhatsNewPanel';
import {
  SettingsHubView, ProfileView, PasswordSheet, DeleteAccountSheet, AppearanceView,
  NotificationsSettingsView, PlanView, ServicesView, DataView, LabsView, AboutView, SettingsShell,
} from './SettingsViews';

// Settings (owner, 2026-10-25). The pages are pure views in SettingsViews;
// this file feeds them. `panel` lives in App so Back walks the pages.

const SHORT_REMINDER = { 0: 'At start', 15: '15 min', 30: '30 min', 60: '1 hour', 120: '2 hours', 180: '3 hours', 720: '12 hours', 1440: '1 day', 2880: '2 days', 10080: '1 week' };
const REMINDER_CHIPS = REMINDER_OPTIONS.map(o => ({ value: o.value, label: SHORT_REMINDER[o.value] || o.label }));

// Only flags something in the new app still reads. The rest belonged to
// screens that have been rebuilt.
const LAB_FLAGS = [
  { id: 'rosterOverscheduleWarning', label: 'Warn before over-scheduling', sub: 'When picking the band, flag someone who has played several services in a row.' },
  { id: 'pasteIntoChart', label: 'Paste into the chart', sub: 'A paste lands in the section you aim at.' },
];

const PLAN_NAMES = { free: 'Free', sync: 'Sync', team: 'Band', church: 'Church' };
const STATUS = { active: 'Active', trialing: 'Trial', past_due: 'Past due', unpaid: 'Unpaid', canceled: 'Cancelled' };
const DAY_MS = 86400000;

const SETTINGS_PAGES = ['hub', 'profile', 'appearance', 'notifications', 'plan', 'services', 'data', 'labs', 'about', 'whatsnew'];

export default function SettingsPage({
  panel = 'hub', onChangePanel, onBack, settings, onUpdate,
  isSignedIn, displayName, displayEmail, onSignOut, onLogIn,
  activeLibrary, setlists = [], songs = [], trash = [],
  onRemapService, onDownloadSongs, onDownloadBackup, onRestoreSong, onPurgeSong, onEmptyTrash,
  onUpgrade, onShowLegal, onHelp,
}) {
  const { profile, user, updateProfile, updatePassword, deleteAccount, signOut } = useAuth();
  const { team, members = [], isAdmin, updateMyInstruments } = useTeam();
  const push = usePushSubscription();
  const confirm = useConfirm();
  const page = SETTINGS_PAGES.includes(panel) ? panel : 'hub';
  // Pages are pushed on the history stack, so Back walks them like the app's Back.
  const toHub = onBack;
  const set = (key, value) => onUpdate(prev => ({ ...prev, [key]: value }));

  const church = activeLibrary !== 'personal' && team && team.kind !== 'personal' ? team : null;
  const leader = !!church && (isAdmin || team?.owner_id === user?.id);
  const me = { name: displayName, email: isSignedIn ? displayEmail : null, url: profile?.avatar_url || null };

  const services = useMemo(() => {
    const counts = new Map();
    setlists.forEach(sl => { const s = (sl.service || '').trim(); if (s) counts.set(s, (counts.get(s) || 0) + 1); });
    return [...counts].sort((a, b) => a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }));
  }, [setlists]);

  const planKey = (church?.plan || 'free').toLowerCase();
  const status = (church?.subscription_status || 'active').toLowerCase();
  const billingOk = status === 'active' || status === 'trialing';

  // ── Profile state ──
  const savedName = profile?.display_name || settings?.userName || '';
  const [nameDraft, setNameDraft] = useState(savedName);
  const [nameBusy, setNameBusy] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  useEffect(() => { setNameDraft(savedName); }, [savedName]);
  const saveName = async () => {
    const name = nameDraft.trim();
    setNameBusy(true);
    try {
      onUpdate(prev => ({ ...prev, userName: name }));
      if (isSignedIn) await updateProfile?.({ display_name: name });
      setNameSaved(true);
    } finally { setNameBusy(false); }
  };

  const myMember = church && user ? members.find(m => m.user_id === user.id) : null;
  const tokens = useMemo(() => Array.from(new Set((myMember?.instruments || []).map(normalize).filter(Boolean))), [myMember?.instruments]);
  const instrument = tokens.find(t => !t.startsWith('vocals'))?.split(':')[0] || null;
  const vocal = tokens.find(t => t.startsWith('vocals:'))?.split(':')[1] || null;
  const [partsBusy, setPartsBusy] = useState(false);
  const [partsError, setPartsError] = useState('');
  // One instrument plus one sung part (owner, 2026-08-07): see Account.jsx history.
  const saveParts = async (nextInstrument, nextVocal) => {
    setPartsBusy(true);
    setPartsError('');
    try {
      await updateMyInstruments([nextInstrument, nextVocal ? `vocals:${nextVocal}` : null].filter(Boolean));
    } catch (err) {
      setPartsError(err?.message || 'Couldn’t save that. Try again.');
    } finally { setPartsBusy(false); }
  };

  const [pwOpen, setPwOpen] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');
  const savePassword = async (pw) => {
    setPwBusy(true);
    setPwError('');
    try {
      const { error } = await updatePassword(pw);
      if (error) throw error;
      setPwOpen(false);
    } catch (err) {
      setPwError(err?.message || 'Couldn’t change it. Try again.');
    } finally { setPwBusy(false); }
  };

  const [delOpen, setDelOpen] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState('');
  const doDelete = async () => {
    setDelBusy(true);
    setDelError('');
    try {
      await deleteAccount();
      // A different person signing in on this device must not inherit the library.
      try { await clearAll(); } catch { /* best-effort */ }
      try { localStorage.removeItem('setlists-md:last-email'); } catch { /* ignore */ }
      // The server session is already gone; no "Sign out?" question.
      try { await signOut?.(); } catch { /* ignore */ }
    } catch (err) {
      setDelError(err?.message || 'Couldn’t delete it. Email legal@setlists.md and we’ll do it for you.');
      setDelBusy(false);
    }
  };

  // ── Billing ──
  const [billBusy, setBillBusy] = useState(false);
  const [billError, setBillError] = useState('');
  const runBilling = async (fn) => {
    setBillBusy(true);
    setBillError('');
    try { await fn(); } catch (err) { setBillError(billingError(err)); } finally { setBillBusy(false); }
  };

  const [now] = useState(() => Date.now());

  switch (page) {
    case 'profile':
      return (
        <>
          <ProfileView
            me={me}
            photo={isSignedIn && user ? (
              <AvatarUploader url={profile?.avatar_url} fallback={(displayName || '?').slice(0, 1).toUpperCase()} pathPrefix={`users/${user.id}`}
                onChange={async (url) => { await updateProfile({ avatar_url: url }); }} size={88} />
            ) : null}
            nameDraft={nameDraft} onNameDraft={(v) => { setNameDraft(v); setNameSaved(false); }} onSaveName={saveName} nameBusy={nameBusy} nameSaved={nameSaved}
            church={church && myMember ? { name: church.name } : null}
            instruments={INSTRUMENTS} vocalParts={VOCAL_PARTS} instrument={instrument} vocal={vocal}
            onInstrument={(id) => saveParts(id, vocal)} onVocal={(id) => saveParts(instrument, id)}
            partsBusy={partsBusy} partsError={partsError}
            onChangePassword={isSignedIn ? () => { setPwError(''); setPwOpen(true); } : undefined}
            onSignOut={onSignOut}
            onDeleteAccount={isSignedIn ? () => { setDelError(''); setDelOpen(true); } : undefined}
            onBack={toHub}
          />
          <PasswordSheet open={pwOpen} onOpenChange={setPwOpen} onSave={savePassword} busy={pwBusy} error={pwError} />
          <DeleteAccountSheet open={delOpen} onOpenChange={setDelOpen} onDelete={doDelete} busy={delBusy} error={delError} />
        </>
      );
    case 'appearance':
      return (
        <AppearanceView
          theme={settings?.theme} onTheme={(v) => set('theme', v)}
          firstDay={settings?.firstDayOfWeek || 'sunday'} onFirstDay={(v) => set('firstDayOfWeek', v)}
          clock={settings?.clockFormat || '12h'} onClock={(v) => set('clockFormat', v)}
          onBack={toHub}
        />
      );
    case 'notifications':
      return (
        <NotificationsSettingsView
          push={push} onPush={(on) => (on ? push.enable() : push.disable())}
          reminderOptions={REMINDER_CHIPS}
          serviceReminders={normalizeReminders(settings?.serviceReminders)} onServiceReminders={(v) => set('serviceReminders', v)}
          rehearsalReminders={normalizeReminders(settings?.rehearsalReminders)} onRehearsalReminders={(v) => set('rehearsalReminders', v)}
          onBack={toHub}
        />
      );
    case 'plan':
      if (!leader) return null;
      return (
        <PlanView
          church={church}
          plan={{ label: PLAN_NAMES[planKey] || planKey, status: STATUS[status] || 'Active', tone: billingOk ? null : 'bad', seats: church.max_seats ? `Up to ${church.max_seats} people` : null }}
          isOwner={church.owner_id === user?.id} billingLive={BILLING_ENABLED}
          onSubscribe={!billingOk ? () => runBilling(() => startTeamCheckout(church.id, church.plan)) : undefined}
          onManage={() => runBilling(() => openBillingPortal(church.id))}
          onComparePlans={onUpgrade}
          busy={billBusy} error={billError}
          onBack={toHub}
        />
      );
    case 'services':
      if (!leader) return null;
      return (
        <ServicesView
          services={services}
          onRename={(from, to) => onRemapService?.(from, to)}
          onRemove={async (name, count) => {
            const ok = await confirm({
              title: `Remove “${name}”?`,
              description: `${count === 1 ? 'One setlist loses' : `${count} setlists lose`} this service. The setlists stay.`,
              confirmLabel: 'Remove',
              variant: 'danger',
            });
            if (ok) onRemapService?.(name, '');
          }}
          onBack={toHub}
        />
      );
    case 'data':
      if (church && !leader) return null;
      return (
        <DataView
          songCount={songs.length} setlistCount={setlists.length}
          onBackup={onDownloadBackup} onExport={onDownloadSongs}
          trash={[...trash].sort((a, b) => b.deletedAt - a.deletedAt).map(({ song, deletedAt }) => ({
            id: song.id, title: song.title, artist: song.artist,
            daysLeft: Math.max(0, 30 - Math.floor((now - deletedAt) / DAY_MS)),
          }))}
          onRestore={onRestoreSong} onPurge={onPurgeSong}
          onEmptyTrash={async () => {
            const ok = await confirm({ title: 'Empty recently deleted?', description: 'These songs are gone for good.', confirmLabel: 'Empty', variant: 'danger' });
            if (ok) onEmptyTrash?.();
          }}
          onBack={toHub}
        />
      );
    case 'labs':
      return (
        <LabsView
          flags={LAB_FLAGS.map(f => ({ ...f, on: !!settings?.[f.id] }))}
          onFlag={(id, on) => set(id, on)}
          onBack={toHub}
        />
      );
    case 'about':
      return <AboutView version={__APP_VERSION__} onWhatsNew={() => onChangePanel('whatsnew')} onHelp={onHelp} onLegal={onShowLegal} onBack={toHub} />;
    case 'whatsnew':
      return (
        <SettingsShell title="What’s new" onBack={onBack}>
          <WhatsNewPanel settings={settings} onMarkSeen={(v) => set('lastChangelogVersion', v)} />
        </SettingsShell>
      );
    default:
      return (
        <SettingsHubView
          me={me} signedIn={isSignedIn}
          summary={{
            appearance: ({ light: 'Light', dark: 'Dark', midnight: 'Dark', default: 'Auto' })[settings?.theme || 'dark'],
            notifications: !push.supported ? null : push.subscribed ? 'On' : 'Off',
            plan: PLAN_NAMES[planKey] || null,
            services: services.length ? String(services.length) : null,
            data: `${songs.length} songs`,
            version: `v${__APP_VERSION__}`,
          }}
          church={leader ? { name: church.name } : null}
          own={{ library: !church }}
          onOpen={onChangePanel}
          onLogIn={onLogIn}
          onBack={onBack}
        />
      );
  }
}
