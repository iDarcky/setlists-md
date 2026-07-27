# Setlists.md — Plan (single source of truth)

> **The one place for launch + polish + roadmap.** Replaces the old
> `docs/ROADMAP.md` and `docs/BACKLOG.md`. `CLAUDE.md` stays the dev/agent memory
> (stack, architecture, schema, finish/release workflows, gotchas) — it points
> here for planning.
>
> **See also `docs/COMPONENTS.md`** — the definitive component map (25 components,
> owner files, status, debt, dependency order, per-component definition of done).
> This file says *what's next*; that one says *what the pieces are*. Work now
> proceeds component by component against it. Its §4 lists the production-grade
> gaps found in the 2026-07-27 audit that aren't already tracked here.
>
> _Last updated: 2026-07-27 · Current version: `0.17.0-beta.2` (on `beta`)._
>
> **Priority:** `P-1` above everything (currently: the New Song flow) · `P0`
> drop-everything · `P1` high · `P2` medium · `P3` nice-to-have.
> `Q:` = open decision needed.

---

## 1. Launch plan — Public Beta, October 1

**Verdict (2026-06-24): on track, slightly ahead on engineering.** All hard
blockers are cleared; the critical path is now the **August infra/ops bucket**
(domain, email, OAuth) and the **September soft-launch**, not features.

| Month | Theme | Status |
| :--- | :--- | :--- |
| June | Pipeline (CI, branch protection) + legal + security + bug fixes | ✅ shipped (0.11.0) |
| June | App-shell redesign + private notes + dashboard + sync reliability | ✅ shipped (0.12.0) |
| June | Search, filters, customizable tables, mobile list views | ✅ shipped (0.14.0-beta) |
| July | Remaining blockers (unsaved guard ✅, iPad PDF ✅) + import polish + polish | mostly done |
| August | Custom domain + Resend email + Google/Apple login + cookie notice + leaked-password toggle | **planned — not started (critical path)** |
| September | Polish + private soft-launch to 5–10 worship teams | planned |
| **October 1** | **Public beta** | planned |

### ✅ Hard blockers — done
GDPR delete-account, account-termination guardrails, member read-only gating,
in-app legal pages (Privacy/Terms/Copyright), security pass + headers, pricing
model, CI + branch protection on `main`, avatar limits, settings-dialog polish,
unsaved-changes editor guard, iPad PWA PDF export (inline-iframe), native
`confirm()/alert()` replaced, display modes (Chords/Lyrics/Song-map + Nashville),
team optimistic locking, scheduling & notifications pillar.

### 🔴 Critical path to Oct 1 (mostly external/ops — start in August)
- [ ] **Custom domain split** — `setlists.md` → `app.setlists.md`.
- [ ] **Resend transactional email** (auth/confirmation/reset).
- [ ] **Google / Apple OAuth** — re-enable in `AuthProvider` once domain/email land.
- [ ] **Cookie / storage transparency notice** — marketing-site footer (waits on domain split).
- [ ] **Leaked-password protection** — Supabase Auth toggle.
- [ ] **Private soft-launch** to 5–10 teams (September validation gate).

### 🟡 Should-ship before beta (won't hard-block)
- [ ] **Pricing page redesign** (`PricingScreen.jsx`) to the new app-shell aesthetic.
- [ ] **Team page redesign** (`TeamScreen.jsx`) — create/manage + tier picker, Band/Church naming.
- [ ] **ChordPro / OnSong import** — `smartImport()` already does ChordPro/OpenSong/UG/text;
      _remaining:_ a dedicated `.onsong` parser + per-file success/failure reporting.
- [ ] **Public-domain starter pack** (~20 PD hymns) for first-run.
- [ ] **Setlist QR/URL share** — share route + Play Live shipped; QR/short-link polish remains (paid-tier feature).

### Production pipeline gaps
- [x] CI (`lint + test + build`), [x] branch protection on `main`.
- [ ] PR + issue templates (`.github/`).
- [ ] Staging env (free Vercel preview on `beta` for now; dedicated Supabase project deferred — budget).
- [ ] Error monitoring — Sentry wired + dormant (`VITE_SENTRY_DSN`); enable if budget allows.
- [ ] Release tags — tag each release on `main` (`git tag v0.x.0`).

---

## 2. Known issues, correctness & ops

- 🔴 **Repeating "Synced" toast = the library is re-uploading every cycle** (reported
  2026-07-26). The toast itself is now silenced for automatic syncs (realtime echo,
  tab focus, reconnect) and only reports on a user-initiated "Sync now" — but that is
  a **symptom fix**. If `uploaded > 0` on back-to-back syncs with no edits, something
  is re-dirtying the library each pass: the canonical hash of a song/setlist keeps
  differing from the manifest baseline. Root-cause with **SyncDoctor** (Settings →
  Sync inside the Space) — it re-runs the engine's hash arithmetic per item and names
  the drifting field — then diff `songToMd(local)` against the stored server `content`
  for one offending song. Suspects: a field serialized locally but absent from older
  server content, a client-side normalisation applied *after* adopt, or a lost
  manifest write. Note the engine's `createAmplificationGuard` already blocks an item
  pushed too often in a short window, so a loop that never trips it is running below
  that threshold — P1.

- ✅ **Supabase migrations — all applied (verified 2026-06-24 against the live DB,
  project `biltbdumdwugpepaawku`).** `team_activity_skip_noop`, `team_scale_indexes`,
  `team_notifications`, `team_notes` are all in the migration history (applied
  2026-06-19); `team_notifications`/`team_notes` tables exist. The earlier
  "not applied / MCP rejects every call" warning was **stale** — the MCP works and
  nothing is pending. (All recent migrations are idempotent — safe to re-run if ever in doubt.)
- **Church/Team tier** — the audited correctness issues (entitlement gate reading
  `team.plan` + `subscription_status`, member read-only gating, optimistic-lock
  conflict surfacing, realtime echo suppression, owned-workspace cap) are all
  **fixed**. Still wants a real demo-pass before the paid tier is sold.
- **Input sanitization audit** (P1) — done, no critical findings. Queued follow-ups:
  enforce CSP (PDF inline-script already removed → CSP is enforcing), bump share-token
  entropy ✅, input maxLengths ✅, validate PDF-prefs/ZIP manifest ✅.
- **Scale readiness** (P1) — assessed. Shipped: `team_id` indexes, `React.memo(SongCard)`
  + `useDeferredValue`, `.limit()`/date-filter on team hooks, realtime echo guard,
  per-song IndexedDB persistence, incremental sync hashing. **2026-07-02:** delta
  pulls (content fetched only for changed rows), bulk insert for first upload
  (updates stay per-row CAS), server-side identity keys (`song_key`/`setlist_key`,
  replaces unique titles), Sentry actually loadable (set `VITE_SENTRY_DSN` in
  Vercel to turn it on), two-device convergence test suite, Sync doctor panel.
  Deferred (deliberately): `team_activity` retention job.
