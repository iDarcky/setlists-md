import { describe, it, expect } from 'vitest';
import {
  INSTRUMENTS, VOCAL_PARTS, normalize, parseToken, labelFor, tabId,
  displayModeFor, wantsDiagrams, INSTRUMENT_IDS, partsFor,
} from '@/data/instruments';
import { TAB_INSTRUMENTS } from '@/data/tabInstruments';

describe('instruments — the musical axis', () => {
  it('is a closed list of seven, vocals alone carrying a second level', () => {
    expect(INSTRUMENTS.map(i => i.id)).toEqual([
      'vocals', 'acoustic-guitar', 'electric-guitar', 'bass-guitar',
      'keys', 'piano', 'drums',
    ]);
    expect(INSTRUMENTS.filter(i => i.parts).map(i => i.id)).toEqual(['vocals']);
  });

  // ⚠ THE BUG THIS FILE EXISTS FOR. `SectionBlock` opens a tab when
  // `tab.instrument === myInstrument`, where the left side is a
  // TAB_INSTRUMENTS key and the right side used to be whatever the schedule
  // said. 'acoustic' === 'Acoustic Guitar' is false, so a scheduled player's
  // OWN tab was the one that stayed collapsed.
  it('maps every instrument onto a real TAB_INSTRUMENTS key, or none', () => {
    for (const inst of INSTRUMENTS) {
      if (inst.tabs !== null) expect(TAB_INSTRUMENTS).toHaveProperty(inst.tabs);
    }
    expect(tabId('Acoustic Guitar')).toBe('acoustic');
    expect(tabId('acoustic-guitar')).toBe('acoustic');
    expect(tabId('Bass')).toBe('bass');
    expect(tabId('Drums')).toBeNull();
  });

  it('normalises every spelling production actually holds', () => {
    // Measured 2026-08-07 against team_members.instruments and
    // team_schedules.role — these are the real stored values.
    expect(normalize('Acoustic Guitar')).toBe('acoustic-guitar');
    expect(normalize('Electric Guitar')).toBe('electric-guitar');
    expect(normalize('Bass')).toBe('bass-guitar');
    expect(normalize('Drums')).toBe('drums');
    expect(normalize('Piano')).toBe('piano');
    expect(normalize('Lead Vocal')).toBe('vocals');
  });

  // 6 rows in production say "Lead male"/"Lead female" and the distinction is
  // deliberate — folding both into one `lead` would flatten them silently.
  it('keeps lead male and lead female apart', () => {
    expect(normalize('Lead male')).toBe('vocals:lead-male');
    expect(normalize('Lead female')).toBe('vocals:lead-female');
    expect(labelFor('vocals:lead-male')).toBe('Vocals · Lead male');
    expect(normalize('Lead male')).not.toBe(normalize('Lead female'));
  });

  it('accepts values already canonical, and is case/space insensitive', () => {
    expect(normalize('drums')).toBe('drums');
    expect(normalize('  DRUMS  ')).toBe('drums');
    expect(normalize('vocals:soprano')).toBe('vocals:soprano');
  });

  it('drops a part that does not exist rather than inventing a token', () => {
    expect(normalize('vocals:kazoo')).toBe('vocals');
    expect(normalize('drums:lead')).toBe('drums');
  });

  it('resolves nothing for values that mean nothing', () => {
    for (const bad of ['', '   ', null, undefined, 'Klavier', 'trombone']) {
      expect(normalize(bad)).toBeNull();
    }
  });

  // Leading a service is an administrative role plus a per-service flag, not
  // an instrument — it must not quietly become somebody's instrument.
  it('refuses to treat "leader" as an instrument', () => {
    expect(normalize('leader')).toBeNull();
    expect(normalize('Worship Leader')).toBeNull();
  });

  it('labels an instrument and its part', () => {
    expect(labelFor('drums')).toBe('Drums');
    expect(labelFor('bass-guitar')).toBe('Bass Guitar');
    expect(labelFor('vocals:alto')).toBe('Vocals · Alto');
    expect(labelFor('Acoustic Guitar')).toBe('Acoustic Guitar');
    expect(labelFor('nonsense')).toBe('');
  });

  it('parses a token into instrument and part', () => {
    expect(parseToken('vocals:tenor').instrument.id).toBe('vocals');
    expect(parseToken('vocals:tenor').part.id).toBe('tenor');
    expect(parseToken('keys').part).toBeNull();
    expect(parseToken('junk')).toEqual({ instrument: null, part: null });
  });

  it('gives the reader a display mode and a diagram answer per instrument', () => {
    expect(displayModeFor('drums')).toBe('lyrics');
    expect(displayModeFor('vocals:alto')).toBe('lyrics');
    expect(displayModeFor('electric-guitar')).toBe('chords');
    expect(wantsDiagrams('acoustic-guitar')).toBe(true);
    expect(wantsDiagrams('drums')).toBe(false);
    expect(displayModeFor('junk')).toBeNull();
  });

  // ⚠ A picker takes TWO STEPS. A flattened "instruments and their parts in
  // one list" helper existed briefly and, wired into the two roster pickers
  // that already had their own Vocal-part row, put Vocals in the picker EIGHT
  // times. Step one is instruments only.
  it('offers only the seven instruments in step one', () => {
    expect(INSTRUMENT_IDS).toEqual(INSTRUMENTS.map(i => i.id));
    expect(INSTRUMENT_IDS).toHaveLength(7);
    for (const id of INSTRUMENT_IDS) expect(id).not.toContain(':');
    for (const id of INSTRUMENT_IDS) expect(normalize(id)).toBe(id);
  });

  it('offers a second step only for what has parts', () => {
    expect(partsFor('vocals')).toEqual(VOCAL_PARTS);
    expect(partsFor('vocals:alto')).toEqual(VOCAL_PARTS);
    for (const id of ['drums', 'keys', 'piano', 'bass-guitar', 'acoustic-guitar', 'electric-guitar']) {
      expect(partsFor(id)).toEqual([]);
    }
    // Nothing to offer for a value that means nothing — never a crash.
    expect(partsFor('junk')).toEqual([]);
    expect(partsFor(null)).toEqual([]);
  });
});
