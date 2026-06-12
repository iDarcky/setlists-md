-- Add the "leader" (Worship Leader) role to team_members.
--
-- A leader sits between admin and member: they manage the schedule/roster and
-- can assign players + parts (the DB already lets any team member write
-- team_schedules; this is the role the client uses to gate that UI), but they
-- do NOT get team-admin powers (billing, deleting the team, removing members).

alter table public.team_members drop constraint if exists team_members_role_check;

alter table public.team_members
  add constraint team_members_role_check
  check (role = any (array['admin'::text, 'editor'::text, 'leader'::text, 'member'::text]));
