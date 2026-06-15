# Backlog

Running idea / bug / UX list for Setlists.md. Single source of truth for
triage. Nothing here is committed work until it's pulled into a branch.

**Priority guesses:** `P0` drop-everything · `P1` high · `P2` medium ·
`P3` nice-to-have. First-pass guesses, re-scored at triage.

**Type tags:** `[bug]` `[idea]` `[ux]` `[security]` `[perf]` plus free-form
area/topic tags in the user's words.

**`Q:`** = open question that needs a decision before/at triage.

Organized by app area. Cross-cutting concerns (security, scale, naming) are
called out in their own section at the bottom.

### Product direction (north star)

- **"Planning Center, but lighter + chart-first."** Goal is to replace
  Planning Center at smaller churches. Near-term focus areas — **scheduling
  and notifications** — should be weighted up at triage.
- **Scale target:** a single church caps at ~30–50 members (possibly more
  later if tech team / preachers are included). Realistic worst case ~100
  churches × 50 members (~5k users); not expected within a year. Pressure is
  on *many small team libraries*, not one giant one.

---

## 1. Song details

- **Field char limits** — Themes, Genres, Bible verses, Liturgical moment,
  Tags currently accept unlimited chars before each comma. Decide whether to
  cap any (e.g. tags ≤ 15 chars) or leave all free. _tags:_ [ux], [editor],
  [song-details] · _pri:_ P3 · _Q: cap which fields, or leave all free?_
- **Rich editor for Story-behind / Notes** — consider giving "Story behind"
  (and maybe "Notes") the same breaks-style editor used in the setlist
  editor. Leaning: yes for Story-behind, unsure for Notes. _tags:_ [idea],
  [editor], [song-details] · _pri:_ P2 · _Q: editor for both, or just
  Story-behind?_
- **Details dropdown mis-positioned** — the dropdown under the title renders
  under the song *section* instead of directly under the title. _tags:_
  [bug], [song-details] · _pri:_ P1
- **Dedicated full song-details view** — add an "open in full view" button
  (top or bottom of details) that shows only the song details. _tags:_
  [idea], [song-details], [nav] · _pri:_ P2 · _Q: full-screen route vs
  expanded panel?_
- **Mobile details must not be 2 columns** — current 2-col layout is
  unreadable on mobile (see screenshot); collapse to single column. _tags:_
  [bug], [mobile], [song-details] · _pri:_ P1

## 2. Dashboard widgets

- **Default widget order + welcome banner** — rework default widget order
  (TBD by user). Decide if the welcome banner stays; if so improve it and/or
  make it a removable widget. _tags:_ [ux], [dashboard] · _pri:_ P2 · _Q:
  final order? keep/remove/removable banner?_
- **Search bar label too long** — shorten placeholder to just "Search".
  _tags:_ [ux], [dashboard], [quick-win] · _pri:_ P3
- **Live customize mode (no popup)** — replace the customize popup with an
  in-place edit mode: press a button, drag widgets live on the dashboard,
  unused widgets shown in a tray at the bottom. _tags:_ [idea], [dashboard] ·
  _pri:_ P2
- **Next up widget — practice button** — consider adding a Practice button
  (links to the new solo Practice mode, see §15). _tags:_ [idea],
  [dashboard], [practice] · _pri:_ P3
- **Practice-time widget** — show how much solo practice time logged this
  week (depends on Practice mode tracking minutes). _tags:_ [idea],
  [dashboard], [practice] · _pri:_ P3
- **This week — hide past programs** — drop services that have already
  happened (by time). _tags:_ [ux], [dashboard] · _pri:_ P2
- **My schedule widget rework** — differentiate today (white/bigger);
  color availability (red=unavailable, amber=maybe, green=available);
  distinguish play days vs rehearsal days; clicking a day opens a modal
  (reuse the one from the schedule page); nudge to resolve a "maybe" when
  ~2 weeks out; drop the legend on the dashboard. _tags:_ [ux], [idea],
  [dashboard], [schedule] · _pri:_ P1
- **Pending requests — open setlist on click** — allow clicking through to
  the setlist. _tags:_ [idea], [dashboard] · _pri:_ P3 · _Q: in scope?_
- **Upcoming Services** — fine as-is, no action. _tags:_ [dashboard] ·
  _pri:_ P3
- **Team availability rework** — unclear target; maybe show the next month.
  _tags:_ [idea], [dashboard], [team] · _pri:_ P2 · _Q: what view/range?_
- **Recent Activity** — fine as-is, no action. _tags:_ [dashboard] · _pri:_ P3
- **Library widget unclear** — songs/setlists counts make sense, "keys"
  doesn't; widget does nothing on click. Improve or remove. _tags:_ [ux],
  [dashboard] · _pri:_ P2 · _Q: improve or cut?_
- **Sync status — not a widget** — should live in a fixed spot by default,
  not as a dashboard widget. _tags:_ [ux], [dashboard], [sync] · _pri:_ P2
