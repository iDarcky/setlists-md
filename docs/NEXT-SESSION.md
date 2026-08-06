# Next session — the Reader, element 4 (the section heading)

> **Short-lived handoff.** It exists because a new chat session starts with **no
> memory of previous conversations** — only this repo.
>
> _Rewritten 2026-08-06. State: `0.17.0-beta.91`, and **`beta` is at the same
> commit** — elements 1, 2 and 3 are all promoted onto it. Start element 4 on a
> fresh branch off `beta`.
>
> The owner tests on his phone and compares against `beta`, so during an element
> ship each round to the **feature branch only** and promote at the close.
> 945 tests, 0 lint errors (8 pre-existing warnings)._

---

## Start here

1. **This file.**
2. **`docs/READER.md`** — the element-by-element decision log. **The important
   one.** Read element 4's section *and* "The element-3 pass" above it: the
   heading and the ribbon are one system (the highlighted chip and the heading
   it points at must name the same section), so element 3's decisions bind here.
3. `CLAUDE.md` — how the app works.
4. `docs/PLAN.md` §1 — what is parked and in what order.

Ignore `docs/views-vision.md` and `docs/views_questions.md` — scrapped design.

---

## Working agreement (the owner's, stated repeatedly)

- **One element at a time. Ask the questions and let him decide BEFORE
  building.** Batch the questions (4–6; he answers them all in one go).
- Build exactly what is asked. **No adjacent settings, no knobs nobody
  requested.**
- **Ship every round** — he tests on his phone. A description of a change is not
  a change. Push the **feature branch only** while an element is in flight;
  promote to `beta` when he says the element is done.
- Serialise the **builds** — anything visual goes one at a time, because "it
  doesn't feel right" only surfaces on the device.
- > **If he says something looks wrong, IT IS WRONG.** Go and measure it — in
  > the code, and in a real browser — before explaining why it should be fine.
  > Every root cause is in `READER.md`'s trap list.

### Measure in a real browser. It is what element 3 was made of.

Chromium is at `/opt/pw-browsers/chromium` and Playwright installs into the
project (`npm i --no-save playwright`). Seed IndexedDB directly (store
`keyval-store` / `keyval`, key `setlists-md:settings`, `unifiedReader: true`)
and drive the real app. **Four of element 3's bugs were invisible in the code
and obvious under measurement**, including two that predated the element.
⚠ Scope every query to the full-screen dialog — see the two-readers trap.

---

## Where the walk got to

| # | Element | State |
|---|---------|-------|
| **1** | Top bar | ✅ closed — it turned out to contain all of **edit mode** |
| **2** | The ☰ — the reader's settings menu | ✅ closed, 15 rounds |
| **3** | Structure ribbon | ✅ closed 2026-08-06, 13 rounds |
| **4** | **Section heading** | **NEXT — this session** |
| 4b | Band cue | renders on the heading's own line; likely settled in the same pass |
| 29 | The setlist rail | shipped as a strip; *"some work in the future. Not quite now."* |

**The numbering moved twice.** The ☰ was 28 and became **2**, pushing the ribbon
2 → 3; that left the section heading (then 3) colliding, so on 2026-08-06 it
became **4** and the band cue **4b**. Later numbers (5–13, 24, 29) are
deliberately untouched — they were never an order.

---

## Element 4 — the section heading. What is actually there

`src/features/reader/ReaderSection.jsx` (the frame, the sticky heading, the
cue), with `src/lib/sectionIdentity.js` as the single source of a section's
code, name, colour and weight. **Measure before designing.**

Already decided (in `READER.md`, do not re-open without a reason):

- **The user chooses the wording** — full name / letters / ALL CAPS
  (`readerHeading`). ALL CAPS is the original chart's heading, kept on request.
- **Per-type colours, matching the ribbon**, both from `sectionIdentity` — the
  chip and the heading it points at are visibly the same object.
- **A chorus is clearly heavier than a verse** — bigger, thicker rule, more air
  above, and it **steps in** by `0.85rem`. `heavy` is songFlow's HEAVY set
  (Chorus/Refrain/Bridge). The page should have a shape you can read without
  reading the words.
- **Sticky on a phone, never on a desktop.** Pins at `stickyTop - 1` (overlap,
  never abut — a fractional-DPR device shows a sliver through any seam).
- **Four frames** — Bar / No line / Block / Card (`readerSectionStyle`), with
  `plain` ("no line") the default since 2026-08-04: *"a chart is paper, and
  paper has no frames on it."*
- **Repeats: Full · Tag · Hidden** (`duplicateSections`). A Tag is the PDF
  export's pill, `↩ Chorus`, and **tapping it opens that repeat in place**
  (element 3, 2026-08-05). Hidden draws nothing but keeps its slot on the map.
- **The heading is the reading line.** `useActiveSection` is given `headH`, so
  the ribbon changes at the exact moment the heading pins — and a chip's jump
  lands the section 1px *under* the header for the same reason. Anything that
  changes where a heading sits changes both.

**Owner's parked item, to raise IN THIS PASS (he asked to be reminded):**
tapping a Tag to open it in place is shipped but *not settled* — *"I don't know
if I like the clicking on a tag to expand, but I'll think about it in the
respective element, remind me."*

