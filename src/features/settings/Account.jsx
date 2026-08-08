import { useState, useEffect, useMemo } from 'react';
import {
  StageGreeting,
  AccountSummary,
  PlanLabel,
  UpgradePill,
  SignInButton,
  CreateAccountButton,
} from './AccountPanel';
import { useAuth } from '@/auth/useAuth';
import { useTeam } from '@/auth/useTeam';
import { clearAll } from '@/storage';
import AvatarUploader from '@/ui/AvatarUploader';
import { INSTRUMENTS, VOCAL_PARTS, normalize } from '@/data/instruments';

const NAME_MAX = 15;

export default function Account({
  settings,
  onUpdate,
  isSignedIn = false,
  displayName = 'Guest',
  displayEmail = '',
  plan = 'Free',
  onUpgrade,
  onSignIn,
  onCreateAccount,
  onSignOut,
  embedded = false,
}) {
  const { profile, updateProfile, updatePassword, deleteAccount, user } = useAuth();
  const { team, members, updateMyInstruments } = useTeam();
  const myMember = team && user ? members.find(m => m.user_id === user.id) : null;
  const [instrumentsBusy, setInstrumentsBusy] = useState(false);
  const [instrumentsError, setInstrumentsError] = useState(null);

  // Stored values are normalised on READ, never rewritten in place — older
  // builds wrote Title Case labels and PLAN §1.2 #6 documents a stale client
  // still writing to this database. See `data/instruments.js`.
  // The `|| []` lives INSIDE the memo: as a separate binding it is a new array
  // every render, so the memo would never actually memoise.
  const myTokens = useMemo(
    () => Array.from(new Set((myMember?.instruments || []).map(normalize).filter(Boolean))),
    [myMember?.instruments]
  );

  const save = async (next) => {
    if (instrumentsBusy) return;
    setInstrumentsBusy(true);
    setInstrumentsError(null);
    try {
      await updateMyInstruments(Array.from(new Set(next)));
    } catch (err) {
      setInstrumentsError(err.message || 'Could not save instruments.');
    } finally {
      setInstrumentsBusy(false);
    }
  };

  // **At most ONE instrument, plus singing** (owner, 2026-08-07/08). Playing
  // two instruments in one service is not the normal case, and a profile
  // claiming three is what made `resolveMyInstrument` give up and show every
  // tab — it refuses to guess from an ambiguous list. Picking a second
  // instrument REPLACES the first rather than erroring.
  const toggleInstrument = (id) => {
    const on = myTokens.some(t => t.split(':')[0] === id);
    // Whatever happens, anything under `vocals:` survives — singing is the
    // other axis now, not one of the instruments.
    const sung = myTokens.filter(t => t.split(':')[0] === 'vocals');
    save(on ? sung : [...sung, id]);
  };

  // Singing is independent of the instrument, and a person sings ONE part.
  const togglePart = (partId) => {
    const token = `vocals:${partId}`;
    const others = myTokens.filter(t => t.split(':')[0] !== 'vocals');
    save(myTokens.includes(token) ? others : [...others, token]);
  };

  // Prefer the cloud display_name so the input matches what the rest of the UI
  // shows for signed-in users; fall back to the local userName for guests.
  const savedName = (isSignedIn ? profile?.display_name : settings?.userName) || settings?.userName || '';
  const [draftName, setDraftName] = useState(savedName);

  const [newPassword, setNewPassword] = useState('');
  const [passBusy, setPassBusy] = useState(false);
  const [passMessage, setPassMessage] = useState(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    setDraftName(savedName);
  }, [savedName]);

  const dirty = draftName !== savedName;
  const saveName = async () => {
    if (!dirty) return;
    onUpdate({ ...settings, userName: draftName });
    if (isSignedIn) {
      try {
        await updateProfile({ display_name: draftName });
      } catch (err) {
        console.warn('[account] display_name sync failed:', err?.message || err);
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm.trim().toLowerCase() !== (displayEmail || '').trim().toLowerCase()) {
      setDeleteError('Email does not match.');
      return;
    }
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      // Wipe any device-local library so a different user signing in on this
      // device doesn't inherit the deleted account's songs/setlists.
      try { await clearAll(); } catch { /* best-effort */ }
      try { localStorage.removeItem('setlists-md:last-email'); } catch { /* ignore */ }
      // Sign out — server-side session is already invalid.
      try { await onSignOut?.(); } catch { /* ignore */ }
    } catch (err) {
      setDeleteError(err.message || 'Could not delete account. Email legal@setlists.md for help.');
      setDeleteBusy(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 8) {
      setPassMessage({ kind: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    setPassBusy(true);
    setPassMessage(null);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) throw error;
      setPassMessage({ kind: 'info', text: 'Password updated successfully.' });
      setNewPassword('');
    } catch (err) {
      setPassMessage({ kind: 'error', text: err.message || 'Failed to update password.' });
    } finally {
      setPassBusy(false);
    }
  };

  return (
    <div
      className={embedded ? '' : 'drawer-panel min-h-screen pb-8'}
      style={embedded ? undefined : { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
    >
      <div className={embedded ? 'flex flex-col gap-6' : 'a4-container pt-6 pb-10 flex flex-col gap-6'}>
        {!embedded && <StageGreeting displayName={displayName} tone="drawer" />}
        <AccountSummary
          isSignedIn={isSignedIn}
          displayEmail={displayEmail}
          onSignOut={onSignOut}
          tone="drawer"
        />
        {/* Profile — avatar + name grouped in one card (Notion-style). Stacks
            on phones so the name field never gets crushed by the avatar row. */}
        <div
          className="rounded-xl border p-4 flex flex-col sm:flex-row sm:items-start gap-4"
          style={{ background: 'var(--drawer-surface)', borderColor: 'var(--drawer-border)' }}
        >
          {isSignedIn && user && (
            <div className="shrink-0">
              <AvatarUploader
                url={profile?.avatar_url || null}
                fallback={(displayName || 'G').trim().charAt(0).toUpperCase()}
                pathPrefix={`users/${user.id}`}
                onChange={async (avatarUrl) => { await updateProfile({ avatar_url: avatarUrl }); }}
              />
            </div>
          )}
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <span className="text-copy-14 font-medium" style={{ color: 'var(--drawer-text)' }}>Your name</span>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={draftName}
                onChange={e => setDraftName(e.target.value.slice(0, NAME_MAX))}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); }}
                maxLength={NAME_MAX}
                placeholder="Guest"
                className="h-8 px-3 rounded-lg border outline-none transition-colors text-copy-14 w-full sm:w-48"
                style={{
                  background: 'var(--drawer-surface)',
                  borderColor: 'var(--drawer-border)',
                  color: 'var(--drawer-text)',
                }}
              />
              <button
                onClick={saveName}
                disabled={!dirty}
                aria-label="Save name"
                className={`h-8 px-3 rounded-lg text-copy-13 font-medium border-none cursor-pointer transition-all duration-200 ease-out ${
                  dirty ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                }`}
                style={{
                  background: 'var(--color-brand)',
                  color: '#fff',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
        {isSignedIn && (
          <div
            className="rounded-xl border p-4 flex flex-col gap-4"
            style={{ background: 'var(--drawer-surface)', borderColor: 'var(--drawer-border)' }}
          >
            <span className="text-copy-14 font-medium" style={{ color: 'var(--drawer-text)' }}>Security</span>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="New password"
                className="h-8 px-3 rounded-lg border outline-none transition-colors text-copy-14 w-full sm:w-48"
                style={{
                  background: 'var(--drawer-surface)',
                  borderColor: 'var(--drawer-border)',
                  color: 'var(--drawer-text)',
                }}
              />
              <button
                onClick={handleUpdatePassword}
                disabled={passBusy || !newPassword}
                className="h-8 px-3 rounded-lg text-copy-13 font-medium border-none cursor-pointer transition-all duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'var(--color-brand)',
                  color: '#fff',
                }}
              >
                {passBusy ? 'Saving…' : 'Update'}
              </button>
            </div>
            {passMessage && (
              <div
                className={`text-copy-12 px-2 py-1 rounded ${
                  passMessage.kind === 'error'
                    ? 'bg-[var(--ds-red-100)] text-[var(--ds-red-1000)]'
                    : 'bg-[var(--ds-teal-100)] text-[var(--ds-teal-1000)]'
                }`}
              >
                {passMessage.text}
              </div>
            )}
          </div>
        )}
        {team && (
          <div
            className="rounded-xl border p-4 flex flex-col gap-3"
            style={{ background: 'var(--drawer-surface)', borderColor: 'var(--drawer-border)' }}
          >
            <span className="text-copy-14 font-medium" style={{ color: 'var(--drawer-text)' }}>
              Your Instruments
            </span>
            {/* A CLOSED list. The free-text field that used to sit under this
                is gone: the reader keys what it shows off your instrument, and
                a typed "Klavier" maps to nothing at all. */}
            <div className="flex flex-wrap gap-2">
              {INSTRUMENTS.map(inst => {
                const active = myTokens.some(t => t.split(':')[0] === inst.id);
                return (
                  <button
                    key={inst.id}
                    type="button"
                    onClick={() => toggleInstrument(inst.id)}
                    disabled={instrumentsBusy}
                    aria-pressed={active}
                    className="h-7 px-3 rounded-full text-copy-13 border cursor-pointer transition-colors disabled:opacity-50"
                    style={{
                      background: active ? 'var(--color-brand)' : 'transparent',
                      borderColor: active ? 'var(--color-brand)' : 'var(--drawer-border)',
                      color: active ? '#fff' : 'var(--drawer-text)',
                    }}
                  >
                    {inst.label}
                  </button>
                );
              })}
            </div>
            {/* ⚠ Its own question, not a sub-list of the instrument above.
                Singing and playing are independent — a guitarist takes Backing
                — which is exactly why "Vocals" stopped being an instrument. */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-label-11 uppercase tracking-wider w-full" style={{ color: 'var(--drawer-text-dim, var(--ds-gray-600))' }}>
                Do you sing?
              </span>
              {VOCAL_PARTS.map(p => {
                  const on = myTokens.includes(`vocals:${p.id}`);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePart(p.id)}
                      disabled={instrumentsBusy}
                      aria-pressed={on}
                      // The SAME selected language as an instrument chip — a
                      // part in a second colour read as a different kind of
                      // thing rather than as step two. Hierarchy comes from
                      // size and indent, not from a second palette.
                      className="h-6 px-2.5 rounded-full text-copy-12 border cursor-pointer transition-colors disabled:opacity-50"
                      style={{
                        background: on ? 'var(--color-brand)' : 'transparent',
                        borderColor: on ? 'var(--color-brand)' : 'var(--drawer-border)',
                        color: on ? '#fff' : 'var(--drawer-text)',
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
            </div>
            {instrumentsError && (
              <div
                className="text-copy-12 px-2 py-1 rounded"
                style={{ background: 'var(--ds-red-100)', color: 'var(--ds-red-1000)' }}
              >
                {instrumentsError}
              </div>
            )}
          </div>
        )}
        <div
          className="rounded-2xl border p-6 flex flex-col gap-4"
          style={{ background: 'var(--drawer-surface)', borderColor: 'var(--drawer-border)' }}
        >
          <PlanLabel plan={plan} tone="drawer" />
          {isSignedIn && plan === 'Free' ? (
            <UpgradePill onUpgrade={onUpgrade} />
          ) : (
            <>
              <SignInButton onSignIn={onSignIn} />
              <CreateAccountButton onCreateAccount={onCreateAccount} />
              {onUpgrade && (
                <button
                  type="button"
                  onClick={onUpgrade}
                  className="self-start text-label-13 bg-transparent border-none p-0 cursor-pointer hover:underline underline-offset-4"
                  style={{ color: 'var(--drawer-text-muted)' }}
                >
                  Compare plans →
                </button>
              )}
            </>
          )}
        </div>

        {isSignedIn && (
          <div
            className="rounded-xl border p-4 flex flex-col gap-3"
            style={{ background: 'var(--drawer-surface)', borderColor: 'var(--ds-red-border, var(--drawer-border))' }}
          >
            <div className="flex flex-col">
              <span className="text-copy-14 font-medium" style={{ color: 'var(--drawer-text)' }}>
                Delete account
              </span>
              <span className="text-copy-13" style={{ color: 'var(--drawer-text-muted)' }}>
                Permanently removes your account, profile, team memberships, and any
                cloud-synced data. Local files on this device are also wiped. This
                cannot be undone.
              </span>
            </div>
            {!deleteOpen ? (
              <button
                onClick={() => { setDeleteOpen(true); setDeleteConfirm(''); setDeleteError(null); }}
                className="self-start h-8 px-3 rounded-lg text-copy-13 font-medium border cursor-pointer"
                style={{
                  background: 'transparent',
                  borderColor: 'var(--ds-red-border, var(--drawer-border))',
                  color: 'var(--ds-red-1000, var(--drawer-text))',
                }}
              >
                Delete my account…
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <span className="text-copy-13" style={{ color: 'var(--drawer-text)' }}>
                  Type <strong>{displayEmail || 'your email'}</strong> to confirm.
                </span>
                <input
                  type="email"
                  value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value)}
                  placeholder={displayEmail || 'you@example.com'}
                  autoComplete="off"
                  className="h-8 px-3 rounded-lg border outline-none text-copy-14"
                  style={{
                    background: 'var(--drawer-surface)',
                    borderColor: 'var(--drawer-border)',
                    color: 'var(--drawer-text)',
                  }}
                />
                {deleteError && (
                  <div
                    className="text-copy-12 px-2 py-1 rounded"
                    style={{ background: 'var(--ds-red-100)', color: 'var(--ds-red-1000)' }}
                  >
                    {deleteError}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteBusy}
                    className="h-8 px-3 rounded-lg text-copy-13 font-medium border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'var(--ds-red-1000, #b00020)', color: '#fff' }}
                  >
                    {deleteBusy ? 'Deleting…' : 'Permanently delete'}
                  </button>
                  <button
                    onClick={() => { setDeleteOpen(false); setDeleteConfirm(''); setDeleteError(null); }}
                    disabled={deleteBusy}
                    className="h-8 px-3 rounded-lg text-copy-13 font-medium border cursor-pointer"
                    style={{
                      background: 'transparent',
                      borderColor: 'var(--drawer-border)',
                      color: 'var(--drawer-text)',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <div className="text-label-11" style={{ color: 'var(--drawer-text-muted)' }}>
              Prefer to delete via email? Write to{' '}
              <a
                href="mailto:legal@setlists.md?subject=Account%20deletion%20request"
                className="underline underline-offset-4"
                style={{ color: 'var(--drawer-text)' }}
              >
                legal@setlists.md
              </a>
              .
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
