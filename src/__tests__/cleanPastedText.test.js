import { describe, it, expect } from 'vitest';
import { cleanPastedText, rejoinSplitWords } from '../lib/cleanPastedText';
import { importChartText } from '../lib/importChords';

// The characters this module exists to remove are invisible, so they're written
// as escapes here — a literal ZWSP in a test file is unreviewable.
const ZWSP = '\u200B';  // zero-width space
const ZWNJ = '\u200C';  // zero-width non-joiner
const BOM  = '\uFEFF';  // byte-order mark, common in Windows copy
const SHY  = '\u00AD';  // soft hyphen
const NBSP = '\u00A0';  // non-breaking space
const IDEO = '\u3000';  // ideographic space

describe('cleanPastedText', () => {
  it('strips the zero-width characters a CMS leaves mid-word', () => {
    expect(cleanPastedText(`La cru${ZWSP}cea Ta`)).toBe('La crucea Ta');
    expect(cleanPastedText(`cuv${BOM}${ZWNJ}ânt`)).toBe('cuvânt');
  });

  it('strips soft hyphens from justified text', () => {
    expect(cleanPastedText(`mân${SHY}tu${SHY}ire`)).toBe('mântuire');
  });

  it('turns non-breaking and exotic spaces into ordinary ones', () => {
    expect(cleanPastedText(`La crucea${NBSP}Ta${IDEO}mă-ntorc`)).toBe('La crucea Ta mă-ntorc');
  });

  it('keeps leading spaces — they position the chords', () => {
    const src = '    G       C\nAmazing grace';
    expect(cleanPastedText(src)).toBe(src);
  });

  it('drops trailing whitespace', () => {
    expect(cleanPastedText('Amazing grace   \nhow sweet\t')).toBe('Amazing grace\nhow sweet');
  });

  it('leaves every diacritic alone', () => {
    const ro = 'Îți mulțumesc că nu disprețuiești un duh mâhnit';
    expect(cleanPastedText(ro)).toBe(ro);
  });

  it('rejoins a word broken by a hyphenated line wrap', () => {
    expect(cleanPastedText('mântu-\nirea Ta')).toBe('mântuirea Ta');
  });

  it('does NOT rejoin across a line starting with a capital', () => {
    // A line ending in a dash before a new sentence must stay split.
    expect(cleanPastedText('Vino la mine-\nDoamne')).toBe('Vino la mine-\nDoamne');
  });

  it('does NOT weld a chord line onto the lyric under it', () => {
    const src = 'G       C\nAmazing grace';
    expect(cleanPastedText(src)).toBe(src);
  });

  it('collapses padding runs but keeps single blank lines', () => {
    expect(cleanPastedText('Verse 1\n\n\n\nChorus')).toBe('Verse 1\n\nChorus');
  });

  it('normalises smart punctuation', () => {
    expect(cleanPastedText('“Vino” — n’am')).toBe('"Vino" - n\'am');
  });

  it('is safe on empty input', () => {
    expect(cleanPastedText('')).toBe('');
    expect(cleanPastedText(null)).toBe('');
  });
});

describe('cleanPastedText → importChartText', () => {
  it('leaves an NBSP chord row working — \\s already matched it', () => {
    // Worth pinning: NBSP between chords was never the bug, because JS \s
    // matches U+00A0. Cleaning normalises it anyway, and must not regress it.
    const dirty = `G${NBSP}${NBSP}${NBSP}${NBSP}${NBSP}${NBSP}${NBSP}C\nAmazing grace how sweet`;
    const cleanBody = importChartText(cleanPastedText(dirty)).body;
    expect(cleanBody).toContain('[G]');
    expect(cleanBody).toContain('[C]');
  });

  it('rescues a chord row broken by zero-width characters', () => {
    // The real rescue: a ZWSP inside a chord token makes isChordToken false,
    // so the whole row would be misread as a lyric line. importChartText now
    // cleans on the way in, so passing the dirty text straight in is enough.
    const dirty = `G${ZWSP}       C\nAmazing grace how sweet`;
    expect(importChartText(dirty).body).toContain('[G]');

    // And the cleaner is what does it — without it the row is not chords.
    expect(cleanPastedText(dirty)).toBe('G       C\nAmazing grace how sweet');
  });

  it('keeps a Romanian chart parseable end to end', () => {
    const dirty = `La crucea T${ZWSP}a mă-ntorc\nDin zile în ca-\nre n-am luptat`;
    const body = importChartText(cleanPastedText(dirty)).body;
    expect(body).toContain('La crucea Ta mă-ntorc');
    expect(body).toContain('Din zile în care n-am luptat');
  });
});

describe('rejoinSplitWords', () => {
  it('joins a split word when the intact form appears elsewhere', () => {
    // The chorus repeats, so "mulțumesc" is present intact — that's the proof.
    const src = 'Îți mulțumesc mereu\nalt vers aici\nÎți mul țumesc mereu';
    const { text, joins } = rejoinSplitWords(src);
    expect(text).toContain('Îți mulțumesc mereu\nalt vers aici\nÎți mulțumesc mereu');
    expect(joins).toEqual([{ from: 'mul țumesc', to: 'mulțumesc' }]);
  });

  it('refuses to join two real words', () => {
    // "la" and "crucea" are both words in the text; "lacrucea" is not.
    const src = 'la crucea Ta\nla crucea Ta';
    expect(rejoinSplitWords(src).text).toBe(src);
  });

  it('leaves a split it cannot prove', () => {
    // Nothing else in the text vouches for "cuvant", so it stays as pasted.
    const src = 'cuv ant nou';
    expect(rejoinSplitWords(src).text).toBe(src);
  });

  it('never joins across a capital', () => {
    const src = 'vino Doamne\nvinoDoamne';
    expect(rejoinSplitWords(src).text).toBe(src);
  });

  it('leaves chord-chart alignment alone', () => {
    const src = 'G       C\nAmazing grace';
    expect(rejoinSplitWords(src).text).toBe(src);
  });

  it('is safe on empty input', () => {
    expect(rejoinSplitWords('').text).toBe('');
    expect(rejoinSplitWords(null).joins).toEqual([]);
  });
});

describe('rejoinSplitWords — harder cases', () => {
  it('joins a word split into three fragments', () => {
    // Needs two passes: "mul"+"țu" only becomes visible as "mulțu"+"mesc"
    // once the first join exists.
    const src = 'Îți mulțumesc mereu\naltceva\nÎți mul țu mesc mereu';
    expect(rejoinSplitWords(src).text).toContain('Îți mulțumesc mereu\naltceva\nÎți mulțumesc mereu');
  });

  it('uses vocabulary the caller supplies when the song cannot prove it', () => {
    // "mulțumesc" appears nowhere intact here, so the song alone can't help.
    const src = 'Îți mul țumesc';
    expect(rejoinSplitWords(src).text).toBe(src);
    expect(rejoinSplitWords(src, ['mulțumesc']).text).toBe('Îți mulțumesc');
  });

  it('still refuses joins nothing vouches for', () => {
    expect(rejoinSplitWords('cuv ant nou', ['altceva']).text).toBe('cuv ant nou');
  });
});
