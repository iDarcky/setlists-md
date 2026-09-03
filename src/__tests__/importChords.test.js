import { describe, it, expect } from 'vitest';
import { importChartText, isChordToken } from '@/lib/importChords';

describe('isChordToken', () => {
  it('accepts common chords', () => {
    ['C', 'Cm', 'C7', 'Cmaj7', 'Am7', 'F#m', 'Bb', 'G/B', 'Dsus4', 'Cadd9', 'N.C.']
      .forEach(c => expect(isChordToken(c)).toBe(true));
  });
  it('rejects lyric words', () => {
    ['Hello', 'the', 'world', 'Oh', 'Jesus', 'I'].forEach(w => expect(isChordToken(w)).toBe(false));
  });
});

describe('importChartText — Ultimate-Guitar style', () => {
  it('merges a chord line over a lyric line into inline chords', () => {
    const src = [
      '[Verse 1]',
      'G          C',
      'Amazing grace how sweet',
    ].join('\n');
    const { body } = importChartText(src);
    expect(body).toContain('## Verse 1');
    // chords land at their column above the lyric
    expect(body).toContain('[G]Amazing');
    expect(body).toContain('[C]');
    expect(body).toMatch(/\[G\]Amazing gra\[C\]ce/);
  });

  it('keeps an instrumental chord line as bracketed chords', () => {
    const { body } = importChartText('Intro:\nG  C  D');
    expect(body).toContain('## Intro');
    expect(body).toMatch(/\[G\].*\[C\].*\[D\]/);
  });
});

describe('importChartText — ChordPro', () => {
  it('converts directives and keeps inline chords', () => {
    const src = [
      '{title: Grace}',
      '{artist: John}',
      '{key: G}',
      '{comment: softly}',
      '{soc}',
      '[G]Amazing [C]grace',
      '{eoc}',
    ].join('\n');
    const { body, meta } = importChartText(src);
    expect(meta.title).toBe('Grace');
    expect(meta.artist).toBe('John');
    expect(meta.key).toBe('G');
    expect(body).toContain('> softly');
    expect(body).toContain('## Chorus');
    expect(body).toContain('[G]Amazing [C]grace');
  });

  it('wraps tab blocks', () => {
    const src = ['{sot}', 'e|--0--|', '{eot}'].join('\n');
    const { body } = importChartText(src);
    expect(body).toContain('{tab}');
    expect(body).toContain('e|--0--|');
    expect(body).toContain('{/tab}');
  });

  // Owner, 2026-08-06: *"I add a new section and select it as Pre-Chorus but
  // after I write something in it it goes automatically to verse."*
  // `ensureSections` invents `## Verse 1` for unlabelled text so a paste can
  // never vanish — and `ArrangeTabV2.commitLyricComposer` then rebuilt the
  // section from that invented heading, throwing away the type the user had
  // just picked. `inferred` is how a caller tells a guess from a marker.
  it('flags an invented heading as inferred, and a real one as not', () => {
    const guessed = importChartText('Lift it up now');
    expect(guessed.body).toContain('## Verse 1');
    expect(guessed.inferred).toBe(true);

    for (const marker of ['[Chorus]', 'Chorus:', '## Chorus']) {
      const real = importChartText(`${marker}\nLift it up now`);
      expect(real.body).toContain('## Chorus');
      expect(real.inferred).toBe(false);
    }
  });
});
