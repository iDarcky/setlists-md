import { useEffect, useState } from 'react';
import { signupSource, forgetSignupSource } from '@/lib/siteEntry';
import { useAuth } from '@/auth/useAuth';
import WebSheet from '@/features/legal/WebSheet';
import { termsAcceptance } from '@/features/legal/termsVersion';
import { friendlyAuthError } from './friendlyAuthError';
import { LAST_EMAIL_KEY, lastEmail } from '@/lib/lastEmail';
import { AuthLayout, AuthHeader, LogoMark } from './AuthLayout';
import { CreateAccountView, LogInView, ResetPasswordView, CheckEmailView } from '@/features/intro/IntroAuthViews';

const RESEND_COOLDOWN_MS = 30_000;


function rememberEmail(value) {
  if (!value) return;
  try { window.localStorage.setItem(LAST_EMAIL_KEY, value); } catch { /* ignore */ }
}

/**
 * Create account · Log in · Reset your password.
 *
 * @param {'signin'|'signup'} [defaultMode]
 * @param {object} [joining] { name, logoUrl, initials } — came from a church's
 *   join link: the church's badge replaces our logo and the copy says so.
 */
export default function AuthScreen({ onBack, onSignedIn, defaultMode = 'signin', joining = null }) {
  const { signInWithPassword, signUpWithPassword, resetPassword, resendVerification, isConfigured } = useAuth();

  const [mode, setMode] = useState(defaultMode); // 'signin' | 'signup' | 'reset'
  const [values, setValues] = useState(() => ({ name: '', email: lastEmail(), password: '' }));
  const [busy, setBusy] = useState(null); // which button is spinning
  const [message, setMessage] = useState(null); // { kind: 'info'|'success'|'error', text, action? }
  const [resetSent, setResetSent] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [legal, setLegal] = useState(null);
  const resendLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (resendAt <= now) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resendAt, now]);

  const change = (field, value) => setValues(v => ({ ...v, [field]: value }));
  // Switching screens keeps the email and drops the password (QA 21 Nov:
  // Log in → Create account carried both).
  const go = (next) => { setMode(next); setMessage(null); setResetSent(false); setValues(v => ({ ...v, password: '' })); };

  const run = async (target, fn) => {
    setBusy(target);
    setMessage(null);
    try { await fn(); } catch (err) { setMessage({ kind: 'error', text: friendlyAuthError(err) }); }
    finally { setBusy(null); }
  };

  const signUp = () => run('submit', async () => {
    const email = values.email.trim();
    const from = signupSource();
    const { data, error } = await signUpWithPassword(email, values.password, values.name.trim(), { ...(from ? { signup_from: from } : {}), ...termsAcceptance() });
    if (error) throw error;
    forgetSignupSource();
    rememberEmail(email);
    // With "Confirm email" off the account is live straight away.
    if (data?.session) { onSignedIn?.(); return; }
    setPendingVerification(email);
    setResendAt(Date.now() + RESEND_COOLDOWN_MS);
    setNow(Date.now());
  });

  const logIn = () => run('submit', async () => {
    const email = values.email.trim();
    const { error } = await signInWithPassword(email, values.password);
    if (error) throw error;
    rememberEmail(email);
    onSignedIn?.();
  });

  const sendReset = () => run('reset', async () => {
    const email = values.email.trim();
    const { error } = await resetPassword(email);
    if (error) throw error;
    rememberEmail(email);
    setResetSent(true);
    setResendAt(Date.now() + RESEND_COOLDOWN_MS);
    setNow(Date.now());
  });

  const resend = () => {
    if (!pendingVerification || resendLeft > 0) return;
    run('resend', async () => {
      const { error } = await resendVerification(pendingVerification);
      if (error) throw error;
      setResendAt(Date.now() + RESEND_COOLDOWN_MS);
      setNow(Date.now());
      setMessage({ kind: 'info', text: `Sent again to ${pendingVerification}.` });
    });
  };

  if (!isConfigured) {
    return (
      <AuthLayout onBack={onBack}>
        <AuthHeader
          mark={<LogoMark />}
          title="Accounts aren’t switched on"
          sub="This build has no Supabase settings. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to turn on accounts."
        />
      </AuthLayout>
    );
  }

  const resendReset = () => {
    if (resendLeft > 0) return;
    sendReset();
  };

  // B2: the link is on its way (confirm the account, or pick a new password).
  if (pendingVerification || (mode === 'reset' && resetSent)) {
    const confirming = !!pendingVerification;
    return (
      <CheckEmailView
        email={confirming ? pendingVerification : values.email.trim()}
        what={confirming ? 'a link to confirm your account' : 'a link to pick a new password'}
        ifAccount={!confirming}
        onResend={confirming ? resend : resendReset}
        onBack={() => { setPendingVerification(null); go(confirming ? 'signup' : 'signin'); }}
        resendLeft={resendLeft}
        busy={busy === 'resend' || busy === 'reset'}
        message={message}
      />
    );
  }

  return (
    <>
      {mode === 'signup' && (
        <CreateAccountView
          values={values}
          onChange={change}
          onSubmit={signUp}
          onBack={onBack}
          onLogIn={() => go('signin')}
          onShowLegal={setLegal}
          busy={busy}
          message={message}
          joining={joining}
        />
      )}
      {mode === 'signin' && (
        <LogInView
          values={values}
          onChange={change}
          onSubmit={logIn}
          onBack={onBack}
          onForgot={() => go('reset')}
          onCreateAccount={() => go('signup')}
          busy={busy}
          message={message}
          joining={joining}
        />
      )}
      {mode === 'reset' && (
        <ResetPasswordView
          email={values.email}
          onChange={(v) => change('email', v)}
          onSubmit={sendReset}
          onBack={() => go('signin')}
          busy={busy}
          message={message}
        />
      )}
      <WebSheet page={legal} onClose={() => setLegal(null)} />
    </>
  );
}
