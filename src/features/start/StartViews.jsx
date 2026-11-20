import { useId } from 'react';
import { LabelInput } from '@/ui/blocks/LabelInput';
import { Button } from '@/ui/shadcn/button';
import { Alert } from '@/ui/shadcn/alert';
import { FieldGroup } from '@/ui/shadcn/field';
import { AuthLayout, AuthHeader, AuthActions, SuccessBadge } from '@/features/auth/AuthLayout';
import { TeamIcon, ChevronRightIcon } from '@/app/navIcons';

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
      className="flex min-h-0 w-full cursor-pointer items-center gap-3.5 rounded-card material-base p-4 text-left font-sans text-foreground outline-none transition-colors hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Square>{icon}</Square>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body font-semibold leading-6">{title}</span>
        <span className="text-small text-muted-foreground">{body}</span>
      </span>
      <span className="shrink-0 text-muted-foreground"><ChevronRightIcon size={20} /></span>
    </button>
  );
}

// ── 1. What are you setting up? ─────────────────────────────────────────────
export function ChooseView({ name, onStart, onInvite, onSignOut, embedded }) {
  return (
    <AuthLayout embedded={embedded}>
      <AuthHeader title="What are you setting up?" sub={`${name ? `Hi ${name}, your` : 'Your'} account is ready. One more step.`} />
      <div className="flex flex-col gap-3">
        <Choice icon={<TeamIcon size={22} />} title="Start a church or band" body="Songs, setlists and who plays when. Free for up to 5 people." onClick={onStart} />
        <Choice icon={<LinkIcon />} title="I have an invite link" body="Join the church or band that invited you." onClick={onInvite} />
      </div>
      <AuthActions className="gap-1.5">
        <Button variant="ghost" className="hover:bg-transparent" onClick={onSignOut}>Log out</Button>
      </AuthActions>
    </AuthLayout>
  );
}

// ── 2. Name your church or band ─────────────────────────────────────────────
// It is made at once, on Free (2026-11-19): no request, no waiting.
export function NameView({ values, onChange, tried, onSubmit, onBack, busy, message, embedded }) {
  const uid = useId();
  const set = (k) => (e) => onChange({ ...values, [k]: e.target.value });
  const missing = !values.church.trim();
  return (
    <AuthLayout embedded={embedded} onBack={onBack}>
      <AuthHeader
        title="What’s it called?"
        sub="You can change it later."
      />
      <form id={`${uid}-form`} onSubmit={(e) => { e.preventDefault(); onSubmit(); }} noValidate>
        <FieldGroup className="gap-3">
          <LabelInput fill label="Church or band name" autoComplete="organization" maxLength={120} value={values.church} onChange={set('church')}
            error={tried && missing ? 'Add the name people know it by.' : null} />
          <LabelInput fill label="City (optional)" autoComplete="address-level2" maxLength={120} value={values.place} onChange={set('place')} />
        </FieldGroup>
      </form>
      {message && <Alert variant="danger">{message}</Alert>}
      <AuthActions className="gap-1.5">
        <Button type="submit" form={`${uid}-form`} loading={busy}>Create</Button>
        <p className="m-0 text-center text-caption text-muted-foreground">Free for up to 5 people.</p>
      </AuthActions>
    </AuthLayout>
  );
}

// ── 4. Ready ────────────────────────────────────────────────────────────────
export function ReadyView({ church, onInvite, onOpen, embedded }) {
  return (
    <AuthLayout embedded={embedded}>
      <AuthHeader mark={<SuccessBadge />} title={`${church} is ready`} sub="Invite the others with one link. You let in each person who asks to join." />
      <AuthActions className="gap-1.5">
        <Button onClick={onInvite}>Invite people</Button>
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
      <AuthHeader title="Open your invite link" sub="Your leader sent you a link that starts with app.setlists.md/join. Tap it in your messages, or paste it here." />
      <form id={`${uid}-form`} onSubmit={(e) => { e.preventDefault(); onSubmit(); }} noValidate>
        <LabelInput fill label="Invite link" inputMode="url" autoCapitalize="none" autoComplete="off"
          value={value} onChange={e => onChange(e.target.value)} error={message || null} hint="It starts with app.setlists.md/join/" />
      </form>
      <AuthActions className="gap-1.5">
        <Button type="submit" form={`${uid}-form`} disabled={!value.trim()}>Join</Button>
        <p className="m-0 text-center text-caption text-muted-foreground">No link? Ask your leader to send one.</p>
      </AuthActions>
    </AuthLayout>
  );
}
