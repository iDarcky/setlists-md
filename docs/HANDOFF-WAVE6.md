# Session handoff → Wave 6

_Written 2026-06-15 at the end of the Wave 5 (audit-remediation) push, on branch
`claude/zealous-mayer-jma2e8`. Next session starts **Wave 6** (UX epics)._

## 1. ⚠️ VERIFY FIRST on deploy — CSP is now enforcing

`vercel.json` was flipped from `Content-Security-Policy-Report-Only` to an
**enforcing `Content-Security-Policy`** this session. This is the one change that
can only be validated in a real browser, so confirm it before trusting the
deploy:

**Test checklist (on the Vercel preview/prod URL, not just `npm run dev` — the
header only ships from `vercel.json`):**
- [ ] App loads with **no CSP errors** in the console.
- [ ] **Export a song to PDF** → the in-app print overlay appears, the
      cols/size/font/chords/colors/repeats controls all work, and Print/Close work.
- [ ] **Export a setlist to PDF** (both Overview and Full modes) → same checks,
      plus the list/cards layout toggle and the **Close button** (this was a
      latent bug in the old setlist script — it now uses the iframe-overlay close).
- [ ] Repeat the PDF checks in the **installed PWA** (iOS standalone + Android),
      since the print iframe is `about:srcdoc` and `frame-src 'self'` behaviour
      can differ in webviews.
- [ ] Google / Dropbox / OneDrive sign-in + sync still work (OAuth domains are in
      `connect-src`/`form-action`).

**One-line rollback** if anything is blocked: in `vercel.json` rename the header
key back to `Content-Security-Policy-Report-Only` (keep the value) and redeploy.
That restores report-only mode instantly without losing the directives.

### Why it's safe (what was verified here)
- The **only** inline `<script>` in the whole app was the PDF print controls.
  Those moved to an external, precached `public/pdf-print.js` (`script-src
  'self'`), with per-document data in a non-executed
  `<script type="application/json" id="pdf-print-config">` block. Built
  `index.html` has a single external module script — no inline scripts.
- Inline **styles** still need `style-src 'unsafe-inline'` (the app uses inline
  styles everywhere) — that's kept.
- The built bundle has **no load-time `eval`/`new Function`** (the lone hit is a
  lazy `setImmediate(string)` branch that's never called), so `script-src 'self'`
  without `'unsafe-eval'` is fine.
- `frame-src 'self'` was added for the print iframe.

## 2. ⚠️ Migrations — apply before relying on team notifications

Two migrations are committed but were **NOT applied from this environment** (the
Supabase MCP connection kept returning "requires approval"):
- `supabase/migrations/20260616_team_notifications.sql` — `team_notifications`
  table + decline-alert trigger. **Includes a product decision:** decline alerts
  notify only the **responsible leader** (the setlist's `created_by`, auto-stamped
  by a `BEFORE INSERT` trigger), falling back to all roster managers for legacy
  setlists with no creator.
- `supabase/migrations/20260617_team_scale_indexes.sql` — standalone `team_id`
  indexes on `team_songs`/`team_setlists`.

Apply via `supabase db push` or the SQL editor. Until `20260616` is applied,
decline notifications are a no-op (the client degrades gracefully).

## 3. What shipped in Wave 5 (this + prior session)

All code-side audit-remediation is done. Highlights the next session should know:
- **Per-song IndexedDB persistence** (`src/storage.js`) — songs persist one entry
  each (`song:<lib>:<id>`) + an ordered `songidx:<lib>` index. `saveSongs` keeps
  its whole-array signature but **diffs by object-reference identity** (React
  replaces only the edited song's object) and writes just the changed song. The
  legacy whole-library blob migrates in place on first load. Tests:
  `src/__tests__/storage-persistence.test.js`.
- **Incremental sync hashing** (`src/sync/engine.js`, `src/sync/team-engine.js`)
  — both engines cache each item's serialization + hash keyed by object
  reference, so unchanged items aren't re-serialized every sync.
- **Security:** share-token entropy (22 chars), input `maxLength`, defensive
  PDF-prefs/ZIP-manifest parsing, and the CSP work above.
- See `docs/BACKLOG.md` → "Wave 5 — what's left" for the few **deliberately
  deferred** items (OAuth-cleanup-synchronous, team-push batching, `team_activity`
  retention) and why.

## 4. Wave 6 — where to start

From `docs/BACKLOG.md` "Wave 6 — UX epics" (bigger, mostly independent — pick a
slice, don't big-bang). The user flagged Wave 6 as "a bit more complicated."
Likely entry points:
- **Scheduling UI/UX polish** (carried out of Wave 4):
  - _My-Schedule v2 event cells_ — user is undecided on the look; an alternative
    to explore is uniform compact day-chips with the event name as a caption
    beneath (keeps the strip even).
  - _Scheduling grid mobile-narrow ergonomics_ — the members × Sundays grid needs
    phone polish (sticky-column sizing, tap targets, scroll affordance, maybe a
    condensed by-service mobile view).
- **Chart display-options + layout-menu rework** (§6).
- Setlist overview redesign + desktop 3-pane editor; Recommended-next engine
  rework; song/break card redesign (§3/§4).

⚠️ Before starting scheduling polish, confirm with the user **which** slice — the
My-Schedule look is explicitly an open design question.

## 5. Conventions reminder (so the next session matches house style)
- `npm run build` after changelog/version changes; `npm run lint` only if code
  changed (repo has pre-existing lint noise). Tests: `npx vitest run`.
- "finish" workflow bumps `-beta.<N>` + appends to the single in-progress
  changelog block — see `CLAUDE.md`. Don't cut a new MINOR per feature.
- Develop on the assigned feature branch; never push to `beta`/`main` directly.
