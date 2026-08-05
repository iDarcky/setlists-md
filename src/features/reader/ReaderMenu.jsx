import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useEntitlement } from '@/hooks/useEntitlement';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { chartOverlaySurface } from './readerSurface';
// The Aa menu's own controls (owner, 2026-08-04: *"can we use the one from the
// Aa for the buttons and +/- and stuff? i think that those look nice"*). The
// note in `PanelControls` used to say the reader deliberately did NOT use
// these, because it followed the concept mockup's tighter geometry. The owner
// looked at both on a device and picked these; one set of controls for both
// panels is the better end state anyway.
import { Stepper, Pick, Swatches } from '@/ui/PanelControls';
import {
  CHART_THEMES,
  CHART_FONTS,
  CHART_COLOR_PALETTE,
  DEFAULT_CHART_THEME_ID,
  DEFAULT_CHORD_FONT_ID,
  DEFAULT_LYRIC_FONT_ID,
  FREE_CHART_THEME_IDS,
} from '@/data/chartThemes';

/**
 * The reader's ☰ — its ONE menu.
 *
 * ## Three rows
 *
 * The concept had nine. The owner cut it twice, and both cuts came from the
 * same objection: *"this new menu will require multiple clicks/taps for
 * something that is currently achieved with only one"*, then *"this is a bit
 * overwhelming."* Gone, each for a recorded reason (`docs/READER.md`):
 *
 *  - **Jump to** — the structure ribbon already does it.
 *  - **Share / print** — lives in the song hub (element 23).
 *  - **Practice** — stays an ICON in the top bar. Element 12's decision stands.
 *  - **Fix it** — an inline mini-editor from its own icon, not a menu row.
 *  - **The screen** — cut 2026-08-01. Keep-awake already lives in Settings, and
 *    a row holding one switch is a row holding nothing.
 *
 * ## The look is the mockup's
 *
 * Rows are ONE line: icon · label · current value right-aligned in mono ·
 * chevron. Not a two-line card with a bordered icon tile — that was the
 * "overwhelming" version, and it made three rows occupy the height of eight.
 * Inside a panel, controls are `Field` blocks: a small mono uppercase label
 * over a row of segmented pills. Colours are ours (`--color-brand`, `--chord`,
 * the `--ds-*` greys); the geometry is the mockup's.
 *
 * ## Element 28, round 2 — tabs, and the panel stops covering the song
 *
 * Round 1 was the shell: the READER theme (`chartOverlaySurface`), and rows cut
 * back to glyph · label · chevron. Round 2 removed the thing those rows were
 * on.
 *
 * **Three tabs, no root page, no drill-in.** Owner, 2026-08-04: *"let's go with
 * the tabs"*. The root list was one tap to reach anything and, with the value
 * column gone, a full phone-width row with ~330px of nothing in the middle of
 * it (*"a bit too wide now?"*). Tabs make it **zero** taps — the ☰ opens
 * straight into a panel — which is the same argument that cut the menu from
 * nine rows to four. It is also the pattern the app already ships in `AaMenu`.
 *
 * **Notes is gone from here.** It goes in the setlist rail (owner: *"maybe we
 * have a switch there between order/notes"*) — element 29, with the notes
 * rework at 5/6/22. ⚠ Until that lands, `song.notes` (the arrangement note)
 * has NO appearance anywhere in the reader; this panel was its only one.
 *
 * **"Look" became "Style"** — the owner asked for a better name and this pairs
 * with Layout: Style is how the page is painted, Layout is where things are.
 *
 * ## Two shapes
 *
 * **Desktop** — a popover anchored to the ☰.
 *
 * **Phone — a DOCK. The screen splits 70/30, reader over settings.** Owner,
 * 2026-08-04: *"what if instead of the sheet we do something strange. We split
 * the screen in two sections, the reader above and the setting below… 30-70
 * settings-reader? and there we give the 3 tabs but without the drag, ☰
 * transforms into an x?"*
 *
 * This is the third shape tried and it is the one that finally answers the
 * panel rule properly. The sheet (rounds 1 and 3) covered the chart and was
 * capped to limit the damage; the push-down (round 2) displaced it from the
 * top, which worked but put the controls at the far end of the screen from the
 * thumb. A bottom dock displaces it from the BOTTOM: the chart is genuinely
 * shorter, never hidden, and it keeps its scroll position — and the controls
 * are where the hand is.
 *
 * What the dock is NOT, and each one is deliberate:
 *  - **Not modal.** No scrim. The chart above stays live — element 11's chord
 *    taps still work while you are changing the type size.
 *  - **Not draggable.** It has one size. The ☰ became a ✕ and that is the way
 *    out, so there is no gesture to learn and nothing to feel "blocked".
 *  - **Not portaled.** It is a sibling of the reader's scroller inside the
 *    reader's own flex column, which is what makes the 70% real rather than
 *    an overlay pretending.
 */

