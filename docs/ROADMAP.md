# Setlists.md Roadmap

This document is the single trackable feature roadmap. It consolidates the
earlier product spec, design migrations, and the old idea tracker. The
near-term launch plan lives at the top; the longer-horizon feature list
follows.

---

## 0. Launch Plan — Public Beta, October 1

Work is split into months. June/July is the unglamorous foundation (pipeline +
legal + bug fixes + security); features land in August once the custom domain
and email are in place.

### ✅ June — DONE (shipped in 0.11.0-pre-alpha)
- [x] **GDPR "Delete Account" / Right to be Forgotten** — edge function wipes
      the auth user; profile + team rows cascade.
- [x] **Account termination guardrails** — owning a Space no longer deletes it
      on account deletion; ownership transfers to the earliest admin → earliest
      member → only deletes when the owner was the sole member.
- [x] **Member read-only gating** — three layers: entry points gated, save
      handlers refuse writes, and a redirect bounces members out of the editor.
- [x] **Preference cloud-sync push bug** — all 30 portable keys now push via a
      single snapshot dependency.
- [x] **Login scroll bug on mobile** — AuthScreen scrolls on short viewports.
- [x] **In-app legal pages** — Privacy, Terms, and a new Copyright/DMCA page
      render inside the app shell; wired from Settings → About and sign-up.
- [x] **Pricing model reconciled** — Free / Pro (one-time, BYOC) / Sync for
      solo; Band (10 seats) / Church (30 seats) for Spaces. `PricingScreen`
      shows the new tiers inside the app shell.
- [x] **Security pass** — headers (clickjacking/MIME/HSTS), revoked anon EXECUTE
      on team functions, fixed a null-auth bypass in `invite_user_to_team`,
      added RLS for `user_cloud_tokens`, locked down avatar listing, email-format
      guard on the waitlist, `npm audit` cleared.
- [x] **Settings dialog polish** — scroll-lock flicker fixed, backdrop-close,
      iPad safe-area header padding.
- [x] **Avatar upload limits** — JPEG/PNG/WebP, 5 MB.
- [x] **CI** — GitHub Actions `lint + test + build` on every PR/push.
- [x] **Branch protection** on `main` (require CI to pass before merge).

### ⏳ June items deferred to August (bundled with domain/email work)
- [ ] **Cookie / local-storage transparency notice** — will live on the
      marketing-site footer once the `setlists.md → app.setlists.md` split lands.
      Not required inside the installed PWA.
- [ ] **Leaked-password protection** — Supabase Auth toggle; enabling alongside
      Resend + OAuth so all auth changes ship together.
- [ ] **Staging environment** — using the free Vercel preview on the `beta`
      branch for now; a dedicated second Supabase project is deferred (no budget).
- [ ] **Error monitoring (Sentry)** — deferred (no budget); `VITE_SENTRY_DSN`
      is wired and dormant.

### 🔴 July — remaining launch blockers
- [x] **Unsaved-changes guard** — "are you sure?" before leaving the song editor
      (the setlist builder already has one). *Done June 2026 — `Editor.jsx`
      tracks `isDirty = md !== savedMd`, `handleBack()` shows the custom
      `useConfirm()` "Discard unsaved changes?" dialog, a `beforeunload`
      listener warns on tab close, and `App.jsx`'s `popstate` handler guards the
      `editor` view via `editorDirtyRef` (mirrors the `setlist-build` guard).*
- [x] **iPad PWA PDF export** — popup is blocked in standalone mode; ship the
      inline-iframe fallback (see §7 below). *Done June 2026 — the iframe
      overlay is now the only print path on every platform.*

### 🟡 Beta quality (should ship, won't hard-block)
- [x] Display modes: Chords-only / Lyrics-only / Song-map (chart/practice/live
      view picker; Nashville + Do-Re-Mi notation also shipped).