**Questions worth asking first** (his answers are the deliverable, not your
opinions): does a repeated section need to look different from its first play
beyond the pill? Should the cue (4b) ever wrap to its own line, or stay on the
heading's line at any length? Is the chorus's indent doing enough work, or
should the *frame* carry the weight instead? What happens to a heading when the
section is only two lines long — is the sticky pin worth it? Should a section
carry anything else at all (its key after a modulate, a bar count, who plays)?

---

## Just closed — element 3, the structure ribbon (13 rounds, beta.78 → beta.90)

Three styles (**Boxes · Chips · Dots**) and five positions, of which **left and
right are always dots** — small enough to float inside the margin the chart
already had, so the map never covers a word and never pushes one aside. The ends
of a scrolling row fade. A key change shows as a gold `↗B` naming the key you
*arrive* in. Tapping a Tag opens it where it stands. **A chip lands its section
ON the reading line** so the map and the chart never disagree. The side rail
shows the whole song and **scrubs** under a thumb. Editing takes the map to the
top and hands it back on exit.

Full account: `READER.md` → "The element-3 pass".

### ⚠ The lesson to carry into element 4

**Element 2's was "grep both ends".** Element 3's is one step further out:

> **Drive it in a browser, or you are guessing.** Four bugs in this element were
> invisible in the code and unmissable under measurement — and *two of them
> predated the element*: the chart had never used the window's full width
> (840px in a 1236px scroller), every full-screen jump had been measuring a
> section in a **different reader**, painting the rail under the chart made the
> whole map silently untappable, and the next song kept the previous song's
> scroll position (prio 0, reported by the owner).
>
> A tap that does nothing is silent. A layout that is merely *narrower* still
> looks correct. Neither has a failing test to write in advance — they have a
> measurement.

---

## Known-open, carried forward

- **The side rail's interaction as a whole** — the owner is thinking about it.
  The window/scrub/dots are round 1 of an answer, not the answer.
- **§7 #13 — two chord pickers, and underneath them two chord MODELS.**
  `ArrangeTabV2` uses `{ plainText, chords: [{ pos, chord }] }`; the reader and
  the `.md` use `[C]inline` strings. This is why the reader can replace a chord
  but cannot yet *add* one. Unify the model first.
- **§7 #14 (prio 2) — draggable song sections on the page.**
- **§1.2 #3c — you cannot type a space into a band cue or an inline note.**
  Root-caused, not fixed, owner's prio 1: every keystroke round-trips through
  `songToMd`/parse and `parser.js` trims it. **This one is element 4b's
  neighbour — worth fixing while you are in the cue.**
- **§1.2 #3d — add a cue/inline note from the SONG HUB**, without the editor.
- **§1.1 #4 — graduate the flag and delete the old surfaces.** A session of its
  own; the owner will call it. ⚠ `PerformanceView`/`PracticeView` are the
  **only** writers of `showChords`, now just a migration fallback — deleting
  them is the moment to drop it. Settings → Chart Style goes with them.
- **Whether to reset defaults for everyone** — the owner decides once the
  elements are finished. Nothing resets today.
- **Element 13:** the post-practice screen should summarise what changed.

---

## True, and easy to get wrong

- **There are TWO readers in the DOM** with the flag on — the Song Hub's
  embedded one sits behind the full-screen one, and both render
  `id="section-N"`. Never `document.getElementById` for a section; scope to
  `scrollRef.current`. Same for any browser probe.
- **Paint order is hit-test order.** An overlay moved *under* content to keep
  that content readable becomes untappable, including under the content's
  padding. Separate by geometry.
- **Firefox draws two focus artifacts Chromium does not** (`:-moz-focusring`
  and `::-moz-focus-inner`). On a small round control the second reads as a line
  *inside* it. Test round controls in Firefox.
- **The Song Hub renders `Reader`, not `ChartView`,** when the flag is on.
  Three places can cause a "hub theme bug": the reader, the chart, and the hub's
  own card.
- **`min-h-0` on every small control.** `button { min-height: 36px }` (44px on
  phones) lives in `@layer base` and beats every `height` utility.
- **Inside `overflow-y-auto`, a wrapper must GROW with its content**
  (`flex-1 min-h-0` caps it) — and on the CROSS axis a flex item needs `flex-1`
  or it is shrink-to-fit. Both cost real bugs; both have guards now.
- **A size change inside a flex column moves every sibling below it.** Fixed
  cell, resize the paint inside it.
- **CSS custom-property cycles** are invalid at computed-value time and unset
  the whole subtree. Every fallback must be a literal.
- **`chartSurface` remaps `--ds-gray-` 100–400, 700 and 1000 only.** Check the
  steps whenever the reader adopts another shared component.
- **jsdom's CSS shorthand parser throws on some values inside the `background`
  shorthand**, during the `cloneNode` every role query does — one bad inline
  style takes out every `getByRole` on the page. Use `backgroundColor` /
  `backgroundImage` longhands inline.
- **`mockWidth` in `reader.test.jsx` answers per query**, against a real width.
  Any new breakpoint needs the same check.
- **React's synthetic touch listeners are passive** — `preventDefault()` in an
  `onTouchMove` prop is a no-op. Native listener, `{ passive: false }`, in an
  effect. Same for any gesture that must take the scroll (the ribbon's drag, the
  rail's scrub, pull-to-finish).
- **An effect that owns a gesture must not depend on anything that changes**, or
  its cleanup tears the gesture down mid-drag.
- **`applyKeyHistories` is reference-preserving on purpose.**
