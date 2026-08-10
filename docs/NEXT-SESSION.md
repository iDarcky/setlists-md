# Next session — the flag graduation + the Practice/Live union, together

> **Short-lived handoff.** It exists because a new chat session starts with **no
> memory of previous conversations** — only this repo.
>
> _Rewritten 2026-08-10. State: `0.17.0-beta.95`, and **`beta` is at the same
> commit** — elements 1, 2, 3, 4, 5 (with 5a), 6/7 and 19 are all promoted onto
> it. 1025 tests, 0 lint errors (8 pre-existing warnings), build clean._
>
> ⚠ **`git checkout beta` may land you on a stale LOCAL branch.** It happened on
> 2026-08-07 and silently reverted a whole element's work in the tree. Always
> `git fetch origin beta` and branch from `origin/beta`.

---

## The user situation changed — read this before you plan around it

Earlier handoffs said `beta` was production. **It is not.** Owner, 2026-08-10:
*"There are no live users on beta, he was at my place and I showed him beta,
that's all, we can do whatever we want on beta."*

So: `beta` is a real staging branch again. Ship bigger rounds there, break
things, fix them. `main` is still the released thing (0.16.0) and still only
takes changes through a PR.

What has NOT changed: **measure before you ship**. This element found five bugs
nobody had reported, every one of them invisible, and it found them by measuring
rather than by reading the code.

---

## The working agreement (the owner's, restated)

1. **One element at a time.** Ask the open questions and let him decide **before
   building**. Batch them — 4–6 is fine.
2. **Build exactly what is asked.** No adjacent settings, no knobs nobody
   requested.
3. **Ship every round to the feature branch only.** He tests and says when it is
   done; you promote at the close.
4. **Serialise visual builds** — one at a time.
5. **"IF I SAY SOMETHING LOOKS WRONG, IT IS WRONG.** Go and measure it in the
   code — and in a real browser — before explaining why it should be fine."
   ⚠ Corollary learned this element: when you measure and **cannot** reproduce
   it, say so plainly with what you tried, and ask for the missing condition.
   Twice this element that was the right call and the bug turned out to be real
   but conditional.
6. At the close: finish, promote to `beta`, update the docs, write this file,
   and give him the next super prompt **in chat**, not only in the file.

### How to measure in a real browser

Chromium is at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; `playwright`
is installed **globally** (`/opt/node22/lib/node_modules`), so symlink it into
your scratch dir (`ln -s /opt/node22/lib/node_modules node_modules`) and drive
the real app. Seed IndexedDB (`indexedDB.open('keyval-store')`, store `keyval`;
settings under `setlists-md:settings`, songs under
`setlists-md:song:personal:<id>` with the index at
`setlists-md:songidx:personal`, setlists under
`setlists-md:setlists:personal`). Set `settings.unifiedReader = true`.

- **The SETLIST reader is a ROUTE, not a `[role=dialog]`.** Only the Song Hub's
  full screen is a dialog. (The hub now UNMOUNTS its embedded reader while full
  screen is open, so the two-readers trap is gone — but scope your queries
  anyway.)
- `npm install` first: `vite` is not in the image.
- Element 6/7's probes are worth copying wholesale — they seed a song + setlist,
  navigate Setlists → a set → Practice, enter edit mode, and assert on
  `aria-label`s and `getBoundingClientRect()`.

---

## What the next session is

**The `unifiedReader` graduation AND the Practice/Live union — as ONE change.**
The owner asked for both and agreed to do them together; they rewrite the same
seven branches in `App.jsx` (`setlist-play`, `setlist-performance`,
`setlist-practice`, plus the two finales), so doing them apart means writing
those lines twice.

### Graduation — what "swap, don't delete" actually means

Owner: *"I think we should graduate the flag, but not delete the old chart yet,
just swap it."*

⚠ **Flipping the default does NOT graduate anyone.** `loadSettings` returns
`{ ...DEFAULT_SETTINGS, ...stored }` and `saveSettings` persists the merged
object — so every existing profile already has `unifiedReader: false` written
down. The graduation is to **stop reading the flag at the call sites**:

| file | what it does today |
|---|---|
| `App.jsx` ×7 | the three setlist routes + two finales fork on the flag |
| `SongHub.jsx` ×2 | embedded reader, and full screen |
| `Editor.jsx` | the preview pane |
| `SharedSetlistViewer.jsx` | the public share link |
| `Settings.jsx` | the Labs toggle — **delete it**; a toggle that does nothing is exactly the bug family this element found four times |

`ChartView`, `PerformanceView`, `PracticeView` and `SetlistPlayer` stay in the
tree, unreferenced, for a later delete. The Songs page's dead `ChartView` import
is already gone.

### The union — the decision, and the reason

Owner, after arguing both sides: *"Ok, you've convinced me we are dropping the
practice button and we go all in."*

The argument that settled it: **Live is a strict subset of Practice.** In
`lib/readerConfig.js`, `VIEW.live` has `transpose: true` and *every other
capability false*. A mode that can only do less is a **permission level, not a
view** — and permission levels belong in a lock, not a destination. Plus **edit
mode is already opt-in** (you must press Edit), so the accidental-service-edit
the fork exists to prevent is already prevented.

Agreed shape:

- **One reader, one lock.** The lock turns off everything that can change the
  song, keeps the screen awake, strips the tools.
- **Phase 0 first, and it is worth doing on its own:** put the state ON SCREEN —
  a small chip in the top bar, exactly like the capo chip. Today the mode is
  invisible (you chose it two screens ago and nothing says so), which is the
  real source of *"where did my settings go? why didn't the key change?"*
