// notify-worker — the notification background worker, invoked by pg_cron
// (every minute, see 20260702_web_push.sql) and safe to invoke at will: every
// step is idempotent.
//
//  1. MAYBE-NUDGES: any 'maybe' availability on a setlist dated within the
//     next 14 days gets a durable `team_notifications` row ("Still a maybe?"),
//     once per schedule row — the server-side successor of the client-derived
//     nudge (which only fired while the app was open).
//  2. WEB PUSH: unpushed, undismissed notification rows fan out to the
//     recipient's registered `push_subscriptions` via RFC 8291/8292 Web Push
//     (see ./webpush.ts). Rows are marked pushed_at regardless of delivery
//     (at-most-once — no retry storms); dead subscriptions (404/410) are
//     pruned.
//
// Configuration lives in the service-role-only `app_config` table:
// vapid_public_key / vapid_private_key / vapid_subject. Without them the
// worker still runs step 1 and reports push as skipped (dormant mode).
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { sendWebPush, VapidKeys } from './webpush.ts';

const NUDGE_HORIZON_DAYS = 14;
const PUSH_LOOKBACK_MS = 2 * 24 * 3600 * 1000;

async function generateMaybeNudges(supa: SupabaseClient): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + NUDGE_HORIZON_DAYS * 86400000).toISOString().slice(0, 10);

  const { data: setlists, error: slErr } = await supa
    .from('team_setlists')
    .select('id, team_id, name, content')
    .gte('content->>date', today)
    .lte('content->>date', horizon);
  if (slErr) throw new Error(slErr.message);
  if (!setlists?.length) return 0;

  const { data: maybes, error: schErr } = await supa
    .from('team_schedules')
    .select('id, team_id, setlist_id, user_id, role')
    .eq('availability', 'maybe')
    .in('setlist_id', setlists.map((s) => s.id));
  if (schErr) throw new Error(schErr.message);
  if (!maybes?.length) return 0;

  // One nudge per schedule row, ever — dismissed nudges stay dismissed.
  const { data: existing } = await supa
    .from('team_notifications')
    .select('metadata')
    .eq('type', 'schedule_maybe_nudge')
    .in('metadata->>schedule_id', maybes.map((m) => m.id));
  const nudged = new Set((existing || []).map((r) => r.metadata?.schedule_id));

  const rows = maybes
    .filter((m) => !nudged.has(m.id))
    .map((m) => {
      const sl = setlists.find((s) => s.id === m.setlist_id);
      const name = sl?.content?.name || sl?.name || 'A setlist';
      return {
        team_id: m.team_id,
        user_id: m.user_id,
        type: 'schedule_maybe_nudge',
        title: 'Still a maybe?',
        body: `"${name}" is coming up — confirm whether you can make it.`,
        metadata: { schedule_id: m.id, setlist_id: m.setlist_id, date: sl?.content?.date, role: m.role },
      };
    });
  if (rows.length) {
    const { error } = await supa.from('team_notifications').insert(rows);
    if (error) throw new Error(error.message);
  }
  return rows.length;
}

async function pushPending(supa: SupabaseClient, vapid: VapidKeys) {
  const out = { pushed: 0, pruned: 0 };
  const { data: pending, error } = await supa
    .from('team_notifications')
    .select('id, user_id, title, body, type, metadata')
    .is('pushed_at', null)
    .is('dismissed_at', null)
    .gte('created_at', new Date(Date.now() - PUSH_LOOKBACK_MS).toISOString())
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  if (!pending?.length) return out;

  const { data: subs } = await supa
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', [...new Set(pending.map((n) => n.user_id))]);
  const byUser = new Map<string, typeof subs>();
  for (const s of subs || []) {
    const list = byUser.get(s.user_id) || [];
    list.push(s);
    byUser.set(s.user_id, list);
  }

  const dead: string[] = [];
  for (const n of pending) {
    for (const sub of byUser.get(n.user_id) || []) {
      try {
        const res = await sendWebPush(sub, {
          title: n.title || 'setlists.md',
          body: n.body || '',
          tag: `tn-${n.id}`,
          url: '/',
        }, vapid);
        if (res.status === 404 || res.status === 410) dead.push(sub.id);
        else if (res.ok || res.status === 201) out.pushed += 1;
        // Drain the body so the runtime doesn't leak the connection.
        await res.arrayBuffer().catch(() => {});
      } catch {
        // Transient send failure — the row is still marked below (at-most-once).
      }
    }
  }

  await supa
    .from('team_notifications')
    .update({ pushed_at: new Date().toISOString() })
    .in('id', pending.map((n) => n.id));
  if (dead.length) {
    await supa.from('push_subscriptions').delete().in('id', dead);
    out.pruned = dead.length;
  }
  return out;
}

Deno.serve(async (_req: Request) => {
  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const result: Record<string, unknown> = { nudges: 0, pushed: 0, pruned: 0, pushEnabled: false };
  const errors: string[] = [];

  try {
    result.nudges = await generateMaybeNudges(supa);
  } catch (err) {
    errors.push(`nudges: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const { data: cfgRows } = await supa
      .from('app_config')
      .select('key, value')
      .in('key', ['vapid_public_key', 'vapid_private_key', 'vapid_subject']);
    const cfg = Object.fromEntries((cfgRows || []).map((r) => [r.key, r.value]));
    if (cfg.vapid_public_key && cfg.vapid_private_key) {
      result.pushEnabled = true;
      const pushRes = await pushPending(supa, {
        publicKey: cfg.vapid_public_key,
        privateKey: cfg.vapid_private_key,
        subject: cfg.vapid_subject || 'mailto:maghisdaniel@gmail.com',
      });
      result.pushed = pushRes.pushed;
      result.pruned = pushRes.pruned;
    }
  } catch (err) {
    errors.push(`push: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (errors.length) result.errors = errors;
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
});
