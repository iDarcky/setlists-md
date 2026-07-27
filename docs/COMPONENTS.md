# Component map — the definitive list

> **What this is.** The canonical decomposition of Setlists.md into **25 named
> components**, each with a real boundary, an owner set of files, and its own
> debt list. This is the unit of work from here on: we take one component, do a
> full pass (structure → behaviour → tests → polish), and close it.
>
> `CLAUDE.md` stays the file-by-file reference. `docs/PLAN.md` stays the
> priority/roadmap. **This is the "what are the pieces" file** — the third leg.
>
> _Audited 2026-07-27 against `0.17.0-beta.2`. 55,053 non-test source lines,
> 167 component files, 40 test files (all pure logic — see §4)._

---

## 1. What counts as a component

Not a React file — there are 167 of those, too fine to plan against. Not a
"feature area" either, which is too vague to finish.

A **component** here is a surface with **one job, one owner set of files, and a
boundary you can test at**. Concretely, something that could be handed to one
person for a week and come back done. Where a boundary is currently *wrong* —
where two things share files or one file serves three jobs — that is recorded as
debt against the component, because that is exactly what a pass has to fix.

Each entry carries:

- **Job** — the one sentence it exists for.
- **Owns** — the files that are its and no one else's.
- **State** — what data it is the source of truth for.
- **Status** — ✅ settled · 🟡 works, wants a pass · 🔴 structural problem · 🚧 WIP.
- **Debt** — what a pass would have to fix.

---

## 2. The map

### Layer 0 — Foundations
*No UI. Everything above depends on these, so their debt is paid many times
over. Settle these before the surfaces that sit on them.*

| # | Component | Status |
| :-- | :--- | :--- |
| 0.1 | Format & music core | ✅ |
| 0.2 | Storage | ✅ |
| 0.3 | Sync | 🟡 |
| 0.4 | Auth, workspace & entitlements | ✅ |
| 0.5 | Design system (`ui/`) | 🔴 |

---

#### 0.1 — Format & music core
**Job.** Turn `.md` into structured songs and back, losslessly, and do all
music theory (transpose, capo, enharmonics, Nashville).

**Owns.** `parser.js` · `music.js` · `arrangements.js` · `keyHistory.js` ·
`recommendations.js` · `lib/detectSections.js` · `lib/importChords.js` ·
`lib/cleanPastedText.js`

**State.** The song object shape itself (v2 multi-arrangement) — the contract
every other component reads.

**Status.** ✅ The healthiest part of the codebase, and the only part with test
coverage proportional to its risk (parser, music, arrangements, keyHistory,
detectSections, importChords, repeat-marks, canvas-frontmatter).

**Debt.**
- Frontmatter is one line per field — multi-line Story/Notes needs a format
  decision (**MAJOR**, per PLAN §4).
- The double-structure model (`arrangement.structure[]` vs the editor's section
  flow) is still unresolved (**MAJOR**).
- Round-trip fidelity is the load-bearing property of the whole product and is
  asserted in tests but not fuzzed. A property test (`parse(md) → serialize →
  parse` is a fixed point over generated songs) belongs here.

---

#### 0.2 — Storage
**Job.** Local persistence — songs, setlists, settings, trash, version history —
scoped per library.

**Owns.** `storage.js` (432 lines)

**State.** Everything durable on-device. `setlists-md:` namespace, per-library
keys.

**Status.** ✅ Per-song writes, validation on read, quota handling, version
history all present and tested (`storage.test.js`, `storage-persistence.test.js`).

**Debt.**
- No schema-version stamp on the store itself. Migrations today are implicit
  (`applyKeyHistories`, `healSetlistLinks` run on load and repair in place).
  That has worked, but it means there is no way to ask "what shape is this
  device's data on?" — worth adding before the next breaking change.

---

#### 0.3 — Sync
**Job.** Move songs and setlists between device and cloud without losing an edit.

