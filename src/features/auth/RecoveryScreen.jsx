import { useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import { NewPasswordView } from './AuthViews';

// The reset link lands here (type=recovery in the URL). State and Supabase
// only; the screen itself is NewPasswordView, shared with /design.

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
    return 'That’s your current password. Pick a different one.';
  }
  if (lower.includes('auth session missing') || lower.includes('session not found')) {
    return 'This reset link has expired. Ask for a new one from Forgot password on the Log in screen.';
  }
  return raw || 'Could not update password.';
}

export default function RecoveryScreen({ onBack, onDone }) {
  const { updatePassword, signOut } = useAuth();
  const [values, setValues] = useState({ password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await updatePassword(values.password);
      if (error) throw error;
      setDone(true);
      setTimeout(() => onDone?.(), 1200);
    } catch (err) {
      setMessage({ kind: 'error', text: friendlyAuthError(err) });
    } finally {
      setBusy(false);
    }
  };

  // Bail-out safety: the recovery link signed the user in with an interim
  // session. If they leave without resetting, sign them back out so the
  // elevated session doesn't linger.
  const handleBack = async () => {
    if (!done) {
      try { await signOut(); } catch { /* best-effort */ }
    }
    onBack?.();
  };

  return (
    <NewPasswordView
      values={values}
      onChange={(k, v) => setValues(p => ({ ...p, [k]: v }))}
      onSubmit={handleSubmit}
      onBack={handleBack}
      busy={busy}
      message={message}
      done={done}
    />
  );
}
