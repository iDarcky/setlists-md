# Next session — the Reader

> **Short-lived handoff.** Delete it when the Reader graduates from Labs.
> It exists because a new chat session starts with **no memory of previous
> conversations** — only this repo.
>
> _Written 2026-07-29, at the end of the element-by-element design walk
> (elements 1–11 built, shipped through `0.17.0-beta.19`)._

---

## Start here

Read, in this order:

1. **This file** — where things stand, what to do next.
2. **`docs/READER.md`** — the element-by-element decision log. **This is the
   important one.** Every element carries a decision the owner made and the
   reason behind it. Treat them as settled; don't re-open them.
3. `CLAUDE.md` — how the app works.
4. `docs/COMPONENTS.md` — what the pieces are.

The previous handoff's brief ("collapse three surfaces into two, with presets")
is **done and superseded**. Presets were scrapped; there is **one** viewer with
flat settings. `docs/views-vision.md` and `docs/views_questions.md` are history
— read them for background, never for instructions.

Its two named defects are both resolved: the reader's exit is always visible
(element 1 is fixed, with no auto-hide), and the `chart → song` back-edge
question was answered by the Song Hub owning identity while the reader is just
the reader.

---

## Where things stand

**Built and on `beta`, behind the Labs flag `unifiedReader`** (Settings → Labs):

| | Element | State |
|---|---------|-------|
| 1 | Top bar | done — fixed, no customization, `ReaderTopBar` shared with breaks |
| 2 | Structure ribbon | done — Score geometry, per-section colour, 5 styles |
| 3 | Section heading | done — name/letters/CAPS, sticky on phone only, repeats-as-reference |
| 4 | Band cue | done — on the heading line, 240-char cap, `!` = loud |
| 5 | Inline notes | done — leader on wide, above-the-line on narrow |
| 6/7 | Chords + lyrics | done — lyrics never truncated, `chordFollows` spacing |
| 8 | Key change | done — names the arrival key |
| 9 | Tabs | done — instrument-aware, never side-scrolls, transpose-or-say-why |
| 10 | Song-to-song | done — 4 nav styles, sticky footer, rail incl. phones, breaks |
| 11 | Chord diagrams | done — tap a chord, Pro-gated, no strip |
| 12 | Practice tools | done — metronome + slow-down, one row above the footer |
| 13 | Finale | done — ONE finale, Time only, leaders-only reflection |

759 tests, 0 lint errors. `npm run dev` · `npx vitest run` · `npm run build`.

**Nothing has been deleted.** With the flag off, `SetlistPlayer`,
`PerformanceView` and `PracticeView` render exactly as they did, and
`ChartView` still serves the Song Hub.

---

## What to do next

### 1. Element 12 — practice tools — DONE (round 1)

