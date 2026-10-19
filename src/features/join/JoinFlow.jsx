import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import BrandWordmark from '@/ui/BrandWordmark';
import { useAuth } from '@/auth/useAuth';
import { friendlyAuthError } from '@/features/auth/friendlyAuthError';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { usePushSubscription } from '@/push/usePushSubscription';
import { useMyJoinRequests } from '@/hooks/useMyJoinRequests';
import {
  JOIN_PARTS,
  joinPartLabel,
  toggleJoinPart,
  alreadyInLine,
  churchInitials,
  joinStepFor,
  findJoinRequest,
  savePendingJoin,
  clearPendingJoin,
} from '@/lib/joinLink';
import { peekJoinLink, requestToJoin } from './joinApi';

const IOSInstallHint = lazy(() => import('@/features/onboarding/IOSInstallHint'));

const LAST_EMAIL_KEY = 'setlists-md:last-email';
const RESEND_COOLDOWN_MS = 30_000;

// Apple / Google need their providers switched on in Supabase (docs/PLAN.md
// §1.2 still lists "Google / Apple OAuth re-enabled"). Until then a button that
// lands on a Supabase error page is worse than no button, so they show only
// when the build lists them: VITE_OAUTH_PROVIDERS="apple,google".
const OAUTH_PROVIDERS = new Set(
  String(import.meta.env.VITE_OAUTH_PROVIDERS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
);

// ── Small pieces ────────────────────────────────────────────────────────────

function ChurchAvatar({ name, logoUrl, initials, size = 72 }) {
  return (
    <div
      className="rounded-2xl flex items-center justify-center overflow-hidden shrink-0 font-bold shadow-md"
      style={{
        width: size,
        height: size,
        background: 'var(--color-brand-soft)',
        color: 'var(--color-brand)',
        fontSize: Math.round(size * 0.36),
      }}
    >
      {logoUrl
        ? <img src={logoUrl} alt="" className="w-full h-full object-cover" />
        : (initials || churchInitials(name))}
    </div>
  );
}

function Shell({ children }) {
  return (
    <div data-theme-variant="modes" className="fixed inset-0 overflow-y-auto flex flex-col bg-[var(--ds-background-200)]">
      <div
        className="flex-1 flex items-start justify-center px-4 py-8 sm:py-14"
        style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        <div className="w-full max-w-sm flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

function Message({ message }) {
  if (!message) return null;
  return (
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
    </div>
  );
}

function PartChips({ value, onChange, readOnly = false }) {
  const list = readOnly ? value.map(id => ({ id, label: joinPartLabel(id) })) : JOIN_PARTS;
  return (
    <div className="flex flex-wrap gap-2" role={readOnly ? undefined : 'group'}>
      {list.map(p => {
        const on = value.includes(p.id);
        if (readOnly) {
          return (
            <span key={p.id} className="text-label-12 px-3 py-1 rounded-full bg-[var(--modes-surface-strong)] text-[var(--modes-text-muted)]">
              {p.label}
            </span>
          );
        }
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(toggleJoinPart(value, p.id))}
            className="h-9 px-3.5 rounded-full text-label-13 font-medium cursor-pointer transition-colors border"
            style={{
              borderColor: on ? 'var(--color-brand)' : 'var(--modes-border)',
              background: on ? 'var(--color-brand-soft)' : 'var(--modes-surface)',
              color: on ? 'var(--color-brand)' : 'var(--modes-text)',
            }}
          >
            {on ? '✓ ' : ''}{p.label}
          </button>
        );
      })}
    </div>
  );
}

function ChurchHeader({ peek, title, subtitle }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center pt-2">
      <ChurchAvatar name={peek?.team_name} logoUrl={peek?.logo_url} initials={peek?.initials} />
      <h1 className="text-heading-24 text-[var(--modes-text)] m-0 leading-tight">{title}</h1>
      {subtitle && <p className="text-copy-14 text-[var(--modes-text-muted)] m-0">{subtitle}</p>}
    </div>
  );
}

// ── (a) Landing — who invited you, and sign in ──────────────────────────────

