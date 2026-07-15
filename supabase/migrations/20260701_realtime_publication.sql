-- Realtime publication fix: the client subscribes to postgres_changes on SIX
-- tables (useTeamRealtime → team_songs/team_setlists; useTeamSchedules →
-- team_schedules; useTeamActivity → team_activity; useTeamAvailability →
-- team_availability; useTeamNotifications → team_notifications) but only
-- team_songs/team_setlists were ever added to the `supabase_realtime`
-- publication (20260428_team_library_constraints.sql). Postgres publishes
-- nothing for unlisted tables, so those four subscriptions connect fine and
-- then never receive a single event — notifications, schedule prompts, the
-- activity feed and availability only refreshed on a full reload.
--
-- Idempotent: each table is added only if it isn't already in the publication.

do $$
declare
  t text;
begin
  foreach t in array array[
    'team_schedules',
    'team_availability',
    'team_notifications',
    'team_activity'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- DELETE events only carry the old row's PRIMARY KEY by default, so a
-- `team_id=eq.<uuid>` subscription filter cannot match them and the event is
-- dropped — another member deleting a song/setlist/schedule never woke other
-- clients. REPLICA IDENTITY FULL makes the full old row available to the
-- filter. Write-amplification is negligible at this scale (rows are small and
-- churn is human-paced). team_activity/team_notifications are insert/update
-- driven, so the default identity is fine there.
alter table public.team_songs replica identity full;
alter table public.team_setlists replica identity full;
alter table public.team_schedules replica identity full;
alter table public.team_availability replica identity full;
