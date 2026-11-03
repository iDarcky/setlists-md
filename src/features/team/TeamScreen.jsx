import { useState, useEffect, useMemo } from 'react';
import { useTeam } from '@/auth/useTeam';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/ui/Button';
import { Button as ShadButton } from '@/ui/shadcn/button';
import { Input } from '@/ui/Input';
import UpgradeGate from '@/ui/UpgradeGate';
import PageHeader from '@/ui/PageHeader';
import { useConfirm } from '@/ui/useConfirmHook';
import { BILLING_ENABLED, startTeamCheckout } from '@/lib/billingCheckout';
import { canManageMembers, canPlanServices } from '@/lib/teamRoles';
import { joinUrl } from '@/lib/joinLink';
import { isSetlistUpcoming, setlistStartMs } from '@/lib/setlistTime';
import { songUsage } from '@/lib/songUsage';
import { getTeamJoinLink, resetTeamJoinLink, setTeamJoinLinkEnabled } from '@/features/join/joinApi';
import TeamPage, { InviteCard, UsageEntry, Waiting } from './TeamPage';
import { memberName } from '@/lib/teamPeople';
import { PersonSheet, ChurchSheet } from './TeamSheets';
import SongUsage from './SongUsage';

const TeamIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

// ── Create Team form ────────────────────────────────────────────────────────

// Full IANA zone list where the browser supports it; a small fallback otherwise.
const TIMEZONES = (() => {
  try { return Intl.supportedValuesOf('timeZone'); }
  catch { return ['UTC', 'Europe/Bucharest', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Australia/Sydney']; }
})();
const DEVICE_TZ = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
})();

