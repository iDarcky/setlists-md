import { useEffect, useRef, useState } from 'react';

/**
 * Element 5's way in — a floating action, bottom-right, practice only.
 *
 * ## Why it floats instead of living in the top bar
 *
 * The bar had five icons and a truncating title before this (owner,
 * 2026-08-09: *"I feel like it's too much for the header"*). Three surfaces,
 * three questions, and membership follows from that rather than from arguing
 * case by case:
 *
 *   · the TOP BAR answers *where am I* — song, key, tempo, position
 *   · the FOOTER answers *where am I going* — prev / next / finish
 *   · this answers *what can I do to this song right now*
 *
 * So the ☰ stays out (that is how the page is PAINTED, a different category)
 * and so does ✕ (element 1: nothing goes near the exit).
 *
 * ## Two things that stop it being a dead circle
 *
 * **It hides while you scroll.** It sits over the note GUTTER — the one strip
 * of chart that notes already own — so leaving it there during a run-through
 * would put a button on the thing it exists to write. In practice you are
 * stationary when you want to annotate and moving when you do not, so the
 * scroll itself is the signal.
 *
 * **It becomes Cancel while a mode is on.** During the one moment the gutter
 * is actually in use, it is not offering something else.
 *
 * Actions are labelled pills, not bare icons: five unlabelled circles is a
 * guessing game, and this is practice, not a stage.
 */
export default function ReaderNoteFab({ mode, onPick, onCancel, scrollRef, bottom = 0 }) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const idleRef = useRef(null);

  // ⚠ Native listener on the SCROLLER, not React state per scroll event. A
  // scroll fires continuously; `setHidden` is called only on the transitions,
  // and the idle timer is what brings it back.
  useEffect(() => {
    const sc = scrollRef?.current;
    if (!sc) return undefined;
    const onScroll = () => {
      setHidden(true);
      clearTimeout(idleRef.current);
      idleRef.current = setTimeout(() => setHidden(false), 550);
    };
    sc.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      sc.removeEventListener('scroll', onScroll);
      clearTimeout(idleRef.current);
    };
  }, [scrollRef]);

  // A mode is on: the stack is irrelevant and the button is the way out.
  // Derived, NOT an effect that calls `setOpen` — setting state synchronously
  // inside an effect is a cascading render, and this needs no state at all.
  const armed = !!mode;
  const stackOpen = open && !armed;

  return (
    <div
      className="absolute right-3 z-30 flex flex-col items-end gap-2 pointer-events-none"
      style={{
        bottom: `calc(${bottom}px + 12px)`,
        // Hiding is a fade AND a drop, so it reads as getting out of the way
        // rather than blinking off. Never while a mode is on — you always need
        // the way out.
        opacity: hidden && !armed ? 0 : 1,
        transform: hidden && !armed ? 'translateY(8px)' : 'none',
        transition: 'opacity 160ms ease, transform 160ms ease',
      }}
    >
      {stackOpen && (
        <>
          <Pill label="Cue" hint="on a section" onClick={() => { setOpen(false); onPick('cue'); }} />
          <Pill label="Note" hint="on a line" onClick={() => { setOpen(false); onPick('note'); }} />
        </>
      )}

      <button
        type="button"
        onClick={() => (armed ? onCancel() : setOpen(v => !v))}
        aria-label={armed ? 'Cancel' : (stackOpen ? 'Close' : 'Add a note or cue')}
        aria-expanded={stackOpen}
        className="pointer-events-auto w-12 h-12 rounded-full grid place-items-center border-none cursor-pointer shadow-lg"
        style={{
          background: armed || stackOpen ? 'var(--color-brand)' : 'var(--chart-bg, var(--ds-background-100))',
          color: armed || stackOpen ? '#fff' : 'var(--chart-text, var(--ds-gray-1000))',
          boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
          outline: armed || stackOpen ? 'none' : '1px solid var(--chart-rule, var(--ds-gray-400))',
        }}
      >
        {armed || stackOpen ? <CloseIcon /> : <NoteIcon />}
      </button>
    </div>
  );
}

function Pill({ label, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pointer-events-auto min-h-0 h-9 pl-3 pr-3.5 rounded-full flex items-center gap-2 border cursor-pointer shadow-lg"
      style={{
        background: 'var(--chart-bg, var(--ds-background-100))',
        borderColor: 'var(--chart-rule, var(--ds-gray-400))',
        color: 'var(--chart-text, var(--ds-gray-1000))',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
      }}
    >
      <span className="text-label-13 font-semibold">{label}</span>
      <span className="text-label-11" style={{ color: 'var(--chart-subtle, var(--ds-gray-700))' }}>{hint}</span>
    </button>
  );
}

function NoteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" /><path d="M9 13h6" /><path d="M9 17h4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
