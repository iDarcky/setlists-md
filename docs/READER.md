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

### 8b — The setlist bar (the second top-bar treatment)

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

### Still open from earlier elements

| # | Element | Notes |
|---|---------|-------|
| — | Count-in, section loop | Cut from element 12 round 1. A loop needs per-section bars/timestamps — an `.md` format change |
| — | Wake lock, session stats | Carried by the old views; not ported on purpose |
| 8b | Setlist bar | Shipped, needs a rework pass (owner, 2026-07-30) |
| — | **Full-screen from the hub** | `FullscreenChartViewer` is a WIP stub with no ☰ and no hub chrome. Three ways out, all defensible — see below |

### Full-screen from the hub — three ways, ❓ undecided

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

### The side peek — open the hub instead? ❓

Owner's idea, 2026-07-30. Worth it: the peek is already the hub view, so
"open the peek" and "open the hub" now differ only in chrome, and one of them
is a second thing to maintain. Against: the peek's value is that it is
*dismissible without leaving the list* — replacing it with a route trades that
away. Middle path: keep the peek, and make it **shorter than the row it opened
from** (already noted in `PLAN.md`) so it can be dismissed without moving the
mouse.

### The ☰ menu — what actually belongs in it

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
- `src/__tests__/reader-practice.test.jsx` — element 12 (click, slow-down, track)
- `src/__tests__/metronome.test.js` — the click's scheduling arithmetic
- `src/__tests__/reader-finale.test.jsx` — element 13, incl. what must NOT return
- `src/__tests__/setlist-reader.test.jsx` — element 10, breaks, nav modes
- `src/__tests__/structure-ribbon.test.jsx` — chip geometry + the `min-h-0` trap
- `src/__tests__/reader-config.test.js` — one case per knob
- `src/__tests__/my-instrument.test.js`, `tab-transpose.test.js`

`.test.js` = node/logic · `.test.jsx` = jsdom/render.