const NOTATIONS = [['letters', 'Letters'], ['nashville', 'Numbers'], ['solfege', 'Do-Re-Mi']];

// "You're playing" — a PRESET, not a hidden layer. Picking one writes the
// settings it implies, visibly, so there is never a second source of truth
// quietly overriding what the display panel says. (A hidden role layer is what
// turned the hub's Chart tab into a second Lyrics tab; see READER.md.)
const ROLES = [
  { id: 'leader', label: 'Leading', applies: { displayMode: 'chords', tabInstrument: 'all' } },
  { id: 'vocalist', label: 'Vocals', applies: { displayMode: 'lyrics', tabInstrument: 'all' } },
  { id: 'guitar', label: 'Guitar', applies: { displayMode: 'chords', tabInstrument: 'electric' } },
  { id: 'bass', label: 'Bass', applies: { displayMode: 'chords', tabInstrument: 'bass' } },
  { id: 'keys', label: 'Keys', applies: { displayMode: 'chords', tabInstrument: 'all' } },
  { id: 'drums', label: 'Drums', applies: { displayMode: 'lyrics', tabInstrument: 'all' } },
];

// The mockup's row glyphs: a single character each, not an icon set. At 19px in
// a 13.5px row, a drawn icon is noise — the label is doing the work.
// "Look" became "Style" at the owner's request (2026-08-04: *"Look (again, a
// better name here)"*). It pairs with Layout — Style is how the page is
// PAINTED, Layout is where things ARE — and it matches Settings → Chart Style,
// which is the same concept one level up.
const TABS = [['style', 'Style'], ['layout', 'Layout'], ['music', 'Music']];

// ── Mockup primitives ───────────────────────────────────────────────────────
// Geometry copied from the concept; every colour is one of ours.

/**
 * A labelled block. The label was five "this is a minor label" signals stacked
 * on one another — Geist **Mono**, **10px**, **ALL CAPS**, **0.1em tracking**,
 * and the **muted** grey — which is why the owner read them as strange
 * (2026-08-04: *"the setting headers are strange at all"*). Any one of those
 * says "quiet label"; all five together say "code comment", and 10px uppercase
 * mono is genuinely hard to read at arm's length on a phone.
 *
 * Now: the app's own sans at 12px/600, sentence case, on the chart's ordinary
 * secondary ink. Same job, one signal, legible.
 */
function Field({ label, children }) {
  return (
    <div className="px-4 pt-3.5 pb-0.5">
      <div className="text-[13.5px] font-semibold text-[var(--text-2)] mb-2">{label}</div>
      {children}
    </div>
  );
}

/**
 * A labelled row of choices bound to one setting. The workhorse of Layout and
 * Music.
 *
 * It used to render the concept mockup's own `Seg` — an 11px pill with a 5px
 * gap — beside the Style tab's `Pick`, so one menu carried two pill styles at
 * two sizes. One pill, and it is the Aa menu's (owner, 2026-08-04).
 */
function Segs({ label, options, value, onChange }) {
  return (
    <Field label={label}>
      <Picks value={value} options={options} onChange={onChange} />
    </Field>
  );
}

function ProNote({ children }) {
  return <p className="m-0 text-[13px] text-[var(--ds-gray-600)]">{children}</p>;
}

/** The heading over a group of fields — Lyrics · Chords · Spacing · Tabs. */
function GroupTitle({ children }) {
  return (
    <div className="px-4 pt-4 pb-0.5 first:pt-1">
      <div className="text-[15px] font-semibold text-[var(--text-1)]">{children}</div>
      <div className="mt-2 h-px" style={{ background: 'var(--border-1)' }} />
    </div>
  );
}

/**
 * Two fields side by side (owner: *"maybe can we make like 2 on one row?"*).
 * `[&>div]:px-0` because `Field` carries the panel's own horizontal padding and
 * a nested pair would double it; the grid supplies it once instead.
 */
