import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import ScreenHeader from '../ui/ScreenHeader';
import BrandWordmark from '../ui/BrandWordmark';
import { useAuth } from '../../auth/useAuth';

const LAST_EMAIL_KEY = 'setlists-md:last-email';
const RESEND_COOLDOWN_MS = 30_000;

// Map the most common Supabase auth errors to copy our users can actually
// act on. Falls through to the raw message when nothing matches.
function friendlyAuthError(err) {
  // Offline / transport failures come back as plain fetch errors with no
  // useful message — surface a clear "you're offline" instead.
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

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.2 7.9 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16.1 18.9 13 24 13c3 0 5.8 1.2 7.9 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.1 4 9.3 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.3c-2 1.5-4.6 2.4-7.4 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.2 39.6 16 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.3 5.3c-.5.5 6.6-4.9 6.6-14.9 0-1.3-.1-2.4-.4-3.5z"/>
  </svg>
);

const AppleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16.37 1c.1 1.04-.34 2.08-1.02 2.8-.74.8-1.93 1.4-3.1 1.32-.12-1.02.36-2.1 1.03-2.77.75-.8 2.05-1.38 3.1-1.35zM20.1 17.24c-.54 1.17-.8 1.7-1.5 2.73-.98 1.44-2.36 3.24-4.07 3.25-1.52.01-1.91-.99-3.97-.98-2.06.01-2.49 1-4.01.99-1.71-.02-3.02-1.65-4-3.09C-.13 16.12-.41 11.4 1.3 8.88c1.22-1.79 3.15-2.84 4.97-2.84 1.85 0 3.01 1.01 4.54 1.01 1.48 0 2.39-1.01 4.53-1.01 1.62 0 3.34.89 4.56 2.42-4 2.19-3.35 7.9.2 8.78z"/>
  </svg>
);

const APPLE_ENABLED = import.meta.env.VITE_ENABLE_APPLE_SIGNIN === 'true';

export default function AuthScreen({ onBack, onSignedIn, defaultMode = 'signin', onShowLegal }) {
  const {
    signInWithGoogle,
    signInWithApple,
    signInWithOtp,
    signInWithPassword,
    signUpWithPassword,
    resetPassword,
    resendVerification,
    isConfigured,
  } = useAuth();

  const [mode, setMode] = useState(defaultMode); // 'signin' | 'signup'
  const [emailMode, setEmailMode] = useState('password'); // 'magic' | 'password'
  const [email, setEmail] = useState(() => {
    if (typeof window === 'undefined') return '';
    try { return window.localStorage.getItem(LAST_EMAIL_KEY) || ''; } catch { return ''; }
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  // Which button currently owns the busy state — drives per-button spinners
  // so e.g. "Forgot password?" doesn't spin the main submit button.
  const [busyTarget, setBusyTarget] = useState(null);
  const [message, setMessage] = useState(null); // { kind: 'info' | 'error', text }
  // Email address awaiting verification, set after a successful signup.
  // Controls rendering of the "Didn't get the email? Resend" affordance.
  const [pendingVerification, setPendingVerification] = useState(null);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  const isSignUp = mode === 'signup';
  const passwordTooShort = isSignUp && emailMode === 'password' && password.length > 0 && password.length < 8;
  const resendSecondsLeft = Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));

  // Tick once a second while a cooldown is active so the countdown animates.
  useEffect(() => {
    if (resendAvailableAt <= now) return;
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
    if (!email) return; // Button is already disabled in this state.
    await runAction('reset', async () => {
      const { error } = await resetPassword(email);
      if (error) throw error;
      rememberEmail(email);
      setMessage({ kind: 'info', text: `Password reset link sent to ${email}.` });
    });
  };

  const handleOauth = (fn, label) =>
    runAction(`oauth:${label}`, async () => {
      const { error } = await fn();
      if (error) throw error;
    });

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (isSignUp && emailMode === 'password' && password.length < 8) {
      setMessage({ kind: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    await runAction('submit', async () => {
      if (emailMode === 'magic') {
        const { error } = await signInWithOtp(email);
        if (error) throw error;
        rememberEmail(email);
        setMessage({ kind: 'info', text: `Magic link sent to ${email}. Check your inbox.` });
        setPendingVerification(null);
      } else if (isSignUp) {
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
      <div data-theme-variant="modes" className="min-h-screen flex flex-col">
        <ScreenHeader onBack={onBack} title="Sign In" />
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
    <div data-theme-variant="modes" className="min-h-screen flex flex-col">
      <ScreenHeader onBack={onBack} title={isSignUp ? 'Create account' : 'Sign in'} />

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
          </div>

          <div className="modes-card p-6 flex flex-col gap-3">
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              disabled={busy}
              loading={busyTarget === 'oauth:Google'}
              onClick={() => handleOauth(signInWithGoogle, 'Google')}
            >
              <GoogleIcon />
              <span className="ml-2">Continue with Google</span>
            </Button>
            {APPLE_ENABLED && (
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                disabled={busy}
                loading={busyTarget === 'oauth:Apple'}
                onClick={() => handleOauth(signInWithApple, 'Apple')}
              >
                <AppleIcon />
                <span className="ml-2">Continue with Apple</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3 px-2">
            <div className="flex-1 h-px bg-[var(--modes-border)]" />
            <span className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-[var(--modes-border)]" />
          </div>

          <form onSubmit={handleEmailSubmit} className="modes-card p-6 flex flex-col gap-4">
            <div className="flex p-1 bg-[var(--modes-surface-strong)] rounded-lg">
              <button
                type="button"
                onClick={() => { setEmailMode('magic'); setMessage(null); }}
                className={`flex-1 h-8 rounded-md text-label-12 font-semibold cursor-pointer border-none transition-colors ${
                  emailMode === 'magic' ? 'bg-[var(--ds-background-100)] text-[var(--modes-text)] shadow-sm' : 'bg-transparent text-[var(--modes-text-muted)]'
                }`}
              >
                Magic link
              </button>
              <button
                type="button"
                onClick={() => { setEmailMode('password'); setMessage(null); }}
                className={`flex-1 h-8 rounded-md text-label-12 font-semibold cursor-pointer border-none transition-colors ${
                  emailMode === 'password' ? 'bg-[var(--ds-background-100)] text-[var(--modes-text)] shadow-sm' : 'bg-transparent text-[var(--modes-text-muted)]'
                }`}
              >
                Password
              </button>
            </div>

            {isSignUp && emailMode === 'password' && (
              <label className="flex flex-col gap-1">
                <span className="text-label-12 text-[var(--modes-text-muted)] uppercase tracking-wider">Name</span>
                <Input
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your name"
                />
              </label>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-label-12 text-[var(--modes-text-muted)] uppercase tracking-wider">Email</span>
              <Input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>

            {emailMode === 'password' && (
              <label className="flex flex-col gap-1">
                <span className="text-label-12 text-[var(--modes-text-muted)] uppercase tracking-wider">Password</span>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  required
                  minLength={isSignUp ? 8 : undefined}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
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
                  <span className={`text-label-12 mt-1 ${passwordTooShort ? 'text-[var(--ds-amber-900)]' : 'text-[var(--modes-text-dim)]'}`}>
                    At least 8 characters.
                  </span>
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
              disabled={busy || !email}
              loading={busyTarget === 'submit'}
            >
              {emailMode === 'magic'
                ? 'Send magic link'
                : isSignUp
                  ? 'Create account'
                  : 'Sign in'}
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="md"
              className="w-full"
              disabled={busy}
              onClick={() => { setMode(isSignUp ? 'signin' : 'signup'); setMessage(null); }}
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
