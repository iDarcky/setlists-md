// The signed-out screens (mockup "first-run v9", 2026-11-20): Welcome, Log in,
// Create account, Reset your password, Check your email, Pick a new password,
// Signing you in. Values in, events out, no Supabase: AuthScreen,
// WelcomeScreen, RecoveryScreen and AuthCallback hold the state.
import { useId } from 'react';
import { Mail, TriangleAlert } from 'lucide-react';
import { AuthLayout, AuthHeader, AuthActions, TextLink, Button, LabelInput, Alert, Spinner, ChurchBadge, SuccessBadge } from './ui';
import { ChordHeadline, FormActions, IconSquare, Legal, ProviderButtons, Wordmark } from './IntroParts';
import { scrollFieldIntoView } from './scrollFieldIntoView';
import type { Message, ProviderProps } from './IntroParts';

export interface Joining { name?: string | null; logoUrl?: string | null; initials?: string | null }

function Note({ message }: { message?: Message | null }) {
  if (!message) return null;
  const variant = message.kind === 'error' ? 'danger' : message.kind === 'success' ? 'success' : 'info';
  return <Alert variant={variant}>{message.text}{message.action}</Alert>;
}

const joinMark = (joining?: Joining | null) =>
  joining ? <ChurchBadge name={joining.name} logoUrl={joining.logoUrl} initials={joining.initials} /> : undefined;

// ── A1 Welcome ──────────────────────────────────────────────────────────────

export function WelcomeView({ embedded, onShowLegal, error, ...providers }: ProviderProps & {
  embedded?: boolean; onShowLegal?: (page: 'terms' | 'privacy') => void; error?: string | null;
}) {
  return (
    <AuthLayout embedded={embedded} className="gap-7">
      {/* Logo on top, the headline alone in the middle, the buttons at the bottom (no subtitle, 2026-11-20). */}
      <div className="flex justify-center"><Wordmark /></div>
      <div className="flex flex-1 items-center justify-center @min-[640px]:flex-none @min-[640px]:py-12"><ChordHeadline /></div>
      <AuthActions className="gap-2.5">
        {error && <Alert variant="danger">{error}</Alert>}
        <ProviderButtons {...providers} />
        <Legal onShowLegal={onShowLegal} />
      </AuthActions>
    </AuthLayout>
  );
}

// ── A4 Log in ───────────────────────────────────────────────────────────────

export interface LogInValues { name: string; email: string; password: string }

interface FormProps {
  values: LogInValues;
  onChange: (field: keyof LogInValues, value: string) => void;
  onSubmit: () => void;
  onBack?: () => void;
  busy?: string | null;
  message?: Message | null;
  joining?: Joining | null;
  embedded?: boolean;
}

export function LogInView({ values, onChange, onSubmit, onBack, onForgot, onCreateAccount, busy, message, joining, embedded }: FormProps & {
  onForgot: () => void; onCreateAccount: () => void;
}) {
  const uid = useId();
  const ready = !!(values.email && values.password);
  return (
    <AuthLayout onBack={onBack} embedded={embedded}>
      <AuthHeader mark={joinMark(joining)} eyebrow={joining?.name ? `Joining ${joining.name}` : undefined} title="Log in" />
      <form id={`${uid}-form`} onSubmit={(e) => { e.preventDefault(); if (ready) onSubmit(); }} noValidate>
        <div className="flex flex-col gap-3">
          <LabelInput fill label="Email" type="email" inputMode="email" autoComplete="email" name="email"
            value={values.email} onChange={e => onChange('email', e.target.value)} onFocus={scrollFieldIntoView} />
          <LabelInput fill label="Password" type="password" autoComplete="current-password" name="password"
            value={values.password} onChange={e => onChange('password', e.target.value)} onFocus={scrollFieldIntoView} />
          <div className="-mt-1 flex justify-end">
            <Button variant="link" className="min-h-8 text-small" onClick={onForgot}>Forgot password?</Button>
          </div>
        </div>
      </form>
      <Note message={message} />
      <FormActions>
        <Button type="submit" form={`${uid}-form`} disabled={!ready} loading={busy === 'submit'}>Log in</Button>
        <TextLink question="New here?" answer="Create an account" onClick={onCreateAccount} />
      </FormActions>
    </AuthLayout>
  );
}

// ── A2 Create account ───────────────────────────────────────────────────────

