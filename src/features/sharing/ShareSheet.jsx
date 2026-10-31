import { useEffect, useState } from 'react';
import { Sheet } from '@/ui/shadcn/sheet';
import { Button } from '@/ui/shadcn/button';
import { toast } from '@/ui/use-toast';
import {
  createSetlistShare, endsLabel, findSetlistShare, moveShareEnd, revokeSetlistShare, shareEndsAt,
} from '@/lib/setlistShare';

// "Share a guest link": a drawer on a phone, a dialog from 640px. First what a
// guest sees and when the link ends, then Copy / Send… / Stop sharing. No
// expiry picker: the link ends 3 hours after the service.

const Icon = ({ d }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d.map(p => <path key={p} d={p} />)}
  </svg>
);
const EYE = ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'];
const LOCK = ['M6 11h12v10H6z', 'M8 11V7a4 4 0 0 1 8 0v4'];
const CLOCK = ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'];
const LINK = ['M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7', 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7'];
const COPY = ['M9 9h11v11H9z', 'M5 15H4V4h11v1'];
const SEND = ['M22 2 11 13', 'M22 2l-7 20-4-9-9-4z'];

const Fact = ({ d, children }) => (
  <div className="flex items-start gap-3 text-[15px] leading-6 text-muted-foreground">
    <span className="mt-1 text-foreground"><Icon d={d} /></span>
    <span>{children}</span>
  </div>
);

export function ShareBody({ state, ends, onCreate, onCopy, onSend, onStop, canSend, busy }) {
  if (state === 'loading') {
    return <p className="m-0 py-6 text-center text-[15px] text-muted-foreground">One moment…</p>;
  }
  if (state === 'new') {
    return (
      <div className="flex flex-col gap-5 font-sans">
        <p className="m-0 text-[15px] leading-6 text-muted-foreground">
          For someone who isn’t in the church on Setlists.md: a guest musician, the sound desk, whoever runs the slides.
        </p>
        <div className="flex flex-col gap-3">
          <Fact d={EYE}>They see the order and every chart, and can switch between chords and lyrics. Always the latest version.</Fact>
          <Fact d={LOCK}>They don’t see who’s playing, notes about people, or anything else in the church.</Fact>
          <Fact d={CLOCK}>The link stops working <b className="font-semibold text-foreground">3 hours after the service</b> ({ends}).</Fact>
        </div>
        <Button onClick={onCreate} loading={busy}><Icon d={LINK} />Create link</Button>
      </div>
    );
  }
  const { url } = state;
  return (
    <div className="flex flex-col gap-4 font-sans">
      <div className="truncate rounded-control border border-input bg-raised px-3.5 py-3 font-mono text-[14px] text-foreground" title={url}>
        {url.replace(/^https?:\/\//, '')}
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={onCopy}><Icon d={COPY} />Copy</Button>
        {canSend && <Button className="flex-1" variant="outline" onClick={onSend}><Icon d={SEND} />Send…</Button>}
      </div>
      <p className="m-0 text-[15px] leading-6 text-muted-foreground">
        Works until <b className="font-semibold text-foreground">{ends}</b>. Changes you make to the setlist show up for guests right away.
      </p>
      <Button variant="ghost" className="text-danger-text hover:text-danger-text" onClick={onStop} loading={busy}>Stop sharing</Button>
    </div>
  );
}

export default function ShareSheet({ open, onClose, setlist, songs, ownerId, teamId, ensureRow, setlistMap = {}, clockFormat }) {
  const [state, setState] = useState('loading');
  const [busy, setBusy] = useState(false);
  const endsMs = shareEndsAt(setlist);
  const ends = endsLabel(endsMs, clockFormat);
  const canSend = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setState('loading');
    findSetlistShare(setlist, ownerId).then(found => {
      if (!alive) return;
      setState(found || 'new');
      // The service moved since the link was made: the link follows it.
      if (found && Math.abs(new Date(found.expiresAt).getTime() - endsMs) > 60000) {
        moveShareEnd(found.token, new Date(endsMs).toISOString()).catch(() => {});
      }
    }).catch(() => { if (alive) setState('new'); });
    return () => { alive = false; };
    // endsMs follows the setlist; re-reading on every render would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, setlist?.id, ownerId]);

  const create = async () => {
    setBusy(true);
    try {
      const rowId = teamId ? (setlistMap[setlist.id] || await ensureRow?.(setlist)) : null;
      setState(await createSetlistShare(setlist, songs, { ownerId, teamId, rowId }));
    } catch {
      toast({ title: 'Couldn’t make the link', description: 'Check your connection and try again.', variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.url);
      toast({ title: 'Link copied' });
    } catch {
      toast({ title: 'Couldn’t copy', description: 'The clipboard isn’t available here.', variant: 'error' });
    }
  };

  const send = async () => {
    try {
      await navigator.share({ title: setlist.name || 'Setlist', url: state.url });
    } catch { /* closed the share sheet */ }
  };

  const stop = async () => {
    setBusy(true);
    try {
      await revokeSetlistShare(state.token);
      setState('new');
      toast({ title: 'Stopped sharing', description: 'The link doesn’t open any more.' });
    } catch {
      toast({ title: 'Couldn’t stop sharing', description: 'Check your connection and try again.', variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const title = state === 'new' || state === 'loading' ? 'Share a guest link' : 'Guest link';
  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }} title={title} className="h-auto max-h-[90dvh] sm:max-w-[480px]">
      <ShareBody state={state} ends={ends} canSend={canSend} busy={busy}
        onCreate={create} onCopy={copy} onSend={send} onStop={stop} />
    </Sheet>
  );
}
