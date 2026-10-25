import { useId } from 'react';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';
import { Alert } from '@/ui/shadcn/alert';
import { Badge } from '@/ui/shadcn/badge';
import { Card, CardLabel } from '@/ui/shadcn/card';
import { Toggle } from '@/ui/shadcn/toggle';
import { Field, FieldGroup, FieldLabel, FieldSet, FieldLegend, FieldDescription } from '@/ui/shadcn/field';
import { AuthLayout, AuthHeader, AuthActions, ChurchBadge, LogoMark, SuccessBadge } from '@/features/auth/AuthLayout';
import { JOIN_PARTS, joinPartLabel, toggleJoinPart } from '@/lib/joinLink';

// The joining screens as plain views (see AuthViews.jsx for why). `church` is
// { name, logoUrl, initials } from the join link's peek.

const badge = (church, quiet) => (
  <ChurchBadge name={church?.name} logoUrl={church?.logoUrl} initials={church?.initials} quiet={quiet} />
);

// ── Invite ──────────────────────────────────────────────────────────────────

export function JoinInviteView({ church, alreadyIn, onCreateAccount, onLogIn, onNotNow, embedded }) {
  return (
    <AuthLayout embedded={embedded}>
      <div className="mt-10 @min-[640px]:mt-0">
        <AuthHeader
          mark={badge(church)}
          eyebrow={church?.name}
          size="display"
          title="You’re invited to the worship team"
          sub="Ask to join and a leader will let you in. Nothing to install yet."
        />
      </div>
      {alreadyIn && (
        <p className="m-0 border-t border-border pt-4 text-small text-muted-foreground">{alreadyIn}.</p>
      )}
      <AuthActions className="gap-2.5">
        <Button onClick={onCreateAccount}>Create account</Button>
        <Button variant="outline" onClick={onLogIn}>I have an account</Button>
        <Button variant="ghost" className="hover:bg-transparent" onClick={onNotNow}>Not now</Button>
      </AuthActions>
    </AuthLayout>
  );
}

// ── About you ───────────────────────────────────────────────────────────────

export function AboutYouView({ church, name, onNameChange, parts, onPartsChange, onSubmit, onNotNow, busy, message, embedded }) {
  const uid = useId();
  const ready = !!name.trim();
  return (
    <AuthLayout embedded={embedded}>
      <AuthHeader mark={badge(church)} eyebrow={`Joining ${church?.name || 'the church'}`} title="Tell the leader who you are" />
      <form id={`${uid}-form`} onSubmit={(e) => { e.preventDefault(); onSubmit(); }} noValidate>
        <FieldGroup className="gap-6">
          <Field>
            <FieldLabel htmlFor={`${uid}-name`}>Your name</FieldLabel>
            <Input id={`${uid}-name`} autoComplete="name" maxLength={80} placeholder="First and last name"
              value={name} onChange={e => onNameChange(e.target.value)} />
          </Field>
          <FieldSet>
            <FieldLegend>What do you play or sing?</FieldLegend>
            <FieldDescription>Pick all that fit.</FieldDescription>
            <div className="mt-1 flex flex-wrap gap-2">
              {JOIN_PARTS.map(p => (
                <Toggle key={p.id} pressed={parts.includes(p.id)} onPressedChange={() => onPartsChange(toggleJoinPart(parts, p.id))}>
                  {p.label}
                </Toggle>
              ))}
            </div>
          </FieldSet>
        </FieldGroup>
      </form>
      {message && <Alert variant="danger">{message}</Alert>}
      <AuthActions className="gap-1.5">
        <Button type="submit" form={`${uid}-form`} disabled={!ready} loading={busy}>Ask to join</Button>
        <Button variant="ghost" className="hover:bg-transparent" onClick={onNotNow}>Not now</Button>
      </AuthActions>
    </AuthLayout>
  );
}

// ── Waiting ─────────────────────────────────────────────────────────────────

