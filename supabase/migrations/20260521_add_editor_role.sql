-- Add Editor Role to team_members and team_invites

-- Drop existing role constraints on team_members
DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.team_members'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%role%'
    LOOP
        EXECUTE 'ALTER TABLE public.team_members DROP CONSTRAINT ' || constraint_name;
    END LOOP;
END $$;

ALTER TABLE public.team_members
ADD CONSTRAINT team_members_role_check CHECK (role IN ('admin', 'editor', 'member'));


-- Drop existing role constraints on team_invites
DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.team_invites'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%role%'
    LOOP
        EXECUTE 'ALTER TABLE public.team_invites DROP CONSTRAINT ' || constraint_name;
    END LOOP;
END $$;

ALTER TABLE public.team_invites
ADD CONSTRAINT team_invites_role_check CHECK (role IN ('admin', 'editor', 'member'));


-- Create helper function for editable teams
create or replace function public.get_user_editable_teams()
returns setof uuid
language sql security definer
set search_path = public
as $$
  select team_id
  from public.team_members
  where user_id = auth.uid() and role in ('admin', 'editor');
$$;


-- Update RLS policies for team_songs
DROP POLICY IF EXISTS "Team members can insert songs" ON public.team_songs;
DROP POLICY IF EXISTS "Team members can update songs" ON public.team_songs;
DROP POLICY IF EXISTS "Team members can delete songs" ON public.team_songs;

create policy "Team editors can insert songs"
  on public.team_songs for insert
  with check (
    team_id in (select public.get_user_editable_teams())
    or team_id in (select id from public.teams where owner_id = auth.uid())
  );

create policy "Team editors can update songs"
  on public.team_songs for update
  using (
    team_id in (select public.get_user_editable_teams())
    or team_id in (select id from public.teams where owner_id = auth.uid())
  );

create policy "Team editors can delete songs"
  on public.team_songs for delete
  using (
    team_id in (select public.get_user_editable_teams())
    or team_id in (select id from public.teams where owner_id = auth.uid())
  );


-- Update RLS policies for team_setlists
DROP POLICY IF EXISTS "Team members can insert setlists" ON public.team_setlists;
DROP POLICY IF EXISTS "Team members can update setlists" ON public.team_setlists;
DROP POLICY IF EXISTS "Team members can delete setlists" ON public.team_setlists;

create policy "Team editors can insert setlists"
  on public.team_setlists for insert
  with check (
    team_id in (select public.get_user_editable_teams())
    or team_id in (select id from public.teams where owner_id = auth.uid())
  );

create policy "Team editors can update setlists"
  on public.team_setlists for update
  using (
    team_id in (select public.get_user_editable_teams())
    or team_id in (select id from public.teams where owner_id = auth.uid())
  );

create policy "Team editors can delete setlists"
  on public.team_setlists for delete
  using (
    team_id in (select public.get_user_editable_teams())
    or team_id in (select id from public.teams where owner_id = auth.uid())
  );