- **OAuth URL cleanup synchronous** — deferred; needs the live OAuth/magic-link flow
  tested before touching (stripping the hash before Supabase consumes it can break sign-in).
- **PDF/CSP enforcing** — shipped; **needs live print verification** on deploy (PWA + installed app).
- 🔴 **Dashboard global search returns nothing (desktop/tablet)** — searching a song's
  details (e.g. the song's title/name) in the home top-bar / ⌘K search yields no
  results, while the same query works elsewhere. Likely a wiring gap between the
  dashboard search input and `src/lib/search.js`. P1 bug — repro + fix.
- ✅ **Team sync "mass conflict" (73-at-once) — root-caused & fixed (2026-07-02).**
  Serialization drift was ruled out empirically: 11 real `team_songs` rows pulled
  from the live DB (old/new frontmatter, tags, capo, notes, cues, `/: :/` repeats,
  `{modulate}`, `{tabref}`, duplicate-id rows) all round-trip
  `canonicalSongHash(content) === canonicalSongHash(songToMd(songFromFlat(parse(content))))`
  under HASH_VERSION 2 — fresh baselines are stable. The remaining storm
  generators were **lost manifest writes** (sync state is read-modify-write in
  IndexedDB; a second tab, or the move/copy temp engine, racing the main engine
  silently overwrote baselines → stale hashes → phantom "changed" across many
  rows) plus two adjacent data-loss vectors. Fixed by: a **Web Locks mutex**
  around every sync pass (`sync/lock.js`, both engines — cross-tab and
  cross-instance), **keyset pagination by id** in team `fetchRows` (offset pages
  over a concurrently-written set could skip rows → phantom server-deletions),
  **reconciled sync adoption** (`sync/adopt.js` — a finished sync no longer
  clobbers edits made while it was in flight), and a reference-preserving
  `applyKeyHistories` (it re-minted every song object on every launch, breaking
  the object-identity change signal storage + engines rely on).
- ✅ **Setlist ↔ song reference integrity — shipped (2026-07-17).** Setlist items
  reference a song by a snapshotted `songId`; re-importing a song mints a new id
  and orphans every past setlist that pointed at the old one (a live main-church
  audit found **106/160 items orphaned**: 50 re-linkable by title, 14 song-missing,
  42 with no title snapshot). Fixes: (1) `src/setlist/setlistLinks.js` —
  reference-preserving `healSetlistLinks` (re-link orphans whose stored `songTitle`
  matches a current song + backfill missing titles) run on load next to
  `applyKeyHistories`, plus `analyzeSetlistLinks`; (2) **stable identity on
  import** — `handleSmartImport` adopts an existing same-title song's id so a
  re-import UPDATES in place instead of orphaning; (3) **Settings → Sync →
  "Setlist links"** diagnostic (`SetlistLinkDoctor.jsx`) showing linked /
  re-linkable / missing / untitled with a manual Repair. Tests:
  `src/__tests__/setlistLinks.test.js`. **Follow-ups:** consider fuzzy title
  matching for **renamed** songs (e.g. item "Apă vie (Living Water)" vs song
  "Apă vie" — currently reads as missing); surface the diagnostic for the
  **personal** library as well; a one-time `songTitle` backfill covers old items
  but the 42 title-less orphans (oldest sets, Mar–May) are unrecoverable from data.
  Note: the earlier "87 duplicate songs" scare was a **cross-team query artifact**
  (un-scoped `team_songs`) — within each team, identity is `UNIQUE (team_id,
  song_key)` and there are ~0 within-team duplicates; the app's cross-team model is
  correct.
- ✅ **Sync hardening batch (2026-07-18).** Follow-ups from the setlist-link work:
  (1) **heal-after-pull** — `healSetlistLinks` now also runs on any `songs`-set
  change (a mid-session server pull can re-orphan links that were fine at load),
  not just at initial load; (2) **batch-import identity adoption** —
  `handleImportParsedSongs` adopts existing same-title ids too, matching the paste
  path; (3) **activity feed no longer cries "edited" on canonical no-ops** — new
  `content_hash` column (`20260718_activity_content_hash.sql`) carrying the
  engine's canonical hash; the `log_team_activity` trigger skips when it's
  unchanged, falling back to the byte comparison when NULL. Client stamps it on
  every `team_songs`/`team_setlists` write (`team-engine.js`) behind the existing
  column-missing-safe strip fallback, so it's safe in any deploy/migration order.
  **Verified non-issue:** `song_key` already equals the embedded `songId` in all
  three teams (0 mismatches) — identity is single-sourced; no change needed.
  Server-authoritative delete is already durable for the normal flow (tombstones +
  pull-drop); only raw out-of-band SQL deletes risk a re-push, so bulk cleanup must
  run client-side.
- ⏭️ **Field-level (3-way) merge — core ready, engine wiring deferred (P2).**
  `src/sync/merge.js` (`threeWayMergeSong`/`threeWayMergeSetlist`, 11 tests):
  metadata fields merge independently against the last-synced baseline, so a
  Yes/Yes conflict where the two sides touched *disjoint* fields (one fixed tempo,
  the other added a tag) auto-resolves; the chart (`arrangements`) and setlist
  `items` are single units (both-edited → real conflict), `keyHistory` unions play
  counts. **Not yet wired into the engine** — that needs per-field baseline hashes
  in the manifest + a `HASH_VERSION` bump to re-baseline + auto-resolve at both
  conflict points (pull Yes/Yes and push CAS-miss), which must be validated by the
  two-device convergence suite before touching production sync. Do it as its own
  focused PR; the pure merge core is done and tested so that PR is wiring + tests.
- ✅ **Cloud song version history — CAPTURE shipped, restore UI next (P2).**
  Version history was per-device IndexedDB; now that import *updates in place*, a
  bad re-import was only recoverable on the device that made it. Shipped
  (`20260718_song_version_history.sql`, applied live): an append-only
  `team_song_versions` table + a SECURITY DEFINER `snapshot_team_song` trigger
  that captures every `team_songs` content change (any writer), capped at 30
  snapshots per song, wrapped so a capture failure can NEVER block/roll back the
  song write. RLS: team members read their team's history. **No engine change.**
  **Remaining (its own PR):** the RESTORE UI — surface cloud versions alongside
  the local ones in the Song Hub / editor version panel (read
  `team_song_versions` for the team library; a "restore" writes the chosen
  snapshot back through the normal save path). Until then, history is being
  preserved and an emergency restore can be done from the DB.

---

## 2b. Production-readiness roadmap (assessed 2026-07-03)

Gap analysis vs. Notion/Obsidian-grade products. ✅ = shipped that day.

**Tier 1 — engineering foundation**
- ✅ CI runs on every branch push + PRs to main/beta (was main-only — the
  release train never saw tests until the last merge), with superseded-run
  cancellation.
- 🔴 **Staging environment (P1, needs an account decision):** there is ONE
  Supabase project and it is production — migrations are applied directly to
  live church data. Create a second project (or use Supabase branching) that
  `beta` deploys against; prod migration becomes a promotion step. Blocked on
  the free-tier 2-project cap / paid plan choice (**needs Supabase Pro $25/mo —
  see `docs/COSTS.md`**). Until then beta + prod share ONE database, so "test on
  beta" = "test on live data" — safe only while migrations stay additive +
  backward-compatible.
- **Backups + restore drill (P1):** verify what the current Supabase plan
  retains, do one actual restore. ✅ Client half shipped: one-click
  whole-library backup .zip (Settings → Data) — every song/arrangement as .md,
  setlists as .json + manifest; the safety net for personal (IndexedDB-only)
  libraries.
- ✅ Watch-the-watcher: notify-worker writes a heartbeat every run
  (`app_config.worker_last_run`), exposed via `get_worker_health()` (never the
  VAPID keys) and shown with a stale flag (>10 min) in Settings → Sync
  diagnostics.
- Sentry: wired and bundled — still needs `VITE_SENTRY_DSN` set in Vercel, and
  leaked-password protection toggled in the Supabase dashboard.

**Tier 2 — perceived quality**
- ✅ Bundle: JSZip lazy-loaded (−97 KB), react/supabase in cache-stable vendor
  chunks (main chunk 980→710 KB, 202 KB gzip; returning users no longer
  re-download vendors on every release). Next: split `tabInstruments` (188 KB),
  virtualize the song list past ~500 songs, Lighthouse budget in CI.
- Accessibility pass (focus management, aria on icon buttons, stage-theme
  contrast) — P2.
- i18n: extract UI strings now, translate later (Romanian first — it's the
  actual user base) — P2.

**Tier 3 — category features**
- **CCLI / SongSelect** (P1 for the church market): played-song reporting
  (keyHistory + past setlists already hold the data) + SongSelect import.
  Licensing compliance is a purchasing requirement, not a feature.
- Capacitor wrapper for App Store presence + real APNs push on iOS (web push
  only reaches installed-PWA users on iOS 16.4+).
- Privacy-friendly product analytics (Plausible / self-hosted PostHog) before
  making big roadmap bets — needs an account/hosting decision.

---

## 3. Polish backlog (by area)

Open, actionable items. Cross-cutting concerns at the end.

### Song details
- Rich editor for **Story-behind** (breaks-style, like the setlist editor); maybe Notes too — P2 · _Q: both or just Story-behind?_
- **Dedicated full song-details view** (open-in-full button) — P2 · _Q: route vs expanded panel?_
- Field char limits (Themes/Genres/Verses/Moment/Tags) — P3 · _Q: cap which, or leave free?_

### Song editor

#### New Song flow — `P-1` (shipped to `beta` in `0.17.0-beta.2`; flags still off)

The rethink happened. Both halves ship behind Labs flags and are **off by
default**; graduating them is the remaining `P-1` work.

**The model we settled on.** A paste fills the section it lands in, and expands
into siblings when the pasted text carries its own headings. A new song is one
empty box, so a whole-song paste becomes the whole song *because of what the
content says* — not because of a "new song mode". That dissolved the
blank-vs-paste split we kept trying to design around, and it came out of the
user's own framing ("for a new song it should paste the new song, for a section
it should be for that specific section").

Section types are inferred by **repetition, not position** — a block of lyrics
that comes back is the chorus whatever order it arrives in, which answers "some
songs start with the chorus". Everything else is a verse, and every label is a
tap-to-change chip: solid where repetition backs it, dashed where it's a guess.

**Shipped (Labs `addSongModal`)**
- ✅ One Add-a-song surface: search over the catalog, Import + Blank underneath.
  Whole-sheet drop target on desktop; mobile goes straight to the OS picker.
- ✅ Mobile sheet shares the account panel's mechanics via `ui/MobileSheet`
  (same surface, corners, entrance curve, drag-to-dismiss, safe-area).
- ✅ Catalog picks skip the editor — saved and opened in the hub.

**Shipped (Labs `pasteIntoChart`)**
- ✅ Paste scoped to its section (`lib/pasteScope`).
- ✅ **Paste review** (`editor/PasteReview`) — block chips, Join up / Drop,
  section summary, one footer with both exits.
- ✅ Repeat marks `//: … ://` (and `|: :|`, `://3`, `𝄆 𝄇`) become **play order**,
  not punctuation: one section listed N times.
- ✅ Empty state is a paste box with `+ Add section` above; no arrangements, no
  import/browse/blank bar re-asking a question already answered.

**Shipped (not flagged — fixes and polish)**
- ✅ **PDF import** — `src/import/pdfChart.js` + `pdfLayout.js`. Chords found by
  FONT, not regex; chord offsets exact where the generator splits the lyric run,
  estimated from average character width where it doesn't. Two-column gutter
  detection, Romanian section vocabulary (STROFA/REFREN/PRE-REFREN/PUNTE), play
  order strip, title/key/writers/year. pdf.js lazy + excluded from precache.
- ✅ **Four data-loss bugs**, all found by the user:
  1. Save with unconverted paste text persisted the details and dropped the
     lyrics. The primary button now *becomes* "Turn into chart".
  2. An unlabelled paste vanished entirely — `parseSongMd` drops every line
     before the first `## `, so a headerless body parsed to zero sections.
     `ensureSections` guarantees at least one heading.
  3. "+ Add section" wiped a pasted song. The button now only exists when the
     box is empty, so the trap can't be reached.
  4. The chart canvas rewrote the whole frontmatter on every edit, stamping the
     parser's `Untitled`/`C` defaults onto an unnamed song. It now owns the body
     and play order only.
- ✅ **Play order always visible** (was behind a "Customize" link) and a
  **vertical left rail from `xl`**, filling the dead space a wide monitor leaves
  beside the sections. Real names, drag, `+` to repeat, `×` to drop.
- ✅ Paste cleanup (`lib/cleanPastedText`) — zero-width chars, soft hyphens,
  exotic spaces, hyphenated line-wraps.
- ✅ Detail fields say what they *do*, on hover.
- ✅ Key "needs a key" marker is the border's own colour (was a ring stacked
  outside a border — uneven at the corners).

