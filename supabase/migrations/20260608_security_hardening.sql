-- Security hardening pass:
--
-- 1. Revoke anon EXECUTE on all SECURITY DEFINER team functions — they all
--    require a signed-in user; no reason to expose them to the anon role.
-- 2. Fix invite_user_to_team: the original NULL != X comparison evaluates to
--    NULL (not TRUE) when auth.uid() is NULL, silently bypassing the admin
--    check for unauthenticated callers. Add an explicit null guard.
-- 3. Fix handle_new_user: pin search_path to prevent search-path injection
--    (was flagged by the Supabase security linter).
-- 4. Add RLS policies for user_cloud_tokens — table had RLS enabled but no
--    policies, meaning nobody could read or write it at all.

-- ── 1. Revoke anon execute ───────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.claim_team_invites() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_team_member_profiles(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_admin_teams() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_editable_teams() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_teams() FROM anon;
REVOKE EXECUTE ON FUNCTION public.invite_user_to_team(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_team_owner(uuid) FROM anon;

-- ── 2. Fix invite_user_to_team null-auth bypass ──────────────────────────────

CREATE OR REPLACE FUNCTION public.invite_user_to_team(
  p_team_id uuid,
  p_email   text,
  p_role    text DEFAULT 'member'::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_user_id       uuid;
  v_member_id     uuid;
  v_max_seats     int;
  v_current_seats int;
  v_is_admin      boolean;
  v_owner_id      uuid;
begin
  -- Must be authenticated — without this explicit check, auth.uid() = NULL
  -- makes the owner comparison (v_owner_id != NULL) evaluate to NULL, which
  -- is falsy and silently skips the permission guard.
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  -- Check permissions (must be team admin or owner)
  select owner_id into v_owner_id from teams where id = p_team_id;

  select true into v_is_admin
  from team_members
  where team_id = p_team_id and user_id = auth.uid() and role = 'admin';

  if v_owner_id != auth.uid() and not coalesce(v_is_admin, false) then
    raise exception 'You must be an admin to invite members.';
  end if;

  -- Check seat limits
  select max_seats into v_max_seats from teams where id = p_team_id;
  select count(*) into v_current_seats from team_members where team_id = p_team_id;

  if v_current_seats >= v_max_seats then
    raise exception 'Team is at maximum capacity (%). Upgrade plan for more seats.', v_max_seats;
  end if;

  -- Check if user already exists in the system
  select id into v_user_id from auth.users where email = p_email;

  if v_user_id is not null then
    if exists (select 1 from team_members where team_id = p_team_id and user_id = v_user_id) then
      raise exception 'User is already a member of this team.';
    end if;

    insert into team_members (team_id, user_id, role, invited_by)
    values (p_team_id, v_user_id, p_role, auth.uid())
    returning id into v_member_id;

    return json_build_object('status', 'added', 'user_id', v_user_id, 'member_id', v_member_id);
  else
    if exists (select 1 from team_invites where team_id = p_team_id and email = p_email) then
      raise exception 'An invite is already pending for this email.';
    end if;

    insert into team_invites (team_id, email, role, invited_by)
    values (p_team_id, p_email, p_role, auth.uid());

    return json_build_object('status', 'invited', 'email', p_email);
  end if;
end;
$$;

-- ── 3. Fix handle_new_user search_path ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

-- ── 4. RLS policies for user_cloud_tokens ───────────────────────────────────

CREATE POLICY "Users can manage their own cloud tokens"
  ON public.user_cloud_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
