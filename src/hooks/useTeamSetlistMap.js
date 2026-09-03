import { useState, useEffect } from 'react';
import { getSyncState } from '@/sync/tokens';

/**
 * Reads the sync manifest for the given library and returns a Map from
 * local setlist IDs to their remote (Supabase UUID) IDs.
 *
 * When the user is in a team library, local setlist IDs are base-36
 * strings from `generateId()`, but the `team_schedules` table needs
 * the UUID from `team_setlists.id`. The sync engine stores this mapping
 * in `setlistManifest[localId].remoteId`. This hook exposes it.
 *
 * @param {string} libraryId — 'personal' or the team UUID
 * @param {*} [refreshKey] — optional; pass a value that changes when a sync
 *   completes (e.g. syncState.lastSync) so the mapping picks up setlists that
 *   were created/synced after mount instead of staying frozen at first read.
 * @returns {{ map: Record<string, string>, loading: boolean }}
 */
export function useTeamSetlistMap(libraryId, refreshKey) {
  const [map, setMap] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!libraryId || libraryId === 'personal') {
      setMap({});
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const state = await getSyncState(libraryId);
        if (cancelled) return;
        const manifest = state?.setlistManifest || {};
        const result = {};
        for (const [localId, entry] of Object.entries(manifest)) {
          if (entry?.remoteId) {
            result[localId] = entry.remoteId;
          }
        }
        setMap(result);
      } catch (err) {
        console.error('[useTeamSetlistMap] Failed to read manifest:', err);
        if (!cancelled) setMap({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [libraryId, refreshKey]);

  return { map, loading };
}
