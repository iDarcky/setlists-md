-- ── Team Library: Admin-Only Writes ──────────────────────────────────────────
-- Restrict INSERT / UPDATE / DELETE on team_songs and team_setlists so that
-- only admins (and the team owner) can modify the team library. Regular
-- members retain read-only (SELECT) access.
--
-- This also fixes the RLS error members hit when the sync engine tried to
-- push changes to team_setlists.

-- ─────────────────────────────────────────────────────────────────────────────
-- team_songs: DROP existing write policies, re-create as admin-only
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Team members can insert songs" ON public.team_songs;
DROP POLICY IF EXISTS "Team members can update songs" ON public.team_songs;
DROP POLICY IF EXISTS "Team members can delete songs" ON public.team_songs;

CREATE POLICY "Admins can insert songs"
  ON public.team_songs FOR INSERT
  WITH CHECK (
    team_id IN (SELECT public.get_user_admin_teams())
    OR team_id IN (SELECT id FROM public.teams WHERE owner_id = auth.uid())
  );

CREATE POLICY "Admins can update songs"
  ON public.team_songs FOR UPDATE
  USING (
    team_id IN (SELECT public.get_user_admin_teams())
    OR team_id IN (SELECT id FROM public.teams WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    team_id IN (SELECT public.get_user_admin_teams())
    OR team_id IN (SELECT id FROM public.teams WHERE owner_id = auth.uid())
  );

CREATE POLICY "Admins can delete songs"
  ON public.team_songs FOR DELETE
  USING (
    team_id IN (SELECT public.get_user_admin_teams())
    OR team_id IN (SELECT id FROM public.teams WHERE owner_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- team_setlists: DROP existing write policies, re-create as admin-only
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Team members can insert setlists" ON public.team_setlists;
DROP POLICY IF EXISTS "Team members can update setlists" ON public.team_setlists;
DROP POLICY IF EXISTS "Team members can delete setlists" ON public.team_setlists;

CREATE POLICY "Admins can insert setlists"
  ON public.team_setlists FOR INSERT
  WITH CHECK (
    team_id IN (SELECT public.get_user_admin_teams())
    OR team_id IN (SELECT id FROM public.teams WHERE owner_id = auth.uid())
  );

CREATE POLICY "Admins can update setlists"
  ON public.team_setlists FOR UPDATE
  USING (
    team_id IN (SELECT public.get_user_admin_teams())
    OR team_id IN (SELECT id FROM public.teams WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    team_id IN (SELECT public.get_user_admin_teams())
    OR team_id IN (SELECT id FROM public.teams WHERE owner_id = auth.uid())
  );

CREATE POLICY "Admins can delete setlists"
  ON public.team_setlists FOR DELETE
  USING (
    team_id IN (SELECT public.get_user_admin_teams())
    OR team_id IN (SELECT id FROM public.teams WHERE owner_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Security-definer function: fetch team member profiles
-- ─────────────────────────────────────────────────────────────────────────────
-- This bypasses profiles RLS so team members can see each other's names.
-- It joins team_members → auth.users to get the email reliably, and
-- optionally pulls display_name from profiles (which may have restrictive RLS).

CREATE OR REPLACE FUNCTION public.get_team_member_profiles(p_team_id uuid)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  email text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    tm.user_id,
    p.display_name,
    COALESCE(p.email, u.email) AS email
  FROM team_members tm
  LEFT JOIN profiles p ON p.id = tm.user_id
  LEFT JOIN auth.users u ON u.id = tm.user_id
  WHERE tm.team_id = p_team_id
    -- Only allow if the caller is a member of this team
    AND p_team_id IN (SELECT public.get_user_teams());
$$;
