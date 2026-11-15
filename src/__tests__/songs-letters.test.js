import { describe, it, expect } from 'vitest';
import { lastPlayed, letterOf, groupByLetter } from '@/lib/songsData';

const now = new Date('2026-11-15T12:00:00').getTime();

describe('lastPlayed', () => {
  it('names the next setlist first', () => {
    expect(lastPlayed({ last: '2026-11-08' }, now, 'Sun 22')).toEqual({ text: 'On Sun 22', tone: 'next' });
  });
  it('words the gap', () => {
    expect(lastPlayed(null, now).text).toBe('Never played');
    expect(lastPlayed({ last: '2026-11-14' }, now).text).toBe('Yesterday');
    expect(lastPlayed({ last: '2026-11-08' }, now).text).toBe('Last week');
    expect(lastPlayed({ last: '2026-10-25' }, now).text).toBe('3 weeks ago');
    expect(lastPlayed({ last: '2026-05-20' }, now)).toEqual({ text: '6 months ago', tone: 'stale' });
    expect(lastPlayed({ last: '2024-01-01' }, now).text).toBe('Over a year ago');
  });
});

describe('letters', () => {
  it('folds diacritics and files the rest under #', () => {
    expect(letterOf('Îndurare')).toBe('I');
    expect(letterOf('Șapte')).toBe('S');
    expect(letterOf('10,000 Reasons')).toBe('#');
  });
  it('groups consecutive rows', () => {
    const rows = ['Apă vie', 'Ale Tale', 'Isus e Domn', 'Îndurare'].map(title => ({ song: { title } }));
    expect(groupByLetter(rows).map(g => [g.letter, g.rows.length])).toEqual([['A', 2], ['I', 2]]);
  });
});
