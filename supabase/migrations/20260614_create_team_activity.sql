-- Team activity feed.
--
-- A team_activity table + one SECURITY DEFINER trigger function attached to the
-- team tables. Every meaningful change (song/setlist add/edit/remove, member
-- join, roster assignment, availability change) is auto-logged with the actor
-- (auth.uid()) and a denormalized entity name, so the feed renders without
-- extra joins and can't be forgotten when new write paths are added.

create table if not exists public.team_activity (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  entity_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists team_activity_team_created_idx
  on public.team_activity (team_id, created_at desc);

alter table public.team_activity enable row level security;

-- Team members (and the owner) read their team's activity. No client inserts —
-- rows are written by the SECURITY DEFINER trigger below.
create policy "team members read activity"
  on public.team_activity
  for select
  using (
    (team_id in (select get_user_teams()))
    or (team_id in (select id from public.teams where owner_id = auth.uid()))
  );

create or replace function public.log_team_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_actor uuid := auth.uid();
  v_action text;
  v_entity_type text := TG_ARGV[0];
  v_entity_id text;
  v_entity_name text;
  v_meta jsonb := '{}'::jsonb;
begin
  if TG_TABLE_NAME = 'team_songs' then
    v_team_id := coalesce(NEW.team_id, OLD.team_id);
    v_entity_id := coalesce(NEW.id, OLD.id)::text;
    v_entity_name := coalesce(NEW.title, OLD.title);
    v_action := case TG_OP when 'INSERT' then 'song_added' when 'UPDATE' then 'song_edited' else 'song_removed' end;
  elsif TG_TABLE_NAME = 'team_setlists' then
    v_team_id := coalesce(NEW.team_id, OLD.team_id);
    v_entity_id := coalesce(NEW.id, OLD.id)::text;
    v_entity_name := coalesce(NEW.name, OLD.name);
    v_action := case TG_OP when 'INSERT' then 'setlist_created' when 'UPDATE' then 'setlist_edited' else 'setlist_removed' end;
  elsif TG_TABLE_NAME = 'team_members' then
    v_team_id := NEW.team_id;
    v_actor := NEW.user_id;
    v_entity_id := NEW.user_id::text;
    v_action := 'member_joined';
  elsif TG_TABLE_NAME = 'team_schedules' then
    v_team_id := NEW.team_id;
    v_entity_id := NEW.user_id::text;
    v_meta := jsonb_build_object('role', NEW.role, 'vocal_part', NEW.vocal_part, 'setlist_id', NEW.setlist_id);
    v_action := 'roster_assigned';
  elsif TG_TABLE_NAME = 'team_availability' then
    if TG_OP = 'UPDATE' and NEW.status is not distinct from OLD.status then
      return null;
    end if;
    v_team_id := NEW.team_id;
    v_actor := NEW.user_id;
    v_meta := jsonb_build_object('date', NEW.date, 'status', NEW.status);
    v_action := 'availability_set';
  else
    return null;
  end if;

  insert into public.team_activity (team_id, actor_id, action, entity_type, entity_id, entity_name, metadata)
  values (v_team_id, v_actor, v_action, v_entity_type, v_entity_id, v_entity_name, v_meta);

  return null;
end;
$$;

drop trigger if exists trg_activity_songs on public.team_songs;
create trigger trg_activity_songs after insert or update or delete on public.team_songs
  for each row execute function public.log_team_activity('song');

drop trigger if exists trg_activity_setlists on public.team_setlists;
create trigger trg_activity_setlists after insert or update or delete on public.team_setlists
  for each row execute function public.log_team_activity('setlist');

drop trigger if exists trg_activity_members on public.team_members;
create trigger trg_activity_members after insert on public.team_members
  for each row execute function public.log_team_activity('member');

drop trigger if exists trg_activity_schedules on public.team_schedules;
create trigger trg_activity_schedules after insert on public.team_schedules
  for each row execute function public.log_team_activity('schedule');

drop trigger if exists trg_activity_availability on public.team_availability;
create trigger trg_activity_availability after insert or update on public.team_availability
  for each row execute function public.log_team_activity('availability');
