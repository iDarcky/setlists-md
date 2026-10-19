import { describe, it, expect } from 'vitest';
import { isLockedOut, PUBLIC_VIEWS } from '@/lib/appGate';

const base = { view: 'home', loaded: true, authLoading: false, configured: true, signedIn: false, soloMode: false };

describe('isLockedOut', () => {
  it('locks a signed-out visitor out of the main app', () => {
    for (const view of ['home', 'library', 'setlists', 'settings', 'team', 'editor']) {
      expect(isLockedOut({ ...base, view })).toBe(true);
    }
  });

  it('lets a signed-in user in', () => {
    expect(isLockedOut({ ...base, signedIn: true })).toBe(false);
  });

  it('lets someone who chose Try solo in', () => {
    expect(isLockedOut({ ...base, soloMode: true })).toBe(false);
  });

  it('keeps the welcome, sign-in, join and other public screens open', () => {
    for (const view of PUBLIC_VIEWS) {
      expect(isLockedOut({ ...base, view })).toBe(false);
    }
  });

  it('waits for settings and the stored session before deciding', () => {
    expect(isLockedOut({ ...base, loaded: false })).toBe(false);
    expect(isLockedOut({ ...base, authLoading: true })).toBe(false);
  });

  it('never locks a build without accounts', () => {
    expect(isLockedOut({ ...base, configured: false })).toBe(false);
  });
});
