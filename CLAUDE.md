# Setlists.md

A Progressive Web App for worship chord charts. Install on iPad/Android tablet, use full-screen, works offline.

## Stack

- **Vite 7** — build tool + dev server (`npm run dev`)
- **React 19** — UI framework (JSX, no TypeScript)
- **idb-keyval** — IndexedDB wrapper for local persistence
- **vite-plugin-pwa** — service worker + manifest for offline/installable
- **svguitar** — chord diagram rendering (MIT license)
- **jszip** — setlist export/import as .zip bundles
- **Hosted on Vercel** — auto-deploys from `master` branch

## Commands

```bash
npm run dev      # Start dev server (localhost:5173)
npm run build    # Production build to dist/
npm run preview  # Preview production build
npm run lint     # ESLint
```

## Versioning

The app follows **Semantic Versioning 2.0.0** (https://semver.org):
`MAJOR.MINOR.PATCH`, with a pre-release suffix while in development.

The release levels describe **a whole release**, not each feature:
- **MAJOR** — breaking change to stored data shapes, the `.md` format,
  or any user-visible contract that requires migration.
- **MINOR** — new feature(s) or non-breaking enhancements (added
  settings, new screens, additive schema fields with safe defaults).
- **PATCH** — bug fixes, copy tweaks, visual polish, dependency bumps
  that don't change behaviour.

### Release train (beta → main)

Work flows: short-lived **feature branches off `beta`** → merged into
`beta` → tested → **`beta` merged into `main`** for a real release. The
version number reflects this with two phases:

- **During a beta cycle**, `package.json#version` is
  `<TARGET>-beta.<N>` — e.g. `0.13.0-beta.3`. `<TARGET>` is the version
  that will release to `main` next; it **stays fixed for the whole
  cycle**. The **`-beta.<N>` counter increments on each `finish`** of a
  feature, so a stream of features does NOT inflate the MINOR.
- **At promotion to `main`**, the suffix is **dropped**: `0.13.0-beta.7
  → 0.13.0`. That's the one and only time the user-facing number moves
  up. So `main` goes e.g. `0.12.0 → 0.13.0` cleanly — never a 4-version
  jump.

Pre-release order (SemVer): `0.13.0-beta.1 < 0.13.0-beta.2 < 0.13.0`.
(Earlier-stage labels `-pre-alpha`/`-alpha` are still valid if a build
isn't beta-worthy yet; the mechanics — fixed base, incrementing counter
— are identical.)

Single source of truth is `package.json#version`. Vite injects it as
the build-time global `__APP_VERSION__` (`define` in `vite.config.js`),
declared as a readonly global in `eslint.config.js`. The Settings
"About" panel and hub row both render `v${__APP_VERSION__}` — never
hardcode the version in JSX.

## "finish" workflow (on a feature branch → beta bump)

When the user says **"finish"** (or "ship it", "wrap up") while on a
feature/`beta` branch, close out the current batch as a **pre-release
bump** — do NOT cut a new MINOR. Run, in order:

1. **Resolve the version.** Read `package.json#version`.
   - If it already has a `-beta.<N>` suffix → keep `<TARGET>`, set
     `N = N + 1`. **Exception:** if this batch is a *higher* level than
     `<TARGET>` currently reflects over `main`'s last release (e.g.
     `<TARGET>` is a PATCH but this batch adds a feature → MINOR; or a
     breaking change → MAJOR), raise `<TARGET>` accordingly and reset to
     `-beta.1`.
   - If it has **no** suffix (sitting on a released number) → start a new
     cycle: `<TARGET>` = current bumped per this batch's highest level
     (PATCH/MINOR/MAJOR), suffix `-beta.1`.

2. **Update `src/data/changelog.md` — ONE entry per cycle.** Find the
   in-progress `## <TARGET> — <title>` block (the newest one). If it
   exists, **append** this batch's bullets into its `Added`/`Improved`/
   `Fixed` sections — do **not** add a new heading per feature. If it
   doesn't exist yet (first feature of a new cycle), create it under the
   page intro using this exact shape so `WhatsNewPanel.jsx` parses it:

   ```md
   ## 0.13.0 — Short title for the release
   *Month YYYY*

   ### Added
   - One bullet per user-visible addition.

   ### Improved
   - One bullet per user-visible enhancement.

   ### Fixed
   - One bullet per user-visible bug fix.
   ```

   Heading version is the bare `<TARGET>` (no `-beta`), since the entry
   describes what's coming in that release. Only include sections that
   apply (`Added`/`Improved`/`Fixed`/`Removed`/`Security`). Bullets in
   the user's voice; use `currentDate` for the month.

3. **Set `package.json#version`** to `<TARGET>-beta.<N>`. Nothing else —
   `__APP_VERSION__` flows from there.

4. **Verify.** `npm run build` (confirms the changelog parses + version
   compiles). Skip `npm run lint` unless code changed that day (the repo
   has pre-existing lint noise).

5. **Commit + push the feature branch.** Subject `Beta <TARGET>-beta.<N>:
   <short title>`, bullets as the body. Push to the active branch with
   `git push -u origin <branch>`.

6. **Merge into `beta`.** "finish" includes promoting the batch onto `beta`:
   `git fetch origin beta`, then fast-forward `beta` to the feature branch
   (`git push origin <branch>:beta`) when `beta` is a direct ancestor (the
   normal case — no merge commit). If it's diverged, merge `<branch>` into a
   local `beta` and push. Never force-push `beta`. Stay on the feature branch
   afterwards. (Tagging still happens only at "release"/promote, on `main`.)

Do **not** tag on feature/`beta` branches.

## "release" / "promote" workflow (beta → main, via PR)

When the user says **"release"**, **"promote"**, **"ship to main"** (or
"finish and push to main"), turn the accumulated beta cycle into a real
release. **`main` is a protected branch** — it takes changes ONLY through a
merged pull request (no direct pushes, no local `git merge` + push). Run, in
order:

1. **Drop the pre-release suffix.** `package.json#version`:
   `<TARGET>-beta.<N> → <TARGET>` (e.g. `0.13.0-beta.7 → 0.13.0`).
2. **Finalise the changelog.** The newest `## <TARGET>` block becomes the
   release entry — confirm the title + `*Month YYYY*` are right.
3. **Verify** with `npm run build`.
4. **Commit the release bump** with subject `Release <TARGET>: <short title>`,
   then land it on `beta`: push the active branch, and fast-forward `beta` to
   it (`git push origin <branch>:beta`) so the PR head is `beta`. (Diverged →
   merge into a local `beta`, never force-push.)
5. **Open the PR: `beta → main`.** Use the GitHub MCP tools
   (`mcp__github__create_pull_request`), base `main`, head `beta`, title
   `Release <TARGET>: <short title>`, body summarising the cycle. If a PR
   template exists, populate its headings.
