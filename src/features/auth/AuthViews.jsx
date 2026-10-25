import { useId, useState } from 'react';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';
import { Alert } from '@/ui/shadcn/alert';
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from '@/ui/shadcn/field';
import { AuthLayout, AuthHeader, AuthActions, LogoMark, ChurchBadge, TextLink } from './AuthLayout';

// The signed-out screens as plain views: values in, events out, no Supabase.
// AuthScreen and WelcomeScreen hold the state; /design renders these with
// sample values so the gallery is the real thing, not a picture of it.

const EyeIcon = ({ off }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M4 4l16 16" />}
  </svg>
);

function PasswordInput({ id, ...props }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={shown ? 'text' : 'password'} className="pr-12" {...props} />
      <button
        type="button"
        onClick={() => setShown(s => !s)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-controls={id}
        className="absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-control border-0 bg-transparent text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <EyeIcon off={shown} />
      </button>
    </div>
  );
}

// Bring a focused field above the on-screen keyboard once it has opened.
function scrollFieldIntoView(e) {
  const el = e.target;
  setTimeout(() => {
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch { /* ignore */ }
  }, 300);
}

function Message({ message }) {
  if (!message) return null;
  const variant = message.kind === 'error' ? 'danger' : message.kind === 'success' ? 'success' : 'info';
  return <Alert variant={variant}>{message.text}{message.action}</Alert>;
}

/** The mark over a form: our logo, or the church's badge while joining. */
function markFor(joining) {
  return joining
    ? <ChurchBadge name={joining.name} logoUrl={joining.logoUrl} initials={joining.initials} />
    : <LogoMark />;
}

// ── Welcome ─────────────────────────────────────────────────────────────────

export function WelcomeView({ onCreateAccount, onLogIn, embedded }) {
  return (
    <AuthLayout embedded={embedded} className="gap-7">
      <div className="mt-24 flex flex-col items-center gap-3 text-center @min-[640px]:mt-0">
        <LogoMark size={56} />
        <div className="text-[20px] font-semibold tracking-[-0.5px]">
          setlists<span className="font-mono text-link">.md</span>
        </div>
        <h1 className="m-0 mt-5 text-display">Your band’s songs, ready for Sunday.</h1>
        <p className="m-0 text-body text-muted-foreground">Chord charts, setlists and who’s playing, all in one place.</p>
      </div>
      <AuthActions className="gap-2.5">
        <Button onClick={onCreateAccount}>Create account</Button>
        <Button variant="outline" onClick={onLogIn}>Log in</Button>
      </AuthActions>
      <p className="m-0 text-center text-small text-muted-foreground">Got a link from your church? Open it to join.</p>
    </AuthLayout>
  );
}

// ── Create account ──────────────────────────────────────────────────────────

/**
 * @param {object} values   { name, email, password, confirm }
 * @param {Function} onChange(field, value)
 * @param {object} [joining] { name, logoUrl, initials } — arriving from a church's link
 */
export function CreateAccountView({ values, onChange, onSubmit, onBack, onLogIn, onShowLegal, busy, message, joining, embedded }) {
  const uid = useId();
  const tooShort = values.password.length > 0 && values.password.length < 8;
  const mismatch = values.confirm.length > 0 && values.confirm !== values.password;
  const ready = values.email && values.password.length >= 8 && values.confirm === values.password;
  return (
    <AuthLayout onBack={onBack} embedded={embedded}>
      <AuthHeader
        mark={markFor(joining)}
        eyebrow={joining ? `Joining ${joining.name}` : null}
        title="Create your account"
        sub={joining ? 'Then you can ask to join.' : 'Your songs follow you to every device.'}
      />
      <form id={`${uid}-form`} onSubmit={(e) => { e.preventDefault(); if (ready) onSubmit(); }} noValidate>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${uid}-name`}>Your name</FieldLabel>
            <Input id={`${uid}-name`} autoComplete="name" placeholder="Maria Ionescu" value={values.name}
              onChange={e => onChange('name', e.target.value)} onFocus={scrollFieldIntoView} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${uid}-email`}>Email</FieldLabel>
            <Input id={`${uid}-email`} type="email" inputMode="email" autoComplete="email" placeholder="you@example.com"
              value={values.email} onChange={e => onChange('email', e.target.value)} onFocus={scrollFieldIntoView} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${uid}-password`}>Password</FieldLabel>
            <PasswordInput id={`${uid}-password`} autoComplete="new-password" value={values.password} aria-invalid={tooShort || undefined}
              aria-describedby={`${uid}-password-hint`} onChange={e => onChange('password', e.target.value)} onFocus={scrollFieldIntoView} />
            <FieldDescription id={`${uid}-password-hint`} className={tooShort ? 'text-danger-text' : undefined}>At least 8 characters.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${uid}-confirm`}>Confirm password</FieldLabel>
            <PasswordInput id={`${uid}-confirm`} autoComplete="new-password" value={values.confirm} aria-invalid={mismatch || undefined}
              onChange={e => onChange('confirm', e.target.value)} onFocus={scrollFieldIntoView} />
            <FieldError>{mismatch ? 'Passwords don’t match.' : null}</FieldError>
          </Field>
        </FieldGroup>
      </form>
      <Message message={message} />
      <AuthActions>
        <Button type="submit" form={`${uid}-form`} disabled={!ready} loading={busy === 'submit'}>
          {joining ? 'Create account and continue' : 'Create account'}
        </Button>
        <p className="m-0 text-center text-caption text-muted-foreground">
          By creating an account you agree to our{' '}
          <Button variant="link" className="underline" onClick={() => onShowLegal?.('terms')}>Terms</Button>
          {' '}and{' '}
          <Button variant="link" className="underline" onClick={() => onShowLegal?.('privacy')}>Privacy Policy</Button>.
        </p>
        <TextLink question="Already have an account?" answer="Log in" onClick={onLogIn} />
      </AuthActions>
    </AuthLayout>
  );
}

