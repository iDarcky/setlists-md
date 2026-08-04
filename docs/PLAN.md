# Setlists.md — Roadmap

> **The single sequenced plan.** What to do, in what order, and why. Replaces
> the old area-grouped plan (which said what was wrong but never what was next).
>
> _Last updated: 2026-07-30 · Version `0.17.0-beta.25` on `beta` · Target: **public beta October 1**._

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

**Just landed:** the **Reader** — elements 1–13, behind the Labs flag
`unifiedReader`. Its decision log is `docs/READER.md`; read that before touching
any of it. Also landed: the component-architecture foundation (§3.1, all ✅).

> **Owner's call, 2026-07-30:** *"finish the reader and look at the 🔴 to fix
> them and then stop for a bit with the changes and look at the plan and go from
> there."*
>
> **Scope rule, agreed 2026-07-30:** new ideas get NOTED here and are not
> worked on until this block is done, unless they are a P0 blocker. The goal
> that ends the freeze: **🔴 list clear · reader finished · flag graduated ·
> the four old surfaces deleted.**
>
> That is §1.1 → §1.2 → §1.3 below, in that order. The router, Stream A and the
> component passes are **explicitly parked** until §1.3 — they were the previous
> "next three" and they are still right, just not next.

### 1.1 Finish the Reader

