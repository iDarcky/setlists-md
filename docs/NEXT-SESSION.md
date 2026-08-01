# Next session — the Reader

> **Short-lived handoff.** Delete it when the Reader graduates from Labs.
> It exists because a new chat session starts with **no memory of previous
> conversations** — only this repo.
>
> _Rewritten 2026-08-01. State: `0.17.0-beta.42` on `beta`, branch
> `claude/reader-element-12-practice-ax9bk5`. 798 tests, 0 lint errors
> (8 pre-existing warnings)._

---

## Start here

1. **This file.**
2. **`docs/READER.md`** — the element-by-element decision log. **The important
   one.** Every element carries a decision the owner made and the reason behind
   it. Treat them as settled; don't re-open them.
3. `CLAUDE.md` — how the app works.
4. `docs/PLAN.md` §1 — what is parked and in what order.

**Do not raise graduating the `unifiedReader` flag.** The owner has asked twice
to stop mentioning it. It is his call and it is not close.

---

## Read this before anything else: three fixes were claimed and did not work

On 2026-08-01 three fixes were reported as done. The owner, on beta.41, found
that none of them worked. He was right, and the code **was** on `beta` — they
were wrong, not missing. Two root causes, now fixed, now in `READER.md`'s trap
list:

1. **Two `sticky bottom-0` siblings do not stack.** The bottom structure ribbon
   got its own sticky block at `z-10`, "above" the nav block at `z-20`. They
   both pin to the same 0px and the higher z simply covers the other — it was
   there, pinned, and painted underneath the nav bar. → **one block, several
   rows**, which is what elements 12 + 10 already did.
2. **`Math.ceil` on a measured sticky offset creates the gap it was meant to
   close.** `headH` was rounded up so the pinned heading "could not overlap the
   divider". Backwards: on a fractional-DPR phone the header is 73.33px, ceil
   gives 74, and the heading pins 0.67px *below* it — a sliver of scrolling
   chart, which is precisely the hairline the owner reported. → measure raw, and
   **overlap by a pixel** (`top: stickyTop - 1` + matching padding).

The third — the ribbon changing at the moment the heading pins — was a real fix
(`useActiveSection` takes an exact `linePx` instead of a viewport fraction; the
reader passes `headH`) and may simply have been masked by the other two. **Check
it on a phone before touching it.** If it is still wrong the next suspects are
`readerSticky` off, or testing on a tablet, where `config.sticky` is false by
design and nothing pins at all.

**The lesson:** when the owner says something looks wrong, go and measure it in
the code. Do not explain why it should be fine. Most of what cost rounds this
session was explaining instead of measuring.

---

## Working agreement (the owner's, stated repeatedly)

- **One element at a time. Ask the questions and let him decide BEFORE
  building.**
- Build exactly what is asked. No adjacent settings, no knobs nobody requested.
- **Ship every round to `beta`** via the "finish" workflow in `CLAUDE.md` — he
  tests on his phone. A description of a change is not a change.
- Batch the **questions** (4–6 at a time; he answers them all in one go).
  Serialise the **builds** — anything visual goes one at a time, because "it
  doesn't feel right" only surfaces on the device.

---

## Just shipped (beta.42) — all of it needs testing on a phone

| What | Where |
|---|---|
| Bottom ribbon moved into the nav's sticky block | `Reader.jsx` |
| Pinned heading overlaps the divider by 1px | `ReaderSection.jsx` |
| `headH` measured raw from the border box (no ceil) | `Reader.jsx` |
| Ribbon reads the pin line in px (`linePx`) | `useActiveSection.js` |
| Inactive chips: outline + section colour, no fill, no opacity | `StructureRibbon.jsx` |
| Left/right ribbon floats, transparent, now allowed on phones | `Reader.jsx`, `readerConfig.js` |
| **SET / HEADER / STRUCTURE** — the set bar sits above the title row | `ReaderTopBar.jsx` (`aboveBar` prop) |
| Repeats gain a third value, `hide` — nothing drawn, ribbon still lists it | `readerConfig.js`, `ReaderSection.jsx` |
| Tap tempo (4 taps) · type an exact tempo · **Save to song** | `metronome.js`, `ReaderPracticeRow.jsx` |
| 1/2 columns hidden on phones | `ReaderMenu.jsx` |

---

## The views — the map, agreed

A view is a **template of the Reader**: one renderer, different defaults and
different chrome. Never a different chart.

| # | View | Opens from, and only from |
|---|---|---|
| 1 | Song hub full screen | the hub's full-screen button. From the side peek it expands **within the peek** |
| 2 | Campfire | the Campfire button. Needs recommended-next at the bottom |
| 3 | Live | Play in the setlist hub |
| 4 | Practice | Practice in the setlist hub. Needs a rework |
| 5 | The hub view | the Chart/Lyrics tab, the peek at rest, the editor preview. **No settings at all** |
| 6 | Shared setlist viewer | a public link. ❓ view or separate renderer — undecided |
| 7 | Print / PDF | a genuinely different renderer. Stays that way |

`setlist-play` and `setlist-performance` are **two routes into view 3** with
identical props, differing only in which finale they land on. One should go.

---

## Where the element walk got to

Elements 1–14 are built. The owner's answers to 15–27 are in `READER.md`,
verbatim. His stated order from here:

1. **Element 12** — the tap-tempo work above landed but has not been reviewed.
   Ask before changing anything else in the row.
2. **Element 8b (setlist bar)** — still marked "needs a rework", and the new
   SET/HEADER/STRUCTURE stack is unreviewed.
3. Batch **15 · 17 · 18 · 27** — all behaviour, no visuals.
4. Batch **16 · 19 · 21 · 22** to decide; build one at a time.
5. **24** (stage view) and **25** (follow the leader) last, each on its own.

---

## Parked, in `PLAN.md`

- 🔴 **§1.2b prio 1 — rethink the colours across every theme.** Two piecemeal
  fixes (the dark ramp's hue fighting its own ground; Midnight tinting only half
  its scale) are evidence the themes were never designed as a set.
- 🟡 Separate volumes for the click and the backing track.
- 🟡 Custom chord shapes, for chords with no shape in the library.
- ⏭️ Auto-scroll — deferred until sections carry lengths in the `.md`.

---

## True, and easy to get wrong

- **The Song Hub renders `Reader`, not `ChartView`,** when the flag is on. Three
  places can cause a "hub theme bug": the reader, the chart, and the hub's own
  card. `PLAN.md` §1.2 has the warning box.
- **`min-h-0` on every small control.** `button { min-height: 44px }` on phones
  lives in `@layer base` and beats every padding utility. Four rounds lost.
- **CSS custom-property cycles** are invalid at computed-value time and unset
  the whole subtree. Every fallback must be a literal or name a *different*
  property.
- **`resolveReaderConfig(settings, { embedded: true })` ignores `settings`
  entirely** and returns `HUB_VIEW`. Deliberate — the hub view is the Reader
  with the settings wire cut. Do not reconnect it.
- **Tempo cannot come from a YouTube link.** No BPM in the IFrame API, and the
  audio can't be analysed from a cross-origin embed (`createMediaElementSource`
  needs same-origin). Spotify's `audio-features` carries tempo but is closed to
  new apps. Tapping is the answer, and it is built.
- **`applyKeyHistories` is reference-preserving on purpose.** A map that
  re-mints every object reintroduces whole-library IndexedDB rewrites on launch.
