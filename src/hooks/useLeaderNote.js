import { useCallback, useEffect, useRef, useState } from 'react';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { supabase } from '@/auth/supabase';

/**
 * The finale's reflection — ONE note per setlist per kind, shared between a
 * team's leaders and invisible to its members.
 *
 * Backed by `team_setlist_notes` (see 20260729_team_setlist_notes.sql), whose RLS
 * admits admins and owners only. That is the whole point: the note used to live
 * on the setlist object, which the team engine syncs to every member's device, so
 * hiding the field in the UI would not have hidden the text. Only RLS does.
 *
 * `setlistKey` is the LOCAL setlist id — the same value the identity migration
 * promoted onto `team_setlists.setlist_key`. Not the `team_setlists` row uuid,
 * which is what `team_schedules` uses and a well-documented way to silently
 * match nothing.
 *
 * Cached in IndexedDB, like `usePrivateNotes`: a leader writing a review in a
 * church car park with no signal must not lose it. A write that fails stays
 * `dirty` and is flushed on reconnect.
 *
 * Degrades to disabled — not to broken — when the table is absent (the migration
 * has not been applied yet), when there is no team, or when the caller is not a
 * leader. Callers hide the field on `enabled === false`.
 */
const CONFLICT = 'team_id,setlist_key,kind';
const cacheKey = (teamId, setlistKey, kind) =>
  `setlists-md:leader-note:${teamId}:${setlistKey}:${kind}`;

// 42P01 = undefined_table. There is no staging database, so a beta build can be
// running against a project the migration has not reached yet.
const MISSING_TABLE = '42P01';

export function useLeaderNote({ teamId, setlistKey, kind = 'live', userId = null, isLeader = false }) {
  const wanted = !!(teamId && setlistKey && isLeader && supabase);
  const [supported, setSupported] = useState(true);
  const [note, setNote] = useState('');
  const [ready, setReady] = useState(false);
  const stateRef = useRef({ body: '', updated_at: null, dirty: false });

  const enabled = wanted && supported;
  const key = wanted ? cacheKey(teamId, setlistKey, kind) : null;

  // Load: cache first so it paints instantly and works offline, then the server.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!wanted) { setNote(''); setReady(false); return; }
      setReady(false);
      let cached = null;
      try { cached = await idbGet(cacheKey(teamId, setlistKey, kind)); } catch { /* private mode */ }
      if (cancelled) return;
      if (cached?.body) {
        stateRef.current = cached;
        setNote(cached.body);
      }
      try {
        const { data, error } = await supabase
          .from('team_setlist_notes')
          .select('body, updated_at')
          .eq('team_id', teamId)
          .eq('setlist_key', setlistKey)
          .eq('kind', kind)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          if (error.code === MISSING_TABLE) setSupported(false);
        } else if (data) {
          // Server wins unless we are holding a newer unsynced edit.
          const localNewer = stateRef.current.dirty
            && new Date(stateRef.current.updated_at || 0) > new Date(data.updated_at || 0);
          if (!localNewer) {
            stateRef.current = { body: data.body || '', updated_at: data.updated_at, dirty: false };
            setNote(data.body || '');
          }
        }
      } catch { /* offline — keep the cache */ }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, [wanted, teamId, setlistKey, kind]);

  const push = useCallback(async (body, updated_at) => {
    const trimmed = (body || '').trim();
    try {
      if (!trimmed) {
        await supabase.from('team_setlist_notes').delete()
          .eq('team_id', teamId).eq('setlist_key', setlistKey).eq('kind', kind);
      } else {
        const { error } = await supabase.from('team_setlist_notes').upsert(
          { team_id: teamId, setlist_key: setlistKey, kind, body: trimmed, updated_at, updated_by: userId },
          { onConflict: CONFLICT },
        );
        if (error) {
          if (error.code === MISSING_TABLE) setSupported(false);
          return false;
        }
      }
      stateRef.current = { ...stateRef.current, dirty: false };
      if (key) idbSet(key, stateRef.current).catch(() => {});
      return true;
    } catch {
      return false; // stays dirty; the online listener retries
    }
  }, [teamId, setlistKey, kind, userId, key]);

  /** Save on blur / before navigating away. No-ops when nothing changed. */
  const save = useCallback((body) => {
    if (!enabled) return;
    const trimmed = (body || '').trim();
    if (trimmed === (stateRef.current.body || '').trim()) return;
    const updated_at = new Date().toISOString();
    stateRef.current = { body: trimmed, updated_at, dirty: true };
    setNote(trimmed);
    if (key) idbSet(key, stateRef.current).catch(() => {});
    push(trimmed, updated_at);
  }, [enabled, key, push]);

  // Flush an edit that was made offline.
  useEffect(() => {
    if (!enabled) return undefined;
    const flush = () => {
      const cur = stateRef.current;
      if (cur.dirty) push(cur.body, cur.updated_at);
    };
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [enabled, push]);

  return { enabled, ready, note, save };
}

export default useLeaderNote;
