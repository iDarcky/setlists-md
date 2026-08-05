# Next session — the Reader, element 3 (the structure ribbon)

> **Short-lived handoff.** It exists because a new chat session starts with **no
> memory of previous conversations** — only this repo.
>
> _Rewritten 2026-08-04. State: `0.17.0-beta.77` on
> `claude/reader-menu-element-28-qn9ofq`. `beta` is at **beta.44** — the owner
> asked for rounds to go to the **feature branch only** so he can compare
> against `beta`. **He has not yet said to merge this branch into `beta`; ask
> before you do.** 913 tests, 0 lint errors (8 pre-existing warnings)._

---

## Start here

1. **This file.**
2. **`docs/READER.md`** — the element-by-element decision log. **The important
   one.** Every element carries a decision the owner made and the reason behind
   it. Treat them as settled; don't re-open them.
3. `CLAUDE.md` — how the app works.
4. `docs/PLAN.md` §1 — what is parked and in what order.

Ignore `docs/views-vision.md` and `docs/views_questions.md` — scrapped design.

---

## Working agreement (the owner's, stated repeatedly)

- **One element at a time. Ask the questions and let him decide BEFORE
  building.**
- Build exactly what is asked. **No adjacent settings, no knobs nobody
  requested.**
- **Ship every round** — he tests on his phone. A description of a change is not
  a change. Push the **feature branch only** for now.
- Batch the **questions** (4–6 at a time; he answers them all in one go).
  Serialise the **builds** — anything visual goes one at a time, because "it
  doesn't feel right" only surfaces on the device.
- > **If he says something looks wrong, IT IS WRONG.** Go and measure it in the
  > code before explaining why it should be fine. Every root cause is in
  > `READER.md`'s trap list.

---

## Where the walk got to

**The numbering changed on 2026-08-04.** The ☰ was element 28 (it got that
number by being promoted mid-walk out of element 1). It is the reader's second
surface, so it is **element 2**, and the structure ribbon moved **2 → 3**. Later
numbers are untouched.

| # | Element | State |
|---|---------|-------|
| **1** | Top bar | ✅ closed — it turned out to contain all of **edit mode** |
| **2** | The ☰ — the reader's settings menu | ✅ closed, **15 rounds** |
| **3** | **Structure ribbon** | **NEXT — this session** |
| 29 | The setlist rail | shipped as a strip; *"some work in the future. Not quite now."* |

Then the 14–27 table in `READER.md`, with the owner's answers already recorded
verbatim.

---

## Element 3 — the structure ribbon. What is actually there

`src/features/chart/StructureRibbon.jsx`, rendered by `Reader.jsx`. **Measure
before designing**; these are the facts that will shape it.

- **Five styles** (`ribbonStyle`): `codes` (boxes, default) · `chips` ·
  `numbered` (inline) · `dots` · `dotlabel`. Five positions
  (`structurePosition`): `top` · `bottom` · `left` · `right` · `off`.
- **Left/right FLOAT** — a transparent 48px strip over the chart with
  `pointer-events-none`, the chips re-enabling. They used to collapse to `top`
  on a phone; they don't any more, because floating costs no layout width.
