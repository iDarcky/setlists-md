# Next session — the reading-views rework

> **Short-lived working doc.** Delete it when the pass lands. It exists because
> a new chat session starts with **no memory of previous conversations** — only
> this repo. Everything a fresh session needs is here or linked from here.
>
> _Written 2026-07-27, end of the component-architecture work._

---

## Start here

Read, in this order: this file → `docs/views-vision.md` (the product decision) →
`docs/COMPONENTS.md` §2.4 and §2.7 (the two components) → `CLAUDE.md` (how the
app works).

The one-line brief: **collapse three forked reading surfaces into two, with
presets.**

## The decision, already made — do not re-open it

From `docs/views-vision.md`: **do NOT build four separate views.** Four views
means four forks of the same sheet and a "which do I open?" question for the
user. Instead:

- **Chart** — read one song. Roughly today's `ChartView`.
- **Player** — setlists, with three presets inside it:
  - **Live** — locked down, header auto-hides, fewest controls.
  - **Rehearsal** — everything visible, easy key/notation/column switching.
  - **Practice** — Rehearsal plus metronome, section loop, slow-down, logged minutes.

The open question is **not** the shape. It's the per-preset control allow-list —
exactly which knobs each preset exposes. `docs/views_questions.md` has the
questionnaire; it needs the owner's answers before step 3 below.

## Why it's being done

`ChartView` (898 lines), `PerformanceView` (722) and `PracticeView` (923) each
**re-implement the same state**: font size, display mode, tab instrument,
notation, and the persist-to-settings dance. Three copies that have drifted.
Every chart bug currently has to be fixed three times, which is why the reading
experience doesn't feel coherent.

## Two known defects to fix in this pass

1. 🔴 **The exit control disappears when the header collapses mid-set.** Someone
   on stage, mid-service, with no obvious way out of Live. Whatever else
   changes, there must always be a visible exit.
2. **The `chart → song` back-edge.** `features/chart/ChartView.jsx` imports
   `features/song/SongDetails`, while `song` already depends on `chart` — so
   neither can be worked on alone. It's a product question, not a mechanical
   one: **does the hub own Details, or does the reader?** The architecture notes
   say the hub owns identity and the chart is "just the reader", which suggests
   an answer. Decide it, then cut the edge.

## Suggested order

1. **Owner writes down what each surface shows today** — controls present,
   controls missing, what annoys them. Half a page. This is the only step that
   needs the owner, and it needs a pen, not a keyboard.
2. **Answer the per-preset allow-list** in `docs/views_questions.md`.
3. **Extract the shared display controller** — build on `lib/chartDisplay.js` and
   `features/performance/PerformanceLayoutSheet.jsx`. **No visual change.** This
   is boring, safe, and roughly 80% of the work.
4. **Presets become configuration**, not new screens.
5. **Then** `FullscreenChartViewer.jsx` — currently a scaffold, and the intended
   home for the chart view modes plus auto-scroll / metronome / font stepping.

## Ground rules that already exist — don't relearn them the hard way

- **Imports:** `@/` for anything outside a file's own folder, `./x` for
  siblings. ESLint fails the build otherwise.
- **Design system:** `src/ui/README.md` is the canon. Don't add a primitive that
  already exists; don't add a `Thing2`.
- **Never** `window.open`, `alert`, `confirm`, `prompt` — they don't work in an
  installed PWA. Use the `ui/` dialogs and `use-toast`.
- **Tests:** `.test.js` = logic (node), `.test.jsx` = render (jsdom). See
  `src/__tests__/editor-save.test.jsx` for the pattern, and note the jsdom
  `env()`-in-`calc()` workaround in `vitest.setup.js`.
- **`section.lines[]` can be a string, a tab object, or a modulate object.**
  Type-check before calling string methods. This has caused real bugs.
- Verify with `npm run lint && npm test && npm run build` before committing.
- **Migrations must be additive and backward-compatible** — there is no staging
  database (deferred for budget), so beta writes to live church data.

## State of the repo as of this handoff

Branch `claude/app-component-architecture-i4rsur`, all green (622 tests, lint 0
errors). Recently landed, so don't redo it:

- `src/components/` → `src/features/*`, one folder per component; `@/` alias
  enforced by lint.
- Design-system pass: canon written, `Button2`, `PageHeaderLegacy` and six dead
  primitives deleted, three unused npm deps removed.
- `App.jsx` 3,168 → 2,823 (preference sync, notification feed and appearance
  extracted). **The rest of the split is blocked on adopting a router** — see
  `COMPONENTS.md` §1.1.
- Deleted: `SetlistOverviewV2`, `NewSongModal` (graduating `addSongModal`, which
  also fixed PDF import for everyone), the legacy editor layout (Editor.jsx
  1,789 → 1,423), and the Compact list view.
- Component-test harness added; first render tests cover the editor save path.

## Open decisions the owner still owes

In `PLAN.md` §7. The two that touch this pass:

- Which bottom sheet is the app's — `BottomSheet` (6 uses) or `MobileSheet` (1)?
  The performance layout sheets use `BottomSheet`, so this pass will trip over it.
- Where the floating structure ribbon lives (Labs `structurePosition` /
  `ribbonStyle`) — explicitly deferred *to* this pass.
