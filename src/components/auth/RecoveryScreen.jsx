import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import ScreenHeader from '../ui/ScreenHeader';
import { useAuth } from '../../auth/useAuth';

const EyeIcon = ({ off = false }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {off ? (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    ) : (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

function friendlyAuthError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return "You're offline. Check your connection and try again.";
  }
  const raw = err?.message || '';
  const lower = raw.toLowerCase();
  if (lower.includes('failed to fetch') || lower.includes('network request failed') || lower.includes('networkerror')) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  if (lower.includes('password should be at least')) return 'Password must be at least 8 characters.';
  if (lower.includes('same as the old password') || lower.includes('same password')) {
    return 'Please choose a different password than your current one.';
  }
  if (lower.includes('auth session missing') || lower.includes('session not found')) {
    return 'Your recovery link has expired. Request a new one from the sign-in screen.';
  }
  return raw || 'Could not update password.';
}

export default function RecoveryScreen({ onBack, onDone }) {
  const { updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [succeeded, setSucceeded] = useState(false);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = password.length >= 8 && confirm === password && !busy;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await updatePassword(password);
      if (error) throw error;
      setSucceeded(true);
      setMessage({ kind: 'info', text: 'Password updated. Redirecting…' });
      setTimeout(() => onDone?.(), 800);
    } catch (err) {
      setMessage({ kind: 'error', text: friendlyAuthError(err) });
    } finally {
      setBusy(false);
    }
  };

  // Bail-out safety: the recovery link signed the user in with an interim
  // session. If they close the screen without actually resetting, sign them
  // back out so the elevated session doesn't linger.
  const handleBack = async () => {
    if (!succeeded) {
      try { await signOut(); } catch { /* best-effort */ }
    }
    onBack?.();
  };

  const passwordInputType = showPassword ? 'text' : 'password';
  const revealSuffix = (
    <button
      type="button"
      onClick={() => setShowPassword(s => !s)}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
      className="bg-transparent border-none p-0 cursor-pointer text-[var(--notion-text-dim)] hover:text-[var(--notion-text-main)] transition-colors flex items-center"
    >
      <EyeIcon off={showPassword} />
    </button>
  );

  return (
    <div data-theme-variant="modes" className="min-h-screen flex flex-col">
      <ScreenHeader onBack={handleBack} title="Set new password" />
      <div className="flex-1 flex items-start justify-center px-4 py-6 sm:py-10">
        <form onSubmit={handleSubmit} className="w-full max-w-sm border border-[var(--notion-border)] rounded-lg bg-[var(--notion-bg)] p-6 flex flex-col gap-4">
          <p className="text-copy-14 text-[var(--notion-text-dim)] m-0">
            Choose a new password for your account. Must be at least 8 characters.
          </p>

          <label className="flex flex-col gap-1">
            <span className="text-label-12 text-[var(--notion-text-dim)] uppercase tracking-wider">New password</span>
            <Input
              type={passwordInputType}
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              suffix={revealSuffix}
            />
            {tooShort && (
              <span className="text-label-12 text-[var(--ds-amber-900)]">At least 8 characters.</span>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-label-12 text-[var(--notion-text-dim)] uppercase tracking-wider">Confirm password</span>
            <Input
              type={passwordInputType}
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
              suffix={revealSuffix}
            />
            {mismatch && (
              <span className="text-label-12 text-[var(--ds-amber-900)]">Passwords don't match.</span>
            )}
          </label>

          {message && (
            <div
              role="status"
              aria-live="polite"
              className={`text-copy-13 px-3 py-2 rounded-lg ${
                message.kind === 'error'
                  ? 'bg-[var(--ds-red-100)] text-[var(--ds-red-1000)]'
                  : 'bg-[var(--ds-teal-100)] text-[var(--ds-teal-1000)]'
              }`}
            >
              {message.text}
            </div>
          )}

          <Button type="submit" variant="brand" size="lg" className="w-full" disabled={!canSubmit} loading={busy}>
            Update password
          </Button>
        </form>
      </div>
    </div>
  );
}
