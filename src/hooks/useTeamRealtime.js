import { useEffect, useRef } from 'react';
import { supabase } from '../auth/supabase';

/**
 * Subscribes to Supabase Realtime changes on the team library tables
 * (`team_songs` and `team_setlists`) for the given team. When another
 * member inserts, updates, or deletes a row, `onRemoteChange` fires so
 * the caller can trigger a sync.
 *
 * The hook debounces rapid-fire events (e.g. a bulk import pushing 20
 * songs) into a single callback.
 *
 * @param {string|null} teamId  — UUID of the active team, or null/undefined to disable.
 * @param {() => void}  onRemoteChange — callback when a change is detected.
 */
export function useTeamRealtime(teamId, onRemoteChange) {
  const callbackRef = useRef(onRemoteChange);
  useEffect(() => {
    callbackRef.current = onRemoteChange;
  }, [onRemoteChange]);

  useEffect(() => {
    if (!supabase || !teamId) return;

    let debounceTimer = null;
    const DEBOUNCE_MS = 1500; // Batch rapid changes into one sync

    const handleChange = () => {
      // Ignore events that originated from this client's own writes.
      // Supabase Realtime doesn't natively tag the originator, but we
      // can skip the event if it arrives while we're mid-push (the sync
      // engine's own push already updates local state). A simple debounce
      // achieves 90% of this — our own writes complete, then the
      // Realtime event fires and we re-pull, which is a harmless no-op.
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        callbackRef.current?.();
      }, DEBOUNCE_MS);
    };

    // Unique topic per subscription so a repeated topic can't return an
    // already-subscribed channel (which makes .on('postgres_changes') throw).
    const channel = supabase
      .channel(`team-library-${teamId}-${Math.random().toString(36).slice(2, 9)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_songs',
          filter: `team_id=eq.${teamId}`,
        },
        handleChange,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_setlists',
          filter: `team_id=eq.${teamId}`,
        },
        handleChange,
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[realtime] Listening for team ${teamId} library changes`);
        }
        if (err) {
          console.warn('[realtime] Subscription error:', err);
        }
      });

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [teamId]);
}
