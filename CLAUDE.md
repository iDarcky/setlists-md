# Setlists.md

A PWA for worship bands: chord charts, setlists, and who plays when. Churches
install it on phones, iPads and desktops; it works offline. Live at
`setlists.md` (Vercel), data in Supabase.

This file is the agent's working memory: **rules first, then how the app is
built, then the traps.** Long reference lives in `docs/` (see "Where things
are written down") so this page stays short enough to read every session.

## Rules

- **Branches.** Work branches off `beta`, **one branch and one PR per
  feature**, PR into `beta`.
- **Never merge** a PR (into `beta` or `main`) unless the owner says "merge"
  in that moment. The owner merges, then tests on a phone. Stacked PRs: say
  the merge order.
- **Never delete** files, branches or PRs without the owner's say-so.
- **Production Supabase is read-only.** Write SQL files; the owner runs them.
- **Every PR**: screenshots (phone first; dark, and light where it matters),
  the tests and build you ran, and the Vercel preview link.
- **Screens are built from zero**, not restyled: ask what the screen should
  hold, mock it on the canvas, compare, then build with the new components.
- **Don't** hardcode the version in JSX (`__APP_VERSION__` comes from
  `package.json`), reintroduce `../` imports, or add an upgrade prompt.

## Commands

```bash
npm run dev      # dev server (localhost:5173)
npm run build    # production build to dist/
npx vitest run   # tests (~1,600, pure logic + a few render tests)
npm run lint     # ESLint (a few old warnings in App.jsx are expected)
```

## Versioning and releases

SemVer. `package.json#version` is the single source; Vite injects it as
`__APP_VERSION__`.

- **During a beta cycle** the version is `<TARGET>-beta.<N>`. `<TARGET>` (the
  next `main` release) stays fixed; `N` goes up per batch. Raise `<TARGET>`
  only if a batch is a higher level (PATCH → MINOR → MAJOR) and reset to
  `-beta.1`.
- **MAJOR** breaks stored data or the `.md` format · **MINOR** adds features ·
  **PATCH** fixes, copy, polish.
- **Changelog**: `src/data/changelog.md`, **one** `## <TARGET> — Title` entry
  per cycle with `*Month YYYY*` and `### Added / Improved / Fixed` (the shape
  `WhatsNewPanel.jsx` parses). Append to the open entry; don't add a heading
  per feature.

**"finish"** (owner says finish / ship it / wrap up): bump `-beta.<N>`, append
the changelog, `npm run build`, commit `Beta <TARGET>-beta.<N>: <title>`,
push the branch and **open a PR into `beta`** (merging only on the owner's
word).