6. **Wait for CI to go green** on the PR (the CI workflow runs on PRs to
   `main`). Poll `mcp__github__get_pull_request` / the checks tools; do not
   merge on red. If the user subscribed the session to PR activity, react to
   the CI events instead of polling.
7. **Merge the PR into `main`** (`mcp__github__merge_pull_request`). A merge
   commit is fine; the protected branch forbids any other path in.
8. **Tag the release on `main`.** After the merge, fetch `main`, then
   `git tag -a v<TARGET> -m "Release <TARGET>"` on the merge commit and push
   the tag. Tags are cut from `main` at release — never from feature/`beta`
   branches.

Do **not** attempt to push straight to `main` — it will be rejected by branch
protection. The PR is the only door.

## Project Structure

**The app is grouped by feature.** `src/features/<feature>/` owns everything for
one surface; `src/ui/` is the shared design system; `src/app/` is the shell
chrome. There is no `src/components/` — it was a flat dump of 63 files beside
half-populated subfolders, and it's gone. The folders map 1:1 onto the component
map in **`docs/COMPONENTS.md`**, which is the authoritative per-component
reference (job, owner files, state, status, debt).

**Imports use the `@/` alias** (= `src/`, configured in `vite.config.js` +
`jsconfig.json`). Anything outside a file's own folder goes through `@/`; only
same-folder siblings stay relative. Don't reintroduce `../../` chains — they're
what made the old layout expensive to change.

```
src/
├── main.jsx              # Entry point
├── App.jsx               # Root: view routing, data management, sync orchestration,
│                         #   notification merge, preference cloud-sync, auth-URL cleanup.
│                         #   3.1k lines — the split is COMPONENTS.md §1.1.
├── parser.js             # .md parser/serializer: parseSongMd, songToMd, parseLine,
│                         #   generateId, parseTabBlock, serializeTabBlock, parseTabPositions
├── music.js              # Transpose engine (transposeChord, transposeKey, sectionStyle)
├── arrangements.js       # v2 multi-arrangement schema
├── storage.js            # IndexedDB layer (loadSongs/saveSongs, loadSetlists/saveSetlists,
│                         #   clearAll, loadVersions/pushVersion)
├── importer.js           # smartImport() — ChordPro/OpenSong/UG/text detection
│
├── app/                  # Shell chrome (COMPONENTS.md §1.2)
│   ├── DesktopLayout.jsx · Sidebar.jsx · TopHeader.jsx
│   ├── MobileTopBar.jsx · BottomNav.jsx · MobileDrawer.jsx
│   └── SidePeek.jsx · ErrorBoundary.jsx
│
├── ui/                   # Design system — 57 primitives (COMPONENTS.md §0.5)
│   ├── Button.jsx · Card.jsx · Tabs.jsx · Dialog.jsx · Input.jsx …
│   └── (see COMPONENTS.md §0.5 for the duplicate-primitive debt)
│
├── features/
│   ├── library/          # Library.jsx, SongCard, LibraryFilters
│   ├── song/             # SongHub (song-open target), SongDetails, SongPlayerBar,
│   │                     #   FullscreenChartViewer (WIP)
│   ├── chart/            # ChartView (reader), SectionBlock, TabBlock, ChordDiagram,
│   │                     #   StructureRibbon, SongMap, AaMenu, ChartStyleControls
│   ├── editor/           # Editor.jsx shell + ArrangeTabV2 (canvas), WriteTab, TabsTab,
│   │                     #   MetadataPanel, PreviewPanel, ChordPicker, TabGridEditorV2,
│   │                     #   PasteReview, StructureControl …
│   ├── import/           # AddSongModal (Labs) · NewSongModal (legacy) · BrowseTab · ImportTab
│   ├── dashboard/        # Dashboard.jsx
│   ├── setlists/         # Setlists.jsx (library), SetlistCard, SetlistFilters, SetlistCardRow
│   ├── setlist-editor/   # SetlistBuilder + SetlistItemRow, SetlistIdentityCard,
│   │                     #   SetlistMetaForm, SetlistSongPicker, RecommendedNextPanel,
│   │                     #   BandPanel, BandReadCard
│   ├── setlist-viewer/   # SetlistOverview (2 render sites!), SetlistOverviewV2 (legacy),
│   │                     #   SetlistViewerCards
│   ├── performance/      # SetlistPlayer, PerformanceView, PracticeView, LiveFinale,
│   │                     #   PracticeFinale, PerformanceLayoutSheet/SetlistSheet, WakeLockExplainer
│   ├── sharing/          # ShareSetlistDialog, SharedSetlistViewer, ExportSetlistDialog
│   ├── settings/         # Settings.jsx, Account.jsx, AccountWall, AccountPanel,
│   │                     #   SyncSettings, SyncDoctor, ChartStylePanel, WhatsNewPanel …
│   ├── team/             # TeamScreen, TeamBanner, ActivityFeed
│   ├── scheduling/       # Schedule, SchedulingGrid, ScheduleCalendarView/ListView,
│   │                     #   DateStatusModal, RecurringPicker
│   ├── notifications/    # NotificationTray, NotificationsPage, NotificationItems
│   ├── billing/          # PricingScreen
│   ├── legal/            # LegalPage, HelpPage, FeedbackButton
│   ├── onboarding/       # OnboardingFlow + screens/, ProgressChecklist, ChordLine,
│   │                     #   FounderNote, IOSInstallHint
│   ├── auth/             # AuthScreen, AuthCallback, RecoveryScreen, GoogleDriveCallback
│   ├── sync/             # SyncStatus, ConflictResolver (the sync engine's UI)
│   └── design/           # LydianShowcase + the primitives only it uses (Button2,
│                         #   PageHeaderLegacy) — showcase only, not app code
│
├── auth/                 # Providers, not screens
│   ├── supabase.js       # Supabase client (null when env vars missing)
│   ├── AuthContext.js · useAuth.js · AuthProvider.jsx
│   └── TeamContext.js · useTeam.js · TeamProvider.jsx
├── sync/                 # Two engines + adopt/lock/merge/providers (COMPONENTS.md §0.3)
├── lib/ · hooks/ · contexts/   # Shared logic, hooks, workspace context
├── pdf/ · import/ · share/ · setlist/ · notes/ · push/ · billing/
├── data/
│   ├── demos.js          # 3 demo songs loaded on first run
│   ├── chordShapes.js    # ~50 worship chord fingering shapes for svguitar
│   └── chartThemes.js · stageModes.js
├── styles/index.css      # Global styles, CSS variables, fonts
└── __tests__/            # 40 suites, 619 tests — all pure logic (no render tests yet)

supabase/
├── migrations/           # SQL applied manually (or via supabase db push).
│                         #   See "Supabase Schema" below.
└── functions/            # Edge functions: notify-worker, stripe-*, cover-art
```

**Two rules, both enforced by ESLint (`no-restricted-imports`):**

