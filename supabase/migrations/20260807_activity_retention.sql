-- Activity + version retention.
--
-- 2026-08-07: `team_activity` had grown to 27,628 rows, of which **25,587 were
-- duplicates** — `song_edited` was 93% of the table. The cause was a sync
-- ping-pong (see below), but the table had no retention of any kind, so a
-- write storm was permanent and the Activity Feed became unreadable: every
-- member's feed query paged through 27k rows to show ten.
--
-- Two rules, both cheap:
--
--  1. **Collapse edit storms.** One `song_edited` / `setlist_edited` row per
--     (team, actor, entity, hour). A human who edits a song six times in an
--     afternoon still reads as having edited it; a client that writes it 400
--     times does not get 400 rows. Kept as a nightly sweep rather than a
--     trigger guard, because the trigger already declines genuine no-ops
--     (`content_hash is not distinct from`) and the storm here was real
--     content changing back and forth.
--  2. **Age out.** Activity older than 90 days goes; snapshots keep the most
--     recent 20 per song. Nothing pruned either table before this.
--
-- ⚠ The ping-pong itself is NOT fixed by this file — this is the cleanup and
-- the guard rail. Root cause, measured 2026-08-07: two clients on one account
-- disagreeing about the extended-metadata frontmatter fields (`language`,
-- `writers`, `year`, `originalTitle`) that entered the `.md` format on
-- 2026-06-06 (f5b667b). One client writes them, an older build strips them on
-- parse, and each sees the other's write as a change: on one song the field was
-- added 15 times and removed 14 times in 14 days. The fix is a client update
-- plus making the parser carry frontmatter keys it does not model, so a build
-- that predates a field can never delete it. See PLAN.md §1.2 #6.

create or replace function public.prune_team_history()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- 1. One edit row per entity per actor per hour.
  with ranked as (
    select id,
           row_number() over (partition by team_id, actor_id, entity_type, entity_id, action,
                              date_trunc('hour', created_at) order by created_at) as rn
    from public.team_activity
    where action in ('song_edited', 'setlist_edited')
  )
  delete from public.team_activity a using ranked r
  where a.id = r.id and r.rn > 1;

  -- 2. Age out. The feed shows recent activity; nothing reads past 90 days.
  delete from public.team_activity where created_at < now() - interval '90 days';

  -- 3. Keep the 20 most recent snapshots per song. `team_song_versions` is the
  --    undo history behind "New version"; twenty is more than anyone scrolls
  --    and it bounds a storm's damage.
  with ranked as (
    select id, row_number() over (partition by team_id, song_key order by created_at desc) as rn
    from public.team_song_versions
  )
  delete from public.team_song_versions v using ranked r
  where v.id = r.id and r.rn > 20;
end;
$$;

-- Trigger functions and maintenance functions are never called by a client.
revoke execute on function public.prune_team_history() from public, anon, authenticated;

select cron.schedule(
  'team-history-prune',
  '23 3 * * *',
  $$select public.prune_team_history();$$
);
