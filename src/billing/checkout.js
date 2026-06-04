// Per-workspace billing client helpers.
//
// Each team/church workspace is its own Stripe subscription, paid by the team
// owner. These thin wrappers call the `stripe-checkout` Edge Function (which
// enforces owner-only access server-side) and redirect the browser to the
// returned Stripe-hosted URL.
//
// Billing is DORMANT until configured: set VITE_STRIPE_ENABLED=true once the
// Stripe keys + prices are wired on the Edge Function. Until then the UI hides
// the billing controls, and any direct call degrades to a friendly error
// because the function returns `billing_not_configured`.

import { callEdgeFunction } from '../sync/edge';

export const BILLING_ENABLED =
  String(import.meta.env.VITE_STRIPE_ENABLED || '').toLowerCase() === 'true';

/**
 * Start a subscription for a workspace. Redirects to Stripe Checkout.
 * @param {string} teamId
 * @param {'team'|'church'} [plan] — defaults to the team's current tier server-side
 */
export async function startTeamCheckout(teamId, plan) {
  const res = await callEdgeFunction('stripe-checkout', { action: 'checkout', teamId, plan });
  if (res?.url) window.location.assign(res.url);
  return res;
}

/**
 * Open the Stripe Billing Portal for a workspace (manage card, cancel, switch).
 * @param {string} teamId
 */
export async function openBillingPortal(teamId) {
  const res = await callEdgeFunction('stripe-checkout', { action: 'portal', teamId });
  if (res?.url) window.location.assign(res.url);
  return res;
}

/**
 * Friendly message for the `billing_not_configured` / not-live state so call
 * sites can show consistent copy.
 */
export function billingError(err) {
  if (err?.code === 'billing_not_configured' || err?.status === 503) {
    return 'Billing isn’t live yet — check back soon.';
  }
  if (err?.code === 'price_not_configured') {
    return 'This plan isn’t available for checkout yet.';
  }
  return err?.message || 'Could not start checkout. Please try again.';
}
