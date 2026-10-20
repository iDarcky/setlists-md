-- 20261020_team_services.sql — services as real church objects.
--
-- Until now a "service" was only a name typed on a setlist (`content.service`).
-- This makes it a row a leader sets up once: Sunday Morning, Youth Night, …
-- each with its own day, start time, how far ahead people are asked, the band
-- parts it needs and a starting song outline, plus the people who play in it.
--
--   * `team_services`        — one row per service. Readable by every member
--                              of the Space; written by owner/admin/leader.
--   * `team_service_members` — who plays in which service. A person is asked
--                              "Can you play?" only for the dates of the
--                              services they are on. Same read/write split.
--
-- Recurrence is deliberately small: a weekday, and optionally "the Nth one of
-- the month" (1–5). Every Sunday = weekday 0, nth null. First Wednesday =
-- weekday 3, nth 1. Dates are computed on the client (lib/services.js).
--
-- `auto_add`: a newcomer approved through the join link is put on every
-- auto_add service by the trigger below. "Approve all" relies on it; the
-- single-approve sheet lets the leader change the picks afterwards.
--
-- Availability is NOT touched: team_availability stays one answer per person
-- per DATE, so a Yes for Sunday covers every Sunday service that person is on.
-- Older builds keep upserting on (team_id, user_id, date) unchanged.
--
-- Additive and idempotent. Policies use `(select auth.uid())`
-- (20260911_db_hygiene) and the roster-manager set from 20261019_join_links.

-- ── 1. Tables ────────────────────────────────────────────────────────────────

create table if not exists public.team_services (
  id          uuid        primary key default gen_random_uuid(),
  team_id     uuid        not null references public.teams(id) on delete cascade,
  name        text        not null check (char_length(btrim(name)) between 1 and 60),
  color       text        not null default 'teal' check (color ~ '^[a-z]{3,12}$'),
  weekday     smallint    not null default 0 check (weekday between 0 and 6),
  nth         smallint    check (nth between 1 and 5),
  start_time  time        not null default '10:00',
  ask_weeks   smallint    not null default 3 check (ask_weeks between 1 and 12),
  parts       text[]      not null default '{}' check (cardinality(parts) <= 16),
  outline     text        not null default '' check (char_length(outline) <= 500),
  auto_add    boolean     not null default false,
  position    int         not null default 0,
  created_by  uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.team_services is
  'Recurring services of a Space (Sunday Morning, Youth Night…). Members read; owner/admin/leader write.';

create index if not exists team_services_team_idx on public.team_services (team_id, position);
create index if not exists team_services_created_by_idx on public.team_services (created_by);

create table if not exists public.team_service_members (
  service_id uuid        not null references public.team_services(id) on delete cascade,
  team_id    uuid        not null references public.teams(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  added_by   uuid        references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (service_id, user_id)
);

comment on table public.team_service_members is
  'Who plays in which service. Drives which dates a member is asked about.';

create index if not exists team_service_members_team_idx on public.team_service_members (team_id);
create index if not exists team_service_members_user_idx on public.team_service_members (user_id);
create index if not exists team_service_members_added_by_idx on public.team_service_members (added_by);

-- team_id on a membership row must be its service's team (the RLS checks
-- team_id, so a mismatch would let a leader of A write into B's service).
create or replace function public.trg_service_member_team()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select s.team_id into new.team_id from public.team_services s where s.id = new.service_id;
  if new.team_id is null then
    raise exception 'Unknown service.' using errcode = '23503';
  end if;
  return new;
end;
$$;

revoke execute on function public.trg_service_member_team() from public, anon, authenticated;

drop trigger if exists service_member_team on public.team_service_members;
create trigger service_member_team
  before insert or update on public.team_service_members
  for each row execute function public.trg_service_member_team();

create or replace function public.trg_team_services_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.trg_team_services_touch() from public, anon, authenticated;

drop trigger if exists team_services_touch on public.team_services;
create trigger team_services_touch
  before update on public.team_services
  for each row execute function public.trg_team_services_touch();

-- ── 2. RLS ───────────────────────────────────────────────────────────────────

alter table public.team_services        enable row level security;
alter table public.team_service_members enable row level security;

drop policy if exists "team_services_select" on public.team_services;
create policy "team_services_select" on public.team_services
  for select to authenticated
  using (
    team_id in (select public.get_user_teams())
    or team_id in (select id from public.teams where owner_id = (select auth.uid()))
  );

drop policy if exists "team_services_write" on public.team_services;
create policy "team_services_write" on public.team_services
  for all to authenticated
  using (team_id in (select public.get_user_join_manager_teams()))
  with check (team_id in (select public.get_user_join_manager_teams()));

drop policy if exists "team_service_members_select" on public.team_service_members;
create policy "team_service_members_select" on public.team_service_members
  for select to authenticated
  using (
    team_id in (select public.get_user_teams())
    or team_id in (select id from public.teams where owner_id = (select auth.uid()))
  );

drop policy if exists "team_service_members_write" on public.team_service_members;
create policy "team_service_members_write" on public.team_service_members
  for all to authenticated
  using (team_id in (select public.get_user_join_manager_teams()))
  with check (team_id in (select public.get_user_join_manager_teams()));

revoke all on public.team_services        from anon;
revoke all on public.team_service_members from anon;

-- ── 3. Newcomers join the auto_add services ─────────────────────────────────

create or replace function public.trg_member_auto_services()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.team_service_members (service_id, team_id, user_id, added_by)
  select s.id, s.team_id, new.user_id, new.invited_by
    from public.team_services s
   where s.team_id = new.team_id and s.auto_add
  on conflict do nothing;
  return new;
end;
$$;

revoke execute on function public.trg_member_auto_services() from public, anon, authenticated;

drop trigger if exists member_auto_services on public.team_members;
create trigger member_auto_services
  after insert on public.team_members
  for each row execute function public.trg_member_auto_services();

-- Leaving the Space takes you off its services.
create or replace function public.trg_member_left_services()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.team_service_members
   where team_id = old.team_id and user_id = old.user_id;
  return old;
end;
$$;

revoke execute on function public.trg_member_left_services() from public, anon, authenticated;

drop trigger if exists member_left_services on public.team_members;
create trigger member_left_services
  after delete on public.team_members
  for each row execute function public.trg_member_left_services();

-- ── 4. Realtime ──────────────────────────────────────────────────────────────

alter table public.team_services        replica identity full;
alter table public.team_service_members replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_services') then
    alter publication supabase_realtime add table public.team_services;
  end if;
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_service_members') then
    alter publication supabase_realtime add table public.team_service_members;
  end if;
end;
$$;
