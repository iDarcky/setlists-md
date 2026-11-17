import { describe, it, expect } from 'vitest';
import { syncStatus } from '@/lib/syncStatus';

describe('syncStatus', () => {
  const now = Date.parse('2026-11-15T12:00:00Z');
  it('no provider = on this device only', () => {
    expect(syncStatus({ provider: null }, now, true).state).toBe('local');
  });
  it('offline beats everything else once synced', () => {
    expect(syncStatus({ provider: 'x', state: 'error' }, now, false).state).toBe('offline');
  });
  it('error, syncing, ok', () => {
    expect(syncStatus({ provider: 'x', state: 'error' }, now, true).label).toBe('Not synced');
    expect(syncStatus({ provider: 'x', state: 'syncing' }, now, true).state).toBe('pending');
    expect(syncStatus({ provider: 'x', state: 'idle', lastSync: '2026-11-15T11:50:00Z' }, now, true).label).toBe('Up to date · 10 min ago');
    expect(syncStatus({ provider: 'x', state: 'idle', lastSync: '2026-11-15T11:59:30Z' }, now, true).label).toBe('Up to date');
  });
});
