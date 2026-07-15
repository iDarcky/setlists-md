-- Web Push + notification worker infrastructure.
--
-- Pieces:
--  * push_subscriptions — one row per browser push registration (a user can
--    have several devices). RLS: owner-only.
--  * team_notifications.pushed_at — set by the worker once a row has been
--    fanned out to the recipient's devices (at-most-once).
--  * app_config — service-role-only key/value store carrying the VAPID keys
--    (RLS enabled with NO policies: PostgREST clients see nothing; the edge
--    function reads it with the service key). The actual secret VALUES are
--    inserted operationally, never committed to the repo.
--  * notify_on_schedule_request — being added to a roster now writes a
--    durable notification row (the decline trigger already existed), so it
--    reaches lock screens through the worker.
--  * pg_cron + pg_net — invoke the `notify-worker` edge function every
--    minute. The Authorization bearer is the project's ANON key (public by
--    design — it ships in every client bundle); the worker does nothing a
--    caller could abuse (no inputs, idempotent, service-role internally).

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select using (user_id = auth.uid());

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert with check (user_id = auth.uid());

drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete using (user_id = auth.uid());

alter table public.team_notifications
  add column if not exists pushed_at timestamptz;

-- Service-role-only configuration (VAPID keys). RLS on, zero policies.
create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
revoke all on table public.app_config from anon, authenticated;

-- Durable "you have been scheduled" notification (mirrors the decline
-- trigger from 20260616_team_notifications). The scheduler themselves is
-- never notified (self-adds are common for leaders).
create or replace function public.notify_on_schedule_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.availability = 'pending' and NEW.user_id is distinct from auth.uid() then
    insert into public.team_notifications (team_id, user_id, actor_id, type, title, body, metadata)
    values (
      NEW.team_id,
      NEW.user_id,
      auth.uid(),
      'schedule_request',
      'You have been scheduled',
      'You''ve been added to a service roster.',
      jsonb_build_object(
        'schedule_id', NEW.id,
        'setlist_id', NEW.setlist_id,
        'role', NEW.role
      )
    );
  end if;
  return null;
end;
$$;

revoke execute on function public.notify_on_schedule_request() from public, anon, authenticated;

drop trigger if exists trg_notify_schedule_request on public.team_schedules;
create trigger trg_notify_schedule_request
  after insert on public.team_schedules
  for each row execute function public.notify_on_schedule_request();

-- ── Worker heartbeat ─────────────────────────────────────────────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'notify-worker') then
    perform cron.unschedule('notify-worker');
  end if;
  perform cron.schedule(
    'notify-worker',
    '* * * * *',
    $job$
    select net.http_post(
      url := 'https://biltbdumdwugpepaawku.supabase.co/functions/v1/notify-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpbHRiZHVtZHd1Z3BlcGFhd2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NzQ2NzUsImV4cCI6MjA5MjU1MDY3NX0.2lv0SJrk33IkQhI1b7a1rLRMzassAPVAZB2zbCVChd4'
      ),
      body := '{}'::jsonb
    );
    $job$
  );

  -- A minutely job writes bookkeeping rows forever; keep a week.
  if exists (select 1 from cron.job where jobname = 'cron-history-cleanup') then
    perform cron.unschedule('cron-history-cleanup');
  end if;
  perform cron.schedule(
    'cron-history-cleanup',
    '17 3 * * *',
    $job$ delete from cron.job_run_details where end_time < now() - interval '7 days'; $job$
  );
end;
$$;