export function WaitingView({ church, name, parts, onSignOut, embedded }) {
  return (
    <AuthLayout embedded={embedded}>
      <AuthHeader
        mark={badge(church)}
        eyebrow={church?.name}
        title="Waiting for a leader"
        sub={`We’ve asked ${church?.name || 'the church'}. This screen opens the app by itself once you’re let in.`}
      />
      <Card>
        <CardLabel>What you sent</CardLabel>
        <span className="text-body font-semibold">{name || 'You'}</span>
        {parts.length > 0
          ? <div className="flex flex-wrap gap-1.5">{parts.map(p => <Badge key={p}>{joinPartLabel(p)}</Badge>)}</div>
          : <span className="text-small text-muted-foreground">No instruments picked.</span>}
        <div role="status" className="mt-0.5 flex items-center gap-2.5 border-t border-border pt-3 text-small text-muted-foreground">
          <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-link shadow-[0_0_0_4px_var(--selected)]" />
          Waiting for a leader to say yes
        </div>
      </Card>
      <AuthActions className="gap-0.5">
        <p className="m-0 text-center text-small text-muted-foreground">Using someone else’s phone?</p>
        <Button variant="ghost" className="text-link hover:bg-transparent hover:text-link" onClick={onSignOut}>Sign out</Button>
      </AuthActions>
    </AuthLayout>
  );
}

// ── You're in ───────────────────────────────────────────────────────────────

function Step({ n, done, title, body, action }) {
  return (
    <div className="flex items-start gap-3.5 border-t border-border py-4">
      <span
        aria-hidden="true"
        className={done
          ? 'mt-px flex size-6 shrink-0 items-center justify-center rounded-full bg-success-fill text-success-text'
          : 'mt-px flex size-6 shrink-0 items-center justify-center rounded-full border border-input font-mono text-[12px] font-semibold text-muted-foreground'}
      >
        {done
          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          : n}
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="text-small text-muted-foreground">{body}</span>
        {action && <div className="mt-1.5">{action}</div>}
      </div>
    </div>
  );
}

/**
 * @param {Array} steps [{ title, body, done, action: { label, onClick, primary, busy } }]
 */
export function YoureInView({ church, steps, onSkip, embedded }) {
  return (
    <AuthLayout embedded={embedded}>
      <AuthHeader
        mark={<SuccessBadge />}
        eyebrow={church?.name}
        size="display"
        title="You’re in!"
        sub="Three quick things and you’re ready for Sunday."
      />
      <div className="flex flex-col">
        {steps.map((s, i) => (
          <Step
            key={s.title}
            n={i + 1}
            done={s.done}
            title={s.title}
            body={s.body}
            action={s.action && (
              <Button size="sm" variant={s.action.primary ? 'default' : 'outline'} loading={s.action.busy} onClick={s.action.onClick}>
                {s.action.label}
              </Button>
            )}
          />
        ))}
      </div>
      <AuthActions>
        <Button variant="outline" onClick={onSkip}>Skip to Home</Button>
      </AuthActions>
    </AuthLayout>
  );
}

// ── Not approved ────────────────────────────────────────────────────────────

export function DeclinedView({ church, onOpenApp, onSignOut, embedded }) {
  const who = church?.name || 'The church';
  return (
    <AuthLayout embedded={embedded}>
      <AuthHeader
        mark={badge(church, true)}
        eyebrow={church?.name}
        title="Not this time"
        sub={`${who} didn’t approve this request. If that’s a mistake, talk to your worship leader. They can send you the link again.`}
      />
      <AuthActions className="gap-1.5">
        <Button variant="outline" onClick={onOpenApp}>Open Setlists.md</Button>
        <Button variant="ghost" className="hover:bg-transparent" onClick={onSignOut}>Sign out</Button>
      </AuthActions>
    </AuthLayout>
  );
}

// ── The link doesn't work ───────────────────────────────────────────────────

const BAD_LINK_COPY = {
  invalid: ['This invite link doesn’t work', 'It may have been reset. Ask your worship leader for the new link.'],
  disabled: ['This invite is paused', 'The church has switched its join link off for now. Ask your worship leader to turn it back on.'],
  network: ['Couldn’t open this invite', 'Check your connection and try the link again.'],
};

/** @param {'invalid'|'disabled'|'network'} reason */
export function BadLinkView({ reason = 'invalid', onRetry, onOpenApp, embedded }) {
  const [title, sub] = BAD_LINK_COPY[reason] || BAD_LINK_COPY.invalid;
  return (
    <AuthLayout embedded={embedded}>
      <AuthHeader mark={<LogoMark />} title={title} sub={sub} />
      <AuthActions>
        {reason === 'network' && <Button onClick={onRetry}>Try again</Button>}
        <Button variant="outline" onClick={onOpenApp}>Open Setlists.md</Button>
      </AuthActions>
    </AuthLayout>
  );
}

/** While the link is being checked. */
export function OpeningView({ embedded }) {
  return (
    <AuthLayout embedded={embedded}>
      <div role="status" className="my-auto flex flex-col items-center gap-3 text-small text-muted-foreground">
        <LogoMark size={56} />
        Opening your invite…
      </div>
    </AuthLayout>
  );
}
