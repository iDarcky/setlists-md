-- Lock a group's billing columns against edits from the app.
--
-- Found by /condom quick (2026-11-19): the policy "Owner can update team"
-- (20260427_create_teams.sql) has no column limit, so a group owner could run
--   update teams set plan = 'church', max_seats = 30, subscription_status = 'active'
-- from the browser console and get a paid tier without paying.
--
-- After this file, only the server may change these columns:
--   plan, max_seats, subscription_status, stripe_customer_id,
--   stripe_subscription_id, billing_plan
-- "The server" = the service_role key (the stripe-webhook / stripe-checkout
-- edge functions) or a direct database session (SQL editor, migrations).
-- Requests made with a user's JWT (role authenticated or anon) that change
-- any of them are rejected. Everything else an owner edits (name, location,
-- logo, timezone…) works as before.
--
-- INSERT is not touched: today the app picks plan + seats when a group is
-- created, and during the free beta that is correct. When Stripe billing goes
-- live, also run the commented line at the bottom so a new group starts
-- unpaid unless the webhook says otherwise.
--
-- Additive and idempotent. Owner runs it on production (prod is read-only for
-- Claude).

create or replace function public.guard_team_billing_columns()
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
  -- Only requests that come in with a user's JWT are limited.
  if v_role not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.plan                   is distinct from old.plan
  or new.max_seats              is distinct from old.max_seats
  or new.subscription_status    is distinct from old.subscription_status
  or new.stripe_customer_id     is distinct from old.stripe_customer_id
  or new.stripe_subscription_id is distinct from old.stripe_subscription_id
  or new.billing_plan           is distinct from old.billing_plan
  then
    raise exception 'Plan and billing details can only be changed through checkout.'
      using errcode = '42501';  -- insufficient_privilege
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_team_billing_columns on public.teams;
create trigger trg_guard_team_billing_columns
  before update on public.teams
  for each row
  execute function public.guard_team_billing_columns();

-- When billing goes live (not before), also run:
-- alter table public.teams alter column subscription_status set default 'unpaid';