1. **Never `../`.** Anything outside a file's own folder goes through `@/`;
   same-folder siblings stay `./x`. A file move then never rewrites an
   unrelated import.
2. **No `@/components/*`.** That tree is gone. Code belongs to a feature
   (`@/features/<x>`), the design system (`@/ui`), or the shell (`@/app`).

**Where a shared module goes.** Used by one feature → live in that feature's
folder. Used by several → `lib/` (pure logic) or `hooks/` (React hooks). Only
`auth/`, `sync/`, `pdf/`, `push/`, `data/`, `contexts/` keep their own
top-level folders — they're subsystems, not helpers. `auth/` and `sync/` each
have a matching `features/` folder: **`src/<x>/` is the engine, `features/<x>/`
is its UI** (`sync/team-engine.js` vs `features/sync/SyncStatus.jsx`).

## Architecture

- **No router** — App.jsx manages views via `view` state (`library`, `song-hub`, `editor`, `setlist-build`, `setlist-play`, `setlist-performance`, `signin`, `recovery`, `auth-callback`, …). The `song-hub` route replaced the old `chart` route entirely.
- **Song Hub** (`SongHub.jsx`) is the song-open target. It owns identity + transpose + tab navigation and embeds `ChartView` as **just the reader** (`embedded` + controlled `selectedKey`/`displayMode`/`aaAnchor`/`arrangementId` props). Tabs are **Chart / Lyrics / Details** rendered as brand-coloured pills (matching the top nav). The **Aa** display popover and a centered **"Advanced"** `Dialog` both render inside `ChartView`; the Aa + full-screen buttons live in the reader **tab header** and show only on Chart/Lyrics (hidden on Details). Full-screen opens `FullscreenChartViewer` (WIP — future home of the chart "view modes"). The hub ⋮ menu carries Print/Move/Copy (desktop) plus Campfire+Edit folded in on mobile. Backing-track audio is `SongPlayerBar` (YouTube-only): a single card pinned to the bottom, laid out as one non-wrapping row (play · title · scrubber · time) so the scrubber stays on the title's line even on phones.
- **No server for song data** — songs/setlists stored client-side in IndexedDB via idb-keyval. Supabase only handles auth + account-level preferences.
- **Songs** are stored as parsed objects on a **v2 multi-arrangement schema** (`src/arrangements.js`): top-level identity (`id`, `title`, `artist`, `ccli`, `tags`, `keyHistory`, `defaultArrangementId`) plus an `arrangements[]` array. Each arrangement carries its own `key`, `tempo`, `time`, `capo`, `notes`, `structure[]`, and `sections[]`. The `.md` format flattens to a single arrangement; multi-arrangement state is app-internal.
- **Notes live at three levels** — per-arrangement `arrangement.notes` (markdown, shared across setlists), per-setlist-item `items[i].note` (100-char cue), and per-break `items[i].note` (500-char markdown). Two scoped layers sit beside them: `team_notes` (per-**user** private, via `usePrivateNotes`) and `team_setlist_notes` (per-setlist **leaders-only**, via `useLeaderNote` — the reader finale's reflection).
- **The .md format** is the interchange format — YAML frontmatter + `## Section` headers + `[Chord]lyrics` inline chords + `> notes` for band cues + `{tab}...{/tab}` for guitar tabs
- **Section types** each have a color scheme defined in `music.js` (Intro, Verse, Chorus, Bridge, etc.)
- **Transpose** is applied at render time via `transposeChord()` — stored data is always in the original key
- **Tab blocks** are parsed into structured objects `{ type: 'tab', strings, time, raw }` — `raw` preserves original ASCII for round-trip fidelity
- **Modulate markers** are parsed into `{ type: 'modulate', semitones: N }` objects in `section.lines[]` — cumulative offsets computed per section in ChartView, applied mid-section in SectionBlock with visual key-change badges
- **Tab editing** — the dedicated `TabsTab` manages a per-song reusable tab library (create/edit/delete via `TabGridEditor`); the Advanced (`WriteTab`) editor can insert tab references and convert clipboard tabs in-place
- **Editor** — `md` state lives in Editor.jsx shell; all tabs receive `md` + `onChange`; switching tabs preserves content
- **Split-screen preview** — `useSyncExternalStore` with `window.matchMedia('(min-width: 768px)')` — side-by-side on wide, toggle on narrow

### Search, filters & list views (shipped 0.14.0)

- **Unified search** — `src/lib/search.js` is the single engine for every
  song/setlist search bar (Library, Setlists, `MobileTopBar`, the desktop ⌘K
  `TopHeader` search, `SetlistSongPicker`). `normalizeText()` folds diacritics +
  punctuation (`Laudă`→`lauda`, drops apostrophes); `searchSongs`/`searchSetlists`
  run an exact diacritic-folded pass with a **fuse.js** fuzzy fallback over all
  metadata fields; `highlightSegments()` backs `ui/Highlight.jsx` (accent-correct
  match marks). Pure functions — call sites keep their own `useMemo`/`useDeferredValue`.
- **Library facets** — `src/lib/songFacets.js` (`buildFacetOptions`,
  `matchesFacets`) drives `library/LibraryFilters.jsx`: key/tempo/theme/language/
  year/scripture/moment, **OR within a facet, AND across facets**, plus tags.
  `setlist/SetlistFilters.jsx` is the setlists equivalent (service + tags).
- **Customizable table columns** — `src/lib/tableColumns.js` + `ui/ColumnsMenu.jsx`
  let users show/hide columns in the Songs and Setlists tables. Persisted in
  `settings.tableColumns` (a key in `PORTABLE_PREF_KEYS`, so it **syncs**).
  Entitlement-gated columns (Service=church, Schedule=team) only appear when the
  workspace allows them. (Drag-reorder is not built yet — show/hide only.)
- **List view modes** — both lists offer **Cards / Compact / Table**. The choice
  is a **per-device** preference via `src/lib/usePersistentView.js` (localStorage,
  NOT synced); `null` means "auto" → Table on desktop, Cards on mobile. The
  mobile Table scrolls horizontally and drops the responsive column floors (a
  `colFloor` helper) so the chosen columns all render.

### Auth + Account-Level Preferences

- **Supabase optional** — `auth/supabase.js` exports `null` when env vars are missing; every call site degrades gracefully to a guest experience.
- **Redirect strategy** — OAuth uses `${origin}/auth/callback` (handled by `AuthCallback.jsx`). Magic-links, password resets, and signup confirmations redirect to `${origin}/`; `detectSessionInUrl` consumes the hash and an App.jsx effect strips lingering `access_token` / `type=recovery` / `?code=` so the URL bar stays clean.
- **Password recovery** — `type=recovery` in the URL hash routes to `RecoveryScreen.jsx`. Navigating Back before completion calls `signOut` so the interim recovery session doesn't linger.
- **Preferences cloud-sync** — defined in `App.jsx` via `PORTABLE_PREF_KEYS`. On sign-in, App hydrates once from `profile.preferences` (cloud wins). After hydration, local changes are pushed to `updateProfile({ preferences })` debounced 800 ms. Device-local fields (`onboardingComplete`, `helpPageSeen`, `notifications`) never sync.
- **Display name** — `profile?.display_name || settings?.userName || 'Guest'`. Editing in `Account.jsx` writes to both the local settings and `updateProfile({ display_name })` when signed in. When signed in, the account name replaces the "Setlists.md" label in the drawer footer and Settings about header.
- **Fullscreen performance** — `setlist-performance` and `setlist-play` always pass `isFullscreen={true}` to `DesktopLayout` so the sidebar collapses on desktop/tablet; the existing mobile layout already hides chrome for these views.

## .md Format Quick Reference

```
---
title: Song Name
artist: Artist
key: C
tempo: 120
time: 4/4
capo: 2
structure: [Verse 1, Chorus, Bridge, Chorus]
ccli: "1234567"
tags: [worship, fast]
spotify: https://...
youtube: https://...
notes: Performance notes
---

## Verse 1
> Band cue text
[C]Lyrics with [G]inline chords
Plain lyrics line

## Chorus
{tab, time: 4/4}
e|--0--2--3--|
B|--1--3--5--|
G|--0--2--4--|
D|-----------|
A|--3--------|
E|-----------|
{/tab}
[Am]More [F]lyrics {!inline note}
{modulate: +2}
[Bm]Chords after modulate are shifted +2 semitones
```

## Modulate Format

Modulate markers shift all subsequent chords by N semitones. Parsed into `{ type: 'modulate', semitones: N }` in `section.lines[]`.

- Cumulative: multiple `{modulate}` markers stack across sections
- Applied at render time on top of user transpose and capo
- Visual "Key Change: +N" badge rendered at marker position
- Round-trip: serialized back to `{modulate: +N}` in `songToMd()`

## Tab Block Format

Tab blocks live inside sections. Parsed into `{ type: 'tab', strings: [{note, content}], time, raw }`.

- `strings` — array of `{ note: 'e'|'B'|'G'|'D'|'A'|'E', content: string }`
- `raw` — original lines preserved for round-trip serialization
- `time` — optional time signature from `{tab, time: 4/4}`
- Technique markers in content: `h` hammer-on, `p` pull-off, `s` slide, `b` bend, `x` mute, `~` vibrato

**Serialization**: `songToMd()` calls `serializeTabBlock(tab)` for tab objects in `section.lines[]`.
**FormTab**: Uses `serializeTabBlock` when converting `s.lines` to lyrics string (avoids `[object Object]`).

## Styling (Geist Design System & Tailwind v4)

We utilize standard Vercel Geist design tokens mapped via Tailwind CSS configuration in `styles/index.css`.
- Backgrounds: `--ds-background-100`, `--ds-background-200`
- Colors/Text: `--ds-gray-1000` (primary text), `--ds-gray-700` (secondary), `--ds-gray-400` (borders)
- Typography: Uses standard `text-heading-*` and `text-copy-*` utilities mappings mimicking Geist definitions.
- Special components limit their custom CSS, leaning entirely on standard `className` declarations from Tailwind.
- `--chord` (gold) is preserved specifically for unique chord coloration logic.

### "modes" Theme Variant

A page-level visual variant, opted-in via `data-theme-variant="modes"` on the page root (currently applied to `Dashboard.jsx`). It mirrors the mobile drawer aesthetic: dark radial gradient (teal top-left + plum bottom-right on near-black base) with translucent card surfaces.

Tokens exposed inside a `[data-theme-variant="modes"]` subtree:
- `--modes-surface` / `--modes-surface-strong` — translucent white fills for cards
- `--modes-border` — 9% white hairline
- `--modes-text` / `--modes-text-muted` / `--modes-text-dim`

Helper classes (only active inside the variant):
- `.modes-card` — `rounded-xl`, 4% white fill, hairline border
- `.modes-card-strong` — `rounded-2xl`, stronger fill, for hero surfaces
- `.modes-label` — uppercase + wide tracking + dim text

## Mobile Layout Specification

The mobile experience (< 640px) is a bespoke shell distinct from the desktop sidebar layout.

### Shell Structure
- `DesktopLayout`'s `<main>` is `flex flex-col` + `overflow-y-auto`, so child pages can use `flex-1 min-h-0` to fit the viewport (Dashboard does this to avoid outer scroll).
- An iOS-style push transform is applied when the drawer is open (`translateX(72%) scale(0.92)`, 24px radius, drop shadow). `will-change: transform` is only set during the open state so it doesn't interfere with sticky children while idle.
- `MobileTopBar` is rendered as a child of `<main>` on the three main tabs only (`home`, `library`, `setlists`) — not on chart/editor/player/settings. It uses explicit inline `position: sticky; top: 0` with safe-area padding so it stays pinned across iOS Safari quirks.
- `BottomNav` is `position: fixed`, borderless, laid out as a 3-column grid of soft tiles (Dashboard / Setlists / Songs). Secondary destinations (Settings, Help, Design, Notifications) live inside the drawer.
- `MobileDrawer` is rendered at the App root (not inside `<main>`) so its fixed positioning is not affected by the main element's transform.

### MobileTopBar
- Transparent chrome (no bottom border, no shadow) with `backdrop-blur-md` so page content shows through.
- One horizontal card at `h-14 rounded-xl` containing the hamburger (embedded left, `w-12`, no divider) and a plain text input.
- No search-icon affordance — the placeholder communicates intent.
- A brand-color `+` button (`w-14 h-14 rounded-xl`) sits to the right and is context-aware: Library → new song, Setlists → new setlist, Dashboard → dropdown picker.
- A unified search queries both songs and setlists; results render as an absolute dropdown below the bar.

### BottomNav
- Clean, borderless, floating 3-tile grid — no heavy chrome. Transparent background, with each tab rendered as a soft `rounded-xl` tile (`h-14`) inside a `grid grid-cols-3 gap-2` container.
- Active tile: `--color-brand` text on a `--ds-gray-100` fill. Inactive: muted gray text, fill appears only on tap.
- Safe-area padding lives on the nav root, not the tiles, so the tiles stay visually compact above the home indicator.

### MobileDrawer
- Slides in from the left (300ms `cubic-bezier(0.32, 0.72, 0, 1)`) with swipe-to-close (threshold 35% of panel width).
- Background uses a brand-forward radial gradient (teal spotlight top-left, plum accent bottom-right on `#0b0910`) — intentionally distinct from reference apps.
- Sections: close button, serif greeting, (signed-in-only) "Your Account", "Your Plan", shimmering Upgrade-to-Pro pill with sparkles on both sides, optional "Create account" CTA for guests (`!isSignedIn`), stat cards (songs/setlists), nav rows (Settings, Notifications, Help, Design).
- Rows and stat cards use `rounded-xl` for a squared, card-forward look.

### Mobile-only Affordances
- `Library` and `Setlists` hide their inline search inputs on mobile (`hidden sm:block`) because the global top bar handles search.
- Their FABs are tablet-only (`hidden sm:block lg:hidden`) — mobile uses the top bar's `+` button.
- `Dashboard` drops all mobile-specific headers/FABs, runs under the "modes" theme variant, and uses `flex-1 min-h-0 overflow-hidden flex-col` so it fills the viewport without outer scroll. The "Recently Edited" card becomes the only internally scrollable region on the page.

### Theme Setting
Settings → Appearance → Theme offers three options stored on `settings.theme`:
- `default` — follows the OS via `matchMedia('(prefers-color-scheme: light)')` and live-updates on system changes.
- `light` — forces the light palette (`data-theme="light"` on `<html>`).
- `dark` — forces the dark palette (default).

The theme is applied by an effect in `App.jsx` that sets/clears `document.documentElement.dataset.theme` and subscribes to the media query only when `default` is selected.

## Conventions

- All components use inline styles (no CSS modules or styled-components)
- No TypeScript — plain JSX
- Imports between components use relative paths (`../music`, `../parser`, etc.)
- Song row elements in Library use `<div role="button">` (not `<button>`) to allow nested interactive elements
- Tab objects in `section.lines[]` are detected via `typeof line === 'object' && line.type === 'tab'`
- Modulate objects in `section.lines[]` are detected via `typeof line === 'object' && line.type === 'modulate'`
- Always check line type before calling `.trim()` on section lines (can be string, tab object, or modulate object)
- Auth buttons use the shared `Button` component (variant=brand lg for primary CTAs, secondary md for alternates) — don't hand-roll auth buttons with raw `<button>` + inline styles
- Auth forms surface per-action loading state via a `busyTarget` string + `Button.loading` — this lets one button spin while the others stay disabled but idle
- Auth error copy goes through a `friendlyAuthError(err)` helper that checks `navigator.onLine` first, then matches common Supabase messages. Add new cases there rather than inline in handlers
- Last-used email is persisted under `localStorage['setlists-md:last-email']`; only write on a successful call

## Supabase Schema

The signed-in experience depends on a `profiles` table with columns:
`id`, `email`, `display_name`, `plan`, `preferences` (JSONB), `avatar_url`,
`updated_at`. `avatar_url` is a public URL into the `avatars` storage bucket
(personal profile picture).

The Teams/Church tier adds these additional tables:

- **`teams`** — `id`, `name`, `location`, `owner_id`, `plan` (team|church),
  `max_seats` (10 for team, 30 for church), `logo_url`, `created_at`,
  `updated_at`, plus **per-workspace subscription** columns:
  `subscription_status` (trialing|active|past_due|canceled|unpaid, default
  `active`), `stripe_customer_id`, `stripe_subscription_id`,
  `current_period_end`. `logo_url` is a public URL into the `avatars` bucket
  (church/team logo, admin-editable). **Each workspace is its own billing
  unit** — one Stripe subscription per team, the `owner_id` is the payer, and
  a single user can own many teams (no uniqueness on `owner_id`). The canonical
  tier field is `teams.plan`; the older `teams.billing_plan` column is
  **deprecated** (no longer read — use `teams.plan`).
- **`team_members`** — `id`, `team_id`, `user_id`, `role` (admin|member),
  `invited_by`, `joined_at`, `instruments` (text[], default `{}`).
  Unique constraint on `(team_id, user_id)`. The `instruments` column is the
  per-team list of what the member plays (e.g. `{Drums, Vocals}`); used by the
  leader's roster picker to filter and to default a new schedule's role.
- **`team_schedules`** — `id`, `team_id`, `setlist_id`, `user_id`,
  `availability` (pending|available|unavailable|maybe), `role`.
  Unique constraint on `(setlist_id, user_id)`. **Do not** use a nested
  PostgREST select on `user_id` (e.g. `profiles:user_id(...)`); the
  relationship isn't exposed in the schema cache. Read with plain
  `select('*')` and join client-side against `members` from `TeamProvider`
  (which already enriches each row with `profile`).
- **`team_availability`** — `id`, `team_id`, `user_id`, `date`,
  `status` (available|unavailable|maybe), `notes`. Unique on
  `(team_id, user_id, date)`. Standalone date-based availability,
  independent of any setlist. Members write only their own row; any team
  member can read everyone's. Used by `CalendarWidget` (member opts in by
  tapping empty days) and by `BandPanel` (leader sorts/filters candidates
  by who's available on the setlist's date).

