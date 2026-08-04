import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEntitlement } from '@/hooks/useEntitlement';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { chartOverlaySurface } from './readerSurface';
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
 * **Phone — a sheet, at a FIXED 44vh.** Round 2 tried the push-down panel
 * instead; the owner tried both and picked the sheet (*"I think I like the
 * sheet more, but maybe not that big?"*), so the push-down is gone rather than
 * kept as a second shape nobody chose.
 *
 * Fixed height, not `max-height`, at the owner's request (*"let's make the menu
 * not that long, like fixed length and scroll inside"*). Two things that buys:
 * the chart above it never moves when you switch tabs, and Style's ten fields
 * and Music's four occupy the same box instead of the sheet jumping between
 * them. The body scrolls inside it.
 *
 * The detents are gone with the push-down. One height, and the handle drags
 * DOWN to dismiss — the direction the sheet came from.
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
    <div className="px-4 pt-3 pb-0.5">
      <div className="text-[12px] font-semibold text-[var(--text-2)] mb-[7px]">{label}</div>
      {children}
    </div>
  );
}

function Seg({ active, onClick, children, title }) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={!!active} title={title}
      className={`min-h-0 px-[11px] py-[5px] rounded-lg border text-[12px] cursor-pointer transition-colors ${
        active
          ? 'font-semibold text-white'
          : 'font-normal text-[var(--text-2)] bg-transparent hover:border-[var(--border-3)]'}`}
      style={active
        ? { background: 'var(--color-brand)', borderColor: 'var(--color-brand)' }
        : { borderColor: 'var(--border-2)' }}
    >
      {children}
    </button>
  );
}

/** A labelled row of segments bound to one setting. The workhorse. */
function Segs({ label, options, value, onChange }) {
  return (
    <Field label={label}>
      <div className="flex gap-[5px] flex-wrap">
        {options.map(([v, l]) => (
          <Seg key={String(v)} active={value === v} onClick={() => onChange(v)}>{l}</Seg>
        ))}
      </div>
    </Field>
  );
}

function MiniStepper({ value, min, max, onChange, label, unit = '', step = 1, onReset }) {
  return (
    <div className="flex items-center gap-[7px]">
      <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-[27px] h-[27px] min-h-0 grid place-items-center rounded-lg border border-[var(--border-2)] bg-transparent text-[var(--text-1)] text-[15px] leading-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--bg-2)]">−</button>
      <b className="font-mono text-[13px] font-semibold min-w-[52px] text-center tabular-nums text-[var(--text-1)]">{value}{unit}</b>
      <button type="button" aria-label={`Increase ${label}`} disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-[27px] h-[27px] min-h-0 grid place-items-center rounded-lg border border-[var(--border-2)] bg-transparent text-[var(--text-1)] text-[15px] leading-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--bg-2)]">+</button>
      {onReset && (
        <button type="button" onClick={onReset}
          className="min-h-0 ml-1 text-[11px] text-[var(--ds-gray-600)] hover:text-[var(--text-1)] bg-transparent border-none cursor-pointer underline underline-offset-2">
          Reset
        </button>
      )}
    </div>
  );
}

function Swatches({ activeValue, onPick }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CHART_COLOR_PALETTE.map(c => {
        const on = (c.value || null) === (activeValue || null);
        return (
          <button key={c.id} type="button" onClick={() => onPick(c.value)} title={c.name} aria-label={c.name}
            className="w-[22px] h-[22px] min-h-0 rounded-full cursor-pointer"
            style={{
              background: c.value === null
                ? 'linear-gradient(135deg, var(--chart-text, #888) 50%, var(--chord, #e0b341) 50%)'
                : c.value,
              border: '2px solid ' + (on ? 'var(--text-1)' : 'transparent'),
              boxShadow: on ? '0 0 0 2px var(--bg-1), 0 0 0 3px var(--color-brand)' : 'inset 0 0 0 1px var(--border-2)',
            }} />
        );
      })}
    </div>
  );
}

function ProNote({ children }) {
  return <p className="m-0 text-[12px] text-[var(--ds-gray-600)]">{children}</p>;
}

