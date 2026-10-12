import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/auth/supabase';
import { isMissingRpc } from '@/sync/replica-engine';

// The personal library's workspace on Supabase (docs/SYNC-REDESIGN.md, step 4):
// a `teams` row with kind = 'personal', created lazily by
// `ensure_personal_workspace()` the first time an account with cloud sync
// signs in. The id is remembered per user in localStorage so it is known
// synchronously on the next launch — the engine for the personal library is
// chosen at mount, before any network round trip.
//
// Returns the workspace id, or null: signed out, not entitled, or a project
// without the migration (the RPC is missing — logged once, no error surfaced).

const KEY = (uid) => `setlists-md:personal-workspace:${uid}`;

function remembered(uid) {
  if (!uid) return null;
  try { return localStorage.getItem(KEY(uid)) || null; } catch { return null; }
}
function remember(uid, id) {
  try { localStorage.setItem(KEY(uid), id); } catch { /* private mode */ }
}

let warnedMissing = false;

export function usePersonalWorkspace(userId, enabled) {
  // What the server confirmed this session, tagged by user so a sign-out and
  // sign-in as someone else never carries the previous account's id.
  const [confirmed, setConfirmed] = useState(null);
  const cached = useMemo(() => remembered(userId), [userId]);

  useEffect(() => {
    if (!supabase || !userId || !enabled) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('ensure_personal_workspace');
        if (cancelled) return;
        if (error) {
          if (isMissingRpc(error)) {
            if (!warnedMissing) console.warn('[personal-workspace] ensure_personal_workspace is missing on this project (20260911_personal_workspaces).');
            warnedMissing = true;
          } else {
            console.warn('[personal-workspace] ensure_personal_workspace failed:', error.message);
          }
          return;
        }
        if (typeof data === 'string' && data) {
          remember(userId, data);
          setConfirmed({ uid: userId, id: data });
        }
      } catch (err) {
        if (!cancelled) console.warn('[personal-workspace] ensure_personal_workspace failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, enabled]);

  if (!userId || !enabled) return null;
  if (confirmed?.uid === userId) return confirmed.id;
  return cached;
}