RLS policies:
- Members can view their own team and its roster.
- The owner can create/update/delete the team.
- Admins (and team owners on self-insert) can add members.
- Admins can update member roles and remove members.
- Any user can remove themselves (leave).

Migrations live in `supabase/migrations/`. Apply them with the Supabase
CLI (`supabase db push`) or copy/paste the SQL into the project's SQL editor.

- `20260424_add_profile_preferences.sql` — adds the `preferences` JSONB
  column that account-level preference sync writes to. The client
  gracefully falls back to the base profile select if this column is
  missing, so sign-in still works before the migration is applied, but
  cross-device pref sync is a no-op until it is.
- `20260427_create_teams.sql` — creates the `teams` and `team_members`
  tables with RLS policies. Required for Team/Church tier features.
- `20260502_team_planning.sql` — adds `team_members.instruments` (text[])
  and creates the `team_availability` table with RLS. The `TeamProvider`
  member load gracefully falls back to selecting without `instruments` if
  the column is missing, so the team library still works before this
  migration is applied — but the roster picker won't see instruments and
  the dashboard calendar's availability marking is a no-op.
- `20260602_add_avatars.sql` — adds `profiles.avatar_url` + `teams.logo_url`
  and creates the public `avatars` storage bucket with RLS (public read;
  users write `users/{uid}/…`; team owners/admins write `teams/{team_id}/…`).
  Uploads go through `components/ui/AvatarUploader.jsx`; avatars render in the
  desktop header, the mobile workspace FAB/switcher, and the Account/Team
  settings forms.
