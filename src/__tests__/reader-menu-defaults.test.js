// The ☰'s defaults map, checked against the places that actually define them.
//
// `ReaderMenu` keeps a `MENU_DEFAULTS` table so the red **Reset** only appears
// when there is genuinely something to undo — picking the option that IS the
// default still writes the key, and comparing against `undefined` alone made a
// Reset appear for a change nobody had made.
//
// A second copy of a default is a second thing to keep in step, so this asserts
// every value that HAS a single source elsewhere. The ones with no source (the
// colours, `showDiagrams`) are "unset is the default" and need no entry.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolveReaderConfig } from '@/lib/readerConfig';
import { resolveChartDisplay } from '@/lib/chartDisplay';
import { DEFAULT_CHART_THEME_ID, DEFAULT_LYRIC_FONT_ID, DEFAULT_CHORD_FONT_ID } from '@/data/chartThemes';

// Read the table out of the source rather than exporting it: it is an
// implementation detail of the menu, and widening its API just to test it would
// invite something else to depend on it.
function menuDefaults() {
  const src = readFileSync('src/features/reader/ReaderMenu.jsx', 'utf8');
  const body = src.slice(src.indexOf('const MENU_DEFAULTS = {'));
  const table = body.slice(0, body.indexOf('\n};'));
  const out = {};
  for (const line of table.split('\n')) {
    const m = /^\s{2}(\w+):\s*(.+?),\s*(\/\/.*)?$/.exec(line);
    if (!m) continue;
    const [, key, raw] = m;
    out[key] = raw;
  }
  return out;
}

describe('the ☰ default table', () => {
  const table = menuDefaults();

  it('matches the reader knobs resolved from an empty settings object', () => {
    // These are `readerConfig`'s own DEFAULTS, reached the way the app reaches
    // them. If someone changes a knob's default there, this fails here.
    const cfg = resolveReaderConfig({}, { wide: true });
    expect(table.structurePosition).toBe("'top'");
    expect(cfg.ribbon).toBe('top');
    expect(table.readerHeading).toBe("'name'");
    expect(cfg.heading).toBe('name');
    expect(table.readerSectionStyle).toBe("'plain'");
    expect(cfg.sectionStyle).toBe('plain');
    expect(table.duplicateSections).toBe("'full'");
    expect(cfg.repeats).toBe('full');
    expect(table.readerNav).toBe("'footer'");
    expect(cfg.nav).toBe('footer');
    expect(table.readerFooter).toBe("'next'");
    expect(cfg.footer).toBe('next');
    expect(table.readerTopBar).toBe("'ribbon'");
    expect(cfg.topBar).toBe('ribbon');
    expect(table.readerFlow).toBe("'down'");
    expect(cfg.flow).toBe('down');
    // These two are booleans in the config and 'on' in the settings.
    expect(table.readerNotes).toBe("'on'");
    expect(cfg.notes).toBe(true);
    expect(table.readerInlineNotes).toBe("'on'");
    expect(cfg.inlineNotes).toBe(true);
    expect(table.readerRail).toBe("'on'");
    expect(cfg.rail).toBe(true);
    expect(table.readerSticky).toBe("'on'");
  });

  it('matches the chart display defaults', () => {
    const d = resolveChartDisplay({});
    expect(Number(table.defaultFontSize)).toBe(d.lyricFontSize);
    expect(Number(table.chordFontSize)).toBe(d.chordFontSize);
    expect(table.notation).toBe(`'${d.notation}'`);
  });

  it('matches the theme and font constants', () => {
    expect(table.chartTheme).toBe('DEFAULT_CHART_THEME_ID');
    expect(DEFAULT_CHART_THEME_ID).toBeTruthy();
    expect(table.chartLyricFont).toBe('DEFAULT_LYRIC_FONT_ID');
    expect(DEFAULT_LYRIC_FONT_ID).toBeTruthy();
    expect(table.chartChordFont).toBe('DEFAULT_CHORD_FONT_ID');
    expect(DEFAULT_CHORD_FONT_ID).toBeTruthy();
  });

  it('leaves out the settings whose default is simply "unset"', () => {
    // A colour with no override follows the theme, and `showDiagrams` is on
    // unless it is explicitly false. `settings?.x === undefined` answers both,
    // so an entry here would be a value that can never be compared against.
    for (const k of ['chartLyricColor', 'chartChordColor', 'tabStringColor',
      'tabNumberColor', 'tabBg', 'showDiagrams', 'defaultColumns']) {
      expect(table[k]).toBeUndefined();
    }
  });
});
