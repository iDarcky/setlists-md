# The Reader — the element-by-element record

> **This is the decision log, not a spec to re-derive.** Every line below is a
> choice the owner made during the July 2026 design walk. A future session
> should treat these as settled and build on them, not re-open them. Where
> something is genuinely undecided it says **OPEN**.
>
> `CLAUDE.md` = how the app works · `PLAN.md` = what's next ·
> `COMPONENTS.md` = what the pieces are · **this** = why the reader looks
> like it does.

---

## What the Reader is

**One viewer.** Not three. It replaces `SetlistPlayer`, `PerformanceView`,
`PracticeView` and (eventually) `ChartView`'s reading role. The owner's words:

> "We don't need three players or three panels for everything… We only need
> one big viewer."

It is called **the Reader**, and it covers Live, Practice, Rehearsal, Campfire
and the Song Hub's full-screen chart. The Song Hub's *embedded* chart tab is
the one exception: it follows the **app** theme, not the chart theme, because
a white chart card sitting inside a dark app reads as broken rather than as a
stage.

**Presets were scrapped.** An early cut carried Live/Rehearsal/Practice preset
bundles with a per-preset override map. It buried the decisions that had
actually been made under scaffolding for decisions that hadn't. Settings are
flat. If presets come back they come back *last*, as saved bundles of flat
settings.

### The one job

> **The chart's only job is that you never lose your place.**

The owner's anchor is **the section** — not a lyric, not a chord, not a page
position. Everything about elements 2 and 3 follows from that: the ribbon and
the section heading are ONE system, reading identity from
`src/lib/sectionIdentity.js`, so the highlighted chip and the heading it points
at are visibly the same object.

### The panel rule

**A panel never covers what it changes.** The Aa menu is a popover anchored to
the ☰ button, with the chart still on screen behind it.

---

## Where it lives

```
src/features/reader/
├── Reader.jsx          the chart itself — elements 1–9, 11. ONE scroll container.
├── ReaderTopBar.jsx    element 1. Shared by Reader AND BreakScreen.
├── ReaderSection.jsx   elements 3–5 (frame, sticky heading, cue)
├── ReaderFooter.jsx    element 10's bar. Shared by Reader AND BreakScreen.
├── SetlistReader.jsx   prev/next, nav modes, keyboard/pedal, the rail
├── BreakScreen.jsx     a break, wearing the same chrome as a song
└── SetlistRail.jsx     element 10's jump-anywhere list

src/lib/readerConfig.js    every knob, resolved. Start here.
src/lib/sectionIdentity.js one source for section code/name/colour/weight
src/lib/tabTranspose.js    element 9's transpose rule
src/lib/myInstrument.js    "what am I playing this service?"
```

Shared with the old chart (opt-in props only, so existing callers are
unchanged): `features/chart/SectionBlock.jsx`, `TabBlock.jsx`,
`StructureRibbon.jsx`, `AaMenu.jsx`, `ChordDiagram.jsx`, `ChordPopover.jsx`.

Behind the Labs flag **`unifiedReader`** (Settings → Labs). Flag off → the four
original surfaces render untouched.

---

## The elements

### 1 — Top bar
**Fixed. No customization at all.** One row: ☰ · title · key · ♩tempo · time · ✕.

- The title is **always** shown. A three-state density knob was built after the
  owner said element 1 takes no customization; its `min` value hid the title
  and cost five rounds of debugging. Don't rebuild it.
- Title, key and meta are ONE `min-w-0` group taking the leftover width. The key
  must sit **beside the title**, not out by the ✕ — it is the only live control
  in the bar and a mis-tap next to ✕ leaves the service.
- The key pill is copied verbatim from `SongHub.keyChip`: solid `var(--chord)`
  fill, `#0a0a0a` text, mono bold, `!rounded-lg`, `h-7`.
- `ReaderTopBar` is used by **both** `Reader` and `BreakScreen`. The break used
  to hand-roll its own bar and drifted (lost the ☰, moved the title).

### 2 — Structure ribbon
Short codes, tappable to jump, auto-scrolls to keep the current chip centred.

- Position: top (default) / bottom / left / right / off — `structurePosition`.
  Left/right collapse to top on a phone; a vertical rail has nowhere to live.
- Styles: Boxes / Chips / Inline / Dots / Dots+label — `ribbonStyle`.
- **Consecutive-only collapse**: `V1 C V2 C B C×2`, never a global tally.
- Geometry of the Boxes/Inline chip is the **Score mockup verbatim**: `10px`
  mono, `.06em` tracking, `2px 7px` padding, `5px` radius, `5px` gap.
