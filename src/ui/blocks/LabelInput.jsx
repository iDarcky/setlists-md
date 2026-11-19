/* eslint-disable react-hooks/set-state-in-effect -- ported as written from bencho.dev; the React
   Compiler rules flag patterns the original relies on (refs as live knobs,
   one setState to settle a spring). Rewriting them would be rewriting the
   block, which is what porting it was meant to avoid. */
// LabelInput: ported from bencho.dev (MIT, bencho.dev/licence).
// Bencho's comments are kept as written; the changes for this app are marked
// "Setlists.md:". Our corners, our stroke icons (./icons), our tokens
// (./tokens.css), and `motion/react` in place of framer-motion (the same
// library; Sileo already ships it).
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "./icons";
import "./tokens.css";
import "./LabelInput.css";
/* ══ Label input ══════════════════════════════════════════
   A field whose label is its placeholder until you are in it.
   On focus the label lifts into the top edge with a small hop
   running along its letters, the outline darkens in place, and
   the top line parts under the label from its middle outward.

   ── ONE THING MOVES ─────────────────────────────────────
   It used to DRAW its outline out of the notch, both ways
   round the field — and that was the field performing, which
   is too much for a thing you focus forty times a day. Now the
   outline is always whole; focus only changes its ink and
   opens the gap. The label is the event, and the line makes
   room for it.

   The gap is two short paths across the notch, each from the
   middle to one side, retracted from the middle outward by a
   negative dash offset. */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const W = 280;
const H = 52;
/* the lifted label's size, against its resting one */
const S = 0.78;
/* the stroke sits half a stroke inside the box so none of it
   is clipped by the svg's own edge */
const IN = 0.75;
/* Setlists.md: a real field, not only the bench's Email / Password pair.
   `label` and `type` name any field; `value` / `onChange` make it
   controlled; `fill` measures the parent so it runs full width (the
   SVG outline is drawn at the measured width); `error` / `hint` sit
   under it. The bench still calls it with `field` alone. */
