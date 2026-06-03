# App Shell Redesign — Design Spec

Status: **design agreed, not yet built.** Solo/occasional cadence — every
slice below must be independently shippable to `master`. Three device phases:
**Desktop → Mobile → Tablet**, preceded by a headless backend prerequisite.

This is the detailed companion to the "App Shell redesign" focus noted in
`CLAUDE.md`. Longer-horizon items stay in `docs/roadmap.md`.

---

## Decisions captured (from design Q&A)

- **Desktop:** kill the left sidebar; global nav moves to a **top header**,
  content is **full-width**. Navigate inside Library/Setlists via the list
  itself (master-detail), with a **right-side peek pane** for detail.
- **Workspace switcher:** centered dropdown in the header. Must support
  **multiple bands/churches** (not just one) → requires a backend refactor
  first.
- **Library/Setlists feel:** Notion-style **database/table view** + a
  **right-side peek** that opens on row click (per the provided mockups).
- **Mobile:** iOS 26-style **floating translucent glass tab bar** (Home /
  Setlists / Songs) + a **separate morphing FAB** whose action changes per
  view.
- **Tablet:** distinct **two-pane split view** (master list left, detail
  right; the peek becomes a pinned second pane in landscape).
- **Header right cluster:** **notifications bell + preferences gear** only;
  account/profile reached elsewhere (see Open Question 1 — mockup also shows
  an avatar).
- **Sequencing:** **multi-team backend first**, then the desktop shell
  consumes it.
- The disliked **"church top bar/modal"** is removed — the header workspace
  dropdown replaces it.

---

## Phase 0 — Multi-team backend (headless prerequisite)

No visible UI; makes the workspace dropdown real. Ships on its own.

**`src/auth/TeamProvider.jsx`**
- Drop `.limit(1).maybeSingle()` (line ~38). Fetch **all** memberships for
  the user, then load each team's details + members.
- Change state shape: `team` → `teams[]`, add `activeTeamId`, derive the
  active `team`/`members`/`isAdmin` from it. Keep the existing per-team
  enrichment (`get_team_member_profiles` RPC) but run it for the active team
  (lazy-load others on switch to avoid N fetches).
- Expose: `{ teams, activeTeamId, setActiveTeam, team, members, isAdmin,
  hasTeamPlan, createTeam, … }`.

**`src/contexts/WorkspaceContext.jsx` + `src/App.jsx`**
- `activeLibrary` already accepts `'personal' | teamId` — generalize the
  switch UI to choose among `personal` + every team in `teams[]`.
- On workspace swap, **always navigate to Dashboard** (roadmap L2-30).

**Fold in while here (cheap, related correctness):**
- Fix `src/hooks/useEntitlement.js`: it reads `team?.billing_plan`, which
  doesn't exist — use `team?.plan`. (Known bug; team gating currently
  resolves to `free`.)

**Verify:** seed a user into 2 teams in Supabase; confirm both appear, the
switch re-fetches the right library, and entitlement reports the correct
plan per workspace.

---

## Phase 1 — Desktop shell

### 1a. TopHeader (new) + remove Sidebar
- New `src/components/shell/TopHeader.jsx`:
  - **Left:** `Home · Setlists · Library` as text tabs, active = brand pill
    (matches mockup).
  - **Center:** `WorkspaceSwitcher` dropdown — Personal + each team/church,
    role badge per team, plus "Create / Join" affordance. Replaces the old
    church top bar.
  - **Right:** notifications bell (reuse `NotificationTray`) + preferences
    gear (opens Settings modal). Account → see Open Question 1.
- `src/components/DesktopLayout.jsx`: grid drops the
  `sm:grid-cols-[80px_1fr] xl:grid-cols-[280px_1fr]` sidebar; becomes a
  single column with `TopHeader` on top + full-width `<main>`. Keep
  `isFullscreen` path (header hidden) for `setlist-performance` /
  `setlist-play`.
- Retire `src/components/Sidebar.jsx` for desktop (keep its bits that the
  mobile drawer still needs, or delete once mobile phase lands).