**Owns.** `sync/*` (16 files, 3,086 lines) — two engines: the file-manifest
engine (`engine.js`, personal BYOC) and the server-authoritative team engine
(`team-engine.js`, 844 lines) · `sync/adopt.js` · `sync/lock.js` ·
`sync/merge.js` · `settings/SyncDoctor.jsx` · `SyncStatus.jsx` ·
`ConflictResolver.jsx`

**State.** The sync manifests (baselines/hashes) in IndexedDB.

**Status.** 🟡 The most carefully engineered subsystem — Web Locks mutex, keyset
pagination, delta pulls, CAS updates, server-side identity keys, reconciled
adoption, a two-device convergence suite. It has earned its complexity.

**Debt.**
- 🔴 **The repeating "Synced" toast is still open** (PLAN §2, P1). The toast is
  silenced but the underlying re-upload loop is not root-caused. This is the one
  open correctness bug in the foundations and it should be closed before any
  surface work — a library that re-uploads every cycle burns quota and will
  eventually lose a race.
- Field-level 3-way merge (`sync/merge.js`) is built and tested but **not wired
  into the engine** — needs per-field baselines + a `HASH_VERSION` bump.
- Two engines with one adoption path is correct but under-documented; the
  `createEngineForLibrary` seam is the only thing keeping them apart.

---

#### 0.4 — Auth, workspace & entitlements
**Job.** Who the user is, which workspace they are in, and what they are allowed
to do.

**Owns.** `auth/*` + `components/auth/*` (11 files) · `contexts/WorkspaceContext.jsx` ·
`hooks/useEntitlement.js` · `billing/checkout.js`

**State.** Session, profile, active team, active library, plan.

**Status.** ✅ Degrades cleanly to guest when Supabase env vars are absent —
that discipline is held everywhere and is why the app is demoable offline.

**Debt.**
- Entitlement resolution is context-aware (personal `subscription_tier` vs
  `team.plan` + `subscription_status`) and correct, but the rules live in prose
  in `CLAUDE.md`. One table in code, one test per row.
- Google/Apple OAuth is disabled pending the domain split (PLAN critical path).

---

#### 0.5 — Design system (`ui/`)
**Job.** The shared vocabulary every surface is built from.

**Owns.** `components/ui/*` (57 files, 4,327 lines) · `styles/index.css` ·
`lib/glass.js` · `lib/headerFrost.js` · `lib/utils.js` · `LydianShowcase.jsx`

**Status.** 🔴 **Structural problem, and it is the reason to do this component
first.** 57 primitives with no enforced canon:

- **`Button.jsx` and `Button2.jsx` both exist.** `Button2` is used by exactly one
  file (`LydianShowcase`, the design showcase) — so the "new" button lives only
  in the showcase while the app uses the old one.
- **Two `PageHeader`s**: `components/PageHeader.jsx` (1 importer, legacy) and
  `components/ui/PageHeader.jsx` (9 importers, canonical).
- `ScreenHeader` · `StageHeader` · `PageHeader` · `PageHeader` — four header
  primitives, and no written rule for which surface takes which.
- `BottomSheet` · `MobileSheet` · `SideSheet` · `SidePeek` · `Dialog` ·
  `PromptDialog` — six overlay primitives.

**Debt.** Pick one of each, delete or absorb the rest, and write the one-line
rule for when to use what. Every content-surface pass below re-litigates these
choices until this is settled — which is why this is the cheapest component to
fix and the most expensive to defer.

---

### Layer 1 — Shell

#### 1.1 — App shell: routing, data & orchestration 🔴
**Job.** Currently: everything that isn't a leaf surface.

**Owns.** `App.jsx` — **3,168 lines**, the single largest file in the repo.

**State.** `view` · navigation history stack · songs · setlists · tombstones ·
trash · settings · sync state · conflicts · modals · notification merge ·
preference cloud-sync · the current song/setlist.