export default function ReaderMenu({
  anchorRect, onClose, settings, onUpdateSettings,
  song, config,
  lyricSize, onLyricSize, chordSize, onChordSize,
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
  const visibleThemes = styleAllowed ? CHART_THEMES : CHART_THEMES.filter(t => FREE_CHART_THEME_IDS.has(t.id));

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
          className={`flex-1 min-h-0 h-8 rounded-lg text-[12.5px] font-semibold cursor-pointer transition-colors border ${
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

      {/* ── Look ───────────────────────────────────────────────────────────
          How the page is PAINTED. Its own root row rather than a tab inside a
          Display panel (owner, 2026-08-01: "because we have space, maybe we can
          do look and layout as different outside tabs?") — the two most-opened
          panels are now one tap, not two. */}
      {tab === 'style' && (
        <>
              <Field label="Theme">
                {/* px/py: the selected ring is drawn outside the swatch's box,
                    so without padding it is clipped by the scroller on the
                    first and last swatch. */}
                <div ref={themesRef} className="flex gap-2.5 overflow-x-auto no-scrollbar px-1 py-1 -mx-1">
                  {visibleThemes.map(t => (
                    // The selected ring is ONE ring. It used to be a 1px brand
                    // border AND a 1.5px brand box-shadow on top of it — 2.5px
                    // of the same colour, at two different corner radii
                    // (the shadow's is the border-box's, the border's is
                    // inset), which is what made the selected swatch's edge
                    // look furred rather than crisp. This is the same ring the
                    // colour `Swatches` below already use: a gap in the panel's
                    // own colour, then the brand line.
                    <button key={t.id} type="button" onClick={() => set('chartTheme', t.id)}
                      className="shrink-0 min-h-0 h-[30px] w-[54px] rounded-lg overflow-hidden border border-transparent cursor-pointer flex items-end justify-end px-1.5 py-1"
                      style={{
                        background: t.bg, color: t.chord, fontFamily: 'var(--font-mono)',
                        boxShadow: themeId === t.id
                          ? '0 0 0 2px var(--bg-1), 0 0 0 3.5px var(--color-brand)'
                          : 'inset 0 0 0 1px var(--border-2)',
                      }}
                      aria-label={`Theme: ${t.name}`} aria-pressed={themeId === t.id} title={t.name}>
                      <span className="text-[10px] font-bold">Am</span>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label={`Lyrics — ${lyricSize}px`}>
                <MiniStepper value={lyricSize} min={10} max={40} unit="px" label="lyric size" onChange={onLyricSize} />
              </Field>
              <Field label={`Chords — ${chordSize}px`}>
                <MiniStepper value={chordSize} min={8} max={40} unit="px" label="chord size" onChange={onChordSize} />
              </Field>

              <Field label="Line spacing">
                <MiniStepper
                  value={Math.round((settings?.lyricLineHeight ?? 1.35) * 100)} min={100} max={240} step={5}
                  unit="%" label="line height"
                  onChange={(v) => set('lyricLineHeight', Math.round(v) / 100)}
                  onReset={settings?.lyricLineHeight != null ? () => set('lyricLineHeight', undefined) : null}
                />
              </Field>
              <Field label="Gap between sections">
                <MiniStepper
                  value={settings?.sectionSpacing ?? 24} min={8} max={64} step={2} unit="px" label="section gap"
                  onChange={(v) => set('sectionSpacing', v)}
                  onReset={settings?.sectionSpacing != null ? () => set('sectionSpacing', undefined) : null}
                />
              </Field>

              {/* Fonts as pills rather than the old bordered list: the list was
                  44px per font and made this tab a page you scroll. */}
              {styleAllowed ? (
                <>
                  <Field label="Lyric font">
                    <div className="flex gap-[5px] flex-wrap">
                      {CHART_FONTS.map(f => (
                        <Seg key={f.id} active={(settings?.chartLyricFont || DEFAULT_LYRIC_FONT_ID) === f.id}
                          onClick={() => set('chartLyricFont', f.id)}>
                          <span style={{ fontFamily: f.stack }}>{f.name}</span>
                        </Seg>
                      ))}
                    </div>
                  </Field>
                  <Field label="Lyric colour">
                    <Swatches activeValue={settings?.chartLyricColor} onPick={(v) => set('chartLyricColor', v || undefined)} />
                  </Field>
                  <Field label="Chord font">
                    <div className="flex gap-[5px] flex-wrap">
                      {CHART_FONTS.map(f => (
                        <Seg key={f.id} active={(settings?.chartChordFont || DEFAULT_CHORD_FONT_ID) === f.id}
                          onClick={() => set('chartChordFont', f.id)}>
                          <span style={{ fontFamily: f.stack }}>{f.name}</span>
                        </Seg>
                      ))}
                    </div>
                  </Field>
                  <Field label="Chord colour">
                    <Swatches activeValue={settings?.chartChordColor} onPick={(v) => set('chartChordColor', v || undefined)} />
                  </Field>
                </>
              ) : (
                <Field label="Fonts &amp; colours">
                  <ProNote>Upgrade to change the chart&rsquo;s fonts and colours.</ProNote>
                </Field>
              )}

              {/* Tabs are a LOOK concern — every one of these is about how a tab
                  is painted. (Owner: "I think tab controls live here, right?") */}
              <Segs label="Tab size" value={settings?.tabSize || 1}
                options={[[0.85, 'S'], [1, 'M'], [1.25, 'L']]} onChange={(v) => set('tabSize', v)} />
              <Segs label="Tab grid" value={settings?.tabSubdivision || 1}
                options={[[1, '1/4'], [2, '1/8'], [4, '1/16']]} onChange={(v) => set('tabSubdivision', v)} />
              <Field label="Tab colours">
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
                      className="w-[27px] h-[27px] min-h-0 rounded-lg border border-[var(--border-2)] bg-transparent cursor-pointer p-0"
                    />
                  ))}
                </div>
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
            <p className="m-0 text-[12px] text-[var(--ds-gray-600)]">
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
              <p className="m-0 text-[12px] text-[var(--text-2)]">
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
