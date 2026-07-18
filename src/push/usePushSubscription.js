import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../auth/supabase';
import { useAuth } from '../auth/useAuth';
import { VAPID_PUBLIC_KEY, vapidKeyBytes } from './vapid';

// Per-device Web Push registration. `enable()` runs the full flow —
// permission prompt → PushManager.subscribe → upsert into push_subscriptions —
// and `disable()` tears both sides down. Degrades to `supported: false` on
// browsers without push (iOS Safari outside an installed PWA, old WebViews)
// and when signed out.
// Subscribe this device's push manager and upsert the row. Shared by the
// explicit enable() flow and the silent auto-resubscribe below.
async function subscribeAndSave(reg, user) {
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidKeyBytes(),
  });
  const json = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh || '',
    auth: json.keys?.auth || '',
    user_agent: navigator.userAgent.slice(0, 200),
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });
  if (error) throw new Error(error.message);
  return sub;
}

export function usePushSubscription() {
  const { user } = useAuth();
  const [state, setState] = useState({ supported: false, subscribed: false, busy: false, denied: false });

  const supported = typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
    && !!supabase
    && !!VAPID_PUBLIC_KEY;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Guard inside the async body (not synchronously in the effect) so we
      // don't trip react-hooks/set-state-in-effect.
      if (!supported || !user) {
        if (!cancelled) setState((s) => ({ ...s, supported: false, subscribed: false }));
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        // Stay on by default: if the user already granted permission but this
        // device has no live subscription (first load after granting, or a
        // service-worker update dropped it), re-subscribe SILENTLY — permission
        // is already there, so no prompt. New users still opt in once via
        // enable(); the browser requires that grant and it can't be defaulted.
        if (!sub && Notification.permission === 'granted') {
          try { sub = await subscribeAndSave(reg, user); } catch { /* keep unsubscribed */ }
          if (cancelled) return;
        }
        setState({
          supported: true,
          subscribed: !!sub,
          busy: false,
          denied: Notification.permission === 'denied',
        });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, supported: false }));
      }
    })();
    return () => { cancelled = true; };
  }, [supported, user]);

  const enable = useCallback(async () => {
    if (!supported || !user) return false;
    setState((s) => ({ ...s, busy: true }));
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState((s) => ({ ...s, busy: false, denied: permission === 'denied' }));
        return false;
      }
      const reg = await navigator.serviceWorker.ready;
      await subscribeAndSave(reg, user);
      setState((s) => ({ ...s, subscribed: true, busy: false }));
      return true;
    } catch (err) {
      console.warn('[push] enable failed:', err?.message || err);
      setState((s) => ({ ...s, busy: false }));
      return false;
    }
  }, [supported, user]);

  const disable = useCallback(async () => {
    setState((s) => ({ ...s, busy: true }));
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
    } catch (err) {
      console.warn('[push] disable failed:', err?.message || err);
    }
    setState((s) => ({ ...s, subscribed: false, busy: false }));
  }, []);

  return { ...state, supported: supported && state.supported, enable, disable };
}