**"release" / "promote"**: drop the suffix (`0.26.0-beta.4 → 0.26.0`),
finalise the changelog entry, `npm run build`, commit `Release <TARGET>:
<title>` onto `beta`, open the PR **`beta → main`** (`main` is protected; a PR
is the only way in), wait for green CI, merge only when the owner says so.
The repo uses **no git tags**. After a release, check that `beta` still exists
(GitHub's "Delete branch" button has removed it before).

## How the app is built

**Stack:** Vite 7 · React 19 (JSX, no TypeScript yet) · Tailwind v4 +
shadcn/ui (Radix) · lucide-react icons · `motion` for animation · idb-keyval
(IndexedDB) · vite-plugin-pwa · Supabase (auth, data, realtime, edge
functions) · Vercel.

**Layout:** grouped by feature. `src/features/<x>/` owns one surface,
`src/ui/` is the shared design system, `src/app/` is the shell. Imports use
`@/` (= `src/`); same-folder siblings stay `./x`. ESLint forbids `../` and
`@/components/*`. Shared pure logic → `src/lib/`, hooks → `src/hooks/`.
Subsystems keep their own top folders: `auth/ sync/ pdf/ push/ data/
contexts/`; for `auth` and `sync`, `src/<x>/` is the engine and
`features/<x>/` its UI.

```
src/
├── main.jsx · App.jsx        App: view routing, data, sync orchestration (big; split is COMPONENTS.md §1.1)
├── parser.js · music.js      .md parse/serialize · transpose
├── arrangements.js           v2 multi-arrangement song schema
├── storage.js                IndexedDB layer
├── app/                      shell: AppTopBar, NavPill + navItems, DesktopLayout, ChurchSheet,
│                             usePreferenceSync, useAppearance (theme + status bar)
├── ui/                       design system: shadcn/ (new), blocks/ (Bencho blocks), older primitives
├── features/
│   ├── home/                 Home (Next up, Needs you, two weeks + Schedule row, activity, + menu)
│   ├── setlists/ · schedule/ Setlists tab (Schedule list in mode "setlists"); Schedule = who plays when
│   ├── setlist/              setlist page, edit, new-setlist flow, band picker, print
│   ├── songs/ · song-edit/   Songs tab + import · song editor and the new-song form
│   ├── song/ · reader/       song page (SongHub) · THE reader (docs/READER.md)
│   ├── you/ · settings/ · team/   profile, settings, church/team pages
│   ├── auth/ · join/ · start/      signed-out screens, invite links, start a church
│   └── …                     notifications, sharing, legal, onboarding, sync UI, older screens
├── auth/ · sync/ · push/ · pdf/ · lib/ · hooks/ · data/ · styles/
└── __tests__/
supabase/migrations · supabase/functions   (see docs/SCHEMA.md)
website/                                   the marketing site (setlists.md)
```

**Navigation.** There is no router: `App.jsx` holds `view` state. The nav
pill (`app/NavPill.jsx`, items in `app/navItems.js`) is **Home · Setlists ·
Songs**: a floating pill at the bottom below 1024px, the same pill in the top
bar from 1024px. `navItemFor(view)` decides which tab is lit. **Schedule is
not a tab**: it opens only from the Schedule row on Home's two-weeks card and
lights Home. **You** is the profile photo in the top bar, not a tab. Settings,
team and church pages hang off You.

**Main views:** `home`, `setlists` (the Schedule list in
`mode="setlists"`, Upcoming / Past),
`schedule` (`SchedulePage`: invites, Next Sundays, You play, My availability
calendar, and the Band grid for leaders), `library` (Songs), `song-hub`,
`editor`, `setlist-view`, `setlist-build`, `setlist-read` (the one reading
route), `setlist-finale`.

**Words the app uses.** Setlist (the songs for one service) · service
template (a reusable starting point) · invite (a leader asking someone to
play; the code still says `ask`/`pending`) · availability (one answer per
day) · Space / group (a church or a band; there is no one-person library).

**No group open.** `activeLibrary` is a group id or `null` (signed out, or
not in a group yet: the start screens take over). `null` reads and writes
nothing on the device and syncs nothing. Personal was removed on 2026-11-19;
don't bring back a library that belongs to one person.

**Data.**
- **The server is the source of truth**; every device keeps an IndexedDB copy
  and works offline. All libraries sync through the replica engine
  (`docs/SYNC.md`).
- **Songs** use the v2 schema: identity (`id`, `title`, `artist`, `ccli`,
  `tags`, play histories) plus `arrangements[]`, each with its own key, tempo,
  time, capo, notes, structure and sections. Sync carries the whole object as
  JSON; the `.md` file (`docs/FORMAT.md`) is the interchange format and holds
  one arrangement.
- **Transpose** is applied at render time; stored chords stay in the
  original key. `section.lines[]` holds strings, tab objects and modulate
  objects.
- **Notes**: per arrangement (`arrangement.notes`), per setlist item (100-char
  cue), per moment (500-char), and private per user (`team_notes`).
- **Which mode a setlist opens in is decided by the clock**
  (`lib/openingMode.js`): live from 30 min before the service until it ends,
  practice otherwise. There is deliberately no manual way into live.
- **Plans live on the group** (`teams.plan`), never on a person. The only gate
  is `multi-service` → church; nothing that makes a chart readable is ever
  gated. Pricing lives on the website.
- **Preferences** that follow the account are only the keys in
  `PORTABLE_PREF_KEYS` (`app/usePreferenceSync.js`); hydrated once per user.

## Design system

**Warm black + Geist on shadcn/ui** (since 2026-10-25). Tokens in
`src/styles/ds.css`: shadcn names plus `link`, `selected`, `raised`, status
colours (`success/warning/danger` fill + text), radii `rounded-control` (8) /
`rounded-card` (12) / `rounded-sheet` (20). Dark: page `#121110`, card
`#171614`, raised `#22201D`, border `#2E2A26`. Light theme too; the theme
follows `settings.theme` (`default` = OS).

- Components: `src/ui/shadcn/` (button, card, dialog, drawer, sheet, field,
  input, popover, switch, toggle, bottom-actions …) and `src/ui/blocks/`
  (Bencho blocks: CreateMenu, ToastStack, Search, LabelInput …, MIT).
- **Materials** (`ds.css`, Geist-style): every surface uses one of
  `material-base/small/medium/large/modal/menu/tooltip/fullscreen` (fill +
  edge + shadow), never a hand-rolled shadow; corners stay on the component.
  **Layers**: every z-index is `z-sticky` 10 · `z-chrome` 100 ·
  `z-fullscreen` 200 · `z-modal` 300 · `z-menu` 400 · `z-tooltip` 500 ·
  `z-toast` 600. Preview everything with `?design`.
- **Five text sizes** `text-title` 24 / `text-heading` 18 / `text-body` 16 /
  `text-small` 14 / `text-caption` 12, plus `text-label` (12px semibold
  UPPERCASE). Weights 400/500/600 only. Icons are lucide at stroke 1.8. Motion is tasteful, not much.
- Phones: sheets from the bottom and Save/Cancel at the bottom
  (`BottomActions`). iPad/desktop: centred dialogs, the top-bar nav.
- `--chord` (gold) is only for chords.
- Screens not yet rebuilt still use the older Geist `--ds-*` tokens in
  `styles/index.css`. Don't extend that system; rebuild the screen instead.

## Conventions

- Tailwind classes on the new components (shadcn + tokens); no CSS modules or
  styled-components. Older screens still use inline styles.
- Auth error copy goes through `friendlyAuthError(err)` (checks
  `navigator.onLine` first); add new cases there. The last-used email lives in
  `localStorage['setlists-md:last-email']`, written only on success.
- Tab and modulate objects in `section.lines[]` are found with
  `typeof line === 'object' && line.type === 'tab' | 'modulate'`; check the
  type before calling `.trim()`.
- Never call `toLocaleDateString` / `localeCompare` with options per row in a
  long list; use the cached formatters in `lib/dateFormat.js`.
- Team-scoped fetch hooks on tab screens seed from `hooks/teamRowsCache.js`,
  and nav-pill tabs are not lazy-loaded (tab switches must be instant).

## Where things are written down

| Doc | What it holds |
| --- | --- |
| `docs/NEXT-SESSION.md` | If it exists, read it first: the handoff for the pass in flight |
| `docs/COMPONENTS.md` | The component map: each piece's files, state, status, debt |
| `docs/READER.md` | The reader's decision log. Read before touching `features/reader/`, `SectionBlock`, `TabBlock`, `StructureRibbon`, `AaMenu` |
| `docs/SYNC.md` | Replica sync engine, backup mirror, Web Push worker |
| `docs/SYNC-REDESIGN.md` | Why sync works the way it does |
| `docs/SCHEMA.md` | Supabase tables, RLS, every migration, entitlements, billing |
| `docs/FORMAT.md` | The `.md` song format, modulate markers, tab blocks |
| `docs/PLAN.md` | What's next (may lag behind the owner's to-do doc) |
| `docs/archive/CLAUDE-2026-11-15.md` | This file before the 2026-11-15 rewrite |