- **Recently Edited — bug + copy** — possibly not showing the actually
  last-edited song; consider "last edited by" instead of artist. _tags:_
  [bug], [dashboard] · _pri:_ P1

## 3. Setlists (overview / viewer)

- **Side-peek reopens after nav round-trip** — on desktop: open a setlist →
  go to Songs library via top nav → back to setlist → it opens in the side
  peek. Regression of a supposedly-fixed bug; investigate & fix. _tags:_
  [bug], [setlists], [desktop] · _pri:_ P1
- **Mobile setlist cards too big** — rework cards (too tall to scroll); add a
  table/cards switcher like elsewhere. _tags:_ [ux], [mobile], [setlists] ·
  _pri:_ P2
- **Import setlist icon misleading** — current icon reads as "download"; pick
  a clearer one. _tags:_ [ux], [setlists], [quick-win] · _pri:_ P3 · _Q: icon
  suggestion?_
- **Overview page feels bland** — improve visual design of the setlist
  overview page. _tags:_ [ux], [setlists] · _pri:_ P2
- **Warn on editing a past setlist** — confirm dialog before editing a setlist
  whose date has passed. _tags:_ [ux], [idea], [setlists] · _pri:_ P2
- **Reposition "Edited by"** — move to bottom of page / elsewhere. _tags:_
  [ux], [setlists], [quick-win] · _pri:_ P3
- **Remove "Set Order" from inside set order; move Show details** — drop the
  redundant Set Order control; relocate the Show-details button. _tags:_
  [ux], [setlists] · _pri:_ P2
- **Structure pill in setlist song cards** — explore using the chart-view
  song-structure pill inside the song cards on the setlist overview. _tags:_
  [idea], [setlists] · _pri:_ P3
- **Share broken + remove "never" expiry** — ✅ fixed (2026-06-15): public
  share route survives onboarding; "never" removed; Play Live added. _tags:_
  [bug], [setlists], [share] · _pri:_ P1
- **Shared-viewer "Open app" → return to setlist?** — after pressing Open app,
  let the visitor get back to the shared setlist (keep the token / show a
  back affordance). _tags:_ [idea], [share] · _pri:_ P3 · _Q: in scope?_
- **Shared-viewer: tap a song to open it directly** — let a visitor jump
  straight to song N (read-only preview / start Play Live at that index).
  _tags:_ [idea], [share] · _pri:_ P3
- **Shared-viewer onboarding for "Open app"** — lightweight onboarding when a
  share visitor chooses to open the full app. _tags:_ [idea], [share],
  [onboarding] · _pri:_ P4
- **Refresh the share UI** — the read-only viewer uses an older UI; redesign
  later (user wants to keep it for now as inspiration). _tags:_ [ux], [share] ·
  _pri:_ P3
- **Rework Set order/Band + Play live/Practice buttons** — Set order/Band
  control needs rework; Play live/Practice should sit inline with Set
  order/Band. (Note: "Practice" here = group Rehearsal mode, see §15.)
  _tags:_ [ux], [setlists] · _pri:_ P2
- **Location on date line; date upper-case not caps** — move Location onto the
  same line as Date; render date in Title Case, not ALL CAPS. _tags:_ [ux],
  [setlists], [quick-win] · _pri:_ P3
- **Too many icons / bin placement** — reduce icon clutter; reconsider the
  delete (bin) icon's location. _tags:_ [ux], [setlists] · _pri:_ P3
- **Services dropdown styling** — dislike the services dropdown; confirm if
  it's custom and restyle. _tags:_ [ux], [setlists] · _pri:_ P3 · _Q: custom
  or native control?_

## 4. Setlist editor

- **Remove workspace reminder copy** — drop "workspace reminder" and "This
  setlist will be saved here" (here and in the setlist overview). _tags:_
  [ux], [setlist-editor], [quick-win] · _pri:_ P3
- **Rework Set order/Band + Draft/Ready** — rework the Set order/Band control;
  rework and relocate Draft/Ready. _tags:_ [ux], [setlist-editor] · _pri:_ P2
