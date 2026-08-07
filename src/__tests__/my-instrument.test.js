import { describe, it, expect } from 'vitest';
import { resolveMyInstrument } from '@/lib/myInstrument';

const ME = 'user-me';
const members = [
  { user_id: ME, instruments: ['Acoustic Guitar'] },
  { user_id: 'user-other', instruments: ['Drums'] },
];

describe('resolveMyInstrument', () => {
  it('prefers the role the leader put me on for this service', () => {
    const got = resolveMyInstrument({
      userId: ME,
      setlistId: 'sl-1',
      schedules: [{ user_id: ME, setlist_id: 'row-uuid', role: 'Bass', availability: 'available' }],
      members,
      setlistMap: { 'sl-1': 'row-uuid' },
    });
    // Not the acoustic guitar — this week they're on bass. The value comes
    // back CANONICAL (`data/instruments.js`), not as the stored label: the
    // reader compares it against a TAB_INSTRUMENTS key, and "Bass" never
    // matched one.
    expect(got).toBe('bass-guitar');
  });

  it('never matches a schedule against the local setlist id alone', () => {
    // team_schedules.setlist_id is the team_setlists ROW uuid. Without the
    // map bridge the lookup misses and we must not invent an instrument from
    // a row belonging to some other service.
    const got = resolveMyInstrument({
      userId: ME,
      setlistId: 'sl-1',
      schedules: [{ user_id: 'user-other', setlist_id: 'row-uuid', role: 'Drums' }],
      members: [{ user_id: ME, instruments: ['Keys', 'Vocals'] }],
      setlistMap: { 'sl-1': 'row-uuid' },
    });
    expect(got).toBeNull();
  });

  it('falls back to my instrument when I only play one', () => {
    expect(resolveMyInstrument({ userId: ME, members })).toBe('acoustic-guitar');
  });

  it('guesses nothing when I play several', () => {
    // Hiding the wrong tab is worse than showing all of them.
    expect(resolveMyInstrument({
      userId: ME,
      members: [{ user_id: ME, instruments: ['Keys', 'Vocals'] }],
    })).toBeNull();
  });

  it('ignores a role I declined and falls back', () => {
    expect(resolveMyInstrument({
      userId: ME,
      setlistId: 'sl-1',
      schedules: [{ user_id: ME, setlist_id: 'sl-1', role: 'Bass', availability: 'unavailable' }],
      members,
    })).toBe('acoustic-guitar');
  });

  it('canonicalises whatever spelling the row happens to hold', () => {
    // Production holds Title Case labels written by older builds, and they are
    // deliberately never migrated in place — normalising on READ is the whole
    // contract. Both spellings must land on the same answer.
    for (const stored of ['Acoustic Guitar', 'acoustic-guitar', 'acoustic']) {
      expect(resolveMyInstrument({
        userId: ME, members: [{ user_id: ME, instruments: [stored] }],
      })).toBe('acoustic-guitar');
    }
  });

  it('still guesses nothing when two spellings of two instruments are held', () => {
    expect(resolveMyInstrument({
      userId: ME, members: [{ user_id: ME, instruments: ['Keys', 'Piano'] }],
    })).toBeNull();
  });

  it('treats two spellings of ONE instrument as one instrument', () => {
    // 'Bass' and 'bass-guitar' are the same thing; before normalisation this
    // read as "plays several" and silently gave up.
    expect(resolveMyInstrument({
      userId: ME, members: [{ user_id: ME, instruments: ['Bass', 'bass-guitar'] }],
    })).toBe('bass-guitar');
  });

  it('is null for a guest or a personal workspace', () => {
    expect(resolveMyInstrument({ userId: null, members })).toBeNull();
    expect(resolveMyInstrument({ userId: ME })).toBeNull();
    expect(resolveMyInstrument()).toBeNull();
  });
});
