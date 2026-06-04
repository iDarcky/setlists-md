import { useState, useEffect } from 'react';
import { supabase } from '../auth/supabase';
import { useTeam } from '../auth/useTeam';
import { useAuth } from '../auth/useAuth';
import ScreenHeader from './ui/ScreenHeader';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import UpgradeGate from './ui/UpgradeGate';
import AvatarUploader from './ui/AvatarUploader';
import { useConfirm } from './ui/useConfirmHook';
import { BILLING_ENABLED, startTeamCheckout } from '../billing/checkout';

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

function CreateTeamForm({ onCreate, onCancel, multiple = false }) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), location: location.trim() || null });
    } catch (err) {
      setError(err.message || 'Could not create team.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <div
        className="w-full max-w-md rounded-2xl p-8 flex flex-col gap-5"
        style={{ background: 'var(--ds-background-100)', border: '1px solid var(--ds-gray-400)' }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand)' }}
        >
          <TeamIcon />
        </div>

        <div className="text-center">
          <h2 className="text-heading-24 text-[var(--ds-gray-1000)] m-0 mb-1">
            {multiple ? 'Create a new workspace' : 'Create your team'}
          </h2>
          <p className="text-copy-14 text-[var(--ds-gray-600)] m-0">
            {multiple
              ? 'Spin up another shared workspace for a different band or church.'
              : 'Set up a shared workspace for your worship band or church team.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-label-12 text-[var(--ds-gray-700)] uppercase tracking-wider">Team name</span>
            <Input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Grace Church Worship"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-label-12 text-[var(--ds-gray-700)] uppercase tracking-wider">Location <span className="normal-case tracking-normal text-[var(--ds-gray-500)]">(optional)</span></span>
            <Input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Austin, TX"
            />
          </label>

          {error && (
            <div className="text-copy-13 px-3 py-2 rounded-lg" style={{ background: 'var(--ds-red-100)', color: 'var(--ds-red-1000)' }}>
              {error}
            </div>
          )}

          <Button type="submit" variant="brand" size="lg" className="w-full" disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : (multiple ? 'Create workspace' : 'Create team')}
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

function MemberRow({ member, isCurrentUser, isAdmin, onRemove, onRoleChange }) {
  const isOwner = member.role === 'admin';
  const profile = member.profile || {};
  const displayName = profile.display_name || profile.email?.split('@')[0] || member.user_id?.slice(0, 8);
  const initial = displayName?.slice(0, 2)?.toUpperCase() || '??';

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ background: 'var(--ds-background-200)', border: '1px solid var(--ds-gray-300)' }}
    >
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
          <span className="text-copy-14 font-medium text-[var(--ds-gray-1000)] truncate">
            {displayName}
          </span>
          {isCurrentUser && (
            <span className="text-label-11 text-[var(--ds-gray-500)]">(you)</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {isOwner ? (
            <span className="inline-flex items-center gap-1 text-label-11 font-semibold" style={{ color: 'var(--color-brand)' }}>
              <CrownIcon /> Admin
            </span>
          ) : (
            <span className="text-label-11 font-medium text-[var(--ds-gray-600)] capitalize">{member.role || 'Member'}</span>
          )}
          {profile.email && (
            <>
              <span className="text-label-11 text-[var(--ds-gray-400)]">•</span>
              <span className="text-label-11 text-[var(--ds-gray-500)] truncate">{profile.email}</span>
            </>
          )}
        </div>
      </div>

      {isAdmin && !isCurrentUser && (
        <div className="flex items-center gap-3">
          <select
            value={member.role || 'member'}
            onChange={(e) => onRoleChange(member.id, e.target.value)}
            className="bg-[var(--ds-background-100)] border border-[var(--ds-gray-300)] rounded-md px-2 py-1 text-label-11 font-medium text-[var(--ds-gray-700)] outline-none cursor-pointer hover:border-[var(--ds-gray-400)] focus:border-[var(--color-brand)] transition-colors"
          >
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="member">Member</option>
          </select>
          <button
            onClick={() => onRemove(member.id)}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-transparent border border-[var(--ds-gray-300)] cursor-pointer text-[var(--ds-gray-500)] hover:text-[var(--ds-red-700)] hover:border-[var(--ds-red-400)] transition-colors"
            title="Remove member"
          >
            <TrashIcon />
          </button>
        </div>
      )}
    </div>
  );
}

function InviteRow({ invite, isAdmin, onCancel }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl opacity-80"
      style={{ background: 'var(--ds-background-200)', border: '1px dashed var(--ds-gray-400)' }}
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
          <span className="text-copy-14 font-medium text-[var(--ds-gray-900)] truncate">
            {invite.email}
          </span>
          <span className="text-label-11 text-[var(--ds-orange-700)] bg-[var(--ds-orange-200)] px-2 py-0.5 rounded-full">
            Pending
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-label-11 text-[var(--ds-gray-500)]">Tell them to sign up to join.</span>
        </div>
      </div>

      {isAdmin && (
        <button
          onClick={() => onCancel(invite.id)}
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-transparent border border-[var(--ds-gray-300)] cursor-pointer text-[var(--ds-gray-500)] hover:text-[var(--ds-red-700)] hover:border-[var(--ds-red-400)] transition-colors"
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
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--ds-background-200)', border: '1px solid var(--ds-gray-300)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-label-12 text-[var(--ds-gray-700)] uppercase tracking-wider font-semibold">
          Invite member
        </span>
        <span className="text-label-11 text-[var(--ds-gray-500)]">
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
          className="bg-[var(--ds-background-100)] border border-[var(--ds-gray-300)] rounded-md px-3 text-copy-14 text-[var(--ds-gray-900)] outline-none cursor-pointer focus:border-[var(--color-brand)] transition-colors"
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

function TeamStats({ teamId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { count: songCount } = await supabase
          .from('team_songs')
          .select('id', { count: 'exact', head: true })
          .eq('team_id', teamId);

        const { data: setlists } = await supabase
          .from('team_setlists')
          .select('id, name, date, content')
          .eq('team_id', teamId)
          .order('date', { ascending: false });

        const setlistCount = setlists?.length || 0;
        
        let songCounts = {};
        let recentSongs = [];
        
        if (setlists) {
          setlists.forEach((sl, index) => {
            const items = sl.content?.items || [];
            items.forEach(item => {
              if (item.type !== 'break' && item.songTitle) {
                songCounts[item.songTitle] = (songCounts[item.songTitle] || 0) + 1;
                if (index < 5 && !recentSongs.find(s => s.title === item.songTitle)) {
                  recentSongs.push({ title: item.songTitle, date: sl.date });
                }
              }
            });
          });
        }
        
        const popularSongs = Object.entries(songCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([title, count]) => ({ title, count }));

        setStats({
          songCount: songCount || 0,
          setlistCount,
          popularSongs,
          recentSongs: recentSongs.slice(0, 5)
        });
      } catch (err) {
        console.error('Failed to load team stats', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [teamId]);

  if (loading) return <div className="text-copy-13 text-[var(--ds-gray-500)] py-4">Loading statistics…</div>;

  return (
    <div className="flex flex-col gap-6 mt-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--ds-background-200)', border: '1px solid var(--ds-gray-300)' }}>
          <div className="text-label-12 text-[var(--ds-gray-600)] uppercase tracking-wider font-semibold mb-1">Songs</div>
          <div className="text-heading-24 text-[var(--ds-gray-1000)] m-0 leading-none">{stats?.songCount || 0}</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--ds-background-200)', border: '1px solid var(--ds-gray-300)' }}>
          <div className="text-label-12 text-[var(--ds-gray-600)] uppercase tracking-wider font-semibold mb-1">Setlists</div>
          <div className="text-heading-24 text-[var(--ds-gray-1000)] m-0 leading-none">{stats?.setlistCount || 0}</div>
        </div>
      </div>
      
      {stats?.popularSongs?.length > 0 && (
        <div>
          <h3 className="text-label-12 text-[var(--ds-gray-700)] uppercase tracking-wider font-semibold mb-3 px-1">Most Popular Songs</h3>
          <div className="flex flex-col gap-2">
            {stats.popularSongs.map((song, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: 'var(--ds-background-200)', border: '1px solid var(--ds-gray-300)' }}>
                <span className="text-copy-14 font-medium text-[var(--ds-gray-900)] truncate">{song.title}</span>
                <span className="text-label-12 text-[var(--ds-gray-500)]">{song.count} plays</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats?.recentSongs?.length > 0 && (
        <div>
          <h3 className="text-label-12 text-[var(--ds-gray-700)] uppercase tracking-wider font-semibold mb-3 px-1">Recently Played</h3>
          <div className="flex flex-col gap-2">
            {stats.recentSongs.map((song, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: 'var(--ds-background-200)', border: '1px solid var(--ds-gray-300)' }}>
                <span className="text-copy-14 font-medium text-[var(--ds-gray-900)] truncate">{song.title}</span>
                <span className="text-label-12 text-[var(--ds-gray-500)]">{new Date(song.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 rounded-xl mt-4" style={{ background: 'var(--ds-background-200)', border: '1px solid var(--ds-gray-300)' }}>
      <h3 className="text-label-12 text-[var(--ds-gray-700)] uppercase tracking-wider font-semibold mb-1">Team Settings</h3>
      <div className="flex flex-col gap-1.5">
        <span className="text-label-12 text-[var(--ds-gray-700)]">Logo</span>
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
        <span className="text-label-12 text-[var(--ds-gray-700)]">Team Name</span>
        <Input type="text" required value={name} onChange={e => setName(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-label-12 text-[var(--ds-gray-700)]">Location (optional)</span>
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

function TeamDashboard({ team, members, invites, isAdmin, currentUserId, onRemove, onRoleChange, onInvite, onCancelInvite, onLeave, onDelete, onUpdate }) {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('members');
  const seatsLeft = (team.max_seats || 10) - members.length - (invites?.length || 0);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        {/* Team header */}
        <div
          className="rounded-2xl p-6 pb-0 overflow-hidden"
          style={{ background: 'var(--ds-background-100)', border: '1px solid var(--ds-gray-400)' }}
        >
          <div className="flex items-start gap-4 mb-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand)' }}
            >
              <TeamIcon />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-heading-24 text-[var(--ds-gray-1000)] m-0 mb-0.5 truncate">{team.name}</h2>
              {team.location && (
                <div className="flex items-center gap-1.5 text-copy-14 text-[var(--ds-gray-600)]">
                  <LocationIcon />
                  <span>{team.location}</span>
                </div>
              )}
              <div className="flex items-center gap-3 mt-2">
                <span className="text-label-11 uppercase tracking-wider font-semibold px-2.5 py-1 rounded-md" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand)' }}>
                  {team.plan === 'church' ? 'Church' : 'Teams'} Plan
                </span>
                <span className="text-label-12 text-[var(--ds-gray-500)]">
                  {members.length}/{team.max_seats} seats
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-6 border-b border-[var(--ds-gray-300)]">
            <button
              onClick={() => setActiveTab('members')}
              className={`pb-3 text-label-14 font-semibold border-b-2 transition-colors cursor-pointer bg-transparent px-1 ${
                activeTab === 'members'
                  ? 'border-[var(--color-brand)] text-[var(--ds-gray-1000)]'
                  : 'border-transparent text-[var(--ds-gray-500)] hover:text-[var(--ds-gray-800)]'
              }`}
            >
              Members
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`pb-3 text-label-14 font-semibold border-b-2 transition-colors cursor-pointer bg-transparent px-1 ${
                activeTab === 'info'
                  ? 'border-[var(--color-brand)] text-[var(--ds-gray-1000)]'
                  : 'border-transparent text-[var(--ds-gray-500)] hover:text-[var(--ds-gray-800)]'
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
              <h3 className="text-label-12 text-[var(--ds-gray-700)] uppercase tracking-wider font-semibold mb-3 px-1">
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
            <TeamStats teamId={team.id} />

            {isAdmin && (
              <EditTeamForm team={team} onUpdate={onUpdate} />
            )}

            <div
              className="rounded-xl p-4 mt-2"
              style={{ background: 'var(--ds-background-200)', border: '1px solid var(--ds-gray-300)' }}
            >
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

export default function TeamScreen({ onBack, onUpgrade, onSwitchLibrary, initialCreate = false, onCreateHandled }) {
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

  // Show the create form when explicitly creating, or when the user has no
  // team yet (the original first-run path).
  const showCreate = creating || !team;

  return (
    <div className="flex flex-col h-full">
      <ScreenHeader
        onBack={creating && team ? () => setCreating(false) : onBack}
        title={creating && team ? 'New workspace' : 'Your Team'}
        actions={!creating && team && hasTeamPlan ? (
          <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
            <span className="flex items-center gap-1.5"><PlusIcon /> New</span>
          </Button>
        ) : null}
      />

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-copy-14 text-[var(--ds-gray-600)]">Loading team…</div>
        </div>
      ) : showCreate ? (
        hasTeamPlan ? (
          <CreateTeamForm
            onCreate={handleCreateTeam}
            onCancel={team ? () => setCreating(false) : null}
            multiple={!!team}
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
        />
      )}
    </div>
  );
}
