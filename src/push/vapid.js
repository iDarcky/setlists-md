// The VAPID *public* key — safe to ship in the bundle (it's the
// applicationServerKey every push subscription is bound to). The matching
// private key lives server-side only, in the service-role-only `app_config`
// table, where the notify-worker edge function reads it.
// Rotating the pair invalidates every existing subscription: users would
// need to re-enable push, so don't rotate casually.
export const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY ||
  'BFFAKfCfFnW7-k3-kTtDYYq9xuGe_6bc8jZFH1wTUHIN3jET8PMqOc_CF3R0pnD3gJn3D-kjTA1bcyBJdcd0gXY';

// PushManager.subscribe wants the key as raw bytes.
export function vapidKeyBytes(base64url = VAPID_PUBLIC_KEY) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob(base64url.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
