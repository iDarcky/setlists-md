# Next session — the Reader, element 6/7 (Chords and lyrics)

> **Short-lived handoff.** It exists because a new chat session starts with **no
> memory of previous conversations** — only this repo.
>
> _Rewritten 2026-08-09. State: `0.17.0-beta.94`, and **`beta` is at the same
> commit** — elements 1, 2, 3, 4, 4b and 5 are all promoted onto it. Start
> element 6/7 on a fresh branch off `beta`.
>
> The owner tests on his phone and compares against `beta`, so during an element
> ship each round to the **feature branch only** and promote at the close.
> 990 tests, 0 lint errors (8 pre-existing warnings)._
>
> ⚠ **`git checkout beta` may land you on a stale LOCAL branch.** It happened on
> 2026-08-07 and silently reverted a whole element's work in the tree. Always
> `git fetch origin beta` and branch from `origin/beta`.

---

## There is a real user. This is not a pre-launch repo any more.

- **24 accounts, three humans who actually use it.** The owner; **Centreap**
  (`r.centea00@`), who owns the *Inchinare Sincera* workspace — 108 songs, 18
  setlists, active 20 of the last 30 days; and Beniamin, 12 of 30.
- `main` is far behind `beta` and still on `0.16.0`. The live users are on
  `beta`, so **`beta` is production AND staging at once.**

**What this changes for you:** shipping a broken `beta` breaks somebody's Sunday
service. Measure before you ship, and prefer a round smaller than you think it
should be.

---

## The working agreement (the owner's, restated)

1. **One element at a time.** Ask the open questions and let him decide **before
   building**. Batch them — 4–6 is fine.
2. **Build exactly what is asked.** No adjacent settings, no knobs nobody
   requested.
3. **Ship every round to the feature branch only.** Not `beta`. He tests on his
   phone against `beta` and promotes when he says the element is done.
4. **Serialise visual builds** — one at a time.
5. **"IF I SAY SOMETHING LOOKS WRONG, IT IS WRONG.** Go and measure it in the
   code — and in a real browser — before explaining why it should be fine."
6. Don't raise graduating the `unifiedReader` flag; that's a session of its own.
7. At the close: finish, promote to `beta`, update the docs, write the next
   handoff.

### How to measure in a real browser

Chromium is at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Drive the
real app with Playwright and seed IndexedDB (`indexedDB.open('keyval-store')`,
store `keyval`; settings under `setlists-md:settings`, songs under
`setlists-md:song:personal:<id>` with the index at
`setlists-md:songidx:personal`). Set `settings.unifiedReader = true`.

- **The SETLIST reader is a ROUTE, not a `[role=dialog]`.** Only the Song Hub's
  full-screen reader is a dialog, and only there are **two readers in the DOM at
  once** — scope every query to the right one there.
- Working probes from element 5 are worth copying: they seed, navigate
  Setlists → a set → Practice, and assert on `aria-label`s.

---

## Element 6/7 — what it is

`docs/READER.md` → "### 6/7 — Chords and lyrics". It is **one pass covering both
numbers**. Unusually for an element, most of it is already decided:

- Chords above lyrics, per-word grouping so a line only ever wraps at a space.
- **Lyrics are NEVER truncated.** Owner: *"never, but never ever use … or
  something else, the lyrics should always be shown."*
- **Chord spacing** is a balance of two failures: a fixed trailing space shoves
  lyrics apart whenever one chord is long; no spacing lets neighbours collide.
  The rule: a chord keeps a real gap whenever **any** chord follows it later on
  the line (`chordFollows`), and only overhangs when it is the last one. An
  earlier version checked only the *immediately* next segment and a chord two
  segments later still collided.
- Sizes, colour, font and notation are all user-settable; chords size off
  `--chart-font-size-chord`, never inherited size.

So this is a polish-and-decide pass on the reader's densest surface, not a build
from nothing. **Start by measuring what it actually does today** — real numbers
from a real browser, per the agreement — then bring him the open questions.

### The two decisions it inherits

1. **⚠ Element 19 — capo — lands inside this pass.** The chart shows *sounding*
   chords; a capoed guitarist wants *shapes*. `capo` is on the arrangement and
   the reader ignores it entirely. Element 11 already ruled capo out for
   **diagrams** ("chart says G, tap G, get the G shape" — a capo-adjusted shape
   would name a chord that appears nowhere on screen). **The chart itself is
   undecided**, and it is the same question one level up. Raise it early: it
   changes what a chord *is* on this surface.
2. **Nashville and letters share one renderer.** `notateChord` handles both, and
   diagrams look shapes up by letter name because you cannot finger a "1". Worth
   checking the seams while you are in here.

### Where the code is

