import { useState } from 'react';
import { supabase } from '@/auth/supabase';
import { sendChurchRequest, rememberChurchRequest, finishChurchRequest, forgetChurchRequest } from '@/lib/churchRequest';
import { signupSource } from '@/lib/siteEntry';
import { inviteCodeFrom } from '@/lib/startFlow';
import { ChooseView, RequestView, WaitingApprovalView, ReadyView, InviteLinkView } from './StartViews';

// The "after sign-up" screens for a signed-in account with no church or band
// (App decides when, through lib/startFlow `startScreen`). During the beta a
// church or band is set up by hand: the request goes to the same feedback
// list as before, tagged [church request], with the account attached.

const EMPTY = { church: '', place: '', people: '', note: '' };

function sentLabel(at) {
  if (!at) return null;
  const d = new Date(at);
  const today = new Date();
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === today.toDateString() ? `Today, ${time}` : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}, ${time}`;
}

// Keep the request in the account too, so another phone shows Waiting as well.
// Best effort: the request itself is already sent.
async function saveToAccount(value) {
  try { await supabase?.auth.updateUser({ data: { start_request: value } }); } catch { /* offline */ }
}

export default function StartFlow({ screen, user, displayName, request, team, onRequestChange, onSignOut, onInviteBand, onOpenTeam, onJoinCode }) {
  const [step, setStep] = useState('choose');
  const [values, setValues] = useState(EMPTY);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const userId = user?.id;
  const first = (displayName || '').trim().split(/\s+/)[0];

  if (screen === 'ready' && team) {
    const done = (go) => () => {
      finishChurchRequest(userId);
      saveToAccount(null);
      onRequestChange?.({ ...request, done: true });
      go?.(team.id);
    };
    return <ReadyView church={team.name || request?.church || 'Your church'} onInvite={done(onInviteBand)} onOpen={done(onOpenTeam)} />;
  }

  if (screen === 'waiting' && request) {
    return (
      <WaitingApprovalView
        church={request.church}
        email={user?.email}
        sentLabel={sentLabel(request.at)}
        onChange={() => {
          forgetChurchRequest(userId);
          saveToAccount(null);
          setValues({ ...EMPTY, church: request.church });
          setStep(request.kind === 'band' ? 'band' : 'church');
          onRequestChange?.(null);
        }}
        onSignOut={onSignOut}
      />
    );
  }

  if (step === 'church' || step === 'band') {
    const send = async () => {
      setTried(true);
      if (!values.church.trim() || !values.place.trim()) return;
      setBusy(true);
      setMessage('');
      try {
        await sendChurchRequest(supabase, {
          ...values,
          kind: step,
          userId,
          email: user?.email || null,
          name: displayName || null,
          from: user?.user_metadata?.signup_from || signupSource(),
        });
        const church = values.church.trim();
        rememberChurchRequest(userId, church, undefined, step);
        const req = { church, kind: step, at: Date.now() };
        saveToAccount(req);
        setValues(EMPTY);
        setTried(false);
        onRequestChange?.(req);
      } catch (err) {
        setMessage(err?.message || 'That didn’t send. Check your connection and try again.');
      } finally { setBusy(false); }
    };
    return (
      <RequestView kind={step} values={values} onChange={setValues} tried={tried} onSubmit={send}
        onBack={() => { setStep('choose'); setTried(false); setMessage(''); }} busy={busy} message={message} />
    );
  }

  if (step === 'invite') {
    return (
      <InviteLinkView
        value={link}
        onChange={(v) => { setLink(v); setLinkError(''); }}
        onSubmit={() => {
          const code = inviteCodeFrom(link);
          if (!code) { setLinkError('That doesn’t look like an invite link. Copy the whole link from the message and try again.'); return; }
          onJoinCode?.(code);
        }}
        onBack={() => { setStep('choose'); setLinkError(''); }}
        message={linkError}
      />
    );
  }

  return (
    <ChooseView
      name={first}
      onChurch={() => setStep('church')}
      onBand={() => setStep('band')}
      onInvite={() => setStep('invite')}
      onSignOut={onSignOut}
    />
  );
}
