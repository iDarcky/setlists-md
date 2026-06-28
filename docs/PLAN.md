# Setlists.md — Plan (single source of truth)

> **The one place for launch + polish + roadmap.** Replaces the old
> `docs/ROADMAP.md` and `docs/BACKLOG.md`. `CLAUDE.md` stays the dev/agent memory
> (stack, architecture, schema, finish/release workflows, gotchas) — it points
> here for planning.
>
> _Last updated: 2026-06-26 · Current version: `0.14.0-beta.1` (on `beta`)._
>
> **Priority:** `P0` drop-everything · `P1` high · `P2` medium · `P3` nice-to-have.
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
  per-song IndexedDB persistence, incremental sync hashing. Deferred (deliberately):
  batch the team-engine push loop (breaks per-row CAS), `team_activity` retention job.
- **OAuth URL cleanup synchronous** — deferred; needs the live OAuth/magic-link flow
  tested before touching (stripping the hash before Supabase consumes it can break sign-in).
- **PDF/CSP enforcing** — shipped; **needs live print verification** on deploy (PWA + installed app).
- 🔴 **Dashboard global search returns nothing (desktop/tablet)** — searching a song's
  details (e.g. the song's title/name) in the home top-bar / ⌘K search yields no
  results, while the same query works elsewhere. Likely a wiring gap between the
  dashboard search input and `src/lib/search.js`. P1 bug — repro + fix.

---

## 3. Polish backlog (by area)

Open, actionable items. Cross-cutting concerns at the end.

### Song details
- Rich editor for **Story-behind** (breaks-style, like the setlist editor); maybe Notes too — P2 · _Q: both or just Story-behind?_
- **Dedicated full song-details view** (open-in-full button) — P2 · _Q: route vs expanded panel?_
- Field char limits (Themes/Genres/Verses/Moment/Tags) — P3 · _Q: cap which, or leave free?_

### Song editor
- ✅ **Preview ignores key/transpose** — relabel-only Key + explicit Transpose; preview honours it (shipped).
- ✅ **New-song guardrails** — Title + Key start empty + mandatory; soft-remind bpm/time (shipped).
- ✅ **Double "structure" concept** — one official control (`StructureControl`) shared by Arrange + Advanced (shipped).
- ✅ Preview defaults to **1 column**, persisted per device (shipped).
- ✅ **Editor Key field** follows the Accidentals setting + dual `F#/Gb` labels; **tempo box** height matched to Key/Time triggers (shipped — see §5).
- Key/chord strip follows the edited section + respects active notation — P2.

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

### Song library
- **Doubled mobile search** — the top-bar global cross-search also shows on Songs/Setlists where it duplicates each page; scope it to the page there, keep global on Dashboard (+ the desktop ⌘K) — P2.
- **Setlist search by contained song** — searching in the Setlists tab should also return setlists that *contain* the matched song (match song titles inside each setlist's items), not just setlist name/metadata — P2.
- Drag-to-**reorder** table columns (show/hide shipped in 0.14.0) — P3.

### Setlists (overview / viewer)
- Overview page visual redesign + buttons rework (Set order/Band + Play live/Practice inline) — P2.
- Warn before editing a **past** setlist — P2.
- Remove redundant "Set Order" control; relocate "Show details" — P2.
- Reposition "Edited by"; Location on the date line; date in Title Case (not CAPS) — P3.
- Reduce icon clutter / reconsider bin placement; services dropdown styling — P3.
- Structure pill inside setlist song cards — P3.
- Shared-viewer: tap a song to open it; "Open app" returns to the setlist; onboarding; refresh the older share UI — P3–P4.

### Setlist editor
- **Clear song-search after selecting** a song (+ an "x") so adding several is quick — P2.
- Rework Set order/Band + relocate Draft/Ready — P2.
- Song/break **card redesign** — P2 · _Q: what feels off?_
- Rework **Recommended-next engine** (weigh more song-detail fields) — P2.
- Desktop **3-pane** layout (details · current set · library) — P2.

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
- Settings: add/reorg settings — P2; **mobile settings rework** — P2.
- Help: context-specific "?" per screen — P2; surface feedback prominently (MultiTracks north star) — P2.
- **Hamburger panel** — keep-vs-replace decision, then rework — P2 · _Q: keep?_; motivational quotes keep/drop — P3.
- FAB: more actions; nav→prev/next pill morph + motion — P3.

### Notifications
- Big rework shipped (dismiss/clear-all, server-authoritative decline alerts, cross-device read state). Remaining: maybe-nudge needs a scheduled job (still client-derived).

### Cross-cutting / chores
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
2. **P1 — introduce the hub header + tab row** as the library's song-open target.
3. Then wire the secondary tabs (Lyrics/Details/Audio/Practice) incrementally.

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
- **PCO (Planning Center) bridge**, **OnSong `.onsong` archive import**, **SongSelect `.usr`**,
  **PDF-to-Markdown** best-effort engine, a **Migration Hub** onboarding screen.
- **Export as ChordPro** (`.cho`) for interoperability.
- **i18n** — hooks + tier-1 languages (es, pt, ko, fr); RO/HU religious-use legal alignment.

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
