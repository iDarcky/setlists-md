import { useState, useEffect } from 'react';
import {
  StageGreeting,
  AccountSummary,
  PlanLabel,
  UpgradePill,
  SignInButton,
  CreateAccountButton,
} from './account/AccountPanel';
import { useAuth } from '../auth/useAuth';
import { useTeam } from '../auth/useTeam';
import { clearAll } from '../storage';

const NAME_MAX = 15;

const SUGGESTED_INSTRUMENTS = [
  'Vocals',
  'Lead Vocal',
  'Acoustic Guitar',
  'Electric Guitar',
  'Bass',
  'Drums',
  'Keys',
  'Piano',
];

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
}) {
  const { profile, updateProfile, updatePassword, deleteAccount, user } = useAuth();
  const { team, members, updateMyInstruments } = useTeam();
  const myMember = team && user ? members.find(m => m.user_id === user.id) : null;
  const myInstruments = myMember?.instruments || [];
  const [customInstrument, setCustomInstrument] = useState('');
  const [instrumentsBusy, setInstrumentsBusy] = useState(false);
  const [instrumentsError, setInstrumentsError] = useState(null);

  const toggleInstrument = async (name) => {
    if (instrumentsBusy) return;
    setInstrumentsBusy(true);
    setInstrumentsError(null);
    try {
      const next = myInstruments.includes(name)
        ? myInstruments.filter(i => i !== name)
        : [...myInstruments, name];
      await updateMyInstruments(next);
    } catch (err) {
      setInstrumentsError(err.message || 'Could not save instruments.');
    } finally {
      setInstrumentsBusy(false);
    }
  };

  const addCustomInstrument = async () => {
    const name = customInstrument.trim();
    if (!name || instrumentsBusy) return;
    setCustomInstrument('');
    if (myInstruments.includes(name)) return;
    setInstrumentsBusy(true);
    setInstrumentsError(null);
    try {
      await updateMyInstruments([...myInstruments, name]);
    } catch (err) {
      setInstrumentsError(err.message || 'Could not save instruments.');
    } finally {
      setInstrumentsBusy(false);
    }
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
      className="drawer-panel min-h-screen pb-8"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)',
      }}
    >
      <div className="a4-container pt-6 pb-10 flex flex-col gap-6">
        <StageGreeting displayName={displayName} tone="drawer" />
        <AccountSummary
          isSignedIn={isSignedIn}
          displayEmail={displayEmail}
          onSignOut={onSignOut}
          tone="drawer"
        />
        <div
          className="rounded-xl border p-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
          style={{ background: 'var(--drawer-surface)', borderColor: 'var(--drawer-border)' }}
        >
          <div className="flex flex-col">
            <span className="text-copy-14 font-medium" style={{ color: 'var(--drawer-text)' }}>Your Name</span>
            <span className="text-copy-13" style={{ color: 'var(--drawer-text-muted)' }}>
              Up to {NAME_MAX} characters. Used in the greeting.
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            <input
              type="text"
              value={draftName}
              onChange={e => setDraftName(e.target.value.slice(0, NAME_MAX))}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); }}
              maxLength={NAME_MAX}
              placeholder="Guest"
              className="h-8 px-3 rounded-lg border outline-none transition-colors text-copy-14 w-full sm:w-40"
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
        {isSignedIn && (
          <div
            className="rounded-xl border p-4 flex flex-col gap-4"
            style={{ background: 'var(--drawer-surface)', borderColor: 'var(--drawer-border)' }}
          >
            <div className="flex flex-col">
              <span className="text-copy-14 font-medium" style={{ color: 'var(--drawer-text)' }}>Security</span>
              <span className="text-copy-13" style={{ color: 'var(--drawer-text-muted)' }}>
                Set a password to sign in without a magic link.
              </span>
            </div>
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
            <div className="flex flex-col">
              <span className="text-copy-14 font-medium" style={{ color: 'var(--drawer-text)' }}>
                Your Instruments
              </span>
              <span className="text-copy-13" style={{ color: 'var(--drawer-text-muted)' }}>
                What you play on {team.name}. Worship leaders use this to pick the right people for each setlist.
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_INSTRUMENTS.map(name => {
                const active = myInstruments.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleInstrument(name)}
                    disabled={instrumentsBusy}
                    className="h-7 px-3 rounded-full text-copy-13 border cursor-pointer transition-colors disabled:opacity-50"
                    style={{
                      background: active ? 'var(--color-brand)' : 'transparent',
                      borderColor: active ? 'var(--color-brand)' : 'var(--drawer-border)',
                      color: active ? '#fff' : 'var(--drawer-text)',
                    }}
                  >
                    {name}
                  </button>
                );
              })}
              {myInstruments.filter(i => !SUGGESTED_INSTRUMENTS.includes(i)).map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleInstrument(name)}
                  disabled={instrumentsBusy}
                  className="h-7 px-3 rounded-full text-copy-13 border cursor-pointer disabled:opacity-50"
                  style={{
                    background: 'var(--color-brand)',
                    borderColor: 'var(--color-brand)',
                    color: '#fff',
                  }}
                  title="Click to remove"
                >
                  {name} ×
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customInstrument}
                onChange={e => setCustomInstrument(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomInstrument(); } }}
                placeholder="Add instrument…"
                className="h-8 px-3 rounded-lg border outline-none text-copy-14 flex-1 sm:flex-none sm:w-48"
                style={{
                  background: 'var(--drawer-surface)',
                  borderColor: 'var(--drawer-border)',
                  color: 'var(--drawer-text)',
                }}
              />
              <button
                type="button"
                onClick={addCustomInstrument}
                disabled={!customInstrument.trim() || instrumentsBusy}
                className="h-8 px-3 rounded-lg text-copy-13 font-medium border-none cursor-pointer disabled:opacity-50"
                style={{ background: 'var(--color-brand)', color: '#fff' }}
              >
                Add
              </button>
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
