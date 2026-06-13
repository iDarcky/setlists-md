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

5. **Commit + push.** Subject `Beta <TARGET>-beta.<N>: <short title>`,
   bullets as the body. Push to the active branch with
   `git push -u origin <branch>`. (The user then merges it into `beta`.)

Do **not** tag on feature/`beta` branches.

## "release" / "promote" workflow (beta → main)

When the user says **"release"**, **"promote"**, **"ship to main"** (or
"finish and push to main"), turn the accumulated beta cycle into a real
release. Run, in order:

1. **Drop the pre-release suffix.** `package.json#version`:
   `<TARGET>-beta.<N> → <TARGET>` (e.g. `0.13.0-beta.7 → 0.13.0`).
2. **Finalise the changelog.** The newest `## <TARGET>` block becomes the
   release entry — confirm the title + `*Month YYYY*` are right.
3. **Verify** with `npm run build`.
4. **Commit.** Subject `Release <TARGET>: <short title>`.
5. **Promote + tag.** Merge `beta` → `main`, and tag the release on
   `main`: `git tag -a v<TARGET> -m "Release <TARGET>"` then push the
   tag. Tags are cut from `main` at release — never from feature/`beta`
   branches.

## Project Structure

```
src/
├── main.jsx              # Entry point
├── App.jsx               # Root component, view routing, data management,
│                         #   preference cloud-sync, auth-URL cleanup
├── music.js              # Transpose engine (transposeChord, transposeKey, sectionStyle)
├── parser.js             # .md song format parser/serializer
│                         #   exports: parseSongMd, songToMd, parseLine, generateId,
│                         #            parseTabBlock, serializeTabBlock, parseTabPositions
├── storage.js            # IndexedDB layer (loadSongs, saveSongs, loadSetlists, saveSetlists, clearAll)
├── styles/index.css      # Global styles, CSS variables, fonts
├── auth/
│   ├── supabase.js       # Supabase client (null when env vars missing)
│   ├── AuthContext.js    # React context for the auth value bag
│   ├── useAuth.js        # Hook: { user, profile, signIn*, signUp*, resetPassword,
│   │                     #         updatePassword, resendVerification, updateProfile, signOut }
│   └── AuthProvider.jsx  # Session bootstrap, profile fetch w/ preferences fallback
├── data/
│   ├── demos.js          # 3 demo songs loaded on first run
│   └── chordShapes.js    # ~50 worship chord fingering shapes for svguitar
└── components/
    ├── SectionBlock.jsx      # Renders a single section block (chords above lyrics, tab blocks)
    ├── TabBlock.jsx          # SVG guitar tab renderer (fret numbers, string lines, bar lines, techniques)
    ├── ChordDiagram.jsx      # svguitar wrapper — renders chord fingering diagrams
    ├── StructureRibbon.jsx   # Section flow bar + MetaPill component
    ├── ChartView.jsx         # Full chord chart view (transpose, 1/2-col layout, size, chord diagrams toggle)
    ├── Editor.jsx            # 3-tab editor shell (Form/Visual/Raw) with split-screen preview
    ├── Library.jsx           # Song library with search + setlists tab
    ├── SetlistBuilder.jsx    # Build setlists: pick songs, reorder, per-song transpose & notes
    ├── SetlistPlayer.jsx     # Live mode: progress bar, song strip, prev/next navigation
    ├── SetlistOverview.jsx   # Read-only setlist overview with song list and duration
    ├── PerformanceView.jsx   # Fullscreen live view (sidebar hidden on desktop/tablet)
    ├── Account.jsx           # Account page — edits display name (local + profile), sign-in/out
    ├── Welcome.jsx           # Onboarding welcome with optional "Already have an account?" link
    ├── auth/
    │   ├── AuthScreen.jsx    # Sign-in/up form (magic link + password), loading states,
    │   │                     #   password reveal, last-email prefill, friendly errors
    │   ├── AuthCallback.jsx  # Handles OAuth /auth/callback (PKCE exchange)
    │   └── RecoveryScreen.jsx# Set-new-password screen for type=recovery links
    ├── account/
    │   └── AccountPanel.jsx  # Shared account bits: StageGreeting, PlanLabel, SignInButton,
    │                         #   CreateAccountButton, StatCards
    ├── editor/
    │   ├── FormTab.jsx       # Structured form editor: metadata fields + section blocks
    │   ├── VisualTab.jsx     # Toolbar + textarea: chord picker, section inserter, tab grid editor
    │   ├── RawTab.jsx        # Plain textarea with collapsible syntax reference
    │   ├── PreviewPanel.jsx  # Live preview of parsed song (used in split-screen)
    │   ├── ChordPicker.jsx   # Popup: root (A-G), accidental (#/b), suffix, slash chord
    │   └── TabGridEditor.jsx # Interactive tab grid: duration picker, auto-advance, technique buttons
    └── ui/
        ├── Button.jsx        # Standard Geist buttons implementation
        ├── Card.jsx          # Geist 16px radius cards
        ├── Tabs.jsx          # Underline style tabs
        └── ...               # Avatar, Badge, Input, SegmentedControl, etc.

supabase/
└── migrations/           # SQL applied manually (or via supabase db push).
                          # See "Supabase Schema" below.
```

