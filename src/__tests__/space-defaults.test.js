import { describe, it, expect } from 'vitest';
import { churchDefaultSpaceId, defaultAfterJoin, openingSpaceId } from '@/lib/spaceDefaults';
import { PORTABLE_PREF_KEYS } from '@/app/usePreferenceSync';

describe('churchDefaultSpaceId', () => {
  it('picks the church for someone who never chose', () => {
    const teams = [{ id: 'band', kind: 'team' }, { id: 'grace', kind: 'church' }];
    expect(churchDefaultSpaceId({ current: undefined, teams })).toBe('grace');
    expect(churchDefaultSpaceId({ current: null, teams: [{ id: 'band', kind: 'team' }] })).toBe('band');
  });
  it('never overrides a choice', () => {
    expect(churchDefaultSpaceId({ current: 'band', teams: [{ id: 'grace', kind: 'church' }] })).toBeNull();
  });
  it('does nothing without a group', () => {
    expect(churchDefaultSpaceId({ current: null, teams: [] })).toBeNull();
  });
});

describe('openingSpaceId', () => {
  const band = { id: 'band', kind: 'team' };
  const church = { id: 'grace', kind: 'church' };
  it('opens the chosen home while the user still belongs to it', () => {
    expect(openingSpaceId({ defaultSpaceId: 'band', teams: [band, church] })).toBe('band');
  });
  it('falls back to a church, then the first group', () => {
    expect(openingSpaceId({ defaultSpaceId: 'gone', teams: [band, church] })).toBe('grace');
    expect(openingSpaceId({ defaultSpaceId: null, teams: [band] })).toBe('band');
  });
  it('opens nothing for someone in no group (the setup screen)', () => {
    expect(openingSpaceId({ defaultSpaceId: 'grace', teams: [] })).toBeNull();
  });
});

describe('defaultAfterJoin', () => {
  it('makes the first church home', () => {
    expect(defaultAfterJoin({ current: undefined, joinedTeamId: 'grace', teamIds: [] })).toBe('grace');
  });
  it('keeps an existing church home', () => {
    expect(defaultAfterJoin({ current: 'old', joinedTeamId: 'grace', teamIds: ['old'] })).toBe('old');
  });
  it('replaces a home the user no longer belongs to', () => {
    expect(defaultAfterJoin({ current: 'gone', joinedTeamId: 'grace', teamIds: ['other'] })).toBe('grace');
  });
});

describe('portable preferences', () => {
  it('the home group follows the account', () => {
    expect(PORTABLE_PREF_KEYS).toContain('defaultSpaceId');
  });
});