## Known gotchas

- `section.lines[]` can contain **strings** (normal lines), **tab objects**, OR **modulate objects** — always type-check before calling string methods
- `chordTranspose` must be computed **before** any `useMemo` that references it (temporal dead zone)
- svguitar renders imperatively into a DOM ref — use `useRef` + `useEffect`, copy ref to local var in cleanup
- **Chart display** lives in one `AaMenu.jsx` popover (Page / Lyrics / Chords tabs), writing the `settings` chart keys plus per-element colour (`chartLyricColor`/`chartChordColor`; falsy = follow theme). Columns are 1 or 2 only. Read `docs/READER.md` before changing it.
- **CSP + embeds** (`vercel.json`, enforcing — not applied by `npm run dev`): the Spotify/YouTube backing-track embeds need `*.spotifycdn.com` in `script-src`/`connect-src` (the iframe-api pulls its real code from `embed-cdn.spotifycdn.com`). **Spotify playback was dropped** because its embed API runs via `eval()` (would need `'unsafe-eval'`, a whole-app downgrade) and only streams full tracks to signed-in Spotify users; `SongPlayerBar` is YouTube-only. Spotify links still drive **cover art** (`lib/coverArt.js` → the `cover-art` edge function, server-side oEmbed — no eval, no CSP issue). `lib/embedPlayers.js` loads the IFrame APIs once and clears its memo on failure so a blocked first load can retry; `SongPlayerBar` has a readiness **watchdog** that re-creates a stalled player (auto-recovers the dropped first-init).
- Preference hydration runs **once per user id** via `prefsHydratedForUserRef` — don't re-run it on every profile change or you'll clobber a later local edit with the cloud value. The ref is cleared on sign-out.
- Only keys in `PORTABLE_PREF_KEYS` (`src/app/usePreferenceSync.js`) are allowed in `profile.preferences`. Adding a new portable preference? Add its key to that array or it won't follow the user across devices.
- The `profiles.preferences` column is optional at runtime — `AuthProvider` falls back to a base `select('id, email, display_name, subscription_tier')` if the column doesn't exist, so sign-in works even before the migration is applied. The push side swallows the error.
- Auth callback URL handling is split: OAuth stays on `/auth/callback` (dedicated `AuthCallback.jsx`). Magic links and recovery links land on `/` and rely on App.jsx's cleanup effect — don't add a new redirect target without wiring a matching cleanup branch.
- `RecoveryScreen.handleBack` calls `signOut()` *before* invoking the parent `onBack`. If you ever route away from it through another path, make sure that path also ends the recovery session.
- PDF export renders an **in-app overlay with a same-origin `<iframe srcdoc>`** on every platform (`openPrintWindow()` in `src/pdf/pdfDocument.js`); printing goes through `iframe.contentWindow.print()`. Do NOT reintroduce `window.open` + `document.write` — popups return `null` handles in installed PWAs and don't exist in Capacitor/Electron webviews. The iframe inherits the page origin (prefs read `localStorage['setlists-md:pdf-prefs']` directly) **and the page CSP** — the print document uses an inline `<script>`/`<style>`, so before flipping the report-only CSP in `vercel.json` to enforcing, `script-src`/`style-src` must accommodate it (hash/nonce or refactor).
- **The reader's live state is a FOLD, not a chip, and the ✕ is phone-conditional.**
  `LiveFold` paints into the chrome's top-right corner OUTSIDE the layout, so the
  song title is the same width live and off-live. On a phone (`!wide`) live drops
  the ✕ entirely and a pull-down exits; on tablet/desktop the ✕ stays, because
  the pull is touch-only and removing both left the hub's full screen with no way
  out at all. The condition is `onModeChange` exists — "someone else can let me
  out" — never "am I live".