- `20260604_team_subscriptions.sql` — adds the per-workspace subscription
  columns to `teams` (`subscription_status`, `stripe_customer_id`,
  `stripe_subscription_id`, `current_period_end`) and grandfathers existing
  teams to `active`. This is the data layer for "each band/church is its own
  paid subscription". The client is **status-aware but not yet status-gated in
  practice** — everything defaults to `active` until the Stripe webhook writes
  real statuses. The Stripe integration is **scaffolded but dormant** (see
  "Billing" below); `PricingScreen` still only captures email intent.
- `20260613_team_notes.sql` — adds the `team_notes` table: per-user **private**
  notes ("My note") for team workspaces, at song / setlist-item / section
  scope. Shared/team notes still live on the song & setlist objects; this is
  only the private layer. Scope columns (`song_id`, `setlist_id`,
  `section_key`) are NOT NULL default `''` so a plain unique constraint +
  upsert works across partial scopes. RLS: a user reads/writes only their own
  rows, scoped to teams they belong to. Client: `src/notes/usePrivateNotes.js`
  (cloud + IndexedDB cache, offline-capable) surfaced via `ui/NotesStack`.
- `20260729_team_setlist_notes.sql` — adds the `team_setlist_notes` table: the
  reader finale's reflection, **leaders-only and RLS-enforced**. ONE row per
  `(team_id, setlist_key, kind)` shared between a team's leaders — deliberately
  NOT per-user like `team_notes`. `setlist_key` is the **local** setlist id (the
  value promoted onto `team_setlists.setlist_key`), never the `team_setlists` row
  uuid, so the client never bridges through the sync manifest to read its own
  note. Also adds `get_user_leader_teams()` (SECURITY DEFINER: admin members
  UNION team owners). The old `serviceNote`/`practiceNote` setlist fields are
  **not** backfilled — those values are already on every member's device, and
  copying them into a leaders-only table would imply a privacy they never had.
  Client: `src/hooks/useLeaderNote.js` (cloud + IndexedDB cache, offline-capable,
  degrades to disabled on `42P01` so a pre-migration project still renders).