function Pair({ children }) {
  return <div className="grid grid-cols-2 gap-x-3 px-4 [&>div]:px-0">{children}</div>;
}

/** `Pick`s bound to one setting — the Aa menu's pill, in a row. */
function Picks({ value, options, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(([v, l]) => (
        <Pick key={String(v)} size="lg" active={value === v} onClick={() => onChange(v)}>{l}</Pick>
      ))}
    </div>
  );
}

/** Fonts as pills. The bordered list was 44px per font and a page on its own. */
function FontPills({ activeId, onPick }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {CHART_FONTS.map(f => (
        <Pick key={f.id} size="lg" active={activeId === f.id} onClick={() => onPick(f.id)}>
          <span style={{ fontFamily: f.stack }}>{f.name}</span>
        </Pick>
      ))}
    </div>
  );
}

/**
 * A locked control. A SENTENCE and a way out, not just a sentence — the old
 * `ProNote` told you what you couldn't do and left you there.
 */
function LockedNote({ children, onUpgrade }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <ProNote>{children}</ProNote>
      {onUpgrade && (
        <button type="button" onClick={onUpgrade}
          className="min-h-0 text-[13px] font-semibold cursor-pointer bg-transparent border-none p-0 underline underline-offset-2"
          style={{ color: 'var(--color-brand)' }}>
          Upgrade
        </button>
      )}
    </div>
  );
}

function LockGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function Arrow({ dir, onClick, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      aria-label={dir === 'left' ? 'Previous themes' : 'More themes'}
      className="shrink-0 w-8 h-[40px] min-h-0 grid place-items-center rounded-lg border border-[var(--border-1)] bg-[var(--bg-1)] text-[var(--text-1)] cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed hover:bg-[var(--bg-2)]">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <polyline points={dir === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} />
      </svg>
    </button>
  );
}

/**
 * The themes, as a carousel with arrows (owner, 2026-08-04: *"the themes should
 * be a carousel with arrows left/right so users know to scroll"*). A bare
 * overflow strip with the scrollbar hidden gives no sign there is more.
 *
 * The locked ones are SHOWN, dimmed, with a padlock — not filtered out, which
 * is what it used to do. 3 of 31 themes were visible on a free plan and the
 * other 28 simply did not exist, so there was nothing to want. Seeing them is
 * most of the pitch; tapping one goes to the upgrade screen rather than
 * silently doing nothing.
 */
