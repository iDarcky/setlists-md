import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import PageHeader from '../ui/PageHeader';
import BrandWordmark from '../ui/BrandWordmark';
import { useAuth } from '../../auth/useAuth';

const LAST_EMAIL_KEY = 'setlists-md:last-email';
const RESEND_COOLDOWN_MS = 30_000;

// Map the most common Supabase auth errors to copy our users can actually
// act on. Falls through to the raw message when nothing matches.
function friendlyAuthError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return "You're offline. Check your connection and try again.";
  }
  const raw = err?.message || '';
  const lower = raw.toLowerCase();
  if (lower.includes('failed to fetch') || lower.includes('network request failed') || lower.includes('networkerror')) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  if (lower.includes('invalid login credentials')) return 'Wrong email or password.';
  if (lower.includes('user already registered')) return 'That email already has an account — try signing in instead.';
  if (lower.includes('email not confirmed')) return 'Please confirm your email before signing in.';
  if (lower.includes('email rate limit') || lower.includes('over_email_send_rate_limit')) {
    return 'Too many emails sent. Try again in a few minutes.';
  }
  if (lower.includes('you can only request this') || lower.includes('once every')) {
    return 'Please wait a minute before trying again.';
  }
  if (lower.includes('password should be at least')) return 'Password must be at least 8 characters.';
  return raw || 'Something went wrong.';
}

// Rough password strength: length + character variety → 1 (weak) … 3 (strong).
function passwordStrength(pw) {
  if (!pw) return { score: 0, label: '' };
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (pw.length >= 12) s += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw)) s += 1;
  if (/[^A-Za-z0-9]/.test(pw)) s += 1;
  const score = Math.min(3, Math.max(1, s));
  return { score, label: ['', 'Weak', 'Okay', 'Strong'][score] };
}

const STRENGTH_COLORS = ['', 'var(--ds-red-700)', 'var(--ds-amber-700)', 'var(--ds-teal-700)'];

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

// Bring a focused field into view above the on-screen keyboard. The delay lets
// the mobile keyboard finish animating so the field lands centred, not behind it.
function scrollFieldIntoView(e) {
  const el = e.target;
  setTimeout(() => {
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch { /* ignore */ }
  }, 300);
}

