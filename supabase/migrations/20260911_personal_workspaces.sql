-- The personal library as a workspace on Supabase — docs/SYNC-REDESIGN.md, step 4.
--
-- A personal library is "a team of one": a `teams` row with kind = 'personal',
-- owned by the user, with NO team_members row. Everything the team tables and
-- the sync RPCs already do then works unchanged for it:
--   * RLS on team_songs / team_setlists / team_deletions / team_song_versions /
--     team_activity all carry an `owner_id = auth.uid()` clause;
--   * apply_ops accepts the owner; sync_changes sees what the owner sees;
--   * realtime filters pass (they use the SELECT policies);
--   * the workspace switcher loads workspaces THROUGH memberships, so a
--     personal row never shows up in it, never counts toward the owned-
--     workspace limit, and is never the "active team" for entitlements
--     (the personal library reads the profile's tier, not a team's);
--   * account deletion cascades through teams.owner_id.
--
-- `ensure_personal_workspace()` creates the row lazily on first use (the
-- client calls it when the account has cloud sync) and is idempotent — a
-- partial unique index guarantees one per owner. Additive and idempotent.

alter table public.teams add column if not exists kind text not null default 'team';

alter table public.teams drop constraint if exists teams_kind_check;
alter table public.teams
  add constraint teams_kind_check check (kind in ('personal', 'team', 'church'));

-- `plan` is what entitlements read for team/church workspaces; a personal
-- workspace is never the active team, so its plan is only a label.
alter table public.teams drop constraint if exists teams_plan_check;
alter table public.teams
  add constraint teams_plan_check check (plan in ('personal', 'team', 'church'));

create unique index if not exists teams_personal_owner_idx
  on public.teams (owner_id) where kind = 'personal';

comment on column public.teams.kind is
  'personal = the owner''s private library (no members, never in the switcher); team | church = a shared workspace.';

create or replace function public.ensure_personal_workspace()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'ensure_personal_workspace: not signed in' using errcode = '42501';
  end if;
  select id into v_id from public.teams where owner_id = v_uid and kind = 'personal' limit 1;
  if v_id is not null then
    return v_id;
  end if;
  begin
    insert into public.teams (name, owner_id, plan, kind, max_seats)
    values ('Personal', v_uid, 'personal', 'personal', 1)
    returning id into v_id;
  exception when unique_violation then
    -- Two devices signing in at once: the other one won the race.
    select id into v_id from public.teams where owner_id = v_uid and kind = 'personal' limit 1;
  end;
  return v_id;
end;
$$;

revoke execute on function public.ensure_personal_workspace() from public, anon;
grant  execute on function public.ensure_personal_workspace() to authenticated;