- **Auto-scroll on add song/break** — adding a song/break should scroll into
  view (currently doesn't). _tags:_ [bug], [setlist-editor] · _pri:_ P2
- **"Song Library" / "Recommended next" casing** — Title Case, not ALL CAPS.
  _tags:_ [ux], [setlist-editor], [quick-win] · _pri:_ P3
- **Rework Recommended-next engine + copy** — engine should weigh multiple
  song-detail fields; rewrite the description (drop the em-dash phrasing
  "Songs that flow well from the last one — by key, tempo, and freshness").
  _tags:_ [idea], [setlist-editor] · _pri:_ P2
- **Song/break cards need redesign** — cards "don't look good" (reason TBD);
  rework. _tags:_ [ux], [setlist-editor] · _pri:_ P2 · _Q: what specifically
  feels off?_
- **Delete song/break needs warning** — confirm a delete-confirmation exists.
  _tags:_ [bug], [setlist-editor] · _pri:_ P2
- **Desktop 3-pane layout** — explore: setlist details left, Current set
  right, Song library as a side panel. _tags:_ [idea], [setlist-editor],
  [desktop] · _pri:_ P2
- **Input sanitization audit (setlist editor)** — verify all inputs are
  sanitized (XSS/injection). See cross-cutting Security item. _tags:_
  [security], [setlist-editor] · _pri:_ P1

## 5. Song library

- **Unify name to "Songs"** — desktop says "Library", mobile says "Songs";
  standardize (lean: "Songs"). _tags:_ [ux], [naming], [quick-win] · _pri:_ P3
- **Table view on mobile** — add the table view to mobile. _tags:_ [idea],
  [mobile], [library] · _pri:_ P2
- **More filters** — needs additional filters (set TBD). _tags:_ [idea],
  [library] · _pri:_ P2 · _Q: which filters?_
- **Doubled mobile search (global vs in-page)** — the mobile top-bar search is
  a global cross-search (songs + setlists) meant for the Dashboard, but it also
  shows on Songs and Setlists where it duplicates each page's own search. Intent:
  on Songs/Setlists the top-bar search should scope to **that page** (filter the
  list in place); keep the global cross-search on Dashboard only. Touches
  `MobileTopBar` + the per-page list filtering. _tags:_ [bug], [ux], [mobile],
  [search] · _pri:_ P2 · _Q: keep a separate global search anywhere besides
  Dashboard?_ _(also affects §3 Setlists)_

## 6. Chart view

- **3-dots menu options cut off** — can't see all options in the overflow
  menu. _tags:_ [bug], [chart] · _pri:_ P1
- **View switch = single icon, text-only menu** — chords/lyrics/tabs/song-map
  should use one generic icon; remove per-option icons so the menu is just
  text. _tags:_ [ux], [chart] · _pri:_ P2
- **Transpose tabs** — can tab blocks be transposed? (hard). _tags:_ [idea],
  [chart], [tabs] · _pri:_ P3 · _Q: scope/feasibility spike needed_
- **Display options total rework** — blocked on the cut-off bug above; rework
  once visible. _tags:_ [ux], [chart] · _pri:_ P2
- **Layout menu total rework** — important; redesign the layout menu. _tags:_
  [ux], [chart] · _pri:_ P1

## 7. Song editor

- **New-song guardrails** — on a blank song, enforce title + key, softly
  remind bpm + time signature, and teach how to build the song structure.
  _tags:_ [idea], [ux], [song-editor], [onboarding] · _pri:_ P2
- **Missing tab block in editor** — a tab shows in chart view but is missing
  in the editor. _tags:_ [bug], [song-editor], [tabs] · _pri:_ P1
- **Input sanitization audit (song editor)** — verify inputs are sanitized.
  See cross-cutting Security item. _tags:_ [security], [song-editor] · _pri:_ P1

## 8. Team

- **Team landing page rework** — surface more about the church on the first
  page; "Invite member" shouldn't be the first thing users see. _tags:_
  [idea], [team] · _pri:_ P2
- **Collect more member info (phone, etc.)** — consider phone numbers etc.,
  visible only to leaders (GDPR-sensitive). _tags:_ [idea], [team],
  [privacy] · _pri:_ P3 · _Q: which fields, leader-only visibility?_
- **Stats & insights tab** — most/least played song & key, member with most
  appearances, etc. _tags:_ [idea], [team], [stats] · _pri:_ P2
- **Admin/leader-only Options tab** — move team settings into an
  admin-visible Options tab (maybe leader-visible extras). _tags:_ [idea],
  [team] · _pri:_ P2
- **30-day soft team deletion** — initiate a 30-day deletion window; show a
  big red banner across all menu views to all users during the window.
  _tags:_ [idea], [team], [safety] · _pri:_ P2

## 9. Help & guide

- **Iterate on help page** — keep, improve later (user to refine). _tags:_
  [idea], [help] · _pri:_ P3
- **Context-specific "?" help** — make the ? button surface help for the
  current screen. _tags:_ [idea], [help] · _pri:_ P2
- **Surface feedback prominently** — move feedback to the top of the page;
  aim for the MultiTracks help/feedback experience as the north star. _tags:_
  [idea], [help], [feedback] · _pri:_ P2

## 10. Notifications

- **Real notifications system** — huge rework: dismiss, clear-all, proper
  notification behavior. _tags:_ [idea], [notifications] · _pri:_ P2
- **Notify on schedule rejection** — especially when someone rejects a
  scheduling request. _tags:_ [idea], [notifications], [schedule] · _pri:_ P2

## 11. Settings

- **Settings rework (more settings, reorg)** — add/rearrange settings (TBD).
  _tags:_ [idea], [settings] · _pri:_ P2
- **Right pane doesn't scroll to top on section change** — switching the
  left-side setting leaves the right pane scrolled down. _tags:_ [bug],
  [settings] · _pri:_ P2
- **Mobile settings rework** — settings on mobile need rework. _tags:_ [ux],
  [mobile], [settings] · _pri:_ P2

## 12. Hamburger panel

- **Keep the hamburger panel at all?** — decide whether to keep it or move to
  a better nav model. _tags:_ [idea], [nav], [mobile] · _pri:_ P2 · _Q:
  keep vs replace?_
- **If kept, full rework** — significant redesign needed. _tags:_ [ux],
  [nav] · _pri:_ P2
- **Motivational quotes — still wanted?** — decide whether to keep them.
  _tags:_ [idea], [nav] · _pri:_ P3 · _Q: keep or drop?_

## 13. Misc bugs & ideas

- **Recent-activity false "edited song" entries** — keeps showing songs as
  edited that weren't. (Likely same root cause as Dashboard "Recently Edited"
  bug — verify together.) _tags:_ [bug], [dashboard], [activity] · _pri:_ P1
