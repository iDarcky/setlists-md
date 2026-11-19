// Supabase Edge Function: delete-account
//
// Purpose: permanently delete the calling user's auth record.
//
// Owned teams are NOT automatically deleted. Instead, ownership is
// transferred to the earliest-joined admin, or the earliest member if
// no admin exists. The team is deleted only when the owner is the sole
// member.
//
// Cascade-deletes: profile + team_members rows via ON DELETE CASCADE FKs.
// invited_by columns SET NULL via the 20260607 migration so pending invites
// created by this user are preserved with a null inviter.
//
// Deploy:
//   supabase functions deploy delete-account --no-verify-jwt=false
//
// Env required:
//   SUPABASE_URL              — auto-injected
//   SUPABASE_SERVICE_ROLE_KEY — service role key, never expose to client

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface DeleteResult {
  ok: boolean;
  error?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ ok: false, error: 'Server misconfiguration: missing env.' }, 500);
  }

  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) {
    return json({ ok: false, error: 'Missing Authorization header.' }, 401);
  }

  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return json({ ok: false, error: 'Not signed in.' }, 401);
  }

  const userId = userData.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Transfer ownership of any teams this user owns rather than deleting them.
  // Preference order: earliest admin → earliest member → delete (no one left).
  // Every query's error is checked: a failed lookup must stop the whole
  // deletion, never fall through to "nobody left, delete the team" (that
  // would wipe a church's songs and setlists on a timeout).
  const { data: ownedTeams, error: ownedErr } = await admin
    .from('teams')
    .select('id')
    .eq('owner_id', userId);
  if (ownedErr) return failed('look up your groups', ownedErr);

  for (const team of (ownedTeams ?? [])) {
    // 1. The earliest-joined admin who isn't the departing owner.
    const { data: admins, error: adminsErr } = await admin
      .from('team_members')
      .select('user_id')
      .eq('team_id', team.id)
      .eq('role', 'admin')
      .neq('user_id', userId)
      .order('joined_at', { ascending: true })
      .limit(1);
    if (adminsErr) return failed('look up group leaders', adminsErr);

    let newOwnerId: string | undefined = admins?.[0]?.user_id;

    if (!newOwnerId) {
      // 2. No admin — promote the earliest regular member instead.
      const { data: members, error: membersErr } = await admin
        .from('team_members')
        .select('user_id')
        .eq('team_id', team.id)
        .neq('user_id', userId)
        .order('joined_at', { ascending: true })
        .limit(1);
      if (membersErr) return failed('look up group members', membersErr);

      newOwnerId = members?.[0]?.user_id;
    }

    if (newOwnerId) {
      // Transfer ownership and make sure the new owner is an admin.
      const { error: ownerErr } = await admin
        .from('teams').update({ owner_id: newOwnerId }).eq('id', team.id);
      if (ownerErr) return failed('hand the group to another leader', ownerErr);
      const { error: roleErr } = await admin
        .from('team_members')
        .update({ role: 'admin' })
        .eq('team_id', team.id)
        .eq('user_id', newOwnerId);
      if (roleErr) return failed('make the new owner a leader', roleErr);
    } else {
      // Owner was the only member — nothing to preserve, delete the team.
      const { error: teamDelErr } = await admin.from('teams').delete().eq('id', team.id);
      if (teamDelErr) return failed('delete your empty group', teamDelErr);
    }
  }

  // Profile row cascades from auth.users; explicit delete kept as defence-in-depth.
  try {
    await admin.from('profiles').delete().eq('id', userId);
  } catch {
    // best-effort
  }

  const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
  if (deleteErr) {
    return json({ ok: false, error: deleteErr.message }, 500);
  }

  return json({ ok: true }, 200);
});

// Stop before deleteUser: the account stays, and nothing is half-deleted that
// a retry can't finish.
function failed(step: string, err: { message?: string }): Response {
  console.error(`delete-account: could not ${step}:`, err?.message);
  return json({ ok: false, error: `Couldn't ${step}. Your account was not deleted. Please try again.` }, 500);
}

function json(body: DeleteResult, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
