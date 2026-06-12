-- 20260615_team_schedules_rls.sql
-- S-2 from the June 2026 audit: team_schedules INSERT/UPDATE/DELETE were open to
-- ANY team member, so a regular member could reassign or wipe the whole roster.
--
-- New policy (chosen: admins + leaders + owner manage):
--   * Admins, leaders and the team owner may insert/update/delete any row.
--   * A regular member may only UPDATE their OWN row (set availability / part).
--
-- We resolve "roster manager" through a SECURITY DEFINER helper to avoid the
-- RLS-recursion footgun of selecting team_members inside a team_schedules
-- policy (the same reason the codebase already uses get_user_teams()).

create or replace function public.get_user_roster_manager_teams()
returns setof uuid
language sql
security definer
set search_path = ''
as $$
  select t.id from public.teams t where t.owner_id = auth.uid()
  union
  select m.team_id from public.team_members m
  where m.user_id = auth.uid() and m.role in ('admin', 'leader')
$$;

revoke execute on function public.get_user_roster_manager_teams() from public, anon;
grant execute on function public.get_user_roster_manager_teams() to authenticated;

-- INSERT — roster managers only
drop policy if exists "Team members can insert schedules" on public.team_schedules;
create policy "Roster managers can insert schedules"
  on public.team_schedules for insert
  to authenticated
  with check (team_id in (select public.get_user_roster_manager_teams()));

-- UPDATE — managers update any row; members update only their own
drop policy if exists "Team members can update schedules" on public.team_schedules;
create policy "Roster managers and self can update schedules"
  on public.team_schedules for update
  to authenticated
  using (
    user_id = auth.uid()
    or team_id in (select public.get_user_roster_manager_teams())
  )
  with check (
    user_id = auth.uid()
    or team_id in (select public.get_user_roster_manager_teams())
  );

-- DELETE — roster managers only
drop policy if exists "Team members can delete schedules" on public.team_schedules;
create policy "Roster managers can delete schedules"
  on public.team_schedules for delete
  to authenticated
  using (team_id in (select public.get_user_roster_manager_teams()));
