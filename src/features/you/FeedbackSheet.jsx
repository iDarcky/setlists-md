import { useId, useState } from 'react';
import { Sheet } from '@/ui/shadcn/sheet';
import { Button } from '@/ui/shadcn/button';
import { Toggle } from '@/ui/shadcn/toggle';
import { Alert } from '@/ui/shadcn/alert';
import { supabase } from '@/auth/supabase';

// Send feedback (owner, 2026-11-14): a form in the app, the easiest way for
// someone to tell us something. Rows go to the `feedback` table
// (20260611_create_feedback.sql): anyone may insert, nobody but the
// maintainer reads.

const KINDS = [
  { id: 'bug', label: 'Something’s broken' },
  { id: 'feature', label: 'An idea' },
  { id: 'general', label: 'Other' },
];
const MAX = 2000;

/** `send` is injectable for tests; it defaults to the Supabase insert. */
export default function FeedbackSheet({ open, onOpenChange, userId = null, send }) {
  const uid = useId();
  const [kind, setKind] = useState('bug');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const close = (o) => {
    if (!o) { setSent(false); setError(''); }
    onOpenChange?.(o);
  };

  const submit = async (e) => {
    e.preventDefault();
    const description = text.trim();
    if (!description || busy) return;
    setBusy(true);
    setError('');
    try {
      const row = { user_id: userId, type: kind, description, user_agent: navigator.userAgent };
      if (send) await send(row);
      else {
        if (!supabase) throw new Error('offline');
        const { error: err } = await supabase.from('feedback').insert(row);
        if (err) throw err;
      }
      setSent(true);
      setText('');
      setKind('bug');
    } catch {
      setError(navigator.onLine === false ? 'You’re offline. Try again when you’re back online.' : 'Couldn’t send that. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={close} title="Send feedback" className="h-auto sm:max-w-[480px]">
      {sent ? (
        <div className="flex flex-col gap-4 py-2">
          <p className="m-0 text-[16px] leading-[24px]">Thank you. We read every one.</p>
          <Button onClick={() => close(false)}>Done</Button>
        </div>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <span id={`${uid}-kind`} className="text-[14px] font-medium">What is it about?</span>
          <div role="group" aria-labelledby={`${uid}-kind`} className="flex flex-wrap gap-2">
            {KINDS.map(k => (
              <Toggle key={k.id} pressed={kind === k.id} onPressedChange={() => setKind(k.id)}>{k.label}</Toggle>
            ))}
          </div>
          <label htmlFor={`${uid}-text`} className="pt-1 text-[14px] font-medium">Tell us</label>
          <textarea
            id={`${uid}-text`}
            value={text}
            maxLength={MAX}
            rows={6}
            onChange={e => setText(e.target.value)}
            placeholder={kind === 'bug' ? 'What happened, and what did you expect?' : kind === 'feature' ? 'What would help you or your band?' : 'Anything you want us to know.'}
            className="min-h-[140px] w-full resize-y rounded-control border border-input bg-transparent px-3.5 py-3 font-sans text-body text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
          <p className="m-0 text-[13px] leading-[18px] text-muted-foreground">We see who sent it and which phone or browser you use, so we can follow up. Nothing else.</p>
          {error && <Alert variant="danger">{error}</Alert>}
          <Button type="submit" className="mt-1" disabled={!text.trim()} loading={busy}>Send</Button>
        </form>
      )}
    </Sheet>
  );
}
