import { useEffect, useState } from 'react';
import { supabase } from '@/auth/supabase';
import { useTeam } from '@/auth/useTeam';
import { rememberChurchRequest, finishChurchRequest } from '@/lib/churchRequest';
import { inviteCodeFrom } from '@/lib/startFlow';
import { joinUrl } from '@/lib/joinLink';
import { saveMemberInstruments } from '@/lib/memberInstruments';
import { getTeamJoinLink, peekJoinLink } from '@/features/join/joinApi';
import {
  JoinOrCreateView,
  EnterCodeView,
  PasteLinkView,
  NameTeamView,
  InstrumentsView,
  InviteTeamView,
  AlreadyOwnView,
} from '@/features/intro/IntroStartViews';
import GetAppScreen from './GetAppScreen';

// Setting up, for a signed-in account with no church or band (App decides
// when, through lib/startFlow `startScreen`). New first-run screens,
// 2026-11-20:
//
//   Join or create ─┬─ Enter your invite code (or paste the link) → JoinFlow
//                   └─ Name your team → (made at once, on Free) →
//                      What do you play? → Invite your team → Get the app
//
// The steps after "Name your team" run while App says `screen === 'ready'`
// (the group exists, the request isn't marked done yet).

const DEVICE_TZ = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; }
})();

// What approval copies into team_members.instruments (20261114 migration):
// Sound desk and Lyrics / slides are not instruments.
const INSTRUMENT_PARTS = ['vocals', 'acoustic-guitar', 'electric-guitar', 'bass-guitar', 'keys', 'piano', 'drums', 'other'];

const WRONG_CODE = 'That code doesn’t match a team. Check it with your leader. Codes stop working when a leader makes a new one.';
const PAUSED_CODE = 'That team’s invite is paused. Ask your leader to turn it back on.';

// Keep the "ready" step in the account too, so another phone doesn't show it again.
// Best effort.
async function saveToAccount(value) {
  try { await supabase?.auth.updateUser({ data: { start_request: value } }); } catch { /* offline */ }
}

