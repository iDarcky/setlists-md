// Setting up after sign-in (mockup "first-run v9", 2026-11-20): Join or
// create, Enter your invite code, Paste a link, Name your team, What do you
// play?, Invite your team, Put Setlists.md on your phone, You already have a
// team. Values in, events out: StartFlow and JoinFlow hold the state.
import { useId } from 'react';
import type { ReactNode } from 'react';
import { Bell, Check, Copy, KeyRound, Link2, Plus, Share, Smartphone } from 'lucide-react';
import { AuthLayout, AuthHeader, AuthActions, TextLink, Button, LabelInput, Alert, Card, CardLabel, OneTimeCode } from './ui';
import { FormActions, IconSquare, PartPicker, Progress } from './IntroParts';
import { scrollFieldIntoView } from './scrollFieldIntoView';

export interface Step { step: number; of: number }

const Bar = ({ progress }: { progress?: Step }) => (progress ? <Progress step={progress.step} of={progress.of} /> : null);

// ── S1 Join or create ───────────────────────────────────────────────────────

function Tile({ icon, title, body, onClick }: { icon: ReactNode; title: string; body: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="material-base flex aspect-[4/5] cursor-pointer flex-col items-start gap-3 rounded-card p-4 text-left font-sans text-foreground outline-none transition-colors hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-control bg-raised text-foreground">{icon}</span>
      <span className="mt-auto flex min-h-[92px] flex-col gap-1">
        <span className="text-body font-semibold">{title}</span>
        <span className="text-small text-muted-foreground">{body}</span>
      </span>
    </button>
  );
}

export function JoinOrCreateView({ name, onJoin, onCreate, onSignOut, embedded }: {
  name?: string; onJoin: () => void; onCreate: () => void; onSignOut: () => void; embedded?: boolean;
}) {
  return (
    <AuthLayout embedded={embedded}>
      <AuthHeader title={name ? `Hi ${name}, let’s get you set up` : 'Let’s get you set up'} />
      <div className="grid grid-cols-2 gap-3">
        <Tile icon={<Link2 size={20} strokeWidth={1.8} />} title="Join a team" body="Your leader gave you a code or a link." onClick={onJoin} />
        <Tile icon={<Plus size={20} strokeWidth={1.8} />} title="Create a team" body="Start one for your church or band. Free for 5 people." onClick={onCreate} />
      </div>
      <AuthActions>
        <Button variant="ghost" className="hover:bg-transparent" onClick={onSignOut}>Log out</Button>
      </AuthActions>
    </AuthLayout>
  );
}

// ── S5 Enter your invite code (and J5, the wrong code) ──────────────────────

/**
 * @param answer null while nothing is checked, 'Reject' shakes the row out
 */
export function EnterCodeView({ onCode, answer, error, onPasteLink, onBack, busy, embedded }: {
  onCode: (code: string) => void; answer?: 'Accept' | 'Reject' | null; error?: string | null;
  onPasteLink: () => void; onBack?: () => void; busy?: boolean; embedded?: boolean;
}) {
  return (
    <AuthLayout onBack={onBack} embedded={embedded}>
      <Progress step={2} of={3} />
      <AuthHeader title="Enter your invite code" sub="Ask your leader for the 6-character code." />
      <div className="flex justify-center">
        <OneTimeCode length={6} letters answer={answer ?? null} onFull={onCode} label="Invite code, 6 characters" />
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <FormActions>
        {busy && <p role="status" className="m-0 text-center text-small text-muted-foreground">Checking the code…</p>}
        <TextLink question="Got a link instead?" answer="Paste it" onClick={onPasteLink} />
      </FormActions>
    </AuthLayout>
  );
}

// ── Paste the link ──────────────────────────────────────────────────────────

export function PasteLinkView({ value, onChange, onSubmit, onBack, error, embedded }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; onBack?: () => void; error?: string | null; embedded?: boolean;
}) {
  const uid = useId();
  return (
    <AuthLayout onBack={onBack} embedded={embedded}>
      <Progress step={2} of={3} />
      <AuthHeader title="Paste your invite link" />
      <form id={`${uid}-form`} onSubmit={(e) => { e.preventDefault(); onSubmit(); }} noValidate>
        <LabelInput fill label="Invite link" inputMode="url" autoCapitalize="none" autoComplete="off"
          value={value} onChange={e => onChange(e.target.value)} onFocus={scrollFieldIntoView}
          error={error || null} hint="It starts with app.setlists.md/join/" />
      </form>
      <FormActions>
        <Button type="submit" form={`${uid}-form`} disabled={!value.trim()}>Join</Button>
      </FormActions>
    </AuthLayout>
  );
}

// ── S2 Name your team ───────────────────────────────────────────────────────

export function NameTeamView({ value, onChange, onSubmit, onBack, tried, busy, error, embedded }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; onBack?: () => void;
  tried?: boolean; busy?: boolean; error?: string | null; embedded?: boolean;
}) {
  const uid = useId();
  const missing = !value.trim();
  return (
    <AuthLayout onBack={onBack} embedded={embedded}>
      <Progress step={2} of={5} />
      <AuthHeader title="Name your team" />
      <form id={`${uid}-form`} onSubmit={(e) => { e.preventDefault(); onSubmit(); }} noValidate>
        <LabelInput fill label="Team name" autoComplete="organization" maxLength={120}
          value={value} onChange={e => onChange(e.target.value)} onFocus={scrollFieldIntoView}
          error={tried && missing ? 'Add the name people know it by.' : null} />
      </form>
      {error && <Alert variant="danger">{error}</Alert>}
      <FormActions>
        <Button type="submit" form={`${uid}-form`} loading={busy}>Create</Button>
      </FormActions>
    </AuthLayout>
  );
}

