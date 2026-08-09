import { useEffect, useRef, useState } from 'react';
import { MetronomeIcon } from './ReaderPracticeRow';
import { EditIcon } from './ReaderEditBar';

/**
 * "What can I do to this song right now" — a floating action, bottom-right.
 *
 * ## Why it floats instead of living in the top bar
 *
 * The bar had five icons beside a truncating title (owner, 2026-08-09: *"I
 * feel like it's too much for the header"*, then *"move everything else
 * there"*). Membership follows a rule rather than a case-by-case argument —
 * three surfaces, three questions:
 *
 *   · the TOP BAR answers *where am I* — song, key, tempo, position
 *   · the FOOTER answers *where am I going* — prev / next / finish
 *   · this answers *what can I do to this song right now*
 *
 * Which is also why the ☰ stays out (that is how the page is PAINTED, a
 * different category) and so does ✕ (element 1: nothing goes near the exit).
 *
 * ## Two things that stop it being a dead circle
 *
 * **It hides while you scroll.** It sits over the note GUTTER — the one strip
 * of chart that notes already own — so leaving it there during a run-through
 * would put a button on the thing it exists to write. You are stationary when
 * you want to annotate and moving when you do not, so the scroll is the signal.
 *
 * **It becomes Cancel while a mode is on.** During the one moment the gutter is
 * actually in use, it is not offering something else.
 *
 * ⚠ **Every colour here is a LONGHAND.** jsdom's shorthand expander throws on
 * `background`/`outline` containing a nested `var(...)`, and it throws inside
 * the `cloneNode` that every `getByRole` performs — so one shorthand on a
 * button takes out every role-based test that renders the reader. See
 * READER.md's trap list.
 */
export default function ReaderNoteFab({
  mode, onPick, onCancel, scrollRef, bottom = 0,
  // Notes are practice-only; the click is not. The FAB renders whenever it has
  // ANY action, so this decides only whether those two pills are in the stack —
  // live gets a smaller stack, not a missing metronome.
  canNote = false,
  onPractice = null, practiceOpen = false,
  onEdit = null,
}) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const idleRef = useRef(null);

  // ⚠ Native listener on the SCROLLER, not React state per scroll event. A
  // scroll fires continuously; `setHidden` runs only on the transitions, and
  // the idle timer is what brings it back.
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

  // Derived, NOT an effect calling `setOpen`: closing the stack when a mode
  // arrives looks like an effect's job and is a cascading render.
  const armed = !!mode;
  const stackOpen = open && !armed;

  // `aria` is deliberately NOT the visible label. Moving a control must not
  // rename it: the click and Edit keep the names they had in the top bar, so
  // "is Edit offered in practice?" is still one question with one answer, asked
  // the same way, wherever the control happens to live this month.
  const actions = [
    onEdit && {
      key: 'edit', label: 'Edit song', hint: 'words & chords',
      aria: 'Edit this song', icon: <EditIcon />, run: onEdit,
    },
    onPractice && {
      key: 'click',
      label: practiceOpen ? 'Hide the click' : 'Click & tempo',
      hint: practiceOpen ? '' : 'metronome',
      aria: practiceOpen ? 'Close practice tools' : 'Practice tools',
      icon: <MetronomeIcon />,
      run: onPractice,
    },
    canNote && {
      key: 'cue', label: 'Cue', hint: 'on a section',
      aria: 'Add a cue to a section', icon: <NoteIcon />, run: () => onPick('cue'),
    },
    canNote && {
      key: 'note', label: 'Note', hint: 'on a line',
      aria: 'Add a note to a line', icon: <NoteIcon />, run: () => onPick('note'),
    },
  ].filter(Boolean);

  if (!actions.length) return null;

  // A stack of one is a menu that isn't a menu. LIVE can do exactly one thing
  // to a song — start the click — so there the button simply IS that action:
  // its own glyph, its own name, one tap. Practice, which can do four, gets the
  // stack. Same control, same corner, in both.
  const only = actions.length === 1 && !armed ? actions[0] : null;

  // Filled means "this is doing something" — a mode is armed, the stack is out,
  // or (in the collapsed case) the one thing it does is currently ON.
  const lit = armed || stackOpen || !!(only && only.key === 'click' && practiceOpen);

  return (
    <div
      className="absolute right-3 z-30 flex flex-col items-end gap-2 pointer-events-none"
      style={{
        bottom: `calc(${bottom}px + 12px)`,
        // Getting out of the way is a fade AND a drop, so it reads as moving
        // rather than blinking. Never while a mode is on — you always need the
        // way out.
        opacity: hidden && !armed ? 0 : 1,
        transform: hidden && !armed ? 'translateY(8px)' : 'none',
        transitionProperty: 'opacity, transform',
        transitionDuration: '160ms',
        transitionTimingFunction: 'ease',
      }}
    >
      {stackOpen && !only && actions.map((a, i) => (
        <Pill
          key={a.key}
          label={a.label}
          hint={a.hint}
          aria={a.aria}
          // Staggered from the BOTTOM up — nearest the button first, so the
          // stack reads as coming out of it rather than appearing around it.
          delay={(actions.length - 1 - i) * 35}
          onClick={() => { setOpen(false); a.run(); }}
        />
      ))}

      <button
        type="button"
        onClick={() => {
          if (armed) return onCancel();
          if (only) return only.run();
          return setOpen(v => !v);
        }}
        aria-label={armed ? 'Cancel' : (only ? only.aria : (stackOpen ? 'Close' : 'Song actions'))}
        aria-pressed={only && practiceOpen && only.key === 'click' ? true : undefined}
        aria-expanded={only ? undefined : stackOpen}
        className="pointer-events-auto w-12 h-12 rounded-full grid place-items-center border-none cursor-pointer"
        style={{
          backgroundColor: lit ? 'var(--color-brand)' : 'var(--chart-bg, var(--ds-background-100))',
          color: lit ? '#fff' : 'var(--chart-text, var(--ds-gray-1000))',
          boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
          outlineStyle: lit ? 'none' : 'solid',
          outlineWidth: lit ? 0 : 1,
          outlineColor: 'var(--chart-rule, var(--ds-gray-400))',
        }}
      >
        {/* One glyph turning into the other, not a swap — a quarter turn is
            what makes the close read as the SAME control changing state. The
            collapsed case never turns: nothing is becoming a close there, the
            button is just a toggle that fills. */}
        <span
          className="grid place-items-center"
          style={{
            transform: lit && !only ? 'rotate(90deg)' : 'none',
            transitionProperty: 'transform',
            transitionDuration: '220ms',
            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {armed ? <CloseIcon /> : (only ? only.icon : (stackOpen ? <CloseIcon /> : <NoteIcon />))}
        </span>
      </button>
    </div>
  );
}

function Pill({ label, hint, aria, onClick, delay = 0 }) {
  return (
    <button
      type="button"
      aria-label={aria}
      onClick={onClick}
      className="reader-fab-pill pointer-events-auto min-h-0 h-9 pl-3 pr-3.5 rounded-full flex items-center gap-2 border cursor-pointer"
      style={{
        animationDelay: `${delay}ms`,
        backgroundColor: 'var(--chart-bg, var(--ds-background-100))',
        borderColor: 'var(--chart-rule, var(--ds-gray-400))',
        color: 'var(--chart-text, var(--ds-gray-1000))',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
      }}
    >
      <span className="text-label-13 font-semibold">{label}</span>
      {hint && (
        <span className="text-label-11" style={{ color: 'var(--chart-subtle, var(--ds-gray-700))' }}>{hint}</span>
      )}
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