function SignInCard({ onPasswordSignIn }) {
  const { signInWithApple, signInWithGoogle, signInWithOtp, verifyEmailOtp } = useAuth();
  const [email, setEmail] = useState(() => {
    try { return window.localStorage.getItem(LAST_EMAIL_KEY) || ''; } catch { return ''; }
  });
  const [codeSentTo, setCodeSentTo] = useState(null);
  const [otp, setOtp] = useState('');
  const [busyTarget, setBusyTarget] = useState(null);
  const [message, setMessage] = useState(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const busy = !!busyTarget;
  const resendLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (resendAt <= now) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resendAt, now]);

  const run = async (target, fn) => {
    setBusyTarget(target);
    setMessage(null);
    try { await fn(); } catch (err) { setMessage({ kind: 'error', text: friendlyAuthError(err) }); }
    finally { setBusyTarget(null); }
  };

  const sendCode = (e) => {
    e?.preventDefault();
    const addr = email.trim();
    if (!addr) return;
    run('send', async () => {
      const { error } = await signInWithOtp(addr);
      if (error) throw error;
      try { window.localStorage.setItem(LAST_EMAIL_KEY, addr); } catch { /* ignore */ }
      setCodeSentTo(addr);
      setOtp('');
      setResendAt(Date.now() + RESEND_COOLDOWN_MS);
      setNow(Date.now());
      setMessage({ kind: 'info', text: `We emailed a code to ${addr}. You can also just tap the link in that email.` });
    });
  };

  const verify = (e) => {
    e.preventDefault();
    const token = otp.replace(/\s+/g, '');
    if (!token || !codeSentTo) return;
    // On success AuthProvider's session listener flips `user`, and the flow
    // moves on by itself.
    run('verify', async () => {
      const { error } = await verifyEmailOtp(codeSentTo, token);
      if (error) throw error;
    });
  };

  const oauth = (provider, fn) => run(provider, async () => {
    const { error } = await fn();
    if (error) throw error;
  });

  return (
    <div className="modes-card p-5 flex flex-col gap-3">
      {OAUTH_PROVIDERS.has('apple') && (
        <Button variant="secondary" size="lg" className="w-full" disabled={busy} loading={busyTarget === 'apple'}
          onClick={() => oauth('apple', signInWithApple)}>
          Continue with Apple
        </Button>
      )}
      {OAUTH_PROVIDERS.has('google') && (
        <Button variant="secondary" size="lg" className="w-full" disabled={busy} loading={busyTarget === 'google'}
          onClick={() => oauth('google', signInWithGoogle)}>
          Continue with Google
        </Button>
      )}
      {OAUTH_PROVIDERS.size > 0 && (
        <div className="flex items-center gap-3 text-label-12 text-[var(--modes-text-dim)]">
          <span className="h-px flex-1 bg-[var(--modes-border)]" />or<span className="h-px flex-1 bg-[var(--modes-border)]" />
        </div>
      )}

      {!codeSentTo ? (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-label-12 text-[var(--modes-text-muted)] uppercase tracking-wider">Email</span>
            <Input type="email" autoComplete="email" inputMode="email" required value={email}
              onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <Button type="submit" variant="brand" size="lg" className="w-full" disabled={busy || !email.trim()} loading={busyTarget === 'send'}>
            Email me a code
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-label-12 text-[var(--modes-text-muted)] uppercase tracking-wider">Code from the email</span>
            <Input type="text" inputMode="numeric" autoComplete="one-time-code" value={otp}
              onChange={e => setOtp(e.target.value)} placeholder="123456" maxLength={10} />
          </label>
          <Button type="submit" variant="brand" size="lg" className="w-full" disabled={busy || !otp.trim()} loading={busyTarget === 'verify'}>
            Continue
          </Button>
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={busy}
              onClick={() => { setCodeSentTo(null); setMessage(null); }}>
              Use a different email
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={busy || resendLeft > 0} loading={busyTarget === 'send'}
              onClick={() => sendCode()}>
              {resendLeft > 0 ? `Resend in ${resendLeft}s` : 'Send a new code'}
            </Button>
          </div>
        </form>
      )}

      <Message message={message} />

      {onPasswordSignIn && (
        <Button type="button" variant="ghost" size="sm" className="self-center" disabled={busy} onClick={onPasswordSignIn}>
          I have a password
        </Button>
      )}
    </div>
  );
}

// ── (d) You're in — three next steps ────────────────────────────────────────