- [~] ChordPro / OnSong import (migration is the #1 new-user friction point).
      *Partial — `smartImport()` (`src/importer.js`) already converts ChordPro,
      OpenSong XML, Ultimate Guitar, and plain text, surfaced via
      `components/newSong/ImportTab.jsx` (gated behind `sync` / `smart-import`).
      Remaining: a dedicated `.onsong` parser and per-file success/failure
      reporting in the import UI.*
- [x] Notes per setlist (unified notes: team + private "My note" at song /
      setlist-item / section scope; `team_notes` table).
- [x] WakeLock (stop the screen sleeping mid-performance).
- [ ] Public-domain starter pack (~20 hymns) for first-run.
- [ ] Setlist QR / URL share (a paid-tier feature — must exist if sold).
- [x] Replace remaining native `confirm()`/`alert()` with custom dialogs.
      *Done June 2026 — every confirm routes through `useConfirm()` →
      `ConfirmDialog`; the only `window.confirm` left is the intentional
      no-provider fallback in `ui/useConfirmHook.js`, and no native `alert()`
      remains in `src/`.*
- [ ] Multi-filter library view.
- [x] **Team optimistic locking** — CAS-guarded writes; conflicts are detected
      and surfaced ("Cloud overwrote local changes") on both full sync and the
      debounced push. Current policy: last-write-wins + warn (no 3-way merge).

### 🎨 Page redesigns to match the new app shell
These screens were updated for content but still need a visual pass to sit
natively inside the new app shell (top header, modes theme, consistent cards):
- [ ] **Pricing page** (`PricingScreen.jsx`) — redesign the hero + tier cards to
      match the new Dashboard aesthetic rather than the legacy `modes` overlay.
- [ ] **Team page** (`TeamScreen.jsx`) — align create/manage flows and the
      tier picker with the new design; reflect Band/Church naming.
- [x] **Preferences/Settings** (`Settings.jsx`) — grouped nav (Account /
      Display / Sync & data / About), Notion-style account card, bigger panel
      titles; renamed "Preferences" → "Settings".

### Suggested cadence
| Month | Theme | Status |
| :--- | :--- | :--- |
| **June** | Pipeline (CI, branch protection) + legal + security + bug fixes | ✅ shipped (0.11.0) |
| **June** | App-shell redesign slices (headers, notes, dashboard, settings, auth) + sync reliability | ✅ shipped (0.12.0) |
| **July** | Remaining blockers (unsaved guard) + import (ChordPro/OnSong) + polish | up next |
| **August** | Custom domain + Resend email + Google/Apple login + cookie notice + leaked-password toggle + first features | planned |
| **September** | Polish + private soft-launch to 5–10 worship teams | planned |
| **October 1** | **Public beta** | planned |

### App Shell redesign — independently-mergeable slices
Shipped as small slices, never a long-lived branch. Order:
1. [x] Settings-modal backdrop-close + scroll-lock + iPad header safe-area.
2. [x] Dashboard + Schedule redesign — customizable widgets (reorder + show/
       hide, synced) with This week / Library stats / Team availability / Sync
       widgets; "My Schedule" colour-codes services (green) vs rehearsals
       (amber).
3. [x] Chart/performance display options (Lyrics-only / Chords-only / Song-map
       via the view picker, Nashville + Do-Re-Mi notation). Condensed/duplicate-
       section handling still open.
4. [x] Setlist + notes rework (unified team + private notes; per-item notes).
5. [x] Church/Team hardening (read-only gating + optimistic-lock conflict
       surfacing; own-realtime-echo suppression; owned-workspace cap).

Shipped in **0.12.0** beyond the slices above: a shared three-row stage header
(Chart/Practice/Live) that scroll-collapses to the structure ribbon, edge-arrow
nav + scroll-synced ribbon + selectable ribbon styles, campfire single-song
Play with key/tag/tempo "Up next" suggestions, password-only sign-in/up rework,
and a sync-reliability pass (no status churn, debounce/full-sync race closed).

### Production pipeline gaps
- [x] **CI** — GitHub Actions `lint + test + build` on every PR/push.
- [x] **Branch protection** on `main` (require CI to pass before merge).
- [ ] **PR + issue templates** (`.github/`).
- [ ] **Staging environment** — free Vercel preview on `beta` for now; dedicated
      second Supabase project deferred (no budget).
- [ ] **Error monitoring** — Sentry wired + dormant; enable before launch if budget allows.
- [ ] **Release tags** — tag each release on `main` after merge (`git tag v0.x.0`).

---

## 1. Design System Migration (Geist/Tailwind v4)
*(See `design-system.md` for full UI component implementation status)*
- [x] Integrate Base Geist Typography & Colors.
- [x] Build core UI components (`Button`, `Card`, `Badge`, `Tabs`, `Input`, `Toast`, etc.)
- [x] Complete refactoring of complex views (`ChartView`, `Editor`, `Settings`).
- [x] Modernize layout components (`BottomNav`, `PageHeader`, `SongCard`, `SetlistCard`)
- [x] *Remaining Task*: Ensure custom dialogs/modals fully replace native browser prompts across all UX flows. *(Done June 2026 — see "Replace remaining native `confirm()`/`alert()`" above; all confirms go through `useConfirm()`/`ConfirmDialog`.)*

## 2. Core App Capabilities (v1/v1.5)
- [x] Song library with search and filters.
- [x] Chart renderer with section blocks and auto-responsive layout.
- [x] Transpose engine, modulo-based key selectors.
- [x] Split-screen, multi-tab Editor (Form/Visual/Raw) with live preview.
- [x] Setlist builder and player (auto-scroll, song strip, per-song offsets).
- [x] Persistent storage via IndexedDB.
- [x] Smart `.md` and `.zip` bundle export/import pipelines.
- [x] Bluetooth pedal support & Capo calculator mapping.
- [x] Form/Visual Editor toolbar tools (sections, tabs, modulations).

## 3. Professional Features (v2)
- [x] Tab block parsing & SVG interactive rendering map.
- [x] Chord diagram engine rendering.
- [ ] Instrument role profiles (vocalist, guitar, bass, keys, drums views).
- [~] Smart import from ChordPro (`.cho`), SongSelect (`.usr`), OnSong, generic Text/PDF/Word parsing contexts. *(Partial — `smartImport()` handles ChordPro, OpenSong XML, Ultimate Guitar, and plain text via `ImportTab.jsx`. Remaining: a dedicated `.onsong` parser, SongSelect `.usr`, PDF/Word extraction, and per-file import reporting.)*
- [ ] Enhanced playback modes: Explicit Rehearsal vs Live sub-modes.
- [ ] Display customizations: Nashville number system toggle, Duplicate section handling rules, Chords-only/Lyrics-only displays.
- [x] Print single song / setlist to PDF
- [ ] Export as ChordPro (`.cho`) for interoperability
- [ ] Setlist URL/QR Code share capabilities.
- [ ] Internationalization (i18n): Foundational hooks and tier-1 language file population (es, pt, ko, fr).

## 4. Advanced Features & Tooling (v2.5)
- [ ] Instrument-specific optimizations: Drummer view counts, Piano voicing charts, Bass root emphasis logic.
- [ ] Setlist quality enhancements: Key compatibility checkers, drag-and-drop reordering.
- [ ] Viewer extensions: Section rehearsals loops, quick-key switchers.
- [ ] PDF text extraction import (best-effort).
- [ ] Performance testing and WCAG AA accessibility audit.

## 5. Cloud Sync & Collaboration (v3)
- [x] Core Sync adapter interface abstractions.
- [x] Google Drive & OneDrive/Dropbox basic JSON-manifest plugins.
- [ ] WebDAV sync extensions.
- [ ] Settings sync mechanisms.
- [ ] Team collaboration shared-folder logic.
- [ ] Real-time session playback syncing (WebSockets relay framework).

## 7. PDF Export Enhancements
*(Builds on `src/pdf/exportSongPdf.js` and `src/pdf/exportSetlistPdf.js` —
the dedicated print-window renderers.)*

Shipped:
- [x] Self-contained popup renderer (Cover header, structure ribbon, sections,
      tab blocks, modulate markers, per-page footer).
- [x] Live preview controls in the popup: columns (1/2), size (S/M/L/XL),
      lyric font (Sans/Serif/Mono), chords on/off, colors on/off.
- [x] Per-user preference persistence under `setlists-md:pdf-prefs`.
- [x] Repeating brand footer (`setlists.md` with `.md` in brand teal) on every
      printed page.
- [x] Unicode-safe export filenames (e.g. `Înțelept.md` survives slugify).
- [x] **Setlist PDF** — choose between *set-order overview* (one-page
      runner sheet) and *full chord charts* (cover page + every song
      printed in full). Per-item transpose and notes are honoured in
      both modes. Every song starts on a new page. Breaks render as a
      separator banner instead of a numbered song row, both in print
      and in the on-screen overview.
- [x] Export dialog rendered through `createPortal` so it surfaces above
      the desktop layout's transformed `<main>` (the desktop preview
      pane in `Setlists.jsx` and the dedicated `setlist-view` route now
      both open the dialog correctly).
