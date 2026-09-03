import { describe, it, expect } from 'vitest';
import {
  isChordToken,
  isChordLine,
  detectSectionHeader,
  parseChordLine,
  mergeChordAndLyric,
  chordLineOnly,
  detectFormat,
  convertChordPro,
  convertUltimateGuitar,
  convertPlain,
  convertOpenSong,
  smartImport,
} from '@/importer';
import { parseSongMd } from '@/parser';

describe('isChordToken', () => {
  it('accepts common major / minor / 7 shapes', () => {
    for (const c of ['C', 'G', 'Am', 'Dm', 'C7', 'Dm7', 'Gmaj7', 'Csus4', 'Cadd9', 'Bdim', 'F#m']) {
      expect(isChordToken(c)).toBe(true);
    }
  });

  it('accepts flats and slash chords', () => {
    expect(isChordToken('Bb')).toBe(true);
    expect(isChordToken('Eb')).toBe(true);
    expect(isChordToken('D/F#')).toBe(true);
    expect(isChordToken('C/E')).toBe(true);
  });

  it('rejects lowercase lyric words', () => {
    expect(isChordToken('the')).toBe(false);
    expect(isChordToken('amazing')).toBe(false);
  });
});

describe('isChordLine', () => {
  it('detects standard chord lines', () => {
    expect(isChordLine('G        D         Em      C')).toBe(true);
    expect(isChordLine('    Am    F    C    G')).toBe(true);
  });

  it('rejects lyric lines', () => {
    expect(isChordLine('Amazing grace, how sweet the sound')).toBe(false);
    expect(isChordLine('How great is our God')).toBe(false);
  });

  it('rejects empty / whitespace lines', () => {
    expect(isChordLine('')).toBe(false);
    expect(isChordLine('   ')).toBe(false);
  });

  it('handles single-token chord lines like "| G |"', () => {
    expect(isChordLine('| G |')).toBe(true);
    expect(isChordLine('G')).toBe(true);
  });

  it('rejects mostly-words lines that contain one chord-like token', () => {
    expect(isChordLine('A baby is born today')).toBe(false);
  });
});

describe('detectSectionHeader', () => {
  it('recognises bracketed headers', () => {
    expect(detectSectionHeader('[Verse 1]')).toBe('Verse 1');
    expect(detectSectionHeader('[Chorus]')).toBe('Chorus');
    expect(detectSectionHeader('(Bridge)')).toBe('Bridge');
  });

  it('recognises colon-terminated headers', () => {
    expect(detectSectionHeader('VERSE 1:')).toBe('Verse 1');
    expect(detectSectionHeader('Chorus:')).toBe('Chorus');
    expect(detectSectionHeader('Pre-Chorus:')).toBe('Pre Chorus');
  });

  it('recognises bare short headers', () => {
    expect(detectSectionHeader('CHORUS')).toBe('Chorus');
    expect(detectSectionHeader('Verse 2')).toBe('Verse 2');
  });

  it('ignores regular lyric lines', () => {
    expect(detectSectionHeader('Amazing grace how sweet the sound')).toBe(null);
    expect(detectSectionHeader('How great thou art')).toBe(null);
  });

  it('normalises Pre-Chorus hyphenated variants', () => {
    expect(detectSectionHeader('[Pre-Chorus]')).toBe('Pre Chorus');
    expect(detectSectionHeader('PRE-CHORUS 1:')).toBe('Pre Chorus 1');
  });
});

describe('parseChordLine & merging', () => {
  it('extracts chords with their columns', () => {
    const chords = parseChordLine('G        D');
    expect(chords).toEqual([
      { chord: 'G', col: 0 },
      { chord: 'D', col: 9 },
    ]);
  });

  it('merges a chord line with a lyric line by column', () => {
    // "Amazing" is 7 chars; col 8 is the 'g' of "grace"
    const chord = 'G       D';
    const lyric = 'Amazing grace';
    const merged = mergeChordAndLyric(chord, lyric);
    expect(merged).toBe('[G]Amazing [D]grace');
  });

  it('pads short lyrics so trailing chords still emit', () => {
    const merged = mergeChordAndLyric('G     D     Em    C', 'short');
    expect(merged.startsWith('[G]short')).toBe(true);
    expect(merged).toContain('[D]');
    expect(merged).toContain('[Em]');
    expect(merged).toContain('[C]');
  });

  it('returns a chord-only line when there is no lyric pairing', () => {
    // Preserves column spacing so timing hints are kept for instrumental passages
    expect(chordLineOnly('G    D    Em')).toBe('[G]    [D]    [Em]');
  });
});

