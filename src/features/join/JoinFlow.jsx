import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { usePushSubscription } from '@/push/usePushSubscription';
import { useMyJoinRequests } from '@/hooks/useMyJoinRequests';
import {
  alreadyInLine,
  churchFromPeek,
  joinStepFor,
  findJoinRequest,
  savePendingJoin,
  clearPendingJoin,
} from '@/lib/joinLink';
import { peekJoinLink, requestToJoin } from './joinApi';
import {
  JoinInviteView,
  AboutYouView,
  WaitingView,
  YoureInView,
  DeclinedView,
  BadLinkView,
  OpeningView,
} from './JoinViews';

const IOSInstallHint = lazy(() => import('@/features/onboarding/IOSInstallHint'));

// ── You're in: the three steps keep their live state here ─────────────────

function YoureIn({ church, onGoSchedule, onSkipHome }) {
  const { canInstall, isIOS, isStandalone, promptInstall } = useInstallPrompt();
  const push = usePushSubscription();
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [installAnswered, setInstallAnswered] = useState(false);

  const installDone = isStandalone || installAnswered;
  let installAction = null;
  if (!installDone && canInstall) {
    installAction = {
      label: 'Install',
      onClick: async () => {
        const outcome = await promptInstall();
        if (outcome === 'accepted') setInstallAnswered(true);
      },
    };
  } else if (!installDone && isIOS) {
    installAction = { label: 'Show me how', onClick: () => setShowIOSHint(true) };
  }
  const installBody = installDone
    ? 'Done. Open it from your home screen from now on.'
    : (canInstall || isIOS)
      ? 'Opens full screen, like a real app.'
      : 'In your browser menu, pick “Add to Home Screen” or “Install app”.';

  let pushAction = null;
  let pushBody = 'Hear when a leader asks you to play.';
  if (push.subscribed) {
    pushBody = 'On. You’ll hear when you’re asked to play.';
  } else if (push.denied) {
    pushBody = 'Alerts are blocked for this site. Allow them in your browser settings.';
  } else if (!push.supported) {
    pushBody = isIOS ? 'On iPhone, put the app on your home screen first, then turn alerts on there.' : 'This browser can’t show alerts.';
  } else {
    pushAction = { label: 'Turn on', onClick: () => push.enable(), busy: push.busy };
  }

  return (
    <>
      <YoureInView
        church={church}
        steps={[
          { title: 'Put the app on your phone', body: installBody, done: installDone, action: installAction },
          { title: 'Turn on alerts', body: pushBody, done: push.subscribed, action: pushAction },
          { title: 'Say which dates you can play', body: 'So leaders know who’s free.', action: { label: 'Open the schedule', onClick: onGoSchedule, primary: true } },
        ]}
        onSkip={onSkipHome}
      />
      {showIOSHint && (
        <Suspense fallback={null}>
          <IOSInstallHint onClose={() => setShowIOSHint(false)} />
        </Suspense>
      )}
    </>
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
 * @param {Function} [onPasswordSignIn](mode, church) the email + password screen,
 *                                        showing the church it is joining
 */
export default function JoinFlow({ code, onJoined, onGoSchedule, onSkipHome, onExit, onPasswordSignIn }) {
  const { user, profile, loading: authLoading, updateProfile, signOut } = useAuth();
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

  const ask = async () => {
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

  const signOutAndLeave = async () => {
    try { await signOut?.(); } catch { /* signed out locally either way */ }
    clearPendingJoin();
    onExit?.();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const church = churchFromPeek(peek);

  if (step === 'loading') return <OpeningView />;

  if (step === 'error') {
    const reason = peekError && !peek ? 'network' : peek?.status === 'disabled' ? 'disabled' : 'invalid';
    return <BadLinkView reason={reason} onRetry={() => window.location.reload()} onOpenApp={leave} />;
  }

  if (step === 'in') {
    const teamId = submitted?.teamId || peek?.team_id || null;
    return <YoureIn church={church} onGoSchedule={() => onGoSchedule?.(teamId)} onSkipHome={() => onSkipHome?.(teamId)} />;
  }

  if (step === 'declined') {
    return <DeclinedView church={church} onOpenApp={leave} onSignOut={signOutAndLeave} />;
  }

  if (step === 'waiting') {
    return (
      <WaitingView
        church={church}
        name={submitted?.name || myRequest?.display_name || name}
        parts={submitted?.parts || myRequest?.parts || []}
        onSignOut={signOutAndLeave}
      />
    );
  }

  if (step === 'about') {
    return (
      <AboutYouView
        church={church}
        name={name}
        onNameChange={setName}
        parts={parts}
        onPartsChange={setParts}
        onSubmit={ask}
        onNotNow={leave}
        busy={busy}
        message={message?.text}
      />
    );
  }

  // landing
  return (
    <JoinInviteView
      church={church}
      alreadyIn={alreadyInLine({ leaderName: peek?.leader_name, memberCount: peek?.member_count })}
      onCreateAccount={() => onPasswordSignIn?.('signup', church)}
      onLogIn={() => onPasswordSignIn?.('signin', church)}
      onNotNow={leave}
    />
  );
}
