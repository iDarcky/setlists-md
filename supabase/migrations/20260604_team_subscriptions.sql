-- Per-team subscriptions: each team/church workspace is its own billing unit.
--
-- The model: one Stripe Subscription per team, with the team owner as the
-- payer (a single Stripe Customer can hold many subscriptions — one per
-- workspace they own). These columns are written by the Stripe webhook once
-- billing is live. Until then, existing and newly-created teams default to
-- 'active' so nothing is gated off and current users keep working unchanged.
--
-- Canonical tier field: teams.plan ('team' | 'church'). The teams.billing_plan
-- column added by 20260522_plans_migration is superseded by teams.plan and is
-- no longer read by the app (kept here, not dropped, to avoid a destructive
-- column drop on a remote project).

alter table public.teams
  add column if not exists subscription_status text not null default 'active'
    check (subscription_status in ('trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists current_period_end timestamptz;

-- Grandfather every existing team as active.
update public.teams
  set subscription_status = 'active'
  where subscription_status is null;

-- Webhook lookups resolve a team by its Stripe subscription id.
create index if not exists idx_teams_stripe_subscription
  on public.teams(stripe_subscription_id);

comment on column public.teams.billing_plan is
  'DEPRECATED: use teams.plan as the canonical tier. Retained to avoid a destructive drop; no longer read by the app.';
comment on column public.teams.subscription_status is
  'Per-workspace Stripe subscription state. A workspace whose status is not active/trialing drops to free-tier access via useEntitlement.';