**Status.** 🔴 **This is the component to split, and it is the precondition for
the rest of the plan.** Every other component's boundary is defined by what
`App.jsx` hands it, so its shape is their shape. Concretely it currently owns
eight unrelated concerns:

1. **View routing** — 30+ `view === '…'` branches.
2. **Browser-history emulation** — a manual `historyRef` stack + `pushState`
   /`popstate` handler, with unsaved-changes guards inlined into the handler.
3. **Song CRUD** — save, delete, bulk delete, trash, restore, purge, tag, move,
   copy between libraries.
4. **Setlist CRUD** + service remapping + link healing.
5. **Import orchestration** — smart import, batch import, catalog adds, file
   queue.
6. **Sync orchestration** — engine construction per library, trigger, adopt,
   conflict queue.
7. **Notification merging** — server rows + virtual/interactive prompts +
   suppression rules.
8. **Preference cloud-sync** — hydrate-once-per-user + debounced push.

**The split.** Each of these is a module with a testable seam. Target shape:

```
src/app/
  routes.jsx            # view → component, one table (or a real router — see §4)
  useAppNavigation.js   # view state, history stack, unsaved guards
  useSongLibrary.js     # song CRUD + trash + tags + move/copy
  useSetlistLibrary.js  # setlist CRUD + service remap + link healing
  useSyncOrchestrator.js# engine lifecycle, trigger, adopt, conflicts
  useNotificationFeed.js# server + virtual merge, suppression
  usePreferenceSync.js  # PORTABLE_PREF_KEYS hydrate/push
  useImportQueue.js     # smart/batch/catalog import
```

`App.jsx` becomes composition plus the route table — a few hundred lines.

**Debt beyond the split.**
- **`ErrorBoundary` covers only 5 of ~30 routes** (the auth flows, share view,
  the root, and Song Hub). A crash in Editor, SetlistBuilder, PerformanceView —
  mid-service, on stage — takes the whole app to a white screen. Every route
  should be wrapped.
- The unsaved-changes guard is duplicated across the `popstate` handler,
  `goBack`, and `closeSettings`.

---

#### 1.2 — Navigation chrome 🟡
**Job.** The frame around every surface — desktop sidebar/header, mobile top
bar/bottom nav/drawer.

**Owns.** `DesktopLayout.jsx` · `Sidebar.jsx` · `TopHeader.jsx` (510) ·
`MobileTopBar.jsx` (326) · `BottomNav.jsx` · `MobileDrawer.jsx` (609) ·
`shell/SidePeek.jsx` · `PageHeader` variants

**Status.** 🟡 Works, well-specified in `CLAUDE.md`'s mobile layout section.

**Debt.**
- 🔴 **Dashboard global search returns nothing on desktop/tablet** (PLAN §2, P1)
  — a wiring gap between `TopHeader`'s ⌘K search and `lib/search.js`.
- Doubled mobile search — the global cross-search also shows on Songs/Setlists
  where it duplicates the page's own.
- The hamburger-panel keep-or-replace decision is still open (PLAN §3).

---

### Layer 2 — Content surfaces
*The product. Ordered by dependency, not priority.*

#### 2.1 — Dashboard 🟡
**Job.** The landing surface — what's next, what's recent, quick actions.

**Owns.** `Dashboard.jsx` (690) · `ui/CalendarWidget.jsx` · widget internals ·
the `data-theme-variant="modes"` styling

**Debt.** Live customize mode (drag widgets); default widget order; the Library
widget is a no-op on click; sync status should be fixed chrome, not a widget.
First in line for the card-design sweep (PLAN §3 cross-cutting).

---

#### 2.2 — Song library 🟡
**Job.** Find a song among hundreds.

**Owns.** `Library.jsx` (1,015) · `SongCard.jsx` · `library/LibraryFilters.jsx` ·
`lib/songFacets.js` · `lib/tableColumns.js` · `lib/search.js` · `lib/cardFields.js` ·
`lib/usePersistentView.js` · `ui/ColumnsMenu.jsx` · `ui/Highlight.jsx` ·
`ui/SelectionBar.jsx` · `lib/libraryPlus.js`

