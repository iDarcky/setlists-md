import { useState } from 'react';
import { Sheet } from '@/ui/shadcn/sheet';
import { Button } from '@/ui/shadcn/button';

// ⋯ → Print for the band. Order sheet or Charts, three switches, then the
// phone's own print / save as PDF. The last choices are remembered per device.

const KEY = 'setlists-md:print-choice';
const DEFAULTS = { mode: 'overview', notes: true, leads: true, twoColumns: true };

function readChoice() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return DEFAULTS; }
}

const LAYOUTS = [
  ['overview', 'Order sheet', 'One page: the order, keys, who leads, times and notes. For the music stand.'],
  ['full', 'Charts', 'The order sheet first, then every song with chords, in the key it’s played in.'],
];

function Switch({ on, label, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className="flex h-[52px] min-h-0 w-full cursor-pointer items-center justify-between border-0 border-b border-border bg-transparent px-0 text-left font-sans text-[16px] text-foreground outline-none last:border-b-0 focus-visible:bg-raised">
      {label}
      <span className={`relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-input'}`}>
        <span className={`absolute top-[3px] size-5 rounded-full bg-background shadow transition-[left] ${on ? 'left-[21px]' : 'left-[3px]'}`} />
      </span>
    </button>
  );
}

export function PrintBody({ choice, setChoice, onPrint, hasLeads = true }) {
  const set = (k, v) => setChoice({ ...choice, [k]: v });
  return (
    <div className="flex flex-col gap-4 font-sans">
      <div role="radiogroup" aria-label="What to print" className="flex flex-col gap-2">
        {LAYOUTS.map(([id, title, sub]) => {
          const on = choice.mode === id;
          return (
            <button key={id} type="button" role="radio" aria-checked={on} onClick={() => set('mode', id)}
              className={`flex min-h-0 cursor-pointer items-center gap-3 rounded-card border bg-transparent p-3.5 text-left font-sans outline-none focus-visible:ring-2 focus-visible:ring-ring ${on ? 'border-foreground' : 'border-border'}`}>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <b className="text-[16px] font-semibold text-foreground">{title}</b>
                <span className="text-[14px] leading-5 text-muted-foreground">{sub}</span>
              </span>
              <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-foreground' : 'border-input'}`}>
                {on && <span className="size-2.5 rounded-full bg-foreground" />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col">
        <Switch label="Notes for the band" on={choice.notes} onChange={v => set('notes', v)} />
        {hasLeads && <Switch label="Who leads each song" on={choice.leads} onChange={v => set('leads', v)} />}
        {choice.mode === 'full' && <Switch label="Two columns for charts" on={choice.twoColumns} onChange={v => set('twoColumns', v)} />}
      </div>
      <Button onClick={onPrint}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z" /></svg>
        Print or save PDF
      </Button>
    </div>
  );
}

export default function PrintSheet({ open, onClose, onPrint, hasLeads }) {
  const [choice, setChoice] = useState(readChoice);
  const print = () => {
    try { localStorage.setItem(KEY, JSON.stringify(choice)); } catch { /* private mode */ }
    onClose();
    onPrint(choice);
  };
  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }} title="Print for the band" className="h-auto max-h-[90dvh] sm:max-w-[480px]">
      <PrintBody choice={choice} setChoice={setChoice} onPrint={print} hasLeads={hasLeads} />
    </Sheet>
  );
}
