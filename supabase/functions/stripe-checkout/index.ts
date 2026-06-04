// stripe-checkout
//
// Per-workspace billing: each team/church is its own Stripe subscription, paid
// by the team owner. A single Stripe Customer (the owner) can hold many
// subscriptions — one per workspace they own.
//
// Actions (POST JSON, requires a Supabase user JWT in `Authorization`):
//   { action: 'checkout', teamId, plan }
//     → creates a Checkout Session for that team's subscription and returns
//       { url } for the browser to redirect to. Only the team OWNER may pay.
//   { action: 'portal', teamId }
//     → creates a Stripe Billing Portal session (manage payment method,
//       cancel, switch plan) and returns { url }. Owner only.
//
// The function is DORMANT until configured: with no STRIPE_SECRET_KEY it
// returns 503 `billing_not_configured`, and the client surfaces a friendly
// "billing isn't live yet" message. The companion `stripe-webhook` function
// writes subscription status back onto the team row.
//
// Required env (set via `supabase secrets set`):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (provided automatically)
//   STRIPE_SECRET_KEY        — sk_live_… / sk_test_…
//   STRIPE_PRICE_TEAM        — price_… for the $12/mo Team tier
//   STRIPE_PRICE_CHURCH      — price_… for the $24/mo Church tier
//   APP_URL                  — e.g. https://setlists.md (success/cancel base)

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@18';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const APP_URL = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '');
const PRICES: Record<string, string> = {
  team: Deno.env.get('STRIPE_PRICE_TEAM') ?? '',
  church: Deno.env.get('STRIPE_PRICE_CHURCH') ?? '',
};

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Dormant until Stripe is configured.
  if (!STRIPE_SECRET_KEY) return json({ error: 'billing_not_configured' }, 503);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Missing bearer token' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: userErr } = await admin.auth.getUser(authHeader.slice(7));
  if (userErr || !user) return json({ error: 'Invalid token' }, 401);

  let body: { action?: string; teamId?: string; plan?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.teamId) return json({ error: 'Missing teamId' }, 400);

  // Load the team and enforce owner-only billing.
  const { data: team, error: teamErr } = await admin
    .from('teams')
    .select('id, owner_id, plan, stripe_customer_id')
    .eq('id', body.teamId)
    .maybeSingle();
  if (teamErr) return json({ error: 'Failed to load team', detail: teamErr.message }, 500);
  if (!team) return json({ error: 'Team not found' }, 404);
  if (team.owner_id !== user.id) return json({ error: 'Only the workspace owner can manage billing' }, 403);

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2025-03-31.basil',
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    // Ensure the team has a Stripe customer (owner is the payer). Reuse if set.
    let customerId = team.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id, team_id: team.id },
      });
      customerId = customer.id;
      await admin.from('teams').update({ stripe_customer_id: customerId }).eq('id', team.id);
    }

    if (body.action === 'portal') {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${APP_URL}/?billing=portal&team=${team.id}`,
      });
      return json({ url: session.url });
    }

    if (body.action === 'checkout') {
      const plan = (body.plan === 'church' || body.plan === 'team') ? body.plan : (team.plan || 'team');
      const price = PRICES[plan];
      if (!price) return json({ error: 'price_not_configured', detail: plan }, 400);

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price, quantity: 1 }],
        // Tie the resulting subscription back to this specific workspace so the
        // webhook can resolve it regardless of which event arrives first.
        client_reference_id: team.id,
        metadata: { team_id: team.id, plan },
        subscription_data: { metadata: { team_id: team.id, plan } },
        success_url: `${APP_URL}/?billing=success&team=${team.id}`,
        cancel_url: `${APP_URL}/?billing=cancel&team=${team.id}`,
        allow_promotion_codes: true,
      });
      return json({ url: session.url });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    return json({ error: 'stripe_error', detail: (err as Error).message }, 500);
  }
});
