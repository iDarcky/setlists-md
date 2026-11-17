import { useId } from 'react';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';
import { Alert } from '@/ui/shadcn/alert';
import { Toggle } from '@/ui/shadcn/toggle';
import { Field, FieldGroup, FieldLabel, FieldSet, FieldLegend, FieldDescription, FieldError } from '@/ui/shadcn/field';
import { AuthLayout, AuthHeader, AuthActions, SuccessBadge } from '@/features/auth/AuthLayout';
import { TeamIcon, MusicIcon, ChevronRightIcon, ClockIcon, CheckIcon } from '@/app/navIcons';
import { SIZES } from '@/lib/startFlow';

// The "after sign-up" screens as plain views (mockup "After sign-up: start a
// church or band"). StartFlow.jsx owns the state and the sending.

const LinkIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </svg>
);

const Square = ({ children }) => (
  <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-control bg-selected text-link">{children}</span>
);

function Choice({ icon, title, body, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-0 w-full cursor-pointer items-center gap-3.5 rounded-card border border-border bg-card p-4 text-left font-sans text-foreground outline-none transition-colors hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Square>{icon}</Square>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[16px] font-semibold leading-6">{title}</span>
        <span className="text-small text-muted-foreground">{body}</span>
      </span>
      <span className="shrink-0 text-muted-foreground"><ChevronRightIcon size={20} /></span>
    </button>
  );
}

// ── 1. What are you setting up? ─────────────────────────────────────────────
export function ChooseView({ name, onChurch, onBand, onInvite, onSignOut, embedded }) {
  return (
    <AuthLayout embedded={embedded}>
      <AuthHeader title="What are you setting up?" sub={`${name ? `Hi ${name}, your` : 'Your'} account is ready. One more step.`} />
      <div className="flex flex-col gap-3">
        <Choice icon={<TeamIcon size={22} />} title="A church" body="Services, a schedule and up to 30 people." onClick={onChurch} />
        <Choice icon={<MusicIcon size={22} />} title="A band or small group" body="Shared songs and setlists for up to 10 people." onClick={onBand} />
        <Choice icon={<LinkIcon />} title="I have an invite link" body="Join the church or band that invited you." onClick={onInvite} />
      </div>
      <AuthActions className="gap-1.5">
        <p className="m-0 text-center text-caption text-muted-foreground">Everything is free during the beta.</p>
        <Button variant="ghost" className="hover:bg-transparent" onClick={onSignOut}>Log out</Button>
      </AuthActions>
    </AuthLayout>
  );
}

// ── 2. Tell us about your church / band ─────────────────────────────────────
export function RequestView({ kind = 'church', values, onChange, tried, onSubmit, onBack, busy, message, embedded }) {
  const uid = useId();
  const band = kind === 'band';
  const set = (k) => (e) => onChange({ ...values, [k]: e.target.value });
  const missing = { church: !values.church.trim(), place: !values.place.trim() };
  return (
    <AuthLayout embedded={embedded} onBack={onBack}>
      <AuthHeader
        title={band ? 'Tell us about your band' : 'Tell us about your church'}
        sub={`During the beta we set up each ${band ? 'band' : 'church'} ourselves. It takes a minute to ask.`}
      />
      <form id={`${uid}-form`} onSubmit={(e) => { e.preventDefault(); onSubmit(); }} noValidate>
        <FieldGroup className="gap-6">
          <Field>
            <FieldLabel htmlFor={`${uid}-name`}>{band ? 'Band or group name' : 'Church name'}</FieldLabel>
            <Input id={`${uid}-name`} autoComplete="organization" maxLength={120} value={values.church} onChange={set('church')} aria-invalid={tried && missing.church} />
            {tried && missing.church && <FieldError>Add the name your {band ? 'band' : 'church'} goes by.</FieldError>}
          </Field>
          <Field>
            <FieldLabel htmlFor={`${uid}-place`}>City and country</FieldLabel>
            <Input id={`${uid}-place`} autoComplete="address-level2" maxLength={120} value={values.place} onChange={set('place')} aria-invalid={tried && missing.place} />
            {tried && missing.place && <FieldError>Add where it is, so we can tell it apart.</FieldError>}
          </Field>
          <FieldSet>
            <FieldLegend>How many people play or sing?</FieldLegend>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {SIZES[band ? 'band' : 'church'].map(s => (
                <Toggle key={s} variant="option" pressed={values.people === s} onPressedChange={(on) => onChange({ ...values, people: on ? s : '' })}>{s}</Toggle>
              ))}
            </div>
          </FieldSet>
          <Field>
            <FieldLabel htmlFor={`${uid}-note`}>Anything we should know? <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel>
            <Input id={`${uid}-note`} maxLength={600} value={values.note} onChange={set('note')} />
            <FieldDescription>{band ? 'For example: the youth band at our church.' : 'For example: two services on Sunday.'}</FieldDescription>
          </Field>
        </FieldGroup>
      </form>
      {message && <Alert variant="danger">{message}</Alert>}
      <AuthActions>
        <Button type="submit" form={`${uid}-form`} loading={busy}>Send request</Button>
      </AuthActions>
    </AuthLayout>
  );
}