**Status.** 🟡 Search/facets/columns shipped in 0.14.0 and are well-tested at the
logic layer.

**Debt.**
- 🟡 **Three view modes is one too many** (PLAN P1) — Cards and Compact are the
  same row at different padding. Collapse to one list view with density as a
  property.
- No virtualization past ~500 songs (PLAN Tier 2).

---

#### 2.3 — Song hub 🟡
**Job.** The song-open target — identity, navigation, and the frame around the
reader.

**Owns.** `SongHub.jsx` (409) · `SongDetails.jsx` · `SongPlayerBar.jsx` ·
`FullscreenChartViewer.jsx` · `lib/coverArt.js` · `lib/useCoverArt.js` ·
`lib/embedPlayers.js`

**Status.** 🟡 Shipped; the Chart/Lyrics/Details tabs and media card are in place.

**Debt.** `FullscreenChartViewer` is 🚧 a scaffold — it is meant to become the
home of the chart **view modes** (currently orphaned from the ⋮ menu) plus
auto-scroll, metronome, font stepping. Audio/Practice tabs unbuilt.

---

#### 2.4 — Chart reader 🟡
**Job.** Render a chart, beautifully and legibly, under the user's display prefs.

**Owns.** `ChartView.jsx` (898) · `SectionBlock.jsx` · `TabBlock.jsx` ·
`ChordDiagram.jsx` · `StructureRibbon.jsx` · `SongMap.jsx` · `AaMenu.jsx` ·
`data/chartThemes.js` · `data/chordShapes.js` · `lib/chartDisplay.js` ·
`hooks/useChartTheme.js` · `hooks/useActiveSection.js` · `ui/FloatingStructure.jsx` ·
`ChartStyleControls.jsx` (1 importer — legacy?)

**Status.** 🟡 The Aa-menu consolidation landed; `embedded` mode lets the hub
drive it.

**Debt.**
- **Display state is re-implemented three times** — `ChartView`,
  `PerformanceView`, `PracticeView` each fork the same font-size / display-mode /
  tab-instrument / notation state-and-persist pattern. PLAN already calls for
  extracting a shared display controller so a surface becomes "shell + an
  allow-list of knobs". **Do this inside this component's pass** — 2.7 depends
  on it.
- Chord-diagram toggle was pulled from the Aa menu; rendering still exists with
  no control.
- Theme audit: white-on-white rows in dark chart themes; ribbon pills don't
  track section colours.
- `SECTION_COLORS` palette rework (PLAN §3).

---

#### 2.5 — Song editor 🔴
**Job.** Write and arrange a chart.

**Owns.** `Editor.jsx` (1,789) · `editor/*` (18 files, 4,566 lines) — of which
`ArrangeTabV2.jsx` alone is 1,594 · `editor/arrangeHelpers.js` ·
`editor/chordRecents.js` · `editor/tabInstruments.js`

**State.** The `md` string + session undo/redo history.

**Status.** 🔴 **6,355 lines across two live paths.** The legacy shell
(Arrange/Advanced/Tabs + split preview) and the cards editor (Labs
`songEditorCards`) both exist; `ArrangeTabV2` is shared by both. This is the
second-largest structural problem after `App.jsx`, and the highest-risk surface
in the product — it is where data loss happens (four such bugs were found by the
user in the last cycle alone).

**Debt.**
- Delete the legacy path once cards graduate.
- `tabInstruments.js` is a **189 KB** chunk (75 KB gzip) — PLAN flags splitting it.
- Zero render tests on the surface where the four data-loss bugs lived.
- Chord drag is same-line only; play-order strip still uses `shortCode` below `xl`.

---

#### 2.6 — Add song & import 🟡
**Job.** Get a song into the library from anywhere — paste, file, PDF, catalog,
blank.

