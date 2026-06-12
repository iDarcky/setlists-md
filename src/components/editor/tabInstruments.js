// Instrument string layouts (high → low) for the tab editor / tab mode.
// Tunings/labels stay within [e B G D A E] so tabs round-trip through the
// parser (parseTabBlock matches `^[eBGDAE]\|`).
const GUITAR_TUNINGS = [
  { id: 'standard', label: 'Standard', strings: ['e', 'B', 'G', 'D', 'A', 'E'] },
  { id: 'dropd', label: 'Drop D', strings: ['e', 'B', 'G', 'D', 'A', 'D'] },
  { id: 'dadgad', label: 'DADGAD', strings: ['D', 'A', 'G', 'D', 'A', 'D'] },
  { id: 'openg', label: 'Open G', strings: ['D', 'B', 'G', 'D', 'G', 'D'] },
];
const BASS_TUNINGS = [
  { id: 'standard', label: 'Standard', strings: ['G', 'D', 'A', 'E'] },
  { id: 'dropd', label: 'Drop D', strings: ['G', 'D', 'A', 'D'] },
];

export const TAB_INSTRUMENTS = {
  electric: { label: 'Electric', strings: ['e', 'B', 'G', 'D', 'A', 'E'], counts: [6, 7], tunings: GUITAR_TUNINGS },
  acoustic: { label: 'Acoustic', strings: ['e', 'B', 'G', 'D', 'A', 'E'], counts: [6, 7], tunings: GUITAR_TUNINGS },
  bass: { label: 'Bass', strings: ['G', 'D', 'A', 'E'], counts: [4, 5], tunings: BASS_TUNINGS },
};

// Standard string layout for an instrument + string count.
export function stringsForCount(instrumentId, count) {
  if (instrumentId === 'bass') return count === 5 ? ['G', 'D', 'A', 'E', 'B'] : ['G', 'D', 'A', 'E'];
  return count === 7 ? ['e', 'B', 'G', 'D', 'A', 'E', 'B'] : ['e', 'B', 'G', 'D', 'A', 'E'];
}

// Best-guess instrument id from a tab's string count (display only).
export function instrumentForStrings(n) {
  return (n || 6) <= 5 ? 'bass' : 'electric';
}
