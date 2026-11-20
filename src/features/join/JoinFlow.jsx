import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import { useMyJoinRequests } from '@/hooks/useMyJoinRequests';
import {
  autoJoinName,
  churchFromPeek,
  joinStepFor,
  findJoinRequest,
  savePendingJoin,
  clearPendingJoin,
} from '@/lib/joinLink';
import WebSheet from '@/features/legal/WebSheet';
import { lastEmail } from '@/lib/lastEmail';
import { SigningInView } from '@/features/intro/IntroAuthViews';
import { InstrumentsView } from '@/features/intro/IntroStartViews';
import { JoinInviteView, WaitingView, YoureInView, DeclinedView, BadLinkView } from '@/features/intro/IntroJoinViews';
import { useProviderSignIn } from '@/features/intro/useProviderSignIn';
import GetAppScreen from '@/features/start/GetAppScreen';
import { peekJoinLink, requestToJoin } from './joinApi';

// ── The flow ────────────────────────────────────────────────────────────────

/**
 * `/join/<code>` — ask to join a church from its join link.
 *
 * landing (signed out: Apple, Google or email) → What do you play? (the
 * ask) → waiting (live) → you're in → get the app. New screens 2026-11-20.
 * The code sits in localStorage (`lib/joinLink.js`) so it survives the OAuth
 * redirect and the magic-link tab; App resumes here after sign-in.
 *
 * @param {string}   code
 * @param {Function} onJoined(teamId)     approved / already a member — App makes
 *                                        the church home and loads it
 * @param {Function} onSkipHome(teamId)   "Open <church>", the last screen
 * @param {Function} onExit()             leave the flow (bad link, or wait elsewhere)
 * @param {Function} [onPasswordSignIn](mode, church) the email + password screen,
 *                                        showing the church it is joining
 */
export default function JoinFlow({ code, onJoined, onSkipHome, onExit, onPasswordSignIn }) {
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
  const [legal, setLegal] = useState(null);
  const [inStep, setInStep] = useState('in'); // in → app
  const providers = useProviderSignIn();
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

  const ask = async (nameOverride) => {
    const cleanName = (typeof nameOverride === 'string' ? nameOverride : name).trim().replace(/\s+/g, ' ');
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
        savePendingJoin(code, 'requested', Date.now(), { requestId: res.request_id });
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

  // The name goes out without a question (account name, sign-up name or
  // the email's first part); "What do you play?" is the one screen before
  // the request, and Continue sends it even with nothing picked.
  const autoName = autoJoinName({
    profileName: profile?.display_name,
    signupName: user?.user_metadata?.name || user?.user_metadata?.full_name,
    email: user?.email,
  });

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

  if (step === 'loading') return <SigningInView label="Opening your invite…" />;

  if (step === 'error') {
    const reason = peekError && !peek ? 'network' : peek?.status === 'disabled' ? 'disabled' : 'invalid';
    return <BadLinkView reason={reason} onRetry={() => window.location.reload()} onOpenApp={leave} />;
  }

  if (step === 'in') {
    const teamId = submitted?.teamId || peek?.team_id || null;
    if (inStep === 'app') {
      return <GetAppScreen teamName={church?.name} onOpen={() => onSkipHome?.(teamId)} progress={null} />;
    }
    return <YoureInView church={church} onContinue={() => setInStep('app')} />;
  }

  if (step === 'declined') {
    return <DeclinedView church={church} onAnotherCode={leave} onSignOut={signOutAndLeave} />;
  }

  if (step === 'waiting') {
    return (
      <WaitingView
        church={church}
        name={submitted?.name || myRequest?.display_name || name || autoName}
        parts={submitted?.parts || myRequest?.parts || []}
        onSignOut={signOutAndLeave}
      />
    );
  }

  if (step === 'about') {
    return (
      <InstrumentsView
        parts={parts}
        onPartsChange={setParts}
        progress={{ step: 3, of: 3 }}
        name={name}
        onNameChange={autoName ? undefined : setName}
        onContinue={() => ask(autoName || name)}
        busy={busy}
        error={message?.text}
      />
    );
  }

  // landing
  return (
    <>
      <JoinInviteView
        church={church}
        invitedBy={peek?.leader_name}
        {...providers}
        onEmail={() => onPasswordSignIn?.(lastEmail() ? 'signin' : 'signup', church)}
        onShowLegal={setLegal}
      />
      <WebSheet page={legal} onClose={() => setLegal(null)} />
    </>
  );
}
