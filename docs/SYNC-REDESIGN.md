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
   **Fixed** in step 5 (§5.6): the wire is the whole JSON document.
3. **`keyChanges` and `duration` never leave the device** — `songToMd`'s v2
   view omits both (PLAN §2.3). **Fixed** twice in step 5: they ride the JSON
   document, and the two view fields were added so `.md` export carries them.
4. **The personal library is not in Supabase at all.** BYOC sync (file engine +
   three providers + `cloud-token-exchange`, ~1,400 lines) serves no one, and
   two devices on one account do not share personal songs. **Fixed** in step 4
   (§5.5): the personal library is a workspace on Supabase; the providers stay
   as an opt-in folder sync (owner's call, §4.3).
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
- **`doc jsonb`** (step 5, shipped): the full v2 song with all arrangements is
  the wire format. `content` (markdown) stays beside it for the builds that
  still read it; a markdown write that does not bring a document drops the
  row's document (`trg_guard_song_doc`), so a stale document never outlives
  the markdown it disagrees with. Format changes stop being sync-breaking.

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
| Markdown vs. JSON on the wire | **JSON (`doc`), with markdown dual-written** — step 5, 2026-09-10 | The document carries what markdown flattens away (every arrangement, the overlay, the length, the tab library). Dual-writing the markdown kept it additive: no client had to move first, and the MAJOR was avoided. Dropping `content`/`content_hash` waits until no build reads them. |
| Client id as primary key | **Deferred** (step 5b) | It would retire the row-UUID bridge (`useTeamSetlistMap`), but it re-keys `team_schedules.setlist_id`, the version history, the activity feed's `entity_id` and every FK — a migration on its own, for a bridge that now costs one map lookup. Not worth a MAJOR-sized risk while the replica is a day old. |
| Hand-rolled vs. PowerSync | **Hand-rolled** | PowerSync fits Supabase but adds a hosted service and a SQLite runtime for 180 KB of data. |
| Personal library | **A workspace in the same tables** (`teams.kind = 'personal'`, no members) | One engine, one code path. Shipped in step 4 (§5.5). |
| BYOC folders (Drive/Dropbox/OneDrive) | **Kept, as an alternative the user opts into** — revised 2026-09-10 on the owner's word | The owner's product reason: not everyone wants a subscription, and "your songs in your own Drive" is a real pitch. As *sync infrastructure* it stays the weak option (per-file last-writer-wins, three provider APIs, OAuth token upkeep, no change feed, no realtime) and it is not what makes two devices of one account converge. Rule: a connected folder **wins** over the personal workspace on that device; the two never run together on one library. Recommendation for later: turn BYOC into a **one-way backup/export mirror** of the Supabase library (a folder of `.md` files the user owns, written after each sync) rather than a second sync engine — that keeps the pitch and deletes the merge problem. Note that today BYOC is gated only by being signed in; the `cloud-sync` entitlement (sync tier / one-time Pro) gates the personal workspace instead. |
| Who may write | **admin · leader · editor**, RLS decides | Unchanged. The client mirrors it in `lib/teamRoles.js`; the two must agree. |

## 5. Agenda

| # | Step | Status |
| :-- | :-- | :-- |
| 1 | Hotfix the pull merge (the live loop) | ✅ `96192ba`, 2026-09-09 |
| 2 | Server foundations: `version`, `seq`, `updated_by`, `team_deletions`, `apply_ops`, `sync_changes` | ✅ `supabase/migrations/20260910_sync_versions.sql` — validated (§5.1) and **applied to production 2026-09-10** (0 null cursors, feed row counts match the tables, no new advisor findings) |
| 3a | The replica for **members** (15 of 21 users, lowest risk), behind the `createEngineForLibrary` seam | ✅ `src/sync/replica-engine.js`, 2026-09-10 — see §5.2 |
| 3b | The replica for **writers**: the outbox over `apply_ops`, `merge.js` for conflicts | ✅ 2026-09-10 — see §5.3; the manifest engine is now only the replica's fallback |
| 3c | Delete the team manifest engine (`team-engine.js`, `supabase-team.js`, their two suites) and the replica's fallback to it | ✅ 2026-09-10, on the owner's word — see §5.4 |
| 4 | Personal workspace on Supabase (`20260911_personal_workspaces.sql`, `usePersonalWorkspace`, the replica pointed at the account's own `teams` row) — the file engine and providers **stay** as an opt-in folder sync (§4.3) | ✅ 2026-09-10, migration **applied to production** — see §5.5 |
| 5 | `doc jsonb` as the wire format (`20260911_json_wire.sql`, `sync/songDoc.js`, the replica reads/writes documents, markdown dual-written; `keyChanges`/`duration` also added to the `.md` export) | ✅ 2026-09-10, migration **applied to production** — see §5.6 |
| 5b | Client id as primary key; drop `content`, `content_hash`; retire `canonical.js` for the replica | ⬜ deferred (§4.3) — prerequisites: no build reads `content` (a release cycle after 5 ships), and a decision on whether the PK change is worth its own migration |
| — | DB hygiene: `(select auth.uid())` in policies, drop the duplicate "Admins can …" write policies, add `leader` to `team_invites.role` | ⬜ separate migration |
| — | `keyChanges` / `duration` serialization (PLAN §2.3) | ✅ with step 5 — two view fields in `songToMd`, round-trip test in `song-doc.test.js` |

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

### 5.2 Step 3a — what shipped

- `src/sync/replica-engine.js`: a member's device pulls `sync_changes(team,
  since)` in pages of 500, folds songs / setlists / deletions into its local
  maps in feed order, and persists `{ since, rows }` under `sync:<team>.replica`.
  `rows` is the server set as the device knows it; a local item the feed never
  named is dropped (App's trash keeps it 30 days). Untouched songs keep object
  identity, so IndexedDB writes and "edited" churn stay at zero. Nothing ever
  writes. If the RPC is missing (a project without the migration) it falls back
  to the read-only manifest engine for the session.
- `createEngineForLibrary` in `App.jsx` hands read-only team libraries to it;
  writers stay on the manifest engine until 3b.
- `useTeamSetlistMap` reads the local→row-UUID mapping from `replica.rows`
  when present (schedules and calendars keep resolving for members).
- `useTeamRealtime` also subscribes to `team_deletions` inserts, so a delete
  reaches open devices — the DELETE event on the song table never passed the
  `team_id=eq.` filter.
- `SyncDoctor` knows a mirror: no baseline, nothing to push, a difference means
  "the next pull adopts the server".
- Tests: `replica-engine.test.js` (11) — first pull, delta pull with cursor and
  reference preservation, deletions, leftovers dropped, play histories kept,
  never writes, paging, RPC-missing fallback, feed-order semantics, and a
  writer-on-manifest-engine + member-on-replica convergence run with a seeded
  fuzz. The fake Supabase client now emulates `trg_sync_stamp`,
  `trg_record_deletion` and `sync_changes`.
- Known property (pinned by a test): a delta feed does not re-send unchanged
  rows, so a local mutation of a member's copy lingers until that row next
  changes on the server. The UI forbids member writes; the manifest engine had
  the same property.

### 5.3 Step 3b — what shipped

- **Every team library runs the replica.** `createEngineForLibrary` hands all
  of them to `sync/replica-engine.js`; the manifest engine (`team-engine.js`)
  survives only as the fallback on a project without the RPCs.
- **The outbox.** A writer's device keeps a **dirty set**: the keys whose local
  object differs from the copy the server last gave it, each with the
  serialized server copy it was based on. Change detection is object identity
  (the signal `saveSongs` and `adopt.js` already rely on); across a reload the
  dirty set is persisted with its bases, so a reload pushes exactly the edits
  that had not reached the server. Pushes go to `apply_ops` in batches of 100
  with `base_version`; applied puts update `rows` (version, seq, row id) and
  clear the key; a new object with identical bytes (play counts, a re-link
  that changed nothing) is not an edit and is not sent.
- **Conflicts.** A push conflict asks App for a pull (`onPullNeeded` →
  `triggerSync`). The pull runs `sync/merge.js` three-way with the persisted
  base: disjoint edits merge silently and stay dirty on top of the server
  copy; a real conflict adopts the server copy and hands ours to the existing
  `ConflictResolver` (its "keep mine" restores the local object, which is then
  an edit on top of the server's version and pushes cleanly). An edit beats a
  concurrent delete (the song comes back as a create); a stale delete loses to
  a newer edit (the tombstone is dropped). `merge.js` now compares arrangements
  without their `updatedAt`/`id` stamps — with them in, every disjoint edit
  degraded into a conflict.
- **Handover.** A writer's first run reads the old manifest one last time:
  local ≠ baseline while server = baseline is a pending edit (pushed); both
  moved is a conflict (server adopted, ours in the prompt); local = baseline or
  canonical-equal is nothing; unmanifested local items are creates;
  manifested items the server lost are dropped unless edited here. The
  manifest is never read again.
- **Temp engines** (a song moved or copied into another library) push only the
  keys the server lacks and persist nothing — no adopted state exists to
  anchor a cursor.
- **`apply_ops` returns `row_id`** (`20260910_apply_ops_row_id.sql`, applied)
  so a freshly created setlist can be scheduled at once.
- **SyncDoctor** speaks the replica's arithmetic for everyone: in sync /
  pending push / newer on the server / diverged, from `rows` + `dirty`.
- Tests: `replica-writer.test.js` (19) — create/edit/delete lifecycle and
  silence in steady state, identical-bytes suppression, same-field conflict
  with "keep mine", disjoint three-way merge, edit-beats-delete both ways,
  dirty set across a reload, three-way merge from a persisted base after a
  reload, a two-writers-plus-member seeded fuzz, the manifest handover (six
  cases in one library), the temp-engine push, chunking, an RLS refusal, the
  RPC-missing fallback, setlists, and an old manifest-engine build sharing
  the server with the replica.

### 5.4 Step 3c — what went

- `src/sync/team-engine.js` (800 lines), `src/sync/supabase-team.js` (the
  provider shim, 299), `team-engine.test.js` and `team-convergence.test.js`
  (776). `provider.js` no longer routes `supabase-team:` names.
- The replica's fallback. A project without the RPCs now gets
  `MIGRATION_MISSING` as the error, status `error`, and no sync; a device that
  has not completed a first pull never mints a replica state on a failed push.
- Kept on purpose: `canonical.js` (the one-time handover from the old
  manifest, `content_hash` on writes so the activity trigger's no-op guard
  keeps working, and the file engine), `amplification-guard.js` and the
  manifest functions in `tokens.js` (the file engine), `mergeRemote.js` (both
  engines), `adopt.js`, `lock.js`, `retry.js`, `merge.js`.
- The two tests that used the old engine as "another writer" now use a replica
  writer; the "stale build still writing" case is simulated with a direct
  table write, which is what a stale PWA build actually does.

### 5.5 Step 4 — what shipped

- **Server.** `supabase/migrations/20260911_personal_workspaces.sql`:
  `teams.kind` (`personal | team | church`, default `team`), `plan` may now be
  `personal`, a partial unique index (one personal row per owner), and
  `ensure_personal_workspace()` (security definer, authenticated only,
  idempotent, race-safe). A personal workspace is a `teams` row with **no
  `team_members` row**: every `owner_id = auth.uid()` clause in RLS, both
  RPCs, realtime and the version history already accept it; the switcher
  loads workspaces through memberships so it never appears there and never
  counts toward the owned-workspace limit; account deletion cascades through
  `owner_id`. Validated in a rolled-back probe (idempotent RPC; owner writes
  through `apply_ops`, reads through `sync_changes`, history captured; a
  stranger gets an empty feed, `42501`, and cannot see the row) and applied to
  production the same day. Existing rows read `kind = 'team'`.
- **Client.** `hooks/usePersonalWorkspace.js` calls the RPC once per sign-in
  when the profile is entitled to `cloud-sync` (its own tier or one-time Pro —
  the profile's, never the active team's) and caches the id per user in
  localStorage, so the engine choice at mount is synchronous.
  `createEngineForLibrary('personal')` now returns the **replica** pointed at
  that workspace, with `libraryId: 'personal'` (the same IndexedDB slot and
  Web Lock the file engine used), `providerId: supabase-personal:<id>`, and
  `handoverFromManifest: false` — the personal manifest describes a cloud
  *folder*, and reading it as this server's history would have dropped every
  folder-synced song as "deleted elsewhere" (pinned by a test). A connected
  folder (`syncState.provider` naming a non-`supabase-` provider) wins: the
  file engine is created instead, also at load time when the stored sync
  state says a folder is connected. Realtime subscribes to the personal
  workspace like a team's. Settings → Sync shows a "Setlists.md cloud — On"
  card above the folder providers; disconnecting a folder clears the personal
  replica so its next run reconciles from scratch.
- **Not solved, on purpose.** Two devices each seeded with the demo songs
  (different generated ids) union to duplicates on their first personal sync.
  Edits made while a folder was connected are not pushed to the workspace
  until the folder is disconnected (then the fresh run reconciles: local-only
  → create, diverged → conflict prompt). Both are consequences of keeping BYOC
  as a second engine — see the §4.3 recommendation.
- `canonical.js`, `amplification-guard.js` and the manifest functions in
  `tokens.js` therefore stay (the file engine is still shipped).

### 5.6 Step 5 — what shipped

- **Server.** `supabase/migrations/20260911_json_wire.sql`: `team_songs.doc
  jsonb` and `team_song_versions.doc jsonb`; `apply_ops` accepts `doc` on a
  song put (stored beside `content`; a put without one — an older build —
  keeps the row's document only when the markdown is unchanged; conflict
  payloads carry the server's `doc`; "identical on a stale base" means
  markdown AND document); `sync_changes` returns `doc`; `trg_guard_song_doc`
  (BEFORE UPDATE, first in name order) nulls the document when `content`
  changes without it; the snapshot trigger stores the document and fires on a
  document-only change; the activity guard logs a document-only edit and
  stays silent for a row gaining its FIRST document with the markdown
  unchanged (the upgrade below). Validated in a rolled-back probe (ten
  scenarios, existing rows untouched) and applied the same day.
- **The document** (`src/sync/songDoc.js`): the v2 song with every
  arrangement, minus play histories and `updatedAt` stamps, **normalized** —
  empty strings, nulls, empty arrays, zeros and `structureMode: 'auto'` are
  dropped at the song and arrangement level — so a legacy object and a fresh
  parse of the same song are the same bytes and a build difference never
  reads as a conflict. `songFromDoc` restores the in-app shape (the one
  `songFromFlat` builds) and stamps `updatedAt` from the server.
- **The engine.** `serialize('song')` is the document; `sameBytes` compares
  documents when the row has one and markdown otherwise; a row without a
  document is read from its markdown through `mergeRemote` (which keeps local
  extra arrangements, because a markdown row cannot say they are gone). Each
  row stamp carries `fmt: 'doc' | 'md'`. **The upgrade:** a writer that holds
  a markdown-only row marks it dirty with the markdown as base and pushes the
  document once — on its first pass after the build (rows persisted without
  `fmt`), on every pull that yields a markdown-only row, and on a fresh
  writer's first run. The markdown does not move, the version does; other
  devices pull the row once and keep object identity when the document
  equals what they hold. A dirty base persisted as markdown by the previous
  build still parses (`fromBase` tells the two apart). The handover from the
  manifest engine compares markdown hashes as before and, for a document row
  whose markdown matches but whose document differs, keeps the union of
  arrangements and pushes it — neither side has a base to say who added what.
- **Not done, on purpose.** `content`/`content_hash` stay and are still
  written; the client id is not the primary key (§4.3). The activity feed
  will show "edited" once for songs whose markdown gained the `duration:` /
  `keyChanges:` lines the export used to drop — the markdown really changed.
- Tests: `song-doc.test.js` (the document, normalization, the demo songs
  round-tripping through markdown without loss) and seven wire cases in
  `replica-writer.test.js` (a push carries the whole song; a member never
  upgrades; the upgrade on a device that synced before step 5; an older
  build's markdown write drops the document and the extra arrangement is
  restored; two writers upgrading one row without a prompt; a markdown base
  from the previous build; the conflict payload carrying the document).

Step 2 is additive and safe on live data; step 3a is the first one the owner can
see: a member's device now mirrors the feed; 3b puts every writer on the same
engine; 3c leaves the replica as the only team engine. Apply step 2 with the Supabase CLI (`supabase db push`) or by pasting the
migration into the SQL editor; the old engines keep working unchanged after it.

## 6. Open questions for the owner

1. ~~Apply step 2 to production now?~~ Applied 2026-09-10 on the owner's word.
2. **Retention for `team_deletions`.** Tombstones are tiny; a 90-day prune in
   `prune_team_history()` is the obvious home once a replica exists to consume
   them.
3. ~~**Step 5's MAJOR.**~~ Avoided: the markdown is dual-written, so an old
   client reads what it always read. Multi-arrangement songs sync as of step 5.
   What remains for later is the cleanup (5b: drop `content`/`content_hash`,
   decide on the primary key) — do it a release cycle after every build reads
   the document.
4. **BYOC's future shape.** Keep it as a second sync engine (today), or turn
   it into a one-way backup mirror of the Supabase library (§4.3's
   recommendation)? The mirror keeps "your songs in your Drive" and the
   no-subscription pitch only if the personal workspace itself is free or
   one-time — which is a pricing decision, not a sync one.
5. **Demo songs on a second device.** Seed demos only when the workspace is
   empty after the first pull (or give them fixed ids) so two devices do not
   union to six demo songs.
