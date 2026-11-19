-- Remove the old one-person library ("Personal") from the database.
--
-- Run ONLY after the app without Personal is released to main. An older app
-- would call ensure_personal_workspace() again and fail once it is gone.
--
-- What it does (one transaction, all or nothing):
--   1. deletes every teams row of kind 'personal' (on 19 Nov 2026 there was
--      one: 45 songs, 0 setlists, no members). Its songs, versions, deletions
--      and activity go with it (every team_* table cascades on teams.id);
--   2. drops ensure_personal_workspace() and its one-per-owner index;
--   3. stops the database accepting kind/plan 'personal' again.
-- Nothing else is touched: churches and bands keep every row.

begin;

-- Safety: stop if more than one Personal row exists (someone else has one).
do $$
declare n int;
begin
  select count(*) into n from public.teams where kind = 'personal';
  if n > 1 then
    raise exception 'Expected at most 1 Personal row, found %. Nothing was deleted.', n;
  end if;
end $$;

delete from public.teams where kind = 'personal';

drop function if exists public.ensure_personal_workspace();
drop index if exists public.teams_personal_owner_idx;

alter table public.teams drop constraint if exists teams_kind_check;
alter table public.teams
  add constraint teams_kind_check check (kind in ('team', 'church'));

alter table public.teams drop constraint if exists teams_plan_check;
alter table public.teams
  add constraint teams_plan_check check (plan in ('team', 'church'));

commit;

-- Check afterwards (both should say 0):
--   select count(*) from public.teams where kind = 'personal';
--   select count(*) from pg_proc where proname = 'ensure_personal_workspace';