- **Firefox draws two focus artifacts that Chromium does not.**
  `:-moz-focusring { outline: auto }` follows `border-radius` and lands *on* a
  small round control (move it with `outline-offset`), and `::-moz-focus-inner`
  paints a dotted border *inside* the button — reset app-wide in
  `styles/index.css`, because Tailwind v4's preflight dropped modern-normalize's
  rule. Test small round controls in Firefox.
- **`flex-1` on the cross axis of a scroller.** A flex ITEM with no `flex-1` is
  shrink-to-fit: the reader's chart row had none, so on a 1280px screen the
  chart laid out 840px wide with 400px of dead window beside it. The vertical
  twin (`flex-1 min-h-0` capping a wrapper *inside* a scroller) is the opposite
  mistake — see `docs/READER.md`'s trap list for both.
- **Paint order is hit-test order.** Putting an overlay *under* content to keep
  that content readable also puts it under for pointer events — including the
  content's padding, which is empty space. It makes the overlay silently
  untappable. Separate them by geometry instead.
- **Realtime only fires for tables in the `supabase_realtime` publication.** A `postgres_changes` subscription to an unpublished table connects successfully and then receives nothing, forever — no error anywhere. `20260701_realtime_publication.sql` added `team_schedules`/`team_availability`/`team_notifications`/`team_activity`; any NEW realtime-subscribed table needs a matching `alter publication` migration (plus `replica identity full` if delete events must pass a `team_id=eq.` filter — default identity only carries the PK).
- **`team_schedules.setlist_id` (and `team_notifications` metadata `setlist_id`) is the `team_setlists` ROW UUID, not the local setlist id.** Never match it against `setlist.id` directly — bridge through `useTeamSetlistMap` (localId→row UUID from the replica state, `replica.rows.setlist[key].rowId`; takes a `refreshKey`, App passes `syncState.lastSync`). Wrong matching is invisible: lookups just miss and fall back ("a setlist", empty calendars).
- **`applyKeyHistories` / `applyTempoHistories` are reference-preserving on purpose** — unchanged songs keep object identity, and App chains both on load, so an untouched song survives two passes untouched. Per-song IndexedDB writes, the replica's dirty detection, the file engine's hash cache, and `sync/adopt.js` mid-sync-edit detection all treat a new reference as "this song changed"; a map that re-mints every object reintroduces whole-library rewrites on launch.
- **A play history is a `{ value: count }` map on the SONG, never in the `.md`.** `keyHistory` and `tempoHistory` are both `performanceHistory.js` with a different `valueOf` — the walk over past-dated setlists, the reference-preserving apply and the save-time diff live there once. Neither is serialized: they are device-derived counts, recomputed from setlists on load and merged by taking the larger count (`sync/merge.js` → `mergePlayCounts`), so they never conflict. **A third dimension (time signature, capo) is a `valueOf` function, not another copy of the file.**
- **`item.tempo` is the per-setlist override and the only per-performance tempo record.** Resolved performance tempo = `item.tempo ?? arrangement.tempo`. The cards row (`SetlistCardRow`) writes it; the legacy `SetlistItemRow` writes straight back to the SONG instead — which is exactly why a tempo history was impossible for so long, and it is unreachable today only because `SetlistBuilder` defaults `cards = true`. Restore that row and you re-break the history.
