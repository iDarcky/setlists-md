import { useState, useEffect, useRef } from 'react';
import { supabase } from '../auth/supabase';
import { useTeam } from '../auth/useTeam';
import { useAuth } from '../auth/useAuth';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import UpgradeGate from './ui/UpgradeGate';
import ActivityFeed from './team/ActivityFeed';
import AvatarUploader from './ui/AvatarUploader';
import { useConfirm } from './ui/useConfirmHook';
import { BILLING_ENABLED, WORKSPACE_CREATION_LOCKED, startTeamCheckout } from '../billing/checkout';

const TeamIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const CrownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2 20h20l-2-8-5 4-3-6-3 6-5-4-2 8z" />
    <path d="M5 21h14v1H5z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const LocationIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

// ── Create Team form ────────────────────────────────────────────────────────

function CreateTeamForm({ onCreate, onCancel, multiple = false, defaultPlan = 'team', billingLive = false }) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [plan, setPlan] = useState(defaultPlan === 'church' ? 'church' : 'team');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), location: location.trim() || null, plan });
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

          <Button type="submit" variant="brand" size="lg" className="w-full" disabled={busy || !name.trim()}>
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

const MEMBER_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'leader', label: 'Leader' },
  { value: 'editor', label: 'Editor' },
  { value: 'member', label: 'Member' },
];

