# Setlists.md Roadmap

This document is the single trackable feature roadmap. It consolidates the
earlier product spec, design migrations, and the old idea tracker. The
near-term launch plan lives at the top; the longer-horizon feature list
follows.

---

## 0. Launch Plan — Public Beta, October 1

Work is split into months. The goal of June/July is the unglamorous foundation
(pipeline + legal + bug fixes); features come in August once the custom domain
is in place.

### 🔴 Launch blockers (must ship before going public)
- [ ] **GDPR "Delete Account" / Right to be Forgotten** — wipe all user data
      from Supabase. Legally required.
- [ ] **Cookie / local-storage transparency notice** — footer notice (no
      tracking, but still required).
- [ ] **Account termination guardrails** — handle "orphan teams": block owner
      deletion while a team has members; require transfer or team deletion.
- [ ] **Reconcile the pricing model & fix `PricingScreen.jsx`** — three
      different plan-naming schemes exist across the docs (`analysis/FINANCIAL.md`,
      `analysis/MONETIZATION.md`, and the in-app `src/data/terms.md`). Pick one,
      then make the pricing page match. **Product decision required first.**
- [ ] **Member read-only gating** — members can currently reach the editor in
      read-only team libraries; gate all editor entry points.
- [ ] **Unsaved-changes guard** — "are you sure?" before leaving the editor.
- [ ] **Preference cloud-sync push bug** — ~11 portable keys (chartTheme,
      accentColor, sectionColors, etc.) never push; fix the dependency array.
- [ ] **iPad PWA PDF export** — popup is blocked in standalone mode; ship the
      inline-iframe fallback (see §7 below).
- [ ] **Login scroll bug on mobile.**

### 🟡 Beta quality (should ship, won't hard-block)
- [ ] Display modes: Chords-only / Lyrics-only / Song-map.
- [ ] ChordPro / OnSong import (migration is the #1 new-user friction point).
- [ ] Notes per setlist.
- [ ] WakeLock (stop the screen sleeping mid-performance).
- [ ] Public-domain starter pack (~20 hymns) for first-run.
- [ ] Setlist QR / URL share (a paid-tier feature — must exist if sold).
- [ ] Replace remaining native `confirm()`/`alert()` with custom dialogs.
- [ ] Multi-filter library view.

### 🎨 Page redesigns to match the new app shell
The plan model is now Free / Pro (one-time, BYOC) / Sync ($/mo) for solo, and
Band (10 seats) / Church (30 seats) for workspaces. The following screens were
updated for content but still need a visual pass to sit natively inside the new
app shell (top header, modes theme, consistent cards):
- [ ] **Pricing page** (`PricingScreen.jsx`) — now renders inside the app shell
      with the top header; redesign the hero + tier cards to match the new
      Dashboard aesthetic rather than the legacy `modes` overlay.
- [ ] **Team page** (`TeamScreen.jsx`) — align create/manage flows and the
      tier picker with the new design; reflect Band/Church naming.
- [ ] **Preferences/Settings** (`Settings.jsx`) — modernise the panel layout and
      the plan/about sections to match the shell.

### Suggested cadence
| Month | Theme |
| :--- | :--- |
| **June** | Pipeline (CI, staging, Sentry) + legal blockers |
| **July** | Bug fixes (iPad PDF, unsaved guard, permissions, sync, login) |
| **August** | Custom domain + Resend email + Google/Apple login + first features |
| **September** | Polish + private soft-launch to 5–10 worship teams |
| **October 1** | **Public beta** |

### Production pipeline gaps
- [x] **CI** — GitHub Actions running `lint + test + build` on every PR/push
      to `master` (`.github/workflows/ci.yml`).
- [ ] **Branch protection** on `master` (require CI to pass before merge).
- [ ] **PR + issue templates** (`.github/`).
- [ ] **Staging environment** — second Supabase project + Vercel project.
- [ ] **Error monitoring** — turn on Sentry (`VITE_SENTRY_DSN`) before launch.
- [ ] **Release tags** — tag each release on `master` (`git tag v0.x.0`).

---

## 1. Design System Migration (Geist/Tailwind v4)
*(See `design-system.md` for full UI component implementation status)*
- [x] Integrate Base Geist Typography & Colors.
- [x] Build core UI components (`Button`, `Card`, `Badge`, `Tabs`, `Input`, `Toast`, etc.)
- [x] Complete refactoring of complex views (`ChartView`, `Editor`, `Settings`).
- [x] Modernize layout components (`BottomNav`, `PageHeader`, `SongCard`, `SetlistCard`)
- [ ] *Remaining Task*: Ensure custom dialogs/modals fully replace native browser prompts across all UX flows.

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
- [ ] Smart import from ChordPro (`.cho`), SongSelect (`.usr`), OnSong, generic Text/PDF/Word parsing contexts.
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
- [ ] **iPad PWA standalone popup blocking** — the manifest declares
      `display: 'standalone'` (see `vite.config.js`), so when the app
      is launched from the iPad Home Screen, `window.open('about:blank',
      '_blank', ...)` (used by both `exportSongPdf.js` and
      `exportSetlistPdf.js`) is frequently blocked or bounces out to
      Safari, breaking the `window.opener.localStorage` pref-sync hook
      and the `document.write(...)` injection. The current fallback is a
      generic "Could not open the print window" alert, but there is no
      popup-permission setting inside an installed PWA, so the user has
      no recovery path. Plan:
      • Detect `window.matchMedia('(display-mode: standalone)').matches`
        and switch to an inline-iframe overlay rendered inside the app,
        then call `iframe.contentWindow.print()` to trigger AirPrint →
        *Save to Files* / *Save as PDF*. Keeps the user inside the PWA.
      • Desktop and Android Chrome continue to use the popup (works fine
        there and gives a richer preview).
      • Last-resort fallback: offer a Blob-URL `.html` download the user
        can open in Safari and print/share-sheet from there.

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


