import { describe, it, expect } from 'vitest';
import {
  buildChartFromItems,
  findChordFont,
  splitColumns,
  mergeChordRow,
  sectionNameFrom,
  orderTokenToSection,
} from '@/import/pdfLayout';
import { parseSongMd } from '@/parser';

// Coordinates below are lifted from a real two-column Romanian chart
// ("La Crucea Ta mă-ntorc"), so these tests exercise the exact geometry that
// broke earlier versions — not an idealised layout.
const LYR = 'g_d0_f1';   // lyric font
const HDR = 'g_d0_f2';   // heading font
const CH = 'g_d0_f3';    // chord font

const item = (str, x, y, w, h, font) => ({ str, x, y, w, h, font });

describe('findChordFont', () => {
  it('picks the font whose runs are overwhelmingly chord-shaped', () => {
    const items = [
      item('Bm7', 107, 697, 18, 10, CH), item('A/C#', 68, 666, 24, 10, CH),
      item('Dmaj7', 106, 666, 30, 10, CH), item('Em7', 99, 634, 18, 10, CH),
      item('La crucea T', 39, 682, 68, 13, LYR), item('a mă-ntorc', 107, 682, 62, 13, LYR),
      item('Din zile în care', 39, 651, 90, 13, LYR),
    ];
    expect(findChordFont(items)).toBe(CH);
  });

  it('is not fooled by lyrics that happen to look like chords', () => {
    // "A", "Am" and "E" are ordinary Romanian words.
    const items = [
      item('A', 39, 100, 6, 13, LYR), item('Am', 50, 100, 12, 13, LYR),
      item('E', 70, 100, 6, 13, LYR), item('venit', 80, 100, 30, 13, LYR),
      item('curand', 120, 100, 40, 13, LYR),
    ];
    expect(findChordFont(items)).toBe(null);
  });
});

describe('splitColumns', () => {
  // The regression: the right column starts at x=311.9. Splitting at the gap's
  // right edge (312) dropped it into the left column, interleaving both halves.
  it('splits at the gap midpoint, not its right edge', () => {
    const items = [
      item('Să mă zidești la loc.', 39, 463, 100, 13, LYR),
      item('La crucea Ta mă-ntorc', 311.9, 693, 129, 13, LYR),
    ];
    const [left, right] = splitColumns(items);
    expect(left.map(i => i.str)).toEqual(['Să mă zidești la loc.']);
    expect(right.map(i => i.str)).toEqual(['La crucea Ta mă-ntorc']);
  });

  it('leaves a single-column chart alone', () => {
    const items = [item('Amazing grace', 39, 700, 90, 13, LYR), item('how sweet', 39, 680, 70, 13, LYR)];
    expect(splitColumns(items)).toHaveLength(1);
  });
});

describe('mergeChordRow', () => {
  it('places each chord at the fragment boundary the generator used', () => {
    const chords = { items: [item('Bm7', 107.4, 697.9, 18, 10, CH)] };
    const lyric = {
      items: [item('La crucea T', 39, 682.2, 68, 13, LYR), item('a mă-ntorc', 107.4, 682.2, 62, 13, LYR)],
    };
    expect(mergeChordRow(chords, lyric)).toBe('La crucea T[Bm7]a mă-ntorc');
  });

  it('handles several chords on one line', () => {
    const chords = {
      items: [item('A/C#', 68.6, 666.4, 24, 10, CH), item('Dmaj7', 106.2, 666.4, 30, 10, CH)],
    };
    const lyric = {
      items: [
        item('Din z', 39, 651.4, 29, 13, LYR),
        item('ile în c', 68.6, 651.4, 37, 13, LYR),
        item('are n-am luptat deloc', 106.2, 651.4, 122, 13, LYR),
      ],
    };
    expect(mergeChordRow(chords, lyric)).toBe('Din z[A/C#]ile în c[Dmaj7]are n-am luptat deloc');
  });

  it('puts a chord left of the first fragment at the start of the line', () => {
    const chords = { items: [item('Bm7', 48.5, 274.2, 18, 10, CH)] };
    const lyric = { items: [item('uh mâhnit', 48.5, 259.2, 57, 13, LYR)] };
    expect(mergeChordRow(chords, lyric)).toBe('[Bm7]uh mâhnit');
  });

  it('keeps the whitespace runs that separate words', () => {
    // Dropping whitespace items welds words together ("tevoi" for "te voi").
    const chords = { items: [item('G#m', 393.6, 354.4, 18, 10, CH)] };
    const lyric = {
      items: [
        item('Doamne eu te', 311.9, 339.4, 81, 13, LYR),
        item(' ', 393.5, 339.4, 3, 0, LYR),
        item('voi v', 397.2, 339.4, 26, 13, LYR),
      ],
    };
    expect(mergeChordRow(chords, lyric)).toBe('Doamne eu te [G#m]voi v');
  });
});

