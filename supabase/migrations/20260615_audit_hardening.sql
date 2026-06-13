-- 20260615_audit_hardening.sql
-- Follow-up to 20260608_security_hardening.sql.
--
-- The earlier migration revoked EXECUTE "FROM anon" only, but Postgres grants
-- EXECUTE to PUBLIC by default and both anon and authenticated INHERIT it — so
-- those revokes were effectively no-ops. The Supabase security advisor still
-- reports every team SECURITY DEFINER function as anon/authenticated-executable
-- (lints 0028 / 0029). This migration revokes from PUBLIC and re-grants only to
-- the role that actually calls each function.
--
-- It also fixes two smaller findings from the June 2026 pre-launch audit:
--   * S-3: team_availability INSERT didn't verify team membership.
--   * S-7: set_user_cloud_tokens_updated_at had a mutable search_path.
--
-- NOTE: audit finding S-2 (team_schedules writes are open to any member) is
-- intentionally NOT included here — the correct policy depends on a product
-- decision about who may edit the roster (admins only, or admins + leaders),
-- and the schedule feature is mid-redesign. Handle it in a dedicated migration.

-- ── 1. SECURITY DEFINER RPCs: revoke PUBLIC/anon, grant authenticated ─────────
-- These are invoked by signed-in app code (AuthProvider, TeamProvider, roster).
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.claim_team_invites()',
    'public.get_team_member_profiles(uuid)',
    'public.get_user_admin_teams()',
    'public.get_user_editable_teams()',
    'public.get_user_teams()',
    'public.invite_user_to_team(uuid, text, text)',
    'public.is_team_owner(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- ── 2. Trigger-only functions: remove from the REST RPC surface entirely ──────
-- handle_new_user (auth.users trigger), log_team_activity (table trigger) and
-- rls_auto_enable run from triggers, which do NOT check the caller's EXECUTE
-- privilege — so revoking from every client role is safe and stops them being
-- callable via /rest/v1/rpc.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.log_team_activity() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- ── 3. S-7: pin search_path on the function the prior hardening pass missed ────
alter function public.set_user_cloud_tokens_updated_at() set search_path = '';

-- ── 4. S-3: team_availability INSERT must confirm the caller is on the team ───
-- Previously: with check (user_id = auth.uid()) — any signed-in user could seed
-- availability rows into ANY team's calendar. Add the same membership check the
-- SELECT policy already uses.
drop policy if exists "Members manage own availability" on public.team_availability;
create policy "Members manage own availability"
  on public.team_availability for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      team_id in (select public.get_user_teams())
      or team_id in (select id from public.teams where owner_id = auth.uid())
    )
  );
