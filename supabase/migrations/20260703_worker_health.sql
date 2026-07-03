-- Watch the watcher: the notify-worker runs on a minutely cron, and a silent
-- failure (expired key, broken deploy, cron unscheduled) would otherwise go
-- unnoticed until someone asks why nothing pushes. The worker now writes a
-- heartbeat into app_config on every run; this function exposes ONLY the
-- heartbeat keys (never the VAPID secrets that live in the same table) to
-- signed-in users so the app's diagnostics panel can show
-- "worker last ran Xm ago" and flag staleness.

create or replace function public.get_worker_health()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_object_agg(key, value) filter (where key in ('worker_last_run', 'worker_last_result')),
    '{}'::jsonb
  )
  from public.app_config
  where key in ('worker_last_run', 'worker_last_result');
$$;

revoke execute on function public.get_worker_health() from public, anon;
grant execute on function public.get_worker_health() to authenticated;