- **More uses for the floating nav FAB** — brainstorm additional actions for
  the floating nav button. _tags:_ [idea], [nav] · _pri:_ P3
- **Nav→prev/next pill morph transition** — explore the floating nav morphing
  into a next/prev-song pill, plus more transitions. _tags:_ [idea], [ux],
  [motion] · _pri:_ P3
- **North-star / niche question prompts** — user wants more probing
  questions & big-picture ideas surfaced during these sessions. _tags:_
  [idea], [process] · _pri:_ P3

## 14. Cross-cutting concerns

- **Input sanitization / injection audit (app-wide)** — audit ALL inputs
  (song editor, setlist editor, song details, team, etc.) for XSS / SQL /
  other injection. Note: song data is client-side in IndexedDB; Supabase is
  the SQL surface (auth + team_* tables) — focus there + on any
  `dangerouslySetInnerHTML`/markdown rendering. _tags:_ [security], [perf],
  [app-wide] · _pri:_ P1
- **Scale readiness (100 users × thousands of songs/setlists)** — assess
  IndexedDB load/save patterns, render perf for large libraries, team sync
  engine throughput, and Supabase row volumes/RLS query cost. _tags:_
  [perf], [scale], [app-wide] · _pri:_ P1
- **Naming consistency pass** — "Library" vs "Songs", casing (ALL CAPS vs
  Title Case) across setlist/editor headers, etc. _tags:_ [ux], [naming] ·
  _pri:_ P3

## 15. Rehearsal vs Practice modes

- **Split into two distinct modes** — rename the existing "Practice" to
  **Rehearsal** (group, tied to a setlist/service: run the set, decide
  keep/cut/swap, capture notes & cues together). Add a new **Practice** mode
  (solo at home, no setlist required: loop a section, metronome, slow-down,
  log minutes). _tags:_ [idea], [practice], [rehearsal], [setlists] · _pri:_
  P2 · _Q: confirm naming + which features land in each_
- **Practice minute tracking** — record solo practice time to feed the
  dashboard practice-time widget (§2). _tags:_ [idea], [practice] · _pri:_ P3

## 16. Member edit suggestions / approvals

- **Suggestion → approval workflow** — let members propose edits (e.g. an
  electric player adds a tab) that queue as pending and are approved by a
  leader/admin/editor before going live. Fits the v2 arrangement model: a
  suggestion is a **proposed arrangement or a proposed add-on to an existing
  one**, held in a pending state until merged — a lightweight review layer
  over arrangements. _tags:_ [idea], [team], [arrangements], [collab] ·
  _pri:_ P2 · _Q: per-field suggestions vs whole-arrangement? separate
  arrangement vs diff overlay? who can approve (admin only / leaders /
  designated editors)?_

## 17. Integrations (future horizon)

- **Projection apps** — explore linking with ProPresenter / Proclaim (push
  setlist/song order, lyrics, section cues). _tags:_ [idea], [integrations],
  [projection] · _pri:_ P3 · _Q: one-way export vs live sync?_
- **Tracks / audio cues** — explore Ableton or other multitrack/playback
  apps for tracks & audio cues tied to a setlist. _tags:_ [idea],
  [integrations], [tracks] · _pri:_ P3
- **Integrations strategy** — define the general integration surface (export
  format? webhooks? deep links?) before committing to any one partner.
  _tags:_ [idea], [integrations], [architecture] · _pri:_ P3

---

## ✅ Triaged / Planned

_Triaged 2026-06-14. Sequenced into waves by effort × value × north-star fit
(scheduling/notifications + chart-first). Waves are roughly ordered; within a
wave, items are independent and shippable on their own._

### Wave 1 — Bug sweep (verify & fix first; mostly P1)

Highest confidence-per-hour. Two of these **unblock** later epics.
_Status: implemented 2026-06-14 on `claude/zealous-mayer-jma2e8` (build green,
lint clean). Needs manual QA in-app._

- ✅ **Chart 3-dots menu cut off** (§6) — _blocker_ for the chart rework.
  Fixed: `OverflowMenu` now portals to `<body>` with fixed positioning + a
  `70vh` scroll cap, escaping the sticky-header / overflow clipping.