**Left to do**
- 🔴 **Graduate the two Labs flags** — `addSongModal`, `pasteIntoChart`. Needs a
  real week of use first. `P-1`.
- 🔴 **PDF import only works with `addSongModal` ON.** The legacy modal has its
  own file handler that predates `lib/importFiles` and doesn't list `.pdf`.
  Either wire it or accept the flag as the path. `P-1`.
- 🟡 **Play order in the narrow strip still uses `shortCode`** (`V1`, `PC`) — the
  rail fixed the labels, the `< xl` strip didn't. `P1`.
- 🟡 **Validate the `xl` breakpoint** for the rail with real screens. `P2`.
- 🟡 **Split-word repair was removed on purpose.** "ur ca" → "urca" can't be told
  from two real words, because "ca" IS a Romanian word; the evidence test said
  yes to both. Recoverable from git if a specific source justifies it. `P2`.
- 🟡 **Repetition finds no chorus** when a source writes it out only once —
  every block comes back a verse and the chips do the work. Fine, but worth
  watching whether that's the common case. `P2`.
- ⬜ Romanian **section labels** (STROFA/REFREN as display names over the
  canonical types), tied to app language. `P2` — user: "a bit down the line".
- ⬜ **Flag a song you need** from the setlist builder, for songs not yet in the
  library. `P2` — user's idea, independent of this work.