**Owns.** `AddSongModal.jsx` (691, Labs) · `NewSongModal.jsx` (legacy) ·
`newSong/BrowseTab.jsx` · `newSong/ImportTab.jsx` · `importer.js` (635) ·
`import/pdfChart.js` · `import/pdfLayout.js` · `lib/importFiles.js` ·
`lib/catalog.js` · `lib/pasteScope.js` · `editor/PasteReview.jsx`

**Status.** 🟡 `P-1` in PLAN. Two modals live simultaneously behind a flag.

**Debt.**
- 🔴 **Graduate `addSongModal` + `pasteIntoChart`, then delete the legacy modal.**
- 🔴 **PDF import only works with the flag ON** — the legacy modal's file handler
  predates `lib/importFiles` and doesn't list `.pdf`.
- 🔴 **Bulk import** (PLAN P1) — a church moving off Planning Center has ~200
  PDFs and no folder drop or batch review. This is the migration path; without
  it, adoption stalls at "I'll do it later".

---

#### 2.7 — Live, performance & practice 🔴
**Job.** Read a setlist on stage without touching the screen.

**Owns.** `SetlistPlayer.jsx` (374) · `PerformanceView.jsx` (722) ·
`PracticeView.jsx` (923) · `LiveFinale.jsx` · `PracticeFinale.jsx` ·
`PerformanceLayoutSheet.jsx` · `PerformanceSetlistSheet.jsx` ·
`hooks/useWakeLock.js` · `hooks/useAutoHideHeader.js` ·
`hooks/useStageHeaderCollapse.js` · `ui/EdgeNavArrows.jsx` · `ui/FloatingNavPill.jsx`

**Status.** 🔴 Three surfaces forking the same display logic (see 2.4). PLAN's
decided direction is **two surfaces (Chart + Player) with presets
(Live/Rehearsal/Practice)**, not four views — this component's pass *is* that
consolidation.

**Debt.**
- **When the header is collapsed mid-set, the ✕ exit control disappears** —
  there is no obvious way out of Live without expanding the header first. That
  is a bad failure mode on a stage.
- `PerformanceView.jsx` contains a **literal NUL byte** (offset 7966) used as a
  key separator: `` `${idx}\x00${…}` `` written as a raw byte instead of `\0`.
  It works, but it makes the file *binary* to grep, diff, and some editors.
  One-character fix; do it in this pass.
- Per-preset control allow-list needs the focused questionnaire PLAN calls for.

---

#### 2.8 — Setlist library 🟡
**Job.** Find and organise setlists.

**Owns.** `Setlists.jsx` (1,053) · `SetlistCard.jsx` · `setlist/SetlistFilters.jsx` ·
`setlist/SetlistCardRow.jsx` · `lib/setlistTime.js` · `lib/duration.js`

**Debt.** Same three-view-mode collapse as 2.2. Setlist search should match
*contained songs*, not just setlist metadata.

---

#### 2.9 — Setlist editor 🟡
**Job.** Build a setlist — pick songs, order them, set per-song key/notes.

**Owns.** `SetlistBuilder.jsx` (637) · `setlist/*` (9 files, 2,315 lines) —
`SetlistItemRow` · `SetlistIdentityCard` · `SetlistMetaForm` · `SetlistSongPicker` ·
`RecommendedNextPanel` · `setlist/setlistLinks.js`

**Status.** 🟡 P1 in PLAN — the next big redesign after the song editor.

**Debt.** 🔴 Title field needs a bordered input + required warning. Migrate to
the card design. Time → dropdown picker. Unify the four different destructive
"remove/clear" labels. Clear song-search after selecting. Setlist templates.

---

#### 2.10 — Setlist overview & viewer 🟡
**Job.** Read a setlist before/without playing it.

**Owns.** `SetlistOverview.jsx` · `SetlistOverviewV2.jsx` (487, **legacy**) ·
`SetlistViewerCards.jsx` (468)

**Debt.**
- **Delete the pre-cards path.** `cards={false}` is an unused escape hatch
  keeping `SetlistOverviewV2` + the legacy builder layout alive.
