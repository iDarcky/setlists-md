// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { readLastLibrary, writeLastLibrary, waitingForHomeSpace } from '@/lib/lastLibrary';

describe('lastLibrary', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to personal and remembers a church', () => {
    expect(readLastLibrary()).toBe('personal');
    writeLastLibrary('team-1');
    expect(readLastLibrary()).toBe('team-1');
    writeLastLibrary('personal');
    expect(readLastLibrary()).toBe('personal');
  });

  it('waits on launch only while Personal is a placeholder', () => {
    const base = { userId: 'u', authLoading: false, teamsLoaded: false, activeLibrary: 'personal', timedOut: false };
    expect(waitingForHomeSpace(base)).toBe(true);
    expect(waitingForHomeSpace({ ...base, teamsLoaded: true })).toBe(false);
    expect(waitingForHomeSpace({ ...base, activeLibrary: 'team-1' })).toBe(false);
    expect(waitingForHomeSpace({ ...base, timedOut: true })).toBe(false);
    expect(waitingForHomeSpace({ ...base, userId: null })).toBe(false);
    expect(waitingForHomeSpace({ ...base, userId: null, authLoading: true })).toBe(true);
  });
});