- ✅ **Preview ignores key/transpose** — relabel-only Key + explicit Transpose; preview honours it (shipped).
- ✅ **New-song guardrails** — Title + Key start empty + mandatory; soft-remind bpm/time (shipped).
- ✅ **Double "structure" concept** — one official control shared by Arrange + Advanced (shipped).
- ✅ Preview defaults to **1 column**, persisted per device (shipped).
- ✅ **Editor Key field** follows the Accidentals setting + dual `F#/Gb` labels; **tempo box** height matched (shipped — see §5).
- ✅ **Song editor cards (Labs `songEditorCards`)** — identity/editor/preview cards, Aa-in-preview (global), Source dialog, header declutter (⋮ overflow), mobile identity-card collapse, Key-chip vs Transpose (shipped 0.15.0 — see §5).
- ✅ **Drag-to-reorder sections**, **drag-a-chord-to-move**, **inline Play-order chips** (Auto/Custom, no modal), **inline lyric composer + smart chord-sheet paste**, **undo/redo** (md history), **version history**, **pre-save validation chip** (shipped 0.15.0).
- Key/chord strip follows the edited section + respects active notation — P2.
- **Chord drag is same-line only** — allow dragging a chord across lines (recompute line + pos) — P3.
- **Custom Play-order onboarding hint** — first time a user hits Customize, hint that chips drag / × / + (discoverability) — P3.
- **Cross-device version history** — history is local per device (IndexedDB); consider surfacing in the Song Hub and/or syncing — P3.

### Chart view
- ✅ **Layout menu rework** → folded display controls into one tabbed **"Aa" menu**
  (Lyrics/Chords/Page; per-element size·font·colour) — shipped (`AaMenu.jsx`). View
  modes moved into the ⋮ kebab; header actions lifted onto the title row; phone
  title/meta typographic hierarchy. (Extend the Aa menu to Performance/Practice next.)
- ✅ **Enharmonic spelling** (C# vs Db) — key-aware by default + global Sharps/Flats/Auto override (shipped 0.14.x; threaded through display, editor transpose, suggestions, key dropdowns).
- **Collapsed-header top gap (tablet)** — when the chart header is collapsed, song
  content scrolls into the strip above the structure ribbon (lyrics peek over the
  top edge). Extend the header background up to the very top (cover the status-bar/
  safe-area inset) so nothing shows behind it — P2.
- Dual `F#/Gb` labels in the **chart transpose** key dropdown too (editor done) — P3.
- Transpose tabs — P3 · _feasibility spike_.
- **Chord fingering diagrams — display control pulled.** The Aa "Show fingering
  diagrams" toggle was removed from the menu (the rendering path + `showDiagrams`
  setting still exist in `ChartView`). Revisit where this lives — likely the new
  fullscreen chart viewer alongside the migrated view-modes — and reinstate a
  control then. (TODO marker in `AaMenu.jsx` Chords tab.) — P2.
- **Hub fullscreen viewer (WIP)** — `FullscreenChartViewer.jsx` is a scaffold;
  bring the chart **view modes** (chords/lyrics/song map/tabs, formerly in the ⋮
  menu) and live controls (auto-scroll, metronome, font stepping) into it. — P2.
- **Default chart theme that follows the app theme** — add a chart theme option
  whose lyric/chord colours auto-track the app's light/dark theme (instead of a
  fixed palette), so a reader in light mode gets light-appropriate chart colours
  without hand-picking them. (Requested 2026-06; to be designed/built later.) — P2.
- **Structure (section) default colour rework** — the per-section-type default
  colours (`SECTION_COLORS` in `music.js`) need a pass: they drive section
  labels, the song-map chips, and section cards, and the current defaults don't
  feel cohesive in the card language. Revisit the palette (and how it reads in
  light/dark + the chip "codes" style). (Requested 2026-06.) — P2.

### Song library
- 🟡 **Unify Cards / Compact into one reworked list view** — three view modes
  (Cards / Compact / Table) is one too many: Cards and Compact are the same row
  with different padding, so the switcher asks the user to make a choice that
  doesn't earn itself. Collapse them into a single well-designed list view
  (density becomes a property of the view, not a separate mode) and rethink what
  that row actually shows. Applies to **both** Songs and Setlists, and folds into
  the per-view `cardFields` work — P1.