function StepRow({ n, title, body, done, action }) {
  return (
    <div className="modes-card p-4 flex items-start gap-3">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-label-14 font-bold"
        style={{
          background: done ? 'var(--color-brand)' : 'var(--color-brand-soft)',
          color: done ? '#fff' : 'var(--color-brand)',
        }}
        aria-hidden="true"
      >
        {done ? '✓' : n}
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div>
          <div className="text-copy-14 font-semibold text-[var(--modes-text)]">{title}</div>
          <div className="text-copy-13 text-[var(--modes-text-muted)]">{body}</div>
        </div>
        {action}
      </div>
    </div>
  );
}

function YoureIn({ peek, onGoSchedule, onSkipHome }) {
  const { canInstall, isIOS, isStandalone, promptInstall } = useInstallPrompt();
  const push = usePushSubscription();
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [installAnswered, setInstallAnswered] = useState(false);

  const installDone = isStandalone || installAnswered;
  let installAction = null;
  if (!installDone && canInstall) {
    installAction = (
      <Button size="sm" variant="secondary" className="self-start" onClick={async () => {
        const outcome = await promptInstall();
        if (outcome === 'accepted') setInstallAnswered(true);
      }}>Install</Button>
    );
  } else if (!installDone && isIOS) {
    installAction = <Button size="sm" variant="secondary" className="self-start" onClick={() => setShowIOSHint(true)}>Show me how</Button>;
  }
  const installBody = installDone
    ? 'Done — open it from your home screen from now on.'
    : (canInstall || isIOS)
      ? 'It opens full screen and works with no signal.'
      : 'Use your browser menu → "Add to Home Screen" or "Install app".';

  let pushAction = null;
  let pushBody = 'Get a ping when you are put on a Sunday.';
  if (push.subscribed) {
    pushBody = 'On — you will hear about it when you are scheduled.';
  } else if (push.denied) {
    pushBody = 'Alerts are blocked for this site. Allow them in your browser settings.';
  } else if (!push.supported) {
    pushBody = isIOS ? 'On iPhone, put the app on your home screen first, then turn alerts on from there.' : 'This browser cannot show alerts.';
  } else {
    pushAction = (
      <Button size="sm" variant="secondary" className="self-start" loading={push.busy} onClick={() => push.enable()}>
        Turn on alerts
      </Button>
    );
  }

  return (
    <Shell>
      <ChurchHeader
        peek={peek}
        title={`You're in ${peek?.team_name || 'the team'}`}
        subtitle="Three quick things and you're ready for Sunday."
      />
      <div className="flex flex-col gap-2">
        <StepRow n={1} title="Put the app on your phone" body={installBody} done={installDone} action={installAction} />
        <StepRow n={2} title="Turn on alerts" body={pushBody} done={push.subscribed} action={pushAction} />
        <StepRow
          n={3}
          title="Say which dates you can play"
          body="Tap the Sundays you're free so the leader can plan."
          action={<Button size="sm" variant="brand" className="self-start" onClick={onGoSchedule}>Open the schedule</Button>}
        />
      </div>
      <Button variant="secondary" size="lg" className="w-full" onClick={onSkipHome}>Skip to Home</Button>
      {showIOSHint && (
        <Suspense fallback={null}>
          <IOSInstallHint onClose={() => setShowIOSHint(false)} />
        </Suspense>
      )}
    </Shell>
  );
}

// ── The flow ────────────────────────────────────────────────────────────────

/**
 * `/join/<code>` — ask to join a church from its join link.
 *
 * landing (signed out) → about you → waiting (live) → you're in.
 * The code sits in localStorage (`lib/joinLink.js`) so it survives the OAuth
 * redirect and the magic-link tab; App resumes here after sign-in.
 *
 * @param {string}   code
 * @param {Function} onJoined(teamId)     approved / already a member — App makes
 *                                        the church home and loads it
 * @param {Function} onGoSchedule(teamId) "Say which dates you can play"
 * @param {Function} onSkipHome(teamId)   "Skip to Home"
 * @param {Function} onExit()             leave the flow (bad link, or wait in Personal)
 * @param {Function} [onPasswordSignIn]   the regular email + password screen
 */
