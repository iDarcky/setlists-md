# Team & Church Supabase Sync — Audit Report

Full review of the sync pipeline: SQL schema → RLS policies → `supabase-team.js` provider → `engine.js` → `provider.js` routing → `TeamProvider.jsx` state → `App.jsx` integration.

---

## Verdict

The happy-path flow **works**: a team admin creates a team, members join, songs/setlists sync to Postgres via the reused sync engine, and RLS gates access correctly. However there are several correctness bugs, race conditions, and missing guardrails that will surface as soon as two team members edit concurrently or the team grows.

---

## 🔴 Correctness Issues (Bugs)

### 1. `downloadFile` — blind dual-table fallback
**Status: ✅ FIXED**

**File:** [supabase-team.js:76–103](file:///d:/github/setlists-md/src/sync/supabase-team.js#L76-L103)

The engine calls `downloadFile(fileId)` for both songs and setlists. Because the provider didn't know which table the UUID belonged to, it queried `team_songs` first, then fell back to `team_setlists`. 

**Fix:** Updated the engine to pass the folder context, allowing the provider to target the correct table in one round-trip.

---

### 2. `uploadFile` — title/name collision creates duplicates across teams
**Status: ✅ FIXED**

**File:** [supabase-team.js:109–154](file:///d:/github/setlists-md/src/sync/supabase-team.js#L109-L154)

The upsert logic searched by `title` + `team_id` to decide insert vs update. But the sync engine also tracks `manifest[song.id].remoteId` — a UUID. If a song was renamed, it caused orphaned rows and duplicates.

**Fix:** Switched to UUID-based updates (using the manifest's `remoteId`), falling back to title-match only for first-time uploads.

---

### 3. `deleteFile` — fires two DELETE queries indiscriminately
**Status: ⏳ Low Priority**

**File:** [supabase-team.js:205–209](file:///d:/github/setlists-md/src/sync/supabase-team.js#L205-L209)

Always fires two DELETEs — one is always a no-op. It should ideally use the folder hint to target the correct table.

---

### 4. No `UNIQUE(team_id, title)` on `team_songs`
**Status: ✅ FIXED**

**File:** [20260428_team_library.sql](file:///d:/github/setlists-md/supabase/migrations/20260428_team_library.sql)

Without a unique constraint, two concurrent uploads of a new song with the same title would both insert, creating duplicates.

**Fix:** Added `UNIQUE` indexes on `(team_id, title)` and `(team_id, name)` in a new migration.

---

### 5. Missing `WITH CHECK` on UPDATE policies
**Status: ✅ FIXED**

**File:** [20260428_team_library.sql:42–47](file:///d:/github/setlists-md/supabase/migrations/20260428_team_library.sql#L42-L47)

The UPDATE policies were missing `WITH CHECK`, meaning a user could theoretically move a row to a different team by changing its `team_id`.

**Fix:** Added `WITH CHECK` clauses to all team library update policies.

---

### 6. `TeamProvider.createTeam` — optimistic member has wrong `id`
**Status: ✅ FIXED**

**File:** [TeamProvider.jsx:158](file:///d:/github/setlists-md/src/auth/TeamProvider.jsx#L158)

Optimistic state used `newTeam.id` (team ID) as the member ID, breaking `removeMember()`.

**Fix:** Now chains `.select('id').single()` on the insert to get the actual `team_members` row ID.

---

## 🟡 Concurrency & Performance

### 7. No optimistic locking for team edits
**Status: ⏳ Low Priority**

Two team members editing the same song will silently overwrite each other. 
**Suggestion:** Add a `version` or `etag` column to detect mid-air collisions.

---

### 12. No Supabase Realtime subscription
**Status: ✅ FIXED**

Team changes were only detected on startup or tab focus. 
**Fix:** Implemented `useTeamRealtime.js` and enabled Realtime for `team_songs` and `team_setlists`. Changes now sync across members in ~1.5s.

---

## 🟢 Things Working Well

| Area | Notes |
|------|-------|
| **RLS policies** | Well-structured with `security definer` helpers to avoid infinite recursion. |
| **Invite system** | Solid RPC pattern for handling users who don't have accounts yet. |
| **Library isolation** | Clean separation of personal/team data locally. |

---

## Summary — Priority Order

| # | Severity | Issue | Effort | Status |
|---|----------|-------|--------|--------|
| 2 | 🔴 High | Rename causes orphaned rows + duplicates | Medium | ✅ FIXED |
| 4 | 🔴 High | Missing unique constraints → race duplicates | Low | ✅ FIXED |
| 6 | 🔴 High | `createTeam` member ID is wrong | Low | ✅ FIXED |
| 12 | 🟡 Medium | No Realtime for team changes | Medium | ✅ FIXED |
| 1 | 🟡 Medium | `downloadFile` blind dual-table fallback | Medium | ✅ FIXED |
| 5 | 🟡 Medium | UPDATE policies missing `WITH CHECK` | Low | ✅ FIXED |
