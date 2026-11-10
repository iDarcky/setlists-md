-- Delete guest links a week after they end.
--
-- A guest link stops working at `expires_at` (3 hours after the service, see
-- `lib/setlistShare.js`), and `get_shared_setlist` already hides it from then
-- on. Nothing ever deleted the row, though: on 2026-11-06, 34 of the 36 rows in
-- `shared_setlists` had ended. Old snapshot rows hold a full copy of a
-- setlist and its songs, so they are worth removing, not just hiding.
--
-- A week's grace keeps a just-ended link findable if someone asks "why did my
-- link stop?" the day after. Nothing reads an ended row.

create or replace function public.prune_shared_setlists()
returns void
language sql
security definer
set search_path to 'public'
as $$
  delete from public.shared_setlists
  where expires_at is not null
    and expires_at < now() - interval '7 days';
$$;

-- A maintenance function, never called by a client.
revoke execute on function public.prune_shared_setlists() from public, anon, authenticated;

-- Nightly, next to `team-history-prune` (03:23). Re-running this file
-- replaces the job rather than adding a second one.
select cron.unschedule('shared-setlists-prune')
  where exists (select 1 from cron.job where jobname = 'shared-setlists-prune');
select cron.schedule(
  'shared-setlists-prune',
  '29 3 * * *',
  $$select public.prune_shared_setlists();$$
);
