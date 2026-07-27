# Wave 3 Audit — Security & Scale

Read-only audits from the backlog triage (Wave 3 foundations). Evidence-based,
with file:line. Nothing here is fixed yet — this is the worklist.

Generated 2026-06-15 against `claude/zealous-mayer-jma2e8` (based on `beta`).

---

## Security / input-sanitization audit

**Overall:** strong baseline — React auto-escaping covers the main app, PDF
export HTML-escapes user content (`escapeHtml`), all `target=_blank` links carry
`rel="noopener noreferrer"`, Supabase queries are parameterized (no string-built
`.or()/.filter()`), and team data is RLS-isolated. **No critical findings.**

### High
- **CSP is report-only, not enforced** — `vercel.json:18` uses
  `Content-Security-Policy-Report-Only`. Violations are logged, not blocked.
  Flip to enforcing `Content-Security-Policy` once the PDF inline-script issue
  below is resolved (the print iframe needs a nonce/hash first — see
  CLAUDE.md "Known Gotchas"). _Remediation:_ add nonce/hash for the PDF inline
  script, then enforce.

### Medium
- **PDF inline `<script>` has no nonce** — `src/pdf/pdfDocument.js:834,1000`.
  Static today, but blocks enforcing CSP. _Remediation:_ per-export nonce in the
  script tag + CSP, or externalize the init script.
- **PDF prefs JSON embedded with partial escaping** — `pdfDocument.js:641,1011`
  escapes `<` but not quotes/backslashes; prefs come from `localStorage`.
  _Remediation:_ validate the prefs shape (numeric/enum) before embedding.
- **`Object.assign(merged, sbs.all)` with team-activity data** —
  `TeamScreen.jsx:598`. Low real risk (RLS-gated) but prototype-pollution-shaped.
  _Remediation:_ enumerate + coerce types instead of `Object.assign`.

### Low
- **Share token entropy ~80 bits + regex allows 8-char tokens** —
  `share/setlistShare.js:14-20,32`. _Remediation:_ 22–32 chars / wider alphabet;
  raise the regex minimum.
- **OAuth token cleanup is timer-deferred (~150ms)** — `App.jsx:584-589`.
  _Remediation:_ `replaceState` synchronously; wrap session detection in
  try/catch so cleanup always runs.
- **No maxLength on several text inputs** (song title/artist/notes, setlist
  name) — `editor/MetadataPanel.jsx`, `setlist/SetlistMetaForm.jsx:94`.
  Unbounded → storage/UI-break. _Remediation:_ cap (title 200, artist 150,
  notes 1000, setlist 200). **Ties to backlog §1 field-limits.**
- **ZIP import manifest not schema-validated** — `JSON.parse` of `_setlist.json`
  with no shape check. _Remediation:_ validate before processing.
- **`window.opener.localStorage` accessed without origin check** —
  `pdfDocument.js:658-672`. _Remediation:_ compare origins first.

### Confirmed non-issues
No `dangerouslySetInnerHTML`/`innerHTML`/`eval`/`document.write` on user data;
markdown is not rendered as raw HTML; share snapshot rendering goes through
React escaping; security headers (HSTS, X-Frame-Options, etc.) present.

### Suggested fix order
1. (Backlog quick win) input maxLengths — overlaps §1 field-limits.
2. PDF prefs shape validation + ZIP manifest validation.
3. Share token entropy bump + synchronous OAuth cleanup.
4. PDF nonce → then enforce CSP (bigger, do deliberately).

---

## Scale / performance audit

**Overall:** well-architected for small/medium teams. Already solid: CAS
conflict detection, lazy-loaded views, 30-day tombstone TTL, 2s sync debounce,
heavy `useMemo` in Library, RLS everywhere. Four bottlenecks bite at the target
scale (~100 churches × 50 members × up to ~1k songs/library).

### Tier 1 — will break / badly degrade at scale
- **Full-blob song persistence** — `App.jsx:562` → `storage.js:172`: every
  single-song edit rewrites the **entire** `{schemaVersion, songs}` blob to
  IndexedDB. At ~1k songs that's multi-MB per save, every debounce. _Fix:_
  per-song records / delta writes (write only changed ids). _(Medium effort.)_
- **Unbounded Supabase selects** — `hooks/useTeamSchedules.js:18` and
  `hooks/useTeamAvailability.js:30` `select('*')` with **no `.limit()`** and a
  full re-fetch on every realtime event. (Activity feed already caps at 100.)
  _Fix:_ add `.limit()` + date-range filter (e.g. next 90 days). _(Low effort.)_
- **Missing `team_id` index** — `team_songs`/`team_setlists` have a composite
  `(team_id, title)` unique index but no standalone `team_id` index, so
  `select().eq('team_id', …)` can seq-scan at 100k rows. _Fix:_
  `create index … on team_songs(team_id);` (+ setlists). _(1 SQL line.)_
- **Sync hashes the whole library every pull/push** — `team-engine.js`
  pull/push loops `quickHash` every row each cycle. _Fix:_ cache per-song hash
  across the cycle / use server content-hash. _(Medium effort.)_

### Tier 2 — will degrade noticeably
- **Serial push loop** — `team-engine.js` pushes one row per round-trip; ~1k
  serial requests on 3G is brutal. _Fix:_ batch with `Promise.all` (e.g. 50 at a
  time) or a bulk-upsert RPC.
- **Search not debounced** — `Library.jsx:373` re-filters all songs per
  keystroke. _Fix:_ `useDeferredValue(query)` (React 19) — tiny change.
- **`SongCard` not memoized** — `SongCard.jsx:23`: selecting a preview re-renders
  all ~100 visible rows. _Fix:_ wrap in `React.memo`.
- _(Note: rendering is already windowed to 100 rows in Library; the in-memory
  full array is the cost, not the DOM.)_

### Tier 3 — minor / monitor
- **Realtime echo not cancelled** — `useTeamRealtime.js` doesn't call the
  existing `recentlyPushed(4000)` guard, so our own push can trigger a redundant
  full sync. _Fix:_ early-return when `recentlyPushed()`. _(3 lines — easy win.)_
- Main bundle >500kB (sync engine could be lazy); `team_activity` has no
  retention policy (grows unbounded).

### Suggested quick wins (small, safe, high value — candidates to do next)
1. `team_id` indexes (1 migration).
2. `.limit()` + date filter on schedules/availability queries.
3. Realtime `recentlyPushed()` echo guard.
4. `React.memo(SongCard)` + `useDeferredValue` search.

The deeper two (per-song persistence, incremental sync hashing) are ~3–4 days
total and should be scheduled deliberately, not rushed.