- `20260701_realtime_publication.sql` — adds `team_schedules`,
  `team_availability`, `team_notifications`, `team_activity` to the
  `supabase_realtime` publication (they were subscribed client-side but never
  published — realtime silently delivered nothing) + `replica identity full`
  so delete events pass `team_id=eq.` filters.
- `20260702_trigger_fn_hardening.sql` — revokes client EXECUTE on trigger
  functions (they're only ever run by their triggers).
- `20260702_identity_keys.sql` — adds `team_songs.song_key` /
  `team_setlists.setlist_key` (the embedded content id promoted to a real
  column), stamp triggers that derive the key from content for writers that
  don't send it, backfill, and unique `(team_id, key)` indexes. **Drops the
  unique title/name indexes** — same-title songs are legitimate now; identity
  is the key. The engine sends keys on every write and heals key collisions
  by adopting the existing row.
- `20260702_web_push.sql` — Web Push + notification worker infra:
  `push_subscriptions` (owner-only RLS), `team_notifications.pushed_at`,
  service-role-only `app_config` (holds the VAPID keys — values are inserted
  operationally, never committed), a `notify_on_schedule_request` trigger
  (being rostered now writes a durable notification), and `pg_cron`+`pg_net`
  jobs: `notify-worker` (every minute → the edge function) and a daily
  `cron-history-cleanup`.

RLS must allow each user to `select`/`update` their own profile row
(typical policy: `auth.uid() = id`).

## Entitlements

Feature gating uses `useEntitlement(feature)` from `hooks/useEntitlement.js`.
It resolves the current plan against a hierarchy (`free < sync < team < church`)
and returns `{ allowed, requiredPlan, currentPlan, subscriptionStatus }`.

The current plan is **context-aware**:
- In the Personal workspace it reads `profile.subscription_tier` (canonical;
  the legacy `profile.plan` column was dropped in `20260522_plans_migration`),
  with one-time-Pro carve-outs via `profile.is_pro`.
- In a team/church workspace it reads **`team.plan`** — the workspace's own
  tier — *and* requires the workspace's `team.subscription_status` to be
  `active`/`trialing`. A lapsed subscription drops the whole workspace to
  free-tier access (gates paid features off). Status defaults to `active` when
  the column is absent, so pre-migration projects keep working.

Gated features and their minimum plan:
- `cloud-sync`, `smart-import` → `sync`
- `team-create`, `team-library`, `team-collab`, `team-roles` → `team`
- `multi-service` → `church`

A non-hook version `checkEntitlement(plan, feature, isPro)` is available for use
outside React components (plan-only; it has no team-subscription context).

The `UpgradeGate` component (`ui/UpgradeGate.jsx`) wraps gated content
and shows a branded upgrade prompt when the user's plan is insufficient.

### Team Provider

`TeamProvider` (`auth/TeamProvider.jsx`) wraps the app tree inside
`AuthProvider` (in `main.jsx`). It provides team state via `useTeam()`:
`{ team, members, isAdmin, loading, hasTeamPlan, createTeam, inviteMember,
removeMember, leaveTeam, updateTeam, deleteTeam }`.

The provider only fetches from Supabase when the user has a `team` or
`church` plan. For free/sync users, the context value is a no-op stub.

### Billing (per-workspace subscriptions — scaffolded, dormant)

Each team/church workspace is its own Stripe subscription, paid by the team
`owner_id`. The pieces:

- **Edge Functions** (`supabase/functions/stripe-checkout`,
  `supabase/functions/stripe-webhook`; see `STRIPE_BILLING.md`).
  `stripe-checkout` is owner-only and serves `action: 'checkout' | 'portal'`;
  `stripe-webhook` verifies the Stripe signature and writes
  `subscription_status` / Stripe ids / `current_period_end` (and `plan`/
  `max_seats`) back onto the team. Deploy the webhook with `--no-verify-jwt`.
- **Client** — `src/billing/checkout.js` (`startTeamCheckout`,
  `openBillingPortal`, `BILLING_ENABLED`, `billingError`,
  `workspaceStatusLabel`). Wired into `Settings.jsx` (owner-only Subscribe /
  Manage billing rows) and `TeamScreen.jsx` (create form has a Team/Church
  tier picker; new workspace routes to checkout when enabled). The workspace
  switchers (`TopHeader`, `MobileTopBar`) show a Past due / Unpaid / Canceled
  badge per workspace. App handles the `?billing=success|cancel` return with a
  toast + URL cleanup.
- **Create-to-pay gating** — a user may create a workspace when
  `BILLING_ENABLED || hasTeamPlan`. With billing live, creating *is*
  subscribing (any signed-in user → checkout, workspace starts `unpaid` until
  the webhook confirms); while billing is dormant the `hasTeamPlan`
  entitlement gate stays so team features aren't given away for free.
- **Dormant by default** — the functions return `503 billing_not_configured`
  without `STRIPE_SECRET_KEY`, and the UI is hidden unless
  `VITE_STRIPE_ENABLED=true`. Turning it on requires the Stripe secrets +
  prices (Team/Church) and the dashboard webhook endpoint.

## Known Gotchas

- `section.lines[]` can contain **strings** (normal lines), **tab objects**, OR **modulate objects** — always type-check before calling string methods
- `chordTranspose` must be computed **before** any `useMemo` that references it (temporal dead zone)
- `parseInitialSections` in FormTab serializes both tab and modulate objects — do not use raw `.join('\n')`
- svguitar renders imperatively into a DOM ref — use `useRef` + `useEffect`, copy ref to local var in cleanup
- TabGridEditor uses `key` prop for remount when editing different tabs — do not add deps to the `initialTab` useEffect
- ChartView computes `sectionModOffsets` via `useMemo` — uses `acc` object instead of `let` variable to satisfy React compiler immutability rules
- Chart display lives in one **`AaMenu.jsx`** popover (Page/Lyrics/Chords tabs). In the hub it opens from the **reader tab header** (chart/lyrics only — hidden on Details, where the hub passes the button rect down as `aaAnchor`); standalone `ChartView` opens it from its own header. It writes the existing `settings` keys plus per-element colour (`chartLyricColor`/`chartChordColor`, fixed `CHART_COLOR_PALETTE`; falsy = follow theme, portable prefs). Each tab has a **Reset-to-default** (`ChartView.resetAa` clears that tab's override keys → fall back to the stage/app default), Columns are **1 / 2** only (no Auto), and the **chord-diagram toggle was pulled** (rendering + `showDiagrams` setting stay; tracked in `docs/PLAN.md`). The old Layout `BottomSheet` is now a centered **`Dialog`** ("Advanced") holding only the non-Aa controls (spacing, repeated sections, inline cues, role preset, tab instrument) — the duplicated columns/lyric-size/chord-size and the theme block were removed. Chart **view modes** (`ui/viewModes.js` `VIEW_MODES`) are no longer in the hub ⋮; they're slated to move into `FullscreenChartViewer`. `StageHeader` has an `actionsInTitle` prop (Chart-only). Not yet applied to Performance/Practice.
- **CSP + embeds** (`vercel.json`, enforcing — not applied by `npm run dev`): the Spotify/YouTube backing-track embeds need `*.spotifycdn.com` in `script-src`/`connect-src` (the iframe-api pulls its real code from `embed-cdn.spotifycdn.com`). **Spotify playback was dropped** because its embed API runs via `eval()` (would need `'unsafe-eval'`, a whole-app downgrade) and only streams full tracks to signed-in Spotify users; `SongPlayerBar` is YouTube-only. Spotify links still drive **cover art** (`lib/coverArt.js` → the `cover-art` edge function, server-side oEmbed — no eval, no CSP issue). `lib/embedPlayers.js` loads the IFrame APIs once and clears its memo on failure so a blocked first load can retry; `SongPlayerBar` has a readiness **watchdog** that re-creates a stalled player (auto-recovers the dropped first-init).
- Preference hydration runs **once per user id** via `prefsHydratedForUserRef` — don't re-run it on every profile change or you'll clobber a later local edit with the cloud value. The ref is cleared on sign-out.
- Only keys in `PORTABLE_PREF_KEYS` (App.jsx) are allowed in `profile.preferences`. Adding a new portable preference? Add its key to that array or it won't follow the user across devices.
- The `profiles.preferences` column is optional at runtime — `AuthProvider` falls back to a base `select('id, email, display_name, is_pro, subscription_tier')` if the column doesn't exist, so sign-in works even before the migration is applied. The push side swallows the error.
- Auth callback URL handling is split: OAuth stays on `/auth/callback` (dedicated `AuthCallback.jsx`). Magic links and recovery links land on `/` and rely on App.jsx's cleanup effect — don't add a new redirect target without wiring a matching cleanup branch.
- `RecoveryScreen.handleBack` calls `signOut()` *before* invoking the parent `onBack`. If you ever route away from it through another path, make sure that path also ends the recovery session.
- PDF export renders an **in-app overlay with a same-origin `<iframe srcdoc>`** on every platform (`openPrintWindow()` in `src/pdf/pdfDocument.js`); printing goes through `iframe.contentWindow.print()`. Do NOT reintroduce `window.open` + `document.write` — popups return `null` handles in installed PWAs and don't exist in Capacitor/Electron webviews. The iframe inherits the page origin (prefs read `localStorage['setlists-md:pdf-prefs']` directly) **and the page CSP** — the print document uses an inline `<script>`/`<style>`, so before flipping the report-only CSP in `vercel.json` to enforcing, `script-src`/`style-src` must accommodate it (hash/nonce or refactor).
- `SetlistOverview` is rendered in **two places**: (1) the dedicated `setlist-view` route in `App.jsx`, and (2) the desktop preview pane inside `Setlists.jsx`. Both wire its export callbacks (`onExportZip`, `onExportPdfOverview`, `onExportPdfFull`) — when you add or rename one, update *both* call sites or the desktop preview will silently no-op.
- **Realtime only fires for tables in the `supabase_realtime` publication.** A `postgres_changes` subscription to an unpublished table connects successfully and then receives nothing, forever — no error anywhere. `20260701_realtime_publication.sql` added `team_schedules`/`team_availability`/`team_notifications`/`team_activity`; any NEW realtime-subscribed table needs a matching `alter publication` migration (plus `replica identity full` if delete events must pass a `team_id=eq.` filter — default identity only carries the PK).
- **`team_schedules.setlist_id` (and `team_notifications` metadata `setlist_id`) is the `team_setlists` ROW UUID, not the local setlist id.** Never match it against `setlist.id` directly — bridge through `useTeamSetlistMap` (localId→remoteId from the sync manifest; takes a `refreshKey`, App passes `syncState.lastSync`). Wrong matching is invisible: lookups just miss and fall back ("a setlist", empty calendars).
- **`applyKeyHistories` is reference-preserving on purpose** — unchanged songs keep object identity. Per-song IndexedDB writes, both engines' hash caches, and `sync/adopt.js` mid-sync-edit detection all treat a new reference as "this song changed"; a map that re-mints every object reintroduces whole-library rewrites on launch.

## Team library sync (src/sync/team-engine.js)

Team libraries no longer go through the file-manifest engine
(`engine.js` + the `supabase-team.js` provider shim). They use a dedicated
**server-authoritative** engine that talks to `team_songs`/`team_setlists`
directly:

- **Pull = server wins.** Every row replaces the local copy; rows deleted on
  the server disappear locally (App adopts the result wholesale via the
  `replaced: true` flag in the sync result). Local-only never-synced items are
  inserted; previously-synced items missing remotely are dropped.
- **Canonical hashing** — songs hash the markdown text (the `content` text
  column round-trips byte-exact); setlists hash a key-sorted `stableStringify`
  because JSONB does not preserve key order. (The old engine hashed
  pretty-printed JSON on push but compact JSONB on pull, so every cycle looked
  dirty → re-upload → realtime → loop → endless "Synced" toasts.)
- **CAS updates** — pushes guard with `.eq('updated_at', lastSyncedTime)`; a
  miss means another member wrote first: their edit is kept, ours is reported
  as a conflict and the next pull adopts the server copy.
- **Identity** — the song/setlist id embedded in `content` is canonical, with
  a fallback to the previous manifest's `remoteId` mapping (legacy rows
  without embedded ids), then the row UUID. Duplicate rows for one id are
  healed (newest kept, others deleted by writers).
- Members (`readOnly`) are a pure mirror — no writes ever leave the device, and
  **pull never raises a conflict for them** (the cloud copy is always adopted
  silently). Conflict detection in `pull()` is guarded by `!readOnly`; conflicts
  are only meaningful for writers (admins/editors). `ConflictResolver` also
  offers **Keep all mine / Keep all cloud** (`onResolveAll` in App) so a
  baseline-drift mass conflict clears in one tap instead of dozens of prompts.
  (A whole-library "73 conflicts" symptom = canonical-hash baseline drift, e.g.
  a schema field now serialized locally but absent in older server `content`;
  root-cause per-song by diffing `songToMd(local)` vs the stored `content`.)
- `createEngineForLibrary()` in App.jsx picks the engine per library; the
  file-manifest engine remains for personal Drive/Dropbox/OneDrive sync.
- **Every sync pass holds a Web Lock** (`sync/lock.js`,
  `setlists-md:sync:<libraryId>`) around fullSync/runPush in BOTH engines. The
  manifests are read-modify-write in IndexedDB; without the lock a second tab
  or a temp engine (song move/copy) races the main engine and loses manifest
  writes → stale baselines → phantom "changed" storms. Keep any new sync-state
  writer inside `withSyncLock`.
- **Pull pagination is keyset on `id`** (`.order('id').gt('id', last)`), never
  offset/range — offset pages over a set other members are writing to can skip
  rows, and a skipped row is indistinguishable from a server-side deletion.
  `pageSize` is injectable for tests.
- **Pulls are DELTA pulls**: heads (`id, updated_at`) are fetched for the whole
  set, but content only for rows the manifest can't prove unchanged
  (`lastSyncedTime === updated_at`) — unchanged rows reuse the manifest hash
  and skip both download and re-parse. A hash-version migration forces one
  full content fetch to re-baseline.
- **Identity is server-side now** (`song_key`/`setlist_key`, unique per team —
  see `20260702_identity_keys.sql`): payloads carry the local id as the key on
  every write, inserts that collide adopt the existing row (race/lost-manifest
  heal), and pre-migration servers get a column-missing fallback. Never-synced
  songs are **bulk-inserted** in chunks of 50 (matched back via `song_key`),
  falling back to per-row insert+adopt on batch failure.
- **Two-device convergence suite**: `src/__tests__/team-convergence.test.js`
  runs two engines against one fake server (device-namespaced tokens mock)
  through edit/conflict/delete/create interleavings + a seeded fuzz, asserting
  both devices and the server converge with zero loss. Extend it when touching
  engine semantics. Shared fixtures: `src/__tests__/helpers/fakeSupabase.js`.
- **Sync doctor** (`components/settings/SyncDoctor.jsx`, Settings → Sync in a
  team Space) re-runs the engine's exact hash arithmetic per song
  (local vs server vs baseline) and names drifting fields — use it before
  digging into any "sync is weird" report.
- **Sync results are adopted via `sync/adopt.js`** (`reconcileAdopt` /
  `applyPulled` through App's `adoptSyncResult`): adoption runs functionally
  against CURRENT state using the sync's input snapshot as the base, so an
  edit made while the sync was in flight is never clobbered (object identity =
  the change signal). Never `setSongs(result.songs)` a sync result directly.
- Tests: `src/__tests__/team-engine.test.js` (fake Supabase client),
  `src/__tests__/sync-adopt.test.js`.

## Web Push & the notification worker

- **Pipeline**: DB triggers (`schedule_request` on roster insert,
  `schedule_decline`) write `team_notifications` rows → the `notify-worker`
  edge function (pg_cron, every minute) sends RFC 8291/8292 Web Push to each
  recipient's `push_subscriptions` and marks `pushed_at` (at-most-once; dead
  subscriptions pruned on 404/410). It also generates `schedule_maybe_nudge`
  rows server-side (one per schedule, ever).
- **Crypto** is a dependency-free WebCrypto implementation in
  `supabase/functions/notify-worker/webpush.ts`, interop-tested in
  `src/__tests__/webpush-crypto.test.js` against `http_ece` (the RFC author's
  reference lib). Don't swap it for an npm lib without keeping that test.
- **Keys**: the VAPID public key is a client constant (`src/push/vapid.js`,
  overridable via `VITE_VAPID_PUBLIC_KEY`); the private key lives ONLY in the
  service-role-only `app_config` table. Rotating the pair invalidates every
  subscription (users must re-enable push).
- **Client**: `src/push/usePushSubscription.js` (enable/disable per device),
  surfaced as a button in `NotificationTray`; SW handlers in
  `public/push-sw.js`, importScripts'd into the generated Workbox SW
  (`vite.config.js`). In the tray, server schedule rows are SUPPRESSED when a
  live interactive prompt (virtual notification) covers the same
  `schedule_id`, and when the schedule has been resolved — they exist to reach
  lock screens and carry cross-device read state, not to double-render.
- **Heartbeat**: every worker run upserts `worker_last_run`/`worker_last_result`
  into `app_config`; `get_worker_health()` (SECURITY DEFINER, authenticated
  only — whitelists the two heartbeat keys, NEVER the VAPID rows) feeds the
  `WorkerHealthRow` in Settings → Sync diagnostics, which flags >10 min of
  silence as a stalled worker (see `20260703_worker_health.sql`).

## Current Focus & Roadmap

**Planning lives in `docs/PLAN.md`** — the single **sequenced** roadmap: what to
do, in what order, and why. It separates the two streams that were previously
tangled (**A** ship-the-beta ops vs **B** build-the-product engineering), carries
the component-pass order, and collects every open decision in one table (§7).
The per-area detail is §6, explicitly *not* sequenced — read a section when you
start that component's pass. Keep this file (`CLAUDE.md`) for dev/agent memory
only: stack, architecture, schema, the finish/release workflows, and gotchas.

**Starting a fresh session?** If `docs/NEXT-SESSION.md` exists, read it first —
it's the short-lived handoff for whatever pass is in flight, and it links
everything else in the right order.

**`docs/READER.md` is the Reader's decision log** — the one viewer that replaces
the four reading surfaces, element by element, with the reason behind each
choice. Read it before touching anything under `src/features/reader/`,
`SectionBlock`, `TabBlock`, `StructureRibbon` or `AaMenu`; the decisions there
were expensive to reach and are not to be re-opened.

**`docs/COMPONENTS.md` is the definitive component map** — the app decomposed
into 25 named components, each with its owner files, state, status and debt,
plus the dependency order to work them in and a per-component definition of
done. Work proceeds **component by component** against that list. Three docs,
three jobs: `CLAUDE.md` = how it works · `PLAN.md` = what's next ·
`COMPONENTS.md` = what the pieces are.

TypeScript migration is deferred and done incrementally per touched file, not as
a phase.

