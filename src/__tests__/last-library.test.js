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
    expect(waitingForHomeSpace({ ...base, timedOut: true })).toBe(false);
    expect(waitingForHomeSpace({ ...base, userId: null })).toBe(false);
    expect(waitingForHomeSpace({ ...base, userId: null, authLoading: true })).toBe(true);
  });

  it('waits for a remembered church until it, my role and its schedules are known', () => {
    const base = { userId: 'u', authLoading: false, teamsLoaded: false, activeLibrary: 'team-1', timedOut: false, loaded: true, teamId: null, schedulesLoaded: false };
    expect(waitingForHomeSpace(base)).toBe(true);
    expect(waitingForHomeSpace({ ...base, teamsLoaded: true })).toBe(true);
    expect(waitingForHomeSpace({ ...base, teamsLoaded: true, teamId: 'team-1' })).toBe(true);
    expect(waitingForHomeSpace({ ...base, teamsLoaded: true, teamId: 'team-1', schedulesLoaded: true })).toBe(false);
    expect(waitingForHomeSpace({ ...base, timedOut: true })).toBe(false);
  });

  it('waits for the library to load from the device, even past the timeout', () => {
    const base = { userId: 'u', authLoading: false, teamsLoaded: true, activeLibrary: 'personal', timedOut: true, loaded: false };
    expect(waitingForHomeSpace(base)).toBe(true);
    expect(waitingForHomeSpace({ ...base, loaded: true })).toBe(false);
  });
});
