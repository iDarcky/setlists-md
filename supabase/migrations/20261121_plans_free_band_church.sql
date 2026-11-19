-- Plans: Free, Band and Church (decided 2026-11-19).
--
--   Free    plan 'free'    5 people   songs + setlists
--   Band    plan 'team'   15 people   songs + setlists           €9.99/month
--   Church  plan 'church' 40 people   + schedule and services    €19.99/month
--
-- `teams.kind` says what the group IS ('church' or 'team' = a band) and picks
-- the words the app uses; `teams.plan` says what it PAYS for. No payments
-- yet: a plan is changed by hand in the SQL editor (examples at the bottom).
--
-- What it does (one transaction, all or nothing):
--   1. lets `plan` be 'free' and makes Free the default for a new group;
--   2. marks the three churches as kind 'church' (they were all 'team');
--   3. raises Church groups from 30 to 40 seats;
--   4. a new group made from the app always starts on Free with 5 seats,
--      whatever the app sends, and one account may own only one group.
-- Nothing is deleted. XB (Band) keeps its schedule rows in the database; the
-- app just stops showing the schedule on Band.
--
-- Run it before the app with this change reaches people: an older app would
-- still be able to make groups, and they'd simply start on Free.
-- Prod is read-only for Claude; the owner runs this in the SQL editor.

begin;

-- 1. Free is a plan ('personal' stays allowed until remove-personal runs).
alter table public.teams drop constraint if exists teams_plan_check;
alter table public.teams
  add constraint teams_plan_check check (plan in ('personal', 'free', 'team', 'church'));
alter table public.teams alter column plan set default 'free';
alter table public.teams alter column max_seats set default 5;

-- 2. Churches are churches (the app shows church words only for these).
update public.teams set kind = 'church' where plan = 'church' and kind = 'team';

-- 3. Church is 40 people now; Band is 15.
update public.teams set max_seats = 40 where plan = 'church' and max_seats < 40;
update public.teams set max_seats = 15 where plan = 'team'   and max_seats < 15;

-- 4. A group made from the app: Free, 5 seats, and one per owner.
create or replace function public.guard_new_team()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_role text := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );
begin
  -- The SQL editor and the service role (future checkout) are not limited.
  if v_role not in ('authenticated', 'anon') then
    return new;
  end if;

  if exists (
    select 1 from public.teams
    where owner_id = new.owner_id and kind <> 'personal'
  ) then
    raise exception 'You already have a church or band of your own.'
      using errcode = '42501';
  end if;

  new.plan := 'free';
  new.max_seats := 5;
  new.subscription_status := 'active';
  if new.kind is null or new.kind not in ('team', 'church') then
    new.kind := 'team';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_new_team on public.teams;
create trigger trg_guard_new_team
  before insert on public.teams
  for each row
  execute function public.guard_new_team();

commit;

-- Check afterwards:
--   select name, kind, plan, max_seats from public.teams order by created_at;
--   (Providenta, Beta-Church, Inchinare Sincera: church / church / 40; XB: team / team / 15)
--
-- Changing a group's plan by hand (SQL editor):
--   Band:   update public.teams set plan = 'team',   max_seats = 15 where name = '…';
--   Church: update public.teams set plan = 'church', max_seats = 40 where name = '…';
--   +10 people on Church (€5): update public.teams set max_seats = max_seats + 10 where name = '…';
--   Back to Free: update public.teams set plan = 'free', max_seats = 5 where name = '…';
