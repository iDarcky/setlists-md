import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useEntitlement } from '@/hooks/useEntitlement';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { chartOverlaySurface } from './readerSurface';
import { normalizeRibbonStyle } from '@/lib/readerConfig';
// The Aa menu's own controls (owner, 2026-08-04: *"can we use the one from the
// Aa for the buttons and +/- and stuff? i think that those look nice"*). The
// note in `PanelControls` used to say the reader deliberately did NOT use
// these, because it followed the concept mockup's tighter geometry. The owner
// looked at both on a device and picked these; one set of controls for both
// panels is the better end state anyway.
import { Stepper, Pick } from '@/ui/PanelControls';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/ui/Select';
// The app's real colour picker — the same one Settings → Chart Style uses to
// edit a custom theme. The custom well was a native `<input type="color">` for
// one round, which opens the OS picker: a different set of colours, and on iOS
// a full-screen sheet over the chart being adjusted.
import { HexColorPicker } from 'react-colorful';
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

const NOTATIONS = [
  ['letters', 'Letters'],
  ['nashville', 'Numbers'],
  // Roman numerals carry the chord's QUALITY in their case — I/IV/V major,
  // ii/iii/vi minor, vii° diminished — which is why players who read them
  // prefer them to Nashville's bare degree. See `getRomanNumeral`.
  ['roman', 'Numerals'],
  ['solfege', 'Do-Re-Mi'],
];

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

/**
 * What each setting falls back to when it is unset — i.e. what "Reset" means.
 *
 * It exists so the red **Reset** only appears when there is genuinely something
 * to undo. Picking the option that IS the default still writes the key, and
 * without this the button showed up for a change that had not been made.
 *
 * ⚠ Every value here MUST match the fallback where the control reads it
 * (`settings?.x ?? <default>`). `reader-menu-defaults.test.js` asserts the ones
 * that have a single source; keep them in step by hand for the rest.
 */
const MENU_DEFAULTS = {
  chartTheme: DEFAULT_CHART_THEME_ID,
  defaultFontSize: 18,          // resolveChartDisplay's stage default
  chordFontSize: 17,
  chartLyricFont: DEFAULT_LYRIC_FONT_ID,
  chartChordFont: DEFAULT_CHORD_FONT_ID,
  lyricLineHeight: 1.35,
  sectionSpacing: 24,
  tabSize: 1,
  tabSubdivision: 1,
  readerFlow: 'down',
  // Keep in step with `storage.js DEFAULT_SETTINGS` — a Reset that disagrees
  // with the default CHANGES a setting the user never touched.
  duplicateSections: 'full',
  readerHeading: 'name',
  readerSectionStyle: 'plain',
  readerSticky: 'on',
  readerNotes: 'on',
  readerInlineNotes: 'on',
  readerTopBar: 'ribbon',
  structurePosition: 'top',
  ribbonStyle: 'codes',
  readerNav: 'footer',
  readerFooter: 'next',
  readerProgress: 'on',
  displayMode: 'chords',
  notation: 'letters',
  accidentals: 'auto',
  displayRole: 'leader',
  tabInstrument: 'all',
  // Colours and `showDiagrams` have no default VALUE — unset is the default —
  // so `settings?.x === undefined` already answers for them.
};

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
/**
 * `inline` puts the control on the LABEL'S OWN LINE, right-aligned.
 *
 * A switch under its label costs the height of a whole field to say one bit
 * (owner, 2026-08-04, on three of them stacked: *"Doesn't it take too much
 * space?"*). Beside the label it costs nothing extra, and a switch is the one
 * control narrow enough to do that.
 *
 * Switches also take **no Reset** (owner: *"the switches don't really need
 * reset, do they?"* — they don't). Reset earns its place when a control has
 * several values and you cannot tell which one was the default; a switch has
 * two and shows you which one it is on. Tapping it back IS the reset.
 */
