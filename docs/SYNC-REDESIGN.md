# Sync redesign — server-first with an offline replica

> _Written 2026-09-09/10 from a read of both engines, `App.jsx`'s orchestration,
> every migration, and the live database. This is the decision log and the
> sequenced agenda for replacing the sync layer. `CLAUDE.md` says how the
> current engines work; this file says what replaces them and why._

## 1. Verdict

Keep offline **reading**. Drop offline-first **writing**.

Today every device treats its local copy as a peer that must be reconciled
against the server: canonical hashes, manifests, baselines, tombstones,
hash-version migrations, circuit breakers, an amplification guard, a trash
safety net. That model is the root of every sync bug in this repo's history and
was still producing one on 2026-09-09 (§2). The replacement is a
**server-authoritative replica with an outbox**: the server is the only truth,
each device holds a cache of what the server said, and a writer device may only
ever send the edits it made itself, never its whole file. Members are a pure
read replica. The same rule applies to a leader's device.

## 2. What was measured (production, 2026-09-09)

| Measure | Value |
| :-- | :-- |
| Workspaces | 3 churches |
| Members | 21 (15 member, 4 admin, 1 leader, 1 editor) |
| Songs | 359, avg 1.1 KB |
| Setlists | 66, avg 2 KB |
| Largest library | ~180 KB total |
| BYOC cloud tokens | 0 rows — nobody uses Drive/Dropbox/OneDrive sync |
| Songs with a `keyChanges` line on the server | 0 of 359 |

Findings, in severity order:

