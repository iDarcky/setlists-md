-- Changing roles and removing people, for real (2026-11-04).
--
-- ⚠ The bug this fixes: team_members' UPDATE and DELETE policies only let the
-- church OWNER change or remove other people's rows. A leader with "Can also
-- change roles and remove people" (role `admin`) tapped a role or Remove, the
-- request matched 0 rows, returned no error, and the person came back on the
-- next reload.
--
-- Rather than widen those policies, two functions do exactly these jobs:
--   * the owner and admins may change someone's role or remove them;
--   * only the OWNER may make someone an admin, change an admin, or remove one
--     (the app already shows that switch to the owner alone);
--   * nobody can change or remove the owner, or themselves (Leave is for that).
-- Plain leaders, editors and members can do neither.
--
-- Safe to run more than once.

create or replace function public.member_admin_check(p_member public.team_members)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select owner_id into v_owner from public.teams where id = p_member.team_id;
  if p_member.user_id = v_owner then
    raise exception 'Nobody can change the church owner.' using errcode = '42501';
  end if;
  if p_member.user_id = v_uid then
    raise exception 'You can’t change your own role here.' using errcode = '42501';
  end if;
  if v_uid = v_owner then
    return true;   -- true = the caller is the owner
  end if;
  if not exists (select 1 from public.team_members m
                  where m.team_id = p_member.team_id and m.user_id = v_uid and m.role = 'admin') then
    raise exception 'Only the owner and leaders who can change roles can do that.' using errcode = '42501';
  end if;
  if p_member.role = 'admin' then
    raise exception 'Only the church owner can change another leader who can change roles.' using errcode = '42501';
  end if;
  return false;    -- an admin, acting on a non-admin
end;
$$;

revoke all on function public.member_admin_check(public.team_members) from public, anon, authenticated;

create or replace function public.set_member_role(p_member_id uuid, p_role text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.team_members%rowtype;
  v_is_owner boolean;
begin
  if p_role is null or p_role not in ('admin', 'leader', 'editor', 'member') then
    raise exception 'That is not a role.' using errcode = '22023';
  end if;
  select * into v_member from public.team_members where id = p_member_id;
  if not found then
    raise exception 'That person is not in this church.' using errcode = 'P0002';
  end if;
  v_is_owner := public.member_admin_check(v_member);
  if p_role = 'admin' and not v_is_owner then
    raise exception 'Only the church owner can let someone change roles.' using errcode = '42501';
  end if;
  update public.team_members set role = p_role where id = p_member_id;
  return p_role;
end;
$$;

create or replace function public.remove_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.team_members%rowtype;
begin
  select * into v_member from public.team_members where id = p_member_id;
  if not found then
    return;   -- already gone
  end if;
  perform public.member_admin_check(v_member);
  delete from public.team_members where id = p_member_id;
end;
$$;

revoke all on function public.set_member_role(uuid, text) from public, anon;
revoke all on function public.remove_member(uuid) from public, anon;
grant execute on function public.set_member_role(uuid, text) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