export default function AuthScreen({ onBack, onSignedIn, defaultMode = 'signin', onShowLegal }) {
  const {
    signInWithPassword,
    signUpWithPassword,
    resetPassword,
    resendVerification,
    isConfigured,
  } = useAuth();

  const [mode, setMode] = useState(defaultMode); // 'signin' | 'signup'
  const [email, setEmail] = useState(() => {
    if (typeof window === 'undefined') return '';
    try { return window.localStorage.getItem(LAST_EMAIL_KEY) || ''; } catch { return ''; }
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyTarget, setBusyTarget] = useState(null);
  const [message, setMessage] = useState(null); // { kind: 'info' | 'error', text }
  const [pendingVerification, setPendingVerification] = useState(null);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  const isSignUp = mode === 'signup';
  const passwordTooShort = isSignUp && password.length > 0 && password.length < 8;
  const passwordsMismatch = isSignUp && confirmPassword.length > 0 && confirmPassword !== password;
  const strength = passwordStrength(password);
  const resendSecondsLeft = Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));

  useEffect(() => {
    if (resendAvailableAt <= now) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resendAvailableAt, now]);

  const rememberEmail = (value) => {
    if (typeof window === 'undefined' || !value) return;
    try { window.localStorage.setItem(LAST_EMAIL_KEY, value); } catch { /* ignore */ }
  };

  const runAction = async (target, fn) => {
    setBusy(true);
    setBusyTarget(target);
    setMessage(null);
    try {
      await fn();
    } catch (err) {
      setMessage({ kind: 'error', text: friendlyAuthError(err) });
    } finally {
      setBusy(false);
      setBusyTarget(null);
    }
  };

  const handleResetPassword = async () => {
    if (!email) return;
    await runAction('reset', async () => {
      const { error } = await resetPassword(email);
      if (error) throw error;
      rememberEmail(email);
      setMessage({ kind: 'info', text: `Password reset link sent to ${email}.` });
    });
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (isSignUp && password.length < 8) {
      setMessage({ kind: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    if (isSignUp && password !== confirmPassword) {
      setMessage({ kind: 'error', text: "Passwords don't match." });
      return;
    }
    await runAction('submit', async () => {
      if (isSignUp) {
        const { error } = await signUpWithPassword(email, password, displayName);
        if (error) throw error;
        rememberEmail(email);
        setMessage({ kind: 'info', text: `Check ${email} to confirm your account.` });
        setPendingVerification(email);
        setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS);
      } else {
        const { error } = await signInWithPassword(email, password);
        if (error) throw error;
        rememberEmail(email);
        onSignedIn?.();
      }
    });
  };

  const handleResendVerification = async () => {
    if (!pendingVerification || resendSecondsLeft > 0) return;
    await runAction('resend', async () => {
      const { error } = await resendVerification(pendingVerification);
      if (error) throw error;
      setMessage({ kind: 'info', text: `Confirmation email resent to ${pendingVerification}.` });
      setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS);
    });
  };

  if (!isConfigured) {
    return (
      <div data-theme-variant="modes" className="fixed inset-0 overflow-y-auto flex flex-col">
        <PageHeader title="Sign in" onBack={onBack} />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="modes-card max-w-sm p-6 text-center">
            <h2 className="text-heading-20 text-[var(--modes-text)] m-0 mb-2">Auth not configured</h2>
            <p className="text-copy-14 text-[var(--modes-text-muted)] m-0">
              This build is missing Supabase credentials. Set <code>VITE_SUPABASE_URL</code> and{' '}
              <code>VITE_SUPABASE_ANON_KEY</code> in your environment to enable sign-in.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-theme-variant="modes" className="fixed inset-0 overflow-y-auto flex flex-col">
      <PageHeader title={isSignUp ? 'Create account' : 'Sign in'} onBack={onBack} />

      <div className="flex-1 flex items-start justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-sm flex flex-col gap-4">

          <div className="flex flex-col items-center gap-3 pt-2 pb-1">
            <img
              src="/setlists-md-mark.svg"
              alt=""
              aria-hidden="true"
              width="56"
              height="56"
              className="rounded-2xl shadow-md"
            />
            <BrandWordmark
              height={20}
              accent="var(--color-brand-mist)"
              className="text-[var(--modes-text)] opacity-95"
            />
            <p className="text-copy-13 text-[var(--modes-text-muted)] m-0 text-center">
              {isSignUp ? 'Create your account to sync across devices.' : 'Welcome back — sign in to your account.'}
            </p>
          </div>

          <form onSubmit={handleEmailSubmit} className="modes-card p-6 flex flex-col gap-4">
            {isSignUp && (
              <label className="flex flex-col gap-1">
                <span className="text-label-12 text-[var(--modes-text-muted)] uppercase tracking-wider">Name</span>
                <Input
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  onFocus={scrollFieldIntoView}
                  placeholder="Your name"
                />
              </label>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-label-12 text-[var(--modes-text-muted)] uppercase tracking-wider">Email</span>
              <Input
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={scrollFieldIntoView}
                placeholder="you@example.com"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-label-12 text-[var(--modes-text-muted)] uppercase tracking-wider">Password</span>
              <Input
                type={showPassword ? 'text' : 'password'}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                required
                minLength={isSignUp ? 8 : undefined}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={scrollFieldIntoView}
                placeholder="••••••••"
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="bg-transparent border-none p-0 cursor-pointer text-[var(--modes-text-muted)] hover:text-[var(--modes-text)] transition-colors flex items-center"
                  >
                    <EyeIcon off={showPassword} />
                  </button>
                }
              />
              {isSignUp && (
                password.length > 0 ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 flex gap-1">
                      {[1, 2, 3].map(seg => (
                        <span
                          key={seg}
                          className="h-1 flex-1 rounded-full transition-colors"
                          style={{ background: seg <= strength.score ? STRENGTH_COLORS[strength.score] : 'var(--modes-border)' }}
                        />
                      ))}
                    </div>
                    <span className="text-label-12 shrink-0" style={{ color: passwordTooShort ? 'var(--ds-amber-900)' : 'var(--modes-text-dim)' }}>
                      {passwordTooShort ? 'Too short' : strength.label}
                    </span>
                  </div>
                ) : (
                  <span className="text-label-12 mt-1 text-[var(--modes-text-dim)]">At least 8 characters.</span>
                )
              )}
              {!isSignUp && (
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={busy || !email}
                  title={!email ? 'Enter your email above to reset your password' : undefined}
                  className="self-end mt-1 text-label-12 text-[var(--color-brand)] font-medium bg-transparent border-none p-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busyTarget === 'reset' ? 'Sending…' : 'Forgot password?'}
                </button>
              )}
            </label>

            {isSignUp && (
              <label className="flex flex-col gap-1">
                <span className="text-label-12 text-[var(--modes-text-muted)] uppercase tracking-wider">Confirm password</span>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onFocus={scrollFieldIntoView}
                  placeholder="••••••••"
                />
                {passwordsMismatch && (
                  <span className="text-label-12 mt-1 text-[var(--ds-amber-900)]">Passwords don&apos;t match.</span>
                )}
              </label>
            )}

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
                {pendingVerification && message.kind === 'info' && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={busy || resendSecondsLeft > 0}
                    className="block mt-2 text-label-12 font-semibold underline underline-offset-4 bg-transparent border-none p-0 cursor-pointer disabled:no-underline disabled:opacity-60"
                  >
                    {busyTarget === 'resend'
                      ? 'Resending…'
                      : resendSecondsLeft > 0
                        ? `Resend available in ${resendSecondsLeft}s`
                        : "Didn't get it? Resend email"}
                  </button>
                )}
              </div>
            )}

            <Button
              type="submit"
              variant="brand"
              size="lg"
              className="w-full"
              disabled={busy || !email || !password || (isSignUp && confirmPassword !== password)}
              loading={busyTarget === 'submit'}
            >
              {isSignUp ? 'Create account' : 'Sign in'}
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="md"
              className="w-full"
              disabled={busy}
              onClick={() => { setMode(isSignUp ? 'signin' : 'signup'); setMessage(null); setConfirmPassword(''); }}
            >
              {isSignUp ? 'Sign in instead' : 'Create an account'}
            </Button>

            {isSignUp && (
              <p className="text-center text-copy-12 text-[var(--modes-text-dim)] m-0 pt-1 leading-relaxed">
                By creating an account you agree to our{' '}
                {onShowLegal ? (
                  <>
                    <button type="button" onClick={() => onShowLegal('terms')} className="underline underline-offset-2 bg-transparent border-none p-0 cursor-pointer text-[var(--modes-text-muted)] text-copy-12">Terms of Service</button>
                    {' '}and{' '}
                    <button type="button" onClick={() => onShowLegal('privacy')} className="underline underline-offset-2 bg-transparent border-none p-0 cursor-pointer text-[var(--modes-text-muted)] text-copy-12">Privacy Policy</button>
                  </>
                ) : (
                  <>
                    <a href="/terms" className="underline underline-offset-2 text-[var(--modes-text-muted)]">Terms of Service</a>
                    {' '}and{' '}
                    <a href="/privacy" className="underline underline-offset-2 text-[var(--modes-text-muted)]">Privacy Policy</a>
                  </>
                )}
                .
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
