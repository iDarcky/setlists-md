# Stripe billing Edge Functions

Per-workspace subscriptions: each team/church is its own Stripe subscription,
paid by the team **owner**. A single Stripe Customer (the owner) can hold many
subscriptions — one per workspace they own.

Two functions:

- **`stripe-checkout`** — owner-only. `{ action: 'checkout', teamId, plan }`
  returns a Stripe Checkout URL; `{ action: 'portal', teamId }` returns a
  Billing Portal URL. Requires a Supabase user JWT.
- **`stripe-webhook`** — receives Stripe subscription events, verifies the
  signature, and writes `subscription_status` / `stripe_customer_id` /
  `stripe_subscription_id` / `current_period_end` (and `plan`/`max_seats`)
  back onto the `teams` row. This is what makes `useEntitlement`'s status gate
  real.

## Dormant by default

Both functions are inert until configured: with no `STRIPE_SECRET_KEY` they
return `503 billing_not_configured`. The client also hides all billing UI
unless `VITE_STRIPE_ENABLED=true`. So this can ship safely before billing is
live (it currently is not — `PricingScreen` only captures email intent).

## Prerequisites

1. The `20260604_team_subscriptions.sql` migration is applied (adds the
   subscription columns to `teams`).
2. In Stripe, create two recurring **Prices** — Team ($12/mo) and Church
   ($24/mo) — and note their `price_…` ids.

## Deploy

```bash
# Checkout/portal — standard (JWT-verified) function.
supabase functions deploy stripe-checkout

# Webhook — Stripe calls it WITHOUT a Supabase JWT; authenticity is the
# Stripe-Signature header, so disable JWT verification.
supabase functions deploy stripe-webhook --no-verify-jwt
```

## Secrets

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_or_test_… \
  STRIPE_WEBHOOK_SECRET=whsec_… \
  STRIPE_PRICE_TEAM=price_… \
  STRIPE_PRICE_CHURCH=price_… \
  APP_URL=https://setlists.md
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically. The
secret key and webhook secret never reach the client.

## Wire the webhook

In the Stripe dashboard → Developers → Webhooks, add an endpoint:

```
https://<project-ref>.functions.supabase.co/stripe-webhook
```

Subscribe to: `checkout.session.completed`, `customer.subscription.created`,
`customer.subscription.updated`, `customer.subscription.deleted`. Copy the
endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`.

## Turn it on

Set `VITE_STRIPE_ENABLED=true` in the client environment (Vercel / `.env.local`)
and redeploy the frontend. New workspaces then route through Checkout, and the
Settings → Plan panel shows **Subscribe** / **Manage billing** for owners.

## Flow

1. Owner creates a workspace (or taps Subscribe) → `stripe-checkout` creates a
   session scoped to that `team_id` (passed in metadata + `client_reference_id`).
2. Owner pays on Stripe → redirected to `APP_URL/?billing=success&team=…`.
3. Stripe fires `checkout.session.completed` → `stripe-webhook` stamps the team
   row `active` with the subscription id + period end.
4. On lapse (`past_due`/`canceled`/`unpaid`), the webhook updates the status and
   `useEntitlement` drops the whole workspace to free-tier access.
