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
├── Reader.jsx          the chart itself — elements 1–9, 11, 12. ONE scroll container.
├── ReaderTopBar.jsx    element 1. Shared by Reader AND BreakScreen.
├── ReaderSection.jsx   elements 3–5 (frame, sticky heading, cue)
├── ReaderFooter.jsx    element 10's bar. Shared by Reader AND BreakScreen.
├── ReaderPracticeRow.jsx  element 12 — the click + the backing track, one row.
├── ReaderFinale.jsx    element 13 — one finale for live AND practice.
├── SetlistReader.jsx   prev/next, nav modes, keyboard/pedal, the rail
├── BreakScreen.jsx     a break, wearing the same chrome as a song
└── SetlistRail.jsx     element 10's jump-anywhere list

src/lib/readerConfig.js    every knob, resolved. Start here.
src/lib/metronome.js       element 12's click — lookahead scheduler + its maths
src/hooks/useYouTubeTrack.js  the backing-track engine, shared with SongPlayerBar
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

> ## The numbering changed, 2026-08-04
>
> The ☰ was **element 28** — a number it got by being promoted mid-walk, out of
> element 1, alongside the setlist rail (29). It is not a late addition to the
> reader; it is the reader's second surface, and it holds every decision the
> first one does not. It is **element 2** now, and the structure ribbon moves
> from 2 to **3**. Later numbers are unchanged: they were never in an order that
> meant anything, and renumbering them would break every reference in this file
> for nothing.
>
> | # | Element | State |
> |---|---------|-------|
> | **1** | **Top bar** | ✅ closed 2026-08-04 (it turned out to contain edit mode) |
> | **2** | **The ☰ — the reader's settings menu** | ✅ closed 2026-08-04, 15 rounds |
> | **3** | **Structure ribbon** | ✅ closed 2026-08-06, 13 rounds (beta.78 → beta.90) |
> | **4** | **Section heading** | ✅ closed 2026-08-06, 5 rounds (beta.91 → beta.92) |
> | **4b** | **Band cue** | ✅ closed with it — it lives on the heading's own line |
> | **5** | **Notes** — all four layers, not just `{!…}` | **NEXT** |
> | 29 | The setlist rail | strip removed in element 4's pass; the rest is still open |
>
> ## And once more, 2026-08-06
>
> The **section heading is element 4** (owner, closing element 3: *"element 4
> which is the Section heading"*). It held the number 3 before the ☰ renumber
> and had been colliding with the ribbon ever since. The **band cue takes 4b**
> rather than shifting the whole tail by one: it renders on the heading's own
> line, so it is the same object seen from a different angle, and shifting 5–13
> would break every reference in this file to buy nothing.

### 1 — Top bar ✅ closed 2026-08-04
**Fixed. No customization at all.** One row: ☰ · practice · edit · title · key ·
♩tempo · time · ✕.

> **Closed after eleven rounds** (2026-08-03 → 08-04). The full log is "The
> header pass" below; the short version is that element 1 turned out to contain
> **all of edit mode**, the set bar's progress line, the chrome's real height,
> and the rail's toggle. Two of those were split back out as elements 28 (☰) and
> 29 (the rail) rather than being polished here a twelfth time. Reopen it only
> for a bug.

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
- **The SAME bar on every screen** — song, break, missing song (owner,
  2026-08-03: *"lets do the same header to everything, the one with the ☰ and
  the X"*). Sharing the component was **not** enough: `BreakScreen` and
  `MissingSongScreen` passed it three props, so the break lost the ☰ again and,
  once 8b landed, the set bar with it. The drift came back through props instead
  of through a second component. The structure ribbon is the one thing a break
  does not get — it has no sections to map.
- **No artist in the bar** (owner, 2026-08-03): *"it would take too much space
  for nothing to gain."* Two same-titled songs in one set stay ambiguous, by
  choice.
- **Tempo and time stay dead text, and stay.** They are *"needed text for the
  drummer and other players"* (owner). Making ♩ the way into the practice row
  was rejected — the metronome icon is the switch and it stays the only one.

### 3 — Structure ribbon ✅ closed 2026-08-06 *(was element 2)*

> **Thirteen rounds, beta.78 → beta.90.** What it is now, in one place: three
> styles (Boxes · Chips · Dots) and five positions, of which **left and right
> are always dots** — small enough to float in the margin the chart already had.
> The ends of a scrolling row fade. A key change shows as a gold `↗B` naming the
> key you arrive in. Tapping a Tag opens it where it stands. A chip lands its
> section ON the reading line, so the map and the chart never disagree about
> where you are. The side rail shows the whole song and **scrubs** under a
> thumb. Editing takes the map to the top and hands it back on exit.
>
> Everything below this line is the standing record; the round-by-round account
> is "The element-3 pass" further down.
Short codes, tappable to jump, auto-scrolls to keep the current chip centred.

- Position: top (default) / bottom / left / right / off — `structurePosition`.
- Styles: Boxes / Chips / Inline / Dots / Dots+label — `ribbonStyle`.
- **Consecutive-only collapse**: `V1 C V2 C B C×2`, never a global tally.
- Geometry of the Boxes/Inline chip is the **Score mockup verbatim**: `10px`
  mono, `.06em` tracking, `2px 7px` padding, `5px` radius, `5px` gap.
- **Per-section colour**, and the chip you're in fills solid with it. A muted
  monochrome variant was tried and rejected.
- Element 2 renders **inside** element 1's sticky block — one piece of chrome
  that travels together, not two stacked stickies.
- **Inactive chips are an OUTLINE in their section's colour** — no fill, no
  dimmed text, no opacity (owner, 2026-08-01, "do a"). They used to stack all
  three (tinted background + muted text + 0.72 opacity), and three dimming
  mechanisms at once is what made the row read as muddy. One filled chip on a
  row of clean outlines is the contrast the ribbon needs.
- **Bottom means the bottom of the SCREEN.** It pins in the same block as the
  nav bar. (`sticky bottom-0` alone is not enough — see the trap below.)
- **Left/right float**, transparent, over the chart: `pointer-events-none` with
  the chips re-enabling, so the space around them still scrolls the song. That
  is why a phone can have them now — a docked 56px rail was 14% of a 390px
  screen, a floating one costs nothing.
- **The scroll-spy reads the PIN LINE**, in pixels, not a fraction of the
  viewport. `useActiveSection` takes `linePx`; the reader passes `headH`. With
  the fraction the chip changed 60–80px of scrolling before the heading pinned.

#### The element-3 pass — decisions, 2026-08-05

- **A Tag opens where it stands.** Tapping the `↩ Chorus` pill, or its chip in
  the ribbon, renders that repeat in full **in place**, for the rest of the song.
  The rejected option was "go to the first full play" (which is what the chip
  did): you tap chip six, land at chip two, and the highlight walks backwards
  with you — on stage that reads as the app losing your place. State is a set of
  play-order **slots**, so opening the third chorus never opens the second, and
  it is dropped when the song changes.
  **Hidden is unchanged**: it draws nothing, so there is nothing to open in
  place, and its chip goes to the one place those words exist.
- **The ends of the strip fade** when there is more song that way — per side,
  only where there actually is more. Twelve sections on a 390px phone looked
  exactly like eleven: hidden scrollbar, chip clipped flush.
- **The song fits ⇒ nothing lights up.** Offered "light the first chip", "fill
  them all softly", "tint the strip"; owner rejected all three (*"I don't like
  any ideas"*). Left as it is.
- **The hit area is not the chip.** A transparent `::after` grows what the
  browser hit-tests without moving a pixel. ⚠ Its ceiling is the wrapper's
  `overflow-hidden` — hit-testing follows the clipped box, so the target cannot
  exceed the row's own padding (≈33px). A real 44px costs ~16px of permanent
  chrome.
- **Editing takes the map to the top from EVERY position**, and gives it back on
  exit (owner: *"boxes are for editing… when exits edit everything goes back to
  normal"*). It used to rescue `off`/`left`/`right` only, so a bottom ribbon
  stayed under the nav bar — the furthest place from the change being made.
- **`C ×3` stays one chip and still jumps to the first of the run** (owner).
- **A collapsed run, a break with no ribbon** — a break's chrome is one row
  shorter and that is fine: *"more space for the break items"* (owner).
- **Three styles, not five** — Boxes · Chips · Dots. Inline was the Boxes chip
  without its box and Dots + label was Dots with that chip's text beside it.
  `numbered → codes`, `dotlabel → dots` (a MAP, not `pick`'s fallback, which
  would have sent a Dots + label user to boxes).
- **The side rail, rebuilt.** Centred in the visible band, not stacked from the
  top; a **window of six** (2 behind, 3 ahead) that walks with the song; hung off
  the **chart column** so the ☰ and the setlist rail push it instead of opening
  over it; translucent, so the lyrics read through. It never followed the song
  before — the auto-centre effect wrote `scrollTo({ left })` on a box that
  scrolls vertically. Sticky with **zero height**: `fixed` would ignore both the
  ☰ and the app's own sidebar.
- **A key change shows on the map** — a gold `↗B` between two chips, naming the
  key you ARRIVE in (element 8's rule), from the same `notateChord` call the
  chart's own chip makes. Boundaries only: a `{modulate}` mid-section belongs to
  that section's chip, and the map has nowhere between two chips to put it.
- ⚠ **The chart was never using the window's full width.** The row holding the ☰
  panel and the chart is a flex ITEM with no `flex-1`, so it was shrink-to-fit:
  840px of chart in a 1236px scroller at 1280, left-aligned, ~400px of dead
  window. The WIDTH twin of the `flex-1 min-h-0` trap, with the opposite lesson —
  **on the cross axis of a scroller, `flex-1` is what you want.**
- **The side rail spells repeats out** (no `×2`) — a column has the room a row
  does not. The top ribbon still collapses.
- **The side rail is GLASS, not a fade.** Round 1 dimmed the strip to 0.72 and
  the owner's read was *"the transparency feels strange"*. Fading the chips
  attacks the wrong layer — the ink goes down with the surface, the one filled
  chip goes pale, the outlines go muddy over the lyric behind them. Seeing
  through is a property of the **ground**: full-strength chips on a translucent,
  blurred plate.
- ⚠ **A new song starts at the top** (prio 0, 2026-08-05). The reader is NOT
  remounted between songs — same component, same slot, different `song`, which
  is what keeps the chrome and the metronome alive across a set — so the
  scroller is the same DOM node and a DOM node keeps its `scrollTop`. Layout
  effect, direct assignment, no smooth scroll: arriving at a song is not a jump
  you asked for.
- **Trailing space is MEASURED** (`tailPad`), not a flat `60vh` on phones only.
  The owner's *"clicking on a chip won't fully scroll to that item"* was not the
  header — a jump lands 8px under it with the set bar on or off. The last
  sections had nothing below them to scroll into: desktop, last chip, the
  section sat **536px** below the header at maximum scroll. Now: enough for the
  last section's top to reach the pin line, and **zero when the song already
  fits**, because a flat pad invents a scroll on a song that almost fits.

- **A chip lands the section ON the reading line** (1px under the header),
  never below it. It used to land 8px below as breathing room — and the
  scroll-spy's rule is "the last section whose top has scrolled ABOVE the
  line", where the line IS `headH`. So the jump left the chip pointing at the
  PREVIOUS section: owner, 2026-08-06, with a screenshot — *"if I click on
  verse 2 it scrolls to verse 2 but not quite so I still see verse 1
  selected"*. One number, both halves.
- **The rail never covers a word, and never moves one either.** Owner, seeing
  chips across "Wash all my sins away": *"the lyrics are the number one in
  importance"* — then, on the fix: *"I don't want the strip bar to push the
  lyrics to the right. The right side should be for inline notes."*
  - Round 1 gave the chart a **gutter** the width of the strip. It worked and it
    cost the wrong thing: ~83px of a 390px phone for Chips, and the right margin
    is **element 5's** — inline notes live out there on a wide screen. Rejected.
  - Settled: **a side rail is DOTS, whatever style is set** (owner: *"maybe we
    allow only dots to be placed left/right because we can make them
    transparent"*). Same shape as edit mode forcing `codes` — the POSITION
    decides what a chip can be, because a floating 26px column and a full-width
    row are not the same object.
  - **The dots carry the transparency** (0.7), with no plate. Frost was right
    for text chips and wrong for a floating strip: a plate is opaque enough to
    hide a word. A dot has no ink to wash out, which is the one case where
    fading the marks is the honest tool.
  - It still paints UNDER the chart (`z-0` vs the chart's `z-[1]`). Measured on
    a 390px phone: the strip is 26px and the chart's own padding is 32px, so the
    dots sit **inside the margin the chart already had** — zero crossings, zero
    width taken.
- **The side rail shows the WHOLE map** (owner, 2026-08-06: *"now that we have
  dots, remove the scrolling of 2 and 3, show full"*). The window of six existed
  because a column of CHIPS could carry no more; a 7px dot on a 13px pitch means
  thirty sections are ~390px of a ~700px band.
- ⚠ **A dot's size change must not move its neighbours.** The dot WAS the flex
  item, so growing it 7→11px shoved every sibling below it — and a fast scroll
  walks the active dot down the list one section at a time, which reads as the
  column shuddering (owner, 2026-08-06). Every dot sits in a **fixed 11px cell**
  now and only the paint inside it changes. Measured over 14 fast wheel steps in
  Chromium: worst wander **4.0px → 0.0px**.
- **Smaller dots**: 7px, and the current one 11px with **no halo**. It was 10px
  and 14px + a same-colour 2px box-shadow — an 18px blob over a lyric. (The
  `ring-*` classes went with it: the inline `boxShadow` had always overridden
  them, so they never drew anything.)
- **Style, then location, and they are dependent.** Boxes/Chips offer Top ·
  Bottom · Hidden only; Dots offer all five. Picking a style that cannot float
  moves the location to Top with you. The reader forced dots on a side already —
  this is the menu finally saying so.
- ⚠ **The rail paints ABOVE the chart, and it has to.** beta.87 put it under —
  the honest reading of "lyrics first" — and that silently broke the map: paint
  order is hit-test order, so the chart's own box (padding included, and the
  strip lives in that padding) swallowed every tap. **Not one dot was
  clickable.** The rule survives by GEOMETRY instead: 26px of strip inside the
  32px padding the chart already had.
- **The rail scrubs.** Press and drag it and the chart follows, section by
  section (owner: *"do you know what would be cool? to have like a scrub when
  user clicks and drags the side rail"*). Nearest-dot-by-geometry, not
  `elementFromPoint`: a column of 7px dots is half gaps, and with pointer
  capture `e.target` is always the chip you started on. Jumps are INSTANT while
  scrubbing — an animation per dot arrives after the finger has left. Native
  listeners, `{ passive: false }`, `touch-action: none` on the strip only.
- ⚠ **`jumpTo` must never use `document.getElementById`.** The Song Hub keeps
  its embedded Reader mounted behind the full-screen one and both render
  `id="section-N"`, so a document lookup returned the HUB's section and every
  full-screen jump measured an element in a different scroller. Scoped to the
  reader's own scroller via `[data-section-index]`. The same duplicate had
  already cost twenty minutes of mis-measured probes the day before: **there are
  two readers in the DOM; scope everything.**
- ⚠ **The dots' "line inside them" was Firefox** (owner's screenshot, Zen).
  `:-moz-focusring { outline: auto }` ships in the preflight, and Firefox draws
  `outline: auto` as a **dashed ring that follows `border-radius`** — so a
  tapped 14px dot got a dashed circle painted inside it. Chromium never showed
  it because its focus ring is drawn outside the box. Firefox has **two** focus
  artifacts and they need different answers: `:-moz-focusring { outline: auto }`
  (moved clear with `outline-offset-2` on the chip) and **`::-moz-focus-inner`**,
  a legacy dotted border drawn INSIDE the button that no offset can reach —
  modern-normalize zeroed it, Tailwind v4's preflight dropped the rule, so it
  came back. Both are handled now (the second app-wide, in `@layer base`).
  **Test small round controls in Firefox, not just Chromium.**

**Open, carried out of the pass:**
- **Moving between sections in the left/right rail** — the owner is undecided
  about the whole interaction (*"I'll have to think about it"*). The window and
  the glass are round 1 of an answer, not the answer.
- **Tap-a-Tag-to-open-it-in-place** is shipped but NOT settled — he asked to
  revisit it *at the repeats element* and to be reminded there.
- **"The dots have a line inside them"** — not reproduced. Measured at 4×
  zoom in Chromium, top and side, active and inactive: clean circles, no rule,
  no ring (the active dot's `ring-*` classes are dead — the inline `boxShadow`
  overrides them). Needs a screenshot or a device.
- **The set bar does NOT share the ribbon's row**, and any comment saying so is
  a fossil of the pre-8b rule. Owner, 2026-08-05: *"We moved the Setlist bar on
  top of the header so they don't share anything."* Fixed in the ☰'s own copy,
  `readerConfig`'s knob comment, the changelog entry, and the `underBar` prop
  name (now `aboveBar`, which is where it renders).

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

### 4 — Section heading ✅ closed 2026-08-06 *(was 3; renumbered 2026-08-06)*

> **Five rounds, beta.91 → beta.92.** What it is now, in one place: a heading
> you can read (14px, 17px on a chorus, always a size above its cue), eleven
> section types in eleven colours, and four frames — None · Rule · Margin bar ·
> Tint — **none of which takes a pixel of width from the words**. The words
> start at the edge of a phone; the right side is for notes. A chorus has real
> air above it. Headings pin at one column on every device. Back-to-back
> repeats are one tag, and a tag you opened can close again.
>
> It also turned up **seven bugs older than the element** — see "The
> element-4 pass" for the full account.

- **The user chooses** full name / letters / ALL CAPS — `readerHeading`.
  (ALL CAPS is the original chart's heading, kept on request.)
- **Sizes are FIXED, not a fraction of the lyric size** (owner, 2026-08-06:
  *"I don't know about scaling with lyrics but I agree that it should be
  heading > cue"*). Name/Short **14px**, **17px** heavy; Uppercase 15/18. The
  cue is always `labelPx − 2`. It was 12.16px against 18px lyrics and a 13px
  cue — the smallest text on the page was the one naming where you are, and the
  instruction riding on it was set larger than the section it belonged to.
  **No separate size knob**: the owner raised it and then raised the menu's
  density against it, and a heading is chrome for the page, not another voice.
- **The heading row is sized off the heading.** It inherited the chart's
  18px/27px body type, so it measured **34.4px to hold a 16px word** — ~9px of
  strut per section, ~170px on a ten-section song, growing with the lyric size.
- Per-type colours, matching the ribbon, both from `sectionIdentity`.
- **A chorus is clearly heavier** — bigger (a 21% step, where it used to be 13%
  and read as a rendering accident), indented 0.85rem, and with **real air
  above it**: see the margin-collapse trap below.
- **Sticky is about COLUMNS, not screen size.** One column pins on every
  device; two columns never do, and the ☰ hides the switch there rather than
  lying about it (owner: *"Let's say the user selects 2 column, the option is
  gone"*). It used to be `!wide`, so the switch read ON and did nothing at
  768px and up — a one-column desktop and an iPad in portrait included.
  Measured: `position: sticky` pins identically inside a 2-column multicol, so
  the old behaviour was a judgement, not a limitation.
- **A section only pins when its body is taller than its heading** (+8px of
  hysteresis, because pinning itself grows the heading by 7.4px). A one-line
  outro had **over half its only line behind the heading naming it**.
- Frames: **None · Rule · Margin bar · Tint** — `readerSectionStyle`, default
  `plain` (None). A frame says only WHERE THE SECTION'S COLOUR LIVES and none
  of them boxes the text. `block`/`card` are retired to `tint` by
  `STYLE_LEGACY`.
- Repeats: **Full · Tag · Hidden** (`duplicateSections`, default `full`).
  `hide` draws nothing at all, not even the pill — but the section's div stays
  (empty, `aria-hidden`) and **the ribbon still lists it**. The ribbon is the
  map of the song; a section missing from the map breaks the one job.
- The pinned heading sits at **`stickyTop - 1`** with a matching extra pixel of
  padding. Two sticky edges that merely ABUT show a sliver of scrolling content
  on any device whose pixel ratio isn't a whole number. Overlap, never abut.
- **A pinned heading wears its section's frame.** It used to paint
  `--chart-bg` always, which on a tinted section was bare paper cut out of the
  wash.

#### The element-4 pass — decisions, 2026-08-06

- **The words start at the left edge.** 32px a side on a 390px phone is 16% of
  the screen; 12px gains 40px of line AND takes 20px off the song's height.
  ⚠ **Except the side the structure rail floats down**, which keeps its 32px —
  element 3 measured the dots as living inside that padding, and taking it away
  puts them on the lyrics.
- **Eleven types, eleven colours, and saturation says who is singing.** Four
  pairs shared a hue (Intro=Tag, Refrain=Interlude, Pre Chorus=Instrumental=
  Vamp, Ending=Outro) and the heading and its chip are one system, so a shared
  colour cost the same thing twice. Vivid = the five the room sings; deeper =
  the six the band plays. ⚠ **"Muted" is not "pale"** — the first cut flattened
  all six played hues to one saturation and one lightness, and six colours
  separated by hue alone at low saturation are six pastels (owner: *"now
  everything looks the same"*). They sit back by being DEEPER, each on its own
  rung of a lightness ladder.
- **`Ending` is retired to an alias of `Outro`** — one thing under two names,
  the same argument that retired `ref` from the repeats knob. Gone from every
  picker; a file that says `## Ending` still reads.
- **The colours are their own `--section-*` tokens**, not steps of the Geist
  ramps: the ramps carry seven chromatic hues and the chart needs eleven, and a
  change to the UI's blue should not repaint anybody's Intro. Every value is
  contrast-checked against the real chart backgrounds (worst 4.6:1); the old
  `--ds-blue-700` Intro measured **4.18** and failed.
- **A note goes in a GUTTER, at every width** — a strip down the right that the
  words stop before. The dotted leader owned wide screens until it was seen at
  1280 in two columns: a 594px column with an ordinary lyric leaves ~400px of
  dotted rule, which reads as a divider, not a connection. **Only a section
  that actually carries a note reserves the strip** (owner: *"if no notes we
  use for lyrics if notes we have a space for them"*) — a permanent gutter
  measured **+24% on the song's height**. 132px wide, 88px on a phone.
- **A long cue clamps to two rows**, name and cue together, on the ROW rather
  than the cue — the cue starts on the heading's own line, and clamping it
  alone would first have to make it a block. New cues are capped at the INPUT
  (70 chars, measured: two rows on a 360px phone, three at 80). A character cut
  was the wrong answer for a cue written before there was a limit.
- **`↩ BRIDGE ×3`** — back-to-back repeats collapse into one pill, consecutive
  only, the rule element 3 already uses for chips. The pill carries a **▾** so
  it reads as openable (owner: *"a show should be visible"*), opening it opens
  the whole run, and **the pill opens in place while the ribbon chip still
  jumps** — both behaviours he liked, each where it belongs.
- **An opened repeat closes again** from a ▴ on its heading.
- **The setlist rail keeps no resting strip** (element 29, pulled forward on
  request). It used to hold 44px docked on wide so the chart never reflowed on
  opening; on a 1024px iPad that is permanent chrome for one chevron, and the
  way in already existed — the footer's `x / x` counter, plus the edge hotspot
  on the swipe/edge nav modes. Opening reflows the chart now; that is the
  price, and you only pay it when you ask. **`readerRail` went with it** — a
  knob whose reason for existing was removed is worse than no knob.
- **Defaults: Plain + Full.** `storage.js DEFAULT_SETTINGS` said `bar`/`full`
  while `readerConfig`, the ☰'s Reset and this file all said `plain`/
  `condensed` — so no user ever had the documented default, and pressing Reset
  on a fresh profile CHANGED a setting nobody had touched. No migration: beta
  only, one database, users change it themselves (owner).

### 4b — Band cue ✅ closed 2026-08-06 *(it renders on element 4's own line)*
- Starts **on the same line as the section heading** and wraps from there like
  a sentence continuing — NOT flex, or a long cue is forced onto its own row.
- **Capped at 70 characters at the INPUT**, and the heading row clamps to two.
  A cue is an instruction, not an essay; the heading **pins with its cue**, so
  every row past two is a row of song hidden behind it.
- **Always smaller than the name it rides on** (`labelPx − 2`).
- A leading `!` means **loud**: red, upright, semibold. Their team writes
  `!!! sing up an octave !!!` because the format has no emphasis; this is that
  convention made real.
- Shown in Live too. No settings of its own beyond the on/off.
- ⚠ **You could not type a space into one** until 2026-08-06 (PLAN §1.2 #3c,
  prio 1, reported 08-04). The editor's cue field round-trips through
  `songToMd` → parse on EVERY keystroke and parse ran `.trim()`, so the
  trailing space died before it could become a word boundary: one word per cue
  and no more. Parse strips exactly the one space the serializer writes.
  **The inline-note half of that report does not reproduce** — inline notes are
  edited in a local-state input and only trim at render.

### 5 — Notes — **CLOSED 2026-08-09** *(was "inline notes"; widened 2026-08-06)*

> **Element 5 is every note, not one kind of note** (owner, 2026-08-06:
> *"element 5 should actually become notes, and this should include all the
> notes, not separate as we have them right now"*). The app has four layers and
> they were designed separately, at different times, with different rules:
>
> | | where it lives | who sees it | element |
> |---|---|---|---|
> | **Band cue** (`> text`) | on the section heading | everyone | 4b ✅ |
> | **Inline note** (`{!…}`) | on a lyric line | everyone | 5 |
> | **Arrangement note** | `arrangement.notes`, markdown | everyone | 5 |
> | **My note** (`team_notes`) | per user, per scope | you only | 5 |
> | **Setlist item note** | `items[i].note`, 100 chars | everyone | 5 / 10 |
>
> **WHERE an inline note goes is already settled** — element 4's pass answered
> it, because the owner asked for the right margin while the section was being
> rebuilt. It is a **gutter** at every width: a strip down the right, reserved
> only by sections that actually carry a note, with the note on the same line as
> its words. The old rule in this file ("narrow → above its line, wide → a
> dotted leader") is superseded; see "The element-4 pass".
>
> So element 5 is now: what a note **looks like**, what it can **say**, and how
> the four layers relate. Open questions it inherits:
> - Can you write a cue or a note from the READER, or only from the editor?
>   (§1.2 #3d asks the same about the hub. `LyricEditor` in the reader edits
>   `section.lines` only — the cue is neither shown nor editable there.)
> - Do the four layers keep four treatments, or one with a marker for scope?
> - Does "My note" belong in the reader at all, or only in the hub?
> - The ☰'s **Notes** row was built and then moved out to the setlist — decide
>   where it lands.

**Settled, carried in from element 4:**
- **Placement is a physical fact, not a preference** — the gutter, at every
  width, per section that has a note.
- ⚠ **A note lands on its own line, and neither end of the cell is that line.**
  A rendered line is a chord row above a lyric row: top-aligned, the note sits
  level with the chords (20px adrift); bottom-aligned, a line that wraps to two
  rows drops it to the second (50.8px adrift); `baseline` cannot help, because
  a flex row of chord-over-lyric columns exposes no baseline the grid can see.
  Top-aligned, offset by exactly one chord row.
- **Capped at 40 characters at the input.**
- A leading `!` means loud, the same as a cue.

#### The element-5 pass — CLOSED 2026-08-09

Six rounds. It started as "what does a note look like" and turned into **where
does editing live**, because the honest answer to "can you write a cue from the
reader" turned out to require answering "what is a mode".

**The decisions, in the order they were forced:**

**Editing is one mode.** Two rounds were spent moving a single gate around: arm
"Note", then tap a line; then existing notes tappable without arming — which let
a cue be rewritten while merely reading (owner: *"why can I edit them without
having the exit toggled?"*). Both were the same mistake, a second lighter editing
mode beside the real one. There is one now. Outside it a cue and a note are text.
Inside it every cue and note on the song is writable at once — no arming, no
picking, no instruction line — beside the section pencils that were already
there. Owner: *"that's the whole point. You want to edit something... you are
just there focusing on editing."*

**The three surfaces, and the rule that assigns controls to them.** This is the
element's most reusable output:

  · the TOP BAR says **where you are** — ☰ · title · key · ✕
  · the CORNER says **what you do to the song** — Edit / Done, click / Undo
  · the FOOTER says **where you're going** — prev / next / finish

The bar reached five icons beside a truncating title (owner: *"too much for the
header"*) and the fix was not to prune the list but to notice the list was
answering a different question. **The bar now carries no tools in any view or
mode** and is the one thing in the reader whose shape never changes.

**The corner is two circles, not a menu.** Round 3 built one button with a stack
of four and the stack hid that its contents answered two questions. 48px primary,
44px satellite: size is the whole hierarchy, readable before either glyph is.

**⚠ Two rounds were lost to "harmless" as an argument.** The ☰ in edit mode went
disabled → re-enabled → gone. Re-enabling was justified as "the reason it was
disabled expired, and it can't hurt anything". The owner's counter settled it in
one line: *"you're changing the song, not the screen."* A category argument beats
a safety argument, and *harmless is never a reason FOR a control*. The rule was
already written in `ReaderActions` — the ☰ stays out because that is how the page
is PAINTED — and got contradicted anyway.

**There is no edit bar.** Its four controls all had homes: Done → the big circle,
in place; Undo → the satellite slot the click vacates; Cancel → the top bar's ✕,
which was DISABLED there (dead pixels in the most reachable spot on screen); New
version → a labelled pill above the circles, only when dirty. A whole bar of
chart back on a phone, and edit mode is down to element 12's two-bars maximum.

**Cancel is a WORD.** Moving it onto ✕ made one glyph mean "leave the song" and
"throw away what you just did" depending on a mode, in the corner where muscle
memory is strongest. The deleted edit bar had already settled it — *"'which one
discards my work' is a question no 16px glyph answers"* — and it got broken two
commits after being quoted. It confirms, but **only when dirty**: a confirm on an
untouched song teaches people to dismiss confirms.

**Live can do nothing to a song.** `practiceTools: false` there too, which
REMOVES the metronome from the service view — the owner's call, twice.

**Enter chains.** Committing a note opens the next line's, skipping tabs and
modulate markers. Marking up a chart is a verse, not one note.

**The signal on empty lines.** ~30 `+` marks down a song is noise while READING
and simply the affordance while EDITING — which already puts a pencil and a trash
on every heading. The gutter takes a hairline down its left edge while writable
so the marks read as a column's contents rather than litter. Owner: *"we need to
signal to the users that they can [write] there otherwise how would they know"*.

**Anchoring.** The floating controls sit above the bottom block, and that block
changes height for reasons that have nothing to do with them: entering edit mode
removed the nav row, so the circles fell and *the button you had just pressed
moved out from under your thumb as a result of pressing it*. The anchor has a
floor now — the block's resting height — so only the click row moves them, one
direction, animated. Measured at 390px: reading 779/721, editing 779/721, click
open 738/680.

**Three bugs of one family, found by sweeping rather than by report.** A
capability declared and read by nothing (`writeNotes`, `saveKey`) and a field
read but never written (`item.key`). All three present identically: you use the
feature, nothing happens, no error anywhere. `switchArrangement` reads zero too
but honestly — element 21 isn't built. `settings.stageMode` was the same shape
and the whole chain went (see below).

**⚠ The ț was not what it looked like.** Diagnosed as multicol fragmentation and
"fixed" with `break-inside: avoid`, which changed nothing because nothing was
fragmenting. The heading carried `mb-1.5` — a 6px MARGIN, and margins are not
painted — so a pinned opaque heading had a 6px transparent strip under it that
lyrics scrolled through. Most letters never reach into it; U+021B's comma is a
real descender, so its letter stayed hidden behind the heading while its comma
appeared in the gap. **A sticky element's painted box must reach the content it
covers, and only padding paints.**

**Removed as part of the pass:** `stageMode` + the whole `chordEmphasis` chain it
fed (bassist root-emphasis was built, rendered, and reachable by no user);
`ReaderEditBar`; `StructureRibbon`'s `MetaPill`; `ReaderTopBar`'s exported
`MenuIcon`; and eight orphaned modules left behind by the 2026-08-04 folder move.

**Still open, carried out of element 5:**
- The **arrangement note** and **"My note"** (`team_notes`) still have no home in
  the reader — that is element 22, unchanged by this pass.
- The setlist item note is element 10's.
- `sync/merge.js` is **built and tested (11 tests) but wired to nothing** — the
  three-way merge that would stop trivial conflicts reaching a human. Same family
  as the bugs above; it needs an owner, not a delete.

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

### 12 — Practice tools

**Round 1 is the metronome and slow-down. Nothing else.** Count-in and section
loop were both considered and **cut**: a loop has nothing to loop against — the
`.md` format carries no bar count or timestamp per section — and that is a format
change, not a reader change.

First, the fact that reframed the whole element: **none of it existed to port.**
`PracticeView` (908 lines) had no `AudioContext`, no click, no `playbackRate`, no
loop and no autoscroll. The old Practice screen was a chart viewer with different
chrome. So "the reason a separate Practice screen exists" was aspirational, and
deleting the old surfaces costs nothing but the finale stats (element 13).

- **One icon beside ☰ is the switch**, and **the icon IS the switch** — tapping it
  starts the click *and* opens the row; tapping it again stops and closes. The
  row keeps its own stop/start so silencing the click doesn't take the track
  controls with it. Nothing was added near the ✕.
- **ONE row, two halves, above element 10's nav bar** — click on the left, track
  on the right. Two bars at the bottom edge, **never three**: the alternative was
  a player, a tools bar *and* the nav bar, ~150px of chrome eating the chart on a
  phone. Both rows share **one** `sticky bottom-0` block; two separate stickies
  would fight over the safe-area inset.
- On a narrow screen the halves **wrap onto two lines rather than truncate**.
  Squeezing a tempo readout is how you end up unable to see the tempo you set.
- **The right half only exists when the song has a YouTube link.** A dead
  transport reads as broken.
- **The click and the track slow down INDEPENDENTLY** — not locked together. The
  click gets a **bpm stepper**; the track gets a **rate stepper** through
  `getAvailablePlaybackRates()` so a step can never land on a rate the embed
  refuses. Track rate is **pitch-preserving** and **cannot** pitch-shift — that
  was confirmed once and is not to be re-investigated.
- **Press-and-hold repeats** on the steppers. A tap-only stepper is 32 taps from
  132bpm to 100 and nobody does that twice.
- **Beat 1 is accented**, cycling on the song's existing `time` field — no new
  data, no new setting. Missing or malformed `time` falls back to 4 rather than
  refusing to click.
- **Nothing is persisted.** The tempo is *derived* from the song (stamped with
  its id), and **the click stops on a song change**. So there is no new key for
  `PORTABLE_PREF_KEYS`, and no way to walk into the next song with a click you
  forgot was running.
- **No wake lock**, by decision. Audio only; the screen may sleep.
- The player engine is **`hooks/useYouTubeTrack.js`**, extracted from
  `SongPlayerBar` when this element needed the same player — the ready-watchdog,
  position poll and teardown are hard-won and must not exist twice. The Song Hub
  renders the full bar; the practice row renders a compact face.

> **The click is a lookahead scheduler, not a `setInterval` that plays a sound.**
> A timer that fires the click inherits every bit of main-thread jitter — a
> re-render, a scroll, a GC pause — and a metronome that wobbles is worse than no
> metronome. The interval only ever *schedules*, booking beats onto the audio
> clock ~120ms early; the hardware plays them on time even if JS was busy. The
> arithmetic is `beatsToSchedule()`, split out so it is testable without an
> AudioContext.

> **`clampTempo` uses `parseFloat`, not `Number`.** `Number(null)` and
> `Number('')` are both **0**, so a song with a blank tempo clamped to the 40bpm
> floor instead of falling back to 100. Caught by a test, not by a device.

#### Tap tempo — 2026-08-01

- **TAP button beside the bpm**, four taps then it commits and keeps tracking.
  A gap of 2s starts a fresh count. `tempoFromTaps` / `pruneTaps` in
  `src/lib/metronome.js`, tested without any audio.
- **The bpm readout is the exact-entry control** — tap the number, type it.
  A stepper alone takes 32 presses to get from 132 to 100.
- **A tapped tempo saves to the song** (owner's call, overriding element 12's
  "nothing persists"): a **Save** button appears only while the working tempo
  differs from the song's. `onSaveTempo` → `onUpdateSong`, so it is null in a
  read-only team library.

> **Tempo cannot be read from a YouTube link, and this will be asked again.**
> The IFrame API exposes duration, position, playback rate and quality — no
> tempo. The audio can't be analysed either: the embed is a cross-origin iframe
> with no media element to route into Web Audio (`createMediaElementSource`
> requires same-origin). Spotify's `audio-features` carries tempo but is closed
> to new apps. Tapping is the answer.

#### The practice row, round 2 — 2026-08-01

**The scrubber is gone**, and the clock with it: play/pause and slower/faster,
nothing else (owner). Practising means playing from the top at a slower speed,
not hunting a position — and a 3rem range input was the one control on that row
nobody can hit accurately on a phone while holding an instrument. The Song Hub's
player bar keeps the full transport for when you ARE looking for a spot.

#### The divider — settled 2026-08-01, after two placements

It is the **bottom edge of the whole sticky block** (bar + ribbon), brand-tinted
via `--chart-divider` (the accent at 60%). It lives on `ReaderTopBar`, not
between the bar and the ribbon.

The reasoning, because the owner was conflicted and this is the kind of thing
that gets re-opened: element 2 already decided the bar and the ribbon are **one
piece of chrome that travels together, not two stacked stickies**. A rule
between them argues the opposite — and in practice it read as an underline for
the song title. The boundary that actually exists on that screen is
**chrome ↔ chart**, and that is where the line belongs. It is also the only
placement that still makes sense when the ribbon is off, or when element 8's
setlist bar is showing instead.

### 8b — The setlist bar — SET / HEADER / STRUCTURE

**Revised 2026-08-01, by the owner, against this element's original rule.** The
set bar no longer *replaces* the structure ribbon. It sits **above the title
row**, inside the same sticky block, and the ribbon keeps its place below:

```
┌ the set      ── element 8b, every item in the service
├ the header   ── element 1: ☰ · practice · title · key · ✕
├ the structure ── element 2, where the user put it
└ ─────────────── the brand divider closes the block
```

The original rule was "never both: the ribbon maps the SONG, this maps the SET,
and stacking both is two maps competing for the same glance." The owner
overruled it. Recorded as his call, not re-argued.

`readerTopBar` is therefore a **visibility** switch for the set bar, not an
either/or with the ribbon; the ribbon is still turned off through
`structurePosition: 'off'`.

### 8b — original notes

`readerTopBar`: **Song structure** (the ribbon, default) or **The set** — the
app's original player bar, kept because the owner still likes it: a thin
progress line across the whole set, then every item as a chip, songs numbered
with their key, breaks dashed and italic.

- It **replaces** the ribbon, never stacks with it. The ribbon maps where you
  are in a SONG; this maps where you are in the SET. Two maps competing for one
  glance is worse than either alone.
- Only `SetlistReader` can build it — the Reader knows one song — so it arrives
  through an `underBar` slot.
- Element 1 said the top bar takes no customization. This is **the one
  exception**, asked for by name. The bar itself (menu · title · key · exit) is
  still fixed; only what hangs under it changes.

### 13 — The finale

**One screen for both kinds** (`ReaderFinale`), in place of `LiveFinale` (246
lines) and `PracticeFinale` (252) — which were ~80% the same file, with
`formatDuration` and `StatGrid` duplicated verbatim and the copy already drifting
apart. What genuinely differs between a service and a practice is small enough to
be a lookup table: the phrase, the badge, one section, and which note it writes.

First, the measured fact: **the finale was already wired to the reader and was
lying.** `App.jsx` routed `SetlistReader`'s `onFinish` to the finale, but the
reader passed `{ songCount }` and nothing else — so Time read **0s**, Songs read
**1/N** however far you got, and the key/cue counts and "what changed" list were
permanently empty. That was a live bug behind the flag, not a missing feature.

- **It is ONE screenful and the page never scrolls.** Root is a flex column:
  header · a middle that is the only scroller (and only when it must be) · the
  buttons pinned below. This is the shape, not a detail of it.
- **Two buttons — View setlist, Home — always on screen**, outside the scroller.
  The way off this screen must never be something you scroll to find.
- **"Run it again" was cut.** Finishing a set and immediately restarting it is
  not a thing that happens.
- **Time is the only stat, on a meta line, not a tile** — with the date and
  location when the setlist carries them. Songs-reached, breaks-crossed,
  key-change and cue counts were all cut: each is tracking code maintained across
  a whole session for a number nobody acts on.
- **"You served with" is live-only** and reads `team_schedules` — the schedule,
  not the session, so it needs no tracking. Unavailable members are left out.
- Wake lock is still not acquired: the finale lives off-stage.

> ### ⚠ This screen took THREE cuts. Don't re-add what came out.
> **Cut 1** put Time in a lone `w-fit` card in a tall `max-w-2xl` column with both
> other sections conditionally hidden — a headline, one floating card, a textarea
> and three buttons. The owner said it felt empty, and it did.
>
> **Cut 2** answered that by adding **"What you played"** — the whole running
> order, numbered, with the key each song was read in. It filled the space and
> made it *worse*: *"too much scrolling going on. Maybe the what you played was
> not a good idea."* The payload feeding it (`session.played`) was removed with
> it rather than left as dead weight, so `onFinish` sends `{ startTime }` alone.
>
> **Cut 3** dropped the reflection box too — not for layout, but because a
> leaders-only note needs somewhere for leaders to *read* it later, and that
> surface does not exist. Building the writing half first was the mistake.
> Deferred in `PLAN.md` → Team; the code and its (never-applied) migration are
> recoverable from git.
>
> **What is left is the shape to keep.** The lesson is not about how much is on the
> screen — it is that **the finale is a full stop, not a page to read.** Both
> failures came from treating it as a page: first a sparse one, then a long one.
> One screenful, no page scroll, both ways out always visible. If it ever feels
> empty again, more content is not the answer.

---

## The hub view — the reader's other face

**The Song Hub is its own thing, and nothing configures it.** Owner, 2026-07-30:
*"the song hub is a separate entity which only renders the lyrics and the chords,
that's it… I don't want any changes, like themes and stuff like that, we need to
disconnect it."*

`resolveReaderConfig(settings, { embedded: true })` **ignores `settings`
entirely** and returns `HUB_VIEW` — a fixed look defined in `readerConfig.js`.
No chart theme, no Aa setting, no chart-style override reaches it.

Four surfaces share that one face: the **Song Hub**, the **editor preview**, the
**side peek**, and (flag on) the editor's read-only display. What you see while
editing is what the song page shows.

Why it had to be disconnected: two surfaces sharing one settings store is what
let a toggle flipped in one place silently change the other. The Chart tab
turning into a second Lyrics tab was exactly that, and it cost several rounds to
find. **If the hub ever needs to be adjustable, give it its OWN store — do not
reconnect it to the reader's.**

The Aa menu still exists and still edits the READER's settings, which is what
you see full-screen. It no longer has any effect on the hub.

---

## Not yet designed

### The elements nobody has named yet

Written 2026-07-30, for the element-by-element pass. Elements 1–13 covered what
a chart *shows*. Most of these are about what happens when something goes
**wrong**, or when the room changes — and those are the moments a musician
remembers. Numbered from 14 so they can be worked the same way as the rest.

| # | Element | Why it matters | Cost |
|---|---------|----------------|------|
| 14 | **Nothing to show** | A song with no sections, a setlist item whose song was deleted, a chart that failed to parse. Right now: a blank reader. On a Sunday a blank screen is indistinguishable from a crash. | S |
| 15 | **The first paint** | What is on screen between opening the reader and the song being ready. A flash of empty chrome reads as broken on a slow phone. | S |
| 16 | **The room changed** | Rotate the tablet mid-song. Columns reflow, the section you were on moves — do you keep your place? This is the ONE job, and rotation is the easiest way to break it. | M |
| 17 | **The screen went to sleep** | Deliberately not ported. Still the single most common real-world complaint about any chart app. Needs a decision, not just a wake lock. | S |
| 18 | **Coming back** | You leave the reader mid-service (a call, a notification, the app is backgrounded, the tab is discarded). Do you return to song 5 where you were, or song 1? | M |
| 19 | **Capo** | The chart shows sounding chords; a capoed guitarist wants shapes. `capo` is on the arrangement and the reader currently ignores it. Element 11 already ruled it out for diagrams — the chart itself is undecided. | M |
| 20 | **Auto-scroll** | Genuinely absent from the whole app, and the feature most competitors lead with. Either decide it's not wanted (defensible — a section-anchored reader may not need it) or design it. | L |
| 21 | **Arrangement switching in the reader** | The hub can switch arrangements; the reader can't. Mid-rehearsal "let's do the short version" has no answer. | M |
| 22 | **The three note levels, on stage** | Element 4 is the band cue, element 5 the inline note. Arrangement notes and private notes (`team_notes`) have **no home in the reader at all** — they exist and are invisible where they'd be used. | M |
| 23 | **Getting the chart out** | No print/PDF entry point from the reader. Someone asks for it after the service and you have to leave and go find the song. | S |
| 24 | **Reading at a distance** | The stand is a metre away. Not the same problem as "big text" — it's contrast, weight and line spacing together. Older musicians are the ones who'll say so first. | M |
| 25 | **Follow the leader** | The leader jumps to song 5 or repeats the bridge; the band is still on 4. Realtime already exists (`team_schedules`, the publication). This is the biggest *feature* left, not the biggest *fix*. | XL |
| 26 | **Reachability** | Where controls sit for a thumb on a phone held one-handed while the other hand plays. Everything currently lives at the top. | S |
| 27 | **Offline in the reader** | Cover art, the YouTube track, chord diagrams — all fail differently with no signal. Element 12's track already needs it. | S |

**On defaults:** every element above has a default whether or not anyone chose
it. That is what tomorrow's pass is for — most of these are cheap if decided,
expensive if discovered on a Sunday.

#### Two more, promoted to elements — 2026-08-04

Both already exist and both were being polished as *part of* element 1, which is
how element 1 took eleven rounds. They are surfaces with their own decisions, so
they get their own numbers and their own passes.

| # | Element | Why it is its own element | Cost |
|---|---------|---------------------------|------|
| 28 | **The ☰ menu** | Owner: *"we go the ☰ menu and we make it look and work properly? Don't you think that ☰ should be an element in its own right?"* — yes. It is the reader's only settings surface, it is `ReaderMenu` standalone but `AaMenu` embedded (two menus behind one glyph), and "The ☰ menu — what actually belongs in it" below is a whole section of undecided content with no pass to land in. **Next.** | M |
| 29 | **The setlist rail** | Shipped as a persistent strip on 2026-08-04 (below) and that is where it stops for now — owner: *"it will require some work in the future. Not quite now."* Open: what it looks like on a phone beyond the bottom sheet, whether it shows keys/durations/who-plays-what, what it does in a break, and whether it is the same object as element 8b's set bar or a rival to it. | M |

#### What the owner decided, 2026-07-31

Answers to the table above, in the owner's words, with what each one means for
the build. Where the answer was a question back, the reply is under it — those
are **still open** until confirmed.

**14 — Nothing to show.** *"this should not happen. What do we do in this case?
Recover from trash?"* → **Yes — and the trash already exists.** Deleted songs go
to a 30-day recoverable bin (`storage.js` `loadTrash`/`saveTrash`, restored from
Settings → Data). So the missing-song screen can do the real thing: look the id
up in the trash and offer **Restore** right there, falling back to Skip / Remove
from setlist when it genuinely isn't recoverable. That is the whole element, and
it's cheap.

Two cases, two screens:
- **Missing** (a setlist item whose song is gone) — the title from the setlist
  item, why it isn't there, Restore / Skip / Remove. `SetlistReader` already
  flags `isMissing` but hands it to `BreakScreen`; it needs its own screen, not
  a break's.
- **Empty** (a real song with no sections) — "This song has no chart yet" + Edit.

**15 — The first paint.** *"I don't know, what do you think?"* — and, 2026-08-01,
*"if is needed, skeletons?"* → **Not needed. No skeletons.** Paint the
chrome you already know, never a spinner. Opening a song from a list means the
title, artist and key are already in hand, so the top bar renders instantly and
only the chart area is pending — and it should be blank, not skeleton-shimmered:
a shimmer that resolves in 40ms is a flash of fake content. On the phones this
runs on, parsing is single-digit milliseconds, so in practice **nobody sees a
loading state at all**; the rule exists so a slow case degrades to a partial
page rather than an empty one. Cheap, no decision cost. **Proposed default:
top bar immediately, chart when ready, no spinner under ~300ms.**

**16 — The room changed.** *"I think that by default screen lock should be off.
Maybe we can do what Google Pixel does and show a rotate screen in the bottom
left?"* → Two things. (a) **Rotation lock off by default** — the reader follows
the device. (b) A **Pixel-style rotate button**: when the device orientation
changes but the OS has rotation locked, a small floating button appears bottom-left
offering to rotate this screen anyway; it fades after a few seconds. That is the
Pixel behaviour exactly, and it is the right one — it never rotates under you,
it offers. Keeping your place across the reflow is the other half and is
non-negotiable: anchor on the **active section**, not scroll offset.

**17 — The screen went to sleep.** *"If the screen went to sleep in the live or
practice, the app should keep the timer and position for when the user returns
(eg sermon). The same should be done if a user leaves the app (but not closes
it) and then returns."* → Session state (index, transpose, `startTime`, the
practice row's state) survives sleep and backgrounding. Sleep is free — the tab
is still alive. Backgrounding is not: iOS discards tabs, so this needs the state
**persisted**, not just held in React. Same mechanism as 18.

**18 — Coming back.** *"It should go from where it left"* → One rule, both
elements: the reader restores the session. Persist `{setlistId, idx, keys,
startTime}` on change; on mount, restore if the setlist matches. Needs an expiry
(a Sunday-morning session should not restore on Tuesday) — **proposed: same
calendar day.**

**19 — Capo.** *"Yes, we need to do something with capo, right now its not
working"* → Confirmed as a real gap and in scope. The chart shows **sounding**
chords; a capoed guitarist reads **shapes**. Both are legitimate and they are
different renderings of the same chart, so this is a toggle, not a setting to
get right once.

**20 — Auto-scroll.** *"Can we try a basic version of this? ... It should be
somehow synced automatically with the song bpm?"* → **Deferred, 2026-08-01.**
The bpm link was the right instinct, but bpm alone can't know a song's length in
bars, so a bpm-derived rate drifts unless the chart says how long each section
is — the same `.md` format change that killed section loop. The fallback was a
speed the user sets, and the owner killed that on the spot: *"a speed per song?
We have 7-10 songs per setlist, not cool to set the speed for each song."* He's
right — a per-song knob in a 10-song service is nine chores. It comes back when
sections carry lengths, and not before.

**21 — Arrangement switching.** *"This should be for the practice view"* →
Scoped to practice. Not in live.

**22 — Notes on stage.** *"Yes, notes are needed, especially for the practice
view, right now you cannot take any notes during practice"* → The gap is
**writing**, not just reading. Practice needs a way to capture a note as it
happens ("watch the turnaround"), which is `team_notes` (private, per-user) —
the table and hook already exist and have no UI in the reader.

**23 — Getting the chart out.** *"Is it really needed from inside the reader in
a live/practice environment? It can be done from the setlist hub"* → Cut. Print
lives in the hub. (Also the cheapest element on the list to un-cut later.)

**24 — Reading at a distance.** *"A cool idea here is to do the stage version
from the earlier mockup ... only show full screen of the lyrics and chords - we
strip everything out and it's controlled with pedal?"* → This is a bigger idea
than the element: a **stage view** — chrome stripped to nothing, lyrics and
chords only, pedal-driven. It overlaps the full-screen question below (option 1
says full-screen IS the reader; this says there is a fourth, barer thing). Needs
its own pass.

**25 — Follow the leader.** *"Yes, this would be cool to have. Is it hard to
do?"* → The transport is already built — realtime is published for
`team_schedules`/`team_availability`/`team_notifications`/`team_activity`, and
adding one more table is a one-line migration. Broadcasting "leader is on item
3" is genuinely easy. What makes it XL is everything around it: who is the
leader, what happens when two people claim it, what a follower can still do on
their own screen, what happens when a follower's copy of the setlist differs,
and what happens when the signal drops mid-service (the worst case: half the
band frozen on song 4 because the leader's phone lost wifi). **The mechanism is
a day; the failure modes are the feature.** Not before the reader is finished.

Then, 2026-08-01: *"Can we do a beta test to the follow-the-leader and we can
decide later the other stuff?"* → **Yes, and that's the right shape for it** —
the failure modes above can't be reasoned out from a desk, they have to be felt
in a room. The testable slice: the leader broadcasts "I'm on item N"; a follower
moves with it, sees a visible **Following** state, and can break away in one tap
that sticks. Nothing else — no role negotiation, no conflict rules, no offline
queue. It answers the two questions worth answering first: does the latency feel
right in a room, and does anyone actually want to be moved. Everything else on
the list stays deferred until it does.

**26 — Reachability.** *"the phone/tablet usually sits on a stand ... What's
your point?"* → Fair — the point doesn't hold for the stand case, which is the
common one. It only applies to the phone-in-hand case (a vocalist, someone
checking a chart between songs), and on a phone the ☰ sheet already comes up
from the bottom where the thumb is. **No separate element; folded into the ☰.**

**27 — Offline in the reader.** *"How do we handle this? How do we handle
massive libraries of songs/setlists in the cache? One idea that I have is that
we only keep the upcoming setlists?"* → Two different things, and it's worth
separating them because one is already solved. **Song data** is not a cache
problem: songs are markdown in IndexedDB and a 1,000-song library is a few
megabytes — it all fits, and it is all offline already. What doesn't fit is
**media**: cover art and YouTube. Those are the things that fail with no signal,
and those are what the "upcoming setlists" rule should govern. So: keep every
song, keep art for the songs in the next N setlists, and let everything else
fall back to a placeholder. The reader's job in element 27 is narrower still —
**fail visibly and calmly**: no broken image, no dead play button, a track
control that says "needs signal" instead of spinning.

### Still open from earlier elements

| # | Element | Notes |
|---|---------|-------|
| — | Count-in, section loop | Cut from element 12 round 1. A loop needs per-section bars/timestamps — an `.md` format change |
| — | Wake lock, session stats | Carried by the old views; not ported on purpose |
| 8b | Setlist bar | Shipped, needs a rework pass (owner, 2026-07-30) |
| — | **Full-screen from the hub** | ✅ Shipped 2026-08-01 as option 1 — `FullscreenReader` mounts the Reader itself. The old `FullscreenChartViewer` stub survives only on the flag-off path |

### Full-screen from the hub — three ways, decided ✅

`FullscreenChartViewer` is a WIP stub: no ☰, no hub chrome, connected to
neither surface. The owner, 2026-07-30: *"it's a lot of work, pff."* The three
honest options:

1. **It IS the Reader, single-song.** `SetlistReader` minus prev/next. One
   renderer, one menu, one set of decisions — and every element already built
   arrives for free. The reader has to handle a one-song "set" anyway.
   **Cheapest and the one that stops the drift.**
2. **It is the hub view, bigger.** Same fixed look, no controls, just larger.
   Trivial to build, but then the app has a full-screen mode you cannot change
   anything in, which is the opposite of why people go full-screen.
3. **It is Practice.** Full-screen means "I'm working on this song", so give it
   the click and the track. Coherent — but it makes full-screen a *mode* rather
   than a size, and the owner has been consistently against modes.

Recommendation: **1**. The hub view exists to be uncustomizable; full-screen is
where you want the opposite. Making full-screen the Reader also means the ☰
built for the reader serves it, instead of needing its own.

A fourth appeared on 2026-07-31 with element 24: a **stage view** — everything
stripped, lyrics and chords only, pedal-driven. It is not a rival to option 1 so
much as a *setting inside it*: if full-screen is the Reader, "strip everything"
is a top-bar/nav/ribbon combination the Reader can already express. Build option
1; make stage the preset it reaches.

#### The flashbang ⚠️

Owner, 2026-07-31: *"the leader searches for a song at night and the reader is
set to light mode and presses full screen and bang flashbang."* Real, and it is
an argument **against** letting full-screen inherit a stored theme blindly. The
hub view deliberately follows the app theme (see "The hub view"), so a dark app
at night is dark right up until full-screen swaps in the reader's own light
setting. Whatever full-screen becomes, the transition must not raise the
brightness of the screen without the user asking for it in that moment. The
cheapest correct rule: **full-screen opens in the theme you were already
looking at**, and changing it is a deliberate act inside the ☰ — the reader's
stored theme applies to the reader, not to a surface you arrived at from
somewhere darker.

### The side peek — opens the hub, in the peek ✅

Owner's idea 2026-07-30, decided 2026-07-31: *"I do believe that the side-peek
should open the song hub but in the side peek. And we need to optimize the modal
so that the mouse is outside so the user could easily click outside to exit."*

So: the peek renders the **full song hub**, not a reduced preview — one surface,
not two. And it stays a peek: dismissible without leaving the list. The second
half is a real constraint on its geometry — the panel must not sit under the
cursor that opened it. Opening from a row on the left means the peek is on the
right and **narrower than the space left over**, so the pointer is already
outside it and a click anywhere dismisses. (This is the same note as the
"shorter than the row it opened from" idea in `PLAN.md`, generalised: it isn't
about height, it's about the pointer never being captured.)

### The ☰ menu — what actually belongs in it
*(This is **element 28**'s brief — see "Two more, promoted to elements". It is
the next pass.)*

The owner's constraint: *"there would be more options than just the visual."*
So it is not an Aa menu with a new coat of paint; it is **the reader's one
menu**, and Aa is one section of it. Candidates, roughly in order of how often
they'd be reached for:

1. **Display** — what Aa holds today (text, chords, columns, sections, repeats)
2. **Practice** — the click and the track, promoted out of element 12's row
3. **Jump to** — the section list, for when the ribbon is off or the song is long
4. **This song** — transpose, capo, arrangement, notation
5. **Fix it** — the fast correction the owner keeps asking for (§7 #12); the
   "is this a correction or a new arrangement?" question lives here
6. **Notes** — band cue · arrangement note · my note (element 22 above)
7. **Get it out** — print / PDF / share
8. **The screen** — keep awake, distance mode, brightness
9. **Who's playing** — my instrument for this service (drives element 9's tabs)

**Shape:** sheet on a phone (detented so the chart stays visible above it),
popover anchored to ☰ on a desktop. Apple splits by size class the same way —
sheet on iPhone, popover on iPad/Mac — and it satisfies the panel rule (never
cover what it changes) better than one popover forced onto both.

#### Concept, 2026-07-31

Drafted as a clickable page (published artifact, "The ☰ menu — concept"). What
it settles and what it leaves open:

- **Nine rows in three groups** — *Reading* (Display · Jump to · The screen),
  *This song* (This song · Practice · Notes), *Other* (Fix it · Who's playing ·
  Share). The grouping is what makes nine rows scannable; ungrouped, nine is a
  list you read rather than a menu you aim at.
- **Every row carries its current value as a subtitle.** The menu answers "what
  is it set to" without being opened twice.
- **One level of drill-in**, with a back arrow. No nesting past that.
- **Both shapes drawn against a real chart** — the phone sheet detented so the
  chart shows above it, the desktop popover beside it. The panel rule is the
  reason the concept draws the chart at all.

Two calls in it are arguable and are the owner's to make:
1. **Nine rows.** Defensible because they're grouped, but it is the most the
   shape can carry.
2. **Practice moves into the ☰**, out of element 12's bottom row. That changes a
   shipped decision — element 12 put the click and the track *on the chart* so
   they're reachable mid-song. Moving them costs that. The middle path: the row
   stays, and the ☰ entry opens its options.

#### Cut down to four, 2026-08-01

The owner's verdict on the concept: **too big**, and — the sharper objection —
*"this new menu will require multiple clicks/taps for something that is
currently achieved with only one."* That is the real constraint, and it kills
rows rather than shrinking them. What survives:

| Row | Holds |
|-----|-------|
| **Display** | two tabs: **Look** (themes, colours, sizes, line spacing, section gap, fonts, and every tab control — grid resolution, size, string/number colour, background) and **Layout** (columns 1/2, setlist rail, navigation controls, structure ribbon + position, under-the-top-bar, section heading + style, repeated sections, and chords/lyrics-only kept small as an emergency lever) |
| **The music** | opens on **who's playing**, because that is the master switch the rest hang off — then capo, chord names, accidentals, arrangement |
| **Notes** | band cue · arrangement note · my note, in one place. Writable, not just readable |
| **The screen** | keep awake · rotate |

**Tabs inside Display are fine** — that was the owner's question, and the answer
is that Aa already ships three (Page / Lyrics / Chords), so a tabbed panel is
the pattern the app has, not a new one. Two tabs replace the current three.

**Cut, with reasons:**
- **Jump to** — the ribbon already does it, and with the ribbon off, scrolling
  is faster than opening a menu. Conceded; no counter-argument worth the row.
- **Share / get it out** — print lives in the hub (element 23).
- **Practice** — stays an **icon in the top bar**, exactly as element 12 shipped
  it. This resolves the concept's second arguable call in favour of the existing
  decision: one tap, mid-song, is the whole point of it.
- **Fix it** — the concept read it as a menu row; the owner means something
  else entirely (*"press a button and a mini editor for each part opens"*).
  That is an **icon beside practice**, not a ☰ entry, and it is its own element
  — see §7 #12 in `PLAN.md`. Removed from the menu.

**Accidentals moved out of Display** on purpose: it is about how the music is
*spelled*, not how the page *looks*. It belongs with capo and chord names.

**"Who's playing" folded into The music** rather than kept as its own row, and
this is a real combination, not filing. The owner's own case for it — *"you can
change to vocals and not have chords, or to bass and not have capo"* — says the
instrument is the thing the other controls are downstream of. So The music opens
on it, and capo/chords/notation read as its consequences. (Per-user, per-setlist,
per-instrument capo is a later want; noted, not built.)

Result: **three rows, one drill-in level** (four, until *The screen* was cut in
round 2), and the top bar keeps ☰ · practice · edit · exit — so nothing that was
one tap becomes three.

#### Round 3 — Look and Layout come to the surface, 2026-08-01

- **No header on the root.** The mockup's root is a list, not a page. The song
  title was in it, and the top bar two rows up already says the title (owner:
  *"why do we have the song name in the title?"*). A panel still gets back + its
  own name; closing is the backdrop, Escape, or the ☰ again.
- **Look and Layout are top-level rows**, not tabs inside a Display panel
  (owner: *"because we have space, maybe we can do look and layout as different
  outside tabs?"*). Four rows: **Look · Layout · The music · Notes**. The two
  most-opened panels are now one tap rather than two, which is the same
  principle that cut the menu from nine rows in the first place.

#### Cut again, and rebuilt to the mockup — 2026-08-01 (round 2)

Owner on the first build: *"this is a bit overwhelming. please make it look
exactly like the mockup but with our colors."*

- **Three rows.** *The screen* is cut — keep-awake already lives in Settings
  (and the reader now honours it), and a row holding one switch is a row
  holding nothing.
- **The row shape was the problem.** The build had a two-line card with a
  bordered icon tile; the mockup has a single line — glyph · label · current
  value right-aligned in mono · chevron. The card version made three rows
  occupy the height of eight, which is where "overwhelming" came from.
- **Panels are `Field` blocks now**: a 10px mono uppercase label over a row of
  small segmented pills, per the concept. Font pickers went from a 44px-per-row
  bordered list to pills — that list alone was most of the Look tab's height.
- **Geometry is the mockup's, colours are ours.** 296px popover, 18px sheet
  radius with a grab handle, 27px steppers, `5px` seg gaps.

**The overflow-on-the-right fix** was two real bugs, not styling:
1. The clamp measured `window.innerWidth`, which **includes the scrollbar**, so
   the popover was allowed to extend under and past it.
   `document.documentElement.clientWidth` is the honest number.
2. The phone/desktop threshold was 640px. Between 640 and 700 the popover was
   wider than the room beside the ☰. It is 700 now, plus a hard
   `maxWidth: calc(100vw - 16px)` and `overflow-x: hidden` on the body so a
   wrapping seg row can never widen the panel itself.

#### Built, 2026-08-01 — `src/features/reader/ReaderMenu.jsx`

Shipped as designed above. Notes worth keeping:

- **The hub still opens `AaMenu`.** Standalone, ☰ opens `ReaderMenu`; embedded,
  the host passes an `aaAnchor` and that path is unchanged. Giving the hub the
  reader's menu would reconnect the two surfaces that "The hub view" above
  deliberately disconnected. `AaMenu`'s **Visual tab is gone** — those were
  reader-only options and they live in Display → Layout now.
- **The role picker writes real settings.** Picking *Vocals* writes
  `displayRole: 'vocalist'` AND `displayMode: 'lyrics'`, visibly. It is not a
  layer that overrides the display panel from underneath — that shape is
  exactly what turned the hub's Chart tab into a second Lyrics tab, and it cost
  several rounds to find. Both keys are in `PORTABLE_PREF_KEYS`.
- **Capo tells the truth.** The row shows the arrangement's capo and says the
  chords below are *sounding*, because that is what they are. A knob that did
  nothing would be worse than the gap. Element 19 is the real work.
- **Notes are read-only for now** — the arrangement note plus every band cue,
  in one place, which is what "see them all in a place" asked for. Writing one
  is element 22 and needs the practice surface.
- **`Reader` now takes `mode` ('live' | 'practice')**. See "The five views"
  below — this is the prerequisite the practice-only elements were missing.
- Shared controls moved to `src/ui/PanelControls.jsx`; `AaMenu` imports the
  same ones, so the two panels cannot drift.

#### Element 28, round 1 — the shell, 2026-08-04

**What the ☰ actually was, measured before anything was designed.** The earlier
note here said "two menus behind one glyph". Not quite: standalone it is a
three-line **☰**, top-**left**, opening `ReaderMenu`; embedded it is the literal
text **"Aa"**, top-**right** of the hub's tab header, opening `AaMenu`. Two
glyphs, opposite corners, the **same `aria-label`** ("Display options"), and two
menus whose contents barely overlap.

**And with the flag on, most of the hub's Aa is dead.** `resolveReaderConfig`
returns `HUB_VIEW` with `display: resolveChartDisplay(null)`, and `hubSurface`
re-points `--chart-bg/-text/-subtle/-rule` back at the app tokens. All twelve
controls, checked:

| Dead | Alive |
|---|---|
| Show (the hub passes `displayMode` as a prop, it wins) · Notation · Columns · Lyric size · Chord size (both **visibly stuck** — the stepper reads the fixed 18/17 and the number doesn't move) · Lyric colour · Theme's bg + text | Lyric font · Chord font · Chord colour · the theme's **chord** colour · Sharps/flats |

Plus `Reader` passes neither `onReset` nor `onAdvanced`, so the hub's Aa also
lost the per-tab Reset and the Advanced dialog that `ChartView` still has.

**Owner's call: leave it.** *"right now we are trying to improve the reader
views not the hub, so note it for later in the plan."* → `PLAN.md` §1.2. **Do
not** fix it by reconnecting `HUB_VIEW` to `settings` — that is the bug that
turned the hub's Chart tab into a second Lyrics tab.

**Three shell decisions, all the owner's, all shipped in `0.17.0-beta.61`:**

1. **The ☰ wears the READER theme.** It portals to `document.body`, so it
   inherits nothing from the reader's subtree and came out app-coloured with
   `--chord` and `--chart-text` (both set on `:root` by `useChartTheme`) leaking
   into it — a dark panel with cream details, or the reverse. It carries the
   remap itself now: **`chartOverlaySurface`** in `readerSurface.js`.
   `chartSurface` alone is not enough — a panel reads three tokens the chart
   body never does (`--ds-background-100`, `--border-2` via `--ds-gray-500`,
   `--ds-gray-600`) and needs `--bg-2` to be a **wash** rather than the chart's
   own background, or every hover is invisible.
2. **No value column on the rows.** They carried the current setting
   right-aligned in mono — `Charcoal · 18px`, `1 col`, `Leading`, `3`. Four
   unrelated kinds of thing in one column, and Layout's was permanently `1 col`
   on a phone because columns are forced to 1 below 768. Owner: *"let's go with
   option (a)"*. A value comes back **per row, when that row earns one**.
3. **The sheet drags, with two detents** (58vh → 90vh). The mockup's grab handle
   had been drawn for two releases and wired to nothing. Two entry points, and
   the difference is deliberate: the **handle zone** drags both ways always; the
   **body** drags only downward and only at `scrollTop === 0` — the same
   "you drag after you cannot scroll anymore" rule as pull-to-finish, so
   scrolling a long panel can never expand it.

**And the Columns dead band, fixed.** The control hid below **700** (the
sheet/popover threshold); two columns only apply at **768** (`Reader`'s `wide`).
700–767 — iPad mini portrait is 744 — showed a switch that wrote a setting
`resolveReaderConfig` then forced back to 1. Owner: *"the hard cut is 768
then."* Lowering `wide` to 744 instead was the wrong lever: it also turns pinned
headings off and moves band cues out to the margin. Three things changed to fix
one.

#### The notes inventory, measured 2026-08-04

The owner on the Notes row: *"I don't really know what does the notes option
really does there because it feels empty."* It is, and here is why. **Six note
levels; the reader shows two.**

| Level | Lives on | In the reader | Edited from |
|---|---|---|---|
| Band cue (`> text`) | `section.note` | ✅ under the heading | Write tab; the reader's edit mode |
| Inline note (`{!…}`) | mid-line | ✅ inline | Write tab only |
| **Arrangement note** | `song.notes`, 200 ch | ❌ **only in the ☰ Notes panel** | Editor → Metadata; hub → Details |
| **Setlist item cue** | `items[i].note`, 100 ch | ❌ **nowhere** — `SetlistReader` passes `note` to `BreakScreen` only | Setlist builder |
| Break note | `items[i].note`, 500 ch | ✅ on the break screen | Setlist builder |
| **Private note** (`team_notes`) | per-user | ❌ **no UI at all** — `NotesStack`/`usePrivateNotes` are imported only by `PerformanceView`/`PracticeView`, which the flag deletes | nowhere |

So the panel's content is: the one thing with no other home (the arrangement
note, one paragraph, two taps deep) plus a re-listing of the band cues that are
**already on the chart**. The editor's own hint for that field — *"Shown to the
band on the chart and in live view"* — is currently false.

**Owner's direction:** *"My whole idea with notes its to have them in the reader
so users could read them"*, and the write affordances *"next to the lyrics and
next to the section header for the band cue"*. That is element 22's substance,
and it will change what the Notes ROW becomes — probably a jump-list, not a
reader. Decide it when the Notes row comes round.

**Two live knobs with no control anywhere** (owner: *"where do we have these
buttons, because I cannot see them"* — nowhere): `readerNotes` (band cues +
inline notes on/off, `ReaderSection.jsx:367,409`) and `readerFooter` (`count` →
`← 3/9 →` vs `next` → `← 3/9 · Next Song (G) →`, `SetlistReader.jsx:160,178`).
Both wired, both in `PORTABLE_PREF_KEYS`, both permanently at their defaults.
Open: do they get rows, or does the default become the answer and the knob go?

#### Element 28, round 2 — tabs, and the panel stops covering the song, 2026-08-04

**Three tabs: Style · Layout · Music.** Owner: *"let's go with the tabs"*. This
supersedes round 3's "Look and Layout are top-level ROWS" — the argument for
that was one tap instead of two, and tabs are **zero**: the ☰ opens straight
into a panel. Round 1's row cleanup had also left the root a full phone-width
row with ~330px of nothing in the middle of it (*"a bit too wide now?"*), and
tabs delete that page rather than narrowing it. `AaMenu` already ships the
control, so it is the app's pattern and not a new one.

**"Look" → "Style"**, at the owner's request (*"Look (again, a better name
here)"*). It pairs with Layout — Style is how the page is PAINTED, Layout is
where things ARE — and matches Settings → Chart Style, the same concept one
level up.

**Notes left the ☰.** Owner: *"The notes will go in the rail, we will make a
space there for notes… maybe we have a switch there between order/notes"* →
element 29, with the notes rework at 5/6/22. ⚠ **Two things this costs, both
deliberate and both open:** `song.notes` now appears NOWHERE in the reader (that
panel was its only appearance), and the rail only exists inside a setlist — so
full screen from the hub has no home for notes at all.

**The phone shape: a PUSH-DOWN panel, not a sheet.** Owner: *"is a sheet the
best option we have for mobile? We already hide half of the screen with it"* and
*"do the best and let's experiment"*. The sheet was mockup geometry, never a
decision, and its 58vh cap was written up as being "for exactly the reason" of
keeping the chart visible — a cap that admits the shape was fighting the panel
rule rather than serving it. The panel now renders **inside the reader's sticky
header block** (`ReaderTopBar`'s new `panel` prop), below the song map:

- The chart is displaced, never covered. No scrim, no modal, scroll position
  untouched.
- **No backdrop, deliberately** — a full-screen catcher would swallow element
  11's chord taps on a chart that is still visible and still meant to work.
  Closing is the ☰ again, Escape, or the handle.
- The handle is on the **bottom** edge and drags **up**: the panel came down
  from the top bar, so the way out is back the way it came.
- Capped at 46vh, not fixed — Style is ten fields and Music is four.
- The threshold is 700px (popover above), the same number and for the same
  reason as before: 640–700 is where the popover was wider than the room beside
  the ☰.

**The detents went with the sheet**, and so did the round-1 gesture. Owner on
it: *"it really drags, and it feels strange because it blocks and drags a bit"*
— correct, and the cause was the rubber band: the panel moved at half thumb
speed, hard-stopped at 80px, then jumped to a detent on release. Four behaviours
in one gesture. The push-down handle tracks 1:1 in the direction that closes it
and cannot block.

**One node, two mount points.** `Reader` builds the menu once and mounts it
either into `ReaderTopBar`'s `panel` (phone) or through the portal (desktop), so
the two shapes cannot drift into two menus. `SetlistReader` does the same for
the break and missing-song screens via a `menuPanel` prop.

> **The test width mock was lying.** `reader.test.jsx`'s `mockWidth` returned
> ONE boolean for every media query. That was fine while the reader asked a
> single question ("am I wide?") and became wrong the moment this round added a
> second — a desktop mock answered `true` to `(max-width: 699.98px)` too, so the
> desktop tests were exercising the phone shape. It answers per-query against a
> real width now. Any new breakpoint needs the same check.

#### Element 28, round 3 — the sheet comes back, smaller, 2026-08-04

**The push-down panel lost.** The owner tried both shapes on the device:
*"I think I like the sheet more, but maybe not that big?"* So round 2's inline
panel is **deleted**, not kept as a second shape — along with `ReaderTopBar`'s
`panel` prop and the `menuPanel` plumbing through `BreakScreen` /
`MissingSongScreen` / `SetlistReader`. A shape nobody picked is debt.

Worth keeping from that round, since the argument still stands and may come
back for something else: pushing down obeys the panel rule by construction, and
the sheet's old 58vh cap was written up as being there to keep the chart
visible — a cap that admits the shape is fighting the rule. The owner's answer
is that the sheet is fine if it is simply **smaller**.

- **Fixed `height: 44vh`, not `max-height`** (owner: *"fixed length and scroll
  inside"*). Two things this buys, and they are the reason to prefer a fixed
  height to a cap: the chart above never moves when you switch tabs, and Style's
  ten fields and Music's four occupy the same box instead of the sheet jumping
  between them. The body is `flex-1 min-h-0 overflow-y-auto` — **without
  `min-h-0` a flex child refuses to shrink below its content**, and the sheet
  grows past its own height instead of scrolling.
- **The handle drags DOWN**, 1:1, past 72px. No detents, no rubber band beyond a
  22px hint upward.

**The theme swatch's selected ring was two rings.** A 1px brand *border* plus a
1.5px brand *box-shadow* — 2.5px of one colour at two different corner radii
(the shadow follows the border-box, the border is inset), which is what made the
selected swatch's edge look furred rather than crisp. It is now the same ring
the colour `Swatches` in the same panel already use: a 2px gap in the panel's
own colour, then the brand line. The strip needed padding, because that ring is
drawn OUTSIDE the swatch's box and the scroller was clipping it on the first and
last one.

**The field labels were five signals stacked.** Owner: *"the setting headers are
strange at all"*. They were Geist **Mono**, **10px**, **ALL CAPS**, **0.1em
tracking**, and the **muted** grey. Any one of those reads as "quiet label"; all
five together read as a code comment, and 10px uppercase mono is genuinely hard
at arm's length on a phone. Now: the app's sans at **12px/600, sentence case,
`--text-2`**. Same job, one signal.

> The two typefaces, for the next time this comes up: `--font-sans` is **Geist
> Sans**, `--font-mono` is **Geist Mono**, both variable, both self-hosted.
> Mono in this app means *a number you compare* (keys, tempo, counters) — not
> "small print".

#### Element 28, round 4 — the dock. Three shapes tried, this is the one, 2026-08-04

Owner: *"Crazy idea, what if instead of the sheet we do something strange. We
split the screen in two sections, the reader above and the setting below… 30-70
settings-reader? and there we give the 3 tabs but without the drag, ☰ transforms
into an x?"*

**It is the right answer, and it is worth recording WHY**, because three shapes
were built and tried on the device before this one:

| Shape | Round | What was wrong |
|---|---|---|
| Bottom sheet | 1, 3 | **Covers** the chart, so it had to be capped (58vh, then 44vh) to limit the damage. A cap that exists to stop a panel hiding what it changes is the shape arguing with the panel rule. |
| Push-down panel | 2 | Obeyed the rule — the chart was displaced from the top, not covered — but it put the controls at the far end of the screen from the thumb. |
| **Dock, 70/30** | **4** | Displaces the chart from the BOTTOM. Chart genuinely shorter, never hidden, scroll position kept, controls where the hand is. |

**The structural change that makes it real:** `Reader`'s root USED TO BE the
scroller. It is now an `h-full flex flex-col` with the scroller as a
`flex-1 min-h-0` child, and the dock as a `flex: 0 0 30%` sibling. That is the
difference between a 70% that is true and an overlay pretending — and with no
dock, a lone `flex-1` child of an `h-full` column is exactly the box `h-full`
was, so nothing else moved. `BreakScreen` and `MissingSongScreen` already had
that shape and take the dock through a `menuDock` prop.

**Three things the dock deliberately is NOT:**
- **Not modal — no scrim.** The chart above stays live: element 11's chord taps
  still work while you are changing the type size.
- **Not draggable.** One size, so there is no gesture to learn and nothing that
  can feel "blocked" (round 1's complaint).
- **Not portaled.** See above — the split has to be real.

**The ☰ becomes a ✕** (`ReaderTopBar`'s `menuOpen`), which is the way out now
that there is no scrim and no drag.

> ⚠ **There are now two ✕ in the top bar** — the menu's on the left, Exit on the
> right. Element 1's rule is "nothing goes near the ✕: a mis-tap on the
> right-hand edge leaves the service", and this puts the same glyph at the other
> end meaning something entirely different. Flagged to the owner on delivery;
> the alternatives if it reads wrong are a chevron-down (collapse) or keeping
> the ☰ and lighting it up the way the practice icon does.

#### Element 28, round 5 — the Style tab, and what is free, 2026-08-04

**The ☰ is a ☰ again, and it lights up.** Round 4's ✕ was the owner's first
idea and he reversed it on seeing it: *"let's do the lighting up like the
practice icon"*. Two ✕ in one bar — the menu's on the left, Exit on the right —
put the same glyph at both ends of a bar whose rule is *"nothing goes near the
✕: a mis-tap on the right-hand edge leaves the service"*. It now takes element
12's treatment: `color: var(--chord)` while open. The dock still has no scrim
and no drag, so the button is still the way out; it just no longer pretends to
be an exit.

**Edit closes the ☰** (owner: *"the edit button should overwrite the settings
and close it"*). It already closed the practice strip for element 12's
two-bars-never-three rule. The sharper reason here: the ☰ is **disabled** while
editing, so a dock left open would hold 30% of the screen with no way to shut
it.

**The Style tab, grouped.** Four groups — **Lyrics** (size · font · colour),
**Chords** (size · font · colour), **Spacing** (line spacing · between
sections), **Tabs** (size · grid · colours) — with two controls to a row
(`Pair`). Eleven fields in one column was a list you read rather than a panel
you aim at, which is the objection that cut the root menu from nine rows.

**The controls are `AaMenu`'s** (owner: *"can we use the one from the Aa for the
buttons and +/- and stuff? i think that those look nice"*). `PanelControls`'
own docstring used to say the reader deliberately did NOT use them, because
`ReaderMenu` followed the concept mockup's tighter geometry. The owner looked at
both on a device and picked these; one set of controls for both panels was the
better end state anyway, and the mockup's `MiniStepper`/`Seg` are gone.

**The themes are a carousel with arrows** (owner: *"so users know to scroll"*).
A bare overflow strip with the scrollbar hidden gives no sign there is more than
the three visible.

##### What is free, and what is Pro — agreed 2026-08-04

Owner: *"for the settings we need to decide what we allow for free and what we
lock behind Pro… for the themes we would need a CTA upgrade for more themes"* →
*"i agree with you, do it"*.

| Free | Pro (`chart-style`, = Sync tier) |
|---|---|
| Every **size**: lyric, chord | Full theme set (7 of the 10) |
| Every **spacing**: line height, section gap | Custom **fonts** |
| Tab **size** and **grid** | Per-element **colours** |
| The 3 `FREE_CHART_THEME_IDS` themes | **Tab colours** |

**The principle, and it is the whole reason the line falls there: anything that
makes the chart READABLE is free.** Text size and spacing are an accessibility
floor, not a feature to sell — a musician who cannot read the chart from a
stand is not a conversion opportunity. Taste is Pro.

**The locked state is a CTA now, not a sentence.** Locked themes are **shown,
dimmed, with a padlock**, and the strip ends in an "Unlock N more themes"
button. It used to `filter()` them out entirely: 3 of 10 themes existed on a
free plan and the other 7 did not, so there was nothing to want. Seeing them is
most of the pitch. Tapping a locked one goes to the upgrade screen rather than
silently doing nothing, and each locked field carries an inline **Upgrade** link
(`LockedNote`) instead of `ProNote`'s dead end.

`onUpgrade` is threaded App → `SetlistReader`/`SongHub` → `FullscreenReader` →
`Reader` → `ReaderMenu`. Absent → the lock is stated but not sellable, which is
what every locked control here used to be.

#### Element 28, round 6 — the reader size, 2026-08-04

Owner, on beta.65: *"I love it, the only problem is that everything is way too
small, we need to make everything bigger."*

**The ☰ is read from a music stand at arm's length. `AaMenu` is read on a
browsing screen at reading distance.** They had been sharing one size, and that
size was the browsing one. `PanelControls` now takes **`size`**: `md` (default,
the hub's Aa) and **`lg` (the reader's ☰)** — same shapes, same colours, more of
them. `Pick` 32→44px, `Stepper` buttons 36×32→48×44, `Swatches` 32→40px, plus
the menu's own type (tab strip 32→44px and 12.5→15px, group titles 13→15px,
field labels 12→13.5px), theme tiles 54×30→70×40, arrows, the lock and the CTA.

**And the two pill styles became one.** Style used `Pick`; Layout and Music
still rendered the concept mockup's own `Seg` at 11px with a 5px gap — two pill
styles at two sizes in one menu, which is what round 5 left behind when it
converted only the tab it was working on. `Segs` keeps its call signature and is
built on `Pick` now; the mockup's `Seg` and `MiniStepper` are **deleted**.

> ⚠ **The dock is still 30%, and bigger controls mean fewer of them fit.** On an
> 800px phone that is 240px, less ~57px of tab strip, so roughly **2½ rows**
> before you scroll. The owner picked 70/30 deliberately, so it has NOT been
> changed — but if the Layout pass finds it cramped, the dial is the dock's
> `flex: 0 0 30%` in `Reader.jsx`, and 40% is the obvious next stop.

#### Element 28, round 7 — two colour bugs, and the Style tab's shape, 2026-08-04

##### The two bugs, both in the per-element colours and fonts

**1. The lyric colour was the chart's INK.** Owner: *"lyrics color selections is
changing the reader ui, not only the songs lyrics, it should be separate."*
Exactly right. `useChartTheme` did `const text = settings?.chartLyricColor ||
theme.text` and wrote it to **`--chart-text`** — which is not "the lyric
colour", it is the chart's foreground: the top bar's title, the section
headings, and through `chartSurface` `--text-1`, `--ds-gray-1000` and every
control in the reader's chrome and its ☰.

Fixed by splitting the token. **`--chart-text` is the theme's, always**;
**`--chart-lyric`** is the picker's, defaulting to the theme's text, and only
the lyric spans read it. `hubSurface` re-points it too — a new wire into the hub
is a new wire to cut.

**2. The lyric font never applied in the Reader.** Owner: *"Fonts are not
working right now or at least for the lyrics, for the chords it looks like it
works."* Also exactly right, and the asymmetry is the clue. `SectionBlock` sets
the chord font **on the chord span**, so chords work on every surface. The lyric
font was set on `ChartView`'s own wrapper (`CHART_THEME_STYLE`) — and the Reader
has no such wrapper, so lyrics inherited the app sans and the picker wrote a
setting nobody read. It is on the lyric spans now, where the chord one already
was.

> Both are guarded by tests that read the source, because both are "a value that
> is never consumed" — the kind of bug a render test cannot see.

##### The Style tab's shape

- **The dock is 40%**, up from 30% — round 6 made every control bigger and 30%
  then held about 2½ rows.
- **The tab strip is smaller** (44→36px, 15→13.5px). Owner: *"make the tab
  buttons smaller, they don't need to be that big."* They are pressed once to
  get somewhere, not adjusted, and their height was coming out of the settings.
- **The dock carries its own ✕**, beside the tabs. Owner: *"do we need like an x
  to close the dock… rather than the top one?"* — yes: the dock is at the bottom
  and the ☰ that opened it is at the top, a phone's height from the thumb using
  the panel. The ☰ still toggles; this is the near one. (Note this is NOT the
  round-4 ✕ that was rejected — that one replaced the ☰ in the top bar, opposite
  Exit. This one is inside the panel it closes.)
- **Fonts are a `Select`**, not pills — one row per two fonts was the widest
  block on the tab.
- **Colours are one scrolling line** (`Swatches wrap={false}`) — wrapping, the
  palette was the tallest thing on the tab.
- **Tab colours use the app's palette.** They were `<input type="color">`, which
  opens the OS picker: a different set of colours, a different gesture, and on
  iOS a full-screen sheet over the chart being adjusted.
- **A red ghost Reset per group** — Theme · Lyrics · Chords · Spacing · Tabs.
  Per group rather than per tab, so undoing a font does not throw away a size.
  It clears the keys to **`undefined`** rather than writing a default, because
  every one of them reads `settings?.x ?? default` at the point of use — there
  is only ever one copy of what the default is. It only appears when the group
  holds an override, so the button always does something.

#### Element 28, round 8 — the Style tab, finished, 2026-08-04

**The swatch outline was inside the circle.** Owner: *"every circle has a
strange outline, and it is especially evident at the default color that is
split."* Measured: `Swatches` carried `border: 2px solid transparent` **plus**
`inset 0 0 0 1px`. A background paints under a transparent border, so the colour
filled the whole circle and the hairline landed **2px inside its edge** — a ring
floating within the swatch rather than around it, and on the split "follow the
theme" swatch it also cut across the diagonal. No border now: hairline on the
edge, or the gap-and-brand ring outside. Same ring language as the theme tiles.

**Carousels everywhere, not just the themes** (owner: *"colors require a
carousel as well"*). The arrows are extracted into one `Carousel`, so the theme
strip and all five colour rows use the same control. A bare overflow strip with
the scrollbar hidden gives no sign there is more, and that is as true of ten
swatches as of ten themes.

**Any colour, as the LAST stop** (owner: *"do you think we could allow custom
color as the last option?"*). The fixed palette is the fast path — colours known
to work on the chart themes — and the native well is the escape hatch. Last on
purpose: it opens the OS picker, which is a different set of colours and, on
iOS, a full-screen sheet over the chart being adjusted. Worth it when you need
an exact colour; not worth putting in front of the twelve that already fit.

**The dropdown, three fixes** (owner: *"it opens the default drop-down even if
the rest of the menu is chart colored… the outline of the button is strange…
it should be the exact same size as the size"*):
1. `SelectContent` **portals to `document.body`**, so it inherited the APP
   palette and dropped a dark app-coloured list out of a cream chart-coloured
   panel. It carries `chartOverlaySurface` now — which re-points exactly the
   tokens it reads.
2. The trigger's border was `--ds-gray-400` (the chart's *subtle*, far too
   strong for a field) plus a 2px focus ring. Both toned to `--border-1`.
3. **54px**, which is not a round number: it is what a `Stepper` measures —
   44px buttons + 4px padding each side + 1px border each side. They sit side
   by side in a `Pair`. Change one and change the other.

**The tab grid is a dropdown too** — `1/4 · 1/8 · 1/16` needs ~220px as pills
and has half a phone-width column.

**Reset moved from per-group to per-OPTION.** Owner: *"do you think that we do
the reset per section or per option? maybe the user just wants to reset the size
not the font and color."* Right — a group reset charges you for the settings you
were happy with. It lives on the `Field` label, appears only when that one key
holds an override, and clears to `undefined` so the default stays defined in
exactly one place (the `settings?.x ?? default` at the point of use).

**The tabs moved to the BOTTOM — in the dock only.** Owner: *"what do you think
about moving the tabs at the bottom and making them even smaller?"* On a phone,
yes: the dock is already the bottom of the screen and the strip is the one thing
in it you reach for repeatedly, so it belongs on the edge nearest the thumb.
**That reasoning does not transfer to the desktop popover**, which hangs UNDER
the ☰ that opened it — there the nearest edge to the pointer is the top, and the
strip stays there. One `head`, two positions.

#### Element 28, round 9 — the Style tab closes, 2026-08-04

**"Between sections" was moving the lyrics apart too.** Owner: *"I think that
between sections also increases the distance between lyrics, can you make sure
it only does for the sections?"* Measured, `SectionBlock.jsx`: a **line's**
bottom margin was `calc(var(--chart-section-gap, 24px) / 3)`. So taking the
section gap from 24 to 48 took every line inside every section from 8px to 16px.
It has its own token now, `--chart-line-gap`, default **8px** — which *is* 24/3,
so the default look is byte-identical and the two are simply no longer wired
together. (If a line-gap control is ever wanted, the token is already there.)

**The dropdown's list was app-grey.** `SelectItem` paints its text
`--ds-gray-900`, and `chartSurface` remaps 100–400, 700 and 1000 — not 900. So
the list arrived in the app's mid-grey inside a chart-coloured panel. Added to
`chartOverlaySurface` → the ink. **The lesson generalises: every time this panel
adopts a shared component, check which `--ds-gray-*` steps it reads.** That is
three rounds in a row where the answer was a step nobody had remapped.

**The custom colour opens OUR picker.** It was a native `<input type="color">`
for one round; the app already has `HexColorPicker` (react-colorful) in
`ChartStylePanel`, and that is what the well opens now — inline, closed until
asked, at 132px rather than Settings' 180px because it lives inside a 40% dock
with the chart above it.

**Fonts are alphabetical**, and **switching tabs scrolls to the top** — the
scroller kept its offset, so you could arrive at Layout half way down with no
idea what was above you.

#### Element 28, round 10 — the Layout tab, 2026-08-04

**Four groups**, the owner's, confirmed on delivery: **The page** (columns ·
repeated sections) · **Sections** (heading · style · pinning · band cues) ·
**The map** (under the top bar · where the ribbon sits · its style) ·
**Getting around** (song to song · what the bottom bar shows · the rail).

**The three settings that existed with no switch.** All wired, all read by the
renderer, none reachable — so all three permanently at their defaults:
- `readerNotes` — band cues + inline notes on/off (`config.notes`, read at
  `ReaderSection.jsx:367,409`).
- `readerFooter` — `next` (the next song's name and key) vs `count`
  (`← 3/9 →` alone), read at `SetlistReader.jsx:160,178`.
- **The rail had no on/off at all.** Only its *open/closed* state was a
  preference, and that lived in `localStorage` per device; the strip itself was
  unconditional. Now `readerRail`, a real knob in `READER_KNOBS` +
  `PORTABLE_PREF_KEYS`, read as `cfg.rail`.

**"In a pinch" → "Show", and it moved to Music.** Owner: *"What is in a pinch? I
don't really know what it does."* Fair — and it is worth recording that the
owner ALSO asked, separately, *"Show - chords on/off - do we need this?"*
**They are the same control.** Both are `displayMode`
(`chords` | `lyrics` | `chordsonly`). It was in Layout under a name chosen to
signal "this is the emergency lever, the role picker is the real answer", and
the name succeeded only in hiding what it did. It sits in Music now, directly
under the role picker that writes it, called **Show**.

**The colour picker floats.** Owner: *"One bug with the picker is that it opens
under, should it be like a pop-up maybe?"* Inline it pushed the rest of the tab
down inside a ~230px dock and was then clipped by the scroller — the picker is
132px plus a hex row. It is portaled now, anchored to the well and placed
**above** it when there is room, because the well is near the bottom of the
screen and a panel below it lands under the thumb that opened it.

#### Element 28, round 11 — the chords bug, and three more orphans, 2026-08-04

**"I've lost the chords, why?"** — and the answer is a key mismatch that has
been there the whole time.

**The reader read `settings.showChords`. Every control writes `displayMode`.**
The ☰'s Show control, the old "In a pinch", `AaMenu`'s Page tab and the **role
picker** all write `displayMode` (`chords` | `lyrics` | `chordsonly`).
`Reader.jsx` resolved `showChords` from `config.display.showChords`, which is
`settings.showChords` — a *different key*, written only by `PerformanceView` and
`PracticeView`. Consequences, both real:
- Choosing "Chords + lyrics" did nothing.
- Once `showChords` was false — set by either old view, and they are still on
  the flag-off path — the reader had **no way back to chords at all**.

`displayMode` is now the source, with `showChords` kept as the fallback for a
profile that only ever set the old boolean. The host's tab still beats both;
the hub's Lyrics tab is not a preference.

**And `'chordsonly'` was impossible to render.** `ReaderSection` passed a bare
`showLyrics` — i.e. always `true` — so the third state was offered by every Show
control in the app and silently did nothing. Wired through now.

**A fourth orphan: `showDiagrams`.** Synced, and read by the reader nowhere —
element 11 made diagrams tap-to-see with no way to switch off. Now a Music
toggle, default ON, because element 11's argument is that a diagram you ask for
costs nothing until you ask.

> **That is FIVE settings in three rounds that were wired at one end only**
> (`readerNotes`, `readerFooter`, the rail, `showDiagrams`, and `displayMode`
> from the other direction). The pattern is always the same: a value written by
> a control nobody read, or read by a renderer nobody could write. **When adding
> a reader setting, grep for BOTH ends before believing it works.**

**Roman numerals**, the fourth notation (`getRomanNumeral` in `music.js`). It
shares Nashville's degree arithmetic and differs in the thing that matters:
**case carries the quality** — I/IV/V major, ii/iii/vi minor, vii° diminished —
so the minor suffix is *consumed* into the case rather than printed twice
("vi", never "vim"). The `m(?!aj)` test is deliberately narrow so `maj7` stays
major.

**Reading direction, prototyped.** Owner asked for top→bottom vs left→right.
`columnCount` (multicol) fills column 1 then column 2 and **balances** them, so
they end level — that is `flow: 'down'`, the default, and it is why multicol is
right for a chart. `flow: 'across'` is a **grid**, laid left→right, and the
trade-off is structural: a grid row is as tall as its tallest section, so a
short verse beside a long chorus leaves a hole. **Nothing balances it away and
no amount of CSS will** — it is worth it only when sections are of similar
length. Offered only at two columns, and only where two columns are possible.

#### Element 28, round 12 — the desktop side panel, and Music, 2026-08-04

**The reading direction was invisible, and the gate was the bug.** Owner:
*"Where did you put the reading direction? i cannot find it."* It was gated on
`settings.defaultColumns === 2` — the **explicit** setting. But `resolveColumns`
returns 2 whenever `defaultColumns` is unset on a wide screen, so two columns is
the resolved DEFAULT and the control was hidden from everyone who had never
pressed "2". Gated on `config.columns === 2` now — the honest number. **Same
class of mistake as the five one-ended settings: a control keyed to what was
*stored* rather than what is *in effect*.**

**The desktop ☰ is a panel down the LEFT.** Owner: *"On desktop, could the ☰
open as a hamburger from the left side? because right now it sits over half of
the screen. Something like the rail."* Right, and it is the same argument the
phone dock already won: a popover anchored to a top-left button covers the chart
it is changing. `Reader`'s root is a **row** now — the 320px panel, then the
column holding the scroller and the phone dock — so the chart is pushed across
rather than overlaid, mirroring the setlist rail on the other edge. `dock` took
a third value (`'side'`), and the tab strip goes back on TOP there: a full-height
panel is read top-down, while the phone dock's strip belongs on the edge nearest
the thumb.

**Dropdowns by a rule, not case by case:** **4+ options → dropdown, 2–3 →
pills.** That is Structure-where (5), Structure-style (5), Section style (4),
Song to song (4), Show (3, but it reads as a menu) and Chord names (4).

**Music, grouped and renamed.** *Who's reading* (**Your instrument** — owner
didn't like "You're playing"; this is the concrete thing and it is the word the
team schema already uses for `team_members.instruments`) · *The chords* (Show ·
Chord names · Sharps or flats · Tap for shapes) · *This song* (Capo).

**Explanations moved into an (i).** Owner: *"the explanations should be inside a
i button not random there. Maybe all the settings should have an i — but not
now."* `Field` takes `info`; two use it so far. **The "every setting gets one"
version is noted and NOT built.**

> **jsdom trap, new:** its CSS shorthand parser throws on `conic-gradient` (and
> some `var()` combinations) inside the **`background` shorthand** — and it
> throws during `cloneNode`, which Testing Library does for every role query. So
> one bad inline style takes out every `getByRole` on the page with a
> `TypeError` that names none of it. Use `backgroundColor` / `backgroundImage`
> longhands in inline styles.

#### Element 28, round 13 — the Reset bugs, 2026-08-04

**Two, and the second is nastier than it looks.**

**1. Reset appeared for changes nobody made.** Owner: *"even if I select the
current option I still get the reset."* `reset()` tested
`settings?.[k] !== undefined`, and **picking the option that IS the default
still writes the key** — so the key became defined, nothing differed from the
default, and a red Reset appeared that would have changed nothing. There is a
`MENU_DEFAULTS` table now: a key counts as reset-able only when it is set AND
differs from its default. `reader-menu-defaults.test.js` reads that table out of
the source and checks every entry against the place that really defines it
(`readerConfig`'s `DEFAULTS`, `resolveChartDisplay`, the theme/font constants),
so the second copy cannot drift.

**2. Resetting Show took the chords away.** Owner: *"the show gets the reset and
if I press it it will lose the chords even if the chords + lyrics is present."*
`displayMode` cleared → the resolver falls back to
`settings.showChords === false ? 'lyrics' : 'chords'` — and `showChords` is
`false` in any profile that ever turned chords off in the old
Performance/Practice views, which still write it. So *"put it back to default"*
produced lyrics-only.

**The fallback was right and its lifetime was wrong.** It exists to migrate a
profile that only ever set the old boolean, so it must apply **once** and never
again. Writing Show now clears `showChords`, and Reset clears both — after which
the legacy key can only ever speak for someone who has never touched this
control. That is the general shape of the fix for any legacy-key fallback:
**consume it, don't just outrank it.**

#### Element 28, round 14 — the names, and a switch, 2026-08-04

**The whole Layout tab was renamed with the owner**, item by item. The old names
described the DESIGN ("The map", "Getting around", "Under the top bar", "Song to
song"); the new ones describe the setting. Groups: **Page · Sections ·
Structure · Navigation**.

| Was | Is | Why |
|---|---|---|
| The page | **Page** | shorter, and it is a noun not a phrase |
| Read them / Down, then across | **Reading order** / Down · Across | the label was a verb with no subject |
| Repeated sections / Full · Condensed | **Repeats** / In full · As a tag · Hidden | "condensed" described the code, not the pill you see |
| Heading / ALL CAPS | Heading / **Uppercase** | shouting in a settings list |
| Style / No line | Style / **Plain**, and it is the DEFAULT now | a chart is paper, and paper has no frames on it |
| Heading pins as you scroll | **Pin heading while scrolling**, a switch | it is a yes/no and it read as a sentence |
| Band cues & notes | **Band cues** + **Inline notes**, two switches | see below |
| The map | **Structure** | it holds the structure controls; the map is what we call it, not what it is |
| Under the top bar | **Setlist bar**, a switch | it reads as an on/off for the set |
| Structure — where / — style | **Structure location** / **Structure style** | an em-dash is not a word |
| Getting around | **Navigation** | |
| Song to song | **Controls** | inside Navigation, "song to song" was the group's job |
| The bottom bar shows | **Bottom bar**, and only with the bottom bar | it described something not on screen under the other three nav styles |
| The setlist rail | **Setlist rail** | |

**Band cues and inline notes split into two knobs.** Owner: *"can we split this
into two options one for notes and one for cues?"* They had been one
(`config.notes` drove both). They are different marks: a cue is written under a
heading for the whole band, an inline note is dropped into a line for one
moment, and wanting one is no reason to want the other. `readerInlineNotes` is
new; elements 4 and 5 finally have a knob each.

**Plain is the default section style.** Owner: *"maybe we can change the No line
name and make it default."* It is the original chart's look.

**Yes/no settings are a `Switch`.** Owner: *"is there a better way to handle the
2 answers only settings?"* — two pills make you read both before you can tell
which is on; a switch shows its state in its position. It also stops a binary
looking like a three-way that happens to have two options. Applied to: pin
heading, band cues, inline notes, setlist bar, setlist rail, tap-for-shapes.

**The desktop panel keeps the ☰ still.** Owner: *"Maybe we can still do it in a
way that the ☰ is still in the same place when we open somehow? We move
everything lower?"* — a full-height panel pushed the whole reader across, so the
button you had just pressed jumped sideways and you lost what you were aiming
at. It starts below the top bar now, offset by the **measured** `headH` the
reader already tracks for the sticky headings, so the bar and its ☰ do not move.
Width is `min(320px, 30vw)` — a fixed 320 is a third of a 1024px laptop — and it
slides in. **Not a permanent strip** (owner: *"I don't know if I want to have
another strip always there… the settings are not that needed, like the rail"*)
and closed by default: it does not exist until the ☰ opens it.

#### Element 28, round 15 — density, and a correction, 2026-08-04

**The `headH` offset did not do what its comment claimed.** Round 14 made the
desktop panel a SIBLING of the scroller and offset it by the measured header
height, on the reasoning that this would leave the ☰ where it was. It did not:
the header is INSIDE the column the panel was shrinking, so the header shrank
with it and the ☰ moved sideways anyway. All the offset bought was an empty band
above the panel — which is what the owner saw (*"there's an empty space in the
top on desktop now"*).

The real fix is where the panel LIVES. It is inside the scroller now, below the
top bar, `position: sticky` at `headH` with `align-self: flex-start`. The header
is the scroller's own full-width child, so nothing can push it; the band is gone
because there is no longer anything above the panel to leave empty.

> **The lesson, and it is the same one as the five one-ended settings:** a
> comment asserting an effect is not the effect. `headH` was measured, real, and
> applied to the wrong element.

**Switches sit on their label's line, and take no Reset.** Owner, on three
stacked: *"Doesn't it take too much space? Also the switches don't really need
reset, do they?"* — no on both counts. A switch under its label spends a whole
field's height to say one bit; beside it, it costs nothing. And Reset earns its
place when a control has several values and you cannot tell which was the
default — a switch has two and shows you which one it is on. Tapping it back
**is** the reset.

**`Pair` is `auto-fit` / `minmax(150px, 1fr)`, not two fixed columns.** Owner:
*"let's not force items to be one next to the other if there's no space, make
them dynamic."* Two fixed columns squeezed a stepper and a dropdown into ~130px
each inside a 290px panel and wrapped the labels mid-word. The panel is a
resizable side dock AND a phone dock, so "fits" is not one number.

**The phone dock closes with a chevron down**, the desktop panel with a ✕: the
dock slides down and the chevron says which way it goes.

**Progress line on/off** (`readerProgress`) — `null` already hid it in
`ReaderTopBar`, so the knob needed no new branch.

#### The double scroll — `flex-1 min-h-0` inside a scroller, 2026-08-04

Owner, twice: *"We have a double scroll problem now"*, then *"I don't think you
fixed the double scroll bug."* He was right both times, and the first fix was
aimed at the wrong thing (the panel's `100vh` height — a real bug, but not
this one).

**The cause was the row wrapper the desktop ☰ sits in: `flex-1 min-h-0`.**
Inside a scrolling flex column, that caps a child at the scroller's **visible**
height. So the chart laid itself out inside a box pinned to one screen while its
content ran far past it; the scroller's `scrollHeight` then came from the capped
box rather than from the song, and the two disagreed about how long the song
was. The row is unconditional, so **it hit the phone too**, where it holds
nothing but the chart.

`min-h-0` is normally the FIX (it is why a flex child can shrink and scroll —
see the ☰'s own body). On a wrapper inside a scroller it is the opposite: there
is nothing to shrink *to*, only content to cut off.

> **The rule:** inside `overflow-y-auto`, a wrapper must grow with its content.
> `flex-1` alone is harmless (a flex item's `min-height: auto` still refuses to
> shrink below its content); `flex-1 min-h-0` is the one that caps. Guarded by
> `reader.test.jsx` → *"lets nothing between the scroller and the chart cap its
> height"*, which walks the ancestor chain.

#### Element 28 → 2, CLOSED 2026-08-04

**Fifteen rounds.** What it is, in one place:

- **Three tabs — Style · Layout · Music.** No root list, no drill-in, no back.
- **Three shapes, one node**: a **dock** taking 40% under the chart on a phone
  (tabs at the bottom, nearest the thumb, chevron-down to close); a **sticky
  panel** down the left inside the scroller on a desktop (tabs on top, ✕ to
  close, `min(320px, 30vw)`, closed by default, never a strip); and a popover as
  the fallback. All three obey the panel rule: the chart is displaced, never
  covered, and never dimmed — element 11's chord taps still work while you
  adjust the type.
- **It wears the reader's theme** (`chartOverlaySurface`).
- **Reset per option**, only when that key differs from its default
  (`MENU_DEFAULTS`, pinned by `reader-menu-defaults.test.js`). Switches have
  none: they show their own state.
- **Free vs Pro**: legibility is free — every size and spacing — and taste is
  Pro. Locked themes are shown, dimmed, with a way in.

**Seven settings were wired at ONE END ONLY and are fixed**: `readerNotes`,
`readerFooter`, the rail, `showDiagrams`, `displayMode` (read by nobody
standalone — the "I've lost the chords" bug), `chartLyricColor` (it was the
chart's *ink*), and the lyric font (never applied). Plus `sectionSpacing`
leaking into the space between lyric lines.

> **The one lesson worth carrying to element 3:** every bug in this element was
> a value connected at one end. Written by a control nobody read, read by a
> renderer nobody could write, or — twice — applied to the wrong element while a
> comment asserted otherwise. **Grep both ends. A render test cannot see a value
> nobody consumes.**

**Left open, deliberately:**
- **`View` in Music = the STAGE VIEW** (element 24: chrome stripped to nothing,
  pedal-driven), **not** a picker for the four view templates. Owner,
  2026-08-04: *"the view map is different and the users should not be able to
  choose here between them."* The templates are a fact about the route you took,
  not a preference.
- **Arrangement switching** (element 21, practice-only) — it does NOT fit the
  top bar any more. Owner asked where; the answer is Music → *This song*, beside
  Capo, which is the group for facts about the song in front of you.
- **Transpose default**: the setlist's key, and no per-song memory here. Owner:
  *"I want it setlist and not necessary remember, the remember part is for the
  setlist editor not for this view."* That is what it already does — the reader
  starts from `item.key || song.key`; the session-local memory only lasts until
  you leave the setlist.
- **Custom theme as the last carousel stop**, opening the theme maker.
- Section colours → the sections rework · title-bar position · page-turn mode ·
  capo per instrument · Nashville minor style · tuning · custom diagrams.

**Rejected, with reasons** (owner, 2026-08-04, on a list of thirty): chord
position, chord/lyric weight, page margins, relative chord size, caps chords,
brightness, tab string labels, auto-fit, section order, blank lines between
verses, empty sections, ribbon current-only, left/right-handed, simplify chords,
slash chords on/off. **The panel holds 8–10 fields a tab before it becomes a
list you read rather than a menu you aim at — so a new setting has to displace
one, not join it.**

### The four views — the map, agreed 2026-08-01

The owner's list, confirmed and completed. **A view is a TEMPLATE of the
Reader** — one renderer, one set of elements, different defaults and different
chrome around it. Not a different chart. Anything that forks the chart itself is
the mistake this whole rework exists to undo.

| # | View | Opens from — and ONLY from | What makes it different |
|---|------|----------------------------|--------------------------|
| 1 | **Song hub, full screen** | the full-screen button inside the Song Hub. From the **side peek it expands within the peek**, never to the real screen — the peek's whole value is that you never left the list | one song, no prev/next. `FullscreenReader` today |
| 2 | **Campfire** | the Campfire button on a song | one song, and **recommended next songs at the bottom** |
| 3 | **Live** | Play in the setlist hub | the important one. Whole set, nav, the rail |
| 4 | **Practice** | Practice in the setlist hub | needs a rework. Owns the click, the track, note-writing, arrangement switching |

**What the list was missing** — three more surfaces render a chart, and each
needs a decision even if the decision is "not a view":

- **The hub view** (the Chart/Lyrics tab inside the Song Hub, the side peek at
  rest, the editor preview). Already settled: a fixed look, answerable to
  nothing, `HUB_VIEW` in `readerConfig.js`. It is a **template with no
  settings**, which is a legitimate fifth entry in the table even though it is
  not a "view" in the owner's sense.
- **The shared setlist viewer** (`SharedSetlistViewer`) — a public link opened
  by someone with no account and no settings of their own. It renders a chart
  today and it is not the Reader. Either it becomes view 5 with everything
  locked, or it stays a separate read-only renderer forever. **Undecided.**
- **Print / PDF** (`src/pdf/`) — a genuinely different renderer with its own
  layout engine, and it should stay that way. Paper is not a screen.

Also worth naming: `setlist-play` and `setlist-performance` are **two routes
into view 3**. They render the same thing with the same props and differ only in
which finale they land on. One of them should go.

#### Do we map first, or finalise the look first?

**Map first — but the map is the four rows above, and it is already done.** The
useful next step is not more mapping, it is the **element pass**: a view is
nothing but a set of element defaults plus its chrome, so until the elements are
settled, "mapping" view 3 means writing down settings that are about to change.
Finalise the elements, then each view is an afternoon of choosing defaults and
building the one piece of chrome that is unique to it (Campfire's recommended
list, Practice's tools, Live's rail).

### The five views — what they actually are (superseded by the map above) ❓

The owner asked, twice, whether the reader really needs five views, and the
question deserves the facts rather than a design opinion. Today:

| Route | Entered from | How the reader behaves |
|-------|--------------|------------------------|
| `setlist-performance` | a setlist's **Play** | identical |
| `setlist-play` | the older play path | identical |
| `setlist-practice` | a setlist's **Practice** | identical |
| campfire | a song's **Play** → an ephemeral one-item setlist through `setlist-performance` | identical |
| `song-hub` chart tab / full screen | the library | the hub view / the reader |

**Three of those routes render the exact same component with the exact same
props.** `SetlistReader` took no mode at all until 2026-08-01; the ONLY
difference App made between them was which finale they land on. So the honest
answer to "do we need five views" is: there are not five views. There is one
reader, one hub view, and three route names for the same screen.

That is also why every practice-only decision had nowhere to go — the reader
could not tell which one it was in. `mode` is now threaded through, and the
practice-only wants (writing a note, switching arrangement, per-song tools) hang
off it. `setlist-play` should collapse into `setlist-performance` at graduation;
that leaves **live** and **practice**, which is the split the owner has been
describing all along.

**Deliberately deferred, with reasons:**
- **Numbered per-repeat cues** (`> 2: Acapella`) — confirmed as a real gap from
  the owner's PDF, but it's an `.md` **format change**. Not while the reader is
  in flight.
- **Piano diagrams** — no shape library.
- **Presets** — only after every element is finished, as saved bundles.
- **`FullscreenChartViewer`** — still a WIP stub; should become a thin wrapper
  over `Reader`, not a fork.

---

## The header pass — 2026-08-03

The owner's answers, in order, for the header work. Round 1 (the same bar
everywhere) is built; the rest are decided and queued.

| # | Decision |
|---|---|
| Bar | **The same header on every screen** — ☰ and ✕ on the break and the missing-song screen too. First thing built. |
| Artist | **No.** Too much width for no gain. |
| ♩ tempo / time | **Stay as dead text** — the drummer needs to read them. The metronome icon remains the only way into practice. |
| Edit button | **Yes**, a mini editor for the song, opened from an icon in the bar. |
| Mutable or versioned | **Changes the song**, *and* offers "save as a new arrangement". Both, not one. |
| Where | **Practice only.** Not live. |
| What it edits | **Four things, in this order** (owner, 2026-08-03): **key** (from the dropdown, and in practice it should *save onto the setlist item*, not just the session) · **tempo + time signature** · **structure** · **chords and lyrics — "fast changes not quite full changes"**. |
| Set bar scrolling | **Wheel-over-the-bar + edge fades.** |
| Row spacing | **Halve it** — 12px/10px → 6px/6px, then look again. |
| Rail button | **Beside** the footer counter, not instead of it. Desktop/tablet only; the phone keeps the counter. |

### Round 2 — the chrome's real height, and the set bar's missing affordance

> **The bar was 56px on a phone, not 44px — and the padding was never the
> cause.** `IconButton size="sm"` reads `h-8` (32px), but `@layer base` carries
> `button { min-height: 36px }` and, under 640px, `44px`. **`min-height` beats
> `height`**, so every ☰/✕/prev/next in the reader was 44px tall and each row
> was `6 + 44 + 6`. This is the `min-h-0` trap for the third time; it had been
> applied to ribbon chips and ☰ rows and never to the bar itself. Two named
> constants now: `BAR_BUTTON` (36px, `ReaderTopBar`) and `NAV_BUTTON` (40px,
> `ReaderFooter`). **They are deliberately different sizes** — the ☰ and ✕ are
> reached between songs, prev/next is hit mid-song in the dark.

- **Everything in the bar IS centred** (owner asked, 2026-08-03): every row is
  `flex items-center`, so the 18px title, the 28px key chip and the 15px meta
  all centre on the row's height. The one exception was the set bar's chip row,
  which had no `items-center` and so used the default `stretch` — fixed.
- **Row padding halved**: every chrome row `py-1.5` → `py-1`, the top ribbon
  `pt-1` → `pt-0.5`. With the button fix the phone header goes **56px → 44px**
  and the footer **56px → 48px**.
- **The set bar scrolls on the wheel, with edge fades.** It was always
  `overflow-x-auto`; `no-scrollbar` hid the only affordance a mouse has, so on a
  desktop there was nothing to drag and nothing saying the set continued. Same
  wheel idiom as the ☰'s theme strip (`passive: false` — React's `onWheel` is
  passive and cannot `preventDefault`).
- **The rail opens from the bar**, on the **right**, **wide screens only**. It
  is named **"Setlist"**, not "Open setlist": the footer counter already answers
  to that, and two controls with one accessible name is a screen reader saying
  the same word for two different things. A **double chevron** that turns around
  when the rail is open — the owner asked for "the 2 or 3 chevrons that we
  currently use" and **there is no such icon in the app**; every other chevron
  here is single. The right-hand placement bends element 1's "nothing goes near
  the ✕": accepted because this opens a panel, so a mis-tap costs a panel rather
  than the service.
- **The key chip is 25px** (owner), down from 28. It is a `<button>`, so the
  phone's 44px floor still has to be opted out of by hand.

> ### ⚠ The chart surface must remap the INTERACTION greys too
> `IconButton`'s ghost variant hovers to `bg-[var(--ds-gray-200)]`, and that
> token was not in `chartSurface`. So it kept coming from the **app** theme: a
> dark app on a light chart painted a near-black pill under an icon that
> correctly stayed dark, and the icon vanished on hover (owner, 2026-08-03).
> `--ds-gray-100/200/300/400` are now mapped, with the hover tint **derived
> from `--chart-text`** via `color-mix` — a faint wash of the foreground, right
> in every theme by construction. Inverting the icon instead would have made
> hover depend on knowing the pill's brightness.
>
> The nav arrows had a **second** cause: `style={{ color }}` inline. An inline
> style beats a class, so `hover:text-*` could never apply to them. Colour the
> reader's chrome buttons with a **class**, never `style`.
- **A break with a note reads from the TOP**, not vertically centred — centred
  text starts in a different place depending on its length, and a long note
  began below the fold. A break with only a length stays centred.

> **`IconButton` reads the APP tokens.** Its ghost variant is
> `--ds-gray-700` / `--ds-gray-1000` / `--ds-gray-200`, and only `Reader`
> re-pointed those at the chart tokens. So the break's ☰ and ✕ painted in app
> colours on a chart background — near-invisible on a light chart theme inside a
> dark app. Both surfaces now live in `readerSurface.js` (`chartSurface` /
> `hubSurface`) and all three screens spread the same object. **Any new
> full-screen reader surface must spread one of them**, or its controls will
> silently wear the wrong theme.

### Edit mode — 2026-08-03

**It is not a panel.** The owner's shape: *"you press the edit and then you get
a couple of interactive fields? Something like that? Like the whole view changes
somehow?"* So the **chart itself becomes editable**, which is the strongest form
of the panel rule (*a panel never covers what it changes*) — the limit of that
rule is not having a panel.

| | |
|---|---|
| **Where** | An icon beside practice, per the ☰'s round-3 cut: `☰ · practice · edit · exit`. **Practice only** (`can.editSong`) — editing a shared object mid-service, in a hurry, is the same argument `MissingSongScreen` uses for refusing "remove from setlist". |
| **The mode is a STATE of the chrome, not an addition to it** | The top bar's divider goes brand and the block takes a 7% brand wash. Element 1 is fixed and takes no new elements, so a mode it can be in has to colour what is already there. |
| **Tempo + time** | They were already on that row as text; in edit mode they become the fields. That is the answer to *"this editor should also let users edit the key/tempo on the fly, rather than opening the tempo menu"* — you edit the number you were already looking at. Committed on blur/Enter, never per keystroke: a half-typed `9` is a real tempo the metronome would use. |
| **Structure** | ↑ ↓ × on each section heading — the play order edited where the play order **is**. **Not drag**: the chart is inside a scroll container and (in a setlist) possibly a swipe gesture, so a long-press-drag has two things to fight, and losing a section to a mis-drag mid-rehearsal is far worse than two taps being slower than one. |
| **Repeats reappear** | A `hide`/`condensed` repeat renders its pill in edit mode. You cannot reorder or remove a slot that draws nothing. |
| **The fork** | *"Save as new arrangement"*, a **button** (owner's option a), shown **only once something has changed**. Not a prompt on first edit: "correction or new arrangement?" is the hardest question in the app (`PLAN.md` §7 #12) and asking it the moment someone nudges a tempo puts it at the worst possible time. |

**How the fork works, and why that way.** Edits apply to the song **immediately**
(owner: *"it should change the song"*). `editBase` is snapshotted on entry, and
exists for exactly one reason: the fork copies the **current, edited**
arrangement into a new one and puts the **original back** to that snapshot. The
alternative — fork first, then edit — would force the "correction or
arrangement?" decision *before* the change, which is the question nobody can
answer yet.

`handleSaveAsArrangement` lives in **`App.jsx`**, not the reader, because it
needs the real v2 song: the reader only ever holds a resolved
single-arrangement view, and rebuilding a whole song from that view is how a
song-level field gets dropped on the floor.

> **Play-order edits touch `structure`, NEVER `sections`.** Removing the third
> chorus must not delete the chorus — and because every slot naming a section
> shares one body, removing bodies would silently empty the other repeats too.
> The arithmetic is `src/lib/editStructure.js`, pure and tested, because a
> structure edit landing on the wrong slot is **invisible**: it re-orders
> somebody's song and nothing says so until they play it.
>
> **A song with no `structure` must have one materialised on the first edit.**
> Document-order songs make `orderSections` return `sections` untouched, so an
> edit written to an empty array changes nothing and the tap appears dead. Same
> if the stored structure doesn't fully resolve — `orderSections` is ignoring
> it, so the indices being edited refer to a list nobody reads.

#### Chord editing — 2026-08-04

**Tap the chord in the chart; the song editor's own `ChordPicker` opens.** Same
gesture as element 11, two meanings, separated by the mode: reading shows you
the shape, editing changes the chord.

Two things had to be carried that did not exist before:

1. **Which occurrence.** `onChordTap` handed back only the displayed chord name,
   which cannot say *which* G was tapped on a line with three. `SectionBlock`
   now passes `{ line, chord, transpose }`. The ordinal is computed
   **explicitly from `pairs`**, never from the order the callbacks happen to
   fire in — a counter incremented inside `renderChord` would be right today and
   wrong the moment a line renders twice or out of order.
2. **Which key.** The chart shows a **transposed** chord; the `.md` holds the
   **written** one. `SectionBlock` sends its own `effectiveTranspose` and the
   reader inverts exactly that. Recomposing it at the other end (user transpose
   + section modulate + mid-section modulate) is three chances to write the
   wrong chord into somebody's song.

> **The line is edited as TEXT, not re-serialised from a parse.**
> `replaceChordInLine` swaps the Nth `[…]` and leaves every other byte alone. A
> parse→serialise round trip would normalise spacing on every chord change, and
> a chart that reflows because someone fixed one chord is a chart nobody trusts.
> `withEditedLine` indexes into **`song.sections`**, not the play order: a
> section sung three times is one body, so editing it correctly changes every
> repeat.

> ### ⚠ `ChordPicker` is the WRONG picker. Use `ChordAutocomplete`.
> Both live in `features/editor/` and the wrong one was wired first (owner,
> 2026-08-04: *"the chords don't work on mobile, also it should allow me to add
> new chords... can we get the other picker"*).
>
> | | |
> |---|---|
> | `ChordPicker` | A fixed **290px** popover of root × suffix buttons. **No text entry**, so a slash chord or anything past its nine suffixes is unreachable — and at a hard 290px anchored to a tapped chord it hangs off the side or the bottom of a phone. |
> | `ChordAutocomplete` | Types **any** chord (`isChordToken` validates; slash and extended included), suggests the song's diatonic chords first, and **docks full-width at the bottom on touch** instead of floating. It also leaves the input unfocused on touch on purpose, so the keyboard doesn't cover the bar you're tapping chips in. |
>
> The reader passes **`compact`** (owner, 2026-08-04: *"a bit smaller, I don't
> like the scroll"*): 7 suggestions instead of 14, **wrapped onto two short rows
> rather than scrolled sideways**, tighter padding. A horizontally scrolling
> strip of chips hides most of its own options, which is the opposite of what a
> suggestion list is for. Opt-in, so the editor's own uses are untouched.

> ### ⚠ AN EFFECT THAT OWNS A GESTURE MUST NOT DEPEND ON ANYTHING THAT CHANGES
> The song-map drag shipped broken **twice**, and the gesture was never the
> problem. The effect that owned it depended on `[onReorder, drag, runs,
> structure.length]`. `structure` is `ordered.map(s => s.type)` in the reader —
> a **new array every render** — so `runs` re-memoised every render, the effect
> re-ran every render, and **its cleanup called `clearHold()`**.
>
> Which means the 250ms hold timer fired → `setDrag` → re-render → cleanup →
> `holdRef.current = null` → `onMove` bailed on `if (!h) return` and `onUp` read
> `engaged: false`. **The drop could never fire.** No amount of tuning the hold,
> the threshold or the hit-testing would ever have fixed it.
>
> It is `[]` now, with the moving parts read out of a `liveRef` written in its
> own effect. Two more rules came out of it:
>
> - **The drop target lives on the HOLD, not in state.** Reading it back out of
>   React state in `onUp` meant it lagged one render behind the finger, so a
>   quick release dropped on the *previous* target. State is for paint only.
> - **`touch-action` is decided when the gesture starts**, so it cannot be
>   switched on mid-drag. Chips claim `pan-y`, and a reorderable ribbon
>   **wraps** instead of scrolling — a horizontal scroller and a horizontal drag
>   are the same gesture and the scroller wins, so the conflict is removed
>   rather than arbitrated.
>
> `src/__tests__/structure-ribbon.test.jsx` now drives a whole gesture end to
> end, so a regression in the effect's lifetime fails there and not on a phone.

#### Edit mode, round 8 — 2026-08-04 · **element 1 closed**

Owner: *"everything should be made orange, the song map and the set as well,
right now it looks strange only the header."* Right about the **set** — an
orange title row between a chart-coloured set bar and a chart-coloured ribbon
reads as a band that has *landed on* the header rather than as the header being
in a different mode. The set bar and the title row are one object and they
change together.

**The line lands under the title row, not under the map** (see the correction
below): everything you use to *control* the mode goes orange; the map you
*read* stays on paper.

`EDIT_ROW` became **`EDIT_CHROME`** and now wraps **the progress line, the set
bar and the title row** — the top of the block, as one piece.

| | |
|---|---|
| **The set bar came for free** | `ReaderSetlistBar` was already written entirely in `--chart-*`, so re-pointing the tokens turns it orange with no edit at all: its current song stays a dark pill, its edge fades keep matching the ground. This is the payoff for the surface objects in `readerSurface.js` — a component that names no colours of its own can be moved onto a new ground. |
| **The progress line inverts** | Orange on orange is nothing, so the filled part becomes the ink (`EDIT_INK`) — the same swap the key chip already makes with `--chord`. |
| **The divider stays orange** | Even though the map below it is not. It closes the block, and an orange line under the map says the map belongs to the mode — which it does: it is the thing you change the play order with. |

#### …but NOT the song map — corrected same day

The first cut of this round painted the **whole** sticky block, ribbon included.
Owner, on it: *"remove it from the song map and leave it just for the header and
the set."*

The map is the one thing you are **looking at** while you edit, and it reads
best on the chart's own paper in the same section colours it wears everywhere
else in the app. Painting it orange meant **inverting every chip** to survive
the ground — filled in its section colour with a white hairline — which is a
second appearance for the map that nobody asked to learn, for the one moment
it matters most that the map looks familiar. `StructureRibbon`'s `accent` prop
was deleted with it: it had exactly one caller and no second one coming.

> ⚠ **The ribbon is kept OUTSIDE the wrapper, not restored inside it.** Undoing
> the token re-points on a child would mean `--chart-bg: var(--chart-bg)` —
> a property inside its own fallback is a **cycle**, invalid at computed-value
> time, and unsets the whole subtree (trap 2). One wrapper around the three
> orange rows is the only version that cannot hit that.

> **Editing still forces the ribbon style to `codes`**, alongside forcing the
> map on — but for one reason now, not two: a chip has to be a *drag handle*,
> and `dots` is a 10px circle while `numbered` is bare text with no box, so
> there is nothing to grab and nothing to paint a drop outline on.

**Pull down to finish.** Owner: *"drag down to exit mode"* → *"what if it's an
installed pwa? Then we have no drag to refresh, and I was thinking that you drag
after you cannot scroll anymore… that's my idea of pull to exit."*

- Armed **only at `scrollTop === 0`** — the "cannot scroll anymore" the owner
  named. It takes the gesture with `preventDefault` once engaged; the scroller
  is already `overscroll-contain`, so an installed PWA has no browser refresh to
  fight and a tab's pull never reaches the document.
- **~98px of finger travel**, damped to 0.45 so the header follows at half speed
  and the gesture feels like it is resisting. Under a thumb-length, over
  anything you could do by accident.
- The label rides **under the sticky block as its child**, so the header's
  transform carries it — the hint arrives from behind the chrome rather than
  appearing in the middle of the chart.
- Everything runs **outside React**: a non-passive native `touchmove` (React's
  synthetic touch listeners are passive and `preventDefault` on them is a no-op),
  the header moved by writing `transform` on the node, and the effect
  **mounted once** reading its moving parts from a ref. A finger produces ~120
  moves; 120 renders of a chart would visibly lag the thumb — and the ribbon's
  drag was already broken for two rounds by an effect that re-ran and cleaned up
  its own gesture mid-drag.

> ### ⚠ Do NOT "compensate" `scrollTop` when the sticky header changes height
> beta.57 added `scrollTop += delta` for the report that a pinned heading hides
> behind the map when edit turns the ribbon on. **The geometry says it cannot
> help, and it made the bug worse by exactly Δ:**
>
> ```
> item at document offset H + k  →  viewport y = H + k − scrollTop
> sticky header covers              [0, H]
> hidden  ⟺  H + k − scrollTop < H  ⟺  k < scrollTop
> ```
>
> Grow the header to `H + Δ`: the item reflows to `H + Δ + k` and the header
> covers `[0, H + Δ]`, so hidden ⟺ `k < scrollTop` — **the same condition**. The
> reflow and the taller header cancel exactly.
>
> **beta.58 wrote this warning and did not take the line out.** The `scrollTop
> += delta` was still inside the ResizeObserver, so the third round of "not 100%
> fixed" was the original bug still running — the doc and the code disagreed and
> the doc was believed. Removed for real in beta.59.
>
> **And it was the cause, not a failed fix.** Scrolling down by Δ pushes the
> section you are in Δ further past, and a sticky heading **releases at the
> bottom of its own section** — so a short section's heading slides up under the
> header and stays there until you scroll back. Exactly the report. If a heading
> ever hides again: measure `headH`, `scrollTop` and the heading's
> `getBoundingClientRect().top` across the transition before touching anything.

#### Edit mode, round 7 — 2026-08-04 · superseded by round 8

**A real orange header**, not a tint and not a stripe (owner: *"I don't know if
just a line is enough for it. Let's create a special orange header for
editing"*). `EDIT_ROW` painted the **title row only** solid `EDIT_ACCENT` and
re-pointed the foreground tokens for its subtree to fixed near-black ink.

> **Why the two earlier attempts failed, and this cannot.** A `color-mix` wash
> blends orange with *whatever the chart theme's background is*, so it lands
> differently on every theme and drags the foreground's contrast with it. Pinning
> **both** sides — fixed ground, fixed ink — makes the contrast a constant
> (~8:1) that no theme can touch. `--chord` becomes white, because the key
> chip's gold on orange is illegible. **This part survives**; round 8 only
> widened where it is applied.
>
> **Only the title row** — held back because the ribbon's chips carry section
> colours that would be mud on orange. Round 8 solved that at the chips instead
> of stopping at the row.

### The rail is a persistent strip — 2026-08-04 · now **element 29**

Owner: *"on live, we have a full right side bar for the rail… look at how the old
chart is doing and replicate that."* `PerformanceView` already had it, and it is
better than an overlay for a reason worth writing down: **the chart never
reflows when you open it**, so the words do not jump mid-song.

- `<aside>` **always mounted** on `wide`: **264px open, 44px collapsed**.
- **The toggle lives ON the rail**, which settles where the chevron goes — it is
  neither the outermost button nor beside the ✕. The control that opens a panel
  belongs to the panel, and element 1's right edge goes back to the ✕ alone: the
  one control whose position must never move, because it is the one reached
  without looking.
- **The list renders only when open.** A 44px strip cannot show it, and leaving
  it mounted leaves a clipped column of titles behind the strip.
- **Open state is remembered per DEVICE** (`setlists-md:reader-rail-open`), not
  synced: whether you want the running order beside the chart is a fact about
  the screen you are on. ⚠ Tests must `localStorage.clear()` — one test's click
  otherwise leaks into the next.

#### Edit mode, round 6 — 2026-08-04

| | |
|---|---|
| **The nav row goes too** | Not disabled — **hidden**, like the pill and the edge arrows. Every button on it is inert in edit mode, and a whole bar of dead controls under the edit row is worse than the room it takes. |
| **A SOLID stripe, not a wash** | The 9% orange mixed into the background landed differently on every chart theme — nearly invisible over cream, muddy over near-black — and dragged the title's contrast with it (owner: *"it will look different for each theme and some might not be readable"*). The background is now always the chart's own; the mode is carried by a **3px solid `EDIT_ACCENT` stripe** and the divider. A mark **on** the background instead of **in** it cannot fail a contrast check. |
| **Growing the header moves the content with it** | Pressing edit with the map hidden forces the ribbon on, which grows the sticky header by its whole height — and the pinned heading ended up behind it until you scrolled (owner). `Reader` now compares `headH` against its previous value and adds the delta to `scrollTop`. Only while actually scrolled: at the top there is nothing behind the header to rescue. |

> **A full solid orange BAR was not built.** It would need the title, the icons
> and the key chip to invert per theme to stay legible — which is the very
> readability problem the change was asked for. One line away if the stripe
> turns out to be too quiet.

#### Edit mode, round 5 — 2026-08-04

| | |
|---|---|
| **Delete from the map** | A **bin drop-zone** appears at the end of the ribbon while dragging; drop a chip on it to take that slot out. A drop target rather than a `×` per chip — the gesture already exists, and a control between every pair of chips is the shape the `+` was already cut for. A permanent bin is a destructive target sitting in the chrome waiting to be brushed. Same undo toast as the heading's trash. |
| **Lyrics / Source** | The section editor now offers both, the way the song editor does. **Lyrics** strips the chord markers and puts the chords back **by character position** on save (`lineToPlacement`/`placementToLine` — the same pair `ArrangeTabV2` uses), clamping a position past the end of a shortened line rather than dropping it. **Source** is the raw `.md`. Switching modes re-derives from the current text, so a switch never discards what was just typed. |
| **Lyrics is refused for tabs and key changes** | Those lines have no words, so stripping chords is meaningless and rebuilding them from an edited word list would destroy them. The editor sidesteps this by editing one line at a time; a whole section in one box cannot, so it opens in Source and says why. |
| **Done is BRAND, not orange** | Orange is the mode's warning colour; painting the safe way out in it says the opposite of what Done means. The chrome stays orange. |
| **The floating navs hide while editing** | The pill, the edge arrows and the counter chip are all `fixed` to the bottom, so they sat *on top of* the edit row. Hidden rather than restacked: song navigation is locked in edit mode anyway, and a control that cannot do anything is worse than no control. |

> **`scrollbar-gutter: stable` is a dead strip in a full-screen surface.**
> `DesktopLayout`'s `<main>` reserved the scrollbar's width permanently — which
> is right for a page that might grow, and wrong for the reader, where it was a
> line down the right edge that never went away (owner, 2026-08-04: *"a line in
> the right of the reader where the scroll bar used to be"*). It is dropped when
> `isFullscreen`: those surfaces own the screen and scroll themselves.

#### Edit mode, round 4 — 2026-08-04

- **The map is forced back on while editing.** `structurePosition` can be `off`,
  and hiding the thing you edit the play order with left no way to reorder at
  all once ↑/↓ retired. Forced to `top`, not restored to whatever it was: a
  floating side rail is 48px wide, which is not somewhere you drag chips.
- **Removing a section raises the app's undo toast** (`showUndoToast`, the 5s
  countdown ring the editor and setlist builder already use) — the version that
  finds you, as well as the Undo button that waits to be found.
- **The compact chord bar has no header row at all.** With the caption and the
  picker gone it held nothing but the ✕, so it was a whole row of height for one
  20px button; the ✕ rides at the end of the input row now.

#### Edit mode, round 3 — 2026-08-04

| | |
|---|---|
| **No text selection in the reader** | `chartSurface` sets `user-select: none` + `-webkit-touch-callout: none`. A long press is a real gesture now (the map's drag), and on iOS a long press on text raises the selection handles and wins. Nobody selects lyrics off a chart mid-service. **Inputs/textareas opt back in** via `@layer base` in `index.css`, or you cannot place a caret in the tempo box. |
| **Edit mode locks every other way out** | ☰, practice, the rail, prev/next and ✕ all go inert; the practice strip **closes** on entry. Each was one tap from leaving the song with the change applied and Cancel out of reach. The ☰ is **disabled, not removed** — dropping it would change the bar's shape the moment you press edit. The reader reports `onEditingChange` so the *setlist* can lock its own controls. |
| **The ribbon EXPANDS while editing** | `collapse={!editing}`, so `C ×3` becomes `C C C`. A collapsed run is one chip standing for three slots: dragging it drags three things at once, and "between the second and third" cannot be expressed. This is why the drag felt broken. |
| **Chips don't jump while editing** | `onSelect={null}`. A chip is a drag handle now, and a gesture that both moves the section *and* throws the page elsewhere is one nobody can aim. |
| **Drag to the END** | A drop zone appears after the last chip **only while dragging** (an always-present gap reads as a missing chip). `runs.length` is the sentinel; it lands at `structure.length`. |
| **The add menu is coloured and narrow** | 124px, each row a bar of its section's colour. The map is coloured, so a plain list makes you translate a name back into the chip you're about to see. |
| **A ghost trash, and a pencil** | The bordered `×` competed with the 12px heading beside it. Both handles are now bare glyphs that fill only on hover. |
| **Per-section lyric editing** | The pencil swaps the rendered section for a **textarea of its `.md`** — brackets and all, the same text the editor's Write tab shows. Saved through **`parseSectionLines`**, the helper the editor's section drawer already uses: hand-rolling a `split('\n')` flattens tab blocks and modulate markers into plain strings that vanish on the next parse. |
| **"Discard", not "Cancel"** | The edit row's Cancel throws away the whole session. Two buttons a few centimetres apart both reading "Cancel", meaning different amounts of lost work, is an ambiguity you notice only after losing some. |

> **The compact chord bar drops its caption and its picker toggle** (owner:
> *"top-bottom not left-right"*). The caption labels a bar that only ever
> appears because you tapped a chord, and the structured picker duplicates what
> typing already does — between them they were most of its height.

#### The song map is where the structure is edited — 2026-08-04 (round 2)

Owner, after round 1: *"the problem with the + is that I was imagining only one
+ at the end with a drop down and select what you want and then you drag and
replace in the song map and we don't need the ↑ ↓."*

| | |
|---|---|
| **One `+`, at the end** | It opens a menu of **every section the song has** and appends the one you pick. A `+` per chip put a control between every pair and still only ever added the section it sat on — smaller *and* less capable. Portalled, because the ribbon is an `overflow-x-auto` strip that would clip its own menu. |
| **Drag a chip to reorder** | Whole **runs** move: `C ×3` is one chip, so `moveRun` moves all three. Moving one slot out of a run would silently split it into two chips — not what was under your finger. |
| **`↑ ↓` retired** | Reordering lives on the map now. **`×` stays on the heading**: you decide to cut a section while looking at it, not while looking at its chip. |

> **The drag engages on a 250ms HOLD, and it has to.** The ribbon is a
> horizontally scrolling strip, so a plain pointer-drag means "scroll" already.
> `touch-action: none` would win that fight and cost the ability to reach a chip
> off-screen in a long song. A hold is what every mobile reorder uses, and it
> keeps tap-to-jump and swipe-to-scroll intact.
>
> **All the gesture's bookkeeping lives in the effect**, not in props built
> during render. An `onPointerDown` created in render that touches
> `holdRef.current` is a ref read during render, and the compiler rejects it —
> correctly, because a prop computed from a ref doesn't re-render when the ref
> changes. `decorate` only labels chips with `data-run`; the listeners find them.
> The post-drag click is swallowed by a **capture-phase** listener registered in
> the same effect, for the same reason.

#### Superseded: the `+` per chip — 2026-08-04 (round 1)

Owner: *"a better way to edit the structure faster, not moving sections up/down
but adding sections in the song map… we can add a plus icon there?"*

**`StructureRibbon` takes `onAdd(afterIndex)` in edit mode** and grows a small
`+` after each chip. It plays that section **once more, right after itself** —
and it works so cleanly because the ribbon *already* collapses consecutive
duplicates: the copy lands inside the run, so `C ×2` simply becomes `C ×3`. The
map is edited in the map's own language.

- Kept from it: **a `+` is interleaved after a chip, never nested inside it** —
  a chip is a `<button>` when tappable, and a button inside a button is invalid
  HTML that browsers resolve by dropping one.
- `addSlotAfter` survives in `editStructure.js`, unused by the UI.

**Superseded, not in this round:** nothing — the `+` above shipped alongside the
↑/↓ handles rather than replacing them.

### Who may edit, and where — settled 2026-08-04

| Question | Answer |
|---|---|
| Which views carry the editor? | **Practice only** today. Live, the shared viewer, print and the hub view do not, and the view table is what says so (`can.editSong`). |
| The hub's full screen? | **Not yet.** Full screen *is* the Reader, so it is a one-line change in `VIEW` when its own row exists — but it gets that row when the practice editor has been used in anger, not before. |
| Who may edit? | **Editor role or higher — already enforced.** `isTeamReadOnly = activeLibrary !== 'personal' && !isAdmin && !isEditor`, and App nulls `onUpdateSong` for it. The edit icon needs `onUpdateSong`, and so does the practice row's tempo Save, so **both** were gated from the day they shipped. |
| Setlist or song? | **The song.** That is what "New version" is for: a change that should not touch the song becomes an arrangement instead. |

## The view table — where "each view does something else" lives

Owner, 2026-08-03: *"in the end I want each view to do something else, for
example the key transpose for practice but not for live, how do we implement it
now before we do the split?"*

**`VIEW` in `src/lib/readerConfig.js`.** `mode` was already threaded from App
through `SetlistReader` to `Reader`; what was missing was a place for a
per-view difference to *live*. Without it, every one becomes a
`mode === 'practice'` check scattered across components, and the split becomes a
hunt instead of an edit.

```js
const VIEW = {
  live:     { transpose: true, saveKey: false, practiceTools: true, editSong: ?, switchArrangement: false, writeNotes: false },
  practice: { transpose: true, saveKey: true,  practiceTools: true, editSong: ?, switchArrangement: true,  writeNotes: true  },
};
```

> ### The key change is SILENT in live and OBVIOUS in practice
> Owner, 2026-08-03, with the scenario that settles it: *"the piano player
> starts the song transpose +3 but in G and the guitar/bass/electric has to
> quickly transpose in their own apps, but then the save button appears."*
>
> Mid-service, several players transpose at once and **none of them is deciding
> anything about the setlist** — a Save button appearing on three phones is
> noise at the moment there is least attention to spare. So live transposes
> freely and offers nothing; practice offers the Save, because in practice
> changing the key **is** the decision being made. That is `saveKey`, and it is
> why `transpose` stays `true` in both: the split is not "can you transpose", it
> is "does anything follow from it".
>
> An earlier proposal had one inline Save in both views, taught by copy. The
> scenario killed it. **Nothing is taught by copy here** — the control's
> presence is the whole message.

Two rules:

1. **A capability is a fact about the VIEW, not a user setting.** Nothing in
   this table goes in `READER_KNOBS`, the ☰, or `PORTABLE_PREF_KEYS`. If the
   user should be able to change it, it is a knob, not a capability.
2. **Read it as `config.can.<x>` at the call site** — one line where it is used,
   so the decision stays in the table.

The table shipped with **every value matching what the reader already did**, so
introducing it changed nothing. Deliberate: the mechanism lands separately from
any decision about what goes in it. Flipping a value is now the whole edit.
`resolveReaderConfig` also returns `mode`, and the hub view returns `HUB_CAN`
(everything false — it is a browsing surface, not a view).

Campfire and the hub's full screen become **rows in this table** when they stop
being routes into `live`.

## Traps that have already cost time

1. **`min-h-0`** — see the box under element 2. Four rounds.
0. **Two `sticky bottom-0` siblings do not stack.** They both pin to the same
   0px and the higher z-index simply covers the other. beta.41 shipped the
   bottom ribbon as its own sticky block "above" the nav bar at z-10 — it was
   there, pinned, and painted underneath. **One block, several rows**, which is
   what elements 12 + 10 already did and what the comment above them already
   said. `src/__tests__/reader.test.jsx` now asserts there is exactly one.
0b. **Never round a measured sticky offset up.** beta.41 changed `headH` to
   `Math.ceil(borderBoxHeight)` reasoning that the heading must not overlap the
   divider. Backwards: on a fractional-DPR phone the header is 73.33px, ceil
   gives 74, and the heading pins 0.67px BELOW the header — which is exactly the
   hairline gap it was meant to close. Measure raw, and make the thing below
   overlap by a pixel.
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
8. **React's synthetic touch listeners are passive.** `onTouchMove` +
   `preventDefault()` is a silent no-op (a console warning at best). Any gesture
   that must take the scroll — pull-to-finish, the ribbon's drag — registers a
   **native** listener with `{ passive: false }` in an effect.
9. **There are TWO readers in the DOM.** The Song Hub keeps its embedded
   `Reader` mounted behind the full-screen one, and both render
   `id="section-N"`, the same class names and the same structure. `jumpTo` used
   `document.getElementById` and was measuring the HUB's section from inside the
   full-screen scroller — every jump in full screen landed nowhere near its
   target. The same duplicate wrecked a day of browser probes that queried
   `document.querySelector`. **Scope to `scrollRef.current`, always** — in the
   app and in any measurement of it.
10. **Paint order IS hit-test order.** "Put the rail under the lyrics" was the
   honest reading of a real instruction, and it made the whole map unclickable:
   the chart's box includes its padding, and the strip lives in that padding, so
   the chart swallowed every tap. Nothing looked wrong — a tap that does nothing
   is silent. If an overlay must not cover something, move it by GEOMETRY; use
   z-order only for things nobody touches.
11. **Firefox has two focus artifacts, and they need different answers.**
   `:-moz-focusring { outline: auto }` draws on the border box (move it with
   `outline-offset`), and `::-moz-focus-inner` draws a dotted border INSIDE the
   button, which no offset can reach — modern-normalize zeroed it, Tailwind v4's
   preflight dropped the rule. On a 10px round chip the second one reads as "a
   line inside the dot". **Chromium shows neither: test small round controls in
   Firefox.**
12. **`flex-1` is the CROSS-AXIS twin of the `min-h-0` trap.** A row inside the
   scroller had no `flex-1`, so it was shrink-to-fit: the chart laid out 840px
   wide in a 1236px scroller with 400px of dead window beside it, for months. A
   narrower chart is still a correct chart, which is why nobody saw it — it just
   wraps more, and wrapping more is part of why an "almost fitting" song scrolls.
13. **A size change inside a flex column moves every sibling below it.** The
   active dot grew 7→11px as the flex item itself, so a fast scroll walked it
   down the list shoving each neighbour 4px — read as the column shuddering.
   Fixed cell, resize the paint inside it.
14. **`undefined` in a style object is a DELETE, not a skip.** `{...frame,
   marginLeft: heavy ? x : undefined}` removes the frame's own margin for every
   light section — React serialises `undefined` as "". It silently killed the
   tint frame's edge-to-edge bleed: the wash stopped at 24px, the words started
   12px in from where they should, and the song came out **30% taller** from the
   extra wrapping. When a frame and a weight both have a claim on one property,
   COMPOSE them (`calc(a + b)`); never let the later key win by accident.
15. **A frame with vertical padding blocks margin collapse.** Every other frame
   let the section's own `marginBottom` collapse into `--chart-section-gap`;
   `tint` has padding, so the margin stopped being absorbed and started adding.
   Same class as the `1.6px of air` finding below — margin collapse is doing
   more of this layout than the code admits.
16. **A margin between sections is `max(spacing, margin)`, not the sum.** "A
   chorus gets more air" was `marginBottom: 1.6rem` vs `1rem`, and measured it
   was worth **1.6px** at the default Section spacing and **exactly zero** above
   26px. It was also on the wrong side — air below a chorus is air above the
   verse that follows. Use PADDING for air that must survive, and put it where
   the doc says it is.
17. **Tailwind v4 tree-shakes `@theme` variables nothing in the CSS
   references.** The eleven `--section-*` tokens are read only from JS, so
   declared in `@theme` they were dropped from the build and every heading fell
   back to the chart's ink. The page rendered; it just rendered grey. Ship
   JS-only tokens in a plain unlayered rule.
18. **Runs derived from the song go stale against per-slot state.** `repeatRuns`
   grouped adjacent repeats from the SONG, so a slot closed while its run-lead
   was still open became a non-lead member — and a non-lead member draws
   nothing. Closing the last of three lost it entirely. Anything that groups
   slots has to take the live state as an argument.
19. **A doc that says "removed" is not a removal.** beta.58 wrote the
   `scrollTop`-compensation warning above into both the code and this file and
   left the line itself running; the next round then read the comment, believed
   it, and looked elsewhere. When retiring something, `grep` for it after
   writing the note.

## Tests

- `src/__tests__/reader.test.jsx` — elements 1–6, 11
- `src/__tests__/reader-practice.test.jsx` — element 12 (click, slow-down, track)
- `src/__tests__/metronome.test.js` — the click's scheduling arithmetic
- `src/__tests__/reader-finale.test.jsx` — element 13, incl. what must NOT return
- `src/__tests__/setlist-reader.test.jsx` — element 10, breaks, nav modes
- `src/__tests__/structure-ribbon.test.jsx` — chip geometry + the `min-h-0` trap
- `src/__tests__/reader-config.test.js` — one case per knob
- `src/__tests__/edit-structure.test.js` — edit mode's arithmetic, all of it pure
- `src/__tests__/my-instrument.test.js`, `tab-transpose.test.js`

`.test.js` = node/logic · `.test.jsx` = jsdom/render.

> **No timer may decide a test's outcome.** `reader-practice` waited on a
> `setTimeout(…, 0)` in the YouTube mock via `waitFor`, and under 56 parallel
> files the callback was occasionally serviced late enough to fail a test about
> playback rates for reasons unrelated to playback rates. Raising the timeout to
> 3s made it rarer, not correct. The fix: the mock signals `onReady`
> **synchronously in the constructor**, so readiness is exactly one microtask
> away and the helper flushes (`await act(async () => {})`) instead of polling.
> Do the same for any new async mock — a mock has no reason to reproduce real
> latency, and every millisecond it invents is a race the suite has to win.
