import { useState, useEffect, useRef, useCallback } from 'react';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { supabase } from '../auth/supabase';

// Per-user PRIVATE notes ("My note") for a team workspace. Cloud-backed via the
// team_notes table, cached in IndexedDB so notes are readable/writable offline
// and pushed when back online. Personal workspaces don't use this (no split).
//
// A scope is { songId?, setlistId?, sectionKey? }; unused parts are '' so they
// match the table's NOT-NULL columns and the upsert conflict target.

const CONFLICT = 'team_id,user_id,song_id,setlist_id,section_key';
const cacheKey = (teamId, userId) => `setlists-md:team-notes:${teamId}:${userId}`;

export function scopeKey({ songId, setlistId, sectionKey } = {}) {
  return `${songId || ''}|${setlistId || ''}|${sectionKey || ''}`;
}

export function usePrivateNotes(teamId, userId) {
  const enabled = !!(teamId && userId && supabase);
  const [notes, setNotes] = useState({}); // scopeKey -> { body, updated_at, dirty?, song_id, setlist_id, section_key }
  const [ready, setReady] = useState(false);
  const notesRef = useRef(notes);
  useEffect(() => { notesRef.current = notes; }, [notes]);

  const persistCache = useCallback((next) => {
    if (!enabled) return;
    idbSet(cacheKey(teamId, userId), next).catch(() => { /* private mode */ });
  }, [enabled, teamId, userId]);

  // Load: cache first (instant, offline-safe), then merge the server copy.
  // This effect's whole job is to sync the external store into state, so the
  // resets here are intentional.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!enabled) { setNotes({}); setReady(false); return; }
      setReady(false);
      let local = {};
      try { local = (await idbGet(cacheKey(teamId, userId))) || {}; } catch { /* ignore */ }
      if (cancelled) return;
      setNotes(local);
      try {
        const { data, error } = await supabase
          .from('team_notes')
          .select('song_id, setlist_id, section_key, body, updated_at')
          .eq('team_id', teamId)
          .eq('user_id', userId);
        if (!error && data && !cancelled) {
          setNotes(prev => {
            const merged = { ...prev };
            for (const row of data) {
              const k = scopeKey({ songId: row.song_id, setlistId: row.setlist_id, sectionKey: row.section_key });
              const existing = merged[k];
              // Server wins unless we hold a newer unsynced (dirty) local edit.
              if (!existing || (!existing.dirty && new Date(row.updated_at) >= new Date(existing.updated_at || 0))) {
                merged[k] = { ...row };
              }
            }
            persistCache(merged);
            return merged;
          });
        }
      } catch { /* offline — keep the cache */ }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, [enabled, teamId, userId, persistCache]);

  // Read straight from state so callers re-render when a note changes.
  const getNote = (scope) => notes[scopeKey(scope)]?.body || '';

  const setNote = useCallback((scope, body) => {
    if (!enabled) return;
    const k = scopeKey(scope);
    const song_id = scope.songId || '';
    const setlist_id = scope.setlistId || '';
    const section_key = scope.sectionKey || '';
    const trimmed = (body || '').trim();
    const updated_at = new Date().toISOString();

    // Optimistic local write (+ cache) so it survives offline.
    setNotes(prev => {
      const next = { ...prev };
      if (!trimmed) delete next[k];
      else next[k] = { body: trimmed, updated_at, dirty: true, song_id, setlist_id, section_key };
      persistCache(next);
      return next;
    });

    (async () => {
      try {
        if (!trimmed) {
          await supabase.from('team_notes').delete()
            .eq('team_id', teamId).eq('user_id', userId)
            .eq('song_id', song_id).eq('setlist_id', setlist_id).eq('section_key', section_key);
          return;
        }
        const { error } = await supabase.from('team_notes').upsert(
          { team_id: teamId, user_id: userId, song_id, setlist_id, section_key, body: trimmed, updated_at },
          { onConflict: CONFLICT },
        );
        if (!error) {
          setNotes(prev => {
            const cur = prev[k];
            if (!cur) return prev;
            const next = { ...prev, [k]: { ...cur, dirty: false } };
            persistCache(next);
            return next;
          });
        }
      } catch { /* stays dirty; flushed on reconnect */ }
    })();
  }, [enabled, teamId, userId, persistCache]);

  // Push any notes that didn't make it to the server when we come back online.
  useEffect(() => {
    if (!enabled) return undefined;
    const flush = async () => {
      const dirty = Object.values(notesRef.current).filter(n => n.dirty);
      for (const n of dirty) {
        try {
          const { error } = await supabase.from('team_notes').upsert(
            { team_id: teamId, user_id: userId, song_id: n.song_id, setlist_id: n.setlist_id, section_key: n.section_key, body: n.body, updated_at: n.updated_at },
            { onConflict: CONFLICT },
          );
          if (!error) {
            const k = scopeKey({ songId: n.song_id, setlistId: n.setlist_id, sectionKey: n.section_key });
            setNotes(prev => (prev[k] ? { ...prev, [k]: { ...prev[k], dirty: false } } : prev));
          }
        } catch { /* keep dirty */ }
      }
    };
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [enabled, teamId, userId]);

  return { enabled, ready, getNote, setNote };
}