- ⚠️ `SetlistOverview` is rendered in **two places** (the `setlist-view` route
  and the desktop preview pane in `Setlists.jsx`) and both wire export
  callbacks — add or rename one and the preview silently no-ops.

---

#### 2.11 — Sharing & export 🟡
**Job.** Get a chart or setlist out — PDF, zip, share link.

**Owns.** `pdf/*` (4 files, 2,886 lines) · `setlist-io.js` ·
`share/setlistShare.js` · `ShareSetlistDialog.jsx` · `SharedSetlistViewer.jsx` ·
`ExportSetlistDialog.jsx`

**Status.** 🟡 The iframe-`srcdoc` print path is a hard-won solution — do not
reintroduce `window.open`.

**Debt.** PDF/CSP enforcing **needs live print verification** on deploy (PWA +
installed app) — still unverified. Long enhancement list in PLAN §4. QR/short-link
polish.

---

### Layer 3 — Account, team & ops

#### 3.1 — Onboarding 🟡
**Owns.** `onboarding/*` (7 files, 980 lines) · `Welcome.jsx` · `FounderNote.jsx` ·
`IOSInstallHint.jsx` · `hooks/useInstallPrompt.js` · `ProgressChecklist.jsx`

**Debt.** The bulk-import decision (2.6) lands here — _Q: a step in the welcome
flow, or found later in Settings?_ Public-domain starter pack (~20 PD hymns).

---

#### 3.2 — Settings & account 🔴
**Owns.** `Settings.jsx` (1,565) · `Account.jsx` (457) · `settings/*` (6 files) ·
`account/AccountPanel.jsx` · `AccountWall.jsx`

**Status.** 🔴 P1 in PLAN — "the whole Settings surface needs a structural
redesign, not just tweaks". A 1,565-line file with panel taxonomy problems.

**Debt.** Fold `Account` fully into Settings. Restore stripped helper texts.
Mobile settings rework. **8 Labs flags** live here — see §4.

---

#### 3.3 — Team & workspace 🟡
**Owns.** `TeamScreen.jsx` (1,081) · `TeamBanner.jsx` · `team/ActivityFeed.jsx` ·
`auth/TeamProvider.jsx` (503) · `ui/WorkspacePickerDialog.jsx` ·
`ui/AvatarUploader.jsx`

**Debt.** Landing rework (surface the church; "Invite member" shouldn't be
first). Stats & insights tab. Admin-only Options tab. 30-day soft deletion.
Needs a real demo-pass before the paid tier is sold.

---

#### 3.4 — Scheduling 🟡
**Owns.** `Schedule.jsx` · `SchedulingGrid.jsx` (427) · `schedule/*` (4 files) ·
`setlist/RosterPanel.jsx` (654) · `setlist/RosterReadCard.jsx` ·
`hooks/useTeamSchedules.js` · `hooks/useTeamAvailability.js` ·
`hooks/useTeamSetlistMap.js` · `lib/reminderOffsets.js`

**Debt.** ⚠️ **`team_schedules.setlist_id` is the `team_setlists` row UUID, not
the local setlist id** — always bridge through `useTeamSetlistMap`. Wrong
matching fails silently (empty calendars, "a setlist"). More/custom roster
instruments.

---

#### 3.5 — Notifications & push 🟡
**Owns.** `NotificationTray.jsx` · `NotificationsPage.jsx` · `NotificationItems.jsx` ·
`push/usePushSubscription.js` · `push/vapid.js` · `public/push-sw.js` ·
`hooks/useTeamNotifications.js` · `supabase/functions/notify-worker/`

**Status.** 🟡 The pipeline (triggers → worker → Web Push) is real and
interop-tested.

**Debt.** **Push has never been verified end-to-end on a real phone** — a
headless browser can't subscribe. Notifications UX rework on both form factors
(P2). Consider an unsubscribe row in Settings.

---