export function LabelInput({ field = "Email",
label: labelProp,
type: typeProp,
value: valueProp,
onChange,
fill = false,
name,
autoComplete,
error,
hint,
required,
disabled,
autoFocus,
inputMode: inputModeProp,
onKeyDown,
onFocus: onFocusProp,
maxLength,
autoCapitalize: capProp,
id: idProp,
/* the field's corner, px — at half the height it is a pill */
corner = 8, /* Setlists.md: our control corner (was 20) */
/* a showcase, not a form: on a touch screen, keep the device's
   keyboard down. Off by default — a real field wants its
   keyboard — and the bench turns it on for its feed */
showcase = false, } = {}) {
    const r = clamp(corner, 0, H / 2);
    const kind = typeProp || (field === "Password" ? "password" : field === "Email" ? "email" : "text");
    const secret = kind === "password";
    const label = labelProp || (secret ? "Password" : field === "Email" ? "Email" : field);
    const auto = `lbi-${useId().replace(/:/g, "")}`;
    const id = idProp || auto;
    const [focus, setFocus] = useState(false);
    const [quiet] = useState(() => showcase && typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
    const [own, setOwn] = useState("");
    const controlled = valueProp !== undefined;
    const value = controlled ? (valueProp ?? "") : own;
    const setValue = (v) => { if (!controlled) setOwn(v); };
    const [show, setShow] = useState(false);
    const [flip, setFlip] = useState(0);
    const input = useRef(null);
    /* Setlists.md: the width, measured when `fill` */
    const host = useRef(null);
    const [w, setW] = useState(W);
    useLayoutEffect(() => {
        if (!fill || !host.current) return;
        const el = host.current;
        const read = () => setW(Math.max(120, Math.round(el.clientWidth)));
        read();
        const ro = new ResizeObserver(read);
        ro.observe(el);
        return () => ro.disconnect();
    }, [fill]);
    /* the notch is the label's own width, so it is measured */
    const lab = useRef(null);
    const [lw, setLw] = useState(40);
    useLayoutEffect(() => {
        if (lab.current)
            setLw(lab.current.offsetWidth);
    }, [label]);
    /* a different kind of field starts empty — an email left in
       a password box would be shown in the clear */
    useEffect(() => {
        if (!controlled) setOwn("");
        setShow(false);
    }, [field, controlled]);
    const up = focus || String(value).length > 0;
    /* ── where the label sits, and the gap it leaves ─────────
       Never inside the corner's curve: the notch has to open on
       the straight part of the top edge, so a rounder field
       starts its label further in. */
    const lx = Math.max(14, r + 4);
    const x0 = Math.max(r * 0.6, lx - 5);
    const x1 = lx + lw * S + 5;
    const a = r - IN;
    const R = w - IN;
    const B = H - IN;
    const mid = w / 2;
    /* the gap, as two halves from its middle to each side */
    const nm = (x0 + x1) / 2;
    const gapL = `M${nm},${IN} L${x0},${IN}`;
    const gapR = `M${nm},${IN} L${x1},${IN}`;
    /* right: from the notch, clockwise, to the bottom middle */
    const right = r > 0
        ? `M${x1},${IN} L${w - r},${IN} A${a},${a} 0 0 1 ${R},${r} L${R},${H - r} A${a},${a} 0 0 1 ${w - r},${B} L${mid},${B}`
        : `M${x1},${IN} L${R},${IN} L${R},${B} L${mid},${B}`;
    /* left: from the notch, the other way round, to the same point */
    const left = r > 0
        ? `M${x0},${IN} L${r},${IN} A${a},${a} 0 0 0 ${IN},${r} L${IN},${H - r} A${a},${a} 0 0 0 ${r},${B} L${mid},${B}`
        : `M${x0},${IN} L${IN},${IN} L${IN},${B} L${mid},${B}`;
    const reveal = () => {
        setShow((s) => !s);
        setFlip((f) => f + 1);
    };
    const describe = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
    return (<div ref={host} className="lbi" data-fill={fill || undefined} data-up={up} data-focus={focus} data-filled={String(value).length > 0} data-error={error ? true : undefined} data-disabled={disabled || undefined}>
      <div className="lbi-box" style={{ width: w, height: H, borderRadius: r, "--lbi-x": `${lx}px` }}>
        <svg className="lbi-ring" width={w} height={H} viewBox={`0 0 ${w} ${H}`} aria-hidden="true">
          <path d={right}/>
          <path d={left}/>
          <path className="lbi-gap" d={gapL} pathLength={1}/>
          <path className="lbi-gap" d={gapR} pathLength={1}/>
        </svg>

        <label className="lbi-label" htmlFor={id} ref={lab}>
          {[...label].map((ch, i) => (<span key={i} style={{ "--i": i }}>{ch}</span>))}
        </label>

        <input ref={input} id={id} className="lbi-field" data-flip={flip % 2} 
    /* ── no autofill, when it is only being shown ───────
       An email or password box is an invitation: the browser
       drops its saved addresses under it, a password manager
       pins its badge in it, the phone offers a contact. On
       the bench it is a preview, not a form, so it is a plain
       text field — a hidden password masked by the font
       rather than by the type — named so Safari takes it for
       a search, and marked off for the managers that read
       their own attribute. A real use keeps the real types. */
    type={showcase ? "text" : secret && !show ? "password" : secret ? "text" : kind} name={showcase ? "search-preview" : name} data-1p-ignore={showcase || undefined} data-lpignore={showcase ? "true" : undefined} data-bwignore={showcase || undefined} data-form-type={showcase ? "other" : undefined} autoCorrect="off" autoCapitalize={capProp || (kind === "text" ? "sentences" : "off")} maxLength={maxLength} value={value} onChange={(e) => { setValue(e.target.value); onChange?.(e); }} onFocus={(e) => { setFocus(true); onFocusProp?.(e); }} onBlur={() => setFocus(false)} autoComplete={showcase ? "off" : autoComplete} spellCheck={kind === "text" && !showcase} required={required} disabled={disabled} autoFocus={autoFocus} onKeyDown={onKeyDown} aria-invalid={error ? true : undefined} aria-describedby={describe} 
    /* ── no keyboard, when it is only being shown ─────
       In a feed you are scrolling on a phone, a tap that
       lands on the field threw the keyboard up over the
       page. inputMode "none" keeps everything the block is
       about — the focus, the label lifting, the gap
       opening — and only tells the device not to raise its
       keyboard. A mouse and a hardware keyboard are
       untouched, and so is any real use of this field. */
    inputMode={quiet ? "none" : inputModeProp} style={{
            paddingRight: secret ? 48 : lx,
            ...(showcase && secret && !show ? { WebkitTextSecurity: "disc" } : {}),
        }}/>

        {secret && (<button className="lbi-eye" type="button" data-show={show} 
        /* keep focus in the field: the eye is a toggle on
           what you are typing, not somewhere to go */
        onPointerDown={(e) => e.preventDefault()} onClick={reveal} aria-label={show ? "Hide password" : "Show password"}>
            <Eye size={16} aria-hidden="true"/>
            <EyeOff size={16} aria-hidden="true"/>
          </button>)}
      </div>
      {error ? <p id={`${id}-error`} className="lbi-note" data-tone="error" role="alert">{error}</p>
        : hint ? <p id={`${id}-hint`} className="lbi-note">{hint}</p> : null}
    </div>);
}
