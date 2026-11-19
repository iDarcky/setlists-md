# Supabase schema, entitlements and billing

Tables, RLS, every migration and what it did, plus entitlements, TeamProvider and the dormant Stripe billing. Moved out of CLAUDE.md on 2026-11-15; nothing here changed. Production Supabase is read-only for agents: write SQL files, the owner runs them.

## Supabase Schema

The signed-in experience depends on a `profiles` table with columns:
`id`, `email`, `display_name`, `plan`, `preferences` (JSONB), `avatar_url`,
`updated_at`. `avatar_url` is a public URL into the `avatars` storage bucket
(personal profile picture).

The Teams/Church tier adds these additional tables:

- **`teams`** — `id`, `name`, `location`, `owner_id`, `kind`
  (personal|team|church — `personal` is the owner's private library, no
  members, never in the switcher), `plan` (personal|team|church),
  `max_seats` (10 for team, 30 for church), `logo_url`, `created_at`,
  `updated_at`, plus **per-workspace subscription** columns:
  `subscription_status` (trialing|active|past_due|canceled|unpaid, default
  `active`), `stripe_customer_id`, `stripe_subscription_id`,
  `current_period_end`. `logo_url` is a public URL into the `avatars` bucket
  (church/team logo, admin-editable). **Each workspace is its own billing
  unit** — one Stripe subscription per team, the `owner_id` is the payer, and
  a single user can own many teams (no uniqueness on `owner_id`). The canonical
  tier field is `teams.plan`; the older `teams.billing_plan` column is
  **deprecated** (no longer read — use `teams.plan`).
- **`team_members`** — `id`, `team_id`, `user_id`, `role` (admin|member),
  `invited_by`, `joined_at`, `instruments` (text[], default `{}`).
  Unique constraint on `(team_id, user_id)`. The `instruments` column is the
  per-team list of what the member plays (e.g. `{Drums, Vocals}`); used by the
  leader's roster picker to filter and to default a new schedule's role.
- **`team_schedules`** — `id`, `team_id`, `setlist_id`, `user_id`,
  `availability` (pending|available|unavailable|maybe), `role`.
  Unique constraint on `(setlist_id, user_id)`. **Do not** use a nested
  PostgREST select on `user_id` (e.g. `profiles:user_id(...)`); the
  relationship isn't exposed in the schema cache. Read with plain
  `select('*')` and join client-side against `members` from `TeamProvider`
  (which already enriches each row with `profile`).
- **`team_availability`** — `id`, `team_id`, `user_id`, `date`,
  `status` (available|unavailable|maybe), `notes`. Unique on
  `(team_id, user_id, date)`. Standalone date-based availability,
  independent of any setlist. Members write only their own row; any team
  member can read everyone's. Used by the Schedule (member opts in by
  tapping empty days) and by `BandPanel` (leader sorts/filters candidates
  by who's available on the setlist's date).

RLS policies:
- Members can view their own team and its roster (and nobody else's — a
  signed-in user sees their own membership rows plus the rosters of
  workspaces they belong to or own, since `20260911_db_hygiene`).
- The owner can create/update/delete the team; creating one makes the owner
  an admin member atomically (`on_team_created`, not for personal workspaces).
- Admins (and team owners on self-insert) can add members.
- Admins can update member roles and remove members.
- Any user can remove themselves (leave).

Migrations live in `supabase/migrations/`. Apply them with the Supabase
CLI (`supabase db push`) or copy/paste the SQL into the project's SQL editor.

- `20260424_add_profile_preferences.sql` — adds the `preferences` JSONB
  column that account-level preference sync writes to. The client
  gracefully falls back to the base profile select if this column is
  missing, so sign-in still works before the migration is applied, but
  cross-device pref sync is a no-op until it is.
- `20260427_create_teams.sql` — creates the `teams` and `team_members`
  tables with RLS policies. Required for Team/Church tier features.
- `20260502_team_planning.sql` — adds `team_members.instruments` (text[])
  and creates the `team_availability` table with RLS. The `TeamProvider`
  member load gracefully falls back to selecting without `instruments` if
  the column is missing, so the team library still works before this
  migration is applied — but the roster picker won't see instruments and
  the dashboard calendar's availability marking is a no-op.
- `20260602_add_avatars.sql` — adds `profiles.avatar_url` + `teams.logo_url`
  and creates the public `avatars` storage bucket with RLS (public read;
  users write `users/{uid}/…`; team owners/admins write `teams/{team_id}/…`).
  Uploads go through `components/ui/AvatarUploader.jsx`; avatars render in the
  desktop header, the mobile workspace FAB/switcher, and the Account/Team
  settings forms.
- `20260604_team_subscriptions.sql` — adds the per-workspace subscription
  columns to `teams` (`subscription_status`, `stripe_customer_id`,
  `stripe_subscription_id`, `current_period_end`) and grandfathers existing
  teams to `active`. This is the data layer for "each band/church is its own
  paid subscription". The client is **status-aware but not yet status-gated in
  practice** — everything defaults to `active` until the Stripe webhook writes
  real statuses. The Stripe integration is **scaffolded but dormant** (see
  "Billing" below). There is no in-app pricing screen (removed 2026-11-09): pricing lives on the website.
