# Sync and push

How the replica engine syncs every library, the backup mirror, and the Web Push worker. Decision log: `docs/SYNC-REDESIGN.md`. Moved out of CLAUDE.md on 2026-11-15; nothing here changed.

## Team library sync (src/sync/replica-engine.js)

Team libraries sync through the **replica engine**. The server is the only
truth; every device holds a cache of the server's library at a feed position;
a writer's device sends only its own edits. `docs/SYNC-REDESIGN.md` is the
decision log and agenda. The server half is `20260910_sync_versions.sql`
(`version`/`seq`/`updated_by`, `team_deletions`, `apply_ops`, `sync_changes`).
The manifest engine that preceded it (`team-engine.js`: canonical hashing of
the whole library, CAS on `updated_at`, identity healing, circuit breakers,
an amplification guard) was **deleted in step 3c, 2026-09-10**. The file-manifest
engine for Drive/Dropbox/OneDrive folders (`engine.js`) went on 2026-09-11:
**a connected folder is a one-way BACKUP MIRROR** (`sync/backup.js`), never a
sync engine (SYNC-REDESIGN §4.3, §5.7).

- **The personal library is a workspace too** (step 4, 2026-09-10): a `teams`
  row with `kind = 'personal'` and no members, created by
  `ensure_personal_workspace()` through `hooks/usePersonalWorkspace.js` when
  the **profile** is entitled to `cloud-sync` (never the active team's plan).
  `createEngineForLibrary('personal')` returns the replica pointed at that
  row with `libraryId: 'personal'` (the same IndexedDB slot + Web Lock the
  file engine uses), `providerId: supabase-personal:<id>` and
  **`handoverFromManifest: false`** — the personal manifest describes a cloud
  FOLDER, and reading it as this server's history drops every folder-synced
  song as "deleted elsewhere" (a test pins this). Without cloud sync the
  personal library gets `NULL_ENGINE` (no-op, same interface). The **demo
  songs have fixed song and arrangement ids** (`data/demos.js`) and App passes
  `seedBaselines` (the demo markdown) so a seed is its own baseline on a
  first run: unedited → adopts the account's copy, edited → three-way merge
  against the demo, deleted elsewhere → dropped, never seen → uploaded.
- **The backup folder is a mirror, not sync** (`sync/backup.js`,
  2026-09-11): `createBackupMirror` writes one `.md` per song and one `.json`
  per setlist to the connected Drive/Dropbox/OneDrive folder after every
  change (fed by the auto-save effects and the pagehide flush) and never
  reads it back on its own; `restore()` is the one read, on request, and App
  adds only what the library lacks (by the file's `songId`). One instance for
  the app's life — it reads `activeProvider` from the stored sync state on
  every run, so connect/disconnect need no re-creation. Its `backupState`
  (provider, lastBackup, `needs-reconnect`) is separate from `syncState`.
  Manifests (`syncManifest`/`setlistManifest` in the sync state) now hold the
  remote file id + name + a hash of the bytes written. It shares the personal
  library's Web Lock with the replica because both read-modify-write the
  same sync-state record. The mass-delete guard (`isMassDelete`) stays: a
  truncated local state must never empty the backup.

- **The wire is a JSON document** (step 5, `sync/songDoc.js`): a song row's
  `doc` is the whole v2 object — every arrangement, `keyChanges`, `duration`,
  the tab library, unknown frontmatter — minus play histories and `updatedAt`
  stamps, NORMALIZED (empty/zero/default fields dropped at the song and
  arrangement level) so a legacy object and a fresh parse are the same bytes.
  `content` (markdown, one arrangement) is written beside it for older
  builds; a row WITHOUT a document was written by such a build and is read
  from its markdown (`mergeRemote`, which keeps local extra arrangements).
  Row stamps carry `fmt: 'doc' | 'md'`; a writer holding an `'md'` row (or a
  stamp without `fmt`, persisted before step 5) pushes its document once —
  the "upgrade" — with the markdown as base, on its first pass. A dirty base
  may be a document string or markdown; `fromBase` tells them apart. Never
  put a device-derived or default-valued field into the document without
  normalizing it: two devices would then disagree about an unchanged song.
- **Pull** = `sync_changes(team, since)` in pages of 500: songs, setlists and
  deletions after the cursor, in feed order. The device persists
  `{ since, rows, dirty, writer }` under `sync:<team>.replica`; `rows` is the
  server set as this device knows it (version, seq, row id, wire format). A local item
  neither in `rows` nor dirty is not on the server and is dropped (App's trash
  keeps it 30 days). A version the device already holds is skipped — its own
  pushes echo back for free. A clean row whose bytes equal the local copy keeps
  object identity, so an unchanged song is neither rewritten to IndexedDB nor
  reported as edited.
- **Members** (`readOnly`) are a pure mirror: no dirty set, no outbox, never a
  conflict prompt. A delta feed does not re-send unchanged rows, so a local
  mutation (which the UI forbids) lingers until that row next changes.
- **Writers** keep a **dirty set** — the keys whose local object differs from
  the copy the server last gave them. Object identity is the change signal
  (the one `saveSongs` and `adopt.js` already rely on); the dirty set is
  persisted with the serialized server copy each edit was based on, so a
  reload pushes exactly the unpushed edits. Only those, plus tombstones, go to
  `apply_ops` (batches of 100) with `base_version`. A new object with
  identical bytes (play counts, a re-link that changed nothing) is not sent.
- **Conflicts.** A push conflict asks App for a pull (`onPullNeeded` →
  `triggerSync`). The pull merges three-way through `sync/merge.js` with the
  persisted base: disjoint edits merge silently and stay dirty on top of the
  server copy; a same-field conflict adopts the server copy and hands ours to
  the `ConflictResolver` ("keep mine" restores the local object, which is then
  an edit on top of the server's version and pushes cleanly). An edit beats a
  concurrent delete (the song comes back as a create); a stale delete loses to
  a newer edit (the tombstone is dropped).
- **Handover.** A writer's FIRST run (no replica state yet) reads the old
  manifest once: local ≠ baseline while server = baseline is a pending edit
  (pushed); both moved is a conflict; local = baseline or canonical-equal is
  nothing; unmanifested local items are creates; manifested items the server
  lost are dropped unless edited here. The manifest is never read again —
  `canonical.js` survives for this, for `content_hash` on writes, and for the
  file engine.
- **Temp engines** (a song moved/copied into another library) push only the
  keys the server lacks and persist nothing — no adopted state exists to
  anchor a cursor.
- **A project without the RPCs** gets `MIGRATION_MISSING` as the error, status
  `error`, and no sync. There is no other engine.
- **`sync/merge.js` compares arrangements without `updatedAt`/`id`.** A base
  rebuilt from markdown carries a fresh stamp; with the stamp in the compare,
  every disjoint edit was a conflict.
- **Pull adoption is WHOLESALE** (`songFromDoc` for a document row;
  `sync/mergeRemote.js` for a markdown row and the file engine): a pulled
  song replaces the local copy; only the play histories (and, for a markdown
  row, local-only extra arrangements) survive from the local object. Never
  patch a hand-written field list there — the six-field patch
  it replaced kept every newer field stale after a pull, and the re-push of
  those stale values was the `language`/`year` ping-pong (PLAN §1.2 #6).
- **Every sync pass holds a Web Lock** (`sync/lock.js`,
  `setlists-md:sync:<libraryId>`) around fullSync/push in both the replica and
  the file engine. The replica re-reads its persisted state inside the lock,
  so a second tab or a temp engine cannot lose its cursor or dirty marks
  (in-memory dirty marks win — they are edits this tab saw happen).
- **Sync results are adopted via `sync/adopt.js`** (`reconcileAdopt` /
  `applyPulled` through App's `adoptSyncResult`): adoption runs functionally
  against CURRENT state using the sync's input snapshot as the base, so an
  edit made while the sync was in flight is never clobbered (object identity =
  the change signal). Never `setSongs(result.songs)` a sync result directly.
- **Sync doctor** (`features/settings/SyncDoctor.jsx`, Settings → Sync in a
  team Space) reports from `replica.rows` + `dirty`: in sync / pending push /
  newer on the server / diverged; a local-only item uploads only when dirty.
  A device that has not synced since the upgrade still shows the manifest
  arithmetic.
- `useTeamSetlistMap` reads row UUIDs from `replica.rows` (the manifest as a
  fallback for un-upgraded devices); `useTeamRealtime` listens on `team_songs`,
  `team_setlists` and `team_deletions` — a DELETE event on the song table
  carries only the PK and never passed the `team_id=eq.` filter.
- Tests: `src/__tests__/replica-engine.test.js` (members),
  `replica-writer.test.js` (writers, handover, a two-writers-plus-member fuzz),
  `sync-adopt.test.js`, `merge.test.js`, `merge-remote.test.js`.
  `helpers/fakeSupabase.js` emulates the stamp and deletion triggers,
  `sync_changes` and `apply_ops`, plus a table surface for "stale build"
  scenarios.

## Web Push & the notification worker

- **Pipeline**: DB triggers (`schedule_request` on roster insert,
  `schedule_decline`) write `team_notifications` rows → the `notify-worker`
  edge function (pg_cron, every five minutes) sends RFC 8291/8292 Web Push to each
  recipient's `push_subscriptions` and marks `pushed_at` (at-most-once; dead
  subscriptions pruned on 404/410). It also generates `schedule_maybe_nudge`
  rows server-side (one per schedule, ever).
- **Crypto** is a dependency-free WebCrypto implementation in
  `supabase/functions/notify-worker/webpush.ts`, interop-tested in
  `src/__tests__/webpush-crypto.test.js` against `http_ece` (the RFC author's
  reference lib). Don't swap it for an npm lib without keeping that test.
- **Keys**: the VAPID public key is a client constant (`src/push/vapid.js`,
  overridable via `VITE_VAPID_PUBLIC_KEY`); the private key lives ONLY in the
  service-role-only `app_config` table. Rotating the pair invalidates every
  subscription (users must re-enable push).
- **Client**: `src/push/usePushSubscription.js` (enable/disable per device),
  surfaced as a button in `NotificationTray`; SW handlers in
  `public/push-sw.js`, importScripts'd into the generated Workbox SW
  (`vite.config.js`). In the tray, server schedule rows are SUPPRESSED when a
  live interactive prompt (virtual notification) covers the same
  `schedule_id`, and when the schedule has been resolved — they exist to reach
  lock screens and carry cross-device read state, not to double-render.
- **Heartbeat**: every worker run upserts `worker_last_run`/`worker_last_result`
  into `app_config`; `get_worker_health()` (SECURITY DEFINER, authenticated
  only — whitelists the two heartbeat keys, NEVER the VAPID rows) feeds the
  `WorkerHealthRow` in Settings → Sync diagnostics, which flags >10 min of
  silence as a stalled worker (see `20260703_worker_health.sql`).