// ── 3. Waiting for approval ─────────────────────────────────────────────────
function Step({ state, title, sub }) {
  return (
    <li className="flex items-start gap-3.5 border-t border-border py-3.5 last:border-b">
      <span
        aria-hidden="true"
        className={
          state === 'done' ? 'mt-px flex size-6 shrink-0 items-center justify-center rounded-full bg-link text-background'
          : state === 'now' ? 'mt-px size-6 shrink-0 rounded-full border-2 border-link bg-link shadow-[inset_0_0_0_4px_var(--background)]'
          : 'mt-px size-6 shrink-0 rounded-full border border-input'
        }
      >
        {state === 'done' && <CheckIcon size={14} />}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px] font-medium">{title}</span>
        {sub && <span className="text-caption text-muted-foreground">{sub}</span>}
      </span>
    </li>
  );
}

export function WaitingApprovalView({ church, email, sentLabel, onChange, onSignOut, embedded }) {
  return (
    <AuthLayout embedded={embedded}>
      <AuthHeader
        mark={<Square><ClockIcon size={24} /></Square>}
        title="Waiting for approval"
        sub={<>We’re setting up <b className="font-semibold text-foreground">{church}</b>. We’ll email {email || 'you'} when it’s ready, usually within two days.</>}
      />
      <ol className="m-0 flex list-none flex-col p-0" aria-label="What happens next">
        <Step state="done" title="Request sent" sub={sentLabel} />
        <Step state="now" title={`We set up ${church}`} sub="Usually within two days" />
        <Step title="You invite your band with one link" />
      </ol>
      <p className="m-0 rounded-card border border-border bg-card px-4 py-3.5 text-small text-muted-foreground">
        <b className="font-semibold text-foreground">While you wait:</b> add Setlists.md to your Home Screen, so it opens full screen and works offline.{' '}
        <a className="text-link" href="https://setlists.md/help#install" target="_blank" rel="noreferrer">Show me how</a>
      </p>
      <AuthActions className="gap-1.5">
        <Button variant="ghost" className="hover:bg-transparent" onClick={onChange}>Change the request</Button>
        <Button variant="ghost" className="hover:bg-transparent" onClick={onSignOut}>Log out</Button>
      </AuthActions>
    </AuthLayout>
  );
}

// ── 4. Ready ────────────────────────────────────────────────────────────────
export function ReadyView({ church, onInvite, onOpen, embedded }) {
  return (
    <AuthLayout embedded={embedded}>
      <AuthHeader mark={<SuccessBadge />} title={`${church} is ready`} sub="Invite your band with one link. You approve each person who asks to join." />
      <AuthActions className="gap-1.5">
        <Button onClick={onInvite}>Invite your band</Button>
        <Button variant="ghost" className="hover:bg-transparent" onClick={onOpen}>Open {church}</Button>
      </AuthActions>
    </AuthLayout>
  );
}

// ── 2c. I have an invite link ───────────────────────────────────────────────
export function InviteLinkView({ value, onChange, onSubmit, onBack, message, embedded }) {
  const uid = useId();
  return (
    <AuthLayout embedded={embedded} onBack={onBack}>
      <AuthHeader title="Open your invite link" sub="Your leader sent you a link that starts with setlists.md/join. Tap it in your messages, or paste it here." />
      <form id={`${uid}-form`} onSubmit={(e) => { e.preventDefault(); onSubmit(); }} noValidate>
        <Field>
          <FieldLabel htmlFor={`${uid}-link`}>Invite link</FieldLabel>
          <Input id={`${uid}-link`} inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="setlists.md/join/…"
            value={value} onChange={e => onChange(e.target.value)} aria-invalid={!!message} />
          {message && <FieldError>{message}</FieldError>}
        </Field>
      </form>
      <AuthActions className="gap-1.5">
        <Button type="submit" form={`${uid}-form`} disabled={!value.trim()}>Join</Button>
        <p className="m-0 text-center text-caption text-muted-foreground">No link? Ask your worship leader to send one.</p>
      </AuthActions>
    </AuthLayout>
  );
}