describe('section names', () => {
  it('maps the Romanian vocabulary', () => {
    expect(sectionNameFrom('STROFA 1')).toBe('Verse 1');
    expect(sectionNameFrom('STROFA 2')).toBe('Verse 2');
    expect(sectionNameFrom('PRE-REFREN')).toBe('Pre-Chorus');
    expect(sectionNameFrom('REFREN')).toBe('Chorus');
    expect(sectionNameFrom('PUNTE')).toBe('Bridge');
    expect(sectionNameFrom('ÎNCHEIERE')).toBe('Outro');
  });

  it('still maps English headings', () => {
    expect(sectionNameFrom('Verse 2')).toBe('Verse 2');
    expect(sectionNameFrom('CHORUS')).toBe('Chorus');
    expect(sectionNameFrom('Bridge')).toBe('Bridge');
  });

  it('rejects ordinary lyric lines', () => {
    expect(sectionNameFrom('La crucea Ta mă-ntorc')).toBe(null);
    expect(sectionNameFrom('')).toBe(null);
  });

  it('reads the play-order shorthand', () => {
    expect(['S1', 'R', 'S2', 'R', 'B', 'R'].map(orderTokenToSection))
      .toEqual(['Verse 1', 'Chorus', 'Verse 2', 'Chorus', 'Bridge', 'Chorus']);
    expect(orderTokenToSection('Gmaj7')).toBe(null);
  });
});