1. **The ping-pong loop was alive on the current build.** `team_song_versions`
   showed songs alternating between two hashes every 3–5 s, same account both
   sides, differing only by `language:` and `year:`. Cause: the pull-side merge
   carried six fields and dropped every newer one; the device re-hashed its
   stale copy and pushed it back. **Fixed** in `src/sync/mergeRemote.js`
   (PLAN §1.2 #6). The stale-client half is operational.
2. **Multi-arrangement songs never sync.** The wire format is the markdown of
   the default arrangement; a second arrangement never leaves the device.
3. **`keyChanges` and `duration` never leave the device** — `songToMd`'s v2
   view omits both (PLAN §2.3). Separate two-line fix, one re-upload per
   affected song.
4. **The personal library is not in Supabase at all.** BYOC sync (file engine +
   three providers + `cloud-token-exchange`, ~1,400 lines) serves no one, and
   two devices on one account do not share personal songs.
5. **Identity is split.** Local base-36 id ↔ server UUID, bridged by a manifest
   in IndexedDB (`useTeamSetlistMap`). `team_schedules.setlist_id` points at
   the UUID. Lose the manifest and the bridge is gone.
6. **Deletes are inferred from absence.** "Row missing from a head fetch means
   deleted" is why the engine needs keyset pagination, mass-delete breakers and
   a trash safety net, and it once wiped a church library.
7. **Compare-and-swap keys on a timestamp string.** Works; fragile.
8. **DB hygiene** (advisors + the step-2 probe): 47 policies re-evaluate `auth.uid()` per row;
   the `handle_new_team` owner auto-membership trigger is missing in production;
   `team_songs`/`team_setlists` carry two overlapping write-policy sets ("Admins
   can …" from 0521 was never dropped when "Team editors can …" landed);
   `team_invites.role` still forbids `leader`; leaked-password protection off.

## 3. Principles

1. **The server is the only truth.** A device never "has" a library; it has a
   cache of the server's library at sequence _N_.
2. **A device may only send its own edits.** An outbox of operations with a base
   version. Never "my copy of the file".
3. **Versions, not hashes.** Change detection is an integer the server stamps.
   Zero hashing, zero canonical forms, zero hash-version migrations.
4. **Deletes are data.** A deletion is a row in the same change feed. Nothing is
   inferred from absence.

## 4. Target design

### 4.1 Server (Supabase)

- **Workspaces.** `teams` gains `kind ∈ personal|team|church`; every signed-in
  user gets a personal workspace row from a trigger. Personal songs live in the
  same tables as team songs. Guests stay local-only with a null transport.
- **Identity.** The client-generated id (`song_key` / `setlist_key`) is the
  identity the API speaks. The row UUID never leaves the server. (Step 5 makes
  it the primary key; until then the RPCs hide it.)
- **Columns** (shipped in step 2): `version int` bumped on every real change,
  `seq bigint` from one global sequence, `updated_by uuid`. A no-op write is
  frozen to the old stamps so it wakes no replica.
- **Deletions** (step 2): `team_deletions(team_id, kind, key, row_id, seq,
  deleted_by, deleted_at)` written by an `AFTER DELETE` trigger. Hard deletes
  stay, so FK cascades, the activity trigger's DELETE branch and every existing
  reader are unchanged.
- **`apply_ops(team, ops)`** (step 2): the write door. A batch of
  `{kind, op: put|delete, id, base_version, content, title}` in one transaction.
  Base-version mismatch returns the server copy as a conflict; identical
  content on a stale base counts as applied (idempotent retries). Security
  invoker: RLS decides who writes.
- **`sync_changes(team, since, limit)`** (step 2): the read door. Songs,
  setlists and deletions after a cursor, one query, ordered by `seq`, with
  `next_seq` and `more`.
- **Ordering.** `seq` is assigned under a per-workspace advisory lock held to
  commit, so a cursor can never skip a row that commits late.
- **Later** (step 5): `doc jsonb` as the wire format — the full v2 song with all
  arrangements. Markdown becomes import/export only. Format changes stop being
  sync-breaking.

### 4.2 Client

- **One `Replica` per workspace** (~400 lines): `docs: Map<id, {doc, version,
  seq}>`, `lastSeq`, `outbox[]`, persisted per doc in IndexedDB (already the
  storage shape), exposed through `useSyncExternalStore`. It replaces both
  engines, `adopt.js`, `canonical.js`, `amplification-guard.js`, `tokens.js`,
  tombstones, stored conflicts, the trash safety net, `useTeamSetlistMap` and
  ~600 lines of App.jsx orchestration.
- **Edit** → apply to the replica optimistically, append an op, drain after a
  1 s debounce under a Web Lock. **Launch** → render the cache, pull the delta,
  subscribe to realtime. **Realtime** → apply the row from the event; a
  `team_deletions` insert carries `team_id`, so deletes arrive too. **Reconnect**
  → drain, then pull.
- **Conflict** → the existing `src/sync/merge.js` three-way merge, finally with
  a real base (the replica's last server doc). Metadata merges silently; a chart
  both sides changed prompts keep mine / keep theirs / save mine as a new
  arrangement.
- **Members** → a read-only replica. No outbox exists, no conflict path, no
  local write API. Offline reading is unchanged.
- **The reader pins the `seq` it opened with.** A change arriving mid-service
  shows a "chart updated" pill instead of re-laying out.

### 4.3 Decisions

| Decision | Choice | Why |
| :-- | :-- | :-- |
| Soft delete vs. tombstone table | **Tombstone table** | Soft delete makes every reader filter `deleted_at` (schedules, calendars, maps), breaks FK cascades, and old clients would keep showing deleted songs during the rollout. The tombstone keeps hard deletes and gives the feed its delete row. Shared server-side trash can come later from `team_song_versions`. |
| Markdown vs. JSON on the wire | **Markdown now, JSON in step 5** | The replica does not depend on the payload shape; changing it is a MAJOR-flavoured conversation on its own. |
| Hand-rolled vs. PowerSync | **Hand-rolled** | PowerSync fits Supabase but adds a hosted service and a SQLite runtime for 180 KB of data. |
| Personal library | **A workspace in the same tables** | One engine, one code path; retires the file engine and three OAuth providers. |
| Who may write | **admin · leader · editor**, RLS decides | Unchanged. The client mirrors it in `lib/teamRoles.js`; the two must agree. |

## 5. Agenda

| # | Step | Status |
| :-- | :-- | :-- |
| 1 | Hotfix the pull merge (the live loop) | ✅ `96192ba`, 2026-09-09 |
| 2 | Server foundations: `version`, `seq`, `updated_by`, `team_deletions`, `apply_ops`, `sync_changes` | 📄 `supabase/migrations/20260910_sync_versions.sql`, 2026-09-10 — **validated, not yet applied** (see §5.1) |
| 3 | The replica for **members** (15 of 21 users, lowest risk), behind the `createEngineForLibrary` seam; then for writers with the outbox | ⬜ |
| 4 | Personal workspace on Supabase; retire the file engine, the three providers and `cloud-token-exchange` | ⬜ |
| 5 | `doc jsonb` as the wire format; client id as primary key; drop `content`, `content_hash`, the manifest, the old sync tree | ⬜ |
| — | DB hygiene: `(select auth.uid())` in policies, drop the duplicate "Admins can …" write policies, add `leader` to `team_invites.role` | ⬜ separate migration |
| — | `keyChanges` / `duration` serialization (PLAN §2.3) | ⬜ two lines + a round-trip test |

### 5.1 How step 2 was validated

The whole migration plus a functional probe ran against the **production**
schema inside one transaction that ends in `RAISE EXCEPTION`, so it rolled back
by construction (confirmed afterwards: no new table, sequence, columns or
functions; no probe team). The probe ran as the owner's account
(`set local role authenticated` + `request.jwt.claims`), so RLS was live:

| # | Check | Result |
| :-- | :-- | :-- |
| 1 | `put` with no row → insert | v1, seq assigned |
| 2 | `put` with base 1 → update | v2, seq advanced, `updated_by` stamped |
| 3 | `put` with stale base, different content | conflict `version`, server v2 content returned |
| 4 | `put` with stale base, identical content (a retry) | applied at v2, nothing bumped |
| 5 | plain `UPDATE` touching only `content_hash` / `updated_at` | frozen: version, seq, updated_at unchanged |
| 5b | plain `UPDATE` of `content` (the old engine's path) | v3, seq advanced |
| 6 | setlist create, then an identical put with keys reordered | v1 both times (jsonb equality) |
| 7 | `delete` with stale base → conflict; with base 3 → row gone, 1 tombstone, `song_removed` activity row logged | ✓ |
| 8 | `sync_changes(team, 0)` → setlist then deletion in seq order; tail after `next_seq` empty; `limit 1` sets `more` | ✓ |
| 9 | a stranger: `apply_ops` → 42501; `sync_changes` → empty feed | ✓ |

One aside the probe surfaced: creating a team as the owner produced **no**
`team_members` row — the `handle_new_team` trigger from `20260429` is not
present in production (the client inserts the admin row itself, so nothing is
broken; the RPC's writer check accepts the owner either way).

Step 2 is additive and safe on live data; step 3 is the first one the owner can
see. Apply step 2 with the Supabase CLI (`supabase db push`) or by pasting the
migration into the SQL editor; the old engines keep working unchanged after it.

## 6. Open questions for the owner

1. **Apply step 2 to production now**, ahead of step 3, or together with it?
   Additive either way; applying early lets the tombstone feed start recording.
2. **Retention for `team_deletions`.** Tombstones are tiny; a 90-day prune in
   `prune_team_history()` is the obvious home once a replica exists to consume
   them.
3. **Step 5's MAJOR.** Moving the wire format to JSON is the moment multi-
   arrangement songs start syncing. It is also the one step that changes what an
   old client can read. Decide whether it rides the 1.0 conversation.
