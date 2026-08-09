import { useEffect, useRef, useState } from 'react';
import { MetronomeIcon } from './ReaderPracticeRow';

/**
 * The reader's floating controls, bottom-right. Two circles, and the pair
 * changes job with the mode rather than moving:
 *
 *              READING                    EDITING
 *   big  (48)  Edit                       Done
 *   small(44)  the click                  Undo
 *   above      —                          "New version", only when dirty
 *
 * ## Why the corner and not the bar
 *
 * Round 3 made this one button with a stack of four, and the stack was hiding
 * the fact that its contents answered two different questions. Three surfaces,
 * three questions:
 *
 *   · the TOP BAR says where you are      — ☰ · key · ✕
 *   · HERE is what you do to the song     — Edit / Done, the click / Undo
 *   · the FOOTER says where you're going  — prev / next / finish
 *
 * Size is the whole hierarchy. A 44px satellite over a 48px primary reads as
 * secondary before you have identified either glyph.
 *
 * ## Why there is no edit bar any more
 *
 * There were three bottom bars in edit mode (nav, practice, edit) against
 * element 12's rule of never more than two, and the edit bar's four controls
 * all had homes already:
 *
 *   Done   → this circle, in place, filled. The corner does not move when the
 *            mode changes, so the thing you press to finish is where the thing
 *            you pressed to start was.
 *   Undo   → the satellite slot the click vacates. Editing has no click.
 *   Cancel → the top bar's ✕, which was DISABLED in edit mode: dead pixels in
 *            the most reachable spot on the screen. ✕ already means "get out
 *            without keeping".
 *   New
 *   version→ a labelled pill above the circles, and only when something has
 *            actually changed. It stays WORDS: "make this a second version of
 *            the song instead of changing this one" is not a concept any 16px
 *            glyph carries — the reason the old bar spelled it out.
 *
 * That reclaims a whole bar's height of chart on a phone.
 *
 * ## What hides, and when
 *
 * They drop away while you SCROLL — they sit over the note gutter, the one
 * strip of chart notes already own, and leaving a button there during a
 * run-through puts it on the thing it exists to write. You are stationary when
 * you want to annotate and moving when you do not.
 *
 * Never while EDITING (Done must not be something you scroll to find) and never
 * while the click is RUNNING (you always need the stop).
 *
 * ⚠ **Every colour here is a LONGHAND.** jsdom's shorthand expander throws on
 * `background`/`outline` containing a nested `var(...)`, inside the `cloneNode`
 * that every `getByRole` performs — one shorthand on a button takes out every
 * role-based test that renders the reader. See READER.md's trap list.
 */
export default function ReaderActions({
  scrollRef, bottom = 0, editing = false,
  // ── Reading ──────────────────────────────────────────────────────────────
  // Null when this view cannot change the song at all (live, the hub, a
  // read-only library), and then there is no big circle.
  onEdit = null,
  // Null in live as of 2026-08-09.
  onPractice = null, practiceOpen = false, practiceRunning = false,
  // ── Editing ──────────────────────────────────────────────────────────────
  onDone = null, onUndo = null, canUndo = false,
  onNewVersion = null, dirty = false,
}) {
  const [hidden, setHidden] = useState(false);
  const idleRef = useRef(null);

  // ⚠ Native listener on the SCROLLER, not React state per scroll event. A
  // scroll fires continuously; `setHidden` runs only on the transitions, and
  // the idle timer is what brings them back.
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

  const away = hidden && !practiceRunning && !editing;

  const big = editing
    ? (onDone && { aria: 'Done', lit: true, litBg: 'var(--color-brand)', litInk: '#fff', run: onDone, icon: <CheckIcon /> })
    : (onEdit && { aria: 'Edit this song', lit: false, litBg: 'var(--color-brand)', litInk: '#fff', run: onEdit, icon: <PencilIcon /> });

  const small = editing
    ? (onUndo && {
      aria: 'Undo the last change', lit: false, run: onUndo, disabled: !canUndo,
      litBg: 'var(--color-brand)', litInk: '#fff', icon: <UndoIcon />,
    })
    : (onPractice && {
      aria: practiceOpen ? 'Close practice tools' : 'Practice tools',
      // Gold, not brand: `--chord` is already the colour a running click wears
      // in the practice row, so the button and the row it opens are visibly the
      // same thing.
      lit: practiceOpen, litBg: 'var(--chord)', litInk: '#0a0a0a',
      pressed: practiceOpen, run: onPractice, icon: <MetronomeIcon />,
    });

  if (!big && !small) return null;

  return (
    <div
      className="absolute right-3 z-30 flex flex-col items-end gap-2.5 pointer-events-none"
      style={{
        // ⚠ `bottom` TRANSITIONS. It is driven by the measured height of the
        // sticky bottom block, so opening the click used to teleport both
        // circles up the instant the row mounted, while the row itself slid.
        // Two things moving the same distance on the same cue have to move
        // together or the pair reads as broken.
        bottom: `calc(${bottom}px + 12px)`,
        opacity: away ? 0 : 1,
        transform: away ? 'translateY(8px)' : 'none',
        transitionProperty: 'opacity, transform, bottom',
        transitionDuration: '160ms, 160ms, 260ms',
        transitionTimingFunction: 'ease, ease, cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {editing && dirty && onNewVersion && (
        <button
          type="button"
          onClick={onNewVersion}
          className="reader-fab-pill pointer-events-auto min-h-0 h-9 px-3.5 rounded-full flex items-center border cursor-pointer"
          style={{
            backgroundColor: 'var(--chart-bg, var(--ds-background-100))',
            borderColor: 'var(--chart-rule, var(--ds-gray-400))',
            color: 'var(--chart-text, var(--ds-gray-1000))',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          }}
        >
          <span className="text-label-13 font-semibold">New version</span>
        </button>
      )}

      {small && <Circle size={44} glyph={19} {...small} />}
      {big && <Circle size={48} glyph={22} {...big} />}
    </div>
  );
}

