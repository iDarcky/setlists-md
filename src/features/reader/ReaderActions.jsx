import { useEffect, useRef, useState } from 'react';
import { MetronomeIcon } from './ReaderPracticeRow';

/**
 * The reader's two floating controls, bottom-right: **Edit** (48px) with the
 * **click** riding above it (40px).
 *
 * ## Why two circles and not one menu
 *
 * Round 3 made this one button with a stack of four, and the stack was hiding
 * the fact that its contents answered two different questions. Two circles say
 * it without a label:
 *
 *   · the BIG one changes the song       — Edit
 *   · the SMALL one changes how you play it — the click
 *   · the TOP BAR says where you are     — ☰ · key · ✕
 *   · the FOOTER says where you're going — prev / next / finish
 *
 * Size is the whole hierarchy. A 40px satellite over a 48px primary reads as
 * secondary before you have identified either glyph.
 *
 * ## Both go while EDITING, and the top bar still never changes
 *
 * The plan was for Edit to stay and become Done in place. Built and looked at,
 * that put a "Stop editing" circle about 80px above the edit bar's **Done** —
 * same corner, same job, two buttons. The edit bar already owns the way out
 * (Cancel · Done), and it appears in exactly the corner this would have
 * occupied, so the corner is never empty.
 *
 * What that plan was actually protecting is intact: no control BOUNCES BACK to
 * the top bar when you start editing. The bar is the one thing in the reader
 * whose shape never changes, in any view, in any mode.
 *
 * ## What hides, and when
 *
 * Both drop away while you SCROLL — they sit over the note gutter, the one
 * strip of chart notes already own, and leaving a button there during a
 * run-through puts it on the thing it exists to write. You are stationary when
 * you want to annotate and moving when you do not.
 *
 * The click never hides while it is RUNNING, because you always need the stop.
 *
 * ⚠ **Every colour here is a LONGHAND.** jsdom's shorthand expander throws on
 * `background`/`outline` containing a nested `var(...)`, inside the `cloneNode`
 * that every `getByRole` performs — one shorthand on a button takes out every
 * role-based test that renders the reader. See READER.md's trap list.
 */
export default function ReaderActions({
  scrollRef, bottom = 0,
  // Edit — the primary. Null when this view cannot change the song at all
  // (live, the hub, a read-only library), and then there is no big circle.
  onEdit = null, editing = false,
  // The click — the satellite. Null in live as of 2026-08-09.
  onPractice = null, practiceOpen = false, practiceRunning = false,
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

  // A running click is never hidden — the stop has to be reachable the moment
  // you want it, and "scroll to get your button back" is not that.
  const away = hidden && !practiceRunning;
  // Editing hands the whole corner to the edit bar — see the note above.
  const showClick = !!onPractice && !editing;
  const showEdit = !!onEdit && !editing;
  if (!showEdit && !showClick) return null;

  return (
    <div
      className="absolute right-3 z-30 flex flex-col items-end gap-2.5 pointer-events-none"
      style={{
        bottom: `calc(${bottom}px + 12px)`,
        // Getting out of the way is a fade AND a drop, so it reads as moving
        // rather than blinking.
        opacity: away ? 0 : 1,
        transform: away ? 'translateY(8px)' : 'none',
        transitionProperty: 'opacity, transform',
        transitionDuration: '160ms',
        transitionTimingFunction: 'ease',
      }}
    >
      {showClick && (
        <Circle
          size={40}
          glyph={18}
          aria={practiceOpen ? 'Close practice tools' : 'Practice tools'}
          pressed={practiceOpen}
          // Gold, not brand: `--chord` is already the colour a running click
          // wears in the practice row, so the button and the row it opens are
          // visibly the same thing.
          lit={practiceOpen}
          litBg="var(--chord)"
          litInk="#0a0a0a"
          onClick={onPractice}
        >
          <MetronomeIcon />
        </Circle>
      )}

      {showEdit && (
        <Circle
          size={48}
          glyph={22}
          aria="Edit this song"
          pressed={false}
          lit={false}
          litBg="var(--color-brand)"
          litInk="#fff"
          onClick={onEdit}
        >
          <PencilIcon />
        </Circle>
      )}
    </div>
  );
}

/**
 * ⚠ Two things here were wrong the first time and are worth keeping wrong-proof.
 *
 * **The glyph is sized off the circle, not hardcoded.** `MetronomeIcon` and the
 * bar's `EditIcon` carry `width="15"`/`width="16"` — right for a 32px bar
 * button, and left at that they made the 48px primary wear a 33%-of-diameter
 * glyph while the 40px secondary wore 37.5%. The BIG button read weaker than
 * the small one, which inverts the whole reason there are two sizes. Both are
 * ~45% now, set in CSS so it overrides the SVG's own attributes.
 *
 * **A BORDER, not an outline.** An outline is painted outside the border box,
 * so a 48px control drew a 50px ring and the two circles' rings sat at
 * different offsets from their fills. A border is part of the box (Tailwind's
 * preflight makes everything `border-box`), hugs `border-radius` identically on
 * every engine, and keeps well clear of Firefox's focus-ring quirk on small
 * round controls — see CLAUDE.md.
 */
function Circle({ size, glyph, aria, pressed, lit, litBg, litInk, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
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
        transitionProperty: 'background-color, color, border-color',
        transitionDuration: '180ms',
        transitionTimingFunction: 'ease',
      }}
    >
      <span
        className="grid place-items-center [&>svg]:w-[var(--glyph)] [&>svg]:h-[var(--glyph)]"
        style={{ '--glyph': `${glyph}px` }}
      >
        {children}
      </span>
    </button>
  );
}

/**
 * A pencil, and ONLY a pencil. The edit bar's `EditIcon` is a pencil plus the
 * short underline stroke beneath it — a fine glyph in a row of icons, and a
 * diagonal composition inside a circle: the mass sits upper-left, the stroke
 * hangs lower-right, and the ring around it reads as off-register even though
 * it is a perfect circle. That is what "the edit circle outline is wrong
 * somehow" was seeing. One centred mark instead.
 */
function PencilIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16.8 3.7a2.4 2.4 0 0 1 3.4 3.4L7.9 19.4l-4.4 1 1-4.4Z" />
    </svg>
  );
}