- `src/features/chart/SectionBlock.jsx` — the only place that knows about chords,
  tabs, modulate markers and word-grouping. `groupChordWords`, `renderChord`,
  `chordFollows`, the gutter grid. **This is the file.**
- `src/features/reader/ReaderSection.jsx` — the frame, the sticky heading, the
  cue, and the note-draft state.
- `src/music.js` — `transposeChord`, `notateChord`, `sectionStyle`.
- `src/parser.js` — `parseLine`, and `lineToPlacement`/`placementToLine`, the
  lossless bijection between `[C]inline` strings and `{plainText, chords[]}`.

---

## What element 5 just changed under you

Read `READER.md` → "The element-5 pass" in full before touching the reader. The
short version, because it changes where controls live:

- **Editing is ONE mode.** Outside it, a cue and a note are text — nothing on the
  chart is editable. Inside it, everything is at once: no arming, no picking.
- **Three surfaces, one rule.** The top bar says *where you are* (☰ · title · key
  · ✕) and **carries no tools in any view or mode**. The corner says *what you do
  to the song* (Edit / Done, click / Undo). The footer says *where you're going*.
- **There is no edit bar.** Done → the big circle; Undo → the satellite; Cancel →
  the top bar, **as the word "Cancel"**, confirming only when dirty; New version
  → a pill above the circles when dirty.
- **The ☰ is GONE in edit mode** (not disabled). *"You're changing the song, not
  the screen."*
- **Live can do nothing to a song** — `practiceTools: false`, so no circles and
  no metronome there at all.
- `SectionBlock` gained note props: `onNoteOpen`, `noteDraft`,
  `onNoteDraftChange`, `onNoteCommit`, `noteHint`. All null outside the reader,
  and the component behaves exactly as it always did when `onNoteOpen` is null.

---

## Traps that have already cost hours

Full list in `READER.md` → "Traps that have already cost time". The ones most
likely to bite in a chords-and-lyrics pass:

- **⚠ `background` / `outline` SHORTHANDS with a nested `var(a, var(b))`.**
  jsdom's expander throws on them, inside the `cloneNode` that **every
  `getByRole` performs** — so one shorthand on a button takes out every
  role-based test that renders the reader. It took out 37 at once. **Longhands,
  always**: `backgroundColor`, `borderStyle`/`Width`/`Color`.
- **⚠ A sticky element's painted box must reach the content it covers, and only
  padding paints.** A 6px `mb-1.5` under the pinned heading was a transparent
  strip the lyrics scrolled through; a Romanian ț's comma landed in it and read
  as a mystery dot above the next section.
- **A line box can FRAGMENT across multicol columns** — `break-inside: avoid` is
  on the line divs for that reason. (It was *not* the ț bug, but it is real.)
- **`overflow-x: auto` forces `overflow-y` from `visible` to `auto`.** The ribbon
  had 3px of accidental vertical scroll and rubber-banded on touch.
- **`flex-1` on the cross axis of a scroller.** A flex item with no `flex-1` is
  shrink-to-fit: the chart once laid out 840px wide on a 1280px screen with
  400px of dead window beside it.
- **Paint order is hit-test order.** Putting an overlay under content to keep it
  readable also puts it under for pointer events — including the content's
  padding, which is empty space.
- **A `vi.fn()` for `onUpdateSong` silently tests only the CLEAN path.** The
  reader does not own the song; a mock that swallows the write means the song
  never changes and the reader is never dirty. Hand the change back via
  `rerender`, the way the parent does.
- **`findByRole` retries `getByRole`, which walks and clones the whole tree.**
  Against the reader that is slow enough to look like a hang. If you are waiting
  on one microtask, use `await act(async () => {...})`.

## One class of bug worth sweeping for

Element 5 found **three of one family**, none of them reported, all invisible:

- a capability **declared and read by nothing** (`writeNotes`, `saveKey`)
- a field **read but never written** (`item.key`)
- a setting **read but never written** (`settings.stageMode` — bassist
  root-emphasis was fully built and reachable by no user)

They all present identically: *you use the feature, nothing happens, no error
anywhere.* When you add a switch, grep for its read site and its write site in
the same breath. `readerConfig`'s remaining capabilities are clean;
`switchArrangement` reads zero, but honestly — element 21 is not built.

## One thing that is built and must NOT be deleted

`src/sync/merge.js` — field-level three-way merge, **11 passing tests**, wired to
nothing. Every orphan sweep flags it. It exists to stop a Yes/Yes conflict where
one person fixed a tempo and another added a tag from reaching a human, i.e. the
"73 conflicts" symptom in CLAUDE.md. It needs an owner and a session, not a
delete. Logged in `PLAN.md` §3.6.
