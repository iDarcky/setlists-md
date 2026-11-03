import { describe, it, expect } from 'vitest';
import { syncProblem, SYNC_PROBLEM_AFTER_MS } from '@/lib/homeData';
import { isQuotaError } from '@/lib/storageErrors';

describe('syncProblem', () => {
  const now = 10_000_000;
  const failing = { provider: 'supabase-team:t', state: 'error', errorSince: now - SYNC_PROBLEM_AFTER_MS };
  it('speaks up once sync has failed for a while', () => {
    expect(syncProblem(failing, now)).toBe(true);
  });
  it('stays quiet for a fresh failure', () => {
    expect(syncProblem({ ...failing, errorSince: now - 1000 }, now)).toBe(false);
  });
  it('stays quiet offline, when synced, or with no sync at all', () => {
    expect(syncProblem(failing, now, false)).toBe(false);
    expect(syncProblem({ ...failing, state: 'synced' }, now)).toBe(false);
    expect(syncProblem({ ...failing, provider: null }, now)).toBe(false);
    expect(syncProblem(null, now)).toBe(false);
  });
});

describe('isQuotaError', () => {
  it('knows each browser’s out-of-space error', () => {
    expect(isQuotaError({ name: 'QuotaExceededError' })).toBe(true);
    expect(isQuotaError({ code: 22 })).toBe(true);
    expect(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
    expect(isQuotaError(new Error('Encountered full disk while opening backing store for indexedDB.open. quota'))).toBe(true);
  });
  it('ignores other failures', () => {
    expect(isQuotaError(new Error('Network down'))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
  });
});