- **Doubled mobile search** — the top-bar global cross-search also shows on Songs/Setlists where it duplicates each page; scope it to the page there, keep global on Dashboard (+ the desktop ⌘K) — P2.
- **Setlist search by contained song** — searching in the Setlists tab should also return setlists that *contain* the matched song (match song titles inside each setlist's items), not just setlist name/metadata — P2.
- Drag-to-**reorder** table columns (show/hide shipped in 0.14.0) — P3.

### Setlists (overview / viewer)
- 🟡 **Migrate to the card design** — bring the setlist **overview** into the same
  card language as the song editor/hub (identity card + content cards + consistent
  header/⋮ · Aa where relevant). Requested 2026-07; the next big redesign after the
  song editor — P1 (pre-soft-launch: setlists are half the product).
- Overview page visual redesign + buttons rework (Set order/Band + Play live/Practice inline) — P2.
- Warn before editing a **past** setlist — P2.
- Remove redundant "Set Order" control; relocate "Show details" — P2.
- Reposition "Edited by"; Location on the date line; date in Title Case (not CAPS) — P3.
- Reduce icon clutter / reconsider bin placement; services dropdown styling — P3.
- Structure pill inside setlist song cards — P3.
- Shared-viewer: tap a song to open it; "Open app" returns to the setlist; onboarding; refresh the older share UI — P3–P4.

### Setlist editor
- **Delete the pre-cards setlist editor/viewer path** — the card design graduated
  from Labs (2026-07) and is now the default; `cards={false}` on `SetlistOverview`
  / `SetlistBuilder` is an unused escape hatch keeping `SetlistOverviewV2` and the
  legacy builder layout alive. Remove both once the cards version has had a real
  run — P2.
- 🔴 **Title field: border + mandatory warning + bigger** — give the setlist title
  its own bordered input with a "required" warning when empty, and size it up so it
  aligns visually with the Draft/Ready toggle beside it — **P1**.
- 🟡 **Migrate to the card design** — the setlist **editor** should match the song
  editor's card layout (identity/edit/preview cards, calmer header, mobile collapse).
  Pair with the overview redesign above — P1.
- **Time → dropdown picker** — replace the free-text end-time (and start-time)
  entry with a proper time dropdown/picker — **P2**.
- **Unify the destructive labels** — rehearsal, tag, note, and end-time each have
  their own "remove/clear" affordance; collapse them into **one shared label**,
  styled **red**, so clearing any optional field reads consistently — **P3**.
- **Clear song-search after selecting** a song (+ an "x") so adding several is quick — P2.
- **Location → Google Maps (easy tier)** — P2. Places Autocomplete on the
  Location field (type a venue → real suggestions; store the name + optional
  lat/lng); in the viewer the location becomes a tappable link that opens the
  native maps app (`https://maps.google.com/?q=…` / `geo:` — no SDK, no embed).
  Needs a billing-enabled Places API key + a CSP allowance for the Places
  endpoint + a privacy note. _Skip the embedded map tier — Maps JS/Embed API
  conflicts with our strict CSP (external script + tiles), same issue that
  killed Spotify playback._
- Rework Set order/Band + relocate Draft/Ready — P2.
- Song/break **card redesign** — P2 · _Q: what feels off?_
- Rework **Recommended-next engine** (weigh more song-detail fields) — P2.
- Desktop **3-pane** layout (details · current set · library) — P2.
- **Setlist templates** — let a user save a setlist as a reusable template and
  start new setlists from one — P2. _Recommended approach (Option A): a flag on
  the setlist object, no migration._
  - **Data:** add `isTemplate: true` (+ optional `templateName`) to the setlist.
    `storage.isValidSetlist` only requires `id/name/items`, so it rides along in
    IndexedDB and syncs for free; no schema change.
  - **Save as template:** editor/viewer ⋯ → clones the current setlist with
    `isTemplate: true` and strips date/time/rehearsal (templates are date-less).
  - **New from template:** "New setlist → From template" picker deep-clones the
    template's `items` (songs + per-item key/capo/tempo/structure/notes) into a
    fresh setlist with a new `id` and today's date. Roster/schedules are **not**
    copied (per-service).
  - **Manage:** filter templates out of the normal Setlists list (own section or
    a facet chip) so they don't clutter it.
  - _Alt (Option B): a dedicated `templates` IndexedDB store + shape — cleaner
    separation, but new storage/list/sync plumbing. Prefer A unless templates
    need to diverge from the setlist shape._
  - Build behind the `setlistCards` Labs flag alongside the rest of the redesign.

### Dashboard
- **Live customize mode** (drag widgets in place, tray for unused) — P2.
- Default widget order + welcome-banner decision (keep/remove/removable) — P2.
- **Library widget** — improve or cut ("keys" stat unclear; no-op on click) — P2.
- **Sync status** — fixed spot, not a widget — P2.
- Search placeholder → just "Search" — P3.
- Next-up Practice button + practice-time widget (depends on Practice mode) — P3.

### Team
- Landing rework (surface the church; "Invite member" shouldn't be first) — P2.
- **Stats & insights** tab (most/least played song & key, top member) — P2.
- Admin/leader-only **Options** tab — P2.
- **30-day soft team/account deletion** w/ countdown + restore (needs `deletion_at` + scheduled purge) — P2.
- Collect more member info (phone, leader-only, GDPR-sensitive) — P3 · _Q: which fields?_

### Settings · Help · Nav
- 🟡 **Big Settings rework (mobile + desktop)** — the whole Settings surface needs
  a structural redesign, not just tweaks: rethink the panel taxonomy, fold the
  standalone **Account** page fully into Settings (entry points now unified — the
  drawer account card and the Account route both land on Settings → Account), and
  restore/relocate the helper texts that were stripped for now — P1. _Supersedes
  the "add/reorg settings" + "mobile settings rework" line below; keep those as
  sub-tasks._
- Settings: add/reorg settings — P2; **mobile settings rework** — P2.
- Help: context-specific "?" per screen — P2; surface feedback prominently (MultiTracks north star) — P2.
- **Hamburger panel** — keep-vs-replace decision, then rework — P2 · _Q: keep?_; motivational quotes keep/drop — P3.
- FAB: more actions; nav→prev/next pill morph + motion — P3.

### Notifications
- 🟡 **Notifications UX rework (mobile + desktop)** — the notifications surface
  needs a proper redesign on both form factors. The in-page "Clear all" is buried
  (you scroll to reach it); the mobile FAB now offers **Mark all read / Clear all**
  as a stopgap, but the whole tray/page layout, grouping, and empty/overflow states
  want a rethink — P2.
- Big rework shipped (dismiss/clear-all, server-authoritative decline alerts, cross-device read state).
- ✅ **Web Push + worker shipped (2026-07-02)** — `notify-worker` edge function on a
  minutely pg_cron: sends real lock-screen push (RFC 8291/8292, WebCrypto impl
  interop-tested against `http_ece`) for schedule requests/declines/nudges, and
  generates the **maybe-nudge server-side** (was client-derived). New
  `push_subscriptions` table + per-device opt-in button in the tray; "you've been
  scheduled" now has a durable DB trigger too. VAPID keys live in service-role-only
  `app_config`. Remaining: verify push end-to-end on a real phone (couldn't
  subscribe a headless browser), and consider an unsubscribe row in Settings.
- ✅ **"Notifications don't work" root-caused (2026-07-02):** (1) only
  `team_songs`/`team_setlists` were ever in the `supabase_realtime` publication —
  the `team_schedules`/`team_availability`/`team_notifications`/`team_activity`
  subscriptions connected fine and received nothing (fixed in
  `20260701_realtime_publication.sql`, applied live; replica identity full so
  delete events pass the `team_id` filter); (2) schedule↔setlist matching used
  the local content id against `team_schedules.setlist_id` (a row UUID) — so
  prompts said "a setlist" and maybe-nudges never fired (fixed via the
  `useTeamSetlistMap` mapping in App notification streams, `CalendarWidget`,
  `LiveFinale`; the hook now refreshes on `lastSync`).

### Cross-cutting / chores
- **Audit remaining menus/screens for the card design** — after the song editor +
  setlists, sweep the other menus/panels so the card language is consistent
  app-wide. Requested 2026-07 (#3) — P2. **Order: (1) Homepage/Dashboard**, then
  Settings, Account, Team, Pricing, remaining dialogs.
- ✅ **Bottom nav DPI/scale** — `BottomNav` tiles/FAB/label use `clamp(min, vw, max)`
  so the bar isn't oversized on smaller-viewport phones (was fixed px). Shipped 0.15.0.
- **Naming consistency** pass (casing across headers) — P3.
- Extend the **trash bin** (soft-delete) to setlists + a team-library bin — P2 (songs already done).
- Repo file clean-up (dead/orphaned files, stale docs) — P3.
- `skills.md` / Claude Code skills investigation (finish/release, changelog, migration-apply, PDF-verify as skills) — P3.
- More / custom roster instruments (per-team) — P3.

---

## 4. Post-launch roadmap (bigger epics)

### Anchor epic
- **Member edit suggestions / approvals** (P2) — members propose edits (a proposed
  arrangement or add-on) that queue pending until a leader/admin/editor approves.
  New `song_suggestions` table + a review inbox reusing notifications. Do it *after*
  notifications exist (they do). _Q: per-field vs whole-arrangement? who approves?_

### Modes & playback
- **Rehearsal vs Practice split** (P2) — rename current → Rehearsal (group, tied to a
  setlist), add solo **Practice** (loop a section, metronome, slow-down, log minutes
  → feeds a dashboard practice-time widget).
- Instrument **role profiles** (vocalist/guitar/bass/keys/drums views); drummer counts,
  piano voicings, bass-root emphasis; section-loop rehearsals; quick-key switchers.

#### Reading-view model — design direction (next milestone after 0.14)
> **Full captured vision: `docs/views-vision.md`** (per-surface decisions for
> Chart / Live / Rehearsal / Practice from the 2026 product-owner Q&A). Read that
> first; the summary below is the older short form.

**Decided (with user): do NOT build 4 separate views** — that's 4 forks of the same
kitchen-sink sheet and a "which do I open?" decision for users. Instead, **2
surfaces** with **presets** inside the player:
- **Chart** — read/browse a single song (library default). (≈ today's `ChartView`.)
- **Player** — setlists, with three preset modes:
  - **Live** — locked-down, header auto-hides, fewest controls (mid-service focus).
  - **Rehearsal** — all controls + structure + notes visible, easy key/notation/
    column switchers + section jumps (band working through songs).
  - **Practice** — solo tools layered on: metronome, section loop, slow-down, log
    minutes → dashboard practice-time widget.

Open questions for the build (the per-preset detail pass):
- **Per-preset control allow-list** — exactly which knobs each preset exposes
  (notation, columns, font, role, style, spacing, tab-instrument, display-mode).
  Live = fewest, Rehearsal = most. _Needs a focused questionnaire before building._
- **Consolidate the duplicated controllers.** `ChartView` / `PerformanceView` /
  `PracticeView` each re-implement the same font-size / display-mode /
  tab-instrument / notation state + persist pattern. Extract a shared display
  controller (build on `lib/chartDisplay.js` + `PerformanceLayoutSheet.jsx`) so a
  surface is "shell + an allow-list of knobs", not a fork — then presets are config.

_Shipped groundwork (recent cycles): floating-structure-ribbon position (Labs,
`FloatingStructure`), chart-themed floating pill, per-arrangement auto/custom
slide-order toggle, editor key-relabel/explicit-transpose split — see §5._

#### Song hub — the library's song-open target (P1, next milestone)
**Decided (with user, 2026-06-26):** opening a song from the library should land on
a **Song hub**, not today's kitchen-sink chart strip. Inspiration: MultiTracks'
single-song page (one identity header + a row of tabbed surfaces). Goal is to
**de-clutter** — the chart stops trying to *be* the hub (reader + every control +
transpose + structure + export on one strip) and instead **becomes just the reader**;
the hub owns identity + navigation.

Mockup: `docs/mockups/song-hub.html` (render: `docs/mockups/song-hub.png`).

Shape:
- **Hub header** — art/title + key chip, artist, inline meta (`Key · ♩BPM · Time · Length`),
  **arrangement picker**, and hub-level actions (Transpose, **Aa**, ⋯ overflow for
  Print/Share, **Edit**). The `♩=180` inline-tempo idea lands here.
- **Song-map ribbon** under the header (quiet section codes; matters most for Live).
- **Tabbed surfaces** — `Chart · Lyrics · Details · Audio · Practice` — destinations,
  not trapped modes. Chart is the default; setlist arrival shows a breadcrumb.
- **One "Aa" menu** owns the *chart reading* prefs (theme, show chords/lyrics/map,
  columns, text size, chord diagrams, Nashville, structure ribbon). **Set once →
  remembered per device** (`usePersistentView`); app-wide defaults stay in Settings,
  experimental toggles in Labs.

Sequencing (it's a nav refactor — no router today, so new `view` state + moving
controls between components):
1. ✅ **Fold chart display controls into one `Aa` menu** — shipped: `AaMenu.jsx`
   tabbed popover (Lyrics/Chords/Page) replaces the chart's Display+Layout icon
   buttons; per-element **size/font/colour** (fixed palette via `CHART_COLOR_PALETTE`,
   `chartLyricColor`/`chartChordColor` → `useChartTheme`); Page tab holds theme/
   notation/columns/show, with an "Advanced" link to the existing Layout sheet.
2. ✅ **Hub header + tab row** as the library's song-open target — shipped
   (`SongHub.jsx`, `song-hub` route, two-card V2 layout, cover art, codes song-map).
3. ✅ **Lyrics & Details tabs** (incl. inline Details editing) — shipped. Remaining:
   **Audio/Practice** tabs + the **bottom transport** (Phase 3/4). Full per-surface
   direction now lives in **`docs/views-vision.md`**.

**V2 decisions (2026-06-26 — mockup `docs/mockups/song-hub-v2.*`):**
- **Aa is a popover, not a docked rail** — anchored to the header button, reader
  reclaims full width. The popover is **tabbed**: a **Lyrics** tab and a **Chords**
  tab (each with independent **size / font / colour**), plus a **Page** tab
  (theme · columns · show mode · chord-diagrams/structure toggles). Mockup:
  `docs/mockups/aa-menu.*`.
- **Header gains Full screen + Campfire — keep both, label clearly.** Full screen =
  maximize *this hub/reader* (hide chrome + wake-lock). Campfire = enter the
  existing **locked single-song performance shell** (single-song Play already
  ships). Don't blur them.
- **Default columns = 2** (Aa controls 1/2/Auto). Transpose lives in the header.
- _Q: hub Transpose persistence — persist per song, or reset on close?_ (also in
  `views_questions.md`).
- **Bottom transport bar (concept)** — play/pause · source · scrubber · metronome ·
  auto-scroll · loop. Phasing & open questions:
  - **Audio source — decision needed.** We only store **Spotify/YouTube links**, so
    real backing-track playback + a true scrubber is roadmap-level. _Q: ship as
    **(a) metronome + auto-scroll only** (no audio, fully shippable now — scrubber =
    song position), **(b)** drive a **YT/Spotify embed** (limited scrub), or **(c)**
    real **multi-track** playback (store/upload audio — major)?_ Lean **(a) first**.
  - **Scope** — global mini-bar that only appears when a track/metronome/auto-scroll
    is **active**, expanding on the **Audio/Practice** tabs (so it doesn't duplicate
    the Audio tab).
  - **Mobile collision** — the bar fights `BottomNav`; sit it above nav, hide it
    outside full screen, or replace nav while playing. _Needs a mobile pass._
  - **Loop needs a target** — selecting a section to loop is a **Practice-tier**
    interaction, not free on the plain chart.

#### Competitive read — melodia.ro chart view (analysis 2026-06-26)
A friend's worship-chart app. **What it does well & we should borrow:** (1) one **"Aa"
menu** owning *all* reading prefs (theme/size/font + Versuri/Acorduri) → our §hub Aa
menu; (2) **set-once, sticks per device**; (3) quiet bottom **song-map**; (4) inline
`♩=tempo`. **Where we already win / won't copy:** multi-arrangement, capo, enharmonic
correctness, offline PWA, setlist/live integration; **skip** his **key picker that
lists all 17 enharmonic spellings** (convoluted — our 12-key, accidentals-driven
dropdown with dual `F#/Gb` labels is cleaner, shipped — see §5); **skip** the
"save-in-key" sentence CTA; a top-level lyrics/chords toggle isn't worth it for us
(menu item is fine). **Named theme presets (Paper/Navy):** we already have chart
themes (Pro) — no need to copy.

#### Performance / Live header overhaul (P2 — down the line)
The Performance/Practice header needs its own rework (the Chart's Aa-menu + title-row
consolidation hasn't been applied there yet). **Known blocker to fix in that pass:**
when the header is **collapsed** mid-set, the **✕ exit control disappears**, so there's
no obvious way to leave Live/Practice without first expanding the header. The overhaul
should keep a minimal always-visible exit (and the same single-Aa-menu treatment) —
do it as one deliberate pass rather than patching the collapse state in isolation.

#### Theme pass for reading views (P2)
The chart/section **themes need an update**: in dark chart themes some rows render
**white-on-white** (e.g. setlist breaks), the **structure ribbon pills don't follow
the section colour scheme** consistently, and the floating-structure overlay needs a
legibility check per theme. Audit `data/chartThemes.js` + `StructureRibbon` +
`SetlistList` colour tokens against every preset (light and dark).

### Competitive parity — OnSong (analysis 2026-06-25)

From OnSong's 2026 release + pricing matrix. **Verdict: no big gap on the core job**
(charts, transpose, setlists, live). We're at parity or ahead on multi-arrangement,
auto/custom structure, team collaboration + scheduling, cloud sync, search/filters,
customizable tables, PWA/offline. Their lead is ecosystem extras + a content catalog.

**Already matched:** Song editor, style prefs (transpose/capo), custom metadata,
"Versions" (≈ our arrangements), set picker, song-list export + columns, sharing,
foot pedals/nav zones, Nashville/solfège.

**Add (high value for worship teams), priority order:**
1. **Metronome** (audio click + visual) — already slated for Practice mode.
2. **Inline lyric formatting** — bold/italic/colour/highlight in lyrics (they show it;
   we don't render it). Cheap, visible parity win.
3. **Backing-track playback** — we store Spotify/YouTube *links* but can't play/trigger
   them; add play/pause from the chart (linked or local file).
4. **Annotations / markup** — sticky notes + freehand drawing on a chart. High value,
   real effort.
5. **Import pipeline expansion** — URL/OnSong/ChordPro/PDF importers (already in Interop).
6. *(church-tier bet)* **Lyrics projection / external display** (Chromecast/stage monitor).
7. *(cheap extras)* **Tuner** + **tap/detect tempo**.

**Maybe / later:** ChordFlow-style PDF chord detection+transpose; nested "books/topics/
icons" library organization; mic **Key Finder**.

**Skip (off-strategy):** hardware (AuxBox, Coda Stomp), OnSong Charts content catalog
(licensing), multi-output HDMI video, **MIDI integration**, **Scenes/DMX lighting**,
device master/slave (OnCue), menubar customization, **Voice Control / TalkThrough AI**.

### Interop & import

- 🔴 **Bulk import — the migration path. `P1`, and the next thing after the flags
  graduate.** A church moving off Planning Center has ~200 PDFs. Today the
  importer takes multiple files but has no folder drop and no batch review, so
  200 songs means 200 trips through the editor — a 40-minute chore people
  abandon halfway, leaving a half-migrated library, which is worse than not
  starting. Needs: folder/`webkitdirectory` drop, a review table (title · key ·
  detected format · warnings · checkbox), and a decision on where it lives —
  _Q: a step in the welcome flow, or found later in Settings?_
- ✅ **PDF-to-Markdown engine** — shipped, see §3 Song editor. Verified against a
  real two-column Romanian chart. Scanned PDFs correctly report "no text to
  read" rather than importing an empty song.
- **Photo / scanned-chart import** — a vision model behind an edge function
  (`supabase/functions/chart-ocr`), gated on the existing but unused
  `smart-import` entitlement (`sync` tier). Tesseract was considered and
  rejected: it misreads exactly the characters that matter (`Bb` → `B6`). `P2`.
- ✅ **OnSong `.onsong` archive import** — the zip is inspected now, so an archive
  of ChordPro no longer gets mistaken for a setlist bundle.
- **PCO (Planning Center) bridge** (OAuth + API client — its own project),
  **SongSelect `.usr`**, a **Migration Hub** onboarding screen with per-app export
  instructions ("OnSong → Settings → Export → ChordPro archive").
- **Multi-song PDFs** (a whole songbook in one file) — detected and explained
  today, not split. Splitting is a feature in its own right. `P3`.
- **Export as ChordPro** (`.cho`) for interoperability.
- **i18n** — hooks + tier-1 languages (es, pt, ko, fr); RO/HU religious-use legal alignment.

### Public-domain catalog (Browse)

Design settled in this cycle; nothing built beyond the bundled demo songs behind
`lib/catalog.js`, which is already async and abort-aware so the real thing drops
in without touching callers.

- **Server-backed, never cached.** A Postgres table + search RPC, not a static
  index: the user's call ("it should work only when online, we might have a lot
  of songs in different languages"), and it's also the only shape that scales
  past a few languages. `unaccent` + `pg_trgm` are available on the project but
  not yet enabled — both are needed for Romanian diacritic-insensitive search.
  Add an explicit `NetworkOnly` Workbox rule rather than merely omitting the
  endpoint, so a future catch-all can't start serving stale songs.
- **Adds are copies, with provenance.** Full copy plus `source` +
  `catalogVersion`, so "a corrected version exists" can be offered later. The
  chart is the user's to edit; the credits are a record.
- **Seven new frontmatter fields**: `source`, `license`, `sourceurl`,
  `firstline`, `work`, `meter`, `tunename`. Additive, so MINOR not MAJOR.
- **Content is the hard half, and it has legal teeth.** A Romanian *translation*
  carries its own copyright even when the hymn is centuries old; most evangelical
  hymnal translations are 20th century. Safe corpus to start: **colinde**
  (traditional, anonymous, and December is a real deadline).
- **"Popular this week" isn't real** — curated `featured` first; measured only
  once there's traffic. Missed searches are the more valuable metric.

### Native & integrations (v3.5+)
- **Capacitor** iOS/Android wrap, native OAuth (Apple/Google), native Bluetooth pedals, safe-area audit, store deployment.
- **Projection** (ProPresenter/Proclaim) and **tracks/audio cues** (Ableton); define the integration surface first (export format / webhooks / deep links).
- **Companion congregation songbook** app (read-only follow-along) — horizon.

### PDF export enhancements
More entry points (library row, SetlistPlayer, PracticeView), NNS in PDF, chord
diagrams in PDF, per-song setlist subtitle, cover-page customisation (logo/band),
total set duration, per-song selection, paper-size (A4/Letter) toggle, hide cover/tabs/notes
toggles, margins/spacing toggles, section-per-page, reset-to-defaults, jsPDF fallback.

### ⚠️ MAJOR (breaking — needs migration; schedule deliberately)
- **Reusable tab library / snippets** — named riffs referenced by id instead of inlined; breaks the inline `.md` round-trip → schema + migration. _(Explicitly MAJOR per SemVer.)_
- **"Outgrew `.md`?" data architecture** — attachments (PDF/sheet music on a song), the BYOC **Song Bundle** folder format, full-text **lyric search**.
- **Multi-line Story/Notes** — frontmatter is one line per field; preserving newlines needs a format decision.
- **Unify the double-structure model** — collapse `arrangement.structure[]` + editor section flow.

---

## 5. Recently shipped (context)

- **New Song flow rework** (`0.17.0-beta.2`) —
  the `P-1` rethink. One Add-a-song surface (Labs `addSongModal`) sharing the account
  panel's sheet on mobile; **paste review** with repetition-inferred section chips
  (Labs `pasteIntoChart`); **PDF import** (font-based chord detection, two-column
  gutter split, Romanian section vocabulary, play-order strip); paste scoped to the
  section it lands in; repeat marks `//: … ://` read as play order; play order always
  visible and given a left rail from `xl`. Four data-loss bugs fixed — save dropping
  pasted lyrics, an unlabelled paste vanishing through `parseSongMd`, "+ Add section"
  wiping a paste, and the canvas stamping `Untitled`/`C` onto unnamed songs. See §3
  Song editor for what's left.
- **0.15.0-beta — A hands-on song editor** (on `claude/song-editor-cards-header-oyd2w9`) —
  **Song editor cards (Labs `songEditorCards`)**: identity/editor/preview cards, Aa-in-preview
  (writes global display), Source dialog for raw markdown, ⋮-overflow header declutter, mobile
  identity-card collapse, gold Key chip vs Transpose. **Arrange (shared by both editors):**
  drag-to-reorder sections (grip; HTML5 + native touch, collapse-on-drag + edge autoscroll +
  insertion line), drag-a-chord-to-move, inline **Play order** editor (Auto/Custom, draggable
  chips w/ ×/+ — no modal), inline lyric composer + smart Ultimate-Guitar/ChordPro paste on empty
  sections, `SectionTypePicker`/menus portaled (flip up near screen bottom), duplicate-section-label
  fix, touch-drag no-text-select. **Editor-wide:** undo/redo (md history), version history
  (`storage.loadVersions/pushVersion`), pre-save validation chip, delete-song moved to the Song Hub ⋮.
  **Cross-cutting:** `BottomNav` clamp(vw) sizing. **Sync:** members never conflict (cloud wins) +
  bulk Keep-all-mine/cloud in `ConflictResolver`.
- **Reading-view + editor polish** (current `0.14.x-beta`, on `claude/clever-galileo-hkmim6`) —
  editor Key **relabel-only** + explicit Transpose split; **new-song guardrails** (Title+Key
  mandatory, blank-key bug fixed); preview **defaults to 1 column** (per device); one official
  **`StructureControl`** shared by Arrange + Advanced (no more double structure); **enharmonic
  spelling** end-to-end (key-aware + Sharps/Flats/Auto setting) with editor key dropdown **dual
  `F#/Gb` labels**; tempo box **height fix**; chord picker **popup at cursor** + diatonic
  suggestions; scroll-based **section highlight**; **floating structure ribbon** (Labs:
  Off/Bottom/Left/Right + Chips/Codes/Dots/Dots+label); Live/Practice header **overflow menu**;
  setlist rail glass + un-numbered brand breaks; **Accidentals** + **Navigation-controls**
  settings. Docs: `docs/views_questions.md` (per-view questionnaire), `docs/mockups/song-hub.*`.
- **0.14.0** — unified diacritic/punctuation/typo-tolerant **search** across all
  metadata (`src/lib/search.js`) + ⌘K + highlighting; **multi-filter** library
  (`songFacets.js`/`LibraryFilters`); **customizable table columns** for Songs + Setlists
  (`tableColumns.js`/`ColumnsMenu`, synced); **Cards/Compact/Table** mobile views (remembered
  per device); redesigned setlist card + unified setlist filters.
- **0.13.0** — sync conflict resolver + retry/offline-queue reliability.
- **0.12.x** — app-shell redesign, stage headers, private + team notes, customizable dashboard,
  multiple workspaces, campfire single-song Play, edge-arrow nav.
- **Scheduling & Notifications pillar** — notifications (dismiss/clear-all, server-authoritative
  decline alerts), My-Schedule v2, scheduling grid (roster × services), availability widgets.
- **Foundation** — GDPR delete-account, legal pages, security pass, CI + branch protection,
  per-song persistence + incremental sync hashing, PDF iframe + CSP enforcing.
