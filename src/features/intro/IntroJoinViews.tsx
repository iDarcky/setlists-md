// Joining from a code or a link (mockup "first-run v9", 2026-11-20): the
// invite, Waiting for a leader, You're in, Didn't let you in, and the
// link that doesn't work. Values in, events out: JoinFlow holds the
// state. `church` is { name, logoUrl, initials } from the link's peek.
import { joinPartLabel } from '@/lib/joinLink';
import { AuthLayout, AuthHeader, AuthActions, Alert, Button, Badge, Card, CardLabel, ChurchBadge, SuccessBadge, LogoMark } from './ui';
import { FormActions, Legal, ProviderButtons } from './IntroParts';
import type { ProviderProps } from './IntroParts';

export interface Church { name?: string | null; logoUrl?: string | null; initials?: string | null }

const badge = (church?: Church | null, quiet?: boolean) => (
  <ChurchBadge name={church?.name} logoUrl={church?.logoUrl} initials={church?.initials} quiet={quiet} />
);
const nameOf = (church?: Church | null) => church?.name || 'the team';

// ── J1 The invite link, signed out ──────────────────────────────────────────

export function JoinInviteView({ church, invitedBy, onShowLegal, error, embedded, ...providers }: ProviderProps & {
  church?: Church | null; invitedBy?: string | null; onShowLegal?: (page: 'terms' | 'privacy') => void;
  error?: string | null; embedded?: boolean;
}) {
  return (
    <AuthLayout embedded={embedded} className="gap-7">
      <div className="mt-20 flex flex-col gap-4 @min-[640px]:mt-0">
        {badge(church)}
        <h1 className="m-0 text-display">Join {nameOf(church)} on Setlists.md</h1>
        <p className="m-0 text-body text-muted-foreground">
          {invitedBy ? `${invitedBy} invited you. A leader lets you in.` : 'A leader lets you in.'}
        </p>
      </div>
      <AuthActions className="gap-2.5">
        {error && <Alert variant="danger">{error}</Alert>}
        <ProviderButtons {...providers} />
        <Legal onShowLegal={onShowLegal} />
      </AuthActions>
    </AuthLayout>
  );
}

// ── J2 Waiting for a leader ─────────────────────────────────────────────────

export function WaitingView({ church, name, parts, onSignOut, embedded }: {
  church?: Church | null; name?: string; parts: string[]; onSignOut: () => void; embedded?: boolean;
}) {
  return (
    <AuthLayout embedded={embedded}>
      {badge(church)}
      <AuthHeader title="Waiting for a leader" sub="This opens by itself once you’re let in." />
      <Card>
        <CardLabel>What you sent</CardLabel>
        <span className="text-body font-semibold">{name || 'You'}</span>
        {parts.length > 0
          ? <div className="flex flex-wrap gap-1.5">{parts.map(p => <Badge key={p} variant="neutral" className="text-foreground">{joinPartLabel(p)}</Badge>)}</div>
          : <span className="text-small text-muted-foreground">No instruments picked.</span>}
      </Card>
      <AuthActions>
        <Button variant="ghost" className="hover:bg-transparent" onClick={onSignOut}>Log out</Button>
      </AuthActions>
    </AuthLayout>
  );
}

// ── J3 You're in ────────────────────────────────────────────────────────────

export function YoureInView({ church, leaderName, onContinue, embedded }: {
  church?: Church | null; leaderName?: string | null; onContinue: () => void; embedded?: boolean;
}) {
  return (
    <AuthLayout embedded={embedded}>
      <SuccessBadge />
      <AuthHeader title={`You’re in ${nameOf(church)}`} sub={leaderName ? `${leaderName} let you in.` : undefined} />
      <FormActions><Button onClick={onContinue}>Continue</Button></FormActions>
    </AuthLayout>
  );
}

// ── J4 Didn't let you in ────────────────────────────────────────────────────

export function DeclinedView({ church, onAnotherCode, onSignOut, embedded }: {
  church?: Church | null; onAnotherCode: () => void; onSignOut: () => void; embedded?: boolean;
}) {
  return (
    <AuthLayout embedded={embedded}>
      {badge(church, true)}
      <AuthHeader title={`${church?.name || 'The team'} didn’t let you in`} sub="If that’s a mistake, ask your leader to send a new code." />
      <FormActions>
        <Button variant="outline" onClick={onAnotherCode}>Enter another code</Button>
        <Button variant="ghost" className="hover:bg-transparent" onClick={onSignOut}>Log out</Button>
      </FormActions>
    </AuthLayout>
  );
}

// ── The link doesn't work ───────────────────────────────────────────────────

const BAD_LINK_COPY = {
  invalid: ['This invite doesn’t work', 'It may have been reset. Ask your leader for the new code.'],
  disabled: ['This invite is paused', 'Ask your leader to turn the invite back on.'],
  network: ['Couldn’t open this invite', 'Check your connection and try again.'],
} as const;

export function BadLinkView({ reason = 'invalid', onRetry, onOpenApp, embedded }: {
  reason?: keyof typeof BAD_LINK_COPY; onRetry?: () => void; onOpenApp: () => void; embedded?: boolean;
}) {
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