- ✅ **Recently-edited shows wrong "latest"** (§2.12) — fixed: Dashboard sorts
  by `updatedAt`. **Team "recent activity" false edits — also fixed (2026-06-15):**
  (a) `team-engine.pull()` now stamps the SERVER's `updated_at` onto pulled
  songs instead of `Date.now()` (via `mergeRemoteSong(serverUpdatedAt)` +
  override on the `songFromFlat` path), so synced-but-unedited songs no longer
  look freshly edited; (b) new migration
  `supabase/migrations/20260615_team_activity_skip_noop.sql` makes the
  `team_activity` trigger skip no-op UPDATEs (content+title/name unchanged).
  ⚠️ **The migration must be applied to Supabase** (`supabase db push` or SQL
  editor) for the activity-feed half to take effect.
- ✅ **Setlist side-peek reopens after nav round-trip** (§3) — fixed:
  `goToMainView` now clears `previewSongId`/`previewSetlistId`.
- ✅ **Missing tab block in editor** (§7) — fixed: added
  `parseSectionLines()` to `parser.js`; `ArrangeTabV2.handleDrawerSave` now
  re-parses drawer text (was `rawText.split('\n')`, which flattened tab
  objects to strings that vanished on the next parse).
- ✅ **Share — removed "never" expiry** (§3): dropped the `{days:0}` option.
  **Share "broken" — fixed (2026-06-15):** root cause was the onboarding gate
  overwriting `view='share-view'` on load — a shared link dumped visitors into
  onboarding → empty dashboard. Added `share-view` to the `isAuthFlow` guard in
  App.jsx so the public route survives. Also wired a **Play Live** button into
  `SharedSetlistViewer` (read-only `SetlistPlayer` over the frozen snapshot — no
  practice, no app shell, no auth), per the intended "open link → setlist +
  play live" flow.
- ✅ **Mobile song-details 2-column** (§1) — fixed: `grid-cols-1
  sm:grid-cols-2`.
- ✅ **Details panel mis-positioned** (§1) — fixed (2026-06-15): added an
  `info` slot to the shared `StageHeader` (renders directly under the
  title/meta block, above the ribbon, outside the collapse-clip) and moved
  ChartView's song-details disclosure from `extras` into it. (User confirmed it
  was still opening below the meta/ribbon after the first attempt.)
- ✅ **Settings right-pane scroll-to-top** (§11) — fixed: ref + effect resets
  `scrollTop` on panel change.
- ✅ **Auto-scroll on add song/break** (§4) — fixed; **tightened 2026-06-15:**
  the scroll anchor now sits *below* the add buttons and scrolls to `block:'end'`
  so the new card AND the add-break control are both revealed (was only nudging
  partway). ✅ **Delete confirmation** (§4) — confirm dialog added to `removeItem`.

### Wave 2 — Quick wins (low effort, batch into 1–2 small PRs)

Cheap polish + momentum. Mostly copy/casing/icons.
_Status: partially shipped 2026-06-15 (build green, lint clean). Done items
below; the rest deferred with reasons._

**Done (first pass):**
- ✅ Search placeholders — context-aware copy: mobile top bar drops "my"
  → "Search library…"; desktop Dashboard search matches. Setlists/Songs
  contexts already read "Search setlists & songs…" / "Search songs & setlists…".
- ✅ Recommended-next **copy** rewrite — removed the em-dash phrasing.
- ✅ Remove workspace reminder copy — dropped "This setlist will be saved here."
  + the workspace chip in **both** the overview and the editor.
- ✅ This-week: hide past programs — drops events past by date+time.

**Done (round 2, 2026-06-15 — addressing user feedback):**
- ✅ Heading font — "Song Library" / "Recommended next" now use the same
  `text-label-12 font-semibold` style as the Setlist-Title/Date form labels
  (no longer ALL-CAPS, matched size).
- ✅ Setlist add-scroll — anchor now has `scrollMarginBottom` so it clears the
  fixed Save/Cancel action bar (was hidden under it).
- ✅ Import-setlist icon — folder + down-arrow. **User confirmed: keep it.**
- ✅ **Naming unify → "Songs"** (§5) — desktop page title (Library.jsx), top-nav
  (TopHeader), and sidebar all now say "Songs" (mobile already did).

**Done (round 3, 2026-06-15):**
- ✅ **Mobile/tablet setlist import** — the BottomNav Setlists FAB is now a
  New/Import menu (was create-only on mobile + touch tablets; import had only
  existed on desktop and the empty state). Picks a `.zip` via a programmatic
  file input.
- ✅ **Picker sorted alphabetically** (idea §I-1) — `SetlistSongPicker` now
  sorts the library by title (was raw insertion order).
- ✅ **Desktop search placeholder parity** — Songs/Setlists pages now read
  "Search songs & setlists…" / "Search setlists & songs…" (matching mobile).
  ⚠️ **Behavior caveat:** these desktop page searches are still **page-scoped**
  (Songs page filters songs only, Setlists page setlists only); only the mobile
  top bar is truly cross-type. Making the desktop searches cross-type to honor
  the copy is the same work as the §5 "doubled search" unified-search task.

