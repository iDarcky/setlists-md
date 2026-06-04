// stripe-webhook
//
// Receives Stripe subscription lifecycle events and writes the per-workspace
// subscription state back onto the `teams` row. This is the half that makes
// useEntitlement's status gate real: a lapsed subscription flips the workspace
// to past_due/canceled/unpaid and its paid features gate off.
//
// Resolves the target team from `metadata.team_id` (stamped at checkout in
// stripe-checkout) or, as a fallback, by matching `stripe_customer_id`.
//
// Configure the endpoint in the Stripe dashboard pointing at:
//   https://<project-ref>.functions.supabase.co/stripe-webhook
// and subscribe to: checkout.session.completed,
// customer.subscription.created, customer.subscription.updated,
// customer.subscription.deleted.
//
// NOTE: deploy this function with `--no-verify-jwt` — Stripe calls it without a
// Supabase JWT; authenticity is proven by the Stripe-Signature header instead.
//
// Required env (set via `supabase secrets set`):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (provided automatically)
//   STRIPE_SECRET_KEY        — sk_live_… / sk_test_…
//   STRIPE_WEBHOOK_SECRET    — whsec_… from the dashboard endpoint

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@18';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

// Map Stripe's subscription.status to our teams.subscription_status check
// constraint (trialing | active | past_due | canceled | unpaid).
function mapStatus(s: string): string {
  switch (s) {
    case 'trialing': return 'trialing';
    case 'active': return 'active';
    case 'past_due': return 'past_due';
    case 'paused': return 'past_due';
    case 'unpaid': return 'unpaid';
    case 'incomplete': return 'unpaid';
    case 'canceled':
    case 'incomplete_expired': return 'canceled';
    default: return 'unpaid';
  }
}

function planFromMetadata(meta: Record<string, string> | null | undefined): string | null {
  const p = meta?.plan;
  return (p === 'team' || p === 'church') ? p : null;
}

// current_period_end lives on the subscription in older API versions and on the
// subscription item in newer ones (2025-03-31.basil+). Read whichever is set.
function periodEndIso(sub: Stripe.Subscription): string | null {
  // deno-lint-ignore no-explicit-any
  const top = (sub as any).current_period_end;
  // deno-lint-ignore no-explicit-any
  const item = (sub.items?.data?.[0] as any)?.current_period_end;
  const ts = typeof top === 'number' ? top : (typeof item === 'number' ? item : null);
  return ts ? new Date(ts * 1000).toISOString() : null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!STRIPE_SECRET_KEY || !WEBHOOK_SECRET) {
    return new Response('billing_not_configured', { status: 503 });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) return new Response('Missing signature', { status: 400 });

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2025-03-31.basil',
    httpClient: Stripe.createFetchHttpClient(),
  });

  // Raw body is required for signature verification. constructEventAsync is the
  // Deno-compatible (async, WebCrypto) variant.
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, WEBHOOK_SECRET);
  } catch (err) {
    return new Response(`Signature verification failed: ${(err as Error).message}`, { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Apply a subscription's current state to its team row.
  async function applySubscription(sub: Stripe.Subscription, fallbackTeamId?: string | null) {
    const teamId = (sub.metadata?.team_id as string) || fallbackTeamId || null;
    const patch: Record<string, unknown> = {
      subscription_status: mapStatus(sub.status),
      stripe_subscription_id: sub.id,
      stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null,
      current_period_end: periodEndIso(sub),
    };
    const plan = planFromMetadata(sub.metadata as Record<string, string>);
    if (plan) {
      patch.plan = plan;
      patch.max_seats = plan === 'church' ? 30 : 10;
    }

    if (teamId) {
      await admin.from('teams').update(patch).eq('id', teamId);
    } else {
      // No team_id on the subscription — resolve by customer id.
      await admin.from('teams').update(patch).eq('stripe_customer_id', patch.stripe_customer_id);
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const teamId = (session.metadata?.team_id as string) || session.client_reference_id || null;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await applySubscription(sub, teamId);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await applySubscription(sub);
        break;
      }
      default:
        // Ignore unrelated events.
        break;
    }
  } catch (err) {
    // Return 500 so Stripe retries.
    return new Response(`handler_error: ${(err as Error).message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
