import { describe, it, expect } from 'vitest';
import {
  resolveReaderConfig,
  setReaderKnob,
  resetReaderPreset,
  isReaderPreset,
  READER_PRESET_IDS,
  READER_KNOBS,
} from '@/lib/readerConfig';

const wide = { wide: true, setlist: true };

describe('reader presets', () => {
  it('exposes exactly the three presets', () => {
    expect(READER_PRESET_IDS).toEqual(['live', 'rehearsal', 'practice']);
  });

  it('falls back to live for an unknown preset', () => {
    expect(resolveReaderConfig({}, 'nonsense', wide).preset).toBe('live');
    expect(isReaderPreset('nonsense')).toBe(false);
  });

  it('gives each preset a distinct character', () => {
    const live = resolveReaderConfig({}, 'live', wide);
    const reh = resolveReaderConfig({}, 'rehearsal', wide);
    const prac = resolveReaderConfig({}, 'practice', wide);

    // Live is the locked-down one.
    expect(live.allowEdit).toBe(false);
    expect(live.confirmExit).toBe(true);
    expect(live.headerDensity).toBe('min');

    // Rehearsal unlocks editing but has no practice tools.
    expect(reh.allowEdit).toBe(true);
    expect(reh.showTools).toBe(false);

    // Practice is the only one with the tools bar.
    expect(prac.showTools).toBe(true);
  });
});

describe('user overrides', () => {
  it('lets a saved knob beat the preset default', () => {
    const settings = { readerConfig: { live: { sectionStyle: 'mono' } } };
    expect(resolveReaderConfig(settings, 'live', wide).sectionStyle).toBe('mono');
  });

  it('scopes overrides to one preset', () => {
    const settings = { readerConfig: { live: { sectionStyle: 'mono' } } };
    expect(resolveReaderConfig(settings, 'rehearsal', wide).sectionStyle).toBe('block');
  });

  it('ignores a value this build does not understand', () => {
    const settings = { readerConfig: { live: { sectionStyle: 'hologram' } } };
    // Falls back to the preset default rather than rendering nothing.
    expect(resolveReaderConfig(settings, 'live', wide).sectionStyle).toBe('bar');
  });

  it('writes a knob without touching other presets', () => {
    const settings = { readerConfig: { rehearsal: { columnFlow: 'balanced' } } };
    const next = setReaderKnob(settings, 'live', 'sectionStyle', 'card');
    expect(next.live.sectionStyle).toBe('card');
    expect(next.rehearsal.columnFlow).toBe('balanced');
    // original untouched
    expect(settings.readerConfig.live).toBeUndefined();
  });

  it('resets one preset back to its meaning', () => {
    const settings = { readerConfig: { live: { sectionStyle: 'card' }, practice: { columnFlow: 'balanced' } } };
    const next = resetReaderPreset(settings, 'live');
    expect(next.live).toBeUndefined();
    expect(next.practice.columnFlow).toBe('balanced');
  });
});

describe('context overrides are physical, not preferences', () => {
  it('drops the note margin on a narrow screen', () => {
    const settings = { readerConfig: { live: { notePosition: 'margin' } } };
    const narrow = resolveReaderConfig(settings, 'live', { wide: false, setlist: true });
    expect(narrow.notePosition).toBe('inline');
    // …but keeps it when there is room.
    expect(resolveReaderConfig(settings, 'live', wide).notePosition).toBe('margin');
  });

  it('moves a vertical ribbon to the top on a narrow screen', () => {
    const settings = { readerConfig: { live: { structurePosition: 'left' } } };
    expect(resolveReaderConfig(settings, 'live', { wide: false }).structurePosition).toBe('top');
    expect(resolveReaderConfig(settings, 'live', wide).structurePosition).toBe('left');
  });

  it('forces one column on a narrow screen', () => {
    const settings = { defaultColumns: 2 };
    expect(resolveReaderConfig(settings, 'live', { wide: false }).columns).toBe(1);
    expect(resolveReaderConfig(settings, 'live', wide).columns).toBe(2);
  });

  it('hands chrome to the hub when embedded', () => {
    const settings = { readerConfig: { rehearsal: { headerDensity: 'full', exitStyle: 'pull' } } };
    const c = resolveReaderConfig(settings, 'rehearsal', { wide: true, embedded: true });
    expect(c.headerDensity).toBe('min');
    expect(c.exitStyle).toBe('x');
    expect(c.showTools).toBe(false);
    expect(c.paged).toBe(false);
  });

  it('only pages for a setlist', () => {
    expect(resolveReaderConfig({}, 'live', { wide: true, setlist: true }).paged).toBe(true);
    expect(resolveReaderConfig({}, 'live', { wide: true, setlist: false }).paged).toBe(false);
  });
});

describe('every knob value round-trips', () => {
  it.each(Object.keys(READER_KNOBS))('accepts every documented value for %s', (knob) => {
    for (const value of READER_KNOBS[knob]) {
      const settings = { readerConfig: setReaderKnob({}, 'live', knob, value) };
      const cfg = resolveReaderConfig(settings, 'live', wide);
      // The context layer may legitimately rewrite a value; on a wide setlist
      // screen with no embedding, nothing should be rewritten.
      expect(cfg[knob]).toBe(value);
    }
  });
});

describe('display still flows through chartDisplay', () => {
  it('keeps stage-mode notation and type sizes', () => {
    const c = resolveReaderConfig({ notation: 'nashville', defaultFontSize: 'L' }, 'live', wide);
    expect(c.display.notation).toBe('nashville');
    expect(c.display.lyricFontSize).toBe(22);
  });
});