- **Edit mode forces `codes`** and turns the chips into the **drag handles for
  the play order** (element 1's decision — a dot is not a drag handle). So the
  ribbon already has a second job, and any redesign has to keep it.
- **The active chip is whichever heading is PINNED**, not a scroll fraction —
  `useActiveSection` is given `headH` so the ribbon changes at the same moment
  the heading does. Get this wrong and the ribbon points at one section while
  the pinned heading names another.
- ⚠ **`useActiveSection` has a known bug** (`PLAN.md` §1.2 #4): its
  "near the bottom, snap to the last section" rule is true on the first frame
  when the content doesn't scroll, so the LAST chip lights up immediately. It
  hits the ribbon and the song map both.
- **A `hide`d repeat still appears in the ribbon**, by decision: the ribbon is
  the map of the song, and a section missing from the map breaks the one job.
  Tapping it jumps to the first time that section is played.
- Tests: `src/__tests__/structure-ribbon.test.jsx` (chip geometry + the
  `min-h-0` trap).

**Open questions worth asking him first:** does the ribbon show the *written*
sections or the *played* order (it shows played)? What does it do when a song
has twenty sections? Should a key change (`{modulate}`) show on it? Is
`dotlabel` earning its place beside `dots` and `chips`?

---

## Just closed — element 2, the ☰ (15 rounds)

Three tabs — **Style · Layout · Music**. Three shapes, one node: a **dock**
taking 40% under the chart on a phone (tabs at the bottom, chevron-down to
close); a **sticky panel** down the left *inside the scroller* on a desktop
(tabs on top, ✕, `min(320px, 30vw)`, closed by default, never a strip); a
popover as the fallback. All obey the panel rule — the chart is displaced,
never covered, never dimmed.

Also: the reader's theme (`chartOverlaySurface`), Reset per option against a
pinned defaults table, free-vs-Pro decided (legibility free, taste Pro), Roman
numerals, a reading-direction prototype, and the app's own colour picker.

Full account: `READER.md` → "Element 28 → 2, CLOSED".

### ⚠ The one lesson to carry into element 3

**Every bug in element 2 was a value connected at ONE END.** Seven of them:

| Setting | Which end was missing |
|---|---|
| `readerNotes`, `readerFooter`, the rail | read by the renderer, no control anywhere |
| `showDiagrams` | written and synced, read by nobody |
| `displayMode` | written by every control, read by nobody standalone — **"I've lost the chords"** |
| `chartLyricColor` | written into `--chart-text`, the chart's **ink**, so it repainted the whole UI |
| the lyric font | set on `ChartView`'s wrapper, which the Reader does not have |

Plus `sectionSpacing` leaking into the gap between lyric *lines*, and **twice** a
style applied to the wrong element while a comment asserted otherwise.

> **Grep both ends before believing a setting works.** A render test cannot see
> a value nobody consumes — the guards that caught these read the source.

---

## Known-open, carried forward

- **§7 #13 — two chord pickers, and underneath them two chord MODELS.**
  `ArrangeTabV2` uses `{ plainText, chords: [{ pos, chord }] }`; the reader and
  the `.md` use `[C]inline` strings. This is why the reader can replace a chord
  but cannot yet *add* one. Unify the model first.
- **§7 #14 (prio 2) — draggable song sections on the page.**
- **§1.2 #3c — you cannot type a space into a band cue or an inline note.**
  Root-caused, not fixed, owner's prio 1: every keystroke round-trips through
  `songToMd`/parse and `parser.js` trims it.
- **§1.2 #3d — add a cue/inline note from the SONG HUB**, without the editor.
- **§1.1 #4 — graduate the flag and delete the old surfaces.** Owner agreed for
  a session of its own. ⚠ `PerformanceView`/`PracticeView` are the **only**
  writers of `showChords`, now just a migration fallback — deleting them is the
  moment to drop it. Settings → Chart Style goes with them (§1.2 #3a).
- **Whether to reset defaults for everyone** — the owner will decide once the
  elements are finished. Nothing resets today.
- **Element 13:** the post-practice screen should summarise what changed.
- **Follow-the-leader:** option (b) — the chrome carries the state.

---

## True, and easy to get wrong

- **The Song Hub renders `Reader`, not `ChartView`,** when the flag is on.
  Three places can cause a "hub theme bug": the reader, the chart, and the hub's
  own card. `PLAN.md` §1.2 has the warning box.
- **`min-h-0` on every small control.** `button { min-height: 36px }` (44px on
  phones) lives in `@layer base` and beats every `height` utility. Four rounds
  lost to it, in three places.
- **CSS custom-property cycles** are invalid at computed-value time and unset
  the whole subtree. Every fallback must be a literal or name a *different*
  property.
- **`chartSurface` remaps `--ds-gray-` 100–400, 700 and 1000 only.** Three
  rounds in a row broke on a step nobody had remapped (500/`--border-2`, 600,
  900). Check the steps whenever the reader adopts another shared component.
- **jsdom's CSS shorthand parser throws on `conic-gradient`** (and some `var()`)
  inside the **`background` shorthand**, during `cloneNode` — which Testing
  Library does for every role query. One bad inline style takes out every
  `getByRole` on the page with a `TypeError` naming none of it. Use
  `backgroundColor`/`backgroundImage` longhands inline.
- **`mockWidth` in `reader.test.jsx` answers per query**, against a real width.
  Any new breakpoint needs the same check, or the desktop tests silently
  exercise the phone shape.
- **React's synthetic touch listeners are passive** — `preventDefault()` in an
  `onTouchMove` prop is a no-op. Native listener, `{ passive: false }`, in an
  effect.
- **An effect that owns a gesture must not depend on anything that changes**, or
  its cleanup tears down the gesture mid-drag.
- **Inside `overflow-y-auto`, a wrapper must GROW with its content.**
  `flex-1 min-h-0` caps it at the visible height, so the chart lays out inside
  one screen while its content runs past — the scroller's `scrollHeight` then
  comes from the box, not the song, and you get two scrolls that disagree.
  `min-h-0` is the fix *inside* a fixed-height panel and the bug on a wrapper
  inside a scroller. `reader.test.jsx` walks the ancestor chain for it.
- **`applyKeyHistories` is reference-preserving on purpose.**
