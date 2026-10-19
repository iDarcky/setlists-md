-- 20261019_notify_worker_every_5_min.sql — run the notification worker every
-- five minutes instead of every minute.
--
-- Each run makes about ten API calls (setlists, schedules, notifications,
-- teams, profiles, the heartbeat), and every call is a log line. At one run a
-- minute that was ~85% of the project's log volume and pushed it past the
-- Free plan's log ingest. Reminders and "maybe" nudges are hour-scale, so the
-- only cost is that a push can now arrive up to five minutes late.

do $$
declare v_job bigint;
begin
  select jobid into v_job from cron.job where jobname = 'notify-worker';
  if v_job is not null then
    perform cron.alter_job(v_job, schedule := '*/5 * * * *');
  end if;
end;
$$;