function MemberRow({ member, isCurrentUser, isAdmin, onRemove, onRoleChange }) {
  const confirm = useConfirm();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const isOwner = member.role === 'admin';
  const profile = member.profile || {};
  const displayName = profile.display_name || profile.email?.split('@')[0] || member.user_id?.slice(0, 8);
  const initial = displayName?.slice(0, 2)?.toUpperCase() || '??';

  return (
    <div className="modes-card flex items-center gap-3 px-4 py-3">
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden text-label-14 font-bold"
        style={{
          background: isOwner ? 'var(--color-brand-soft)' : 'var(--ds-gray-200)',
          color: isOwner ? 'var(--color-brand)' : 'var(--ds-gray-700)',
        }}
      >
        {profile.avatar_url
          ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
          : initial}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-copy-14 font-medium text-[var(--modes-text)] truncate">
            {displayName}
          </span>
          {isCurrentUser && (
            <span className="text-label-11 text-[var(--modes-text-dim)]">(you)</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {isOwner ? (
            <span className="inline-flex items-center gap-1 text-label-11 font-semibold" style={{ color: 'var(--color-brand)' }}>
              <CrownIcon /> Admin
            </span>
          ) : (
            <span className="text-label-11 font-medium text-[var(--modes-text-muted)] capitalize">{member.role || 'Member'}</span>
          )}
          {profile.email && (
            <>
              <span className="text-label-11 text-[var(--modes-text-dim)]">•</span>
              <span className="text-label-11 text-[var(--modes-text-dim)] truncate">{profile.email}</span>
            </>
          )}
        </div>
        {Array.isArray(member.instruments) && member.instruments.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {member.instruments.map(inst => (
              <span key={inst} className="text-label-11 px-2 py-0.5 rounded-full bg-[var(--modes-surface-strong)] text-[var(--modes-text-muted)]">
                {inst}
              </span>
            ))}
          </div>
        )}
      </div>

      {isAdmin && !isCurrentUser && (
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Member options"
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-transparent border-none cursor-pointer text-[var(--modes-text-dim)] hover:text-[var(--modes-text)] hover:bg-[var(--modes-surface-strong)] transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-52 rounded-xl border border-[var(--modes-border)] bg-[var(--ds-background-100)] shadow-lg z-50 overflow-hidden py-1">
              <div className="px-3 pt-1.5 pb-1 text-label-11 uppercase tracking-wider text-[var(--modes-text-dim)] font-semibold">Change role</div>
              {MEMBER_ROLES.map(r => {
                const active = (member.role || 'member') === r.value;
                return (
                  <button
                    key={r.value}
                    onClick={() => { onRoleChange(member.id, r.value); setMenuOpen(false); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-left text-copy-14 text-[var(--modes-text)] hover:bg-[var(--modes-surface)] bg-transparent border-none cursor-pointer"
                  >
                    {r.label}
                    {active && <span className="text-[var(--color-brand)]">✓</span>}
                  </button>
                );
              })}
              <div className="border-t border-[var(--modes-border)] my-1" />
              <button
                onClick={async () => {
                  setMenuOpen(false);
                  const ok = await confirm({
                    title: `Remove ${displayName}?`,
                    description: 'They will lose access to this team’s library, schedule, and roster. This cannot be undone — they’d need to be invited again.',
                    confirmLabel: 'Remove member',
                    cancelLabel: 'Keep member',
                    variant: 'danger',
                  });
                  if (ok) onRemove(member.id);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-copy-14 text-[var(--ds-red-700)] hover:bg-[var(--ds-red-100)] bg-transparent border-none cursor-pointer"
              >
                <TrashIcon /> Remove from team
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InviteRow({ invite, isAdmin, onCancel }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl opacity-80"
      style={{ background: 'var(--modes-surface)', border: '1px dashed var(--modes-border)' }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-label-14 font-bold"
        style={{
          background: 'var(--ds-gray-200)',
          color: 'var(--ds-gray-600)',
        }}
      >
        @
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-copy-14 font-medium text-[var(--modes-text)] truncate">
            {invite.email}
          </span>
          <span className="text-label-11 text-[var(--ds-orange-700)] bg-[var(--ds-orange-200)] px-2 py-0.5 rounded-full">
            Pending
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-label-11 text-[var(--modes-text-dim)]">Tell them to sign up to join.</span>
        </div>
      </div>

      {isAdmin && (
        <button
          onClick={() => onCancel(invite.id)}
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-transparent border border-[var(--modes-border)] cursor-pointer text-[var(--modes-text-dim)] hover:text-[var(--ds-red-700)] hover:border-[var(--ds-red-400)] transition-colors"
          title="Cancel invite"
        >
          <TrashIcon />
        </button>
      )}
    </div>
  );
}

function InviteForm({ onInvite, seatsLeft }) {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('member');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      await onInvite(userId.trim(), role);
      setUserId('');
      setRole('member');
      setMessage({ kind: 'info', text: 'Member added successfully.' });
    } catch (err) {
      setMessage({ kind: 'error', text: err.message || 'Could not add member.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modes-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold">
          Invite member
        </span>
        <span className="text-label-11 text-[var(--modes-text-dim)]">
          {seatsLeft} seat{seatsLeft !== 1 ? 's' : ''} left
        </span>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="email"
          required
          value={userId}
          onChange={e => setUserId(e.target.value)}
          placeholder="Email address"
          className="flex-1"
        />
        <select
          value={role}
          onChange={e => setRole(e.target.value)}
          className="bg-[var(--ds-background-100)] border border-[var(--modes-border)] rounded-md px-3 text-copy-14 text-[var(--ds-gray-900)] outline-none cursor-pointer focus:border-[var(--color-brand)] transition-colors"
        >
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="member">Member</option>
        </select>
        <Button type="submit" variant="brand" size="md" disabled={busy || !userId.trim() || seatsLeft <= 0}>
          <PlusIcon />
          <span className="ml-1">{busy ? 'Adding…' : 'Add'}</span>
        </Button>
      </form>
      {message && (
        <div
          className={`text-copy-13 px-3 py-2 rounded-lg mt-2 ${
            message.kind === 'error'
              ? 'bg-[var(--ds-red-100)] text-[var(--ds-red-1000)]'
              : 'bg-[var(--ds-teal-100)] text-[var(--ds-teal-1000)]'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}

// ── Team Stats ──────────────────────────────────────────────────────────────

function TeamStats({ teamId, members = [] }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  // Empty = "All services"; otherwise the union of the picked services.
  const [selectedServices, setSelectedServices] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const { count: songCount } = await supabase
          .from('team_songs')
          .select('id', { count: 'exact', head: true })
          .eq('team_id', teamId);

        // NB: team_setlists has no top-level `date` column — the service date
        // lives inside the `content` jsonb. Selecting/ordering by `date` errors
        // out the whole query (which is why the count used to read 0). Order by
        // `updated_at` and pull the date out of `content` instead.
        const { data: setlists } = await supabase
          .from('team_setlists')
          .select('id, name, content, updated_at')
          .eq('team_id', teamId)
          .order('updated_at', { ascending: false });

        // Songs (for key spread + stale detection) and availability (readiness).
        const { data: songRows } = await supabase
          .from('team_songs')
          .select('id, title, content')
          .eq('team_id', teamId);
        const { data: availRows } = await supabase
          .from('team_availability')
          .select('user_id, date, status')
          .eq('team_id', teamId);

        // Sort by the service date carried inside content (newest first),
        // falling back to updated_at when a setlist has no date.
        const ordered = (setlists || []).slice().sort((a, b) => {
          const da = a.content?.date || a.updated_at || '';
          const db = b.content?.date || b.updated_at || '';
          return db.localeCompare(da);
        });

        const setlistCount = ordered.length;

        // Song play-counts, both overall ("all") and per service, so the team
        // can see which songs they lean on for each service.
        const songsByService = { all: {} };
        const servicesSet = new Set();
        let recentSongs = [];

        ordered.forEach((sl, index) => {
          const svc = sl.content?.service?.trim() || null;
          if (svc) {
            servicesSet.add(svc);
            songsByService[svc] = songsByService[svc] || {};
          }
          const items = sl.content?.items || [];
          items.forEach(item => {
            if (item.type !== 'break' && item.songTitle) {
              songsByService.all[item.songTitle] = (songsByService.all[item.songTitle] || 0) + 1;
              if (svc) songsByService[svc][item.songTitle] = (songsByService[svc][item.songTitle] || 0) + 1;
              if (index < 5 && !recentSongs.find(s => s.title === item.songTitle)) {
                recentSongs.push({ title: item.songTitle, date: sl.content?.date || null });
              }
            }
          });
        });

        // ── Upcoming services (next future-dated setlists) ──
        const todayStr = new Date().toISOString().slice(0, 10);
        const upcoming = ordered
          .filter(sl => (sl.content?.date || '') >= todayStr)
          .sort((a, b) => (a.content?.date || '').localeCompare(b.content?.date || ''))
          .slice(0, 3)
          .map(sl => ({
            id: sl.id,
            name: sl.name || sl.content?.name || 'Untitled',
            date: sl.content?.date || null,
            service: sl.content?.service || null,
            songCount: (sl.content?.items || []).filter(i => i.type !== 'break' && i.songId).length,
            content: sl.content,
          }));

        // ── Roster readiness for the very next service ──
        const next = upcoming[0] || null;
        let readiness = null;
        if (next?.date) {
          const avail = new Set((availRows || []).filter(a => a.date === next.date && a.status === 'available').map(a => a.user_id));
          readiness = { date: next.date, name: next.name, available: avail.size, total: members.length };
        }

        // ── Most-used keys across the library ──
        const keyCounts = {};
        (songRows || []).forEach(s => {
          const k = s.content?.key || s.content?.arrangements?.[0]?.key;
          if (k) keyCounts[k] = (keyCounts[k] || 0) + 1;
        });
        const topKeys = Object.entries(keyCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([key, count]) => ({ key, count }));

        // ── Stale songs (in the library, never used in a setlist) ──
        const usedTitles = new Set();
        ordered.forEach(sl => (sl.content?.items || []).forEach(it => { if (it.songTitle) usedTitles.add(it.songTitle); }));
        const stale = (songRows || [])
          .map(s => s.title || s.content?.title)
          .filter(t => t && !usedTitles.has(t));

        setStats({
          songCount: songCount || 0,
          setlistCount,
          songsByService,
          services: [...servicesSet].sort(),
          recentSongs: recentSongs.slice(0, 5),
          upcoming,
          readiness,
          topKeys,
          stale,
        });
      } catch (err) {
        console.error('Failed to load team stats', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [teamId, members.length]);

  if (loading) return <div className="text-copy-13 text-[var(--modes-text-dim)] py-4">Loading statistics…</div>;

  return (
    <div className="flex flex-col gap-6 mt-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="modes-card p-4">
          <div className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold mb-1">Songs</div>
          <div className="text-heading-24 text-[var(--modes-text)] m-0 leading-none">{stats?.songCount || 0}</div>
        </div>
        <div className="modes-card p-4">
          <div className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold mb-1">Setlists</div>
          <div className="text-heading-24 text-[var(--modes-text)] m-0 leading-none">{stats?.setlistCount || 0}</div>
        </div>
      </div>

      {/* Roster readiness for the next service */}
      {stats?.readiness && stats.readiness.total > 0 && (
        <div className="modes-card p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="min-w-0">
              <div className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold">Next service readiness</div>
              <div className="text-copy-14 font-medium text-[var(--modes-text)] truncate mt-0.5">{stats.readiness.name}</div>
            </div>
            <div className="text-heading-24 text-[var(--modes-text)] leading-none shrink-0">{stats.readiness.available}<span className="text-copy-14 text-[var(--modes-text-dim)]">/{stats.readiness.total}</span></div>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--modes-surface-strong)] overflow-hidden">
            <div className="h-full rounded-full bg-[var(--color-brand)]" style={{ width: `${Math.round((stats.readiness.available / stats.readiness.total) * 100)}%` }} />
          </div>
          <div className="text-label-12 text-[var(--modes-text-dim)] mt-1.5">{stats.readiness.available} available · {new Date(stats.readiness.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
        </div>
      )}

      {/* Upcoming services */}
      {stats?.upcoming?.length > 0 && (
        <div>
          <h3 className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold mb-3 px-1">Upcoming Services</h3>
          <div className="flex flex-col gap-2">
            {stats.upcoming.map(sl => (
              <div key={sl.id} className="modes-card flex items-center gap-3 px-4 py-3">
                <div className="flex flex-col items-center justify-center w-11 h-11 rounded-lg bg-[var(--modes-surface-strong)] shrink-0">
                  <span className="text-label-10 uppercase tracking-wider text-[var(--modes-text-dim)] leading-none">{sl.date ? new Date(sl.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short' }) : '—'}</span>
                  <span className="text-heading-18 leading-none mt-0.5 text-[var(--modes-text)]">{sl.date ? new Date(sl.date + 'T00:00:00').getDate() : '?'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-copy-14 font-medium text-[var(--modes-text)] truncate">{sl.name}</div>
                  <div className="text-label-12 text-[var(--modes-text-dim)] truncate">{sl.service ? `${sl.service} · ` : ''}{sl.songCount} song{sl.songCount !== 1 ? 's' : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(() => {
        const sbs = stats?.songsByService || { all: {} };
        const hasServices = (stats?.services?.length || 0) > 0;
        // Aggregate counts across the selected services (or "all" when none).
        const merged = {};
        if (selectedServices.length === 0) {
          Object.assign(merged, sbs.all || {});
        } else {
          selectedServices.forEach(svc => {
            Object.entries(sbs[svc] || {}).forEach(([title, c]) => {
              merged[title] = (merged[title] || 0) + c;
            });
          });
        }
        const ranked = Object.entries(merged).sort((a, b) => b[1] - a[1]).slice(0, 8);
        if (ranked.length === 0 && !hasServices) return null;
        const toggle = (svc) => setSelectedServices(prev => prev.includes(svc) ? prev.filter(s => s !== svc) : [...prev, svc]);
        return (
          <div>
            <div className="flex items-center justify-between gap-2 mb-3 px-1">
              <h3 className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold">Songs by Service</h3>
              {hasServices && <span className="text-label-11 text-[var(--modes-text-dim)]">Tap to combine services</span>}
            </div>
            {hasServices && (
              <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-3">
                <button
                  type="button"
                  onClick={() => setSelectedServices([])}
                  className={`shrink-0 px-3 h-8 rounded-lg border text-label-12 font-semibold transition-all cursor-pointer ${
                    selectedServices.length === 0
                      ? 'border-[var(--color-brand)] text-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                      : 'border-[var(--modes-border)] text-[var(--modes-text-muted)] bg-[var(--modes-surface)] hover:text-[var(--modes-text)]'
                  }`}
                >
                  All services
                </button>
                {stats.services.map(svc => {
                  const active = selectedServices.includes(svc);
                  return (
                    <button
                      key={svc}
                      type="button"
                      onClick={() => toggle(svc)}
                      className={`shrink-0 px-3 h-8 rounded-lg border text-label-12 font-semibold transition-all cursor-pointer ${
                        active
                          ? 'border-[var(--color-brand)] text-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                          : 'border-[var(--modes-border)] text-[var(--modes-text-muted)] bg-[var(--modes-surface)] hover:text-[var(--modes-text)]'
                      }`}
                    >
                      {active && '✓ '}{svc}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex flex-col gap-2">
              {ranked.length > 0 ? ranked.map(([title, count], i) => (
                <div key={i} className="modes-card flex items-center justify-between px-4 py-3">
                  <span className="text-copy-14 font-medium text-[var(--modes-text)] truncate">{title}</span>
                  <span className="text-label-12 text-[var(--modes-text-dim)]">{count} play{count !== 1 ? 's' : ''}</span>
                </div>
              )) : (
                <div className="modes-card px-4 py-6 text-center text-copy-13 text-[var(--modes-text-dim)]">No songs for the selected service{selectedServices.length === 1 ? '' : 's'} yet.</div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Most-used keys */}
      {stats?.topKeys?.length > 0 && (
        <div>
          <h3 className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold mb-3 px-1">Most-used Keys</h3>
          <div className="flex flex-wrap gap-2">
            {stats.topKeys.map(k => (
              <div key={k.key} className="modes-card flex items-center gap-2 px-3 py-2">
                <span className="text-copy-15 font-bold text-[var(--color-brand-text)] font-mono">{k.key}</span>
                <span className="text-label-12 text-[var(--modes-text-dim)]">{k.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stale / unused songs */}
      {stats?.stale?.length > 0 && (
        <div>
          <h3 className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold mb-3 px-1">
            Never Played <span className="text-[var(--modes-text-dim)] normal-case tracking-normal">({stats.stale.length})</span>
          </h3>
          <div className="modes-card px-4 py-3 flex flex-col gap-1.5">
            <p className="text-label-12 text-[var(--modes-text-dim)] m-0">In your library but not in any setlist — rotate them in or retire them.</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {stats.stale.slice(0, 12).map((t, i) => (
                <span key={i} className="text-label-12 px-2 py-0.5 rounded-full bg-[var(--modes-surface-strong)] text-[var(--modes-text-muted)] truncate max-w-[180px]">{t}</span>
              ))}
              {stats.stale.length > 12 && <span className="text-label-12 text-[var(--modes-text-dim)] self-center">+{stats.stale.length - 12} more</span>}
            </div>
          </div>
        </div>
      )}

      {stats?.recentSongs?.length > 0 && (
        <div>
          <h3 className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold mb-3 px-1">Recently Played</h3>
          <div className="flex flex-col gap-2">
            {stats.recentSongs.map((song, i) => (
              <div key={i} className="modes-card flex items-center justify-between px-4 py-3">
                <span className="text-copy-14 font-medium text-[var(--modes-text)] truncate">{song.title}</span>
                <span className="text-label-12 text-[var(--modes-text-dim)]">{song.date ? new Date(song.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Edit Team Form ──────────────────────────────────────────────────────────

function EditTeamForm({ team, onUpdate }) {
  const [name, setName] = useState(team.name || '');
  const [location, setLocation] = useState(team.location || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      await onUpdate({ name: name.trim(), location: location.trim() || null });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Could not update team.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="modes-card flex flex-col gap-4 p-4 mt-4">
      <h3 className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold mb-1">Team Settings</h3>
      <div className="flex flex-col gap-1.5">
        <span className="text-label-12 text-[var(--modes-text-muted)]">Logo</span>
        <AvatarUploader
          url={team.logo_url || null}
          fallback={(team.name || 'T').trim().charAt(0).toUpperCase()}
          pathPrefix={`teams/${team.id}`}
          shape="square"
          label="logo"
          onChange={async (logoUrl) => { await onUpdate({ logo_url: logoUrl }); }}
        />
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-label-12 text-[var(--modes-text-muted)]">Team Name</span>
        <Input type="text" required value={name} onChange={e => setName(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-label-12 text-[var(--modes-text-muted)]">Location (optional)</span>
        <Input type="text" value={location} onChange={e => setLocation(e.target.value)} />
      </label>
      {error && <div className="text-copy-13 text-[var(--ds-red-1000)] bg-[var(--ds-red-100)] px-3 py-2 rounded-lg">{error}</div>}
      {success && <div className="text-copy-13 text-[var(--ds-teal-1000)] bg-[var(--ds-teal-100)] px-3 py-2 rounded-lg">Team updated successfully.</div>}
      <Button type="submit" variant="brand" size="md" disabled={busy || !name.trim()}>
        {busy ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}

function TeamDashboard({ team, members, invites, isAdmin, currentUserId, onRemove, onRoleChange, onInvite, onCancelInvite, onLeave, onDelete, onUpdate, isDefaultSpace = false, onToggleDefaultSpace }) {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('members');
  const seatsLeft = (team.max_seats || 10) - members.length - (invites?.length || 0);

  return (
    <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
      <div className="max-w-[1320px] mx-auto flex flex-col gap-6">
        {/* Team header */}
        <div className="modes-card-strong p-6 pb-0 overflow-hidden">
          <div className="flex items-start gap-4 mb-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden"
              style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand)' }}
            >
              {team.logo_url ? (
                <img src={team.logo_url} alt={`${team.name || 'Team'} logo`} className="w-full h-full object-cover" />
              ) : (
                <TeamIcon />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-heading-24 text-[var(--modes-text)] m-0 mb-0.5 truncate">{team.name}</h2>
              {team.location && (
                <div className="flex items-center gap-1.5 text-copy-14 text-[var(--modes-text-muted)]">
                  <LocationIcon />
                  <span>{team.location}</span>
                </div>
              )}
              <div className="flex items-center gap-3 mt-2">
                <span className="text-label-11 uppercase tracking-wider font-semibold px-2.5 py-1 rounded-md" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand)' }}>
                  {team.plan === 'church' ? 'Church' : 'Teams'} Plan
                </span>
                <span className="text-label-12 text-[var(--modes-text-dim)]">
                  {members.length}/{team.max_seats} seats
                </span>
              </div>

              {/* Home Space — open straight into this Space on launch instead of
                  Personal. Handy for members who only use the app for this band/church. */}
              {onToggleDefaultSpace && (
                <button
                  type="button"
                  onClick={onToggleDefaultSpace}
                  className="mt-3 inline-flex items-center gap-1.5 text-label-12 font-medium cursor-pointer bg-transparent border-none p-0"
                  style={{ color: isDefaultSpace ? 'var(--color-brand)' : 'var(--ds-gray-600)' }}
                  aria-pressed={isDefaultSpace}
                  title={isDefaultSpace ? 'This Space opens by default' : 'Open this Space by default'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={isDefaultSpace ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z" />
                  </svg>
                  {isDefaultSpace ? 'Opens here by default' : 'Make this my home Space'}
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-6 border-b border-[var(--modes-border)]">
            <button
              onClick={() => setActiveTab('members')}
              className={`pb-3 text-label-14 font-semibold border-b-2 transition-colors cursor-pointer bg-transparent px-1 ${
                activeTab === 'members'
                  ? 'border-[var(--color-brand)] text-[var(--modes-text)]'
                  : 'border-transparent text-[var(--modes-text-dim)] hover:text-[var(--modes-text)]'
              }`}
            >
              Members
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`pb-3 text-label-14 font-semibold border-b-2 transition-colors cursor-pointer bg-transparent px-1 ${
                activeTab === 'info'
                  ? 'border-[var(--color-brand)] text-[var(--modes-text)]'
                  : 'border-transparent text-[var(--modes-text-dim)] hover:text-[var(--modes-text)]'
              }`}
            >
              Info & Stats
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'members' && (
          <div className="flex flex-col gap-6">
            {isAdmin && (
              <InviteForm onInvite={onInvite} seatsLeft={seatsLeft} />
            )}
            <div>
              <h3 className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold mb-3 px-1">
                Members ({members.length})
              </h3>
              <div className="flex flex-col gap-2">
                {members.map(member => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    isCurrentUser={member.user_id === currentUserId}
                    isAdmin={isAdmin}
                    onRemove={onRemove}
                    onRoleChange={onRoleChange}
                  />
                ))}
                {invites?.map(invite => (
                  <InviteRow
                    key={invite.id}
                    invite={invite}
                    isAdmin={isAdmin}
                    onCancel={onCancelInvite}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'info' && (
          <div className="flex flex-col gap-6">
            <TeamStats teamId={team.id} members={members} />

            <div>
              <h3 className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold mb-3 px-1">Recent Activity</h3>
              <div className="modes-card p-2">
                <ActivityFeed teamId={team.id} members={members} />
              </div>
            </div>

            {isAdmin && (
              <EditTeamForm team={team} onUpdate={onUpdate} />
            )}

            <div className="modes-card p-4 mt-2">
              <h3 className="text-label-12 text-[var(--ds-red-700)] uppercase tracking-wider font-semibold mb-3">
                Danger zone
              </h3>
              <div className="flex flex-col sm:flex-row gap-2">
                {!isAdmin && (
                  <Button variant="secondary" size="sm" onClick={onLeave}>
                    Leave team
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Delete "${team.name}"?`,
                        description: 'All members will be removed and the team will be permanently deleted. This cannot be undone.',
                        confirmLabel: 'Delete team',
                        variant: 'danger',
                      });
                      if (ok) onDelete();
                    }}
                    className="text-[var(--ds-red-700)]"
                  >
                    Delete team
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function TeamScreen({ onBack, onUpgrade, onSwitchLibrary, initialCreate = false, onCreateHandled, defaultSpaceId = 'personal', onSetDefaultSpace }) {
  const { user } = useAuth();
  const { team, members, invites, isAdmin, loading, createTeam, inviteMember, removeMember, updateMemberRole, cancelInvite, leaveTeam, deleteTeam, hasTeamPlan, updateTeam } = useTeam();

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
  const canCreate = eligibleToCreate && !WORKSPACE_CREATION_LOCKED;
  const ownerTier = team?.owner_id === user?.id ? team?.plan : undefined;

  // Show the create form when explicitly creating, or when the user has no
  // team yet (the original first-run path).
  const showCreate = creating || !team;

  // First Space (no team) is onboarding and is NOT blocked by the lock; only
  // creating ADDITIONAL Spaces is gated by `canCreate`.
  const allowThisCreate = team ? canCreate : eligibleToCreate;

  const headerBack = creating && team ? () => setCreating(false) : onBack;
  const headerTitle = creating && team ? 'New Space' : 'Your Team';

  return (
    <div data-theme-variant="modes" className="flex flex-col h-full">
      {/* Modern header — matches the Setlists/Library shell (big title, blurred
          bar, modes hairline) rather than the legacy compact ScreenHeader. */}
      <header
        className="sticky top-0 z-20 backdrop-blur-md bg-[color-mix(in_srgb,var(--ds-background-100)_80%,transparent)] border-b border-[var(--modes-border)]"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="w-full max-w-[1320px] mx-auto px-5 sm:px-8 h-16 flex items-center gap-3">
          {headerBack && (
            <button
              type="button"
              onClick={headerBack}
              aria-label="Back"
              className="w-10 h-10 -ml-1 rounded-xl flex items-center justify-center text-[var(--modes-text)] hover:bg-[var(--modes-surface)] active:scale-95 transition-all cursor-pointer border-none bg-transparent shrink-0"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
          <h1 className="flex-1 min-w-0 text-heading-32 font-bold text-[var(--modes-text)] m-0 truncate">{headerTitle}</h1>
          {!creating && team && canCreate && (
            <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
              <span className="flex items-center gap-1.5"><PlusIcon /> New</span>
            </Button>
          )}
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-copy-14 text-[var(--modes-text-muted)]">Loading team…</div>
        </div>
      ) : showCreate ? (
        allowThisCreate ? (
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
        )
      ) : (
        <TeamDashboard
          team={team}
          members={members}
          invites={invites}
          isAdmin={isAdmin}
          currentUserId={user?.id}
          onRemove={removeMember}
          onRoleChange={updateMemberRole}
          onInvite={inviteMember}
          onCancelInvite={cancelInvite}
          onUpdate={updateTeam}
          onLeave={async () => {
            await leaveTeam();
            onBack?.();
          }}
          onDelete={async () => {
            await deleteTeam();
          }}
          isDefaultSpace={defaultSpaceId === team.id}
          onToggleDefaultSpace={onSetDefaultSpace
            ? () => onSetDefaultSpace(defaultSpaceId === team.id ? 'personal' : team.id)
            : undefined}
        />
      )}
    </div>
  );
}