function ThemeCarousel({ themes, activeId, allowed, onPick, onUpgrade }) {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdge({ start: el.scrollLeft <= 1, end: el.scrollLeft >= max - 1 });
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    return () => el.removeEventListener('scroll', measure);
  }, [measure]);

  // The wheel scrolls it sideways while the pointer is over it — a vertical
  // wheel on a horizontal strip otherwise scrolls the panel behind it.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!e.deltaY || el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const page = (dir) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(120, el.clientWidth * 0.8), behavior: 'smooth' });
  };

  const lockedCount = allowed ? 0 : themes.filter(t => !FREE_CHART_THEME_IDS.has(t.id)).length;

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Arrow dir="left" onClick={() => page(-1)} disabled={edge.start} />
        {/* py/-my: the selected ring is drawn OUTSIDE the swatch's box, so
            without room it is clipped by the scroller at both ends. */}
        <div ref={ref} className="flex-1 min-w-0 flex gap-2.5 overflow-x-auto no-scrollbar px-1 py-1 -mx-1">
          {themes.map(t => {
            const locked = !allowed && !FREE_CHART_THEME_IDS.has(t.id);
            const on = activeId === t.id;
            return (
              <button
                key={t.id} type="button"
                onClick={() => (locked ? onUpgrade?.() : onPick(t.id))}
                className="relative shrink-0 min-h-0 h-[40px] w-[70px] rounded-lg overflow-hidden border border-transparent cursor-pointer flex items-end justify-end px-2 py-1.5"
                style={{
                  background: t.bg, color: t.chord, fontFamily: 'var(--font-mono)',
                  opacity: locked ? 0.45 : 1,
                  boxShadow: on
                    ? '0 0 0 2px var(--bg-1), 0 0 0 3.5px var(--color-brand)'
                    : 'inset 0 0 0 1px var(--border-2)',
                }}
                aria-label={locked ? `${t.name} — upgrade to use` : `Theme: ${t.name}`}
                aria-pressed={on} title={t.name}
              >
                <span className="text-[12px] font-bold">Am</span>
                {locked && (
                  <span className="absolute inset-0 grid place-items-center" style={{ color: t.text || t.chord }}>
                    <LockGlyph />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <Arrow dir="right" onClick={() => page(1)} disabled={edge.end} />
      </div>

      {lockedCount > 0 && onUpgrade && (
        <button type="button" onClick={onUpgrade}
          className="mt-2.5 w-full min-h-0 h-11 rounded-lg border text-[13.5px] font-semibold cursor-pointer flex items-center justify-center gap-2 transition-colors"
          style={{
            borderColor: 'var(--color-brand)',
            color: 'var(--color-brand)',
            background: 'var(--color-brand-soft)',
          }}>
          <LockGlyph />
          Unlock {lockedCount} more themes
        </button>
      )}
    </>
  );
}

export default function ReaderMenu({
  anchorRect, onClose, settings, onUpdateSettings,
  song, config,
  lyricSize, onLyricSize, chordSize, onChordSize,
  // The phone's shape: docked under the reader, filling the box the host
  // reserved for it. Only the host can offer that — it owns the flex column
  // the 70/30 split lives in.
  dock = false,
  // Where a locked control sends you. Absent → the lock is stated but not
  // sellable, which is what every locked control here used to be.
  onUpgrade = null,
}) {
  const [tab, setTab] = useState('style');
  const { allowed: styleAllowed } = useEntitlement('chart-style');
  // Two columns only APPLY at ≥768 (`Reader`'s `wide`), so that is where the
  // control appears. It used to hide below 700 — the sheet/popover threshold —
  // which left 700–767 (iPad mini portrait is 744) showing a switch that wrote
  // a setting `resolveReaderConfig` then overrode back to 1. Owner, 2026-08-04:
  // "the hard cut is 768 then". Lowering `wide` instead was the wrong lever: it
  // also turns pinned headings off and moves band cues out to the margin.
  const wideEnoughForColumns = useMediaQuery('(min-width: 768px)');

  const set = (key, value) => onUpdateSettings?.(key, value);

  // Escape closes. With tabs there is no level to back out of first.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Let the wheel scroll the theme strip horizontally while hovering it.
  const themesRef = useRef(null);
  useEffect(() => {
    const el = themesRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!e.deltaY || el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [tab]);

  // ── The handle drags it away ───────────────────────────────────────────────
  // Round 1 gave the sheet two detents and a rubber band on the up-drag. The
  // owner: *"it really drags, and it feels strange because it blocks and drags
  // a bit"* — correct, and it was the rubber band: the panel moved at half
  // thumb speed, hard-stopped at 80px, then jumped to a detent on release.
  // Four behaviours in one gesture.
  //
  // One height means none of that is needed. The handle drags DOWN, tracking
  // the thumb 1:1, and lets go past the trigger. Up is a short rubber band —
  // there is nowhere up for a fixed sheet to go, and a handle that gives
  // nothing in one direction reads as broken rather than as a limit.
  //
  // Everything here runs OUTSIDE React, for the reasons written on `Reader`'s
  // pull-to-finish: React's synthetic touch listeners are passive so
  // `preventDefault` is a no-op on them (trap 8); a finger makes ~120 moves and
  // 120 renders of this panel would lag the thumb; and the effect MOUNTS ONCE,
  // reading the moving parts from a ref, because an effect that owns a gesture
  // and depends on changing values tears its own gesture down mid-drag.
  const panelRef = useRef(null);
  const grabRef = useRef(null);
  const bodyRef = useRef(null);
  const dragRef = useRef(null);
  const closeTimer = useRef(null);
  // Refreshed by a no-dep effect, NOT written during render: the compiler lint
  // rejects a ref write in the render body ("Cannot update ref during render"),
  // and `Reader`'s pull-to-finish already uses this exact shape. The gesture
  // effect below is mount-once and reads this on every touch, so it only has to
  // be current by the time a finger lands.
  const live = useRef({});

  useEffect(() => {
    const el = panelRef.current;
    const grab = grabRef.current;
    if (!el || !grab) return undefined;
    // Raw thumb travel at which it lets go. Well under a thumb-length and far
    // past anything accidental.
    const TRIGGER = 72;
    const paint = (d) => { el.style.transform = d ? `translateY(${d}px)` : ''; };
    const ease = (on) => { el.style.transition = on ? 'transform 190ms cubic-bezier(0.32, 0.72, 0, 1)' : ''; };
    const cancel = () => { dragRef.current = null; ease(true); paint(0); setTimeout(() => ease(false), 210); };

    const onStart = (e) => {
      if (!live.current.phone || e.touches?.length !== 1) return;
      dragRef.current = { y: e.touches[0].clientY, d: 0 };
    };
    const onMove = (e) => {
      const p = dragRef.current;
      if (!p) return;
      const t = e.touches?.[0];
      if (!t) return;
      e.preventDefault();
      const dy = t.clientY - p.y;
      p.d = dy >= 0 ? dy : Math.max(dy * 0.3, -22);
      paint(p.d);
    };
    const onEnd = () => {
      const p = dragRef.current;
      dragRef.current = null;
      if (!p) return;
      if (p.d >= TRIGGER) {
        // Animate OUT rather than vanishing under the thumb.
        ease(true);
        paint(el.getBoundingClientRect().height || 320);
        closeTimer.current = setTimeout(() => live.current.onClose?.(), 160);
        return;
      }
      cancel();
    };

    grab.addEventListener('touchstart', onStart, { passive: true });
    grab.addEventListener('touchmove', onMove, { passive: false });
    grab.addEventListener('touchend', onEnd);
    grab.addEventListener('touchcancel', onEnd);
    return () => {
      clearTimeout(closeTimer.current);
      grab.removeEventListener('touchstart', onStart);
      grab.removeEventListener('touchmove', onMove);
      grab.removeEventListener('touchend', onEnd);
      grab.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  // ── Geometry ───────────────────────────────────────────────────────────────
  // `clientWidth`, NOT `innerWidth`: innerWidth includes the scrollbar, so
  // clamping against it let the popover sit partly under (and past) the
  // scrollbar — the "overflows on the right" report. Falls back to innerWidth
  // where there is no document (tests).
  const winW = typeof document !== 'undefined'
    ? (document.documentElement?.clientWidth || window.innerWidth)
    : 1024;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
  // A sheet below 700px, not 640: at 640–700 the popover was wider than the
  // room beside the ☰, which is the other half of the "overflows on the right"
  // report.
  const phone = winW < 700;
  const W = Math.min(296, winW - 16);   // the mockup's popover width
  // Align to whichever edge of the ☰ keeps the panel on screen. The reader's ☰
  // is top-LEFT, so a right-aligned popover pushed it off the edge.
  const anchorsLeft = anchorRect ? (anchorRect.left ?? 0) < winW / 2 : true;
  const left = anchorsLeft ? Math.min(Math.max(8, anchorRect?.left ?? 8), winW - W - 8) : null;
  const right = anchorsLeft ? null : Math.max(8, winW - (anchorRect?.right ?? winW));
  const top = anchorRect ? Math.min(anchorRect.bottom + 6, winH - 120) : 60;

  // Deliberately no dependency array — it re-runs on every render, which is the
  // point: the mount-once gesture must always see the current values without
  // ever being torn down and rebuilt (which is what breaks a drag mid-gesture).
  useEffect(() => { live.current = { phone, onClose }; });

  const themeId = settings?.chartTheme || DEFAULT_CHART_THEME_ID;

  const roleId = settings?.displayRole || 'leader';
  const capo = song?.capo ? Number(song.capo) : 0;

  // The tab strip. Three, and no more: nine rows became four, four became
  // three, and each cut came from the same objection — a menu is aimed at, not
  // read. `AaMenu` already ships this exact control, so it is the app's
  // pattern rather than a new one.
  const head = (
    <div className="shrink-0 flex gap-1 p-1.5 border-b border-[var(--border-1)]">
      {TABS.map(([id, label]) => (
        <button
          key={id} type="button" onClick={() => setTab(id)}
          aria-pressed={tab === id}
          className={`flex-1 min-h-0 h-11 rounded-lg text-[15px] font-semibold cursor-pointer transition-colors border ${
            tab === id
              ? 'text-white border-transparent'
              : 'text-[var(--text-2)] border-transparent bg-transparent hover:text-[var(--text-1)] hover:bg-[var(--bg-2)]'}`}
          style={tab === id ? { background: 'var(--color-brand)' } : undefined}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const body = (
    // overflow-x-hidden: a wrapping seg row or the theme strip must never widen
    // the panel itself.
    // flex-1 + min-h-0: inside a fixed-height sheet this is the part that
    // scrolls. Without `min-h-0` a flex child refuses to shrink below its
    // content and the sheet grows past its own height instead of scrolling.
    <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-1.5">

      {/* ── Style ──────────────────────────────────────────────────────────
          How the page is PAINTED, in four groups (owner, 2026-08-04): the
          themes, then Lyrics, Chords, Spacing and Tabs. Ungrouped it was
          eleven fields in a column and you had to read it to find anything —
          the same objection that cut the root menu from nine rows. */}
      {tab === 'style' && (
        <>
          <Field label="Theme">
            <ThemeCarousel
              themes={CHART_THEMES}
              activeId={themeId}
              allowed={styleAllowed}
              onPick={(id) => set('chartTheme', id)}
              onUpgrade={onUpgrade}
            />
          </Field>

          {/* ── Lyrics ───────────────────────────────────────────────────── */}
          <GroupTitle>Lyrics</GroupTitle>
          <Field label="Size">
            <Stepper size="lg" value={lyricSize} min={10} max={40} onChange={onLyricSize} label="lyric size" />
          </Field>
          <Pair>
            <Field label="Font">
              {styleAllowed
                ? <FontPills activeId={settings?.chartLyricFont || DEFAULT_LYRIC_FONT_ID}
                    onPick={(id) => set('chartLyricFont', id)} />
                : <LockedNote onUpgrade={onUpgrade}>Fonts are part of Pro.</LockedNote>}
            </Field>
            <Field label="Colour">
              {styleAllowed
                ? <Swatches size="lg" activeValue={settings?.chartLyricColor}
                    onPick={(v) => set('chartLyricColor', v || undefined)} />
                : <LockedNote onUpgrade={onUpgrade}>Colours are part of Pro.</LockedNote>}
            </Field>
          </Pair>

          {/* ── Chords ───────────────────────────────────────────────────── */}
          <GroupTitle>Chords</GroupTitle>
          <Field label="Size">
            <Stepper size="lg" value={chordSize} min={8} max={40} onChange={onChordSize} label="chord size" />
          </Field>
          <Pair>
            <Field label="Font">
              {styleAllowed
                ? <FontPills activeId={settings?.chartChordFont || DEFAULT_CHORD_FONT_ID}
                    onPick={(id) => set('chartChordFont', id)} />
                : <LockedNote onUpgrade={onUpgrade}>Fonts are part of Pro.</LockedNote>}
            </Field>
            <Field label="Colour">
              {styleAllowed
                ? <Swatches size="lg" activeValue={settings?.chartChordColor}
                    onPick={(v) => set('chartChordColor', v || undefined)} />
                : <LockedNote onUpgrade={onUpgrade}>Colours are part of Pro.</LockedNote>}
            </Field>
          </Pair>

          {/* ── Spacing ──────────────────────────────────────────────────────
              Free, like every size above it. Anything that makes the chart
              READABLE is an accessibility floor, not a feature to sell
              (agreed with the owner, 2026-08-04). */}
          <GroupTitle>Spacing</GroupTitle>
          <Pair>
            <Field label="Line spacing">
              <Stepper
                size="lg"
                value={Math.round((settings?.lyricLineHeight ?? 1.35) * 100)} min={100} max={240}
                step={5} unit="%" label="line height"
                onChange={(v) => set('lyricLineHeight', Math.round(v) / 100)}
              />
            </Field>
            <Field label="Between sections">
              <Stepper
                size="lg"
                value={settings?.sectionSpacing ?? 24} min={8} max={64} step={2}
                unit="px" label="section gap"
                onChange={(v) => set('sectionSpacing', v)}
              />
            </Field>
          </Pair>

          {/* ── Tabs ─────────────────────────────────────────────────────── */}
          <GroupTitle>Tabs</GroupTitle>
          <Pair>
            <Field label="Size">
              <Picks value={settings?.tabSize || 1} options={[[0.85, 'S'], [1, 'M'], [1.25, 'L']]}
                onChange={(v) => set('tabSize', v)} />
            </Field>
            <Field label="Grid">
              <Picks value={settings?.tabSubdivision || 1} options={[[1, '1/4'], [2, '1/8'], [4, '1/16']]}
                onChange={(v) => set('tabSubdivision', v)} />
            </Field>
          </Pair>
          <Field label="Colours">
            {styleAllowed ? (
              <div className="flex items-center gap-2">
                {[
                  ['tabStringColor', 'Strings', '#9b9b9b'],
                  ['tabNumberColor', 'Numbers', '#e0a82e'],
                  ['tabBg', 'Background', '#101010'],
                ].map(([key, label, fallback]) => (
                  <input
                    key={key} type="color" aria-label={`Tab ${label.toLowerCase()} colour`} title={label}
                    value={settings?.[key] || fallback}
                    onChange={(e) => set(key, e.target.value)}
                    className="w-10 h-10 min-h-0 rounded-lg border border-[var(--border-1)] bg-transparent cursor-pointer p-0"
                  />
                ))}
              </div>
            ) : <LockedNote onUpgrade={onUpgrade}>Tab colours are part of Pro.</LockedNote>}
          </Field>
        </>
      )}

      {/* ── Layout ─────────────────────────────────────────────────────────
          Where things ARE. */}
      {tab === 'layout' && (
        <>
              {/* Columns are a fact about the SPACE, not a taste, and a phone
                  has room for one. `resolveReaderConfig` forces 1 below 768, so
                  below 768 the control is a switch that does nothing — worse
                  than absent. (Owner, 2026-08-01; threshold corrected from 700
                  to 768, 2026-08-04 — see `wideEnoughForColumns`.) */}
              {wideEnoughForColumns && (
                <Segs label="Columns" value={settings?.defaultColumns === 2 ? 2 : 1}
                  options={[[1, '1'], [2, '2']]} onChange={(v) => set('defaultColumns', v)} />
              )}
              <Segs label="Structure — where" value={settings?.structurePosition || 'top'}
                options={[['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right'], ['off', 'Hidden']]}
                onChange={(v) => set('structurePosition', v)} />
              <Segs label="Structure — style" value={settings?.ribbonStyle || 'codes'}
                options={[['codes', 'Boxes'], ['chips', 'Chips'], ['numbered', 'Inline'], ['dots', 'Dots'], ['dotlabel', 'Dots+label']]}
                onChange={(v) => set('ribbonStyle', v)} />
              <Segs label="Under the top bar" value={settings?.readerTopBar || 'ribbon'}
                options={[['ribbon', 'Structure'], ['setlist', 'The set']]}
                onChange={(v) => set('readerTopBar', v)} />
              <Segs label="Section heading" value={settings?.readerHeading || 'name'}
                options={[['name', 'Name'], ['code', 'Letters'], ['caps', 'ALL CAPS']]}
                onChange={(v) => set('readerHeading', v)} />
              <Segs label="Heading pins as you scroll" value={settings?.readerSticky || 'on'}
                options={[['on', 'Pinned'], ['off', 'Not pinned']]}
                onChange={(v) => set('readerSticky', v)} />
              <Segs label="Section style" value={settings?.readerSectionStyle || 'bar'}
                options={[['bar', 'Bar'], ['plain', 'No line'], ['block', 'Block'], ['card', 'Card']]}
                onChange={(v) => set('readerSectionStyle', v)} />
              <Segs label="Repeated sections" value={settings?.duplicateSections || 'condensed'}
                options={[['full', 'Full'], ['condensed', 'Condensed'], ['hide', 'Hidden']]}
                onChange={(v) => set('duplicateSections', v)} />
              <Segs label="Song to song" value={settings?.readerNav || 'footer'}
                options={[['footer', 'Bottom bar'], ['pill', 'Pill'], ['edge', 'Edge arrows'], ['swipe', 'Swipe']]}
                onChange={(v) => set('readerNav', v)} />
              {/* Last and small on purpose — the owner's words: "I don't think
                  this is where it should be set, but it's ok to have it small in
                  case of emergency." The real answer is the role picker. */}
              <Segs label="In a pinch" value={settings?.displayMode || 'chords'}
                options={[['chords', 'Both'], ['lyrics', 'Lyrics'], ['chordsonly', 'Chords']]}
                onChange={(v) => set('displayMode', v)} />
        </>
      )}

      {/* ── The music ──────────────────────────────────────────────────────
          Named for what it holds: how the music is SPELLED, not how the page
          looks — which is why accidentals live here and not in Display. No key
          change: element 1's key pill owns transpose, and a second control for
          it is a second answer. */}
      {tab === 'music' && (
        <>
          <Segs label="You're playing" value={roleId}
            options={ROLES.map(r => [r.id, r.label])}
            onChange={(id) => {
              // Applies its settings VISIBLY. A role that silently overrode the
              // display panel is the exact bug that turned the hub's Chart tab
              // into a second Lyrics tab.
              const r = ROLES.find(x => x.id === id);
              set('displayRole', id);
              Object.entries(r?.applies || {}).forEach(([k, v]) => set(k, v));
            }} />
          <div className="px-4 pt-1 pb-0.5">
            <p className="m-0 text-[13px] text-[var(--ds-gray-600)]">
              Vocals and Drums drop the chords; Guitar and Bass open their own tabs. All still changeable under Display.
            </p>
          </div>

          <Segs label="Chord names" value={config?.display?.notation || 'letters'}
            options={NOTATIONS} onChange={(v) => set('notation', v)} />
          <Segs label="Sharps or flats" value={settings?.accidentals || 'auto'}
            options={[['auto', 'Follow key'], ['sharps', '♯'], ['flats', '♭']]}
            onChange={(v) => set('accidentals', v)} />

          <Field label="Capo">
            {capo ? (
              // Truthful rather than a knob that does nothing: the chart shows
              // SOUNDING chords today. Shapes for a capoed player is element 19
              // and is real work, not a toggle.
              <p className="m-0 text-[13px] text-[var(--text-2)]">
                <span className="font-mono font-semibold text-[var(--chord)]">Capo {capo}</span>
                {' — '}the chords below are what it sounds like. Shapes are coming.
              </p>
            ) : (
              <ProNote>None on this arrangement.</ProNote>
            )}
          </Field>
        </>
      )}

      <div className="h-1.5" />
    </div>
  );

  // ── Docked: the bottom 30% of the reader ─────────────────────────────────
  // No portal, no scrim, no handle. It fills the box the host gave it, and the
  // ✕ in the top bar is the way out.
  if (dock) {
    return (
      <div
        ref={panelRef}
        role="dialog" aria-label="Reader menu"
        className="h-full min-h-0 overflow-hidden flex flex-col border-t border-[var(--border-2)]"
        // It is a SIBLING of the reader's scroller, not a child, so it does not
        // inherit `chartSurface` and carries the remap itself.
        style={chartOverlaySurface}
      >
        {head}
        {body}
      </div>
    );
  }

  return createPortal((
    <>
      <button type="button" aria-label="Close menu" tabIndex={-1} onClick={onClose}
        className={`fixed inset-0 z-[119] border-none cursor-default ${phone ? 'bg-black/30' : 'bg-transparent'}`} />
      <div
        ref={panelRef}
        role="dialog" aria-label="Reader menu"
        className={
          'fixed z-[120] overflow-hidden flex flex-col '
          + (phone
            ? 'left-0 right-0 bottom-0 rounded-t-[18px] border-t border-[var(--border-2)]'
            : 'rounded-[14px] border border-[var(--border-2)]')
        }
        // The READER's theme, not the app's (owner, 2026-08-04). The panel is
        // portaled to `document.body`, so it inherits nothing from the reader's
        // own subtree and has to carry the remap itself — see
        // `chartOverlaySurface`. `background` comes from the surface, which is
        // why there is no `--ds-background-100` class on the line above.
        style={{
          ...chartOverlaySurface,
          ...(phone
            ? {
              maxWidth: '100vw',
              // FIXED, not a cap (owner: "fixed length and scroll inside").
              // The chart above never moves when you switch tabs, and Style's
              // ten fields and Music's four occupy the same box.
              height: '44vh',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              boxShadow: '0 -12px 44px rgba(0,0,0,0.35)',
              animation: 'sheet-up 200ms cubic-bezier(0.32, 0.72, 0, 1)',
            }
            : {
              top, ...(left != null ? { left } : { right }),
              width: W, maxWidth: 'calc(100vw - 16px)', maxHeight: '74vh',
              boxShadow: '0 18px 44px rgba(0,0,0,0.45)',
              animation: 'pop-in 120ms ease-out',
            }),
        }}
      >
        {/* The grab handle, at the top edge the sheet rose from. `touch-action:
            none` so the browser doesn't claim the gesture before the listener
            sees it. */}
        {phone && (
          <div ref={grabRef} className="shrink-0 pt-1.5 pb-0.5 grid place-items-center cursor-grab"
            style={{ touchAction: 'none' }} aria-hidden="true">
            <div className="w-[34px] h-1 rounded-full bg-[var(--border-2)]" />
          </div>
        )}
        {head}
        {body}
      </div>
    </>
  ), document.body);
}