#### 3.6 — Billing & entitlements 🚧
**Owns.** `PricingScreen.jsx` (340) · `billing/checkout.js` ·
`ui/UpgradeGate.jsx` · `supabase/functions/stripe-checkout/` ·
`supabase/functions/stripe-webhook/`

**Status.** 🚧 **Scaffolded but dormant.** Functions return `503
billing_not_configured` without `STRIPE_SECRET_KEY`; UI hidden unless
`VITE_STRIPE_ENABLED=true`. `PricingScreen` only captures email intent.

**Debt.** Pricing page redesign to the new app-shell aesthetic. **Nobody has ever
paid** — the whole path is untested against real Stripe.

---

#### 3.7 — Legal, help & support ✅
**Owns.** `LegalPage.jsx` · `HelpPage.jsx` · `FeedbackButton.jsx` · `docs/legal/`

**Debt.** Context-specific "?" per screen. Surface feedback more prominently.

---

## 3. Order of work

The map has a dependency shape, and ignoring it means paying for the same
decision repeatedly.

**Phase A — make the passes cheap** (nothing user-visible; everything after is
faster and safer):

1. **0.5 Design system** — pick one Button, one PageHeader, one sheet primitive;
   delete the rest; write the usage rule. *Every* surface pass below re-decides
   these otherwise.
2. **1.1 App shell split** — extract the eight concerns. Component boundaries
   below are defined by what `App.jsx` hands down, so they can't be settled
   before this is.
3. **Test harness** (§4) — add `@testing-library/react`; without it every pass
   below ships unverified.
4. **0.3 Sync** — close the open re-upload P1 while the foundation is in hand.

**Phase B — the core loop, in dependency order:**

5. **2.4 Chart reader** — extract the shared display controller (2.7 needs it).
6. **2.7 Live/Performance/Practice** — collapse three forks into Player+presets.
   Fix the disappearing exit control and the NUL byte.
7. **2.5 Song editor** — delete the legacy path, split `ArrangeTabV2`, split
   `tabInstruments`.
8. **2.6 Add song & import** — graduate the flags, delete the legacy modal,
   build bulk import (the migration path).

**Phase C — the surfaces:**

9. **2.9 + 2.10 Setlist editor & overview** — the card migration, together.
10. **2.2 + 2.8 Library views** — collapse Cards/Compact, one list view, both lists.
11. **3.2 Settings & account** — the structural redesign.
12. **2.1 Dashboard**, then 3.3 Team, 3.6 Pricing — the rest of the card sweep.

**Phase D — ops** (§4; runs in parallel, gated on account/budget decisions).

---

## 4. What's missing for production grade

Findings from this audit, beyond what PLAN.md already tracks. Ordered by what
would hurt most.

### 🔴 Blocking

**1. Zero UI tests.** 40 test files, 167 component files, **not one render
test** — `@testing-library` isn't even a dependency. Every test is pure logic
(parser, music, sync, search). That coverage is genuinely good where it exists,
which makes the gap sharper: the four data-loss bugs of the last cycle were all
in the **editor UI**, all found by the user in production, and none of them
could have been caught by the existing suite. Before working component by
component, add the harness — then each pass ends with tests for that component,
and the map becomes a coverage plan.

Minimum bar per component pass: render the surface, exercise the primary
interaction, assert the data that comes out. Start with the editor (2.5) and the
setlist builder (2.9) — the two places where a bug silently destroys user work.

**2. No staging environment.** One Supabase project, and it is production.
Migrations are applied directly to live church data; "test on beta" means "test
on live data". PLAN already flags this (P1, blocked on Supabase Pro $25/mo). At
public beta with real churches this stops being a calculated risk and becomes
the thing that ends the beta. **This is a budget decision, not an engineering
one — make it in August.**

**3. Error monitoring is dormant.** Sentry is wired and bundled but
`VITE_SENTRY_DSN` is unset. Combined with `ErrorBoundary` covering only 5 of ~30
routes, a crash on stage is invisible to you and total to the user. Setting one
env var and wrapping the routes is a half-day that converts every future bug
report from "it broke" to a stack trace.

