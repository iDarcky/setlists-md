# Setlists.md — Roadmap

> **The single sequenced plan.** What to do, in what order, and why. Replaces
> the old area-grouped plan (which said what was wrong but never what was next).
>
> _Last updated: 2026-07-27 · Version `0.17.0-beta.2` on `beta` · Target: **public beta October 1**._

**Three docs, three jobs.** `CLAUDE.md` = how it works (stack, schema, gotchas,
finish/release workflow) · `docs/COMPONENTS.md` = what the pieces are (25
components, owner files, debt) · **this file = what order to do them in.**

**Status marks.** 🔴 blocker · 🟡 should · ⬜ nice · ✅ done · ⏭️ deliberately deferred · ❓ needs your decision.

---

## 0. Read this first: there are two streams

Most of the confusion in the old plan came from mixing these. They run **in
parallel** and rarely block each other:

| | **Stream A — Ship the beta** | **Stream B — Build the product** |
| :-- | :--- | :--- |
| What | Domain, email, OAuth, staging, monitoring | Component passes, features, polish |
| Nature | Mostly **ops + money + waiting on third parties** | Mostly **you writing code** |
| Deadline | Hard — Oct 1 | Soft — continuous |
| Risk if late | **The beta doesn't happen** | The beta is rougher |
| Currently | **Not started. This is the real risk.** | Moving well |

**The honest read (2026-07-27):** engineering is ahead, ops is behind. Every
remaining hard blocker to October 1 is in Stream A, and none of it is
programming. If you only do one thing in August, do Stream A.

---

## 1. Right now

**Just landed:** the component-architecture foundation — feature folders,
enforced boundaries, and the design-system canon (§3.1, all ✅).

**The next three, in order:**

1. **Test harness** (§3.2) — `@testing-library/react`. Do this *before* the App
   split, so the riskiest refactor in the codebase has something catching it.
2. **Split `App.jsx`** (§3.1) — 3,168 lines, eight concerns, and a router
   adopted while the route table is being written anyway.
3. **Start Stream A** (§2) — the domain split gates email, which gates OAuth.
   It has a queue, so August is already late.

