import { useEffect, useMemo, useState } from 'react';
import { TemplatesList, TemplateEditor, TemplateView } from '@/features/setlist/TemplateEditor';
import { templatesOf, blankTemplate } from '@/lib/newSetlist';
import { useAuth } from '@/auth/useAuth';
import { useTeam } from '@/auth/useTeam';
import { usePushSubscription } from '@/push/usePushSubscription';
import { REMINDER_OPTIONS, normalizeReminders } from '@/lib/reminderOffsets';
import { BILLING_ENABLED, startTeamCheckout, openBillingPortal, billingError } from '@/lib/billingCheckout';
import { normalize } from '@/data/instruments';
import { clearAll } from '@/storage';
import { useConfirm } from '@/ui/useConfirmHook';
import AvatarUploader from '@/ui/AvatarUploader';
import WhatsNewPanel from './WhatsNewPanel';
import {
  SettingsHubView, ProfileView, PasswordSheet, DeleteAccountSheet, DateTimeView,
  NotificationsSettingsView, PlanView, DataView, DeletedSongsView, LabsView, SettingsShell,
} from './SettingsViews';

// Settings (owner, 2026-10-25). The pages are pure views in SettingsViews;
// this file feeds them. `panel` lives in App so Back walks the pages.

const REMINDERS = REMINDER_OPTIONS.map(o => ({ value: o.value, long: o.value === 0 ? 'When it starts' : o.label }));

// Labs is hidden until it is unlocked (tap the version on the You page 7
// times, 2026-11-14). Only one thing left to try: the over-scheduling warning
// had no reader in the rebuilt band picker and the paste-into-chart editor
// was redone, so both switches went.
const LAB_FLAGS = [
  { id: 'moveBetweenChurches', label: 'Move or copy songs to another church', sub: 'Only for songs you have the right to share. Off by default.' },
];

const PLAN_NAMES = { free: 'Free', sync: 'Sync', team: 'Band', church: 'Church' };
const STATUS = { active: 'Active', trialing: 'Trial', past_due: 'Past due', unpaid: 'Unpaid', canceled: 'Cancelled' };
const DAY_MS = 86400000;

// 'appearance' is the old name of 'datetime', kept so a stored history entry still lands.
const SETTINGS_PAGES = ['hub', 'profile', 'datetime', 'appearance', 'notifications', 'plan', 'services', 'data', 'deleted', 'labs', 'whatsnew'];