- [x] Print toolbar is responsive on narrow popup widths / phones, and
      the chart-only controls (cols / size / font / chords / colors)
      auto-hide in *overview-only* mode where they don't apply.

Known issues / risks:
- [x] **iPad PWA standalone popup blocking** — *Fixed (June 2026).* The
      print preview no longer uses `window.open` + `document.write` on
      any platform. `openPrintWindow()` (`src/pdf/pdfDocument.js`) now
      always renders an in-app overlay with a same-origin
      `<iframe srcdoc>` and prints via `iframe.contentWindow.print()`.
      This works in installed PWAs (no popup permission involved),
      survives popup blockers on desktop, and is the only pattern that
      will work inside Capacitor/Electron webviews later. The
      `window.opener.localStorage` pref hook is obsolete (the iframe is
      same-origin, so it reads `setlists-md:pdf-prefs` directly); the
      in-document Close button removes the overlay via
      `window.frameElement`.
      Residual risk: `contentWindow.print()` on very old iOS versions
      (< 13) silently no-ops — acceptable.

Planned (highest-value first):
- [ ] **More print entry points** — today print is reachable only from
      inside `ChartView` and from `SetlistOverview`. Add it to:
      • Library song-row context menu (quick single-song print).
      • `SetlistPlayer` (live mode) — last-second printout before going
        on stage.
      • `PracticeView` — print the current arrangement / loop notes.
