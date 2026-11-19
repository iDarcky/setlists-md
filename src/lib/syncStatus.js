// One sync status for the whole app: the dot on your profile photo and the
// Sync row on You (moved off Home, owner 2026-11-15).
//   ok: synced · pending: syncing · error: not synced · offline: no network
//   local: this library is only on this device (no sync at all)

/** @returns {{ state: 'ok'|'pending'|'error'|'offline'|'local', label: string }} */
export function syncStatus(syncState, now = Date.now(), online = typeof navigator === 'undefined' || navigator.onLine !== false) {
  if (!syncState?.provider) return { state: 'local', label: 'On this device only' };
  if (!online) return { state: 'offline', label: 'Offline' };
  if (syncState.state === 'error') return { state: 'error', label: 'Not synced' };
  if (syncState.state === 'syncing') return { state: 'pending', label: 'Syncing…' };
  const mins = syncState.lastSync ? Math.round((now - new Date(syncState.lastSync).getTime()) / 60000) : null;
  return { state: 'ok', label: mins == null || mins < 2 ? 'Up to date' : `Up to date · ${mins < 60 ? `${mins} min` : `${Math.round(mins / 60)} h`} ago` };
}

/** Dot colour per state (Tailwind classes). */
export const SYNC_DOT = {
  ok: 'bg-success-text',
  pending: 'bg-warning-text',
  error: 'bg-danger',
  offline: 'bg-muted-foreground',
  local: 'bg-muted-foreground',
};
