import { useState } from 'react';
import { supabase } from '@/auth/supabase';
import { useTeam } from '@/auth/useTeam';
import { rememberChurchRequest, finishChurchRequest } from '@/lib/churchRequest';
import { inviteCodeFrom } from '@/lib/startFlow';
import { ChooseView, NameView, ReadyView, InviteLinkView } from './StartViews';

// The "after sign-up" screens for a signed-in account with no church or band
// (App decides when, through lib/startFlow `startScreen`). Since 2026-11-19
// a church or band is made at once on the Free plan (5 people); there is no
// request and no waiting. "X is ready" then shows once, to invite people.

const EMPTY = { church: '', place: '' };

const DEVICE_TZ = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; }
})();

// Keep the "ready" step in the account too, so another phone doesn't show it again.
// Best effort.
async function saveToAccount(value) {
  try { await supabase?.auth.updateUser({ data: { start_request: value } }); } catch { /* offline */ }
}

export default function StartFlow({ screen, user, displayName, request, team, onRequestChange, onSignOut, onInviteBand, onOpenTeam, onJoinCode }) {
  const { createTeam } = useTeam();
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

  if (step === 'church' || step === 'band') {
    const send = async () => {
      setTried(true);
      if (!values.church.trim()) return;
      setBusy(true);
      setMessage('');
      const church = values.church.trim();
      const req = { church, kind: step, at: Date.now() };
      // Set first, so the moment the group exists the "ready" step shows.
      onRequestChange?.(req);
      try {
        await createTeam({ name: church, location: values.place.trim() || null, kind: step === 'band' ? 'team' : 'church', timezone: DEVICE_TZ });
        rememberChurchRequest(userId, church, undefined, step);
        saveToAccount(req);
        setValues(EMPTY);
        setTried(false);
      } catch (err) {
        onRequestChange?.(null);
        setMessage(err?.message || 'That didn’t work. Check your connection and try again.');
      } finally { setBusy(false); }
    };
    return (
      <NameView kind={step} values={values} onChange={setValues} tried={tried} onSubmit={send}
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
