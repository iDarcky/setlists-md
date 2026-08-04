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

### 2 — Structure ribbon
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
  **Three values now: Full · Condensed · Hidden.** `hide` draws nothing at all,
  not even the pill (owner, 2026-08-01) — but the section's div stays (empty,
  `aria-hidden`) and **the ribbon still lists it**. The ribbon is the map of the
  song; a section missing from the map breaks the one job.
- The pinned heading sits at **`stickyTop - 1`** with a matching extra pixel of
  padding. Two sticky edges that merely ABUT show a sliver of scrolling content
  on any device whose pixel ratio isn't a whole number. Overlap, never abut.

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
right now it looks strange only the header."* Right, and the half-way version
was worse than either end — an orange title row between a chart-coloured set bar
and a chart-coloured ribbon reads as a **band that has landed on** the header
rather than as the header being in a different mode. Chrome in a mode is chrome
in a mode all the way down.

`EDIT_ROW` became **`EDIT_CHROME`** and moved from the title row to the whole
sticky block. Three things fell out of that:

| | |
|---|---|
| **The set bar came for free** | `ReaderSetlistBar` was already written entirely in `--chart-*`, so re-pointing the tokens turns it orange with no edit at all: its current song stays a dark pill, its edge fades keep matching the ground. This is the payoff for the surface objects in `readerSurface.js` — a component that names no colours of its own can be moved onto a new ground. |
| **The progress line inverts** | Orange on orange is nothing, so the filled part becomes the ink (`EDIT_INK`) — the same swap the key chip already makes with `--chord`. |
| **The ribbon does NOT come free** | Its chips carry `s.b`, the **section's** identity (pink chorus, teal bridge) — not a token of the surface, and it has to survive or the map stops being a map. Coloured text on orange is mud. |

**So the chips invert** (`StructureRibbon accent`): each one **fills** with its
own section colour, takes a **white hairline** — which separates it from the
ground whatever colour that ground is — and labels in white; the active chip
keeps its ring, in white. The `+`, the drop outlines and the end-zone go white
for the same reason (brand teal on orange is the hardest thing on the row to
find). The bin **stays red** (owner, round 5) but gets a white pill to be red
*on*, and fills solid red when you are over it.

> **Editing also forces the ribbon style to `codes`**, alongside forcing the map
> on. Same reason twice: a chip has to be a *drag handle* now, and `dots` is a
> 10px circle while `numbered` is bare text with no box — nothing to grab, and
> nothing to paint a drop outline on. An inverted chip also needs a chip.

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
9. **A doc that says "removed" is not a removal.** beta.58 wrote the
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
