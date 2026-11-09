import { useState } from 'react';
import { Toggle } from '@/ui/shadcn/toggle';
import { Alert } from '@/ui/shadcn/alert';
import { Button } from '@/ui/shadcn/button';
import { Sheet } from '@/ui/shadcn/sheet';
import { INSTRUMENTS, VOCAL_PARTS } from '@/data/instruments';

const Label = ({ children }) => (
  <div className="px-1 pb-2 pt-5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground first:pt-0">{children}</div>
);

/**
 * What someone plays and sings — the one picker, used by Profile, the Home
 * card's pop-up and a leader's Edit on the person pop-up.
 *
 * No limit (owner, 2026-11-04): any number of instruments AND any number of
 * sung parts. Tokens in, tokens out (`drums`, `vocals:alto`; see
 * `data/instruments.js`). Every tap saves, so `onChange` gets the whole list.
 *
 * @param {string[]} tokens  normalised tokens
 * @param {(next: string[]) => void} onChange
 * @param {string} [playLabel]  heading over the instruments
 * @param {string} [singLabel]  heading over the parts
 */
export function PartsPicker({ tokens = [], onChange, busy = false, error = '', playLabel = 'Plays', singLabel = 'Sings' }) {
  const toggle = (token) => onChange?.(tokens.includes(token) ? tokens.filter(t => t !== token) : [...tokens, token]);
  return (
    <div className="flex flex-col font-sans">
      <Label>{playLabel}</Label>
      <div className="grid grid-cols-2 gap-2">
        {INSTRUMENTS.map(i => (
          <Toggle key={i.id} variant="option" disabled={busy} pressed={tokens.includes(i.id)} onPressedChange={() => toggle(i.id)}>
            {i.label}
          </Toggle>
        ))}
      </div>
      <Label>{singLabel}</Label>
      <div className="grid grid-cols-2 gap-2">
        {VOCAL_PARTS.map(p => {
          const token = `vocals:${p.id}`;
          return (
            <Toggle key={p.id} variant="option" disabled={busy} pressed={tokens.includes(token)} onPressedChange={() => toggle(token)}>
              {p.label}
            </Toggle>
          );
        })}
      </div>
      {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
    </div>
  );
}

/**
 * The picker in a pop-up, with one Save: Home's "What do you play?" and a
 * leader's Edit on the person pop-up. Taps change a draft; nothing is written
 * until Save, so the Home card does not vanish under the first tap.
 *
 * @param {string[]} tokens  what is saved now
 * @param {(next: string[]) => Promise<void>} onSave  throws to show an error
 */
export function PartsSheet({ open, onOpenChange, title, intro, tokens = [], onSave, playLabel, singLabel, allowEmpty = false }) {
  const [draft, setDraft] = useState(tokens);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [wasOpen, setWasOpen] = useState(open);
  // Start from what is saved each time it opens.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) { setDraft(tokens); setError(''); }
  }
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await onSave?.(draft);
      onOpenChange?.(false);
    } catch (err) {
      setError(err?.message || 'Couldn’t save that. Try again.');
    } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} className="h-auto sm:max-w-[480px]">
      <div className="flex flex-col gap-4">
        {intro && <p className="m-0 text-[14px] leading-5 text-muted-foreground">{intro}</p>}
        <PartsPicker tokens={draft} onChange={setDraft} busy={busy} error={error} playLabel={playLabel} singLabel={singLabel} />
        <Button onClick={save} loading={busy} disabled={!allowEmpty && draft.length === 0}>Save</Button>
      </div>
    </Sheet>
  );
}
