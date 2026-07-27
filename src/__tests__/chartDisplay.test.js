import { describe, it, expect } from 'vitest';
import { resolveChartDisplay, resolveColumns, FONT_SIZES } from '@/lib/chartDisplay';

// ─── resolveChartDisplay ──────────────────────────────────────────────────────

describe('resolveChartDisplay — leader defaults', () => {
  it('returns leader preset values when settings is null/undefined', () => {
    const r = resolveChartDisplay(null);
    expect(r.lyricFontSize).toBe(18);   // leader lyricFontSize
    expect(r.chordFontSize).toBe(17);   // leader chordFontSize
    expect(r.showChords).toBe(true);
    expect(r.nashville).toBe(false);
    expect(r.showDiagrams).toBe(false);
  });

  it('returns leader preset when stageMode is unset', () => {
    const r = resolveChartDisplay({});
    expect(r.showChords).toBe(true);
    expect(r.lyricFontSize).toBe(18);
  });
});

describe('resolveChartDisplay — stage mode presets', () => {
  it('vocalist: showChords=false and larger lyric size', () => {
    const r = resolveChartDisplay({ stageMode: 'vocalist' });
    expect(r.showChords).toBe(false);
    expect(r.lyricFontSize).toBe(22);
  });

  it('guitarist: showDiagrams=true', () => {
    const r = resolveChartDisplay({ stageMode: 'guitarist' });
    expect(r.showDiagrams).toBe(true);
  });

  it('drummer: showChords=false and smallest lyric size', () => {
    const r = resolveChartDisplay({ stageMode: 'drummer' });
    expect(r.showChords).toBe(false);
    expect(r.lyricFontSize).toBe(14);
  });
});

describe('resolveChartDisplay — explicit settings override stage preset', () => {
  it('named size string S/M/L is mapped to a pixel value', () => {
    expect(resolveChartDisplay({ defaultFontSize: 'S' }).lyricFontSize).toBe(FONT_SIZES.S);
    expect(resolveChartDisplay({ defaultFontSize: 'M' }).lyricFontSize).toBe(FONT_SIZES.M);
    expect(resolveChartDisplay({ defaultFontSize: 'L' }).lyricFontSize).toBe(FONT_SIZES.L);
  });

  it('numeric defaultFontSize is used as-is', () => {
    expect(resolveChartDisplay({ defaultFontSize: 20 }).lyricFontSize).toBe(20);
  });

  it('explicit showChords=false overrides a show-chords preset', () => {
    const r = resolveChartDisplay({ stageMode: 'leader', showChords: false });
    expect(r.showChords).toBe(false);
  });

  it('explicit showChords=true overrides a hide-chords preset', () => {
    const r = resolveChartDisplay({ stageMode: 'vocalist', showChords: true });
    expect(r.showChords).toBe(true);
  });

  it('explicit nashville=true overrides a non-nashville preset', () => {
    const r = resolveChartDisplay({ nashville: true });
    expect(r.nashville).toBe(true);
  });

  it('explicit showDiagrams=false overrides guitarist preset', () => {
    const r = resolveChartDisplay({ stageMode: 'guitarist', showDiagrams: false });
    expect(r.showDiagrams).toBe(false);
  });

  it('passes columns through without modification', () => {
    expect(resolveChartDisplay({ defaultColumns: 2 }).columns).toBe(2);
    expect(resolveChartDisplay({ defaultColumns: 'auto' }).columns).toBe('auto');
    expect(resolveChartDisplay({}).columns).toBeUndefined();
  });
});

describe('resolveChartDisplay — chordFontSize fallback chain', () => {
  it('uses the stage preset chordFontSize when none is specified in settings', () => {
    // leader preset has chordFontSize: 17
    const r = resolveChartDisplay({ defaultFontSize: 20 });
    expect(r.chordFontSize).toBe(17);
  });

  it('uses the explicit chordFontSize when supplied as a number', () => {
    const r = resolveChartDisplay({ chordFontSize: 15 });
    expect(r.chordFontSize).toBe(15);
  });

  it('explicit chordFontSize overrides the stage preset', () => {
    // guitarist preset has chordFontSize: 18, explicit setting should win
    const r = resolveChartDisplay({ stageMode: 'guitarist', chordFontSize: 12 });
    expect(r.chordFontSize).toBe(12);
  });
});

// ─── resolveColumns ───────────────────────────────────────────────────────────

describe('resolveColumns', () => {
  it('returns 1 when columns is explicitly 1', () => {
    expect(resolveColumns(1, true)).toBe(1);
    expect(resolveColumns(1, false)).toBe(1);
  });

  it('returns 2 when columns is explicitly 2', () => {
    expect(resolveColumns(2, true)).toBe(2);
    expect(resolveColumns(2, false)).toBe(2);
  });

  it('defers to wantTwo when columns is "auto"', () => {
    expect(resolveColumns('auto', true)).toBe(2);
    expect(resolveColumns('auto', false)).toBe(1);
  });

  it('defers to wantTwo when columns is undefined / null', () => {
    expect(resolveColumns(undefined, true)).toBe(2);
    expect(resolveColumns(null, false)).toBe(1);
  });
});