async function saveMyInstruments(teamId, userId, parts) {
  const instruments = parts.filter(p => INSTRUMENT_PARTS.includes(p));
  if (!supabase || !teamId || !userId || instruments.length === 0) return;
  const { data, error } = await supabase
    .from('team_members').select('id').eq('team_id', teamId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (data?.id) await saveMemberInstruments(supabase, { memberId: data.id, instruments });
}

function canShare() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/** The leader's steps once the team exists. */
function AfterCreate({ team, userId, request, onRequestChange, onOpenTeam }) {
  const [step, setStep] = useState('instruments');
  const [parts, setParts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const name = team.name || request?.church || 'your team';
  const url = link?.code ? joinUrl(window.location.origin, link.code) : null;

  useEffect(() => {
    if (step !== 'invite' || link) return undefined;
    let cancelled = false;
    getTeamJoinLink(team.id)
      .then(res => { if (!cancelled) setLink(res); })
      .catch(err => { if (!cancelled) setError(err.message || 'Couldn’t make the invite. Check your connection.'); });
    return () => { cancelled = true; };
  }, [step, link, team.id]);

  const finish = () => {
    finishChurchRequest(userId);
    saveToAccount(null);
    onRequestChange?.({ ...request, done: true });
    onOpenTeam?.(team.id);
  };

  if (step === 'instruments') {
    return (
      <InstrumentsView
        parts={parts}
        onPartsChange={setParts}
        progress={{ step: 3, of: 5 }}
        busy={busy}
        error={error}
        onContinue={async () => {
          setBusy(true);
          setError('');
          try {
            await saveMyInstruments(team.id, userId, parts);
            setStep('invite');
          } catch (err) {
            setError(err?.message || 'That didn’t save. Check your connection and try again.');
          } finally { setBusy(false); }
        }}
      />
    );
  }

  if (step === 'invite') {
    return (
      <InviteTeamView
        code={link?.code}
        url={url}
        copied={copied}
        error={error}
        onBack={() => { setError(''); setStep('instruments'); }}
        onCopy={async () => {
          try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* no clipboard */ }
        }}
        onShare={canShare() ? async () => {
          try {
            await navigator.share({ title: `Join ${name} on Setlists.md`, text: `Join ${name} on Setlists.md. The code is ${link.code.toUpperCase()}.`, url });
            setStep('app');
          } catch { /* cancelled */ }
        } : null}
        onLater={() => setStep('app')}
      />
    );
  }

  return <GetAppScreen teamName={name} onOpen={finish} onBack={() => setStep('invite')} progress={{ step: 5, of: 5 }} />;
}

export default function StartFlow({ screen, user, displayName, request, team, onRequestChange, onSignOut, onOpenTeam, onJoinCode }) {
  const { createTeam } = useTeam();
  const [step, setStep] = useState('choose'); // choose | code | paste | new | owned
  const [church, setChurch] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState(null);
  const [link, setLink] = useState('');
  const userId = user?.id;
  const first = (displayName || '').trim().split(/\s+/)[0];
  const back = () => { setStep('choose'); setTried(false); setMessage(''); setAnswer(null); };

  if (screen === 'ready' && team) {
    return <AfterCreate team={team} userId={userId} request={request} onRequestChange={onRequestChange} onOpenTeam={onOpenTeam} />;
  }

  if (step === 'owned' && team) {
    return <AlreadyOwnView teamName={team.name} onOpen={() => onOpenTeam?.(team.id)} onBack={back} />;
  }

  if (step === 'new') {
    const send = async () => {
      setTried(true);
      const name = church.trim();
      if (!name) return;
      setBusy(true);
      setMessage('');
      const req = { church: name, at: Date.now() };
      // Set first, so the moment the group exists the next steps show.
      onRequestChange?.(req);
      try {
        await createTeam({ name, location: null, timezone: DEVICE_TZ });
        rememberChurchRequest(userId, name);
        saveToAccount(req);
        setChurch('');
        setTried(false);
      } catch (err) {
        onRequestChange?.(null);
        if (/already have a church or band/i.test(err?.message || '') && team) { setStep('owned'); return; }
        setMessage(err?.message || 'That didn’t work. Check your connection and try again.');
      } finally { setBusy(false); }
    };
    return (
      <NameTeamView value={church} onChange={setChurch} tried={tried} onSubmit={send} onBack={back} busy={busy} error={message} />
    );
  }

  if (step === 'code') {
    const check = async (code) => {
      setBusy(true);
      setMessage('');
      try {
        const res = await peekJoinLink(code);
        if (res?.status === 'ok') {
          setAnswer('Accept');
          setTimeout(() => onJoinCode?.(code), 500);
        } else {
          setAnswer('Reject');
          setMessage(res?.status === 'disabled' ? PAUSED_CODE : WRONG_CODE);
        }
      } catch (err) {
        setAnswer('Reject');
        setMessage(err?.message || 'Couldn’t check the code. Check your connection and try again.');
      } finally { setBusy(false); }
    };
    return (
      <EnterCodeView
        onCode={(code) => { setAnswer(null); check(code); }}
        answer={answer}
        error={message}
        busy={busy}
        onPasteLink={() => { setMessage(''); setAnswer(null); setStep('paste'); }}
        onBack={back}
      />
    );
  }

  if (step === 'paste') {
    return (
      <PasteLinkView
        value={link}
        onChange={(v) => { setLink(v); setMessage(''); }}
        onSubmit={() => {
          const code = inviteCodeFrom(link);
          if (!code) { setMessage('That doesn’t look like an invite link. Copy the whole link from the message and try again.'); return; }
          onJoinCode?.(code);
        }}
        onBack={() => { setMessage(''); setStep('code'); }}
        error={message}
      />
    );
  }

  return (
    <JoinOrCreateView
      name={first}
      onJoin={() => setStep('code')}
      onCreate={() => setStep('new')}
      onSignOut={onSignOut}
    />
  );
}