- `20260613_team_notes.sql` — adds the `team_notes` table: per-user **private**
  notes ("My note") for team workspaces, at song / setlist-item / section
  scope. Shared/team notes still live on the song & setlist objects; this is
  only the private layer. Scope columns (`song_id`, `setlist_id`,
  `section_key`) are NOT NULL default `''` so a plain unique constraint +
  upsert works across partial scopes. RLS: a user reads/writes only their own
  rows, scoped to teams they belong to. Client: `src/notes/usePrivateNotes.js`
  (cloud + IndexedDB cache, offline-capable) (its old `ui/NotesStack` UI was removed 2026-11-15; no UI today).
- `20260701_realtime_publication.sql` — adds `team_schedules`,
  `team_availability`, `team_notifications`, `team_activity` to the
  `supabase_realtime` publication (they were subscribed client-side but never
  published — realtime silently delivered nothing) + `replica identity full`
  so delete events pass `team_id=eq.` filters.
- `20260702_trigger_fn_hardening.sql` — revokes client EXECUTE on trigger
  functions (they're only ever run by their triggers).
- `20260702_identity_keys.sql` — adds `team_songs.song_key` /
  `team_setlists.setlist_key` (the embedded content id promoted to a real
  column), stamp triggers that derive the key from content for writers that
  don't send it, backfill, and unique `(team_id, key)` indexes. **Drops the
  unique title/name indexes** — same-title songs are legitimate now; identity
  is the key. The engine sends keys on every write and heals key collisions
  by adopting the existing row.
- `20260702_web_push.sql` — Web Push + notification worker infra:
  `push_subscriptions` (owner-only RLS), `team_notifications.pushed_at`,
  service-role-only `app_config` (holds the VAPID keys — values are inserted
  operationally, never committed), a `notify_on_schedule_request` trigger
  (being rostered now writes a durable notification), and `pg_cron`+`pg_net`
  jobs: `notify-worker` (every five minutes since 20261019 → the edge function) and a daily
  `cron-history-cleanup`.

- `20260910_sync_versions.sql` — **server foundations for the replica sync
  model** (`docs/SYNC-REDESIGN.md`, step 2). Adds `version` (the
  compare-and-swap token, bumped by `trg_sync_stamp` on every real change),
  `seq` (change-feed position from `public.sync_seq`, assigned under a
  per-workspace advisory lock so feed order == commit order) and `updated_by`
  to `team_songs`/`team_setlists`; a `team_deletions` tombstone table written
  by an `AFTER DELETE` trigger (deletes become feed rows; hard deletes and
  cascades stay); and two SECURITY INVOKER RPCs — `apply_ops(team, ops)` (a
  batch of put/delete guarded by `base_version`, conflicts returned with the
  server copy, identical-content retries count as applied) and
  `sync_changes(team, since, limit)` (songs + setlists + deletions after a
  cursor, one query). A no-op write is frozen to the old stamps. Additive; the
  manifest engine never reads the new columns. Validated in a rolled-back run
  and **applied to production on 2026-09-10**. `sync/replica-engine.js` reads
  `sync_changes` and writes through `apply_ops`.
- `20260910_apply_ops_row_id.sql` — `apply_ops` returns `row_id` in every
  applied put (and in conflict payloads), so a writer that just created a
  setlist can point `team_schedules` at it without waiting for the feed echo.
  Applied 2026-09-10.
- `20260911_personal_workspaces.sql` — **the personal library as a workspace**
  (`docs/SYNC-REDESIGN.md`, step 4). Adds `teams.kind`
  (`personal | team | church`, default `team`), lets `plan` be `personal`, a
  partial unique index (one personal row per owner) and
  `ensure_personal_workspace()` (security definer, authenticated only,
  idempotent). A personal workspace has **no `team_members` row** — the
  owner clauses in RLS, `apply_ops`, `sync_changes`, realtime and the version
  history already accept it, and the switcher (memberships-driven) never
  lists it. Applied to production 2026-09-10. Client: `hooks/usePersonalWorkspace.js`.
- `20260911_json_wire.sql` — **JSON on the wire** (`docs/SYNC-REDESIGN.md`,
  step 5). Adds `team_songs.doc jsonb` (the whole v2 song, every arrangement)
  and `team_song_versions.doc`; `apply_ops` takes `doc` on a song put and
  returns it in conflicts; `sync_changes` returns it; `trg_guard_song_doc`
  (BEFORE UPDATE) nulls the document when `content` changes without it, so a
  stale document never outlives its markdown; the snapshot trigger stores it;
  the activity guard logs a document-only edit but not a row gaining its
  first document with the markdown unchanged. `content`/`content_hash` stay
  and are still written (older builds read them). Applied 2026-09-10.
- `20260911_db_hygiene.sql` — the advisors' list, applied 2026-09-11. Every
  RLS policy in `public` rewritten in place to `(select auth.uid())` (an
  InitPlan, evaluated once per query instead of once per row — the DO block
  is generic, so re-running the file picks up any later policy written the
  old way); the six duplicate "Admins can …" write policies on
  `team_songs`/`team_setlists` dropped (subsumed by "Team editors can …");
  `team_members_select` tightened from `using (true)` to own rows + rosters
  of workspaces you belong to or own; the `on_team_created` trigger restored
  (owner becomes admin atomically; **skips `kind = 'personal'`**; the client's
  own membership insert then hits 23505, which it tolerates);
  `team_invites.role` allows `leader`; twelve covering indexes for the
  `auth.users` foreign keys. `team_deletions` is deliberately NOT pruned
  (SYNC-REDESIGN §6 #2). ⚠ Write new policies with `(select auth.uid())`,
  never bare `auth.uid()`.

- `20261031_church_info.sql` — `teams.address`, `teams.website`,
  `teams.ccli_licence` (all nullable, length-checked) for the Team page's
  church card. Owner-only edit through the existing "Owner can update team"
  policy. The client hides those three fields' edits until the columns exist.

RLS must allow each user to `select`/`update` their own profile row
(typical policy: `auth.uid() = id`).

## Entitlements

**The plan lives on the group (`teams.plan`), never on a person.** There is no
Pro, no Sync and no personal tier (removed 2026-11-13, after a church member
was told "Fonts are part of Pro"). Seats are the main limit and the database
enforces them (`teams.max_seats`, in `invite_user_to_team` and
`approve_join_request_internal`).

`useEntitlement(feature)` (`hooks/useEntitlement.js`) answers "does the open
group's plan include this?" and returns
`{ allowed, requiredPlan, currentPlan, subscriptionStatus }`. Ranks are
`free < team < church`; Personal ranks as `free`.

- A feature with **no entry** in `FEATURE_GATES` is open to everyone,
  everywhere. Chart style (themes, fonts, colours), chord shapes and import
  are all open. Do not add a gate for anything that makes a chart readable.
- The only gate today is `multi-service` → `church`. It also needs the group's
  `subscription_status` to be `active`/`trialing` (defaults to `active`).
- `checkEntitlement(plan, feature)` is the pure version; it takes a GROUP plan.

Two leftovers still read `profiles.subscription_tier`, both on purpose and
both temporary: `personalCloudAllowed(profile)` (Personal's cloud copy, kept
only for the accounts that already had it, until Personal is removed) and
`hasTeamPlan` in `TeamProvider` (who may create a group, until the new plans
are decided). `profiles.is_pro` is read by nothing and can be dropped once
every installed copy of the app is past this change.

`ui/UpgradeGate.jsx` is no longer mounted by anything live. There are no
upgrade prompts in the app: pricing lives on the website.

### Team Provider

`TeamProvider` (`auth/TeamProvider.jsx`) wraps the app tree inside
`AuthProvider` (in `main.jsx`). It provides team state via `useTeam()`:
`{ team, members, isAdmin, loading, hasTeamPlan, createTeam, inviteMember,
removeMember, leaveTeam, updateTeam, deleteTeam }`.

The provider only fetches from Supabase when the user has a `team` or
`church` plan. For free/sync users, the context value is a no-op stub.

### Billing (per-workspace subscriptions — scaffolded, dormant)

Each team/church workspace is its own Stripe subscription, paid by the team
`owner_id`. The pieces:

- **Edge Functions** (`supabase/functions/stripe-checkout`,
  `supabase/functions/stripe-webhook`; see `STRIPE_BILLING.md`).
  `stripe-checkout` is owner-only and serves `action: 'checkout' | 'portal'`;
  `stripe-webhook` verifies the Stripe signature and writes
  `subscription_status` / Stripe ids / `current_period_end` (and `plan`/
  `max_seats`) back onto the team. Deploy the webhook with `--no-verify-jwt`.
- **Client** — `src/billing/checkout.js` (`startTeamCheckout`,
  `openBillingPortal`, `BILLING_ENABLED`, `billingError`,
  `workspaceStatusLabel`). Wired into `Settings.jsx` (owner-only Subscribe /
  Manage billing rows) and `TeamScreen.jsx` (create form has a Team/Church
  tier picker; new workspace routes to checkout when enabled). The workspace
  switchers (`TopHeader`, `MobileTopBar`) show a Past due / Unpaid / Canceled
  badge per workspace. App handles the `?billing=success|cancel` return with a
  toast + URL cleanup.
- **Create-to-pay gating** — a user may create a workspace when
  `BILLING_ENABLED || hasTeamPlan`. With billing live, creating *is*
  subscribing (any signed-in user → checkout, workspace starts `unpaid` until
  the webhook confirms); while billing is dormant the `hasTeamPlan`
  entitlement gate stays so team features aren't given away for free.
- **Dormant by default** — the functions return `503 billing_not_configured`
  without `STRIPE_SECRET_KEY`, and the UI is hidden unless
  `VITE_STRIPE_ENABLED=true`. Turning it on requires the Stripe secrets +
  prices (Team/Church) and the dashboard webhook endpoint.
