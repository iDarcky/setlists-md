// ToastStack: ported from bencho.dev (MIT, bencho.dev/licence).
// Bencho's comments are kept as written; the changes for this app are marked
// "Setlists.md:". Our corners, our stroke icons (./icons), our tokens
// (./tokens.css), and `motion/react` in place of framer-motion (the same
// library; Sileo already ships it).
import { useRef, useState } from "react";
import { motion as Motion } from "motion/react";
import { CircleCheck, CircleX, Info, TriangleAlert, X } from "./icons";
import "./tokens.css";
import "./ToastStack.css";

/* ══ Toast stack ══════════════════════════════════════════
   Three toasts, always: the newest in front, the two before it
   tucked behind with a sliver of each showing above it, a step
   smaller each and a barely-there grey (the reference's tones). Point at the stack and it
   fans out into a list; move away and it gathers back up.

   ── ONE SPRING, THREE PLACES ────────────────────────────
   A toast's place is worked out from how far back it is and
   whether the stack is open, and Framer springs it there. Opening,
   closing, a toast leaving and the next arriving are all the same
   move — every toast heading for its new place on the same spring,
   a touch under critical so it settles with a hint of give.

   ── HOVER IS THE WHOLE FRAME ────────────────────────────
   The stack opens about its middle, so the front toast moves when
   it opens. Hovering the toasts themselves would let the list slide
   out from under the pointer and close again; the frame is the
   list's own size, so hovering it is hovering the list. Pointer
   over/out with a containment test rather than enter/leave, so the
   wall's demonstration — which dispatches its own pointer events,
   and leaves with no relatedTarget — opens and closes it too (the
   tilt card's note has the long version).

   ── IT NEVER RUNS OUT ───────────────────────────────────
   Dismiss one and it slides away; a new one rises in at the front
   from the pool, so there are always three. Retry on the failed
   payment turns that toast into the payment going through, in
   place. */

const ICON = {
  success: CircleCheck,
  info: Info,
  error: CircleX,
  warning: TriangleAlert,
};

/* Setlists.md: our own messages for the preview. The retry one turns
   into the PDF reading fine, in place, as the payment did. */
const POOL = [
  { kind: "error", title: "Couldn't read 1 PDF", body: "It may be a scan.", action: "Retry" },
  { kind: "info", title: "Andrei joined Biserica Betel", body: "They can see songs and setlists." },
  { kind: "success", title: "12 songs imported", body: "2 are marked To check." },
  { kind: "warning", title: "Sunday has no drummer", body: "Ask someone in Schedule." },
  { kind: "success", title: "Setlist sent to the band", body: "6 people were notified." },
];

const W = 300;
const H = 64;
const SHOWN = 3;
/* a touch under critical: it settles with a hint of give, no wobble */
const SPRING = { type: "spring", stiffness: 380, damping: 34, mass: 1 };

export function ToastStack({
  /* Setlists.md: 9 and 10, as asked (were 14 and 10) */
  peek = 9,
  gap = 10,
  /* Setlists.md: our card corner (was 20) */
  corner = 12,
} = {}) {
  /* front first; ids count up so a returning toast is a new element */
  const next = useRef(SHOWN);
  const [stack, setStack] = useState(() =>
    POOL.slice(0, SHOWN).map((t, i) => ({ ...t, id: i })),
  );
  const [leaving, setLeaving] = useState(null);
  const [open, setOpen] = useState(false);
  const root = useRef(null);

  /* the frame is the open list's size; both states sit in its middle */
  const listH = SHOWN * H + (SHOWN - 1) * gap;
  const stackH = H + (SHOWN - 1) * peek;
  const FH = listH;

  const place = (k) => {
    if (open) {
      /* the list: front at the bottom, the rest above it */
      const top = (FH - listH) / 2;
      return { y: top + (SHOWN - 1 - k) * (H + gap), scale: 1 };
    }
    /* the stack: front at the bottom, each one behind a peek higher
       and a step smaller, hanging from its top edge */
    const top = (FH - stackH) / 2;
    const d = Math.min(k, SHOWN - 1);
    return { y: top + (SHOWN - 1 - d) * peek, scale: 1 - d * 0.05 };
  };

  const dismiss = (id) => {
    if (leaving !== null) return;
    setLeaving(id);
    window.setTimeout(() => {
      setStack((s) => {
        const rest = s.filter((t) => t.id !== id);
        const n = next.current++;
        const fresh = { ...POOL[n % POOL.length], id: n };
        return [fresh, ...rest];
      });
      setLeaving(null);
    }, 220);
  };

  const retry = (id) => {
    setStack((s) => s.map((t) => (t.id === id
      ? { ...t, kind: "success", title: "PDF read", body: "Apă vie is in your songs.", action: undefined }
      : t)));
  };

  return (
    <div
      ref={root}
      className="tst"
      role="region"
      aria-label="Notifications"
      data-open={open || undefined}
      style={{ width: W, height: FH, "--tst-r": `${corner}px` }}
      onPointerOver={() => setOpen(true)}
      onPointerOut={(e) => {
        const to = e.relatedTarget;
        if (!to || !root.current?.contains(to)) setOpen(false);
      }}
      /* Setlists.md: a phone has no hover, so a tap on the stack
         opens it too (the pointerover above only fires on touch
         as the finger lands, and then never lets go) */
      onClick={() => setOpen(true)}
      onFocus={() => setOpen(true)}
      onBlur={(e) => { if (!root.current?.contains(e.relatedTarget)) setOpen(false); }}
    >
      {stack.map((t, k) => {
        const Icon = ICON[t.kind];
        const out = leaving === t.id;
        const p = place(k);
        const front = k === 0;
        return (
          <Motion.div
            key={t.id}
            className="tst-toast"
            data-kind={t.kind}
            data-front={front || undefined}
            style={{ height: H, zIndex: SHOWN - k }}
            /* a new one rises in from below the front */
            initial={{ y: place(0).y + 24, scale: 1, opacity: 0, x: 0 }}
            animate={out
              ? { y: p.y, scale: p.scale, opacity: 0, x: 60 }
              : { y: p.y, scale: p.scale, opacity: 1, x: 0 }}
            transition={out ? { duration: 0.22, ease: [0.4, 0, 1, 1] } : SPRING}
            aria-hidden={!open && !front ? true : undefined}
          >
            <span className="tst-icon"><Icon size={18} aria-hidden="true" /></span>
            <span className="tst-text">
              <b>{t.title}</b>
              <span>{t.body}</span>
            </span>
            {t.action && (
              <button type="button" className="tst-act" tabIndex={open || front ? 0 : -1} onClick={() => retry(t.id)}>
                {t.action}
              </button>
            )}
            <button
              type="button"
              className="tst-x"
              aria-label={`Dismiss ${t.title}`}
              tabIndex={open || front ? 0 : -1}
              onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </Motion.div>
        );
      })}
    </div>
  );
}