export function CreateAccountView({ values, onChange, onSubmit, onBack, onLogIn, onShowLegal, busy, message, joining, embedded }: FormProps & {
  onLogIn: () => void; onShowLegal?: (page: 'terms' | 'privacy') => void;
}) {
  const uid = useId();
  const tooShort = values.password.length > 0 && values.password.length < 8;
  const ready = !!(values.name.trim() && values.email && values.password.length >= 8);
  return (
    <AuthLayout onBack={onBack} embedded={embedded}>
      <AuthHeader mark={joinMark(joining)} eyebrow={joining?.name ? `Joining ${joining.name}` : undefined} title="Create your account" />
      <form id={`${uid}-form`} onSubmit={(e) => { e.preventDefault(); if (ready) onSubmit(); }} noValidate>
        <div className="flex flex-col gap-3">
          <LabelInput fill label="Your name" autoComplete="name" name="name" value={values.name}
            onChange={e => onChange('name', e.target.value)} onFocus={scrollFieldIntoView} />
          <LabelInput fill label="Email" type="email" inputMode="email" autoComplete="email" name="email"
            value={values.email} onChange={e => onChange('email', e.target.value)} onFocus={scrollFieldIntoView} />
          <LabelInput fill label="Password" type="password" autoComplete="new-password" name="new-password"
            value={values.password} onChange={e => onChange('password', e.target.value)} onFocus={scrollFieldIntoView}
            error={tooShort ? 'At least 8 characters.' : null} hint="At least 8 characters." />
        </div>
      </form>
      <Note message={message} />
      <FormActions>
        <Button type="submit" form={`${uid}-form`} disabled={!ready} loading={busy === 'submit'}>Create account</Button>
        <Legal verb="creating an account" onShowLegal={onShowLegal} />
        <TextLink question="Already have an account?" answer="Log in" onClick={onLogIn} />
      </FormActions>
    </AuthLayout>
  );
}

// ── B1 Reset your password ──────────────────────────────────────────────────

export function ResetPasswordView({ email, onChange, onSubmit, onBack, busy, message, embedded }: {
  email: string; onChange: (v: string) => void; onSubmit: () => void; onBack?: () => void;
  busy?: string | null; message?: Message | null; embedded?: boolean;
}) {
  const uid = useId();
  return (
    <AuthLayout onBack={onBack} embedded={embedded}>
      <AuthHeader title="Reset your password" />
      <form id={`${uid}-form`} onSubmit={(e) => { e.preventDefault(); if (email) onSubmit(); }} noValidate>
        <LabelInput fill label="Email" type="email" inputMode="email" autoComplete="email" name="email"
          value={email} onChange={e => onChange(e.target.value)} onFocus={scrollFieldIntoView} />
      </form>
      <Note message={message} />
      <FormActions>
        <Button type="submit" form={`${uid}-form`} disabled={!email} loading={busy === 'reset'}>Send reset link</Button>
      </FormActions>
    </AuthLayout>
  );
}

// ── B2 Check your email ─────────────────────────────────────────────────────

/**
 * After "Send reset link", and after signing up when the email must be confirmed.
 * @param ifAccount the reset wording: no promise the email has an account
 * @param resendLeft seconds until "Send it again" works again (0 = now)
 */
export function CheckEmailView({ email, what = 'a link', ifAccount = false, onResend, onBack, resendLeft = 0, busy, message, embedded }: {
  email: string; what?: string; ifAccount?: boolean; onResend: () => void; onBack?: () => void;
  resendLeft?: number; busy?: boolean; message?: Message | null; embedded?: boolean;
}) {
  return (
    <AuthLayout onBack={onBack} embedded={embedded}>
      <IconSquare><Mail size={22} strokeWidth={1.8} /></IconSquare>
      <AuthHeader
        title="Check your email"
        sub={ifAccount
          // A reset never says whether the email has an account (the usual
          // rule, so nobody can check who signed up). QA 21 Nov.
          ? <>If an account uses <b className="font-medium text-foreground">{email}</b>, we sent it {what}.</>
          : <>We sent {what} to <b className="font-medium text-foreground">{email}</b>.</>}
      />
      <Note message={message} />
      <FormActions>
        {resendLeft > 0 || busy
          ? <p className="m-0 flex min-h-11 items-center justify-center text-body text-muted-foreground">
              {busy ? 'Sending…' : `Nothing yet? Send it again in ${resendLeft}s`}
            </p>
          : <TextLink question="Nothing yet?" answer="Send it again" onClick={onResend} />}
      </FormActions>
    </AuthLayout>
  );
}

// ── B3 Pick a new password ──────────────────────────────────────────────────

