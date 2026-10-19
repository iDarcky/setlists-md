import { useEffect, useState } from 'react';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { useAuth } from '@/auth/useAuth';
import { friendlyAuthError } from './friendlyAuthError';

// One way in for everyone: an emailed six-digit code (the same email carries a
// magic link), plus Apple / Google once they are switched on. Used by the join
// flow and by Create account / Log in. There is no separate sign-up — the
// first code to an address creates the account.

const LAST_EMAIL_KEY = 'setlists-md:last-email';
const RESEND_COOLDOWN_MS = 30_000;

// Apple / Google need their providers switched on in Supabase. Until then a
// button that lands on a Supabase error page is worse than no button, so they
// show only when the build lists them: VITE_OAUTH_PROVIDERS="apple,google".
const OAUTH_PROVIDERS = new Set(
  String(import.meta.env.VITE_OAUTH_PROVIDERS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
);

function Message({ message }) {
  if (!message) return null;
  return (
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
  );
}

export default function EmailCodeCard({ onPasswordSignIn, passwordLabel = 'I have a password' }) {
  const { signInWithApple, signInWithGoogle, signInWithOtp, verifyEmailOtp } = useAuth();
  const [email, setEmail] = useState(() => {
    try { return window.localStorage.getItem(LAST_EMAIL_KEY) || ''; } catch { return ''; }
  });
  const [codeSentTo, setCodeSentTo] = useState(null);
  const [otp, setOtp] = useState('');
  const [busyTarget, setBusyTarget] = useState(null);
  const [message, setMessage] = useState(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const busy = !!busyTarget;
  const resendLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (resendAt <= now) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resendAt, now]);

  const run = async (target, fn) => {
    setBusyTarget(target);
    setMessage(null);
    try { await fn(); } catch (err) { setMessage({ kind: 'error', text: friendlyAuthError(err) }); }
    finally { setBusyTarget(null); }
  };

  const sendCode = (e) => {
    e?.preventDefault();
    const addr = email.trim();
    if (!addr) return;
    run('send', async () => {
      const { error } = await signInWithOtp(addr);
      if (error) throw error;
      try { window.localStorage.setItem(LAST_EMAIL_KEY, addr); } catch { /* ignore */ }
      setCodeSentTo(addr);
      setOtp('');
      setResendAt(Date.now() + RESEND_COOLDOWN_MS);
      setNow(Date.now());
      setMessage({ kind: 'info', text: `We emailed a code to ${addr}. You can also just tap the link in that email.` });
    });
  };

  const verify = (e) => {
    e.preventDefault();
    const token = otp.replace(/\s+/g, '');
    if (!token || !codeSentTo) return;
    // On success AuthProvider's session listener flips `user`, and the flow
    // moves on by itself.
    run('verify', async () => {
      const { error } = await verifyEmailOtp(codeSentTo, token);
      if (error) throw error;
    });
  };

  const oauth = (provider, fn) => run(provider, async () => {
    const { error } = await fn();
    if (error) throw error;
  });

  return (
    <div className="modes-card p-5 flex flex-col gap-3">
      {OAUTH_PROVIDERS.has('apple') && (
        <Button variant="secondary" size="lg" className="w-full" disabled={busy} loading={busyTarget === 'apple'}
          onClick={() => oauth('apple', signInWithApple)}>
          Continue with Apple
        </Button>
      )}
      {OAUTH_PROVIDERS.has('google') && (
        <Button variant="secondary" size="lg" className="w-full" disabled={busy} loading={busyTarget === 'google'}
          onClick={() => oauth('google', signInWithGoogle)}>
          Continue with Google
        </Button>
      )}
      {OAUTH_PROVIDERS.size > 0 && (
        <div className="flex items-center gap-3 text-label-12 text-[var(--modes-text-dim)]">
          <span className="h-px flex-1 bg-[var(--modes-border)]" />or<span className="h-px flex-1 bg-[var(--modes-border)]" />
        </div>
      )}

      {!codeSentTo ? (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-label-12 text-[var(--modes-text-muted)] uppercase tracking-wider">Email</span>
            <Input type="email" autoComplete="email" inputMode="email" required value={email}
              onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <Button type="submit" variant="brand" size="lg" className="w-full" disabled={busy || !email.trim()} loading={busyTarget === 'send'}>
            Email me a code
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-label-12 text-[var(--modes-text-muted)] uppercase tracking-wider">Code from the email</span>
            <Input type="text" inputMode="numeric" autoComplete="one-time-code" value={otp}
              onChange={e => setOtp(e.target.value)} placeholder="123456" maxLength={10} />
          </label>
          <Button type="submit" variant="brand" size="lg" className="w-full" disabled={busy || !otp.trim()} loading={busyTarget === 'verify'}>
            Continue
          </Button>
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={busy}
              onClick={() => { setCodeSentTo(null); setMessage(null); }}>
              Use a different email
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={busy || resendLeft > 0} loading={busyTarget === 'send'}
              onClick={() => sendCode()}>
              {resendLeft > 0 ? `Resend in ${resendLeft}s` : 'Send a new code'}
            </Button>
          </div>
        </form>
      )}

      <Message message={message} />

      {onPasswordSignIn && (
        <Button type="button" variant="ghost" size="sm" className="self-center" disabled={busy} onClick={onPasswordSignIn}>
          {passwordLabel}
        </Button>
      )}
    </div>
  );
}
