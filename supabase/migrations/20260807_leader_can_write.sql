-- Leaders may write the shared library.
--
-- Until now `get_user_editable_teams()` was `role in ('admin','editor')`, so the
-- role that PLANS a service could not change a song in it. Measured against
-- production on 2026-08-07: of the 20 real people across the three workspaces,
-- 5 are admin, 0 are editor, 2 are leader and 13 are member — so the writer set
-- was effectively "admins only", and both of the church's worship leaders had
-- to ask an admin to fix a chart.
--
-- ⚠ This is a GRANT-ONLY change, deliberately. Nothing loses access. One
-- Supabase project serves every client, including builds on `main` that this
-- session does not touch; an older client with a leader account still computes
-- `isTeamReadOnly = true` locally, keeps its UI read-only, and simply never
-- uses the new grant. No old build starts writing something it did not write
-- before, and reverting is one function replace.
--
-- The client's matching half is `isTeamReadOnly` in `src/App.jsx`. The two must
-- agree: if the client allows a write the DB refuses, the write lands in local
-- state, looks saved, and is silently reverted by the next pull.

create or replace function public.get_user_editable_teams()
returns setof uuid
language sql
security definer
set search_path to 'public'
as $function$
  select team_id
  from public.team_members
  where user_id = auth.uid() and role in ('admin', 'editor', 'leader');
$function$;