// ── Log in ──────────────────────────────────────────────────────────────────

export function LogInView({ values, onChange, onSubmit, onBack, onForgot, onCreateAccount, busy, message, joining, embedded }) {
  const uid = useId();
  const ready = values.email && values.password;
  return (
    <AuthLayout onBack={onBack} embedded={embedded}>
      <AuthHeader
        mark={markFor(joining)}
        eyebrow={joining ? `Joining ${joining.name}` : null}
        title={joining ? 'Log in to ask to join' : 'Welcome back'}
        sub={joining ? null : 'Log in to see this week’s songs.'}
      />
      <form id={`${uid}-form`} onSubmit={(e) => { e.preventDefault(); if (ready) onSubmit(); }} noValidate>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${uid}-email`}>Email</FieldLabel>
            <Input id={`${uid}-email`} type="email" inputMode="email" autoComplete="email" placeholder="you@example.com"
              value={values.email} onChange={e => onChange('email', e.target.value)} onFocus={scrollFieldIntoView} />
          </Field>
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor={`${uid}-password`}>Password</FieldLabel>
              <span className="text-caption"><Button variant="link" className="min-h-8" onClick={onForgot}>Forgot password?</Button></span>
            </div>
            <PasswordInput id={`${uid}-password`} autoComplete="current-password" value={values.password}
              onChange={e => onChange('password', e.target.value)} onFocus={scrollFieldIntoView} />
          </Field>
        </FieldGroup>
      </form>
      <Message message={message} />
      <AuthActions>
        <Button type="submit" form={`${uid}-form`} disabled={!ready} loading={busy === 'submit'}>
          {joining ? 'Log in and continue' : 'Log in'}
        </Button>
        <TextLink question="New here?" answer="Create an account" onClick={onCreateAccount} />
      </AuthActions>
    </AuthLayout>
  );
}

// ── Forgot password ─────────────────────────────────────────────────────────

export function ForgotPasswordView({ email, onChange, onSubmit, onBack, busy, message, sent, embedded }) {
  const uid = useId();
  return (
    <AuthLayout onBack={onBack} embedded={embedded}>
      <AuthHeader
        mark={<LogoMark />}
        title="Reset your password"
        sub="Type your email and we’ll send you a link to pick a new one."
      />
      <form id={`${uid}-form`} onSubmit={(e) => { e.preventDefault(); if (email) onSubmit(); }} noValidate>
        <Field>
          <FieldLabel htmlFor={`${uid}-email`}>Email</FieldLabel>
          <Input id={`${uid}-email`} type="email" inputMode="email" autoComplete="email" placeholder="you@example.com"
            value={email} onChange={e => onChange(e.target.value)} onFocus={scrollFieldIntoView} />
        </Field>
      </form>
      <Message message={message} />
      <AuthActions>
        <Button type="submit" form={`${uid}-form`} disabled={!email} loading={busy === 'reset'}>
          {sent ? 'Send it again' : 'Send reset link'}
        </Button>
        <TextLink question="Remembered it?" answer="Log in" onClick={onBack} />
      </AuthActions>
    </AuthLayout>
  );
}
