import { useState } from 'react';
import { Sheet } from '@/ui/shadcn/sheet';
import { Button } from '@/ui/shadcn/button';

// ⋯ → Print. Order sheet or Charts, then the preview — which carries band notes
// and who leads (QA 11 Nov: moved there from here), and for Charts also text
// size, chords, columns and repeats. The last choices are remembered per device.

const KEY = 'setlists-md:print-choice';
const DEFAULTS = { mode: 'overview', notes: true, leads: true };

function readChoice() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return DEFAULTS; }
}

const LAYOUTS = [
  ['overview', 'Order sheet', 'One page: the order, keys, who leads, times and notes. For the music stand.'],
  ['full', 'Charts', 'The order sheet first, then every song with chords, in the key it’s played in.'],
];


export function PrintBody({ choice, setChoice, onPrint }) {
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
      <Button onClick={onPrint}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z" /></svg>
        Preview and print
      </Button>
    </div>
  );
}

export default function PrintSheet({ open, onClose, onPrint }) {
  const [choice, setChoice] = useState(readChoice);
  const print = () => {
    try { localStorage.setItem(KEY, JSON.stringify(choice)); } catch { /* private mode */ }
    onClose();
    onPrint(choice);
  };
  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }} title="Print" className="h-auto max-h-[90dvh] sm:max-w-[480px]">
      <PrintBody choice={choice} setChoice={setChoice} onPrint={print} />
    </Sheet>
  );
}