> **The element-by-element pass is what "finish the reader" now means**
> (owner, 2026-08-03: *"I want to go through every element one by one and
> improve it"*). One element per session-ish, questions batched and answered
> **before** anything is built, every round shipped to the feature branch and
> tested on a phone. `docs/READER.md` is the log.
>
> | | |
> |---|---|
> | **Closed** | **1 — top bar** ✅ 2026-08-04, after eleven rounds. It turned out to contain all of **edit mode** (orange chrome, structure editing from the song map, per-section lyric editing, chord replacement, undo, New version, pull-to-finish), the set bar's progress line, the chrome's real height, and the rail's toggle. |
> | **Next** | **28 — the ☰ menu** (owner: *"don't you think that ☰ should be an element in its own right?"*). Brief: `READER.md` → "The ☰ menu — what actually belongs in it". |
> | **Then** | **29 — the setlist rail** (*"it will require some work in the future. Not quite now."*) · **2** — the structure ribbon, mostly settled by edit mode · then the 14–27 table. |
>
> Two things carried out of element 1 and are NOT part of it: the **chord-model
> unification** (§7 #13) and **draggable song sections** (§7 #14, prio 2).

The four items below predate the element pass. None is a new design round; each
is a correction or a promise already made.

1. 🔴 **The metronome must not start on tap** (element 12). The icon should open
   the practice row; the row's own play button starts the click. Shipped wrong in
   `0.17.0-beta.21` — two owner answers conflicted ("icon opens it" vs "the row
   appears once the click starts") and the conflict was resolved the wrong way.
2. 🔴 **The practice row is too long on a phone.** ❓ Needs a decision first —
   §7 #10.
3. 🟡 **A divider between the top bar and the structure ribbon** — a hairline,
   lighter than the Score mockup's, which is the mockup element 2's geometry
   already came from.
4. 🔴 **Graduate the flag, then delete.** Wire `FullscreenChartViewer` as a thin
   wrapper over `Reader` (**not** a fork), flip `unifiedReader` on by default,
   then delete `SetlistPlayer`, `PerformanceView`, `PracticeView`, `LiveFinale`
   and `PracticeFinale` — ~2,800 lines of triplicated state. `ChartView` stays;
   the Song Hub embeds it. **Do §1.2 #3 first** — the Song Hub bugs below are in
   the surface that survives the deletion.

**Not part of finishing the reader**, though they came in with it: how many
reading modes there really are (§7 #11) and editing from the reader (§7 #12).
Both are new design rounds and belong after §1.3.

### 1.2 🔴 Clear these, in this order

> ### ⚠ THE SONG HUB RENDERS `Reader`, NOT `ChartView`
> `SongHub.jsx` branches on the `unifiedReader` Labs flag: flag ON → `<Reader
> embedded>`, flag OFF → `<ChartView embedded>`. Two rounds of hub fixes went
> into `ChartView` and changed nothing the owner could see, because the owner
> tests with the flag ON. **Before fixing anything "in the Song Hub", check
> which branch you are in.** The same trap is waiting in the editor preview and
> the side peek.
>
> **And the hub's own CARD is a third place.** `SongHub.jsx` painted the wrapper
> the tabs sit in with `--chart-bg`/`--chart-text`, so a light chart theme put a
> cream band across a dark app no matter what the reader inside did. Theme bugs
> "in the hub" can live in the reader, the chart, OR the card. Check all three.


Ordered by severity × confidence. The first is unverified and could be the most
serious thing in this document; the last two are blocked on you.

1. ✅ **Members can edit songs — CHECKED AND FIXED** (beta.28). The owner
   verified the UI: buttons are hidden for members. The code check found the
   real gap — `handleSaveSong` was guarded but `handleDeleteSong`,
   `handleDeleteSongs`, `handleUpdateSong` and `handleUpdateSetlist` were not.
   The sync engine already refuses to PUSH a member's write, which is the worse
   failure: the write lands in local state, looks saved, and is silently
   reverted by the next pull. All four now refuse with a toast, and both
   useCallbacks carry `isTeamReadOnly` so a demoted member can't slip through a
   stale closure.
2. ✅ **Print / Save as PDF — FIXED** (beta.28 + beta.29), confirmed working by
   the owner. Root cause was NOT the CSP: `vite.config.js` had
   `globIgnores: ['**/pdf-*.js']` to keep the lazy pdf.js chunk out of the
   precache, and that glob also matched `/pdf-print.js`, the public script that
   wires the preview's controls. It was silently excluded, so the in-document
   buttons were dead in the installed PWA while the app-side Done/Print worked.
   Scoped to `assets/`. Also: the controls script now loads from an absolute
   URL (the export lives in `<iframe srcdoc>`, where relative resolution is
   engine-dependent), and the duplicated Print/Close inside the document are
   gone. **The wider PDF export overhaul is still open** — see §6.
3. 🔴 **The Song Hub — two separate bugs, one report.**
   - **Song map is unreachable.** Confirmed: the view-mode picker (Chords /
     Lyrics only / Song map / Chords only) lives in `StageHeader`'s overflow menu
     at `ChartView.jsx:443`, guarded by `!isPreview && !embedded`. The hub embeds
     `ChartView`, so it never renders. This is the documented-but-never-done half
     of the reader rework: `CLAUDE.md` says view modes are "slated to move into
     `FullscreenChartViewer`". Nothing moved, so Song map is currently reachable
     from **nowhere** except the old surfaces §1.1 #4 deletes.
   - **Chart and Lyrics tabs render the same.** NOT confirmed. `SongHub.jsx:129`
     looks correct. Suspect the `showChords` setting (`ChartView.jsx:840`) being
     off, which would make the Chart tab lyrics-only. Needs a repro on a fresh
     profile.
3b. 🟡 **The hub's Aa menu is mostly dead with the flag on.** Found while
   measuring for element 28 (2026-08-04) and **deliberately parked** — owner:
   *"right now we are trying to improve the reader views not the hub, so note it
   for later in the plan."* Seven of its twelve controls do nothing in the hub,
   two of them showing a number that will not move when you press `+`, and it
   also lost the per-tab Reset and the Advanced dialog that `ChartView` still
   passes it. The full control-by-control table is in `docs/READER.md` →
   "Element 28, round 1". **The fix is to cut the menu down to what works, NOT
   to reconnect `HUB_VIEW` to `settings`** — that is the bug that turned the
   hub's Chart tab into a second Lyrics tab.
3c. 🔴 **You cannot type a space into a band cue, or an inline note.** Reported
   by the owner 2026-08-04; root cause found by reading, not yet fixed (he asked
   for it to be noted, prio 1). The cue field is `ArrangeTabV2.jsx:1332`; every
   keystroke calls `emitSong`, which does `songToMd()` → `onChange(md)` → the
   editor re-parses → **`parser.js:96` runs `.trim()` on the cue**. The trailing
   space is deleted before it can become a word boundary, so you can type one
   word and no more. `parser.js:540` does the same to `{!inline notes}`, so #2
   is almost certainly the identical bug. Fix at the parse boundary, not in the
   input — trimming on parse is right for a file, wrong for a keystroke.
3d. 🟡 **Add a band cue / inline note from the SONG HUB**, without opening the
   editor (owner, 2026-08-04, prio 1). Pairs with 3c: the field you would be
   typing into is the one that eats spaces.
4. 🔴 **The active-section highlight is wrong when the song fits on screen.**
   Confirmed, one line. `src/hooks/useActiveSection.js` has a "near the bottom,
   snap to the last section" rule:
   `if (root.scrollTop + root.clientHeight >= root.scrollHeight - 16) current = lastIdx;`
   With no scrollable overflow that is **true on the first frame**, so the last
   section lights up immediately. Gate it on the content actually being
   scrollable. Note this hits the **structure ribbon too**, not just the song
   map — same hook, every surface.
5. 🔴 **The Song Hub chart and the editor preview must follow the APP theme.**
   Not an open question: `docs/READER.md` already records the decision — "a white
   chart card sitting inside a dark app reads as broken rather than as a stage" —
   and the code disagrees with it. A bug against a written decision.
6. 🔴 **Prod-only sync loop** (2026-07-30) — **still open, and SPREADING: 2 → 4
   songs between two runs.** Ruled out so far: the `.md` round-trip (frontmatter
   keys ARE lowercased at `parser.js:34`, so `originaltitle` reads back fine) and
   the push not recording `updated_at` (`team-engine.js` stores `data.updated_at`
   from the push response). The live clue is that the toast says *"Uploaded 4
   songs"* while Sync Doctor calls the same 4 *"newer on the server"* — we push,
   then immediately consider the result foreign. Prime suspect now: **array-valued
   extra-meta fields don't round-trip.** `writers`, `themes`, `genres` are arrays;
   `parser.js:203` coerces with `String(meta[k])`, so `['A','B']` becomes `"A,B"`
   and re-serializes differently from what the server holds — permanent drift, and
   the drift list (`writers`, `language`, `year`, `originaltitle`) is entirely
   extra-meta. To confirm: open one drifting song and check whether `writers` is
   an array locally. **Do not delete the songs** — nothing is corrupt, they just
   never converge. Old §1.2 note below.
   BLOCKED-on-you remainder: Prod-but-not-beta
   means data or schema, not code, so there is nothing to read in the diff. Run
   Settings → Sync → **Sync Doctor** in the affected Space; it re-runs the
   engine's exact hash arithmetic per song and names the drifting field. Paste
   its output. Do not guess at this one — see `CLAUDE.md`'s note on canonical-hash
   baseline drift.
7. 🟡 **The editor's `+` button renders over the chords** (screenshot, 2026-07-30).
   Small and visible.
8. 🟡 **Setlist editor: "Clean" and "Remove" both become "Remove", both red.**
9. 🟡 **YouTube cover art not loading.** CSP is **not** the cause — `vercel.json`
   allows `https://*.ytimg.com` and `coverArt.js:28` builds
   `https://i.ytimg.com/vi/<id>/hqdefault.jpg`. Suspect `youtubeId()` failing on
   `youtu.be` / `/shorts/` / extra params, or `hqdefault` 404ing. **Needs one
   failing URL from you.**
10. 🟡 **Odd numbers when dragging a song over a break** in the setlist editor.
    **Needs a repro.** The only number in the break row is the note character
    counter (`SetlistItemRow.jsx:124`), which sits on the notes *button* and only
    renders when a note exists — that does not match "over the text box".

### 1.2b Straight after the Reader — in this order

1. 🔴 **Rethink the colours across every theme** (owner, 2026-08-01, *prio 1*).
   Two fixes landed piecemeal — the dark ramp's hue was fighting its own
   background, and Midnight tinted only half its scale — which is evidence the
   themes were never designed as a set. What this pass owes: one method for
   deriving a theme (ground → chrome ramp → text ramp → accent → chord), every
   app theme and every **chart** theme rebuilt through it, and a check that the
   accent-colour setting reaches everything it should. The `color-mix` brand
   derivation (2026-08-01) is the first piece of that method, not the end of it.
2. 🟡 **Custom chord shapes** (owner, 2026-08-01). `data/chordShapes.js` holds
   ~50 worship voicings; element 11's tap-a-chord popover has nothing to show
   for anything outside that list. Let users add a shape for a chord that has
   none.
3. 🟡 **Separate volume for the click and the backing track** (owner,
   2026-08-01, "for the future"). Element 12 has one `gain` constant for the
   click and no control at all for the track. Practising with a track means
   riding the click under it, and today the only lever is the device volume,
   which moves both.

### 1.3 Then stop, and re-plan from this file

By the owner's decision, no new feature work between §1.2 and this point. When
the list above is clear, come back here and pick the next block. The three that
were queued before this batch, still in order:

1. **Adopt a router** (§3.1) — the blocker for the rest of the App.jsx split,
   not a nice-to-have. Deleting the hand-rolled history stack is what makes
   navigation, song CRUD and the route table separable at all.
2. **Setlist-builder tests** (§3.2) — the other surface where a bug silently
   destroys user work.
3. **Start Stream A** (§2) — the domain split gates email, which gates OAuth. It
   has a queue, so August is already late. **This is still the only thing that
   can make October 1 not happen.**

**Design calls waiting on you** before their work can start: §7 #8–9 (design
system) and the three new ones, §7 #10–12.

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
- [ ] ⏭️ **Staging environment — DEFERRED (2026-07-27): no budget.** There is
      ONE Supabase project and it is production, so "test on beta" = "test on
      live church data". Needs Supabase Pro (~$25/mo). Deferred deliberately,
      not forgotten. **While deferred, the mitigation is a rule, not a tool:
      every migration must be additive and backward-compatible — no dropped
      columns, no renames, no destructive backfills** — because there is no
      second copy to get it wrong on. Revisit when there's revenue.
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

### 2.3b 🟡 Settings restructure (pre-beta)

Settings grew by accretion: four groups (Account / Display / Sync & data /
About) holding fifteen panels, with related things far apart and some
preferences reachable from nowhere at all.

**Regroup around what the user is trying to do, not where the code lives:**

| Group | Panels |
| :--- | :--- |
| **You** | Account · Plan & billing · Notifications |
| **Reading** | Chart defaults · Chart style (Pro) · Sections (Pro) · **Stage & pedals** (new) |
| **App** | Appearance (theme, accent, language) · General (landing page, week start, clock) · **Shortcuts & devices** (new) |
| **Workspace** | Cloud sync · Services · Team defaults (incl. the promoted overschedule warning) |
| **Data** | Backup / export · Trash · Storage usage |
| **About** | What's New · Labs · About · Help · Legal |

**Missing settings — found by auditing every stored preference against the UI
that can change it.** 21 preferences have no panel in Settings; most are fine
because another surface owns them (the Aa menu owns chart colours and fonts,
`ColumnsMenu` owns `tableColumns`, the dashboard owns its widget order). These
are the genuinely broken ones:

- 🔴 **Bluetooth pedal keys (`pedalNext` / `pedalPrev`) — worse than missing.**
  They have defaults in `storage.js` (`ArrowRight` / `ArrowLeft`), they sync to
  the cloud, there is **no UI to change them, and no code reads them.**
  `PerformanceView`, `PracticeView` and `SetlistPlayer` each hardcode
  Arrow/PageUp/PageDown. So a pedal that sends Space, Enter or anything else
  simply doesn't work and the user cannot fix it. Needs both a settings panel
  (press-a-key-to-bind) *and* the three keydown handlers to honour it.
- 🔴 **`chartBg` / `chartText` are read by nothing at all** — dead preferences
  that still sync. Either wire them into the chart theme or delete the keys.
- ⬜ **Settings search** — fifteen panels is past the point where scanning works.
- ⬜ **Reset to defaults** — per panel, and one global.
- ⬜ **Confirm-before-delete** exists as a key (`confirmBeforeDelete`); make sure
  it has a visible home in the new grouping.
- ⬜ **Metronome defaults** (volume, count-in) — needed once Practice ships.
- ⬜ **Default arrangement / default key behaviour** on opening a song.
- ⬜ **Storage usage + "make offline available"** — a PWA should say how much
  room it's using and let the user free it.
- ⬜ **Text size / reduced motion** accessibility toggles.

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
- [~] 🟡 **Split `App.jsx` (COMPONENTS §1.1) — started, 3,168 → 2,823.**
      Extracted the three concerns that were genuinely independent:
      `app/usePreferenceSync.js`, `app/useNotificationFeed.js`,
      `app/useAppearance.js`.
      **Stopped deliberately.** The remaining concerns share App's state rather
      than sitting beside it — navigation alone touches 11 state fields, so a
      hook would take ~22 parameters and be *worse* than the monolith. They
      need the router and a library context first, not more prop-drilling.
      See COMPONENTS §1.1.
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

- [x] ✅ **Harness in place.** `@testing-library/react` + jsdom + `fake-indexeddb`,
      split into two vitest projects so the logic suites stay in node
      (`.test.js` = logic/node, `.test.jsx` = render/jsdom). Booting jsdom for
      everything cost ~12s of an otherwise 3s run, and a slow suite is one
      people stop running. Setup notes and the jsdom `env()`-in-`calc()`
      workaround are in `vitest.setup.js`.
- [x] ✅ **First render tests: the editor save path**
      (`src/__tests__/editor-save.test.jsx`) — content survives a save, parser
      defaults don't overwrite real metadata, and an unchanged song can't be
      saved. Both content assertions were **mutation-checked**: breaking the
      save path in the two ways that shipped in 0.17.0-beta.2 turns them red.
- [ ] Next: **setlist builder** — the other surface where a bug destroys work
      silently.
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

**7 Labs flags, one graduated.** Each is a live fork, and the two most
important (`addSongModal`, `pasteIntoChart`) are **off by default** — so the
paste and import flows you're actively developing are not the ones users get.

- [ ] **Set a graduation date per flag. Delete the losing path the day it graduates.**
- [x] ✅ `addSongModal` graduated (its legacy modal is deleted), which also fixed
      PDF import for everyone.

**Verdict per remaining flag (decided with the owner, 2026-07-27):**

| Flag | Verdict | Why / when |
| :--- | :--- | :--- |
| `rosterOverscheduleWarning` | **Promote to Settings** | It's a real preference, not an experiment. Move it into the Team/Scheduling group. |
| `structurePosition` + `ribbonStyle` (floating ribbon) | **Hold — decide in the chart rework** | Where the ribbon lives is part of the reading-view design, so it can't be settled before that pass. |
| `mockupPalette` (neutral palette) | **Hold — tied to the colour rework** | Belongs with the accent-colour work below, not decided alone. |
| `songsLibraryPlus` / `setlistsLibraryPlus` | **Hold — needs thought** | Folds into the reworked single list view. |
| `hmMenu` (hamburger) | **Hold** | The keep-or-replace decision is still open. |
| `accountPanel` (iOS-style) | **Hold — not yet** | Revisit in the Settings rework. |
| `pasteIntoChart` | **Undecided** | Use it for a week, then graduate or kill. |

**Related, deferred but recorded — the accent colour doesn't actually apply.**
`accentColor` is a setting, but a lot of the app's green is hardcoded rather
than reading the token (e.g. the bars in the setlist overview). Choosing an
accent colour therefore only half-works. Fixing it means auditing every literal
green against `--color-brand`. Not urgent, but it makes the setting feel broken,
so it should land with the colour/palette rework.

### 3.6 Dead paths to delete on sight

Each doubles the work of the pass that touches it.

- [x] ✅ `SetlistOverviewV2` + the `cards={false}` escape hatch — deleted. The
      cards viewer took over the `SetlistOverview` name, so the experiment's
      naming is gone too.
- [x] ✅ The legacy editor layout — deleted. `cardsHeader` was hardcoded `true`,
      so every `!cardsHeader` branch was unreachable. Removing it cascaded into
      ~20 further dead declarations that existed only to feed it:
      1,789 → 1,423 lines.
- [x] ✅ `NewSongModal` — deleted, which **graduates `addSongModal`**. Everyone
      now gets the single add-a-song surface, and **PDF import works for
      everyone** (it only ever worked with that flag on).
- [ ] `Button2` + `PageHeaderLegacy` — now isolated in `features/design/`;
      nothing but the showcase imports them. Deleting is a decision about the
      showcase, not a refactor.

### 3.7 Cross-cutting, cheapest during each pass

- [ ] 🟡 **"Are you sure you want to leave?"** — a dirty-state guard on the song
      AND setlist editors, covering browser back, refresh and tab switches. Real
      data loss, flagged in the owner's June note and **still open**. Do it once,
      centrally, rather than per editor.
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

> **Provenance.** Two inboxes were triaged into this section and can be thrown
> away: the owner's **2026-07-30** list of 20 points (the 🔴s from it are
> sequenced in §1.2; the rest are filed below), and the **June `Ideas_and_bugs.md`
> note**. Of that older note, these shipped in the meantime and need no further
> tracking: notes per setlist/song/user, zip export, tags vs service, chord
> diagrams on tap (element 11), chord notation incl. Nashville, condensed
> sections, the plan hierarchy, church logo, rehearsal booking + push. These were
> **superseded by the Reader** (elements 1–13): edit layout from live, a better
> customisation button, "top bar ruins everything", scrollable structure, a
> separate live view, and "rehearsal mode" — except its *editing* half, which is
> real and is §7 #12.

Detail that belongs to a component pass. When you start a pass, read its section
here first. Nothing in this section is scheduled on its own.

### Song details
- ❓ **Capo: per-user rather than per-song?** A capo position belongs to the instrumentalist, not the song. Undecided since the June note; would need a per-user store.
- Rich editor for **Story-behind** (breaks-style) ❓ both Story and Notes, or just Story?
- Dedicated full song-details view ❓ route or expanded panel?
- Field char limits (Themes/Genres/Verses/Moment/Tags) ❓ cap which?

### Song editor
- 🟡 The `+` button renders over the chords (2026-07-30) — see §1.2 #7.
- ⬜ The blank/paste new-song flow is still unfinished (2026-07-30).
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
- ⬜ **Ship the curated worship section-type list as defaults** — Selah, Free
  Worship, Big Chorus, Tag, Vamp, Doxology, Spontaneous… `customSectionTypes`
  already lets users add their own, so this is a data change, not a feature: a
  small edit with an outsized effect on how "built for worship" the app feels.
  List is in the owner's June note.
- 🟡 The whole **Aa menu needs a rework** — acknowledged 2026-07-30, deliberately not yet.
- ⬜ Metronome options, if any: **tap tempo** (musicians expect it; beats a stepper for finding a feel) and **count-in** (cut from element 12; it is what makes a click usable for *starting* a song rather than checking tempo). Everything else — subdivisions, sounds, volume — is knobs nobody asked for.
- **Collapsed-header top gap (tablet)** — content scrolls into the strip above the structure ribbon; extend the header background to cover the safe-area inset.
- Dual `F#/Gb` labels in the **chart** transpose dropdown (editor done).
- **Chord fingering diagrams have no control** — the Aa toggle was pulled; rendering + `showDiagrams` still exist, and it's now lazy-loaded. Reinstate a control, likely in the fullscreen viewer.
- **Hub fullscreen viewer** is a scaffold — bring the chart **view modes** and live controls (auto-scroll, metronome, font stepping) into it.
- **Chart theme that follows the app theme** — auto-track light/dark instead of a fixed palette.
- **Section default colours** (`SECTION_COLORS`) need a cohesive pass — they drive labels, song-map chips and section cards.
- **Theme audit**: white-on-white rows in dark chart themes; ribbon pills don't track section colours; floating-structure legibility per theme.
- Transpose tabs ❓ feasibility spike.

### Song library
- 🟡 **Download a song** — from the song page and from the library (owner calls it prio 1, 2026-07-30). Export already exists for setlists (.zip); this is the single-song equivalent.
- 🟡 **The side peek should be shorter than the row it opened from** (2026-07-30) — so you can open it, read it, and click outside to dismiss without moving the mouse. Part of the side-peek decision in §1.1.
- ⬜ Show the item COUNT on the songs library (2026-07-30, parked by the scope rule).
- 🟡 **Surface the trash where a deletion is actually noticed** (2026-07-31, from reader element 14). The 30-day song bin already exists and works — but it is reachable ONLY from Settings → Data, which is nowhere near the two places you find out a song is gone: a setlist item pointing at a deleted song, and the library right after a delete. Two cheap wins: (a) the reader's missing-song screen offers **Restore** when the id is in the trash (element 14 covers this); (b) an **Undo** on the delete toast. Neither needs new storage.
- [x] ✅ **Compact removed (2026-07-27).** The third mode is gone from both
  switchers; a stored `'compact'` resolves to the card list. Songs and Setlists
  now offer Table (desktop) and Cards, nothing else.
  **Leftover, deliberate:** `SongCard`/`SetlistCard` still accept
  `variant="compact"`. Nothing selects it, so it's unreachable — kept on purpose
  as the raw material for the reworked single list view (density as a property
  of the row). Delete it in the library pass if that rework goes another way.
- **Doubled mobile search** — the global cross-search also shows on Songs/Setlists where it duplicates the page's own. Scope it to the page there, keep global on Dashboard + ⌘K.
- **Setlist search by contained song** — match song titles inside each setlist's items.
- Drag-to-**reorder** table columns (show/hide shipped).

### Setlists — overview & viewer
- ⬜ Show the item COUNT on the setlists library (2026-07-30, parked).
- 🟡 **Paginate setlists, truncating the PAST.** Deliberately not done in beta.27: setlists already sort before rendering so they have no ordering bug, and a naive cap makes the Upcoming/Past group counts lie. But the owner's question is the right one — a church with 300+ setlists loads and lays out all of them. The shape that works: keep Upcoming whole (small, and the part people act on) and page the Past. (2026-07-30)
- ⬜ Dots at the foot of the page showing how many items are in the set (June note, undecided).
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
- 🟡 "Clean"/"Remove" → both "Remove", both red (2026-07-30) — §1.2 #8.
- 🟡 Odd numbers when dragging a song over a break; needs a repro (2026-07-30) — §1.2 #10.
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
- ⬜ A weekly-practice widget, GitHub-contributions style (2026-07-30). Genuinely motivating for members; strictly a "nice" behind the 🔴s.
- **Live customize mode** (drag widgets in place, tray for unused).
- Default widget order + welcome-banner decision ❓ keep/remove/removable?
- **Library widget** — improve or cut ("keys" stat unclear; no-op on click).
- **Sync status** — fixed spot, not a widget.
- Search placeholder → just "Search".
- Next-up Practice button + practice-time widget (depends on Practice mode).

### Team
- 🟡 The add-to-band picker renders the WHOLE band; cap it at 5–10 then scroll. Its filters/settings need a redesign (2026-07-30).
- 🟡 **Post-service feedback, leaders-only** — DEFERRED, and the reason matters:
  the writing half was built and shipped (a reflection box on the reader's
  finale, backed by a `team_setlist_notes` table with admin-only RLS), then
  **removed** because there is nowhere for a leader to READ it later. A note you
  can write and never find again is half a feature, and the missing half — a
  place per setlist (or in the Team screen) where past feedback is listed — is
  the larger build. Pick that surface FIRST, then restore the writing side.
  The removed code is recoverable from git: `ReaderFinale`'s note section,
  `src/hooks/useLeaderNote.js` and
  `supabase/migrations/20260729_team_setlist_notes.sql`, all at `49ebb2a^`. The
  migration was **never applied**, so there is no table in production and no
  drift to undo. Note the older `serviceNote`/`practiceNote` setlist fields
  still exist and still sync to every member — the whole point of the removed
  work was that leaders' candid notes should not.
- Landing rework — surface the church; "Invite member" shouldn't be first.
- **Stats & insights** tab (most/least played song & key, top member).
- Admin/leader-only **Options** tab.
- **30-day soft team/account deletion** with countdown + restore (needs `deletion_at` + scheduled purge).
- Collect more member info (phone, leader-only, GDPR-sensitive) ❓ which fields?
- Needs a real demo-pass before the paid tier is sold.

### Settings · Help · Nav
- 🟡 **Themes sometimes won't change** — open since the June note; suspected state-caching / race. Overlaps §1.2 #5 (hub + preview must follow the app theme); look at them together.
- 🟡 **Big Settings rework** — panel taxonomy, fold **Account** fully in, restore the helper texts stripped earlier. Supersedes the older "add/reorg settings" + "mobile settings rework" lines; keep those as sub-tasks.
- Help: context-specific "?" per screen; surface feedback prominently.
- **Hamburger panel** ❓ keep or replace — decide, then rework. Motivational quotes ❓ keep or drop.
- FAB: more actions; nav → prev/next pill morph + motion.

### Notifications
- 🟡 **UX rework, mobile + desktop.** In-page "Clear all" is buried; the mobile FAB's Mark-all-read / Clear-all is a stopgap. Tray/page layout, grouping, and empty/overflow states all want a rethink.
- Consider an unsubscribe row in Settings.

### Interop & import
- 🟡 **PDF import does not handle two-column charts** (2026-07-30). High real-world impact — a large share of worship charts are two-column, so this is a first-impression failure on exactly the import that should sell the app.
- **Photo / scanned-chart import** — a vision model behind an edge function
  (`chart-ocr`), gated on the existing unused `smart-import` entitlement.
  ⏭️ Tesseract was considered and rejected: it misreads exactly the characters
  that matter (`Bb` → `B6`).
- **PCO (Planning Center) bridge** (OAuth + API client — its own project).
- **SongSelect `.usr`**; a **Migration Hub** onboarding screen with per-app export instructions.
- **Multi-song PDFs** — detected and explained today, not split. Splitting is its own feature.
- **Export as ChordPro** (`.cho`).

### PDF export
- 🔴 **BROKEN — the print/PDF button does not work (2026-07-30).** Fix before
  anything else in this area; see §1. Everything below is backlog behind it.

More entry points (library row, SetlistPlayer, PracticeView), NNS in PDF, chord
diagrams in PDF, per-song setlist subtitle, cover-page customisation, total set
duration, per-song selection, A4/Letter toggle, hide cover/tabs/notes toggles,
margins/spacing, section-per-page, reset-to-defaults, jsPDF fallback.

### Chores
- Extend the **trash bin** (soft-delete) to setlists + a team-library bin (songs done).
- 🟡 **Media cache policy — "keep art for the upcoming setlists"** (2026-07-31, owner's idea, from reader element 27). Worth separating the two halves the question mixes: **song data is not a cache problem** — markdown in IndexedDB, a 1,000-song library is a few MB, already fully offline. **Media is**: cover art and YouTube are the things that fail with no signal, and they're unbounded. The rule to build: keep every song, keep art for songs in the next N setlists, placeholder for the rest. Measure a real large library before spending anything here.
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
| 10 | **The practice row is too long on a phone** — which shape? (a) the track half collapses to play + rate, scrubber on its own line only while playing; (b) click and track become two tabs in one row. | §1.1 #2, blocks finishing the reader |
| 11 | **How many reading modes are there really?** Live / rehearsal / practice / campfire / full-screen are five *names* for one viewer — the preset idea coming back through the door. What actually differs is three flags: practice tools on?, cues shown?, screen kept awake? Recommend deleting the vocabulary and keeping the flags. | A design round after §1.3 |
| 14 | 🟡 **prio 2 — draggable song SECTIONS on the page, and a `+ section` at the end.** The song map's drag now works, so the second half of the owner's idea (2026-08-04) is parked rather than blocked: reordering by dragging the section on the page itself, where your eyes already are, with the map kept as the overview. Wait until the map's drag has had real use — it may turn out one is enough, and two drag systems on one screen is a cost. | Nothing; parked deliberately |
| 13 | **Two chord pickers, and underneath them two chord MODELS.** `features/editor/ChordPicker.jsx` (a fixed 290px root × suffix popover, no text entry) and `ChordAutocomplete.jsx` (types any chord, docks on touch, suggests from the key) both exist and do the same job; the reader was wired to the wrong one for a build. Merging the two components is the easy half. The hard half is that they sit on **different representations**: `ArrangeTabV2` works on `{ plainText, chords: [{ pos, chord }] }` — lyrics as text plus chords at character positions — while the reader and the `.md` work on `[C]inline` strings. That difference is why "just do it like the editor does" does not transfer, and why the reader cannot yet place a chord on a word that has none. Unify the model first; the picker follows. | A design round with §7 #12 |
| 12 | ✅ **Editing from the reader — ANSWERED and shipped 2026-08-04**, inside element 1. *"Is this a correction or a new arrangement?"* is settled: **the edit changes the song**, immediately, and **"New version"** is the escape hatch that forks it instead — so nobody has to answer the question *before* making the change, which is why it was unanswerable. **Practice only** (`can.editSong` in the view table), **editor role or higher** (already enforced — App nulls `onUpdateSong`), Cancel restores the entry snapshot. Decision log: `READER.md` → "Edit mode", rounds 1–8. What is still open is downstream: §7 #13 (the chord model) and §7 #14 (draggable sections). | — |

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