- **Per-section colour**, and the chip you're in fills solid with it. A muted
  monochrome variant was tried and rejected.
- Element 2 renders **inside** element 1's sticky block — one piece of chrome
  that travels together, not two stacked stickies.

> ### ⚠ The `min-h-0` trap — read this before touching any small control
> `styles/index.css` carries, in `@layer base`:
> ```css
> button { min-height: 36px }
> @media (max-width: 639px) { button { min-height: 44px } }
> ```
> `StructureRibbon` renders each chip as a `<button>` when tappable and a
> `<span>` when not, so the **same component** measured ~21px in a setlist card
> and **44px in the reader**. Four rounds were lost tuning padding that never
> applied. Every small control needs `min-h-0`, and chords inside lyric lines
> use `role="button"` rather than `<button>` for the same reason.
> `src/__tests__/structure-ribbon.test.jsx` asserts the opt-out per style.

### 3 — Section heading
- **The user chooses** full name / letters / ALL CAPS — `readerHeading`.
  (ALL CAPS is the original chart's heading, kept on request.)
- Per-type colours, matching the ribbon, both from `sectionIdentity`.
- A chorus is **clearly heavier** than a verse — bigger, thicker rule, more air
  above it. The page has a shape you can read without reading the words.
- **Sticky on a phone, never on desktop.** On a desktop the whole section is
  usually on screen already, so pinning is just a bar that never goes away.
  Sticky headings pin **below** the measured header height (`headH`, via
  `ResizeObserver`), and `scrollMarginTop` uses the same number.
- Frames: Bar / No line / Block / Card — `readerSectionStyle`. "No line" is the
  original chart's look and was requested explicitly.
- Repeats: **reference by default** — a repeated chorus renders as
  `Chorus — as before`, tappable to jump to the first one. `duplicateSections`.
  This is the lever that buys bigger text *and* less scrolling.

### 4 — Band cue
- Starts **on the same line as the section heading** and wraps from there like
  a sentence continuing — NOT flex, or a long cue is forced onto its own row.
- Capped at 240 chars. A cue is an instruction, not an essay; it must never
  push the song off the screen.
- A leading `!` means **loud**: red, upright, semibold. Their team writes
  `!!! sing up an octave !!!` because the format has no emphasis; this is that
  convention made real.
- Shown in Live too. No settings of its own.

### 5 — Inline notes (`{!…}`)
Placement is a **physical fact, not a preference**:
- **Wide** — out to the right edge on a dotted leader, like a printed chart.
- **Narrow** — on its own line *above* its lyric line, so it's read before the
  line is sung.

### 6/7 — Chords and lyrics
- Chords above lyrics, per-word grouping so a line only wraps at a space.
- **Lyrics are NEVER truncated.** Owner: *"never, but never ever use … or
  something else, the lyrics should always be shown."*
- Chord spacing is a balance of two failures: a fixed trailing space shoves
  lyrics apart whenever one chord is long; no spacing lets neighbours collide.
  The rule: a chord keeps a real gap whenever **any** chord follows it later on
  the line (`chordFollows`), and only overhangs when it's the last one. An
  earlier version checked only the *immediately* next segment and a chord two
  segments later still collided.
- Sizes, colour, font and notation are user-settable; chords size off
  `--chart-font-size-chord`, not inherited size.

### 8 — Key change (`{modulate}`)
A solid `--chord` chip that names the **arrival key**, not the interval —
"you're in B now" beats "+2". `mt-5 mb-4` so it doesn't crowd the section
above it. A section repeated after a key change **always renders in full**,
never as a reference, because the chords have changed.

### 9 — Tabs
- **Instrument-aware.** Your instrument's tabs open; everyone else's collapse
  to one tappable line. `src/lib/myInstrument.js` answers "what am I playing":
  `team_schedules.role` for this setlist (bridged through `useTeamSetlistMap`
  — schedules reference the `team_setlists` ROW uuid, never the local id),
  falling back to your team instruments **only when there is exactly one**.
  Ambiguous → null → show everything. Hiding the wrong tab is worse than
  showing all of them. A manual `tabInstrument` setting beats the schedule.
- **Never scrolls sideways.** `width="100%"` + `preserveAspectRatio`.
- Bar numbers on; technique markers italic, smaller, lighter.
- **Transpose rule** (`src/lib/tabTranspose.js`): if *any* fret would leave
  0–22, **nothing** moves and it says "written in G". Beyond 4 semitones it
  transposes but flags a large shift. Half a transposed tab is worse than none.

### 10 — Getting to the next song
- **Four nav styles** — `readerNav`: bottom bar (default) / floating pill /
  edge arrows / swipe.
- **Keyboard and Bluetooth pedals are unconditional**, not one of the four —
  `←`/`→`, `PageUp`/`PageDown`. A pedal user has no other hands.
- The bar has **two treatments** — `readerFooter`: `count` (`← 3/9 →`) or
  `next` (`← 3/9 · Next  Goodness of God  A  →`). **Always visible.**
- It is **`sticky bottom-0`**, not last-in-flow. The reader is ONE scroll
  container, so a plain flex child sits at the end of the *song*, not the
  bottom of the *screen*. Same trick as the header.
- **The same footer renders on songs and on breaks.** Exit belongs to the top
  bar in both; the nav row is navigation only.
- **The rail is back, on phones too** (`SetlistRail`): a 264px column beside
  the chart on a wide screen (the chart narrows, it isn't covered), the
  drag-to-dismiss `BottomSheet` on a phone. Both render the same `SetlistList`.
  Opened from the footer counter, the pill's centre, or a counter chip that
  edge/swipe get so they have any way in at all.
- **Breaks** are set like a title page, not a card: named **once**, in the bar;
  the middle carries only the length and the note. (`duration && <…>` renders a
  literal `0` — guard with `> 0`.)

### 11 — Chord diagrams
- **Tap a chord, see that chord.** No strip. A strip is a permanent tax paid
  for the one chord you didn't know, which is why nobody left diagrams on.
- **Capo is deliberately ignored.** Chart says G, tap G, get the G shape.
  Showing a capo-adjusted shape would name a chord that appears nowhere on
  screen.
- Nashville charts look shapes up by **letter name** — you cannot finger a "1".
- **Guitar only.** Piano needs a shape library that doesn't exist; deferred.
- **Pro** — `useEntitlement('chord-diagrams')`. Without it chords stay inert.

---

## Not yet designed

| # | Element | Notes |
|---|---------|-------|
| 12 | **Practice tools** | Metronome, count-in, section loop, slow-down. The reason a separate Practice screen exists. **The last thing standing between us and deleting the four old surfaces.** |
| 13 | Finale screens | `LiveFinale` / `PracticeFinale` still belong to the old surfaces |
| — | Wake lock, session stats | Carried by the old views; not ported on purpose |

**Deliberately deferred, with reasons:**
- **Numbered per-repeat cues** (`> 2: Acapella`) — confirmed as a real gap from
  the owner's PDF, but it's an `.md` **format change**. Not while the reader is
  in flight.
- **Piano diagrams** — no shape library.
- **Presets** — only after every element is finished, as saved bundles.
- **`FullscreenChartViewer`** — still a WIP stub; should become a thin wrapper
  over `Reader`, not a fork.

---

## Traps that have already cost time

1. **`min-h-0`** — see the box under element 2. Four rounds.
2. **CSS custom-property cycles.** `--ds-gray-1000: var(--chart-text, var(--ds-gray-1000))`
   is a dependency cycle; a cyclic property is *invalid at computed-value time*
   and becomes **unset for the whole subtree**. Every fallback in `Reader`'s
   token remap must be a **literal**.
3. **Multicol context.** `columnCount` must be on the **same element** as the
   width constraint. With columns on the full-width parent and `wide-container`
   on a child, the columns span the window while the header stays at 1600px.
4. **`section.lines[]` is not all strings** — type-check before `.trim()`.
5. **`e.currentTarget` is nulled** by React before a lazy state updater runs.
   Read the rect synchronously.
6. **jsdom** has no `Element.scrollTo`, and `getComputedStyle` throws on some
   inline style combinations — workarounds live in `vitest.setup.js`.
7. **Any new reader setting must be added to `PORTABLE_PREF_KEYS`**
   (`src/app/usePreferenceSync.js`) or it won't follow the user across devices.

## Tests

- `src/__tests__/reader.test.jsx` — elements 1–6, 11
- `src/__tests__/setlist-reader.test.jsx` — element 10, breaks, nav modes
- `src/__tests__/structure-ribbon.test.jsx` — chip geometry + the `min-h-0` trap
- `src/__tests__/reader-config.test.js` — one case per knob
- `src/__tests__/my-instrument.test.js`, `tab-transpose.test.js`

`.test.js` = node/logic · `.test.jsx` = jsdom/render.
