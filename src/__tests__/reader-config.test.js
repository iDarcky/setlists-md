import { describe, it, expect } from 'vitest';
import { resolveReaderConfig, readerSettingKey, READER_KNOBS } from '@/lib/readerConfig';

const wide = { wide: true };
const narrow = { wide: false };

describe('defaults', () => {
  it('resolves a usable config from nothing', () => {
    const c = resolveReaderConfig(undefined, wide);
    expect(c.ribbon).toBe('top');
    expect(c.sectionStyle).toBe('bar');
    expect(c.sticky).toBe(false);   // wide: pinning is a phone affordance
    expect(c.notes).toBe(true);
  });

  it('falls back to the default for a value this build does not understand', () => {
    const c = resolveReaderConfig({ readerSectionStyle: 'hologram' }, wide);
    expect(c.sectionStyle).toBe('bar');
  });
});

describe('settings drive it', () => {
  it.each(Object.keys(READER_KNOBS))('reads every documented value for %s', (knob) => {
    for (const value of READER_KNOBS[knob]) {
      // `sticky` only applies on a narrow screen, so read it there.
      const ctx = knob === 'sticky' ? narrow : wide;
      const c = resolveReaderConfig({ [readerSettingKey(knob)]: value }, ctx);
      // sticky/notes resolve to booleans; the rest pass through.
      const got = typeof c[knob] === 'boolean' ? (c[knob] ? 'on' : 'off') : c[knob];
      expect(got).toBe(value);
    }
  });

  it('reuses the existing app-wide keys rather than duplicating them', () => {
    expect(readerSettingKey('ribbon')).toBe('structurePosition');
    expect(readerSettingKey('repeats')).toBe('duplicateSections');
  });
});

describe('context overrides are physical facts, not preferences', () => {
  it('places a note by the room available', () => {
    // A note belongs to its line either way; only the treatment changes.
    expect(resolveReaderConfig({}, wide).notePlacement).toBe('leader');
    expect(resolveReaderConfig({}, narrow).notePlacement).toBe('above');
  });

  it('only pins headings on a narrow screen', () => {
    // On a desktop the whole section is usually on screen already, so a pinned
    // heading is just a bar that never goes away.
    const on = { readerSticky: 'on' };
    expect(resolveReaderConfig(on, narrow).sticky).toBe(true);
    expect(resolveReaderConfig(on, wide).sticky).toBe(false);
  });

  it('keeps a side ribbon on a phone, because it floats now', () => {
    // It used to collapse to 'top' here: a DOCKED 56px rail really did have
    // nowhere to live on a 390px screen. It floats over the chart now
    // (transparent, `pointer-events-none` except the chips), so it costs no
    // layout width and the phone can have it. Owner, 2026-08-01.
    const s = { structurePosition: 'left' };
    expect(resolveReaderConfig(s, narrow).ribbon).toBe('left');
    expect(resolveReaderConfig(s, wide).ribbon).toBe('left');
  });

  it('forces one column on a narrow screen', () => {
    expect(resolveReaderConfig({ defaultColumns: 2 }, narrow).columns).toBe(1);
    expect(resolveReaderConfig({ defaultColumns: 2 }, wide).columns).toBe(2);
  });

  it('marks itself embedded so the host can own the chrome', () => {
    expect(resolveReaderConfig({}, { wide: true, embedded: true }).embedded).toBe(true);
  });
});

describe('display still flows through chartDisplay', () => {
  it('keeps stage-mode notation and type sizes', () => {
    const c = resolveReaderConfig({ notation: 'nashville', defaultFontSize: 'L' }, wide);
    expect(c.display.notation).toBe('nashville');
    expect(c.display.lyricFontSize).toBe(22);
  });
});