/**
 * ⚠ Two things here were wrong the first time and are worth keeping wrong-proof.
 *
 * **The glyph is sized off the circle, not hardcoded.** `MetronomeIcon` and the
 * bar's icons carry `width="15"`/`width="16"` — right for a 32px bar button, and
 * left at that they made the 48px primary wear a 33%-of-diameter glyph while the
 * smaller one wore 37.5%. The BIG button read weaker than the small one, which
 * inverts the whole reason there are two sizes. Both are ~44% now, set in CSS so
 * it overrides the SVG's own attributes.
 *
 * **A BORDER, not an outline.** An outline is painted outside the border box, so
 * a 48px control drew a 50px ring and the two circles' rings sat at different
 * offsets from their fills. A border is part of the box (Tailwind's preflight
 * makes everything `border-box`), hugs `border-radius` identically on every
 * engine, and keeps well clear of Firefox's focus-ring quirk on small round
 * controls — see CLAUDE.md.
 */
function Circle({ size, glyph, aria, pressed, lit, litBg, litInk, run, disabled = false, icon }) {
  return (
    <button
      type="button"
      onClick={run}
      disabled={disabled}
      aria-label={aria}
      aria-pressed={pressed}
      className="pointer-events-auto rounded-full grid place-items-center cursor-pointer min-h-0 p-0"
      style={{
        width: size, height: size,
        backgroundColor: lit ? litBg : 'var(--chart-bg, var(--ds-background-100))',
        color: lit ? litInk : 'var(--chart-text, var(--ds-gray-1000))',
        boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: lit ? 'transparent' : 'var(--chart-rule, var(--ds-gray-400))',
        opacity: disabled ? 0.4 : 1,
        transitionProperty: 'background-color, color, border-color, opacity',
        transitionDuration: '180ms',
        transitionTimingFunction: 'ease',
      }}
    >
      <span
        className="grid place-items-center [&>svg]:w-[var(--glyph)] [&>svg]:h-[var(--glyph)]"
        style={{ '--glyph': `${glyph}px` }}
      >
        {icon}
      </span>
    </button>
  );
}

/**
 * A pencil, and ONLY a pencil. The edit bar's icon was a pencil plus a short
 * underline stroke beneath it — a fine glyph in a row of icons, and a diagonal
 * composition inside a circle: the mass sits upper-left, the stroke hangs
 * lower-right, and the ring around it reads as off-register even though it is a
 * perfect circle. That is what "the edit circle outline is wrong somehow" was
 * seeing. One centred mark instead.
 */
function PencilIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16.8 3.7a2.4 2.4 0 0 1 3.4 3.4L7.9 19.4l-4.4 1 1-4.4Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * The conventional undo arrow — a full curved arrow bending back on itself, the
 * one every app draws. The first cut was a partial arc that read as "refresh"
 * (owner, 2026-08-04: "the undo icon is not the normal one"). An undo control
 * is the one thing in edit mode nobody should have to think about.
 */
function UndoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 14 4 9 9 4" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </svg>
  );
}