describe('detectFormat', () => {
  it('detects ChordPro by directives', () => {
    expect(detectFormat('{title: Foo}\n{start_of_verse}\n[C]bar')).toBe('chordpro');
  });

  it('detects ultimate-guitar by chord/lyric pairs', () => {
    const ug = `G       D          Em        C
Amazing grace, how sweet the sound
G       D
That saved a wretch`;
    expect(detectFormat(ug)).toBe('ultimate-guitar');
  });

  it('detects inline bracketed chords as chordpro-lite', () => {
    const cp = '[G]Amazing [D]grace how [Em]sweet the [C]sound\n[G]That saved a [D]wretch';
    expect(detectFormat(cp)).toBe('chordpro');
  });

  it('falls back to plain for bare lyrics', () => {
    expect(detectFormat('Amazing grace how sweet the sound\nThat saved a wretch like me')).toBe('plain');
  });

  it('treats empty input as plain', () => {
    expect(detectFormat('')).toBe('plain');
    expect(detectFormat('   ')).toBe('plain');
  });
});

describe('convertChordPro', () => {
  it('parses directives into frontmatter and sections', () => {
    const src = `{title: Amazing Grace}
{artist: Traditional}
{key: G}
{start_of_verse}
[G]Amazing [D]grace how [G]sweet the sound
{end_of_verse}
{start_of_chorus}
[C]How great [G]is our God
{end_of_chorus}`;
    const md = convertChordPro(src);
    expect(md).toContain('title: Amazing Grace');
    expect(md).toContain('artist: Traditional');
    expect(md).toContain('key: G');
    expect(md).toContain('## Verse 1');
    expect(md).toContain('## Chorus');
    expect(md).toContain('[G]Amazing [D]grace');
  });

  it('converts {comment: ...} into band cues', () => {
    const src = '{title: T}\n{start_of_verse}\n{c: gently}\n[C]test\n{end_of_verse}';
    const md = convertChordPro(src);
    expect(md).toContain('> gently');
  });

  it('yields a parseable result via parseSongMd', () => {
    const src = `{title: X}
{artist: Y}
{key: C}
{start_of_verse}
[C]Hello [G]world
{end_of_verse}`;
    const song = parseSongMd(convertChordPro(src));
    expect(song.title).toBe('X');
    expect(song.artist).toBe('Y');
    expect(song.key).toBe('C');
    expect(song.sections).toHaveLength(1);
    expect(song.sections[0].type).toBe('Verse 1');
  });
});

describe('convertUltimateGuitar', () => {
  it('merges chord lines with following lyric lines', () => {
    const src = `Amazing Grace - Traditional

[Verse 1]
G       D          Em        C
Amazing grace, how sweet the sound
G       D         G
That saved a wretch like me

[Chorus]
C   G
How great thou art`;
    const md = convertUltimateGuitar(src);
    expect(md).toContain('title: Amazing Grace');
    expect(md).toContain('artist: Traditional');
    expect(md).toContain('## Verse 1');
    expect(md).toContain('## Chorus');
    expect(md).toContain('[G]Amazing [D]grace');
    expect(md).toContain('[C]How ');
  });

  it('seeds a default Verse when no section header is present', () => {
    const src = `G       D
Amazing grace`;
    const md = convertUltimateGuitar(src);
    expect(md).toContain('## Verse 1');
    expect(md).toContain('[G]Amazing [D]grace');
  });

  it('handles chord-only instrumental passages', () => {
    const src = `[Intro]
G    D    Em    C`;
    const md = convertUltimateGuitar(src);
    expect(md).toContain('## Intro');
    expect(md).toContain('[G]');
    expect(md).toContain('[D]');
    expect(md).toContain('[Em]');
    expect(md).toContain('[C]');
  });

  it('produces a result that round-trips through parseSongMd', () => {
    const src = `Song - Artist

[Verse 1]
G        D
Amazing grace`;
    const md = convertUltimateGuitar(src);
    const song = parseSongMd(md);
    expect(song.title).toBe('Song');
    expect(song.artist).toBe('Artist');
    expect(song.sections[0].type).toBe('Verse 1');
  });
});

