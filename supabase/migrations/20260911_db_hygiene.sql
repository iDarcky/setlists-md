-- DB hygiene — the list from docs/SYNC-REDESIGN.md §2 #8 and the advisors.
--
-- Nothing here changes what any user may do, with two deliberate exceptions
-- called out below (§3: who may LIST team memberships; §5: a leader may now be
-- INVITED by email). Everything else is the same rules, cheaper or tidier.
-- Additive and idempotent. Applied to production 2026-09-11.
--
-- 1. `auth.uid()` in every RLS policy becomes `(select auth.uid())`. Bare, it
--    is re-evaluated for every row the policy scans; wrapped, the planner
--    hoists it into an InitPlan and evaluates it once per query (advisor
--    0003_auth_rls_initplan — 47 policies). Done generically: every policy in
--    `public` is rewritten in place with ALTER POLICY, so a policy added
--    later without the pattern is picked up by re-running this file.
-- 2. The six "Admins can insert/update/delete songs|setlists" policies are
--    dropped. They were the 0521 write rules, never removed when "Team
--    editors can …" replaced them; `get_user_editable_teams()` (admin ·
--    editor · leader) is a superset of `get_user_admin_teams()` and both sets
--    carry the same owner clause, so every write they allowed is still
--    allowed. Two permissive policies per action cost two evaluations per
--    row (advisor 0006).
-- 3. `team_members_select` was `using (true)` — "open for select for now to
--    debug, then we can tighten it" (0429_nuclear_rls_fix). Any signed-in
--    user could list every workspace's roster. Tightened to: my own rows,
--    the rosters of workspaces I belong to, the rosters of workspaces I own.
--    Every reader in the app is one of those. No recursion: the membership
--    lookup goes through the SECURITY DEFINER helpers, never the table.
--    `team_members_insert` keeps its rule (you may add yourself to a
--    workspace you own or administer) but reads the admin set through
--    `get_user_admin_teams()` for the same reason.
-- 4. The owner's automatic membership trigger (`handle_new_team`,
--    0429_team_auto_member_trigger) is missing in production. The client
--    inserts the membership itself after creating the workspace, so today
--    every workspace has one — but a creation that fails between the two
--    inserts leaves a workspace its owner cannot see (the switcher is
--    memberships-driven). Restored, atomic, with one change: a PERSONAL
--    workspace (step 4) has no members by design and is skipped.
-- 5. `team_invites.role` forbade `leader`: the invite form offers every role,
--    an existing user can be added as a leader directly, but inviting an
--    unknown email as one failed on the check constraint. Aligned with
--    `team_members.role`.
-- 6. Twelve foreign keys had no covering index (advisor 0001). Each is a
--    `references auth.users(id) on delete set null|cascade`: without the
--    index, deleting an account scans every one of these tables.
--
-- NOT done here, on purpose: `team_deletions` is not pruned (SYNC-REDESIGN
-- §6 #2 — a replica whose cursor predates a pruned tombstone would keep the
-- deleted song forever; pruning needs a horizon marker first, and the table
-- holds 0 rows). Leaked-password protection is an Auth dashboard setting,
-- not SQL. The SECURITY DEFINER RPCs the advisor lists are the app's API and
-- are meant to be callable by signed-in users.

-- ── 1. InitPlan: (select auth.uid()) everywhere ─────────────────────────────
do $$
declare
  p record;
  v_qual  text;
  v_check text;
  -- `pg_get_expr` renders an already-wrapped call as "( SELECT auth.uid() AS uid)";
  -- a bare one as "auth.uid()". Rewrite only the bare ones.
  pat constant text := '(?<!SELECT )auth\.uid\(\)';
  n int := 0;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (qual ~ pat or with_check ~ pat)
  loop
    v_qual  := regexp_replace(p.qual,       pat, '(select auth.uid())', 'g');
    v_check := regexp_replace(p.with_check, pat, '(select auth.uid())', 'g');
    if p.qual is not null and p.with_check is not null then
      execute format('alter policy %I on %I.%I using (%s) with check (%s)', p.policyname, p.schemaname, p.tablename, v_qual, v_check);
    elsif p.qual is not null then
      execute format('alter policy %I on %I.%I using (%s)', p.policyname, p.schemaname, p.tablename, v_qual);
    else
      execute format('alter policy %I on %I.%I with check (%s)', p.policyname, p.schemaname, p.tablename, v_check);
    end if;
    n := n + 1;
  end loop;
  raise notice 'db_hygiene: rewrote % policies to (select auth.uid())', n;
end $$;

-- ── 2. The duplicate write policies ─────────────────────────────────────────
drop policy if exists "Admins can insert songs"    on public.team_songs;
drop policy if exists "Admins can update songs"    on public.team_songs;
drop policy if exists "Admins can delete songs"    on public.team_songs;
drop policy if exists "Admins can insert setlists" on public.team_setlists;
drop policy if exists "Admins can update setlists" on public.team_setlists;
drop policy if exists "Admins can delete setlists" on public.team_setlists;

-- ── 3. Who may list memberships ─────────────────────────────────────────────
drop policy if exists "team_members_select" on public.team_members;
create policy "team_members_select"
  on public.team_members
  for select
  using (
    user_id = (select auth.uid())
    or team_id in (select public.get_user_teams())
    or team_id in (select id from public.teams where owner_id = (select auth.uid()))
  );

drop policy if exists "team_members_insert" on public.team_members;
create policy "team_members_insert"
  on public.team_members
  for insert
  with check (
    user_id = (select auth.uid())
    and (
      team_id in (select id from public.teams where owner_id = (select auth.uid()))
      or team_id in (select public.get_user_admin_teams())
    )
  );

-- ── 4. The owner's membership, atomically with the workspace ────────────────
create or replace function public.handle_new_team()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.team_members (team_id, user_id, role)
  values (new.id, new.owner_id, 'admin')
  on conflict (team_id, user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_team() from public, anon, authenticated;

drop trigger if exists on_team_created on public.teams;
create trigger on_team_created
  after insert on public.teams
  for each row
  when (new.kind is distinct from 'personal')
  execute function public.handle_new_team();

-- ── 5. Invites may name a leader ────────────────────────────────────────────
alter table public.team_invites drop constraint if exists team_invites_role_check;
alter table public.team_invites
  add constraint team_invites_role_check check (role in ('admin', 'editor', 'leader', 'member'));

-- ── 6. Covering indexes for the auth.users foreign keys ─────────────────────
create index if not exists team_songs_updated_by_idx         on public.team_songs (updated_by);
create index if not exists team_setlists_updated_by_idx      on public.team_setlists (updated_by);
create index if not exists team_setlists_created_by_idx      on public.team_setlists (created_by);
create index if not exists team_song_versions_author_id_idx  on public.team_song_versions (author_id);
create index if not exists team_deletions_deleted_by_idx     on public.team_deletions (deleted_by);
create index if not exists team_activity_actor_id_idx        on public.team_activity (actor_id);
create index if not exists team_notifications_actor_id_idx   on public.team_notifications (actor_id);
create index if not exists team_notes_user_id_idx            on public.team_notes (user_id);
create index if not exists team_members_invited_by_idx       on public.team_members (invited_by);
create index if not exists team_invites_invited_by_idx       on public.team_invites (invited_by);
create index if not exists feedback_user_id_idx              on public.feedback (user_id);
create index if not exists pro_waitlist_user_id_idx          on public.pro_waitlist (user_id);