// ── I1 What do you play? ────────────────────────────────────────────────────

/**
 * For people joining and for the leader who made the team.
 * @param name shown as a field only when we don't know it yet (onNameChange given)
 */
export function InstrumentsView({ parts, onPartsChange, onContinue, onBack, progress, name, onNameChange, busy, error, embedded }: {
  parts: string[]; onPartsChange: (next: string[]) => void; onContinue: () => void; onBack?: () => void;
  progress?: Step; name?: string; onNameChange?: (v: string) => void; busy?: boolean; error?: string | null; embedded?: boolean;
}) {
  const needsName = !!onNameChange;
  const ready = !needsName || !!(name || '').trim();
  return (
    <AuthLayout onBack={onBack} embedded={embedded}>
      <Bar progress={progress} />
      <AuthHeader title="What do you play?" />
      {needsName && (
        <LabelInput fill label="Your name" autoComplete="name" maxLength={80}
          value={name || ''} onChange={e => onNameChange?.(e.target.value)} onFocus={scrollFieldIntoView} />
      )}
      <PartPicker value={parts} onChange={onPartsChange} />
      {error && <Alert variant="danger">{error}</Alert>}
      <FormActions>
        <Button onClick={onContinue} disabled={!ready} loading={busy}>Continue</Button>
      </FormActions>
    </AuthLayout>
  );
}

// ── C1 Invite your team ─────────────────────────────────────────────────────

export function InviteTeamView({ code, url, copied, onCopy, onShare, onLater, onBack, error, embedded }: {
  code?: string | null; url?: string | null; copied?: boolean; onCopy: () => void; onShare?: (() => void) | null;
  onLater: () => void; onBack?: () => void; error?: string | null; embedded?: boolean;
}) {
  return (
    <AuthLayout onBack={onBack} embedded={embedded}>
      <Progress step={4} of={5} />
      <AuthHeader title="Invite your team" />
      <Card>
        <CardLabel>Code</CardLabel>
        <span className="font-mono text-[32px] font-semibold tracking-[6px]">{code ? code.toUpperCase() : '······'}</span>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <span className="truncate font-mono text-small text-muted-foreground">{url ? url.replace(/^https?:\/\//, '') : '…'}</span>
          <Button variant="link" className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-small" onClick={onCopy} disabled={!url}>
            {copied ? <><Check size={14} strokeWidth={1.8} aria-hidden="true" /> Copied</> : <><Copy size={14} strokeWidth={1.8} aria-hidden="true" /> Copy link</>}
          </Button>
        </div>
      </Card>
      {error && <Alert variant="danger">{error}</Alert>}
      <FormActions>
        {onShare && <Button onClick={onShare} disabled={!url}><Share size={18} strokeWidth={1.8} aria-hidden="true" /> Share invite</Button>}
        <Button variant={onShare ? 'ghost' : 'default'} className={onShare ? 'hover:bg-transparent' : undefined} onClick={onLater}>
          {onShare ? 'Later' : 'Continue'}
        </Button>
      </FormActions>
    </AuthLayout>
  );
}

// ── C2 Put Setlists.md on your phone ────────────────────────────────────────

export interface AppStep { title: string; body: string; done?: boolean; action?: { label: string; onClick: () => void; busy?: boolean } | null }

export function GetAppView({ teamName, install, alerts, onOpen, onBack, progress = { step: 5, of: 5 }, embedded }: {
  teamName: string; install: AppStep; alerts: AppStep; onOpen: () => void; onBack?: () => void; progress?: Step | null; embedded?: boolean;
}) {
  const rows: Array<[ReactNode, AppStep]> = [
    [<Smartphone size={20} strokeWidth={1.8} />, install],
    [<Bell size={20} strokeWidth={1.8} />, alerts],
  ];
  return (
    <AuthLayout onBack={onBack} embedded={embedded}>
      {progress && <Progress step={progress.step} of={progress.of} />}
      <AuthHeader title="Put Setlists.md on your phone" />
      <div className="flex flex-col">
        {rows.map(([icon, s]) => (
          <div key={s.title} className="flex items-center gap-3.5 border-t border-border py-4 last:border-b">
            <IconSquare>{s.done ? <Check size={20} strokeWidth={1.8} /> : icon}</IconSquare>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-body font-semibold">{s.title}</span>
              <span className="text-small text-muted-foreground">{s.body}</span>
            </span>
            {s.action && !s.done && (
              <Button variant="outline" size="sm" loading={s.action.busy} onClick={s.action.onClick}>{s.action.label}</Button>
            )}
          </div>
        ))}
      </div>
      <FormActions>
        <Button onClick={onOpen}>Open {teamName}</Button>
      </FormActions>
    </AuthLayout>
  );
}

// ── E2 You already have a team ──────────────────────────────────────────────

export function AlreadyOwnView({ teamName, onOpen, onBack, embedded }: {
  teamName: string; onOpen: () => void; onBack?: () => void; embedded?: boolean;
}) {
  return (
    <AuthLayout onBack={onBack} embedded={embedded}>
      <IconSquare><KeyRound size={22} strokeWidth={1.8} /></IconSquare>
      <AuthHeader title="You already have a team" sub={`Each account can own one team. You own ${teamName}.`} />
      <FormActions><Button onClick={onOpen}>Open {teamName}</Button></FormActions>
    </AuthLayout>
  );
}