**Deferred (per user — leave for the relevant rework epic):**
- ↩️ **Location onto date line + date Title-Case** (§3) — fold into §3 overview
  redesign.
- ↩️ **Reposition "Edited by"** (§3) — its own move-task within §3.
- ↩️ **Chart view switch → single icon + text-only menu** (§6) — beta replaced
  this with `ViewModePicker`; revisit inside the §6 chart rework.

### Wave 3 — Foundations (read-only audits; no ship risk; do early)

Inform every later editor/sync change. **Full findings:
`docs/AUDIT-WAVE3-SECURITY-SCALE.md`.**

- ✅ **Input sanitization / injection audit** (§14, P1) — done 2026-06-15.
  Strong baseline, **no critical findings.** Top items: enforce CSP (currently
  report-only; blocked on PDF inline-script nonce), validate PDF-prefs + ZIP
  manifest shapes, add input maxLengths (overlaps §1 field-limits), bump share
  token entropy, make OAuth URL cleanup synchronous. No code changed yet —
  these are queued as their own small tasks.
- ✅ **Scale readiness assessment** (§14, P1) — done 2026-06-15. Well-architected
  baseline; **4 bottlenecks** at scale: (1) full-blob song saves rewrite the
  whole library per edit, (2) unbounded `team_schedules`/`team_availability`
  selects re-fetched on every realtime event, (3) missing standalone `team_id`
  index, (4) whole-library hashing each sync. **Safe quick wins** (do next):
  `team_id` indexes, `.limit()`+date-filter on those queries, realtime
  `recentlyPushed()` echo guard, `React.memo(SongCard)` + `useDeferredValue`
  search. Deeper (per-song persistence, incremental sync hash) ~3–4 days,
  schedule deliberately. No code changed yet.

### Wave 4 — North-star pillar: Scheduling & Notifications

The strategic core ("replace Planning Center"). Build as one coordinated epic.
_Started 2026-06-15._

**Status (2026-06-15): core shipped, not formally closed.** Slices 1–5 are all
done — notifications dismiss/clear + decline alerts, the My-schedule widget
(through v2), the maybe-nudge + pending click-through, the leader availability
widget, and the **Scheduling grid** (roster × every-Sunday). What's left before
calling Wave 4 *complete*: the **hardening slice** (DB trigger +
`team_notifications` table for robust, persistent read-state) and the two
**open QA decisions** below (gate/collapse `DateStatusModal`'s team list — the
**gate-for-non-leaders** decision is now confirmed and in progress). UI/UX
polish (My-Schedule v2 wider-cell look, grid mobile ergonomics) is split out
into **Slice 6**.

**Slice 1 — Notifications dismiss/clear-all + decline alerts (done):**
- ✅ Real notifications: **per-notification dismiss (×)** + **Clear all** in
  `NotificationTray`, persisted via a device-local `dismissedNotifications`
  set in settings (derived/virtual notifications stay dismissed too).
  schedule_request prompts are exempt (they resolve via Accept/Decline).
- ✅ **Notify on schedule rejection** — admins now get a "Schedule declined"
  notification when a member sets `unavailable` on an **upcoming** setlist
  (derived client-side in App.jsx; no schema change). Dismissible.
  ⚠️ _Limitation:_ only fires for setlists the client can resolve locally + in
  the future; a DB-trigger/`team_notifications` table would make it robust and
  add read-state persistence — candidate for a later slice.

**Slice 2 — My-schedule widget rework (done, 2026-06-15):**
- ✅ Today emphasis — brand ring + "Today" label + extra-bold date.
- ✅ Availability colors — unavailable=**red** (was a muted strikethrough),
  maybe=**amber**, available=**green** (matches the availability picker).