### 1b. Library as database/table + side peek
- Table columns per mockup: multiselect checkbox, **NAME** (sortable, arrow
  indicator, arrangement-count badge e.g. "2"), **ARTIST**, **KEY** chip,
  **TAGS**. Header row search + view-switcher toggle (table / gallery) +
  `Import` + `+ New Song`.
- **Right-side peek** `src/components/shell/SidePeek.jsx`: slides in from the
  right (~40% width) over a blurred list; renders existing `ChartView` with
  the quick-action row from the mockup (collapse-arrows, fullscreen, info,
  print, edit pencil, display-controls/sliders). Reuse `ChartView` — do not
  fork it.
- Multiselect enables batch actions later (delete, export-all-zip).

### 1c. Setlists — same pattern
- Table view of setlists + side peek rendering `SetlistOverview`. Note the
  existing **two-call-site gotcha** for `SetlistOverview` export callbacks
  (App.jsx route + Setlists.jsx preview) — the peek becomes the canonical
  preview; keep both wired or consolidate.

### 1d. Bug fixes folded into the shell pass
- Settings modal: backdrop-click closes + body scroll-lock (iPad pain).
- Remove / relocate the feedback chat bubble (visible bottom-left in mockup).
- Theme/accent/font reliability sweep (themes "sometimes won't change").

**Verify:** desktop at ≥768 and ≥1280; row click opens peek; peek
collapse/fullscreen work; settings closes on backdrop; performance view still
hides the header.

---

## Phase 2 — Mobile (iOS 26 glass)

- **Floating glass tab bar** (translucent, rounded, detached from edges):
  Home / Setlists / Songs. Replaces current `BottomNav` styling.
- **Separate morphing FAB**: action changes by view — `+ Song` (Library),
  `+ Setlist` (Setlists), `Play Live` (setlist views), `Back` (editor).
- Top area: church top bar removed; workspace switch + notifications move to
  a compact top-right control. Large-title iOS-style headers per tab.
  (Exact top-area treatment finalized at Phase 2 kickoff.)
- `MobileDrawer` slimmed to secondary nav only.

## Phase 3 — Tablet (two-pane split view)  ✅ shipped

- Persistent **master list (left) + detail (right)**, top header on top.
- The desktop side-peek becomes a **pinned second pane** in landscape;
  portrait can fall back to overlay peek.
- 44px+ touch targets throughout.

**Implementation notes:**
- Touch tablets are detected with `useIsTablet()` (`pointer: coarse` +
  768–1366px) in `src/lib/useMediaQuery.js`, so the two-pane shell never leaks
  onto mouse-driven desktops — `isDesktop` is now derived as
  `wide && !isTablet`. `advanced = isDesktop || isTablet` gates the database
  table view, master-detail peek and bulk actions.
- `Library.jsx` / `Setlists.jsx`: in tablet **landscape** (`splitDock`), the
  list becomes its own scroller (`flex-1`) and the detail renders as a pinned
  `<aside>` (ChartView / SetlistOverview) with an empty-state prompt. Tablet
  **portrait** and desktop keep the overlay `SidePeek` (its hard-coded
  `hidden lg:block` was removed so portrait tablets can show it).
- Row tap on tablet loads the detail pane (`onRowActivate = openPeek`);
  desktop keeps row → full view with the dedicated pane button.
- Tablet fullscreen (`isFullscreen`) collapses `splitDock` so the detail
  expands to the overlay full-screen path, matching desktop.

---

## Open questions (to resolve before/within each phase)

1. **Header account entry.** You chose "bell + gear only," but the desktop
   mockup shows an avatar ("G") at the far right. Confirm: account lives
   inside the gear/preferences menu, OR keep the avatar as a third right-side
   control?
2. **View-switcher second mode.** The two toggle icons in the mockup — table
   + gallery, or table + board (Kanban by tag/key)?
3. **Mobile top area specifics** (Phase 2): exact placement of search,
   workspace switch, notifications under the large-title model.
4. **Tablet portrait** behavior when the second pane can't fit (overlay peek
   vs push).

## Sequence summary

`Phase 0 (backend)` → `1a header` → `1b Library+peek` → `1c Setlists` →
`1d fixes` → `Phase 2 mobile` → `Phase 3 tablet`. Each is one PR; stop
anywhere and the app still ships.