export function NewPasswordView({ password, onChange, onSubmit, onBack, busy, message, done, embedded }: {
  password: string; onChange: (v: string) => void; onSubmit: () => void; onBack?: () => void;
  busy?: boolean; message?: Message | null; done?: boolean; embedded?: boolean;
}) {
  const uid = useId();
  const tooShort = password.length > 0 && password.length < 8;
  const ready = password.length >= 8;
  if (done) {
    return (
      <AuthLayout embedded={embedded}>
        <AuthHeader mark={<SuccessBadge />} title="Password changed" sub="You’re logged in." />
      </AuthLayout>
    );
  }
  return (
    <AuthLayout onBack={onBack} embedded={embedded}>
      <AuthHeader title="Pick a new password" />
      <form id={`${uid}-form`} onSubmit={(e) => { e.preventDefault(); if (ready) onSubmit(); }} noValidate>
        <LabelInput fill label="New password" type="password" autoComplete="new-password" name="new-password"
          value={password} onChange={e => onChange(e.target.value)} onFocus={scrollFieldIntoView}
          error={tooShort ? 'At least 8 characters.' : null} hint="At least 8 characters." />
      </form>
      <Note message={message} />
      <FormActions>
        <Button type="submit" form={`${uid}-form`} disabled={!ready} loading={busy}>Save and log in</Button>
      </FormActions>
    </AuthLayout>
  );
}

// ── B4 Signing you in ───────────────────────────────────────────────────────

export function SigningInView({ error, onBack, label = 'Signing you in…', embedded }: {
  error?: string | null; onBack?: () => void; label?: string; embedded?: boolean;
}) {
  if (error) {
    return (
      <AuthLayout embedded={embedded}>
        <AuthHeader title="That sign-in didn’t work" sub={error} />
        <FormActions><Button onClick={onBack}>Try again</Button></FormActions>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout embedded={embedded}>
      <div role="status" className="m-auto flex flex-col items-center gap-4 text-muted-foreground">
        <Spinner className="size-6" />
        <span className="text-body">{label}</span>
      </div>
    </AuthLayout>
  );
}

// ── E3 Delete your account ──────────────────────────────────────────────────

/**
 * What happens to the team the person owns decides the warning
 * (supabase/functions/delete-account): it passes to the earliest leader (or
 * the person who joined first), and the screen names them; when the owner is
 * alone in it, it goes too. An owner confirms by typing the team's name,
 * anyone else types DELETE (QA 22 Nov 2026: "lock" it, more danger, short).
 * `alone: null` while the people are still being counted.
 */
export type OwnedTeam = { name: string; alone: boolean | null; successor?: string | null } | null;

export function DeleteAccountView({ owned, teamName, confirm, onConfirmChange, onDelete, onCancel, busy, error, embedded }: {
  owned: OwnedTeam; teamName?: string | null; confirm: string; onConfirmChange: (v: string) => void;
  onDelete: () => void; onCancel: () => void; busy?: boolean; error?: string | null; embedded?: boolean;
}) {
  const uid = useId();
  const word = owned ? owned.name : 'DELETE';
  const checking = !!owned && owned.alone == null;
  const ready = !checking && confirm.trim().toLowerCase() === word.trim().toLowerCase();
  return (
    <AuthLayout onBack={onCancel} embedded={embedded}>
      <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center self-center rounded-control bg-danger-fill text-danger-text">
        <TriangleAlert size={22} strokeWidth={1.8} />
      </span>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="m-0 text-title text-danger-text">Delete your account?</h1>
        <p className="m-0 text-body text-muted-foreground">This can’t be undone.</p>
      </div>
      {owned && (checking
        ? <Alert variant="info">Checking who else is in {owned.name}…</Alert>
        : owned.alone
          ? <Alert variant="danger">You’re the only one in {owned.name}, so it’s deleted too, with all its songs and setlists.</Alert>
          : <Alert variant="info">{owned.successor || 'Another leader'} will own {owned.name}. The team, its songs and setlists stay.</Alert>)}
      {!owned && teamName && <p className="m-0 text-center text-small text-muted-foreground">Songs you added stay with {teamName}.</p>}
      <form id={`${uid}-form`} onSubmit={(e) => { e.preventDefault(); if (ready) onDelete(); }} noValidate>
        <LabelInput fill label={`Type ${word} to confirm`} autoComplete="off" autoCapitalize={owned ? 'none' : 'characters'} name="confirm-delete"
          value={confirm} onChange={e => onConfirmChange(e.target.value)} onFocus={scrollFieldIntoView} />
      </form>
      {error && <Alert variant="danger">{error}</Alert>}
      <FormActions>
        <Button type="submit" form={`${uid}-form`} variant="destructive" disabled={!ready} loading={busy}>Delete account</Button>
        <Button variant="ghost" className="hover:bg-transparent" onClick={onCancel} disabled={busy}>Cancel</Button>
      </FormActions>
    </AuthLayout>
  );
}