describe('buildChartFromItems', () => {
  // A miniature of the real chart: header band across both columns, verse and
  // chorus on the left, verse 2 on the right.
  const chart = [
    // ── left column header
    item('La Crucea Ta mă-ntorc', 39, 783.4, 271.9, 26, HDR),
    item('Muzica de', 39, 746.7, 41, 9, LYR),
    item(' ', 80, 746.7, 3.3, 0, LYR),
    item('Oni Rodilă', 82.5, 746.7, 45, 9, HDR),
    item(' · Versuri de ', 127.5, 746.7, 48, 9, LYR),
    item('Alina M. Paneșiu', 178.1, 746.7, 71.5, 9, HDR),
    // ── right column header: key + play order
    item('D', 333.3, 788.7, 11.6, 16, HDR),
    item('S1', 427.6, 793.9, 13.2, 11, CH),
    item('R', 454.8, 793.9, 6.6, 11, CH),
    item('S2', 475.4, 793.9, 13.2, 11, CH),
    item('R', 502.7, 793.9, 6.6, 11, CH),
    item('B', 523.3, 793.9, 6.6, 11, CH),
    item('R', 543.9, 793.9, 6.6, 11, CH),
    // ── left column body
    item('STROFA 1', 39, 712.9, 50, 9, HDR),
    item('Bm7', 107.4, 697.9, 18.3, 10.1, CH),
    item('La crucea T', 39, 682.2, 68.4, 13, LYR),
    item('a mă-ntorc', 107.4, 682.2, 62.1, 13, LYR),
    item('REFREN', 39, 319.2, 41.5, 9, HDR),
    item('Gmaj7', 104.8, 303.4, 30.5, 10.1, CH),
    item('Îți mulțum', 48.5, 287.7, 56.3, 13, LYR),
    item('esc că nu disp', 104.8, 287.7, 83.1, 13, LYR),
    item('Compusă în 2017', 39, 62.7, 63.1, 8, LYR),
    // ── right column body
    item('STROFA 2', 311.9, 712.9, 50, 9, HDR),
    item('La crucea Ta mă-ntorc', 311.9, 693.4, 129.1, 13, LYR),
    item('Altarul gol din suflet mă condamnă', 311.9, 673.2, 199.4, 13, LYR),
  ];

  it('extracts the metadata out of the header band', () => {
    const { meta } = buildChartFromItems(chart);
    expect(meta.title).toBe('La Crucea Ta mă-ntorc');
    expect(meta.key).toBe('D');
    // "Muzica de" is the composer, not the performing artist — see credits below.
    expect(meta.artist).toBeUndefined();
    expect(meta.writers).toBe('Oni Rodilă, Alina M. Paneșiu');
    expect(meta.year).toBe('2017');
    expect(meta.structure).toEqual(['Verse 1', 'Chorus', 'Verse 2', 'Chorus', 'Bridge', 'Chorus']);
  });

  it('reads columns in order instead of interleaving them', () => {
    const { md } = buildChartFromItems(chart);
    const sections = [...md.matchAll(/^## (.+)$/gm)].map(m => m[1]);
    expect(sections).toEqual(['Verse 1', 'Chorus', 'Verse 2']);
    // Verse 2's first line must not be welded onto a Verse 1 line.
    expect(md).toContain('La crucea T[Bm7]a mă-ntorc\n');
    expect(md).toContain('La crucea Ta mă-ntorc\nAltarul gol');
  });

  it('produces markdown our own parser round-trips', () => {
    const { md } = buildChartFromItems(chart);
    const song = parseSongMd(md);
    expect(song.title).toBe('La Crucea Ta mă-ntorc');
    expect(song.key).toBe('D');
    expect(song.sections.map(s => s.type)).toEqual(['Verse 1', 'Chorus', 'Verse 2']);
    // The chord landed mid-word, exactly where the PDF put it.
    expect(song.sections[0].lines[0]).toContain('[Bm7]');
  });

  it('keeps the page footer out of the lyrics', () => {
    const { md } = buildChartFromItems(chart);
    expect(md).not.toContain('Compusă în 2017');
  });

  it('warns instead of throwing when there is no chord font', () => {
    const plain = [
      item('Amazing grace', 39, 700, 90, 13, LYR),
      item('how sweet the sound', 39, 680, 120, 13, LYR),
    ];
    const { md, warnings } = buildChartFromItems(plain);
    expect(warnings.join(' ')).toMatch(/chord font/i);
    expect(md).toContain('## Verse 1'); // still a parseable song
  });
});

describe('mergeChordRow — generators that do NOT split the lyric', () => {
  // A Word/monospace export puts the whole lyric in one run and positions the
  // chords above it. There is no fragment boundary to land on, so the offset is
  // estimated from average character width.
  it('estimates the offset inside a single unsplit run', () => {
    const lyric = { items: [item('Amazing grace how sweet the sound', 100, 500, 198, 13, LYR)] };
    // 198pt / 33 chars = 6pt per char. "grace" starts at char 8 → x = 148.
    const chords = { items: [item('C', 148, 515, 6, 10, CH)] };
    expect(mergeChordRow(chords, lyric)).toBe('Amazing [C]grace how sweet the sound');
  });

  it('keeps several estimated chords in order', () => {
    const lyric = { items: [item('Amazing grace how sweet the sound', 100, 500, 198, 13, LYR)] };
    const chords = {
      items: [item('G', 100, 515, 6, 10, CH), item('C', 148, 515, 6, 10, CH), item('D', 208, 515, 6, 10, CH)],
    };
    expect(mergeChordRow(chords, lyric)).toBe('[G]Amazing [C]grace how [D]sweet the sound');
  });

  it('puts a chord past the end of the lyric at the end of the line', () => {
    const lyric = { items: [item('Amen', 100, 500, 24, 13, LYR)] };
    const chords = { items: [item('G', 400, 515, 6, 10, CH)] };
    expect(mergeChordRow(chords, lyric)).toBe('Amen[G]');
  });

  it('still prefers an exact boundary when the generator provides one', () => {
    // Both a boundary AND an overlapping fragment exist; the boundary wins.
    const chords = { items: [item('Bm7', 107.4, 697.9, 18, 10, CH)] };
    const lyric = {
      items: [item('La crucea T', 39, 682.2, 68.4, 13, LYR), item('a mă-ntorc', 107.4, 682.2, 62, 13, LYR)],
    };
    expect(mergeChordRow(chords, lyric)).toBe('La crucea T[Bm7]a mă-ntorc');
  });
});

describe('credits', () => {
  it('reads composer and lyricist as writers, not as the artist', () => {
    const chart = [
      item('Cântarea', 39, 783, 200, 26, HDR),
      item('Muzica de', 39, 746, 41, 9, LYR),
      item(' ', 80, 746, 3.3, 0, LYR),
      item('Oni Rodilă', 82.5, 746, 45, 9, HDR),
      item(' · Versuri de ', 127.5, 746, 48, 9, LYR),
      item('Alina M. Paneșiu', 178.1, 746, 71.5, 9, HDR),
      item('STROFA 1', 39, 712, 50, 9, HDR),
      item('O linie de versuri', 39, 690, 100, 13, LYR),
    ];
    const { meta } = buildChartFromItems(chart);
    expect(meta.writers).toBe('Oni Rodilă, Alina M. Paneșiu');
    expect(meta.artist).toBeUndefined();
  });
});