## Architecture

- **No router** — App.jsx manages views via `view` state (`library`, `chart`, `editor`, `setlist-build`, `setlist-play`, `setlist-performance`, `signin`, `recovery`, `auth-callback`, …)
- **No server for song data** — songs/setlists stored client-side in IndexedDB via idb-keyval. Supabase only handles auth + account-level preferences.
- **Songs** are stored as parsed objects on a **v2 multi-arrangement schema** (`src/arrangements.js`): top-level identity (`id`, `title`, `artist`, `ccli`, `tags`, `keyHistory`, `defaultArrangementId`) plus an `arrangements[]` array. Each arrangement carries its own `key`, `tempo`, `time`, `capo`, `notes`, `structure[]`, and `sections[]`. The `.md` format flattens to a single arrangement; multi-arrangement state is app-internal.
- **Notes live at three levels** — per-arrangement `arrangement.notes` (markdown, shared across setlists), per-setlist-item `items[i].note` (100-char cue), and per-break `items[i].note` (500-char markdown). There is **no per-setlist or per-user note scope yet** (planned).
- **The .md format** is the interchange format — YAML frontmatter + `## Section` headers + `[Chord]lyrics` inline chords + `> notes` for band cues + `{tab}...{/tab}` for guitar tabs
- **Section types** each have a color scheme defined in `music.js` (Intro, Verse, Chorus, Bridge, etc.)
- **Transpose** is applied at render time via `transposeChord()` — stored data is always in the original key
- **Tab blocks** are parsed into structured objects `{ type: 'tab', strings, time, raw }` — `raw` preserves original ASCII for round-trip fidelity
- **Modulate markers** are parsed into `{ type: 'modulate', semitones: N }` objects in `section.lines[]` — cumulative offsets computed per section in ChartView, applied mid-section in SectionBlock with visual key-change badges
- **Tab editing** — VisualTab detects cursor inside `{tab}...{/tab}` to open TabGridEditor pre-loaded; FormTab shows "Edit Tab" buttons per tab block; saves replace in-place
- **Editor** — `md` state lives in Editor.jsx shell; all tabs receive `md` + `onChange`; switching tabs preserves content
- **Split-screen preview** — `useSyncExternalStore` with `window.matchMedia('(min-width: 768px)')` — side-by-side on wide, toggle on narrow

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
  tapping empty days) and by `RosterPanel` (leader sorts/filters candidates
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
- Preference hydration runs **once per user id** via `prefsHydratedForUserRef` — don't re-run it on every profile change or you'll clobber a later local edit with the cloud value. The ref is cleared on sign-out.
- Only keys in `PORTABLE_PREF_KEYS` (App.jsx) are allowed in `profile.preferences`. Adding a new portable preference? Add its key to that array or it won't follow the user across devices.
- The `profiles.preferences` column is optional at runtime — `AuthProvider` falls back to a base `select('id, email, display_name, is_pro, subscription_tier')` if the column doesn't exist, so sign-in works even before the migration is applied. The push side swallows the error.
- Auth callback URL handling is split: OAuth stays on `/auth/callback` (dedicated `AuthCallback.jsx`). Magic links and recovery links land on `/` and rely on App.jsx's cleanup effect — don't add a new redirect target without wiring a matching cleanup branch.
- `RecoveryScreen.handleBack` calls `signOut()` *before* invoking the parent `onBack`. If you ever route away from it through another path, make sure that path also ends the recovery session.
- PDF export renders an **in-app overlay with a same-origin `<iframe srcdoc>`** on every platform (`openPrintWindow()` in `src/pdf/pdfDocument.js`); printing goes through `iframe.contentWindow.print()`. Do NOT reintroduce `window.open` + `document.write` — popups return `null` handles in installed PWAs and don't exist in Capacitor/Electron webviews. The iframe inherits the page origin (prefs read `localStorage['setlists-md:pdf-prefs']` directly) **and the page CSP** — the print document uses an inline `<script>`/`<style>`, so before flipping the report-only CSP in `vercel.json` to enforcing, `script-src`/`style-src` must accommodate it (hash/nonce or refactor).
- `SetlistOverview` is rendered in **two places**: (1) the dedicated `setlist-view` route in `App.jsx`, and (2) the desktop preview pane inside `Setlists.jsx`. Both wire its export callbacks (`onExportZip`, `onExportPdfOverview`, `onExportPdfFull`) — when you add or rename one, update *both* call sites or the desktop preview will silently no-op.

## Known Correctness Issues (verify before promoting the Church/Team tier)

These are real defects found during a roadmap audit. They are not yet fixed —
treat them as the first work item if the paid tier is ever demoed.

- ~~**Entitlement gate falls back to free for teams**~~ — *Fixed.*
  `useEntitlement` reads `team.plan` (and now also `team.subscription_status`);
  the stray `team.billing_plan` read in `Settings.jsx` was switched to
  `team.plan`. Separately, `TeamProvider` was reading the dropped
  `profile.plan` for `hasTeamPlan`/`createTeam` (always undefined → team
  creation hit the `plan in ('team','church')` check constraint); it now reads
  `profile.subscription_tier` and stamps a valid tier on create.
- ~~**Members can edit songs in read-only team libraries**~~ — *Fixed (June
  2026).* `guardTeamReadOnly()` in App.jsx gates `navigate('editor', …)` (the
  funnel for every editor entry point), the smart-import/multi-import flows
  (which add songs before navigating), and `handleSaveSong` (defense in depth
  if the role changes mid-edit). Members get a "Read-only library" toast.
- ~~**Preference cloud-sync push misses ~11 keys**~~ — *Stale / already fixed.*
  The push effect depends on `portablePrefsSnapshot` (a JSON string of ALL
  `PORTABLE_PREF_KEYS`), so every portable key triggers the debounced push.
- ~~**Team sync has no optimistic locking**~~ — *Fixed (June 2026).* Team
  libraries now sync through `src/sync/team-engine.js` (see below), whose
  updates are compare-and-swap-guarded on `updated_at`.

### Team library sync (src/sync/team-engine.js)

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
- Members (`readOnly`) are a pure mirror — no writes ever leave the device.
- `createEngineForLibrary()` in App.jsx picks the engine per library; the
  file-manifest engine remains for personal Drive/Dropbox/OneDrive sync.
- Tests: `src/__tests__/team-engine.test.js` (fake Supabase client).

## Current Focus & Roadmap

Active direction (solo, occasional cadence): **App Shell redesign, shipped as
independently-mergeable slices** — never a long-lived big-bang branch. Order:
(1) settings-modal backdrop-close + scroll-lock and top-bar/iPad-scroll fixes,
(2) Dashboard + Schedule redesign, (3) chart/performance display options
(Lyrics-only / Chords-only / Song-map, Nashville + Do-Re-Mi notation, condensed
sections), (4) setlist + notes rework, (5) Church/Team hardening (the bugs
above). TypeScript migration is deferred and done incrementally per touched
file, not as a phase. `docs/ROADMAP.md` holds the longer-horizon list.

