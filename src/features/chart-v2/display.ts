// What the chart looks like, resolved once from settings. The keys are the
// ones the old chart's Aa menu writes, so a choice made in either carries over.
// Defaults are the new chart's (owner, 2026-11-17: lyrics 18, chords 15).

const NAMED: Record<string, number> = { S: 14, M: 18, L: 22 };
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : typeof v === 'string' ? NAMED[v] : undefined);

export type Notation = 'letters' | 'nashville' | 'roman' | 'solfege';

export interface ChartDisplay {
  lyricPx: number;
  chordPx: number;
  /** Empty = follow the theme. */
  lyricColor: string;
  chordColor: string;
  notation: Notation;
  accidentals: string;
  showChords: boolean;
  showCues: boolean;
  showInlineNotes: boolean;
}

export function resolveDisplay(s: Record<string, unknown> | null): ChartDisplay {
  const lyricPx = num(s?.defaultFontSize) ?? 18;
  const notation = (['letters', 'nashville', 'roman', 'solfege'] as const).find(n => n === s?.notation) ?? 'letters';
  return {
    lyricPx,
    chordPx: num(s?.chordFontSize) ?? Math.round((lyricPx * 15) / 18),
    lyricColor: typeof s?.chartLyricColor === 'string' ? s.chartLyricColor : '',
    chordColor: typeof s?.chartChordColor === 'string' ? s.chartChordColor : '',
    notation,
    accidentals: typeof s?.accidentals === 'string' ? s.accidentals : 'auto',
    showChords: s?.displayMode !== 'lyrics',
    showCues: s?.readerNotes !== 'off',
    showInlineNotes: s?.readerInlineNotes !== 'off',
  };
}