describe('convertPlain', () => {
  it('places all lyrics under a single default Verse', () => {
    const src = `Just some lyrics
with no chords at all`;
    const md = convertPlain(src);
    // First non-empty line becomes the title; remaining text becomes body.
    expect(md).toContain('title: Just some lyrics');
    expect(md).toContain('## Verse 1');
    expect(md).toContain('with no chords at all');
  });

  it('respects explicit section headers', () => {
    const src = `Song Title

[Verse 1]
Just the lyrics

[Chorus]
Hook line`;
    const md = convertPlain(src);
    expect(md).toContain('## Verse 1');
    expect(md).toContain('## Chorus');
  });
});

describe('detectFormat — OpenSong', () => {
  it('detects an OpenSong XML body', () => {
    const xml = `<?xml version="1.0"?>
<song>
  <title>Test</title>
  <lyrics>[V1]
.G    D
 hello world
</lyrics>
</song>`;
    expect(detectFormat(xml)).toBe('opensong');
  });
});

describe('convertOpenSong', () => {
  it('extracts metadata + chord/lyric pairs', () => {
    const xml = `<?xml version="1.0"?>
<song>
  <title>Amazing Grace</title>
  <author>John Newton</author>
  <key>G</key>
  <tempo>72</tempo>
  <time_sig>3/4</time_sig>
  <ccli>22025</ccli>
  <lyrics>[V1]
.G          D          Em        C
 Amazing grace, how sweet the sound
.G       D         G
 That saved a wretch like me

[C]
.C         G
 My chains are gone
</lyrics>
</song>`;
    const md = convertOpenSong(xml);
    const song = parseSongMd(md);
    expect(song.title).toBe('Amazing Grace');
    expect(song.artist).toBe('John Newton');
    expect(song.key).toBe('G');
    expect(song.tempo).toBe(72);
    expect(song.time).toBe('3/4');
    expect(song.ccli).toBe('22025');
    const labels = song.sections.map(s => s.label || s.type);
    expect(labels).toContain('Verse 1');
    expect(labels).toContain('Chorus 1');
    // Inline chords made it through.
    expect(md).toMatch(/\[G\]/);
    expect(md).toMatch(/\[D\]/);
  });

  it('maps section letter codes', () => {
    const xml = `<song><title>T</title><lyrics>[B 2]
 bridge line
[T]
 tag line
[I]
 intro line
</lyrics></song>`;
    const md = convertOpenSong(xml);
    expect(md).toMatch(/## Bridge/);
    expect(md).toMatch(/## Tag/);
    expect(md).toMatch(/## Intro/);
  });

  it('preserves comments as band cues', () => {
    const xml = `<song><title>T</title><lyrics>[V1]
;Soft, slow build
 the lyric line
</lyrics></song>`;
    const md = convertOpenSong(xml);
    expect(md).toMatch(/> Soft, slow build/);
  });

  it('throws on malformed XML', () => {
    expect(() => convertOpenSong('<song><lyrics>oops')).toThrow();
  });
});

describe('smartImport', () => {
  it('dispatches to the detected converter', () => {
    const { format, md } = smartImport('{title: T}\n[C]hello');
    expect(format).toBe('chordpro');
    expect(md).toContain('title: T');
  });

  it('honours a format override', () => {
    const plain = 'just text here';
    const { format } = smartImport(plain, 'ultimate-guitar');
    expect(format).toBe('ultimate-guitar');
  });

  it('yields parseable md for all three formats', () => {
    const samples = [
      '{title: A}\n{start_of_verse}\n[C]hi\n{end_of_verse}',
      'G   D\nlyrics here',
      'just lyrics no chords',
    ];
    for (const src of samples) {
      const { md } = smartImport(src);
      const song = parseSongMd(md);
      expect(song.title).toBeTruthy();
      expect(Array.isArray(song.sections)).toBe(true);
    }
  });
});