- [ ] **NNS toggle in PDF** — mirror the in-app Nashville Number System
      toggle so leaders who chart in numbers can print number sheets.
      Reuses the existing `nns` flag from `ChartView`.
- [ ] **Chord diagrams in PDF** (supersedes the older "Chord-diagram
      strip" item) — render the same svguitar shapes the in-app
      `ChartView` shows. Two layouts to consider: (a) a top-of-page-1
      diagram strip, and (b) inline diagrams next to first-occurrence
      chord names.
- [ ] **Per-song setlist subtitle** — when *full-charts* setlist mode
      prints song N, add a small "From: <Setlist Name> · <Date>"
      subtitle so loose printed pages can be re-collated by the
      band-room runner.
- [ ] **Cover-page customisation** — band / church name, logo upload,
      week-of label, leader name. Stored per-user under the existing
      portable preferences (`PORTABLE_PREF_KEYS` in `App.jsx`).
- [ ] **Total set duration** — sum BPM-derived rough estimates plus
      break minutes on the overview cover page; allow a manual
      duration-override per item in the setlist builder.
- [ ] **Per-song selection** — let the user pick a subset of items from a
      setlist before exporting (e.g. just the band block, not the
      pre-service music).
- [ ] **"Page N of M" scoped per song** — current footer counts whole
      document; some leaders prefer per-song numbering on multi-page
      charts.
- [ ] **PDF dark-mode** — match the user's app theme choice when
      printing to screen-style PDFs (for rehearsal viewing on tablets,
      not paper).
- [ ] **Programmatic PDF generation fallback (jsPDF / pdfmake)** — if
      both the popup *and* the iframe paths fail (edge combos: locked-
      down enterprise WebViews, in-app browsers), build the PDF in
      memory and trigger a Blob download. ~50 kB gzipped bundle hit, so
      weigh against the iframe path above before adopting.
- [ ] **Paper size toggle** — Letter vs A4 (matters for non-US users;
      today it's hard-coded to Letter).
- [ ] **Hide cover toggle** — for re-prints / songbooks where metadata
      is repeated; jumps straight to section 1.
- [ ] **Hide tab blocks / hide section notes / hide inline `{!band
      notes}`** — individually toggleable for vocalist sheets and clean
      projection sheets.
- [ ] **Margins toggle** — Normal / Narrow / Wide. Narrow buys ~25% more
      content room on dense charts.
- [ ] **Spacing toggle** — Compact vs Comfortable. Pair with size XL
      when sight-reading from a stand; pair with Compact when fitting a
      long song onto fewer pages.
- [ ] **Force "section per page"** — every section starts a fresh page.
      Niche but useful for in-ear monitor screens that show one section
      at a time.
- [ ] **Reset to defaults button** — one-click revert if the user has
      tweaked everything into something unprintable.

## 8. Native Apps Expansion (v3.5)
- [ ] **Capacitor Integration** — Wrap the React build for iOS/Android native distributions.
- [ ] **Native OAuth Mapping** — Hook `@capacitor/apple-auth` and Google into existing AuthProvider.
- [ ] **Native Bluetooth Driver** — Support for physical foot pedals (AirTurn/PageTurner) via native plugins.
- [ ] **Safe-Area UI Audit** — Dynamic padding for iPhone "Notch" and "Home Bar" across all views.
- [ ] **Store Deployment** — Generate screenshots, app icons, and submit to App Store/Google Play.

## 9. Legality, Compliance & Migration (New)
- [ ] **Migration Hub UI** — Dedicated "Onboarding" screen for PCO, OnSong, and PDF imports.
- [ ] **Planning Center (PCO) Bridge** — OAuth integration to pull SongSelect content via PCO arrangements.
- [ ] **OnSong Archive Import** — Direct ingestion of `.onsong` and OnSong backup bundles.
- [ ] **PDF-to-Markdown Engine** — Best-effort text extraction from SongSelect/Publisher PDFs.
- [ ] **Transient Sharing (48h)** — Unlisted, non-indexed setlist links that expire after a set time for guest musicians.
- [ ] **Safe Harbor Compliance** — Implementation of "Notice and Takedown" infrastructure (Designated Agent email).
- [ ] **Public Domain Starter Pack** — A library of ~20 classic hymns (PD) for new users to test the app safely.
- [ ] **Privacy-First Storage** — Maintain non-monitoring policy of user-private libraries to preserve DMCA Safe Harbor status.
- [ ] **International Legal Compliance (Eastern Europe)** — Localize disclaimer and verify alignment with religious-use exceptions in RO (Art. 35), HU (Art. 38), UA, RS, and BG.
- [ ] **GDPR "Right to be Forgotten"** — Implement "Delete Account" flow that wipes all user data from Supabase/Auth.
- [ ] **Privacy & ToS Pages** — Draft and publish standard legal terms covering user-owned data and storage providers (Supabase).
- [ ] **Cookie Transparency** — Add a footer link/notice about strictly necessary storage usage (no tracking cookies).
- [ ] **Account Termination Guardrails** — Handle "orphan teams": prevent owner deletion if team has members; require ownership transfer or team deletion first.

## 10. Editor & Chart Rework — Remaining (after 0.10.0-pre-alpha)

The editor/chart overhaul shipped in 0.10.0-pre-alpha (Slices 1–3, unified
header, structure rework, expanded metadata + chip inputs + sanitization,
custom dropdowns, chart-header rework). Still outstanding:

- [ ] **Arrange: inline section editing** — replace the `SectionDrawer` modal
      with edit-in-place (per-line inline edit already exists).
- [ ] **Arrange: tab blocks + tab rework** — display/edit tab blocks in Arrange;
      the deeper tab editor redesign (grid vs inline vs ASCII) is its own
      design question.
- [ ] **Instrumental: measure/bar grid** — chord-only lines shipped; add the
      optional `| C | G | Am F |` bar-grid display mode on the same data.
- [ ] **Team-sync hardening (optimistic locking)** — Phase 1: `version` column
      + conditional write to detect conflicts; Phase 2: structured 3-way merge;
      Phase 3: presence. (Design captured in chat.)
- [ ] **Diacritic-insensitive search** — `Lauda` should match `Laudă`
      (`.normalize('NFD').replace(/\p{Diacritic}/gu,'')`) in `Library.jsx`.
- [ ] **Multi-line Story/Notes** — frontmatter is one line per field, so these
      collapse to a single line; needs a format decision to preserve newlines.
- [ ] **Per-song IndexedDB persistence** — `saveSongs()` rewrites the whole song
      array on every edit; split into per-song keys before ~1000+ songs.
- [ ] **Chart 2-column balancing gaps** — `column-count` balancing leaves gaps
      at `break-inside: avoid` boundaries; the open/close reflow was fixed via
      `scrollbar-gutter: stable`, but the static balance gap remains (consider
      the rows-grid layout as the default).
- [ ] **Bigger data-architecture items** (from the "outgrown .md?" discussion):
      per-user notes (`team_notes`), attachments (PDF/sheet music), the BYOC
      "Song Bundle" folder format, and full-text lyric search.



## Post-launch — Suggested Edits (propose & approve)

Members propose changes; an admin/editor reviews and accepts or rejects.
Flag-gated, intended for after the public release.

- **Scope:** suggest edits to a song's chords, lyrics, or tabs (and likely
  arrangement metadata) instead of writing directly, in team/church libraries.
- **Flow:** member edits → submits a *suggestion* (a diff against the current
  song) → admin/editor gets a **notification** → previews the proposed change
  and **Accepts** (applies + notifies) or **Rejects/Removes** it.
- **Data:** a `song_suggestions` table — `id`, `team_id`, `song_id`,
  `author_id`, `status` (pending|accepted|rejected), `kind`
  (chords|lyrics|tab|meta), `payload` (the proposed `.md` or a structured diff),
  `base_version` (for conflict detection), `created_at`, `reviewed_by`,
  `reviewed_at`. RLS: members insert their own + read suggestions on their
  team's songs; admins/editors update status. Pairs naturally with the planned
  optimistic-locking `version` column.
- **UI:** a "Suggest edit" affordance in the editor for read-only members
  (today they're blocked entirely), a review inbox/notification for reviewers,
  and a diff preview. Reuse the existing notifications surface.
- **Gating:** behind a feature flag until the team tier is hardened; depends on
  team-sync conflict handling landing first.

## Phase 5 follow-up — Reusable tab library (snippets)

Tabs today are copy-on-insert into `section.lines` (no schema change). A future
slice could make tabs *reusable*: a named library of riffs/licks stored at the
song (or workspace) level that can be inserted into multiple sections and edited
in one place.

- **Data:** a `tabs[]` array on the song (or a `team_tabs` table for shared
  libraries) — `id`, `name`, `instrument`, `tuning`, `strings`, `time`. Sections
  reference a tab by id instead of embedding it. Needs a `.md`/schema decision
  and a migration; would break the current inline round-trip, so do it
  deliberately (MAJOR per SemVer).
- **UI:** the Tabs gallery becomes the library; "Insert" drops a reference;
  editing a snippet updates everywhere it's used.
