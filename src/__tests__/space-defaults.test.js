import { describe, it, expect } from 'vitest';
import { churchDefaultSpaceId, defaultAfterJoin, hasOwnPersonalContent, shouldHidePersonal } from '@/lib/spaceDefaults';
import { PORTABLE_PREF_KEYS } from '@/app/usePreferenceSync';
import { DEMO_BASELINES, seedDemoSongs } from '@/data/demos';

const DEMO_IDS = Object.keys(DEMO_BASELINES);

describe('churchDefaultSpaceId', () => {
  it('picks the church for someone who never chose', () => {
    const teams = [{ id: 'band', kind: 'team' }, { id: 'grace', kind: 'church' }];
    expect(churchDefaultSpaceId({ current: undefined, teams })).toBe('grace');
    expect(churchDefaultSpaceId({ current: null, teams: [{ id: 'band', kind: 'team' }] })).toBe('band');
  });
  it('never overrides a choice, including Personal', () => {
    expect(churchDefaultSpaceId({ current: 'personal', teams: [{ id: 'grace', kind: 'church' }] })).toBeNull();
    expect(churchDefaultSpaceId({ current: 'band', teams: [{ id: 'grace', kind: 'church' }] })).toBeNull();
  });
  it('does nothing without a shared Space', () => {
    expect(churchDefaultSpaceId({ current: null, teams: [] })).toBeNull();
    expect(churchDefaultSpaceId({ current: null, teams: [{ id: 'p', kind: 'personal' }] })).toBeNull();
  });
});

describe('defaultAfterJoin', () => {
  it('makes the first church home', () => {
    expect(defaultAfterJoin({ current: undefined, joinedTeamId: 'grace', teamIds: [] })).toBe('grace');
    expect(defaultAfterJoin({ current: 'personal', joinedTeamId: 'grace', teamIds: [] })).toBe('grace');
  });
  it('keeps an existing church home', () => {
    expect(defaultAfterJoin({ current: 'old', joinedTeamId: 'grace', teamIds: ['old'] })).toBe('old');
  });
  it('replaces a home the user no longer belongs to', () => {
    expect(defaultAfterJoin({ current: 'gone', joinedTeamId: 'grace', teamIds: ['other'] })).toBe('grace');
  });
});

describe('hasOwnPersonalContent', () => {
  it('ignores the seeded demos', () => {
    expect(hasOwnPersonalContent(seedDemoSongs(), [], DEMO_IDS)).toBe(false);
    expect(hasOwnPersonalContent([], [], DEMO_IDS)).toBe(false);
  });
  it('counts a song of your own or any setlist', () => {
    expect(hasOwnPersonalContent([...seedDemoSongs(), { id: 'mine' }], [], DEMO_IDS)).toBe(true);
    expect(hasOwnPersonalContent([], [{ id: 's1' }], DEMO_IDS)).toBe(true);
  });
});

describe('shouldHidePersonal', () => {
  const base = { showPersonalPref: undefined, inChurch: true, hasPersonalContent: false };
  it('hides an empty Personal for a church member', () => {
    expect(shouldHidePersonal(base)).toBe(true);
  });
  it('keeps it when they asked for it', () => {
    expect(shouldHidePersonal({ ...base, showPersonalPref: true })).toBe(false);
    // "Off" is the default behaviour, not a request to hide content.
    expect(shouldHidePersonal({ ...base, showPersonalPref: false })).toBe(true);
    expect(shouldHidePersonal({ ...base, showPersonalPref: false, hasPersonalContent: true })).toBe(false);
  });
  it('keeps it outside a church', () => {
    expect(shouldHidePersonal({ ...base, inChurch: false })).toBe(false);
  });
  it('keeps it when there is personal content, or it is not known yet', () => {
    expect(shouldHidePersonal({ ...base, hasPersonalContent: true })).toBe(false);
    expect(shouldHidePersonal({ ...base, hasPersonalContent: null })).toBe(false);
  });
  it('keeps it for cloud-sync accounts, the open Space and an explicit home', () => {
    expect(shouldHidePersonal({ ...base, personalCloud: true })).toBe(false);
    expect(shouldHidePersonal({ ...base, activeIsPersonal: true })).toBe(false);
    expect(shouldHidePersonal({ ...base, defaultIsPersonal: true })).toBe(false);
  });
  it('the toggle follows the account', () => {
    expect(PORTABLE_PREF_KEYS).toContain('showPersonalSpace');
  });
});
