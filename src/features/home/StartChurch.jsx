import { useState } from 'react';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';
import { Sheet } from '@/ui/shadcn/sheet';
import { FieldGroup, Field, FieldLabel, FieldDescription, FieldError } from '@/ui/shadcn/field';
import { TeamIcon, CheckIcon } from '@/app/navIcons';

// Home, for an account that belongs to no church yet. Two ways in: a join
// link from the worship leader, or asking us to set the church up (by hand
// during the beta). Pure view: Home.jsx sends the request.

export function StartChurchCard({ sent, onStart }) {
  if (sent) {
    return (
      <section aria-label="Your church" className="flex items-start gap-3 rounded-card border border-border bg-card p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-selected text-link"><CheckIcon size={22} /></span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="m-0 text-[16px] font-semibold leading-6">We’re setting up {sent.church || 'your church'}</h2>
          <p className="m-0 text-[14px] leading-5 text-muted-foreground">
            We’ll email you when it’s ready, usually within two days. Then you’ll get a join link to share with your band.
          </p>
        </div>
      </section>
    );
  }
  return (
    <section aria-label="Your church" className="flex flex-col gap-3 rounded-card border border-border bg-card p-4 sm:flex-row sm:items-center sm:gap-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-selected text-link"><TeamIcon size={22} /></span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="m-0 text-[16px] font-semibold leading-6">Bring your church</h2>
          <p className="m-0 text-[14px] leading-5 text-muted-foreground">
            Already on Setlists.md? Open the join link your worship leader sent you. Leading the music yourself? Ask us to set your church up.
          </p>
        </div>
      </div>
      <Button className="sm:shrink-0" onClick={onStart}>Ask to start a church</Button>
    </section>
  );
}

const EMPTY = { church: '', place: '', people: '', note: '' };

export function StartChurchSheet({ open, onOpenChange, email, onSend }) {
  const [values, setValues] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tried, setTried] = useState(false);
  const set = (k) => (e) => setValues(v => ({ ...v, [k]: e.target.value }));
  const missing = { church: !values.church.trim(), place: !values.place.trim() };

  const send = async (e) => {
    e.preventDefault();
    setTried(true);
    if (missing.church || missing.place) return;
    setBusy(true);
    setError('');
    try {
      await onSend?.(values);
      setValues(EMPTY);
      setTried(false);
      onOpenChange?.(false);
    } catch (err) {
      setError(err?.message || 'Couldn’t send that. Try again.');
    } finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Ask to start a church" className="h-auto sm:max-w-[480px]">
      <form className="flex flex-col gap-5" onSubmit={send} noValidate>
        <p className="m-0 text-[14px] leading-5 text-muted-foreground">
          During the beta we set each church up by hand. Tell us who you are and we’ll email {email ? <b className="font-medium text-foreground">{email}</b> : 'you'} when it’s ready, usually within two days.
        </p>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="sc-church">Church or band name</FieldLabel>
            <Input id="sc-church" autoComplete="organization" value={values.church} onChange={set('church')} aria-invalid={tried && missing.church} />
            {tried && missing.church && <FieldError>Add the name your band knows it by.</FieldError>}
          </Field>
          <Field>
            <FieldLabel htmlFor="sc-place">Town and country</FieldLabel>
            <Input id="sc-place" autoComplete="address-level2" value={values.place} onChange={set('place')} aria-invalid={tried && missing.place} />
            {tried && missing.place && <FieldError>Add where the church is, so we can tell it apart.</FieldError>}
          </Field>
          <Field>
            <FieldLabel htmlFor="sc-people">How many people will use it?</FieldLabel>
            <Input id="sc-people" inputMode="numeric" value={values.people} onChange={set('people')} />
            <FieldDescription>A guess is fine. Optional.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="sc-note">Anything else?</FieldLabel>
            <Input id="sc-note" value={values.note} onChange={set('note')} />
            <FieldDescription>Optional.</FieldDescription>
          </Field>
        </FieldGroup>
        <FieldError>{error}</FieldError>
        <Button type="submit" loading={busy}>Send request</Button>
      </form>
    </Sheet>
  );
}