function Field({ label, children, onReset, info, inline = false }) {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div className="px-4 pt-3.5 pb-0.5">
      <div className={`flex items-center gap-2 ${inline ? 'mb-0' : 'items-baseline mb-2'}`}>
        <div className="text-[13.5px] font-semibold text-[var(--text-2)]">{label}</div>
        {!inline && <span className="flex-1" />}
        {/* The explanation, behind an (i) — it used to sit under the control as
            a loose paragraph (owner, 2026-08-04: *"the explanations should be
            inside a i button not random there"*). He also wants this on every
            setting eventually; noted, not built. */}
        {info && (
          <button type="button" onClick={() => setShowInfo(v => !v)}
            aria-label={`About ${label}`} aria-expanded={showInfo}
            className="min-h-0 w-[17px] h-[17px] shrink-0 grid place-items-center rounded-full text-[11px] font-bold cursor-pointer bg-transparent"
            style={{
              color: showInfo ? 'var(--color-brand)' : 'var(--ds-gray-600)',
              boxShadow: `inset 0 0 0 1.2px ${showInfo ? 'var(--color-brand)' : 'var(--border-2)'}`,
            }}>
            i
          </button>
        )}
        {onReset && (
          <button type="button" onClick={onReset} aria-label={`Reset ${label}`}
            className="min-h-0 text-[12px] font-medium cursor-pointer bg-transparent border-none p-0"
            style={{ color: 'var(--ds-red-900)' }}>
            Reset
          </button>
        )}
        {inline && <span className="ml-auto shrink-0">{children}</span>}
      </div>
      {showInfo && info && (
        <p className="m-0 mb-2 mt-1.5 text-[12.5px] leading-snug text-[var(--ds-gray-600)]">{info}</p>
      )}
      {!inline && children}
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

/**
 * The heading over a group of fields — Theme · Lyrics · Chords · Spacing · Tabs.
 *
 * The reset moved OFF this and onto each `Field` (owner, 2026-08-04: *"do you
 * think that we do the reset per section or per option? maybe the user just
 * wants to reset the size not the font and color"* — per option, and he is
 * right: a group reset makes you pay for the settings you were happy with).
 */
function GroupTitle({ children }) {
  return (
    <div className="px-4 pt-4 pb-0.5 first:pt-1">
      <div className="text-[15px] font-semibold text-[var(--text-1)]">{children}</div>
      <div className="mt-2 h-px" style={{ backgroundColor: 'var(--border-1)' }} />
    </div>
  );
}

/**
 * A dropdown, in the reader's own colours and at the steppers' height.
 *
 * Three things it fixes over a bare `Select` (owner, 2026-08-04): the list
 * **portals to `document.body`**, so it inherited the APP palette and dropped a
 * dark app-coloured list out of a cream chart-coloured panel — `SelectContent`
 * carries `chartOverlaySurface`, which re-points exactly the tokens it reads.
 * The trigger's border came from `--ds-gray-400` (the chart's *subtle*, far too
 * strong for a field) and it kept a 2px focus ring; both are toned to
 * `--border-1`.
 *
 * And **54px**, which is not a round number by accident: it is what a `Stepper`
 * measures — 44px buttons + 4px padding each side + 1px border each side. They
 * sit side by side in a `Pair`, and the owner asked for the font to be *"the
 * exact same size as the size"*. Change one and change the other.
 */
// NOTE the class below is written out, not interpolated: Tailwind scans the
// SOURCE, so a class assembled at runtime is never generated.
function Dropdown({ value, options, onChange, label, styleOf }) {
  const active = options.find(o => o[0] === value);
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(options.find(o => String(o[0]) === v)?.[0])}>
      <SelectTrigger
        aria-label={label}
        className="!h-[54px] !min-h-0 w-full !rounded-lg !px-3 !border-[var(--border-1)] hover:!border-[var(--border-3)] focus:!ring-0"
      >
        <span className="truncate text-label-13" style={styleOf?.(active?.[0])}>{active?.[1] ?? '—'}</span>
      </SelectTrigger>
      {/* Portaled to document.body — it inherits nothing from the panel, so it
          carries the panel's own token remap. */}
      <SelectContent style={chartOverlaySurface}>
        {options.map(([v, l]) => (
          <SelectItem key={String(v)} value={String(v)}>
            <span style={styleOf?.(v)}>{l}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Alphabetical (owner, 2026-08-04). The declaration order in `chartThemes.js`
// is the order they were added, which means nothing to anyone reading the list.
const FONT_OPTIONS = CHART_FONTS
  .map(f => [f.id, f.name])
  .sort((a, b) => a[1].localeCompare(b[1]));
const fontStyle = (id) => ({ fontFamily: CHART_FONTS.find(f => f.id === id)?.stack });

/**
 * The palette on one scrolling line. The tab colours used a native
 * `<input type="color">`, which opens the OS picker instead of the palette the
 * rest of the panel uses (owner: *"Tab colors don't open the color selection
 * that we already have"*) — a different set of colours, a different gesture,
 * and on iOS a full-screen sheet over the chart you were adjusting.
 */
function ColorRow({ label, value, onPick, onReset }) {
  return (
    <Field label={label} onReset={onReset}>
      <ColorCarousel value={value} onPick={onPick} />
    </Field>
  );
}

/**
 * Two fields side by side (owner: *"maybe can we make like 2 on one row?"*).
 * `[&>div]:px-0` because `Field` carries the panel's own horizontal padding and
 * a nested pair would double it; the grid supplies it once instead.
 */
function Pair({ children }) {
  return (
    // `auto-fit` + `minmax`, not `grid-cols-2`: two fixed columns squeeze a
    // stepper and a dropdown into ~130px each inside a 290px panel, and the
    // labels wrap mid-word (owner, 2026-08-04: *"let's not force items to be
    // one next to the other if there's no space, make them dynamic"*). This
    // pairs them when they fit and stacks them when they don't — the panel is a
    // resizable side dock and a phone dock, so "fits" is not one number.
    <div
      className="grid gap-x-3 px-4 [&>div]:px-0"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
    >
      {children}
    </div>
  );
}

/**
 * A yes/no setting, as a switch rather than two pills.
 *
 * Owner, 2026-08-04: *"is there a better way to handle the 2 answers only
 * settings?"* — yes, and the reason is that two pills ask you to READ both
 * before you can tell which is on, while a switch shows its state in its
 * position. It also stops a binary looking like a three-way that happens to
 * have two options.
 *
 * The label stays on the `Field`; this is only the control, so it sits right
 * where a row of pills would.
 */
function Switch({ on, onChange, label }) {
  return (
    <button
      type="button" role="switch" aria-checked={!!on} aria-label={label}
      onClick={() => onChange(!on)}
      // 42×24, down from 52×30. On its label's line it no longer has to carry
      // the row on its own, so it can be the size of a switch rather than the
      // size of a button (owner, 2026-08-04: "make the switches smaller").
      className="min-h-0 w-[42px] h-6 rounded-full cursor-pointer border-none p-0 relative transition-colors"
      style={{ backgroundColor: on ? 'var(--color-brand)' : 'var(--ds-gray-300)' }}
    >
      <span
        className="absolute top-[3px] w-[18px] h-[18px] rounded-full transition-[left] duration-150"
        style={{ left: on ? 21 : 3, backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
      />
    </button>
  );
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

function Arrow({ dir, onClick, disabled, what }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      aria-label={`${dir === 'left' ? 'Previous' : 'More'} ${what}`}
      className="shrink-0 w-8 h-[40px] min-h-0 grid place-items-center rounded-lg border border-[var(--border-1)] bg-[var(--bg-1)] text-[var(--text-1)] cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed hover:bg-[var(--bg-2)]">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <polyline points={dir === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} />
      </svg>
    </button>
  );
}

/**
 * Arrows + a horizontally scrolling row. Extracted from the theme strip so the
 * colour palettes get the SAME control (owner, 2026-08-04: *"colors require a
 * carousel as well"*). A bare overflow strip with the scrollbar hidden gives no
 * sign there is more than what you can see, and that is as true of ten swatches
 * as it is of ten themes.
 */
function Carousel({ children, what = 'options' }) {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // `max < 2` = it all fits. Both arrows go dead rather than one pretending
    // there is somewhere to go.
    setEdge({ start: el.scrollLeft <= 1, end: max < 2 || el.scrollLeft >= max - 1 });
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    return () => el.removeEventListener('scroll', measure);
  }, [measure, children]);

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

  return (
    <div className="flex items-center gap-1.5">
      <Arrow dir="left" what={what} onClick={() => page(-1)} disabled={edge.start} />
      {/* py/-my: selection rings are drawn OUTSIDE their box, so without room
          they are clipped by the scroller at both ends. */}
      <div ref={ref} className="flex-1 min-w-0 flex gap-2.5 overflow-x-auto no-scrollbar px-1 py-1 -mx-1">
        {children}
      </div>
      <Arrow dir="right" what={what} onClick={() => page(1)} disabled={edge.end} />
    </div>
  );
}

/**
 * The themes. The locked ones are SHOWN, dimmed, with a padlock — not filtered
 * out, which is what it used to do: 3 of 10 themes existed on a free plan and
 * the other 7 did not, so there was nothing to want. Seeing them is most of the
 * pitch; tapping one goes to the upgrade screen rather than silently doing
 * nothing.
 */
function ThemeCarousel({ themes, activeId, allowed, onPick, onUpgrade }) {
  const lockedCount = allowed ? 0 : themes.filter(t => !FREE_CHART_THEME_IDS.has(t.id)).length;
  return (
    <>
      <Carousel what="themes">
        {themes.map(t => {
          const locked = !allowed && !FREE_CHART_THEME_IDS.has(t.id);
          const on = activeId === t.id;
          return (
            <button
              key={t.id} type="button"
              onClick={() => (locked ? onUpgrade?.() : onPick(t.id))}
              className="relative shrink-0 min-h-0 h-[40px] w-[70px] rounded-lg overflow-hidden cursor-pointer flex items-end justify-end px-2 py-1.5"
              style={{
                backgroundColor: t.bg, color: t.chord, fontFamily: 'var(--font-mono)',
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
      </Carousel>

      {lockedCount > 0 && onUpgrade && (
        <button type="button" onClick={onUpgrade}
          className="mt-2.5 w-full min-h-0 h-11 rounded-lg border text-[13.5px] font-semibold cursor-pointer flex items-center justify-center gap-2 transition-colors"
          style={{
            borderColor: 'var(--color-brand)',
            color: 'var(--color-brand)',
            backgroundColor: 'var(--color-brand-soft)',
          }}>
          <LockGlyph />
          Unlock {lockedCount} more themes
        </button>
      )}
    </>
  );
}

/**
 * The palette, as a carousel, with **any colour** as the last stop.
 *
 * The fixed palette is the fast path — a dozen colours that are known to work
 * on the chart themes. The custom well is the escape hatch the owner asked for
 * (2026-08-04: *"do you think we could allow custom color as the last
 * option?"*), and it is last on purpose: a native colour input opens the OS
 * picker, which is a different set of colours and, on iOS, a full-screen sheet
 * over the chart you are adjusting. Worth it when you need an exact colour;
 * not worth putting in front of the twelve that already fit.
 */
function ColorCarousel({ value, onPick }) {
  const custom = !!value && !CHART_COLOR_PALETTE.some(c => c.value === value);
  // The picker floats, anchored to the well, rather than expanding inline.
  //
  // Inline it pushed the rest of the tab down inside a 40% dock and then got
  // clipped by the scroller — the panel is ~230px tall and the picker is 132px
  // plus a hex row (owner, 2026-08-04: *"One bug with the picker is that it
  // opens under, should it be like a pop-up maybe?"*). A portal escapes the
  // dock's box entirely, so it can use the chart's own space above.
  const [at, setAt] = useState(null);

  return (
    <>
      <Carousel what="colours">
        {CHART_COLOR_PALETTE.map(c => {
          const on = (c.value || null) === (value || null);
          return (
            <button key={c.id} type="button"
              onClick={() => { setAt(null); onPick(c.value); }}
              title={c.name} aria-label={c.name}
              className="shrink-0 w-10 h-10 min-h-0 rounded-full cursor-pointer"
              style={{
                ...(c.value === null
                  ? { backgroundImage: 'linear-gradient(135deg, var(--chart-lyric, var(--chart-text, #888)) 50%, var(--chord, #e0b341) 50%)' }
                  : { backgroundColor: c.value }),
                boxShadow: on
                  ? '0 0 0 2px var(--bg-1), 0 0 0 3.5px var(--color-brand)'
                  : 'inset 0 0 0 1px var(--border-2)',
              }} />
          );
        })}

        {/* Any colour — LAST, because it costs a panel to use. The palette
            above it is a dozen colours known to work on the chart themes; this
            is for when you need an exact one. */}
        <button type="button"
          onClick={(e) => setAt(a => (a ? null : e.currentTarget.getBoundingClientRect()))}
          aria-label="Any colour" aria-expanded={!!at} title="Any colour"
          className="relative shrink-0 w-10 h-10 min-h-0 rounded-full cursor-pointer grid place-items-center"
          // `backgroundImage`/`backgroundColor`, not the `background`
          // shorthand: jsdom's shorthand parser throws on a `conic-gradient`
          // when Testing Library clones the node for a role query, which takes
          // out any test that so much as looks for a button. Longhands are the
          // more accurate property here anyway.
          style={{
            ...(custom
              ? { backgroundColor: value }
              : { backgroundImage: 'conic-gradient(#f43f5e, #f59e0b, #22c55e, #06b6d4, #6366f1, #d946ef, #f43f5e)' }),
            boxShadow: custom || at
              ? '0 0 0 2px var(--bg-1), 0 0 0 3.5px var(--color-brand)'
              : 'inset 0 0 0 1px var(--border-2)',
          }}>
          {!custom && (
            <span className="pointer-events-none text-[15px] font-bold leading-none"
              style={{ color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.55)' }}>+</span>
          )}
        </button>
      </Carousel>

      {at && <ColorPopover anchor={at} value={value} onPick={onPick} onClose={() => setAt(null)} />}
    </>
  );
}

/**
 * The colour wheel, floating. Portaled, so the dock cannot clip it, and placed
 * ABOVE its anchor whenever there is room — the anchor is near the bottom of
 * the screen and a panel below it would be under the thumb that opened it.
 */
function ColorPopover({ anchor, value, onPick, onClose }) {
  const W = 236;
  const H = 210;
  const winW = typeof document !== 'undefined'
    ? (document.documentElement?.clientWidth || window.innerWidth) : 1024;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
  const left = Math.min(Math.max(8, (anchor.left ?? 0) - W / 2 + 20), winW - W - 8);
  const above = (anchor.top ?? 0) > H + 16;
  const top = above ? Math.max(8, anchor.top - H - 8) : Math.min(anchor.bottom + 8, winH - H - 8);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal((
    <>
      <button type="button" aria-label="Close colour picker" tabIndex={-1} onClick={onClose}
        className="fixed inset-0 z-[130] bg-transparent border-none cursor-default" />
      <div
        role="dialog" aria-label="Any colour"
        className="fixed z-[131] rounded-[14px] border border-[var(--border-2)] p-2.5 flex flex-col gap-2"
        style={{ ...chartOverlaySurface, left, top, width: W, boxShadow: '0 18px 44px rgba(0,0,0,0.45)' }}
      >
        <HexColorPicker color={value || '#888888'} onChange={onPick}
          style={{ width: '100%', height: 132 }} />
        <div className="flex items-center gap-2">
          <input
            type="text" aria-label="Hex colour" value={value || ''} placeholder="#000000"
            onChange={(e) => {
              const v = e.target.value.trim();
              if (/^#?[0-9a-fA-F]{6}$/.test(v)) onPick(v.startsWith('#') ? v : `#${v}`);
            }}
            className="flex-1 min-w-0 h-9 px-2 rounded-lg font-mono text-[13px] text-[var(--text-1)] bg-[var(--bg-1)] border border-[var(--border-1)]"
          />
          <button type="button" onClick={onClose}
            className="min-h-0 h-9 px-3 rounded-lg text-[13px] font-semibold cursor-pointer bg-transparent border border-[var(--border-1)] text-[var(--text-1)]">
            Done
          </button>
        </div>
      </div>
    </>
  ), document.body);
}

export default function ReaderMenu({
  anchorRect, onClose, settings, onUpdateSettings,
  song, config,
  lyricSize, onLyricSize, chordSize, onChordSize,
  // The shape the host is offering, and only the host can offer either:
  //   'bottom' — a phone dock, filling the 40% box under the reader;
  //   'side'   — a desktop panel down the LEFT, pushing the chart across;
  //   false    — a popover anchored to the ☰ (the fallback; nothing left).
  dock = false,
  // Where a locked control sends you. Absent → the lock is stated but not
  // sellable, which is what every locked control here used to be.
  onUpgrade = null,
  // Going live, and leaving it. The reader's bar shows the STATE (a red LIVE
  // badge in the slot before the ✕); this is the SWITCH. They were split
  // because the bar was carrying both and truncating the song title to "Amaz…"
  // on a 390px phone to do it — and because a tappable control against the ✕
  // is two ways to end a service under one thumb.
  //
  // Absent on every surface with exactly one mode (the hub, the editor
  // preview, a shared link), which is what makes the row not render there.
  onModeChange = null,
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

  // Switching tabs puts you at the TOP of the new one. Without this the
  // scroller keeps its offset, so arriving at Layout half way down — with no
  // idea what is above you — is the first thing that happens (owner,
  // 2026-08-04: "make sure that when we change tabs we are always at the top of
  // the page, right now we aren't").
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [tab]);

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

  // ── Reset, per OPTION ────────────────────────────────────────────────────
  // Not per group (owner, 2026-08-04: *"maybe the user just wants to reset the
  // size not the font and color"*). A group reset charges you for the settings
  // you were happy with.
  //
  // It clears to `undefined` rather than writing a default value: every one of
  // these reads `settings?.x ?? default` at the point of use, so clearing the
  // key IS the default and there is only ever one copy of what the default is.
  //
  // Returns null when there is nothing to clear, so a pristine panel carries no
  // clutter and the button always does something.
  // A key is "at its default" when it is unset OR holds the default value.
  //
  // Comparing against `undefined` alone was the bug (owner, 2026-08-04: *"even
  // if I select the current option I still get the reset"*): picking the option
  // that IS the default still writes the key, so the key became defined,
  // nothing differed from default, and a Reset appeared that would change
  // nothing. This map is the one place the menu states what "default" means —
  // and every value in it must match the fallback at the control's point of
  // use, which `reader-menu-defaults.test.js` asserts.
  const isDefault = (k) => settings?.[k] === undefined
    || (k in MENU_DEFAULTS && settings[k] === MENU_DEFAULTS[k]);

  // The pair above reads both halves: the style as it RESOLVES (a stored
  // 'numbered' is Boxes), and whether the map is currently down a side.
  const ribbonStyleNow = normalizeRibbonStyle(settings?.ribbonStyle);
  const sidePos = settings?.structurePosition === 'left' || settings?.structurePosition === 'right';

  const reset = (...keys) => (
    keys.every(isDefault)
      ? null
      : () => keys.forEach(k => set(k, undefined))
  );

  // The tab strip. Three, and no more: nine rows became four, four became
  // three, and each cut came from the same objection — a menu is aimed at, not
  // read. `AaMenu` already ships this exact control, so it is the app's
  // pattern rather than a new one.
  // The tab strip. Smaller than the controls it switches between, deliberately
  // (owner, 2026-08-04: *"make the tab buttons smaller, they don't need to be
  // that big"*) — they are pressed once to get somewhere, not adjusted, and the
  // height they were taking came out of the settings themselves.
  //
  // **At the BOTTOM in the dock, at the top in the popover.** Owner: *"what do
  // you think about moving the tabs at the bottom?"* — on a phone, yes: the
  // dock is already the bottom of the screen and the strip is the one thing in
  // it you reach for repeatedly, so it belongs on the edge nearest the thumb.
  // That reasoning does not transfer to the desktop popover, which hangs UNDER
  // the ☰ that opened it: there the nearest edge to the pointer is the top.
  //
  // The ✕ lives in the strip rather than only in the top bar. The dock is at
  // the bottom of the screen and the ☰ that opened it is at the top — the full
  // height of the phone from the thumb using the panel (owner: *"do we need
  // like an x to close the dock… rather than the top one?"*). The ☰ still
  // toggles; this is the near one.
  // ── The Live row, ABOVE the tabs ──────────────────────────────────────────
  // Owner, 2026-08-11: *"maybe have a top bar with live?"* — and he is right
  // that the first placement was wrong. It went into Layout → The screen, i.e.
  // the third group of the second tab, which files a SESSION action among
  // display preferences and buries it behind a tab switch.
  //
  // Above the tabs it is the first thing the menu says, in every tab, and it
  // reads as what it is: the one control here that changes what the reader can
  // DO rather than how it looks.
  //
  // ⚠ It is also the only way out of live, since live has no ✕ (`LiveFold`).
  // That is why `Reader` refuses to drop the ✕ unless `onModeChange` exists —
  // this row and that ✕ are the two halves of one invariant.
  const liveRow = onModeChange ? (
    // ONE LINE. Owner, 2026-08-11: *"Make the live more like enable edit. Or
    // something like that. A single line. Right now it takes too much."* The
    // two-line version explained what live does; the `LiveIntro` sheet does
    // that once, properly, and a menu row does not need to repeat it forever.
    //
    // It reads as LEAVING, not entering, because that is the only direction
    // that exists now: Play opens live (`READER_DEFAULT_MODE`), so the switch's
    // job is the way out. Owner, twice: *"I don't understand why I'd go from
    // practice to live? I understand the other way around."*
    <div className={`shrink-0 flex items-center justify-between gap-3 px-3 h-11 ${
      dock === 'bottom' ? 'border-t' : 'border-b'} border-[var(--border-1)]`}>
      <span className="flex items-center gap-2 min-w-0 text-[13.5px] font-semibold text-[var(--text-1)]">
        <span
          aria-hidden="true"
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: config?.mode === 'live' ? '#e5484d' : 'var(--ds-gray-500)' }}
        />
        Live
      </span>
      <Switch label="Live"
        on={config?.mode === 'live'}
        onChange={(v) => onModeChange(v ? 'live' : 'practice')} />
    </div>
  ) : null;

  const head = (
    <div className={`shrink-0 flex items-center gap-1 p-1.5 ${
      dock === 'bottom' ? 'border-t' : 'border-b'} border-[var(--border-1)]`}>
      {TABS.map(([id, label]) => (
        <button
          key={id} type="button" onClick={() => setTab(id)}
          aria-pressed={tab === id}
          className={`flex-1 min-h-0 h-9 rounded-lg text-[13.5px] font-semibold cursor-pointer transition-colors border ${
            tab === id
              ? 'text-white border-transparent'
              : 'text-[var(--text-2)] border-transparent bg-transparent hover:text-[var(--text-1)] hover:bg-[var(--bg-2)]'}`}
          // `backgroundColor`, not the `background` shorthand: jsdom's parser
          // throws on a `var()` inside the shorthand when Testing Library
          // clones the node for a role query, which takes out every test that
          // looks for a button anywhere on the page.
          style={tab === id ? { backgroundColor: 'var(--color-brand)' } : undefined}
        >
          {label}
        </button>
      ))}
      {dock && (
        <button type="button" onClick={onClose} aria-label="Close display options"
          className="shrink-0 ml-1 w-9 h-9 min-h-0 grid place-items-center rounded-lg bg-transparent border-none text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--bg-2)] cursor-pointer">
          {/* A chevron DOWN on the phone dock, a ✕ on the desktop panel (owner,
              2026-08-04). The dock slides down out of the way and the chevron
              says which way it goes; the side panel does not go down, and there
              is no ✕ anywhere near it to be confused with. */}
          {dock === 'bottom' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          )}
        </button>
      )}
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
          <GroupTitle>Theme</GroupTitle>
          <Field label="Chart theme">
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
          <Pair>
            <Field label="Size" onReset={reset('defaultFontSize')}>
              <Stepper size="lg" value={lyricSize} min={10} max={40} onChange={onLyricSize} label="lyric size" />
            </Field>
            <Field label="Font">
              {styleAllowed
                ? <Dropdown label="Lyric font" options={FONT_OPTIONS} styleOf={fontStyle}
                    value={settings?.chartLyricFont || DEFAULT_LYRIC_FONT_ID}
                    onChange={(id) => set('chartLyricFont', id)} />
                : <LockedNote onUpgrade={onUpgrade}>Fonts are part of Pro.</LockedNote>}
            </Field>
          </Pair>
          {styleAllowed
            ? <ColorRow label="Colour" value={settings?.chartLyricColor}
                onPick={(v) => set('chartLyricColor', v || undefined)} />
            : <Field label="Colour"><LockedNote onUpgrade={onUpgrade}>Colours are part of Pro.</LockedNote></Field>}

          {/* ── Chords ───────────────────────────────────────────────────── */}
          <GroupTitle>Chords</GroupTitle>
          <Pair>
            <Field label="Size" onReset={reset('chordFontSize')}>
              <Stepper size="lg" value={chordSize} min={8} max={40} onChange={onChordSize} label="chord size" />
            </Field>
            <Field label="Font">
              {styleAllowed
                ? <Dropdown label="Chord font" options={FONT_OPTIONS} styleOf={fontStyle}
                    value={settings?.chartChordFont || DEFAULT_CHORD_FONT_ID}
                    onChange={(id) => set('chartChordFont', id)} />
                : <LockedNote onUpgrade={onUpgrade}>Fonts are part of Pro.</LockedNote>}
            </Field>
          </Pair>
          {styleAllowed
            ? <ColorRow label="Colour" value={settings?.chartChordColor}
                onPick={(v) => set('chartChordColor', v || undefined)} />
            : <Field label="Colour"><LockedNote onUpgrade={onUpgrade}>Colours are part of Pro.</LockedNote></Field>}

          {/* ── Spacing ──────────────────────────────────────────────────────
              Free, like every size above it. Anything that makes the chart
              READABLE is an accessibility floor, not a feature to sell
              (agreed with the owner, 2026-08-04). */}
          <GroupTitle>Spacing</GroupTitle>
          <Pair>
            <Field label="Line spacing" onReset={reset('lyricLineHeight')}>
              <Stepper
                size="lg"
                value={Math.round((settings?.lyricLineHeight ?? 1.35) * 100)} min={100} max={240}
                step={5} unit="%" label="line height"
                onChange={(v) => set('lyricLineHeight', Math.round(v) / 100)}
              />
            </Field>
            <Field label="Between sections" onReset={reset('sectionSpacing')}>
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
            {/* A dropdown, not pills: "1/4 · 1/8 · 1/16" needs ~220px and it
                has half a phone-width column (owner: "Can we make the tab grid
                options to fit on a single line? Maybe we do a drop-down?"). */}
            <Field label="Grid">
              <Dropdown label="Tab grid" value={settings?.tabSubdivision || 1}
                options={[[1, '1/4 notes'], [2, '1/8 notes'], [4, '1/16 notes']]}
                onChange={(v) => set('tabSubdivision', v)} />
            </Field>
          </Pair>
          {styleAllowed ? (
            <>
              <ColorRow label="Tab strings" value={settings?.tabStringColor}
                onPick={(v) => set('tabStringColor', v || undefined)} />
              <ColorRow label="Tab numbers" value={settings?.tabNumberColor}
                onPick={(v) => set('tabNumberColor', v || undefined)} />
              <ColorRow label="Tab background" value={settings?.tabBg}
                onPick={(v) => set('tabBg', v || undefined)} />
            </>
          ) : (
            <Field label="Tab colours">
              <LockedNote onUpgrade={onUpgrade}>Tab colours are part of Pro.</LockedNote>
            </Field>
          )}
        </>
      )}

      {/* ── Layout ─────────────────────────────────────────────────────────
          Where things ARE, in four groups. Every name in here was gone over
          with the owner on 2026-08-04 — the old ones ("The map", "Getting
          around", "Song to song", "Under the top bar") described the design
          rather than the setting. */}
      {tab === 'layout' && (
        <>
          {/* ── Page ─────────────────────────────────────────────────────── */}
          <GroupTitle>Page</GroupTitle>
          {/* Columns are a fact about the SPACE, not a taste, and a phone has
              room for one. `resolveReaderConfig` forces 1 below 768, so below
              768 the control is a switch that does nothing. */}
          {/* The RESOLVED number, and no Reset (owner, 2026-08-05: *"the default
              column is one and if I press the reset it goes from two → one but
              it doesn't change. Remove the reset"*).
              Both halves of that were the same lie. `defaultColumns` is 'auto'
              until you touch it, and `resolveColumns('auto', wide)` is TWO on a
              wide screen — but the control read `settings.defaultColumns === 2`,
              so it said "One" over a chart that was visibly in two columns.
              Reset then wrote 'auto' back, which is where it already was: the
              button moved the highlight and could not, by construction, move
              the chart. Reading `config.columns` is the honest end, and it also
              retires the Reset — there is no state left for it to return to
              that the control isn't already showing. */}
          {wideEnoughForColumns && (
            <Field label="Columns">
              <Picks value={config?.columns === 2 ? 2 : 1}
                options={[[1, 'One'], [2, 'Two']]} onChange={(v) => set('defaultColumns', v)} />
            </Field>
          )}
          {/* Only where two columns are actually IN EFFECT. `config.columns`,
              NOT `settings.defaultColumns`: two columns is the resolved default
              on a wide screen, so gating on the explicit setting hid this from
              everyone who had never pressed "2". */}
          {config?.columns === 2 && (
            <Field label="Reading order"              info="Down fills the first column to the bottom, then the second, and the two end level. Across lays sections left to right — nothing evens the rows up, so a short section beside a long one leaves a gap.">
              <Picks value={settings?.readerFlow || 'down'}
                options={[['down', 'Down'], ['across', 'Across']]}
                onChange={(v) => set('readerFlow', v)} />
            </Field>
          )}
          <Field label="Repeats"            info="A chorus played three times is written once. This is what the other two times look like.">
            {/* Full · Tag · Hidden (owner, 2026-08-05). "Condensed" and "As a
                tag" were two names for the same pill; the pill is what you see,
                so the pill is what it is called. The stored value stays
                `condensed` — renaming it would need a migration for a word. */}
            <Picks value={settings?.duplicateSections || 'full'}
              options={[['full', 'Full'], ['condensed', 'Tag'], ['hide', 'Hidden']]}
              onChange={(v) => set('duplicateSections', v)} />
          </Field>

          {/* ── Sections ─────────────────────────────────────────────────── */}
          <GroupTitle>Sections</GroupTitle>
          <Field label="Heading">
            <Picks value={settings?.readerHeading || 'name'}
              options={[['name', 'Name'], ['code', 'Short'], ['caps', 'Uppercase']]}
              onChange={(v) => set('readerHeading', v)} />
          </Field>
          {/* Four frames, and NONE of them takes width from the lyrics — which
              is why Block and Card are gone (2026-08-06). They boxed the text;
              a Card chorus on a phone spent 58px before a lyric started and its
              pinned heading was a slab inset from the card it sat in. Both land
              on Tint, which is the same idea without the box. */}
          <Field label="Style"            info="Where the section's colour lives. None of these takes width from the words.">
            <Dropdown label="Section style" value={settings?.readerSectionStyle || 'plain'}
              options={[['plain', 'None'], ['rule', 'Rule'], ['bar', 'Margin bar'], ['tint', 'Tint']]}
              onChange={(v) => set('readerSectionStyle', v)} />
          </Field>
          {/* Two columns has no reading line a pinned heading could answer to —
              the order runs down one column and up the next, so two headings
              would pin side by side. The switch goes away rather than lying
              (owner, 2026-08-06: *"Let's say the user selects 2 column, the
              option is gone"*). It is real on every device at one column now,
              desktop included; it used to be silently off above 768px. */}
          {config?.columns !== 2 && (
            <Field label="Pin heading while scrolling" inline>
              <Switch label="Pin heading while scrolling"
                on={(settings?.readerSticky || 'on') === 'on'}
                onChange={(v) => set('readerSticky', v ? 'on' : 'off')} />
            </Field>
          )}
          {/* Split in two on 2026-08-04. They were one knob, and they are
              different marks: a band cue is written under a heading for
              everyone, an inline note is dropped mid-line for a moment. */}
          <Field label="Band cues" inline
            info="The line under a section heading, for the whole band.">
            <Switch label="Band cues"
              on={(settings?.readerNotes || 'on') === 'on'}
              onChange={(v) => set('readerNotes', v ? 'on' : 'off')} />
          </Field>
          <Field label="Inline notes" inline
            info="The small notes written into a line, for one moment in the song.">
            <Switch label="Inline notes"
              on={(settings?.readerInlineNotes || 'on') === 'on'}
              onChange={(v) => set('readerInlineNotes', v ? 'on' : 'off')} />
          </Field>
          {/* WHERE a note goes. Offered rather than decided, because the two
              answers trade the same thing in opposite directions: the gutter
              keeps a straight margin down the section and charges every line in
              it 88px of width on a phone (measured 366 -> 256.4px, one
              ten-character note making a chorus 41% taller); under the line
              costs nothing and gives the words the whole screen. Only shown
              when notes are on — a placement for something switched off is a
              control that cannot do anything. */}
          {(settings?.readerInlineNotes || 'on') === 'on' && (
            <Field label="Note position"              info="In a margin down the right, or on its own line above the words.">
              <Dropdown label="Note position" value={config?.notePlacement || 'gutter'}
                options={[['gutter', 'Right margin'], ['above', 'Above the line']]}
                onChange={(v) => set('readerNotePlacement', v)} />
            </Field>
          )}

          {/* ── Structure ────────────────────────────────────────────────── */}
          <GroupTitle>Structure</GroupTitle>
          {/* STYLE first, then location (owner, 2026-08-06) — and the two are
              dependent, because they always were and the menu just didn't say
              so. A side rail floats over the chart, so only a dot is small
              enough to live there; boxes and chips need a row of their own.
              The reader already forced dots on a side, silently. Stating it in
              the control that causes it is the honest version: pick Boxes and
              the sides are simply not on the list, and if you were already on
              one, the location moves to Top with you rather than leaving you
              with a setting that means something else.

              Three, down from five (2026-08-05). Inline was the Boxes chip
              without its box and Dots + label was Dots with that chip's text
              beside it — two variants pretending to be styles. A stored one
              still resolves to the survivor it was a variant of
              (`normalizeRibbonStyle`), so the control never shows a value its
              own list does not contain. */}
          <Field label="Structure style">
            <Dropdown label="Structure style" value={ribbonStyleNow}
              options={[['codes', 'Boxes'], ['chips', 'Chips'], ['dots', 'Dots']]}
              onChange={(v) => {
                set('ribbonStyle', v);
                // A style that cannot float takes the map off the side with it.
                if (v !== 'dots' && sidePos) set('structurePosition', 'top');
              }} />
          </Field>
          <Field label="Structure location"            info={ribbonStyleNow === 'dots'
              ? 'Down a side the map floats over the chart, in the margin it already had.'
              : 'Left and right need dots — a box or a chip laid over the lyrics covers a word.'}>
            <Dropdown label="Structure location" value={settings?.structurePosition || 'top'}
              options={ribbonStyleNow === 'dots'
                ? [['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right'], ['off', 'Hidden']]
                : [['top', 'Top'], ['bottom', 'Bottom'], ['off', 'Hidden']]}
              onChange={(v) => set('structurePosition', v)} />
          </Field>
          {/* An on/off for the set bar, and nothing else. It is NOT a two-way
              with the structure — element 8b moved the set bar ABOVE the title
              row on 2026-08-01, so the two stack (SET / HEADER / STRUCTURE) and
              neither takes the other's place. The copy said they shared a row
              until 2026-08-05, when the owner corrected it: *"We moved the
              Setlist bar on top of the header so they don't share anything."*
              The ribbon is still turned off through Structure location. */}
          <Field label="Setlist bar" inline
            info="The whole service across the top of the screen, above the song's title. The song's own structure keeps its place below it.">
            <Switch label="Setlist bar"
              on={settings?.readerTopBar === 'setlist'}
              onChange={(v) => set('readerTopBar', v ? 'setlist' : 'ribbon')} />
          </Field>

          {/* ── Navigation ───────────────────────────────────────────────── */}
          <GroupTitle>Navigation</GroupTitle>
          <Field label="Controls">
            <Dropdown label="Navigation controls" value={settings?.readerNav || 'footer'}
              options={[['footer', 'Bottom bar'], ['pill', 'Floating pill'], ['edge', 'Edge arrows'], ['swipe', 'Swipe only']]}
              onChange={(v) => set('readerNav', v)} />
          </Field>
          {/* Only with the bottom bar — it describes what that bar carries, so
              with any other navigation style it is a control for something that
              is not on screen (owner, 2026-08-04: "this one should be only for
              the bottom bar"). */}
          {(settings?.readerNav || 'footer') === 'footer' && (
            <Field label="Bottom bar">
              <Picks value={settings?.readerFooter || 'next'}
                options={[['next', 'Next song'], ['count', 'Count only']]}
                onChange={(v) => set('readerFooter', v)} />
            </Field>
          )}
          <Field label="Progress line" inline
            info="The hairline at the very top showing how far through the service you are.">
            <Switch label="Progress line"
              on={(settings?.readerProgress || 'on') === 'on'}
              onChange={(v) => set('readerProgress', v ? 'on' : 'off')} />
          </Field>

          {/* ── The screen ───────────────────────────────────────────────────
              Moved out of Settings → General (owner, 2026-08-11: it belongs in
              the ☰), by the same argument that just emptied the Chart Defaults
              panel — a decision about the screen you are reading from belongs
              beside that screen, not two menus away.

              ⚠ The copy has to be honest about the exception: LIVE acquires the
              wake lock whatever this says, because nobody goes live wanting the
              screen to sleep. A switch that reads "off" while the screen stays
              on would be the same lie the old explainer sheet told from the
              other direction. */}
          <GroupTitle>The screen</GroupTitle>
          <Field label="Keep the screen on" inline
            info="Stops the device locking while you read. Off by default. Going live always keeps the screen on, whether or not this is set.">
            <Switch label="Keep the screen on"
              on={settings?.keepAwake === true}
              onChange={(v) => set('keepAwake', v)} />
          </Field>
        </>
      )}

      {/* ── Music ──────────────────────────────────────────────────────────
          Named for what it holds: how the music is SPELLED and who is reading
          it — not how the page looks, which is why accidentals live here and
          not in Style. No key change: element 1's key pill owns transpose, and
          a second control for it is a second answer. */}
      {tab === 'music' && (
        <>
          {/* ── Who's reading ────────────────────────────────────────────── */}
          <GroupTitle>Who&rsquo;s reading</GroupTitle>
          {/* Was "You're playing" (owner, 2026-08-04: *"I don't like the you're
              playing name"*). "Your instrument" is the concrete thing, and it
              is the same word the team schema uses (`team_members.instruments`)
              — one day this row and the roster will be the same fact. */}
          <Field label="Your instrument"            info="Vocals and Drums drop the chords; Guitar and Bass open their own tabs. Everything here stays changeable on its own afterwards.">
            <Picks value={roleId} options={ROLES.map(r => [r.id, r.label])}
              onChange={(id) => {
                // Applies its settings VISIBLY. A role that silently overrode
                // the display panel is the exact bug that turned the hub's
                // Chart tab into a second Lyrics tab.
                const r = ROLES.find(x => x.id === id);
                set('displayRole', id);
                Object.entries(r?.applies || {}).forEach(([k, v]) => set(k, v));
              }} />
          </Field>

          {/* ── The chords ───────────────────────────────────────────────── */}
          <GroupTitle>The chords</GroupTitle>
          {/* Was "In a pinch", in Layout, and nobody could tell what it did.
              It is `displayMode` — the same setting as "show chords" — so it
              belongs beside the instrument picker that writes it, under a name
              that says what it is. */}
          {/* Writing Show also RETIRES the legacy `showChords` boolean, and
              Reset clears both.
              Without that, resetting Show walked straight into a landmine
              (owner, 2026-08-04: *"the show gets the reset and if I press it it
              will lose the chords even if the chords + lyrics is present"*):
              clearing `displayMode` hands the decision back to
              `settings.showChords`, which the old Performance/Practice views
              write and which is `false` in any profile that ever turned chords
              off there. So "put it back to default" produced lyrics-only.
              Clearing both means the fallback can only ever apply to a profile
              that has never touched this control — which is its whole job. */}
          <Field label="Show">
            <Dropdown label="What the chart shows" value={settings?.displayMode || 'chords'}
              options={[['chords', 'Chords + lyrics'], ['lyrics', 'Lyrics only'], ['chordsonly', 'Chords only']]}
              onChange={(v) => { set('displayMode', v); set('showChords', undefined); }} />
          </Field>
          <Field label="Chord names"            info="Numbers are Nashville (1, 4, 5). Numerals are Roman, and the numeral itself says major or minor — I, IV, V against ii, iii, vi.">
            <Dropdown label="Chord names" value={config?.display?.notation || 'letters'}
              options={NOTATIONS} onChange={(v) => set('notation', v)} />
          </Field>
          <Field label="Sharps or flats">
            <Picks value={settings?.accidentals || 'auto'}
              options={[['auto', 'Follow key'], ['sharps', '♯'], ['flats', '♭']]}
              onChange={(v) => set('accidentals', v)} />
          </Field>
          {/* Element 11. The setting existed and the reader read it NOWHERE —
              tapping a chord always offered its shape. Default on: a diagram
              you have to ask for costs nothing until you ask. */}
          <Field label="Tap a chord for its shape" inline>
            <Switch label="Tap a chord for its shape"
              on={settings?.showDiagrams !== false}
              onChange={(v) => set('showDiagrams', v ? undefined : false)} />
          </Field>

          {/* ── This song ────────────────────────────────────────────────── */}
          <GroupTitle>This song</GroupTitle>
          <Field label="Capo">
            {capo ? (
              // Truthful rather than a knob that does nothing: the chart shows
              // SOUNDING chords today.
              //
              // It used to end "Shapes are coming." — a promise, made in a
              // settings panel, by a round that had not been asked to make one
              // (owner, 2026-08-10: *"yes we delete that"*). Element 19 will
              // decide what a capoed player reads; until it has, this row says
              // what is true and nothing about what is next.
              <p className="m-0 text-[13px] text-[var(--text-2)]">
                <span className="font-mono font-semibold text-[var(--chord)]">Capo {capo}</span>
                {' — '}the chords below are what it sounds like.
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

  // ── Docked ───────────────────────────────────────────────────────────────
  // No portal, no scrim, no handle. It fills the box the host gave it, and the
  // ✕ in the tab strip is the way out.
  //
  // 'side' is the desktop's answer to the same complaint the phone dock fixed
  // (owner, 2026-08-04: *"On desktop, could the ☰ open as a hamburger from the
  // left side? because right now it sits over half of the screen. Something
  // like the rail"*). A popover anchored to a top-LEFT button covers the chart
  // it is changing; a panel down the left pushes it across instead, exactly as
  // the setlist rail does on the other edge.
  if (dock) {
    const side = dock === 'side';
    return (
      <div
        ref={panelRef}
        role="dialog" aria-label="Reader menu"
        className={`h-full min-h-0 overflow-hidden flex flex-col ${
          side ? 'border-r' : 'border-t'} border-[var(--border-2)]`}
        // It is a SIBLING of the reader's scroller, not a child, so it does not
        // inherit `chartSurface` and carries the remap itself.
        style={chartOverlaySurface}
      >
        {/* Tabs at the BOTTOM in the phone dock — it is already the bottom of
            the screen and the strip is what you reach for repeatedly, so it
            belongs on the edge nearest the thumb. A side panel is full height
            and read top-down, so there the strip goes back on top. */}
        {/* The Live row rides with the TOP in both shapes: it is a heading,
            not a tab strip, and on the phone dock the tabs are at the bottom
            (nearest the thumb) while the top is where you read from. */}
        {side ? <>{liveRow}{head}{body}</> : <>{liveRow}{body}{head}</>}
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
        {liveRow}
        {head}
        {body}
      </div>
    </>
  ), document.body);
}
