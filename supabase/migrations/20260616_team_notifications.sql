-- Wave 4 hardening: a durable team_notifications table so decline alerts are
-- server-authoritative (every roster manager gets one, even if their client
-- never loaded that setlist) with persistent, cross-device read/dismiss state.
--
-- Replaces the brittle client-derived "Schedule declined" stream (App.jsx),
-- which only fired for setlists the device could resolve locally + in the
-- future, and whose read/dismiss lived only in device-local settings.
--
-- The maybe-nudge stays client-derived (it is time-relative, not event-driven,
-- so it belongs to a scheduled job, not a row trigger) — noted as a follow-up.

create table if not exists public.team_notifications (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, -- recipient
  actor_id uuid references auth.users(id) on delete set null,        -- who triggered it
  type text not null,                                                -- 'schedule_decline', …
  title text not null default '',
  body text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists team_notifications_user_idx
  on public.team_notifications (user_id, dismissed_at, created_at desc);
create index if not exists team_notifications_team_idx
  on public.team_notifications (team_id);

alter table public.team_notifications enable row level security;

-- A recipient reads / updates (mark read, dismiss) / deletes only their OWN
-- rows, and only within teams they belong to. Rows are written exclusively by
-- the SECURITY DEFINER trigger below — there is no client INSERT policy.
drop policy if exists "team_notifications_select_own" on public.team_notifications;
create policy "team_notifications_select_own" on public.team_notifications
  for select using (
    user_id = auth.uid()
    and team_id in (select public.get_user_teams())
  );

drop policy if exists "team_notifications_update_own" on public.team_notifications;
create policy "team_notifications_update_own" on public.team_notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "team_notifications_delete_own" on public.team_notifications;
create policy "team_notifications_delete_own" on public.team_notifications
  for delete using (user_id = auth.uid());

-- Fan a decline out to every roster manager (admins + leaders + owner) of the
-- team, skipping the decliner themselves. SECURITY DEFINER so it can insert
-- rows for other users (bypassing the absent INSERT policy).
create or replace function public.notify_on_schedule_decline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only when availability flips TO 'unavailable'.
  if NEW.availability is distinct from 'unavailable' then
    return null;
  end if;
  if TG_OP = 'UPDATE' and OLD.availability is not distinct from NEW.availability then
    return null;
  end if;

  insert into public.team_notifications (team_id, user_id, actor_id, type, title, body, metadata)
  select
    NEW.team_id,
    mgr.user_id,
    NEW.user_id,
    'schedule_decline',
    'Schedule declined',
    'A team member can''t make a service.',
    jsonb_build_object(
      'schedule_id', NEW.id,
      'setlist_id', NEW.setlist_id,
      'declined_by', NEW.user_id,
      'role', NEW.role
    )
  from (
    select m.user_id
      from public.team_members m
     where m.team_id = NEW.team_id and m.role in ('admin', 'leader')
    union
    select t.owner_id as user_id
      from public.teams t
     where t.id = NEW.team_id and t.owner_id is not null
  ) mgr
  where mgr.user_id is not null
    and mgr.user_id <> NEW.user_id;

  return null;
end;
$$;

drop trigger if exists trg_notify_schedule_decline on public.team_schedules;
create trigger trg_notify_schedule_decline
  after insert or update on public.team_schedules
  for each row execute function public.notify_on_schedule_decline();