- **Default: unlocked.** Reasons, in order of weight: edit mode is already
  opt-in; forgetting to lock costs an edit that needs a deliberate Edit press
  and has Undo, while forgetting to unlock blocks you mid-rehearsal; most opens
  are not services; a default that removes capability teaches people the app
  cannot do things.
- **The setlist screen keeps both buttons** at first — they become "start
  locked" / "start unlocked", so no muscle memory is lost while the routes
  collapse underneath.
- Idea, flagged as an idea: the lock could arm itself when the setlist's date is
  today.

**The decision rule the owner can re-apply:** does Live ever need to do
something Practice *doesn't* — not less of, but MORE (a countdown, band-wide
page sync, giant type)? Today the answer is no. If it becomes yes, they are two
views again and the lock was wrong.

### After that: element 8 — key change

The owner asked whether it is fast. It should be: it is designed and built
already (`READER.md` → "8 — Key change"), a solid `--chord` chip naming the
ARRIVAL key rather than the interval, `mt-5 mb-4`, and a section repeated after
a key change always renders in full. The pass is polish plus whatever the
element turns up — and on this element's evidence, it will turn something up.

---

## What element 6/7 changed under you

Read `READER.md` → "The element-6/7 pass" in full. The parts that change how you
work in this code:

- **`SectionBlock` chord spacing is now CSS arithmetic.** `clearanceFor()`
  returns `max(0px, calc(…))` built from three measured constants
  (`WORD_GAP_EM` 0.4, `CHORD_CHAR_EM` 0.6 exact for mono, `LYRIC_CHAR_EM` 0.48 —
  the measured ceiling; 0.50 collides at lyric size 28). JS contributes only
  character COUNTS; both font sizes are live CSS variables and a number baked in
  at render is stale the instant the Aa menu moves.
- **`notateChord`'s 'auto' now preserves each chord's own accidental**
  (`transposeKeepingSpelling`). Naturals ask the destination key. Do not
  "restore" key-based spelling — the owner killed that explicitly.
- **`capoFor` / `withCapo` / `suggestCapo`** in `src/lib/capo.js`. A capo is
  **never** written to a song or a setlist item; there is a test asserting the
  module never learns to.
- **`addNewSection`** in `lib/editStructure.js` writes `sections` AND `structure`
  in one patch. Two writes leave a window where the song names a section it does
  not have and `buildSongFlow` drops it.
- **`SectionTypeMenuItems`** moved to `@/features/chart/SectionTypeMenu`, with
  `sectionTypeOptions()` in `lib/sectionIdentity`. Four callers now.
- **`sectionConfig`** — editing forces `repeats: 'full'` as a COPY of the config.
- **`PopMenu` caps its own height** from the trigger's position. Do not put a
  `max-h-*` back in a `menuClassName`.
- **Both preview panes are gone**, with the props that fed them
  (`previewSetlistId`, `onSelectPreview`, and the export/practice callbacks the
  pane needed).

---

## Traps that have already cost hours

Full list in `READER.md` → "Traps that have already cost time". The ones this
element added or re-earned:

- ⚠ **A switch wired at ONE end is the house bug.** Five in this element alone:
  `--chart-chord-size` (read, never written), `--chart-line-gap` (same),
  `destructive: true` (passed, never read — the discard confirm rendered its
  most destructive button as its most neutral), a dead `ChartView` import, and
  `arrangement.capo` (collected, never read, under a false hint). **When you add
  a switch, grep its read site and its write site in the same breath.**
- ⚠ **A guess about a thing's size is wrong the moment it grows.** `PopMenu`
  flipped on `spaceBelow < 280`; eleven section types are 473px.
- ⚠ **An absolutely-positioned mark costs nothing; the same mark in flow costs
  its own width.** The word-join rule added 7.5px to every syllable it was meant
  to be silent about, because `flex-basis: 0` still contributes max-content to
  the column's intrinsic width.
- ⚠ **`background`/`outline` SHORTHANDS with a nested `var(a, var(b))`** throw in
  jsdom's expander inside the `cloneNode` every `getByRole` performs. LONGHANDS,
  always.
- ⚠ **Brittle source-string tests break on every refactor.** Three did this
  element. Prefer asserting the RENDERED style (`el.style.width`) — jsdom does
  not lay out but it does carry inline styles, and the style IS the decision.
- A sticky element's painted box must reach the content it covers; only PADDING
  paints.
- `overflow-x: auto` forces `overflow-y` from `visible` to `auto`.
- `flex-1` on the cross axis of a scroller: an item without it is shrink-to-fit.
- Paint order is hit-test order.
- A `vi.fn()` for `onUpdateSong` tests only the CLEAN path — hand the change back
  via `rerender`, the way the parent does.

## Things that are built and must NOT be deleted

- **`src/sync/merge.js`** — field-level three-way merge, 11 passing tests, wired
  to nothing. It stops a Yes/Yes conflict (one person fixed a tempo, another
  added a tag) reaching a human — the "73 conflicts" symptom in CLAUDE.md. Owner,
  2026-08-10: *"Ok, we need to wire it, I got it."* It has an owner now; it needs
  a session.
- **`ChartView` and the three legacy views** — deliberately left in the tree by
  the graduation above. Delete them in a later, separate pass.

## Open, and named, but not scheduled

- **31 — arrangements.** The v2 schema has carried `arrangements[]` from the
  start and almost nothing uses it. Owner: *"We need a way to handle arrangements
  to songs."*
- **32 — bars in the `.md`.** The format carries no bar information at all.
- **33 — the Song Hub's tabs.** Three is one too many; probably zero.
- **The dashboard activity feed should open the song, and show the diff.**
  `storage.js` already has `loadVersions`/`pushVersion`, so the data is there.
- **PDF export** is a separate renderer by necessity, and the owner wants it
  improved next-ish.