function CreateTeamForm({ onCreate, onCancel, multiple = false, defaultPlan = 'team', billingLive = false }) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [plan, setPlan] = useState(defaultPlan === 'church' ? 'church' : 'team');
  const [timezone, setTimezone] = useState(DEVICE_TZ);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !timezone) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), location: location.trim() || null, plan, timezone });
    } catch (err) {
      setError(err.message || 'Could not create team.');
    } finally {
      setBusy(false);
    }
  };

  const TIERS = [
    { id: 'team', label: 'Team', price: '$12/mo', seats: '10 seats', blurb: 'For a worship band.' },
    { id: 'church', label: 'Church', price: '$24/mo', seats: '30 seats', blurb: 'For a whole church.' },
  ];

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="modes-card-strong w-full max-w-md p-8 flex flex-col gap-5">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand)' }}
        >
          <TeamIcon />
        </div>

        <div className="text-center">
          <h2 className="text-heading-24 text-[var(--modes-text)] m-0 mb-1">
            {multiple ? 'Create a new Space' : 'Create your Space'}
          </h2>
          <p className="text-copy-14 text-[var(--modes-text-muted)] m-0">
            {multiple
              ? 'Spin up another shared Space for a different band or church.'
              : 'Set up a shared Space for your worship band or church.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-label-12 text-[var(--modes-text-muted)] uppercase tracking-wider">Team name</span>
            <Input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Grace Church Worship"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-label-12 text-[var(--modes-text-muted)] uppercase tracking-wider">Location <span className="normal-case tracking-normal text-[var(--modes-text-dim)]">(optional)</span></span>
            <Input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Austin, TX"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-label-12 text-[var(--modes-text-muted)] uppercase tracking-wider">Timezone</span>
            <select
              required
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="h-11 px-3 rounded-lg bg-[var(--modes-surface-strong)] border border-[var(--modes-border)] text-copy-14 text-[var(--modes-text)]"
            >
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
            </select>
            <span className="text-label-11 text-[var(--modes-text-dim)] normal-case tracking-normal">Used to send service &amp; rehearsal reminders at the right local time.</span>
          </label>

          {/* Tier picker — sets seats/features (and the price at checkout). */}
          <div className="flex flex-col gap-1.5">
            <span className="text-label-12 text-[var(--modes-text-muted)] uppercase tracking-wider">Plan</span>
            <div className="grid grid-cols-2 gap-2">
              {TIERS.map(t => {
                const active = plan === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPlan(t.id)}
                    className="text-left rounded-xl p-3 border transition-all"
                    style={{
                      borderColor: active ? 'var(--color-brand)' : 'var(--modes-border)',
                      boxShadow: active ? '0 0 0 1px var(--color-brand)' : 'none',
                      background: active ? 'var(--color-brand-soft)' : 'var(--modes-surface)',
                    }}
                    aria-pressed={active}
                  >
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-copy-14 font-semibold text-[var(--modes-text)]">{t.label}</span>
                      {billingLive && <span className="text-label-11 font-bold text-[var(--color-brand)]">{t.price}</span>}
                    </div>
                    <div className="text-label-11 text-[var(--modes-text-muted)] mt-0.5">{t.seats}</div>
                    <div className="text-label-11 text-[var(--modes-text-dim)] mt-0.5">{t.blurb}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="text-copy-13 px-3 py-2 rounded-lg" style={{ background: 'var(--ds-red-100)', color: 'var(--ds-red-1000)' }}>
              {error}
            </div>
          )}

          <Button type="submit" variant="brand" size="lg" className="w-full" disabled={busy || !name.trim() || !timezone}>
            {busy ? (billingLive ? 'Starting checkout…' : 'Creating…') : (billingLive ? 'Continue to checkout' : 'Create Space')}
          </Button>
          {onCancel && (
            <Button type="button" variant="secondary" size="lg" className="w-full" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}

// ── Team Dashboard ──────────────────────────────────────────────────────────

// The role list comes from `lib/teamRoles.js` — the one place the model is
// written — so this picker can never offer a role the permission checks do not
// know about, or describe one differently from what it actually does.
// ── The Team page (redesign 2026-10-31) ─────────────────────────────────────

function TeamHome({ team, members, meId, myRole, isOwner, canManage, canManageJoinLink, joinRequests, onApproveJoin, onDeclineJoin, onApproveAllJoins,
  onRoleChange, onRemove, onUpdate, onLeave, onDelete, onBack, onCreate, isDefaultSpace, onToggleDefaultSpace,
  setlists = [], songs = [], schedules = [], setlistMap = {}, onOpenSong }) {
  const confirm = useConfirm();
  const [page, setPage] = useState('team');
  const [personId, setPersonId] = useState(null);
  const [churchOpen, setChurchOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [waitMsg, setWaitMsg] = useState(null);
  const [link, setLink] = useState(null);
  const [linkError, setLinkError] = useState(null);
  const [now] = useState(() => Date.now());

  const canSeeUsage = isOwner || canPlanServices(myRole);
  const nameOf = useMemo(() => {
    const byUser = new Map(members.map(m => [m.user_id, memberName(m)]));
    return (id) => byUser.get(id) || '';
  }, [members]);

  useEffect(() => {
    if (!canManageJoinLink) return undefined;
    let cancelled = false;
    getTeamJoinLink(team.id)
      .then(res => { if (!cancelled) { setLink(res); setLinkError(null); } })
      .catch(err => { if (!cancelled) setLinkError(err.message); });
    return () => { cancelled = true; };
  }, [team.id, canManageJoinLink]);

  const services = useMemo(() => [...new Set(setlists.map(s => s.service).filter(Boolean))].sort(), [setlists]);
  const usageSummary = useMemo(() => {
    if (!canSeeUsage) return '';
    const u = songUsage(setlists, songs, { range: '3m' });
    if (!u.songs.length) return 'Nothing played in the last 3 months';
    return `Most played lately: ${u.songs[0].title} · ${u.totals.songs} songs in 3 months`;
  }, [canSeeUsage, setlists, songs]);

  const person = members.find(m => m.id === personId) || null;
  const upcoming = useMemo(() => {
    if (!person) return [];
    const byRow = new Map(Object.entries(setlistMap || {}).map(([local, row]) => [row, local]));
    return (schedules || [])
      .filter(s => s.user_id === person.user_id)
      .map(s => {
        const localId = byRow.get(s.setlist_id) || s.setlist_id;
        const sl = setlists.find(x => x.id === localId);
        return sl && sl.date && isSetlistUpcoming(sl, now) ? { sl, s } : null;
      })
      .filter(Boolean)
      .sort((a, b) => setlistStartMs(a.sl) - setlistStartMs(b.sl))
      .slice(0, 5)
      .map(({ sl, s }) => ({
        id: s.id,
        label: new Date(`${sl.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
        name: sl.name || sl.service || 'Service',
        answer: s.availability || 'pending',
      }));
  }, [person, schedules, setlists, setlistMap, now]);

  const run = async (key, fn) => {
    setBusy(key);
    try { return await fn(); } finally { setBusy(null); }
  };

  const approve = (r) => run(r.id, async () => {
    setWaitMsg(null);
    try { await onApproveJoin(r.id); } catch (err) { setWaitMsg({ kind: 'error', text: err.message || 'Something went wrong.' }); }
  });
  const decline = async (r) => {
    const ok = await confirm({ title: `Say no to ${r.display_name || 'this request'}?`, description: 'They will see that the request was not approved. They can ask again tomorrow.', confirmLabel: 'Say no', variant: 'danger' });
    if (ok) run(r.id, async () => { try { await onDeclineJoin(r.id); } catch (err) { setWaitMsg({ kind: 'error', text: err.message }); } });
  };
  const approveAll = () => run('all', async () => {
    try {
      const res = await onApproveAllJoins();
      if (res?.at_capacity) setWaitMsg({ kind: 'error', text: `Let in ${res.approved}. The church is full: ${res.remaining} still waiting.` });
    } catch (err) { setWaitMsg({ kind: 'error', text: err.message }); }
  });

  const resetLink = async () => {
    const ok = await confirm({ title: 'Make a new link?', description: 'The old link stops working right away. People already waiting stay in the list.', confirmLabel: 'New link', cancelLabel: 'Keep link', variant: 'danger' });
    if (!ok) return;
    run('reset', async () => {
      try { setLink(await resetTeamJoinLink(team.id)); setLinkError(null); } catch (err) { setLinkError(err.message); }
    });
  };
  const toggleLink = (enabled) => run('toggle', async () => {
    try { setLink(await setTeamJoinLinkEnabled(team.id, enabled)); setLinkError(null); } catch (err) { setLinkError(err.message); }
  });

  const changeRole = (role) => run('role', () => onRoleChange(person.id, role));
  const remove = async () => {
    const name = memberName(person);
    const ok = await confirm({ title: `Remove ${name}?`, description: `They lose access to ${team.name}: songs, setlists and the band. They would have to ask to join again.`, confirmLabel: 'Remove', cancelLabel: 'Keep', variant: 'danger' });
    if (ok) { await run('remove', () => onRemove(person.id)); setPersonId(null); }
  };
  const leave = async () => {
    const ok = await confirm({ title: `Leave ${team.name}?`, description: 'You lose access to its songs and setlists. You can ask to join again with the link.', confirmLabel: 'Leave', variant: 'danger' });
    if (ok) { setPersonId(null); await onLeave(); }
  };
  const deleteChurch = async () => {
    const ok = await confirm({ title: `Delete "${team.name}"?`, description: 'Everyone is removed and the church, its songs and setlists are deleted. This cannot be undone.', confirmLabel: 'Delete', variant: 'danger' });
    if (ok) await onDelete();
  };

  if (page === 'usage' && canSeeUsage) {
    return <SongUsage setlists={setlists} songs={songs} nameOf={nameOf} onBack={() => setPage('team')} onOpenSong={onOpenSong} />;
  }

  const footer = (
    <div className="flex flex-col items-start gap-3 pt-4 text-[14px]">
      {onToggleDefaultSpace && (
        <ShadButton variant="link" onClick={onToggleDefaultSpace}>{isDefaultSpace ? 'Opens here when the app starts' : 'Open this church when the app starts'}</ShadButton>
      )}
      {onCreate && <ShadButton variant="link" onClick={onCreate}>Start another church or band</ShadButton>}
      {!isOwner && <ShadButton variant="link" className="text-danger" onClick={leave}>Leave {team.name}</ShadButton>}
      {isOwner && <ShadButton variant="link" className="text-danger" onClick={deleteChurch}>Delete this church</ShadButton>}
    </div>
  );

  return (
    <>
      <TeamPage
        team={team} members={members} meId={meId} isOwner={isOwner} services={services}
        onBack={onBack}
        onEditChurch={() => setChurchOpen(true)}
        onOpenPerson={(m) => setPersonId(m.id)}
        waiting={canManageJoinLink ? <Waiting requests={joinRequests} busy={busy} message={waitMsg} onApprove={approve} onDecline={decline} onApproveAll={approveAll} /> : null}
        usage={canSeeUsage ? <UsageEntry summary={usageSummary} onOpen={() => setPage('usage')} /> : null}
        invite={canManageJoinLink ? (
          <InviteCard teamName={team.name} url={link?.code ? joinUrl(window.location.origin, link.code) : ''} enabled={!!link?.enabled}
            loading={!link && !linkError} error={linkError} busy={busy} onToggle={toggleLink} onReset={resetLink} />
        ) : null}
        footer={footer}
      />
      <PersonSheet
        open={!!person} onOpenChange={(o) => { if (!o) setPersonId(null); }}
        member={person}
        isOwnerRow={!!person && person.user_id === team.owner_id}
        me={!!person && person.user_id === meId}
        since={person?.joined_at ? `In ${team.name} since ${new Date(person.joined_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}` : ''}
        upcoming={upcoming}
        canManage={canManage}
        canMakeAdmin={isOwner}
        busy={!!busy}
        onRole={changeRole}
        onRemove={remove}
        onLeave={leave}
      />
      {isOwner && (
        <ChurchSheet
          open={churchOpen} onOpenChange={setChurchOpen} team={team}
          missingColumns={!('address' in team)}
          onLogo={async (logoUrl) => { await onUpdate({ logo_url: logoUrl }); }}
          onSave={async (fields) => {
            const clean = 'address' in team ? fields : { name: fields.name, location: fields.location };
            await onUpdate(clean);
            setChurchOpen(false);
          }}
        />
      )}
    </>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function TeamScreen({ onBack, onUpgrade, onSwitchLibrary, initialCreate = false, onCreateHandled, defaultSpaceId = 'personal', onSetDefaultSpace, setlists, songs, schedules, setlistMap, onOpenSong }) {
  const { user } = useAuth();
  const { team, members, isAdmin, loading, createTeam, removeMember, updateMemberRole, leaveTeam, deleteTeam, hasTeamPlan, atWorkspaceLimit, updateTeam, canManageJoinLink, joinRequests, approveJoinRequest, declineJoinRequest, approveAllJoinRequests } = useTeam();

  // Whether the create form is showing. A user can belong to several
  // workspaces, so the form is reachable even when a team is already active
  // (via the header "New" action, or an `initialCreate` intent from the
  // workspace switcher).
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    if (initialCreate) {
      setCreating(true);
      onCreateHandled?.();
    }
    // Mount-only: the intent flag is consumed immediately so a later visit
    // (e.g. via "Manage teams") doesn't re-open the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateTeam = async (data) => {
    const newTeam = await createTeam(data);
    setCreating(false);
    // When billing is live, send the owner straight to checkout for the new
    // workspace (each workspace is its own subscription). Until then, just
    // switch into it. A failed/aborted checkout still leaves a usable
    // workspace — the webhook flips status to active once paid.
    if (newTeam && BILLING_ENABLED) {
      try {
        await startTeamCheckout(newTeam.id, newTeam.plan);
        return;
      } catch {
        /* fall through to switching into the (unpaid) workspace */
      }
    }
    if (newTeam && onSwitchLibrary) {
      onSwitchLibrary(newTeam.id);
    }
  };

  // Who may create a workspace. With Stripe billing live, creating *is*
  // subscribing — any signed-in user can start one (it routes to checkout and
  // is created unpaid until the webhook confirms payment). While billing is
  // dormant we keep the entitlement gate so team features aren't given away for
  // free.
  // Eligible to create additional Spaces — but creation may be temporarily
  // locked for testing (then we show a "contact support" note instead).
  const eligibleToCreate = BILLING_ENABLED || hasTeamPlan;
  const canCreate = eligibleToCreate && !atWorkspaceLimit;
  const ownerTier = team?.owner_id === user?.id ? team?.plan : undefined;

  // Show the create form when explicitly creating, or when the user has no
  // team yet (the original first-run path).
  const showCreate = creating || !team;

  // First Space (no team) is onboarding and is NOT blocked by the lock; only
  // creating ADDITIONAL Spaces is gated by `canCreate`.
  const allowThisCreate = team ? canCreate : eligibleToCreate;

  const inCreateSubmenu = creating && team;

  const myRole = members.find(m => m.user_id === user?.id)?.role || 'member';
  const isOwner = !!team && team.owner_id === user?.id;

  if (!loading && !showCreate) {
    return (
      <TeamHome
        team={team}
        members={members}
        meId={user?.id}
        myRole={myRole}
        isOwner={isOwner}
        canManage={isOwner || isAdmin || canManageMembers(myRole)}
        canManageJoinLink={!!canManageJoinLink}
        joinRequests={joinRequests || []}
        onApproveJoin={approveJoinRequest}
        onDeclineJoin={declineJoinRequest}
        onApproveAllJoins={approveAllJoinRequests}
        onRoleChange={updateMemberRole}
        onRemove={removeMember}
        onUpdate={updateTeam}
        onLeave={async () => { await leaveTeam(); onBack?.(); }}
        onDelete={async () => { await deleteTeam(); }}
        onBack={onBack}
        onCreate={canCreate ? () => setCreating(true) : null}
        isDefaultSpace={defaultSpaceId === team.id}
        onToggleDefaultSpace={onSetDefaultSpace
          ? () => onSetDefaultSpace(defaultSpaceId === team.id ? 'personal' : team.id)
          : undefined}
        setlists={setlists}
        songs={songs}
        schedules={schedules}
        setlistMap={setlistMap}
        onOpenSong={onOpenSong}
      />
    );
  }

  return (
    <div data-theme-variant="modes" className="flex flex-col h-full">
      <PageHeader
        title={inCreateSubmenu ? 'New Space' : 'Your Team'}
        onBack={inCreateSubmenu ? () => setCreating(false) : undefined}
        onClose={onBack}
      />

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-copy-14 text-[var(--modes-text-muted)]">Loading team…</div>
        </div>
      ) : allowThisCreate ? (
        <CreateTeamForm
          onCreate={handleCreateTeam}
          onCancel={team ? () => setCreating(false) : null}
          multiple={!!team}
          defaultPlan={ownerTier || 'team'}
          billingLive={BILLING_ENABLED}
        />
      ) : (
        <UpgradeGate feature="team-create" onUpgrade={onUpgrade}>
          {/* Never renders — UpgradeGate shows the prompt */}
          <div />
        </UpgradeGate>
      )}
    </div>
  );
}