**4. Nothing is verified on real devices.** Three separate features are shipped
but unverified end-to-end: Web Push (never confirmed on a real phone), PDF print
under the enforcing CSP (never confirmed on a deployed PWA), and the Stripe
billing path (nobody has ever paid). Each is a feature you'd list on a pricing
page and cannot currently promise works.

### 🟡 Serious

**5. No router.** Views are `useState` plus a hand-rolled `historyRef` stack and
a `popstate` handler with unsaved-guards inlined. The costs are compounding: no
deep links (you cannot send someone a link to a song or setlist), no shareable
URLs beyond the one share route, no route-level attribution for Sentry or
analytics, and back-button behaviour that has to be re-derived by hand at every
new modal. Adopting a router is best done *as part of* the 1.1 split, while the
route table is being written anyway — retrofitting later costs several times more.

**6. Flag debt — 8 Labs flags.** Each is a live fork. Two of the most important
(`addSongModal`, `pasteIntoChart`) are **off by default**, which means the paste
and import flows being actively developed are *not* the ones users get. Flags
that never graduate become permanent double-maintenance. Set a graduation date
per flag; delete the loser path the day it graduates.

**7. Dead and duplicate paths.** `Button2` (used only by the showcase),
`components/PageHeader` (1 importer vs 9 for the canonical one),
`SetlistOverviewV2` + the legacy builder layout behind an unused `cards={false}`,
the legacy editor shell, the legacy `NewSongModal`. Each doubles the surface area
of the pass that touches it. Delete on sight during each component's pass.

**8. Bundle regressed.** Main chunk is **802 kB / 226 kB gzip**; PLAN records
710 kB / 202 kB after the last optimisation. `tabInstruments` (189 kB) and
`pdf` (416 kB) are split out, but the main chunk grew ~13% since. There's no
bundle budget in CI, so this will keep happening silently. Add a size check to
the CI job.

**9. CI has no gates beyond green.** `lint + test + build` on every push is
good. It does not check coverage, bundle size, or accessibility, and there are
no PR/issue templates (PLAN tracks this). Add the budgets as the test harness
lands, so the ratchet only ever tightens.

### 🟢 Worth planning now, doing later

**10. No product analytics.** You are about to make roadmap bets (which surfaces
to redesign first) with no usage data. PLAN flags Plausible/PostHog as needing an
account decision — make it before the September soft-launch, so the beta
actually produces evidence.

**11. No i18n, and the user base is Romanian.** PLAN has this at P2 with
"extract strings now, translate later" — correct, and the extraction gets
cheaper if it happens *during* each component pass rather than as a separate
sweep afterwards. Consider making "strings extracted" part of the definition of
done per component.

**12. Accessibility is unmeasured.** 431 `aria-` attributes suggests real care
was taken; 13 `onClick` handlers on `div`/`span` and no automated check suggest
it isn't uniform. Add `eslint-plugin-jsx-a11y` (catches the static cases for
free) and do the focus-management pass per component rather than as one audit.

**13. Small real defect.** `PerformanceView.jsx` contains a raw NUL byte
(offset 7966) inside a template literal used as a React key separator. It works,
but it makes the file binary to grep/diff. Change to `\0`.

---

## 5. Definition of done, per component

A component pass is finished when:

- [ ] Its boundary is real — it owns its files, and nothing outside reaches past
      its surface into them.
- [ ] Dead and duplicate paths inside it are **deleted**, not left behind a flag.
- [ ] Its Labs flags have either graduated or been removed.
- [ ] It has render tests for the primary interaction and the data that comes out.
- [ ] It is wrapped in an `ErrorBoundary` if it's a route.
- [ ] Its user-facing strings are extracted (once i18n scaffolding exists).
- [ ] Its entry in this file is updated — status, and what debt remains.