- ✅ Play vs rehearsal differentiation — a ▶ glyph for service days, a ↻ glyph
  for rehearsal days (so they're distinct beyond the amber/green tint).
- ✅ Day-click modal — every day now opens the shared `DateStatusModal`
  (setlists + rehearsals on the date, set my availability, team status), wired
  in Dashboard like Schedule.jsx. (Was: only opened a setlist if one existed.)
- ✅ Dropped the dashboard legend.
**Slice 3 — nudge + pending click-through + widget polish (done, 2026-06-15):**
- ✅ **Maybe→available nudge** (§2.5) — a "Still a maybe?" notification when the
  user has a `maybe` on a setlist coming up within 14 days; reuses the
  Accept/Decline UI (Accept→available, Decline→unavailable).
- ✅ **Pending-requests click-through** (§2.6) — tapping a pending request opens
  its setlist (Accept/Decline buttons unchanged).
- ✅ **Widget polish** — dropped the ▶/↻ glyphs; play vs rehearsal is now
  **solid card = service, dashed card = rehearsal**. Standalone `maybe`
  availability now shows **amber** (was rendering as nothing).

**Open decisions (from user QA):**
- _Q:_ `DateStatusModal` shows the **team availability list to all members**
  (no admin gate; RLS already permits read). Hide it from non-leaders, or keep
  it open? Currently kept open.
- _Q:_ With ~50 members the modal's availability list is a long scroll. Add
  grouping/collapse by status (it already sorts + shows an X/Y count)?

**Slice 4 — Team availability widget rework (done, 2026-06-15):**
Spec settled via Q&A — _next month of services × general date availability ×
leader-focused × tap-through._ Implementation:
- ✅ Leader-only widget (`isAdmin`); lists the next ~month of services (max 6).
- ✅ Each row shows team **date availability** for that service's date
  (in / maybe / out / no-reply) from `team_availability`.
- ✅ **"Needs cover"** badge flags gaps (nobody confirmed, or confirmed < half
  the team) — the spot-gaps goal.
- ✅ Tapping a service opens the day `DateStatusModal` (detail/roster) +
  a "Full schedule" link in the header.

**Remaining slices:**
- Harden decline alerts + maybe-nudge with a DB trigger + a `team_notifications`
  table (persistent read/dismiss, robust resolution) — the deeper version of
  slices 1 & 3.
- _(Open from QA)_ optionally gate `DateStatusModal`'s team list to leaders;
  group/collapse it at ~50 members.

**Slice 5 (2026-06-15) — My-Schedule v2 ✅ + Scheduling grid ✅ (both built).**
Decisions from user Q&A:

- **Consistent color language (app-wide):** color = **my status only** —
  green=available, amber=maybe, red=unavailable, neutral=no-response, plus a
  distinct **playing/rostered** treatment. **Event type (service/rehearsal) is
  never color** — show it as text/icon. _Implication:_ recolor the "This week"
  Service/Rehearsal badges to neutral/outline (the text already says which),
  so green/amber stop doubling as event-type.
- **My-Schedule day strip → calendar-style cells (idea #3):** event days are
  larger and show the event **name** inside (e.g. "BBPT #403 AM") + a small
  type label/icon; availability-only days stay compact chips. Today keeps its
  ring. Fixes the dashed-border bug by removing the dashed cue entirely.
- **New separate "Scheduling" page** (working name; "Rota" is the alt): a
  spreadsheet grid — **members down the left, dates across the top**. Header
  rows carry the date + program description (e.g. "Doar AM", "PM: Duminica
  familiei").
- **Columns are data-driven, not a rigid AM/PM toggle.** Columns = the team's
  actual scheduled services in the visible date range; each service is an event
  with a *date + name*, so "AM only", "AM+PM", "two AMs", "midweek youth" all
  fall out for free, labeled by the service's own name. (Later: optional
  team-defined recurring templates that auto-create those events.)
- **Combined cells:** a cell shows the assigned **role** when the member is
  rostered, otherwise their **availability** (available/maybe/unavailable).
  **Roles come from each member's `team_members.instruments`** (voce, chitară,
  pian, tobe, bass, chitară el.…); a rostered/selected member uses a
  **purpleish** cell fill. Leaders assign roles; members mark availability —
  **same grid, both read + inline edit from day one**, permission-gated.
  - Data wiring: `team_schedules` (roles) × `team_availability` (status). Large
    build — sequence **after** My-Schedule v2.
  - **Built:** `src/components/SchedulingGrid.jsx`, view `'scheduling'` in
    App.jsx, reached via a **Grid** button on the Schedule page header. Members
    down the left × columns = **every Sunday this year merged with the team's
    dated services** (AM/PM/midweek each get their own column). Sundays with no
    service are **scaffold columns** with **"+ Add setlist"** that seeds the
    SetlistBuilder with that date (`goSetlistBuild({ date })`).
  - Cell tap opens a sheet: leaders assign **Instrument** (purple chip, sourced
    from each member's `instruments`) **and Vocals** (`vocal_part`, brand chip);
    members set their own availability (green/amber/red). No status dot on chips.
    Roles/vocals write `team_schedules` via `useTeamSchedules` (setlist UUID via
    `useTeamSetlistMap`); availability via `useTeamAvailability`. Realtime +
    optimistic through the existing hooks.
  - _Follow-ups:_ leader-edits-others' availability (RLS currently own-row
    only), optional recurring-service templates / non-Sunday recurrence,
    next-year roll-over. _(The two UI/UX polish items moved to **Slice 6**.)_

**Slice 6 — UI/UX polish (UI/UX work; not started).**
A grab-bag of look-and-feel refinement carried out of the scheduling build:
- **My-Schedule v2 wider event cells** — user is undecided on the look. Explore
  an alternative: keep every day a uniform compact chip and show the event name
  as a small caption beneath, so the strip stays even instead of mixing
  chip + wide-card widths.
- **Scheduling grid mobile-narrow ergonomics** — the members × Sundays grid is
  wide; needs phone polish (sticky-column sizing, tap targets, horizontal-scroll
  affordance, maybe a condensed/by-service mobile view).

### Wave 5 — Audit remediation (security + scale)

From the Wave 3 audits (`docs/AUDIT-WAVE3-SECURITY-SCALE.md`). Grouped into a
safe quick-win batch and deeper scheduled work.

**Quick wins (small, safe, high value — do as one batch):**
- **Scale:** add standalone `team_id` indexes on `team_songs` + `team_setlists`
  (1 migration); add `.limit()` + date-range filter to
  `useTeamSchedules`/`useTeamAvailability`; call the existing
  `recentlyPushed()` guard in `useTeamRealtime` (kills redundant full syncs);
  `React.memo(SongCard)` + `useDeferredValue` on Library search.
- **Security:** add `maxLength` to text inputs (song title/artist/notes,
  setlist name — also satisfies §1 field-limits); validate PDF-prefs + ZIP
  manifest shapes; bump share-token entropy + raise the regex minimum; make
  the OAuth URL cleanup synchronous.

**Deeper (schedule deliberately, ~3–4 days + a CSP pass):**
- **Scale:** per-song IndexedDB persistence (stop rewriting the whole library
  blob per edit); incremental sync hashing (cache per-song hash / server
  content-hash); batch the team-engine push loop.
- **Security:** add the PDF inline-script nonce, then flip `vercel.json` CSP
  from report-only to enforcing; `team_activity` retention policy.

### Wave 6 — UX epics (bigger, mostly independent)

- **Chart display-options + layout-menu rework** (§6) — _after_ Wave 1 3-dots
  fix.
- Setlist overview redesign + buttons rework (§3); desktop 3-pane setlist
  editor (§4); Recommended-next **engine** rework (§4); song/break card
  redesign (§4).
- Dashboard: live customize mode + widget reorder/removal, welcome banner
  decision, Library-widget improve-or-cut, sync-status de-widgetized (§2).
- Team: landing rework, stats tab, admin Options tab, 30-day soft deletion,
  extra member info (§8).
- Mobile: setlist cards + table/card switcher, mobile table view for songs,
  mobile settings rework (§3, §5, §11).
- Song details: full view + rich Story-behind editor + field limits (§1).
- Song-editor new-song guardrails (§7).
- Help: context-specific "?" + surface feedback (MultiTracks north star) (§9).
- Hamburger panel: keep-vs-replace decision, then rework (§12).
- **Rehearsal vs Practice split** (§15) — rename current → Rehearsal, add solo
  Practice + minute tracking + dashboard widget.

### Wave 7 — Anchor epic (deepest; schedule deliberately)

- **Member suggestions / approvals** (§16) — touches arrangements + team roles
  + notifications. Natural integration point that ties Wave 4 together; do it
  *after* notifications exist so approvals have a delivery channel.

### Wave 8 — Future horizon

- Integrations: projection (ProPresenter/Proclaim), tracks (Ableton), and the
  integration-strategy item first (§17).
- Transpose-tabs feasibility spike (§6); FAB ideas + motion transitions (§13).

### Recommended first move

1. **Wave 1 bug sweep**, leading with the **3-dots cut-off** (unblocks the
   chart epic), **recently-edited false edits**, and **side-peek reopen** —
   fast, high-trust wins.
2. Kick off **Wave 3 audits in parallel** (read-only, zero ship risk).
3. Then bank the **Wave 2 quick-wins** batch for visible momentum.
4. *Then* commit to the **Scheduling & Notifications pillar** (Wave 4) as the
   first real feature epic — it's the north star, and it's the prerequisite
   for the suggestions/approvals anchor (Wave 6).

---

## 19. Carried over from the earlier `beta` backlog

Folded in when this branch was rebased onto `beta` (the prior backlog file
already had these). Kept verbatim so nothing is lost; cross-references to the
sections above noted in brackets.

### Open questions / decisions
- `[team]` Rehearsal/setlist notes editable by any member? Today shared notes
  live on team_songs/team_setlists which are admin-only write (RLS), so members
  can't edit shared cues — they only get a private "My note". Decide: RLS change
  to allow member note writes, a separate notes table, or leave as-is.
  _(relates to §16 member suggestions/approvals)_

### Parked / later
- `[chart][practice][live]` Header improvement menu (not yet built): transpose
  stepper + capo pill, Practice quick-actions (capo, new-arrangement-from-
  current, add-cue), Live auto-scroll + metronome, Chart "Play" emphasis.
  _(relates to §6 chart display/layout rework, §15 rehearsal/practice)_
- `[dashboard]` Drag-handle reorder for widgets (currently up/down arrows).
  _(relates to §2 live customize mode)_
- `[dashboard]` More widgets: Quick actions tiles, Suggested songs.
- `[auth]` Re-add Google sign-in once OAuth is wired; caps-lock warning; a
  dedicated post-signup "check your email" panel.
- `[chart][practice][live]` Re-think how Customize options are split (don't dump
  everything into one sheet) — group by Display / Layout / Actions.
  _(relates to §6 display-options rework)_