export default function JoinFlow({ code, onJoined, onGoSchedule, onSkipHome, onExit, onPasswordSignIn }) {
  const { user, profile, loading: authLoading, updateProfile } = useAuth();
  const signedIn = !!user;
  const [peek, setPeek] = useState(null);
  const [peekError, setPeekError] = useState(null);
  const [step, setStep] = useState('loading');
  const [name, setName] = useState('');
  const [parts, setParts] = useState([]);
  const [submitted, setSubmitted] = useState(null); // { requestId, teamId, name, parts }
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const joinedFiredRef = useRef(false);

  const fireJoined = useCallback((teamId) => {
    if (joinedFiredRef.current) return;
    joinedFiredRef.current = true;
    clearPendingJoin();
    onJoined?.(teamId);
  }, [onJoined]);

  // Remember the code until the flow is finished, across sign-in redirects.
  useEffect(() => {
    if (!signedIn) savePendingJoin(code, 'auth');
  }, [code, signedIn]);

  // Peek on mount and whenever the identity changes (signing in turns the
  // landing into "about you" — or straight into "waiting" / "you're in").
  useEffect(() => {
    if (authLoading) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await peekJoinLink(code);
        if (cancelled) return;
        setPeek(res);
        setPeekError(null);
        setStep(prev => {
          // Never yank someone out of a screen they are filling in.
          if (prev !== 'loading' && prev !== 'landing') return prev;
          return joinStepFor({ peek: res, signedIn });
        });
      } catch (err) {
        if (cancelled) return;
        setPeekError(err.message || 'Could not open this link.');
        setStep('error');
      }
    })();
    return () => { cancelled = true; };
  }, [code, signedIn, authLoading]);

  // Prefill the name from the profile once it arrives.
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (prefilledRef.current || !profile) return;
    prefilledRef.current = true;
    if (profile.display_name) setName(prev => prev || profile.display_name);
  }, [profile]);

  // Already a member on arrival.
  useEffect(() => {
    if (step === 'in') fireJoined(submitted?.teamId || peek?.team_id || null);
  }, [step, submitted?.teamId, peek?.team_id, fireJoined]);

  // Waiting → live updates on our own request row.
  const { requests } = useMyJoinRequests(user?.id, { enabled: step === 'waiting' });
  const myRequest = findJoinRequest(requests, { teamId: submitted?.teamId || peek?.team_id, requestId: submitted?.requestId });
  useEffect(() => {
    if (step !== 'waiting' || !myRequest) return;
    if (myRequest.status === 'approved') setStep('in');
    else if (myRequest.status === 'declined') setStep('declined');
  }, [step, myRequest]);

  const ask = async (e) => {
    e.preventDefault();
    const cleanName = name.trim().replace(/\s+/g, ' ');
    if (!cleanName) {
      setMessage({ kind: 'error', text: 'Tell the leader your name so they know who you are.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await requestToJoin(code, cleanName, parts);
      // Keep the account's name in step with what they just told the church,
      // when it was only the email-prefix default.
      const current = (profile?.display_name || '').trim();
      const emailPrefix = (user?.email || '').split('@')[0];
      if (cleanName !== current && (!current || current === emailPrefix)) {
        updateProfile?.({ display_name: cleanName }).catch(() => {});
      }
      if (res?.status === 'pending') {
        savePendingJoin(code, 'requested');
        setSubmitted({ requestId: res.request_id, teamId: res.team_id, name: cleanName, parts });
        setStep('waiting');
      } else if (res?.status === 'member') {
        setSubmitted({ teamId: res.team_id, name: cleanName, parts });
        setStep('in');
      } else if (res?.status === 'declined') {
        setStep('declined');
      } else {
        setPeek(p => ({ ...(p || {}), status: res?.status || 'invalid' }));
        setStep('error');
      }
    } catch (err) {
      setMessage({ kind: 'error', text: err.message || 'Could not send your request.' });
    } finally {
      setBusy(false);
    }
  };

  const leave = () => {
    // A finished or broken flow should not reopen on the next launch.
    if (step !== 'waiting') clearPendingJoin();
    onExit?.();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (step === 'loading') {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 pt-16 text-copy-14 text-[var(--modes-text-muted)]">
          <img src="/setlists-md-mark.svg" alt="" width="56" height="56" className="rounded-2xl" />
          Opening your invite…
        </div>
      </Shell>
    );
  }

  if (step === 'error') {
    const disabled = peek?.status === 'disabled';
    const network = !!peekError && !peek;
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 text-center pt-6">
          <img src="/setlists-md-mark.svg" alt="" width="56" height="56" className="rounded-2xl shadow-md" />
          <h1 className="text-heading-24 text-[var(--modes-text)] m-0">
            {network ? "Couldn't open this invite" : disabled ? 'This invite is paused' : "This invite link doesn't work"}
          </h1>
          <p className="text-copy-14 text-[var(--modes-text-muted)] m-0">
            {network
              ? 'Check your connection and try the link again.'
              : disabled
                ? 'The church has switched its join link off for now. Ask your worship leader to turn it back on.'
                : 'It may have been reset. Ask your worship leader for the new link.'}
          </p>
        </div>
        {network && (
          <Button variant="brand" size="lg" className="w-full" onClick={() => window.location.reload()}>Try again</Button>
        )}
        <Button variant="secondary" size="lg" className="w-full" onClick={leave}>Open Setlists.md</Button>
      </Shell>
    );
  }

  if (step === 'in') {
    const teamId = submitted?.teamId || peek?.team_id || null;
    return <YoureIn peek={peek} onGoSchedule={() => onGoSchedule?.(teamId)} onSkipHome={() => onSkipHome?.(teamId)} />;
  }

  if (step === 'declined') {
    return (
      <Shell>
        <ChurchHeader
          peek={peek}
          title="Not this time"
          subtitle={`${peek?.team_name || 'The church'} didn't approve this request. If that's a mistake, talk to your worship leader.`}
        />
        <Button variant="secondary" size="lg" className="w-full" onClick={leave}>Open Setlists.md</Button>
      </Shell>
    );
  }

  if (step === 'waiting') {
    const shownName = submitted?.name || myRequest?.display_name || name;
    const shownParts = submitted?.parts || myRequest?.parts || [];
    return (
      <Shell>
        <ChurchHeader
          peek={peek}
          title="Waiting for approval"
          subtitle={`We've asked ${peek?.team_name || 'the church'}. A leader will let you in — this screen updates by itself.`}
        />
        <div className="modes-card p-4 flex flex-col gap-3">
          <div className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold">What you sent</div>
          <div className="text-copy-16 font-semibold text-[var(--modes-text)]">{shownName || 'You'}</div>
          {shownParts.length > 0
            ? <PartChips value={shownParts} readOnly />
            : <div className="text-copy-13 text-[var(--modes-text-muted)]">No instruments picked.</div>}
          <div className="flex items-center gap-2 text-label-12 text-[var(--modes-text-dim)]">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--color-brand)' }} aria-hidden="true" />
            Waiting for a leader
          </div>
        </div>
        <Button variant="secondary" size="lg" className="w-full" onClick={leave}>Look around while you wait</Button>
      </Shell>
    );
  }

  if (step === 'about') {
    return (
      <Shell>
        <ChurchHeader peek={peek} title={`Join ${peek?.team_name || 'the team'}`} subtitle="Tell the leader who you are." />
        <form onSubmit={ask} className="modes-card p-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-label-12 text-[var(--modes-text-muted)] uppercase tracking-wider">Your name</span>
            <Input type="text" autoComplete="name" value={name} maxLength={80}
              onChange={e => setName(e.target.value)} placeholder="First and last name" />
          </label>
          <div className="flex flex-col gap-2">
            <span className="text-label-12 text-[var(--modes-text-muted)] uppercase tracking-wider">What do you play or sing?</span>
            <PartChips value={parts} onChange={setParts} />
          </div>
          <Message message={message} />
          <Button type="submit" variant="brand" size="lg" className="w-full" disabled={busy || !name.trim()} loading={busy}>
            Ask to join
          </Button>
        </form>
      </Shell>
    );
  }

  // landing
  const line = alreadyInLine({ leaderName: peek?.leader_name, memberCount: peek?.member_count });
  return (
    <Shell>
      <div className="flex justify-center">
        <BrandWordmark height={18} accent="var(--color-brand-mist)" className="text-[var(--modes-text)] opacity-80" />
      </div>
      <ChurchHeader
        peek={peek}
        title={<>You&apos;re invited to <span style={{ color: 'var(--color-brand)' }}>{peek?.team_name}</span> worship team</>}
        subtitle={line || null}
      />
      <p className="text-copy-13 text-[var(--modes-text-dim)] m-0 text-center">
        Sign in to ask to join. Nothing to install yet.
      </p>
      <SignInCard onPasswordSignIn={onPasswordSignIn} />
      <Button variant="ghost" size="sm" className="self-center" onClick={leave}>Not now</Button>
    </Shell>
  );
}