export default function SettingsPage({
  panel = 'hub', onChangePanel, onBack, settings, onUpdate,
  isSignedIn, displayName, displayEmail, onLogIn,
  activeLibrary, setlists = [], songs = [], trash = [],
  onSaveTemplate, onDeleteTemplate, onDownloadBackup, onRestoreSong, onPurgeSong, onEmptyTrash,
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

  // Services are templates now (2026-11-04): each service the church runs,
  // saved or still only a name on its setlists.
  const templates = useMemo(() => templatesOf(setlists), [setlists]);
  const [tplView, setTplView] = useState(null);
  const [tplEdit, setTplEdit] = useState(null);

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
  const [partsBusy, setPartsBusy] = useState(false);
  const [partsError, setPartsError] = useState('');
  // Any number of instruments and sung parts (owner, 2026-11-04).
  const saveParts = async (next) => {
    setPartsBusy(true);
    setPartsError('');
    try {
      await updateMyInstruments(next);
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
            parts={tokens} onParts={saveParts}
            partsBusy={partsBusy} partsError={partsError}
            onChangePassword={isSignedIn ? () => { setPwError(''); setPwOpen(true); } : undefined}
            onDeleteAccount={isSignedIn ? () => { setDelError(''); setDelOpen(true); } : undefined}
            onBack={toHub}
          />
          <PasswordSheet open={pwOpen} onOpenChange={setPwOpen} onSave={savePassword} busy={pwBusy} error={pwError} />
          <DeleteAccountSheet open={delOpen} onOpenChange={setDelOpen} onDelete={doDelete} busy={delBusy} error={delError} />
        </>
      );
    case 'datetime':
    case 'appearance':
      return (
        <DateTimeView
          firstDay={settings?.firstDayOfWeek || 'sunday'} onFirstDay={(v) => set('firstDayOfWeek', v)}
          clock={settings?.clockFormat || '12h'} onClock={(v) => set('clockFormat', v)}
          onBack={toHub}
        />
      );
    case 'notifications':
      return (
        <NotificationsSettingsView
          push={push} onPush={(on) => (on ? push.enable() : push.disable())}
          reminderOptions={REMINDERS}
          serviceReminders={normalizeReminders(settings?.serviceReminders)} onServiceReminders={(v) => set('serviceReminders', v)}
          rehearsalReminders={normalizeReminders(settings?.rehearsalReminders)} onRehearsalReminders={(v) => set('rehearsalReminders', v)}
          onBack={toHub}
        />
      );
    case 'plan':
      // Owner only (2026-11-14): the person who set the church up pays for it.
      if (!church || church.owner_id !== user?.id) return null;
      return (
        <PlanView
          church={church}
          plan={{ label: PLAN_NAMES[planKey] || planKey, status: STATUS[status] || 'Active', tone: billingOk ? null : 'bad', maxSeats: church.max_seats || null, usedSeats: members.length }}
          billingLive={BILLING_ENABLED}
          onSubscribe={!billingOk ? () => runBilling(() => startTeamCheckout(church.id, church.plan)) : undefined}
          onManage={() => runBilling(() => openBillingPortal(church.id))}
          busy={billBusy} error={billError}
          onBack={toHub}
        />
      );
    case 'services':
      if (!leader) return null;
      return (
        <SettingsShell title="Templates" onBack={toHub} backLabel="Settings">
          <TemplatesList templates={templates} onEdit={setTplView} onNew={() => setTplEdit(blankTemplate())} />
          {tplView && !tplEdit && (
            <TemplateView template={templates.find(t => t.id === tplView.id) || tplView} onClose={() => setTplView(null)}
              onEdit={onSaveTemplate ? () => setTplEdit(templates.find(t => t.id === tplView.id) || tplView) : undefined} />
          )}
          {tplEdit && (
            <TemplateEditor template={tplEdit} setlists={setlists} onCancel={() => setTplEdit(null)}
              onSave={(tpl, meta) => { onSaveTemplate?.(tpl, meta); setTplEdit(null); }}
              onDelete={templatesOf(setlists).some(t => t.id === tplEdit.id) && onDeleteTemplate ? () => { onDeleteTemplate(tplEdit.id); setTplEdit(null); setTplView(null); } : null} />
          )}
        </SettingsShell>
      );
    case 'data':
      if (church && !leader) return null;
      return (
        <DataView
          songCount={songs.length} setlistCount={setlists.filter(sl => !sl.isTemplate).length}
          deletedCount={trash.length}
          onBackup={onDownloadBackup} onDeleted={() => onChangePanel('deleted')}
          onBack={toHub}
        />
      );
    case 'deleted':
      if (church && !leader) return null;
      return (
        <DeletedSongsView
          trash={[...trash].sort((a, b) => b.deletedAt - a.deletedAt).map(({ song, deletedAt }) => ({
            id: song.id, title: song.title, artist: song.artist,
            daysLeft: Math.max(0, 30 - Math.floor((now - deletedAt) / DAY_MS)),
          }))}
          onRestore={onRestoreSong} onPurge={onPurgeSong}
          onEmptyTrash={async () => {
            const ok = await confirm({ title: 'Delete all for good?', description: 'These songs can’t be brought back.', confirmLabel: 'Delete all', variant: 'danger' });
            if (ok) onEmptyTrash?.();
          }}
          onBack={toHub}
        />
      );
    case 'labs':
      if (!settings?.labsUnlocked) return null;
      return (
        <LabsView
          flags={LAB_FLAGS.map(f => ({ ...f, on: !!settings?.[f.id] }))}
          onFlag={(id, on) => set(id, on)}
          onHide={() => { set('labsUnlocked', false); toHub(); }}
          onBack={toHub}
        />
      );
    case 'whatsnew':
      return (
        <SettingsShell title="What’s new" onBack={onBack}>
          <WhatsNewPanel settings={settings} onMarkSeen={(v) => set('lastChangelogVersion', v)} />
        </SettingsShell>
      );
    default:
      return (
        <SettingsHubView
          signedIn={isSignedIn}
          summary={{
            dateTime: (settings?.clockFormat || '12h') === '24h' ? '24-hour' : '12-hour',
            notifications: !push.supported ? null : push.subscribed ? 'On' : 'Off',
            services: templates.length ? String(templates.length) : null,
            data: `${songs.length} songs`,
          }}
          church={leader ? { name: church.name } : null}
          own={{ library: !church }}
          labs={!!settings?.labsUnlocked}
          onOpen={onChangePanel}
          onLogIn={onLogIn}
          onBack={onBack}
        />
      );
  }
}