Shipped: metronome (accented downbeat off the song's `time`), a bpm stepper, the
backing track brought into the Reader with its own **independent** rate stepper,
all in ONE row above element 10's nav bar. Entry is one icon beside ☰. No
count-in, no section loop, no wake lock — **all three were explicitly cut**.
Full reasoning in `docs/READER.md` §12.

The framing fact, measured rather than assumed: **none of these tools existed to
port.** `PracticeView` had no `AudioContext`, no click, no `playbackRate`, no
loop, no autoscroll. The old Practice screen was a chart viewer with different
chrome, so deleting it costs only the finale stats.

Round 1 is on the owner's phone for testing. Wait for their verdict before
building anything more here — the loop/count-in decisions are recorded as cuts,
not as backlog.

### 2. Element 13 — the finale — DONE

One `ReaderFinale` replaces `LiveFinale` + `PracticeFinale` (~500 lines, ~80%
identical). **Time is the only stat** — songs-reached, breaks, key-change and cue
counts were all cut. "What changed" lists key changes only, derived from the
reader's own transpose state. The reflection is now **leaders-only, RLS-enforced**
(`team_setlist_notes` + `useLeaderNote`), because the old `serviceNote` field
synced to every member's device. Reasoning in `docs/READER.md` §13.

**⚠ This element ships a MIGRATION** — `20260729_team_setlist_notes.sql`. It is
additive and the client degrades to "no reflection section" without it, so the
build is safe to ship first, but the leaders-only note does nothing until the SQL
is applied. There is no staging database: beta writes to live church data.

### 3. Then: graduate the flag and delete

Both remaining elements have landed, so this is next. Wire `FullscreenChartViewer` as a thin wrapper over `Reader`
(not a fork), flip `unifiedReader` on by default, then delete `SetlistPlayer`,
`PerformanceView` and `PracticeView` — roughly 2,300 lines of triplicated state
management. `ChartView` stays for now; the Song Hub embeds it.

---

## How to work with this owner

Learned the hard way over this pass, and worth more than any of the code below:

- **Build exactly what was asked, and nothing adjacent.** The worst episode of
  this pass: a header-density knob was built *after* the owner said element 1
  takes no customization. Its `min` value hid the song title, and five rounds
  went into debugging CSS before the real cause — the unasked-for knob — was
  found.
- **When they say something looks wrong, it is wrong.** Twice the answer given
  was "but the CSS says…", and twice the owner was right and the code had a real
  bug: the `min-h-0` trap below, and `duration && <…>` rendering a literal `0`
  on a break. Go and measure before explaining.
- **Ship every round to `beta`.** They test on a real phone. A description of a
  change is not a change.
- They say **"finish"** to close a batch — that runs the workflow in `CLAUDE.md`
  (bump `-beta.<N>`, append to `src/data/changelog.md`, build, push,
  fast-forward `beta`). They have **not** asked to promote to `main`.

---

## Ground rules that already exist — don't relearn them the hard way

- **`min-h-0` on every small control.** `styles/index.css` has, in `@layer base`,
  `button { min-height: 36px }` and 44px under 640px. It silently beat four
  rounds of padding tuning on the ribbon chips. Chords inside lyric lines use
  `role="button"`, not `<button>`, for the same reason. Full write-up in
  `docs/READER.md`.
- **CSS custom properties must never name themselves in their own fallback.**
  `--x: var(--y, var(--x))` is a cycle, which makes the property invalid at
  computed-value time and **unset for the whole subtree**.
- **Imports:** `@/` for anything outside a file's own folder, `./x` for
  siblings. ESLint fails the build otherwise.
- **Design system:** `src/ui/README.md` is the canon. Don't add a primitive that
  already exists; don't add a `Thing2`.
- **Never** `window.open`, `alert`, `confirm`, `prompt` — they don't work in an
  installed PWA. Use the `ui/` dialogs and `use-toast`.
- **Tests:** `.test.js` = logic (node), `.test.jsx` = render (jsdom). jsdom
  workarounds live in `vitest.setup.js`.
- **`section.lines[]` can be a string, a tab object, or a modulate object.**
  Type-check before calling string methods.
- **Any new reader setting must be added to `PORTABLE_PREF_KEYS`**
  (`src/app/usePreferenceSync.js`) or it won't follow the user across devices.
- Verify with `npm run lint && npx vitest run && npm run build` before
  committing. The repo has 8 pre-existing lint *warnings* and 0 errors — keep
  errors at 0.
- **Migrations must be additive and backward-compatible** — there is no staging
  database, so beta writes to live church data.

---

## Also landed this pass, outside the reader

- **"Roster" is now "the band"** everywhere a person reads it. `RosterPanel` →
  `BandPanel`, `RosterReadCard` → `BandReadCard`, `canManageRoster` →
  `canManageBand`, `onOpenRoster` → `onOpenBand`. The stored settings keys
  (`rosterOverscheduleWarning`, `rosterStreakLimit`) and the `roster_assigned`
  activity action **kept their names on purpose** — renaming them would reset
  preferences and orphan history rows.
- `src/lib/myInstrument.js` — resolves "what am I playing this service" from
  `team_schedules` + `team_members.instruments`, wired in `App.jsx`.
- Deleted: `src/data/stageModes.js` and the settings `chartLayout`,
  `displayRole`, `autoHideHeader`, `stageMode`, `readerHeader`.

## Open decisions the owner still owes

In `PLAN.md` §7. Still unresolved:

- Which bottom sheet is the app's — `BottomSheet` (7 uses, now including
  `SetlistRail`) or `MobileSheet` (1)? Element 12 dodged this by landing as a
  row rather than a sheet, so it is no longer blocking anything in the reader.

## Branch

Work continued on `claude/chart-redesign-practice-views-duggb4`, fast-forwarded
to `beta` after each batch. `main` is at `0.16.x` — this whole cycle is
unreleased.