**Two design calls waiting on you** (§7, #8–9) before the design system is fully
closed: which bottom sheet is the app's, and whether `ScreenHeader` folds into
`PageHeader`.

---

## 2. Stream A — Ship the public beta (by October 1)

### 2.1 🔴 Critical path — start in August, in this order

These are **sequential**: each waits on the one above it.

- [ ] **Custom domain split** — `setlists.md` → `app.setlists.md`.
      Gates everything below. _Blocks: email, OAuth, cookie notice._
- [ ] **Resend transactional email** — auth confirmation, reset, magic link.
      _Needs the domain for DNS/SPF/DKIM._
- [ ] **Google / Apple OAuth** — re-enable in `AuthProvider`.
      _Needs the domain (redirect URIs) + working email._
- [ ] **Cookie / storage transparency notice** — marketing-site footer.
- [ ] **Leaked-password protection** — one toggle in the Supabase dashboard. Do it today, it's free.
- [ ] **Private soft-launch to 5–10 worship teams** — September. This is the
      validation gate for October, not a formality.

### 2.2 🔴 Production-grade gaps (found in the 2026-07-27 audit)

Ordered by what hurts most if it goes wrong in front of real churches.

- [ ] **Turn Sentry on.** It is wired, bundled, and dormant — one env var
      (`VITE_SENTRY_DSN`) in Vercel. Right now a crash on stage is invisible to
      you and total to the user. **Cheapest safety win available.**
- [ ] **Wrap every route in `ErrorBoundary`.** Currently 5 of ~30. A crash in
      Editor or PerformanceView white-screens the whole app mid-service.
- [ ] 🔴 **Staging environment.** There is ONE Supabase project and it is
      production. Migrations are applied to live church data; "test on beta" =
      "test on live data". Needs Supabase Pro (~$25/mo, see `COSTS.md`) or
      branching. **This is a money decision, not an engineering one — make it in August.**
- [ ] **Backups + one real restore drill.** Client half shipped (Settings → Data
      one-click library .zip). Server half unverified: confirm what the plan
      retains, then actually restore something.
- [ ] **Verify the three unverified features on real hardware.** All shipped, none confirmed:
      - Web Push end-to-end on a real phone (headless browsers can't subscribe)
      - PDF print under enforcing CSP on a deployed PWA + installed app
      - Stripe checkout — nobody has ever paid
- [ ] **PR + issue templates** (`.github/`).
- [ ] **Bundle budget in CI.** Main chunk is 802 kB / 226 kB gzip, up from the
      710/202 recorded after the last optimisation. Nothing catches drift.

### 2.3 🔴 Open correctness bugs

- [ ] **Repeating "Synced" toast = the library re-uploads every cycle.** The
      toast is silenced but that was a symptom fix. If `uploaded > 0` on
      back-to-back syncs with no edits, something re-dirties the library each
      pass. Root-cause with **SyncDoctor** (Settings → Sync inside the Space),
      then diff `songToMd(local)` against the stored server `content`. Suspects:
      a field serialized locally but absent from older server content, a
      client-side normalisation applied after adopt, or a lost manifest write.
      Note `createAmplificationGuard` isn't tripping, so it runs below that threshold.
- [ ] **Dashboard global search returns nothing (desktop/tablet).** The home
      top-bar / ⌘K search yields no results where the same query works elsewhere.
      Likely a wiring gap between the dashboard input and `lib/search.js`.

### 2.4 🟡 Should ship before beta (won't hard-block)

- [ ] **Pricing page redesign** (`features/billing/PricingScreen.jsx`) to the app-shell aesthetic.
- [ ] **Team page redesign** (`features/team/TeamScreen.jsx`) — create/manage + tier picker, Band/Church naming.
- [ ] **Public-domain starter pack** (~20 PD hymns) for first run.
- [ ] **ChordPro / OnSong import** — `smartImport()` covers ChordPro/OpenSong/UG/text;
      remaining: a dedicated `.onsong` parser + per-file success/failure reporting.
- [ ] **Setlist QR/URL share** — share route + Play Live shipped; QR/short-link polish remains.

---

## 3. Stream B — Foundation (do before the surface work)

These make every later pass cheaper. Skipping them means paying the same cost
repeatedly, once per surface.

### 3.1 Component architecture

- [x] ✅ **Definitive component map** — `docs/COMPONENTS.md`, 25 components.
- [x] ✅ **Feature-folder restructure** — `src/components/` (63 loose files beside
      11 half-populated folders) → `src/features/*`, one folder per component,
      plus `src/ui/` and `src/app/`.
- [x] ✅ **`@/` alias + ESLint enforcement** — `../` and `@/components/*` are now
      lint errors. The old layout decayed *because* the convention was only
      written down; now it fails the build.
- [x] ✅ **Folder-name collisions resolved** — `src/import`, `src/setlist`,
      `src/share`, `src/billing`, `src/notes` folded into `lib/`/`hooks/`.
      Rule: `src/<x>/` is the engine, `features/<x>/` is its UI.
- [x] ✅ **`chart → editor` back-edge closed** — `tabInstruments` moved to `data/`.
- [x] ✅ **Design system pass (COMPONENTS §0.5).** `src/ui/README.md` is now the
      canon — which primitive for which job, plus the no-siblings rule. Deleted
      `Button2` and `PageHeaderLegacy` (showcase-only), six dead primitives, and
      three unused npm deps. **Two consolidations left open on purpose** because
      they're design calls, not dedupes: which bottom sheet is the app's
      (`BottomSheet` 6 importers vs `MobileSheet` 1), and absorbing
      `ScreenHeader` into `PageHeader`. Both are in §7.
- [ ] 🔴 **Split `App.jsx` (COMPONENTS §1.1).** 3,168 lines owning eight
      concerns: routing, a hand-rolled history stack, song CRUD, setlist CRUD,
      import, sync orchestration, notification merge, preference sync. Every
      component's boundary is defined by what App hands it. Target module layout
      is in COMPONENTS §1.1.
- [ ] **Adopt a router — during the App split, not after.** Views are `useState`
      + a manual `historyRef` + `popstate` handler with unsaved-guards inlined.
      Costs today: no deep links (you can't send someone a link to a song or
      setlist), no route attribution for Sentry/analytics, back-button
      re-derived by hand at every modal. Retrofitting later costs several times more.
- [ ] **Close the remaining back-edge** — `features/chart/ChartView` imports
      `features/song/SongDetails`, while `song` depends on `chart`. Neither can
      be worked on alone until it's cut. Do it in the chart pass.

### 3.2 🔴 Test harness — the biggest single gap

**619 tests, 167 component files, zero render tests.** `@testing-library` isn't
even a dependency. Every test is pure logic (parser, music, sync, search) and
that coverage is genuinely good — which is what makes the hole sharp: **the four
data-loss bugs of the last cycle were all in the editor UI, all found by you in
production, and none were catchable by the existing suite.**

- [ ] Add `@testing-library/react` + `jsdom` to vitest.
- [ ] First tests on the two surfaces where a bug destroys user work silently:
      **song editor** and **setlist builder**.
- [ ] Then: every component pass ends with tests for that component. The
      component map doubles as the coverage plan.

Minimum bar per pass: render the surface, exercise the primary interaction,
assert the data that comes out.

### 3.3 Types — recommended, incremental, data-first

The case is unusually strong here because of one thing already in your gotchas:

> `section.lines[]` can contain **strings**, **tab objects**, OR **modulate objects**

That's a discriminated union — exactly what a type system is for. Today the docs
*ask* developers to remember it. And with zero UI tests, types are the cheapest
verification available. The `team_schedules.setlist_id` row-UUID-vs-local-id
trap is the same class of bug and dies to branded types.

**Do it in this order — do NOT sweep the components.**

- [ ] **One `src/types.ts`** — Song, Arrangement, Section, Line (the union),
      Setlist, SetlistItem. Consume from plain `.js` via JSDoc `@type` with
      `checkJs` on the data core only. **~70% of the benefit for ~5% of the
      cost, nothing gets renamed.**
- [ ] **Generate Supabase row types** from the live schema (near-free).
- [ ] **Then convert file-by-file when you touch it** — `parser`, `arrangements`,
      `storage`, `sync` first. Components last, possibly never.

⏭️ **Explicitly not doing:** a framework or language rewrite. The slowness is an
802 kB chunk and unvirtualized lists, not React or JS. Svelte/Solid/Rust/WASM
buys none of that back and costs a year.

### 3.4 Performance

- [ ] **Move canonical hashing off the main thread.** Sync hashes every song; a
      200-song church library is 200 parse+serialize round-trips blocking the
      UI. A Web Worker is contained and gets *more* valuable as churches migrate in.
- [ ] **Virtualize the song list** past ~500 songs.
- [x] ✅ **svguitar (162 KB) now loads on demand** and is out of the precache.
      Note: PLAN previously said "split `tabInstruments` (188 KB)" — that was
      chasing a Rollup **chunk name**. `tabInstruments.js` is 30 lines; the
      weight was svguitar + svg.js behind `ChordDiagram`, for a feature that is
      off by default. Shared chunk 189 → 27 kB, precache −158 KiB.
- [x] ✅ JSZip lazy-loaded, react/supabase in cache-stable vendor chunks, pdf.js
      lazy + precache-excluded.
- [ ] **Lighthouse budget in CI** (also a Google Play TWA requirement — needs ≥80).

### 3.5 Flag debt

**8 Labs flags, none graduated.** Each is a live fork, and the two most
important (`addSongModal`, `pasteIntoChart`) are **off by default** — so the
paste and import flows you're actively developing are not the ones users get.

- [ ] **Set a graduation date per flag. Delete the losing path the day it graduates.**
- [ ] 🔴 Graduate `addSongModal` + `pasteIntoChart` (needs a real week of use).
- [ ] 🔴 **PDF import only works with `addSongModal` ON** — the legacy modal's
      file handler predates `lib/importFiles` and doesn't list `.pdf`.

### 3.6 Dead paths to delete on sight

Each doubles the work of the pass that touches it.

- [ ] `SetlistOverviewV2` + the legacy builder layout behind an unused `cards={false}`.
- [ ] The legacy editor shell, once `songEditorCards` graduates.
- [ ] `NewSongModal`, once `addSongModal` graduates.
- [ ] `Button2` + `PageHeaderLegacy` — now isolated in `features/design/`;
      nothing but the showcase imports them. Deleting is a decision about the
      showcase, not a refactor.

### 3.7 Cross-cutting, cheapest during each pass

- [ ] **Accessibility** — add `eslint-plugin-jsx-a11y` (catches static cases
      free), then focus-management per component rather than one audit. 431
      `aria-` attributes says care was taken; 13 `onClick` on `div`/`span` says
      it isn't uniform.
- [ ] **i18n extraction** — Romanian is the actual user base. Extract strings
      **during** each component pass, not as a sweep afterwards. Make "strings
      extracted" part of the definition of done.
- [ ] **Product analytics** (Plausible / self-hosted PostHog) — you're about to
      choose which surfaces to redesign with no usage data. Decide before the
      September soft-launch so the beta produces evidence. ❓ needs an account decision.
- [x] ✅ Raw NUL byte in `features/performance/PerformanceView.jsx` replaced
      with `\0`. The file is no longer binary to grep and diff.

---

## 4. Stream B — Component passes, in dependency order

From `docs/COMPONENTS.md` §3. Each pass: structure → behaviour → tests → polish,
then update that component's entry. Definition of done is in COMPONENTS §5.

| Order | Component | Why here | Headline work |
| :-- | :--- | :--- | :--- |
| 1 | **0.5 Design system** | Everything re-decides it otherwise | One Button, one header, one sheet |
| 2 | **1.1 App shell** | Defines every other boundary | Split 8 concerns + adopt a router |
| 3 | *(test harness)* | Every pass after is verified | §3.2 |
| 4 | **0.3 Sync** | Close the P1 while the foundation is open | §2.3 re-upload loop |
| 5 | **2.4 Chart reader** | 2.7 depends on it | Extract the shared display controller; cut the `song` back-edge |
| 6 | **2.7 Live/Performance/Practice** | Three forks of one thing | Collapse to Player + presets; **fix the vanishing ✕ exit** |
| 7 | **2.5 Song editor** | Highest-risk surface in the product | Delete legacy path; split `ArrangeTabV2` (1,594 lines) |
| 8 | **2.6 Add song & import** | The migration path | Graduate flags; **bulk import** |
| 9 | **2.9 + 2.10 Setlist editor & viewer** | Half the product | Card migration, together |
| 10 | **2.2 + 2.8 Library views** | Both lists share the problem | Collapse Cards/Compact into one list view |
| 11 | **3.2 Settings & account** | 1,565 lines, taxonomy problems | Structural redesign; fold Account in |
| 12 | **2.1 Dashboard**, 3.3 Team, 3.6 Pricing | The rest of the card sweep | |

**Two that jump the queue when their moment comes:**

- 🔴 **Bulk import (§4 item 8) is the migration path.** A church leaving Planning
  Center has ~200 PDFs and there's no folder drop and no batch review — 200 trips
  through the editor. People abandon halfway, and a half-migrated library is
  worse than not starting. ❓ Where does it live: a step in the welcome flow, or
  found later in Settings?
- 🔴 **Setlist editor title field** — bordered input + required warning + sized to
  align with the Draft/Ready toggle. Small, visible, and it's been open a while.

---

## 5. After the beta

### 5.1 Native (2027 — full detail in `docs/NATIVE-READINESS.md`)

That doc is the authority; the sequencing it settled on:

1. **Windows — days.** PWABuilder → Microsoft Store. The manifest already
   qualifies. Free registration, ~24–48 h review, **0% fee** for non-game apps
   using their own commerce. **Skip Electron entirely** — no policy or
   capability benefit. _(Note: PWAs already install from Edge/Chrome today with
   zero work — the Store is about discovery.)_
2. **Google Play — weeks.** A Trusted Web Activity wraps the deployed PWA with
   near-zero code change. Needs `assetlinks.json`, signing, Data Safety form,
   and **Lighthouse ≥ 80** (§3.4). Post-Epic-settlement rules allow linking out
   to Stripe (~10% on subscription link-outs).
3. **Apple — months, and the long pole.** Capacitor, plus real work: Sign in
   with Apple (required because you offer Google OAuth), OAuth deep links,
   native storage backstop, Guideline 4.2 "doesn't feel like a website" polish.
   **Billing posture for v1: don't sell in the iOS app** (reader-app pattern) —
   teams subscribe on the web, the app just signs in. Zero IAP work, compliant everywhere.

**The five webview blockers (N-1…N-5)** are enumerated in that doc. N-1 (PDF
`window.open`) is ✅ already fixed. The rest — IndexedDB eviction on iOS, OAuth
origin assumptions, Stripe navigation, and the missing platform shim — are worth
keeping in mind as you build, because each one gets more expensive the later it's found.

**Why bother, given the PWA works:** reach. iOS web push only reaches installed
PWAs on 16.4+, and "Add to Home Screen" is a buried gesture most worship leaders
will never find. Store presence is also credibility when asking a church to
standardize on you.

### 5.2 Reading-view model — 2 surfaces, not 4

**Decided:** do NOT build four separate views. **Chart** (read one song) +
**Player** (setlists) with three presets inside it — **Live** (locked down,
fewest controls), **Rehearsal** (everything visible), **Practice** (metronome,
section loop, slow-down, logged minutes). Full capture: `docs/views-vision.md`.

This is what §4 passes 5–6 implement. Open: the per-preset control allow-list
(needs the questionnaire in `docs/views_questions.md`).

### 5.3 Anchor epics

- **Member edit suggestions / approvals** — members propose edits that queue
  pending until a leader approves. New `song_suggestions` table + a review inbox
  reusing notifications. ❓ per-field or whole-arrangement? who approves?
- **CCLI / SongSelect reporting** — played-song reporting (keyHistory + past
  setlists already hold the data) + SongSelect import. For the church market
  this is a **purchasing requirement, not a feature**.
- **Field-level 3-way merge** — `sync/merge.js` is built and tested (11 tests)
  but not wired: needs per-field baselines + a `HASH_VERSION` bump, validated by
  the two-device convergence suite. Its own focused PR.
- **Cloud version-history restore UI** — capture shipped
  (`team_song_versions`, live); the restore half isn't built. History is being
  preserved meanwhile; emergency restore is a DB operation today.
- **Public-domain catalog (Browse)** — server-backed, never cached; adds are
  copies with provenance; seven new frontmatter fields. **Content is the hard
  half and has legal teeth** — Romanian translations carry their own copyright
  even for centuries-old hymns. Safe start: **colinde** (traditional, anonymous,
  and December is a real deadline).

### 5.4 ⚠️ MAJOR — breaking, schedule deliberately

- **Reusable tab library / snippets** — named riffs referenced by id; breaks the inline `.md` round-trip.
- **"Outgrew `.md`?"** — attachments, BYOC Song Bundle folder format, full-text lyric search.
- **Multi-line Story/Notes** — frontmatter is one line per field.
- **Unify the double-structure model** — `arrangement.structure[]` + the editor section flow.

---

## 6. Backlog by area (reference — not sequenced)

Detail that belongs to a component pass. When you start a pass, read its section
here first. Nothing in this section is scheduled on its own.

### Song details
- Rich editor for **Story-behind** (breaks-style) ❓ both Story and Notes, or just Story?
- Dedicated full song-details view ❓ route or expanded panel?
- Field char limits (Themes/Genres/Verses/Moment/Tags) ❓ cap which?

### Song editor
- Play order in the narrow strip still uses `shortCode` (`V1`, `PC`); the `xl` rail fixed the labels, the `< xl` strip didn't.
- Validate the `xl` breakpoint for the rail on real screens.
- Repetition finds no chorus when a source writes it out once — every block reads as a verse and the chips do the work. Watch whether that's the common case.
- Split-word repair removed on purpose ("ur ca" → "urca" is indistinguishable from two real words; "ca" IS a Romanian word). Recoverable from git.
- Romanian **section labels** (STROFA/REFREN as display names over canonical types), tied to app language.
- Flag a song you need from the setlist builder, for songs not yet in the library.
- Key/chord strip should follow the edited section + respect active notation.
- Chord drag is same-line only — allow dragging across lines.
- Custom Play-order onboarding hint (chips drag / × / +).
- Cross-device version history (local per device today).

### Chart view
- **Collapsed-header top gap (tablet)** — content scrolls into the strip above the structure ribbon; extend the header background to cover the safe-area inset.
- Dual `F#/Gb` labels in the **chart** transpose dropdown (editor done).
- **Chord fingering diagrams have no control** — the Aa toggle was pulled; rendering + `showDiagrams` still exist, and it's now lazy-loaded. Reinstate a control, likely in the fullscreen viewer.
- **Hub fullscreen viewer** is a scaffold — bring the chart **view modes** and live controls (auto-scroll, metronome, font stepping) into it.
- **Chart theme that follows the app theme** — auto-track light/dark instead of a fixed palette.
- **Section default colours** (`SECTION_COLORS`) need a cohesive pass — they drive labels, song-map chips and section cards.
- **Theme audit**: white-on-white rows in dark chart themes; ribbon pills don't track section colours; floating-structure legibility per theme.
- Transpose tabs ❓ feasibility spike.

### Song library
- 🟡 **Collapse Cards/Compact into one list view** — they're the same row at
  different padding, so the switcher asks users to make a choice that doesn't
  earn itself. Density becomes a property of the view. Applies to Songs **and**
  Setlists; folds into the `cardFields` work.
- **Doubled mobile search** — the global cross-search also shows on Songs/Setlists where it duplicates the page's own. Scope it to the page there, keep global on Dashboard + ⌘K.
- **Setlist search by contained song** — match song titles inside each setlist's items.
- Drag-to-**reorder** table columns (show/hide shipped).

### Setlists — overview & viewer
- 🟡 **Migrate to the card design** — identity card + content cards + consistent header/⋮.
- Overview visual redesign + buttons rework (Set order/Band + Play live/Practice inline).
- Warn before editing a **past** setlist.
- Remove redundant "Set Order"; relocate "Show details".
- Reposition "Edited by"; Location on the date line; date in Title Case.
- Reduce icon clutter; reconsider bin placement; services dropdown styling.
- Structure pill inside setlist song cards.
- Shared-viewer: tap a song to open it; "Open app" returns to the setlist; onboarding; refresh the older share UI.
- ⚠️ `SetlistOverview` renders in **two places** (the `setlist-view` route and the desktop preview in `Setlists.jsx`), both wiring export callbacks — add or rename one and the preview silently no-ops.

### Setlist editor
- **Time → dropdown picker** for end-time (and start-time).
- **Unify the destructive labels** — rehearsal, tag, note and end-time each have their own "remove/clear"; collapse into one shared **red** label.
- **Clear song-search after selecting** (+ an "×") so adding several is quick.
- **Location → Google Maps (easy tier)** — Places Autocomplete on Location; store name + optional lat/lng; viewer makes it a tappable `maps.google.com/?q=` link. Needs a billing-enabled key + CSP allowance + privacy note. ⏭️ _Skip the embedded map tier — Maps JS/Embed conflicts with the strict CSP, same issue that killed Spotify playback._
- Rework Set order/Band; relocate Draft/Ready.
- Song/break **card redesign** ❓ what feels off?
- Rework the **Recommended-next engine** (weigh more song-detail fields).
- Desktop **3-pane** layout (details · current set · library).
- **Setlist templates** — recommended approach: a flag on the setlist object, no
  migration. `isTemplate: true` (+ optional `templateName`); `isValidSetlist`
  only requires `id/name/items`, so it rides along in IndexedDB and syncs free.
  Save-as-template clones and strips date/time/rehearsal; new-from-template
  deep-clones `items` into a fresh id + today's date (roster/schedules **not**
  copied). Filter templates out of the normal list.
  _Alt: a dedicated `templates` store — cleaner separation, new plumbing. Prefer the flag._

### Dashboard
- **Live customize mode** (drag widgets in place, tray for unused).
- Default widget order + welcome-banner decision ❓ keep/remove/removable?
- **Library widget** — improve or cut ("keys" stat unclear; no-op on click).
- **Sync status** — fixed spot, not a widget.
- Search placeholder → just "Search".
- Next-up Practice button + practice-time widget (depends on Practice mode).

### Team
- Landing rework — surface the church; "Invite member" shouldn't be first.
- **Stats & insights** tab (most/least played song & key, top member).
- Admin/leader-only **Options** tab.
- **30-day soft team/account deletion** with countdown + restore (needs `deletion_at` + scheduled purge).
- Collect more member info (phone, leader-only, GDPR-sensitive) ❓ which fields?
- Needs a real demo-pass before the paid tier is sold.

### Settings · Help · Nav
- 🟡 **Big Settings rework** — panel taxonomy, fold **Account** fully in, restore the helper texts stripped earlier. Supersedes the older "add/reorg settings" + "mobile settings rework" lines; keep those as sub-tasks.
- Help: context-specific "?" per screen; surface feedback prominently.
- **Hamburger panel** ❓ keep or replace — decide, then rework. Motivational quotes ❓ keep or drop.
- FAB: more actions; nav → prev/next pill morph + motion.

### Notifications
- 🟡 **UX rework, mobile + desktop.** In-page "Clear all" is buried; the mobile FAB's Mark-all-read / Clear-all is a stopgap. Tray/page layout, grouping, and empty/overflow states all want a rethink.
- Consider an unsubscribe row in Settings.

### Interop & import
- **Photo / scanned-chart import** — a vision model behind an edge function
  (`chart-ocr`), gated on the existing unused `smart-import` entitlement.
  ⏭️ Tesseract was considered and rejected: it misreads exactly the characters
  that matter (`Bb` → `B6`).
- **PCO (Planning Center) bridge** (OAuth + API client — its own project).
- **SongSelect `.usr`**; a **Migration Hub** onboarding screen with per-app export instructions.
- **Multi-song PDFs** — detected and explained today, not split. Splitting is its own feature.
- **Export as ChordPro** (`.cho`).

### PDF export
More entry points (library row, SetlistPlayer, PracticeView), NNS in PDF, chord
diagrams in PDF, per-song setlist subtitle, cover-page customisation, total set
duration, per-song selection, A4/Letter toggle, hide cover/tabs/notes toggles,
margins/spacing, section-per-page, reset-to-defaults, jsPDF fallback.

### Chores
- Extend the **trash bin** (soft-delete) to setlists + a team-library bin (songs done).
- **Naming consistency** pass (casing across headers).
- Repo file clean-up (dead/orphaned files, stale docs).
- More / custom roster instruments (per-team).
- `team_activity` retention job ⏭️ deliberately deferred.

### Competitive parity — OnSong
No big gap on the core job; at parity or ahead on multi-arrangement, structure,
collaboration, scheduling, sync, search, PWA/offline. Their lead is ecosystem
extras + a content catalog. **Worth adding, in order:** metronome (slated for
Practice) · inline lyric formatting (cheap, visible) · backing-track playback ·
annotations/freehand markup · import expansion · _(church bet)_ lyrics
projection · _(cheap)_ tuner + tap tempo.
⏭️ **Skip:** hardware, their content catalog (licensing), multi-output HDMI,
MIDI, Scenes/DMX, device master/slave, Voice Control.

---

## 7. Decisions waiting on you

Everything marked ❓ above, collected. These block or reshape real work.

| # | Decision | Blocks |
| :-- | :--- | :--- |
| 1 | **Supabase Pro (~$25/mo) for a staging project?** | §2.2 — the highest-risk ops gap |
| 2 | **Analytics: Plausible, PostHog, or none?** | §3.7 — evidence for every roadmap bet after |
| 3 | **Where does bulk import live** — welcome flow or Settings? | §4 pass 8, the migration path |
| 4 | Rich editor: Story-behind only, or Notes too? | Song details pass |
| 5 | Hamburger panel — keep or replace? | Settings/Nav pass |
| 6 | Member suggestions — per-field or whole-arrangement? Who approves? | Post-beta epic |
| 7 | Team: which extra member fields (GDPR-sensitive)? | Team pass |
| 8 | **Which bottom sheet is the app's** — `BottomSheet` (plain titled, 6 uses) or `MobileSheet` (drawer aesthetic, 1)? | Finishing the design system |
| 9 | Absorb `ScreenHeader` into `PageHeader`? Visual change on 2 screens. | Settings / setlist-editor pass |

---

## 8. Recently shipped

- **Component architecture** (`0.17.0-beta.2`+) — definitive component map
  (`docs/COMPONENTS.md`); `src/components/` → `src/features/*`; `@/` alias with
  ESLint enforcement; folder-name collisions resolved; `chart → editor`
  back-edge closed; svguitar lazy-loaded (−162 KB from the reader path,
  −158 KiB precache).
- **New Song flow rework** (`0.17.0-beta.2`) — one Add-a-song surface (Labs
  `addSongModal`); paste review with repetition-inferred section chips (Labs
  `pasteIntoChart`); **PDF import** (font-based chord detection, two-column
  gutter split, Romanian section vocabulary); repeat marks `//: … ://` read as
  play order. **Four data-loss bugs fixed** — save dropping pasted lyrics, an
  unlabelled paste vanishing through `parseSongMd`, "+ Add section" wiping a
  paste, the canvas stamping `Untitled`/`C` onto unnamed songs.
- **0.15.0 — A hands-on song editor** — editor cards (Labs `songEditorCards`);
  drag-to-reorder sections; drag-a-chord-to-move; inline Play-order chips;
  inline lyric composer + smart chord-sheet paste; undo/redo; version history;
  pre-save validation.
- **0.14.0** — unified diacritic/typo-tolerant **search** + ⌘K; multi-filter
  library; customizable table columns (synced); Cards/Compact/Table views.
- **0.13.0** — sync conflict resolver + retry/offline-queue reliability.
- **0.12.x** — app-shell redesign, stage headers, private + team notes,
  customizable dashboard, multiple workspaces, campfire single-song Play.
- **Sync hardening** — Web Locks mutex around every pass, keyset pagination,
  reconciled adoption (`sync/adopt.js`), reference-preserving
  `applyKeyHistories`, delta pulls, server-side identity keys, two-device
  convergence suite, Sync Doctor, setlist↔song link healing.
- **Scheduling & Notifications pillar** — Web Push + `notify-worker` on a
  minutely pg_cron (RFC 8291/8292, interop-tested), realtime publication fix,
  My-Schedule v2, scheduling grid, availability widgets.
- **Foundation** — GDPR delete-account, legal pages, security pass, CI + branch
  protection, per-song persistence, PDF iframe + enforcing CSP.
