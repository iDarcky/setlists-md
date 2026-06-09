// Instrument string layouts (high → low) for the tab editor / tab mode.
// Tunings are limited to note labels in [e B G D A E] so tabs round-trip
// through the parser (parseTabBlock matches `^[eBGDAE]\|`).
const GUITAR_TUNINGS = [
  { id: 'standard', label: 'Standard', strings: ['e', 'B', 'G', 'D', 'A', 'E'] },
  { id: 'dropd', label: 'Drop D', strings: ['e', 'B', 'G', 'D', 'A', 'D'] },
  { id: 'dadgad', label: 'DADGAD', strings: ['D', 'A', 'G', 'D', 'A', 'D'] },
  { id: 'openg', label: 'Open G', strings: ['D', 'B', 'G', 'D', 'G', 'D'] },
];

export const TAB_INSTRUMENTS = {
  electric: { label: 'Electric', strings: ['e', 'B', 'G', 'D', 'A', 'E'], tunings: GUITAR_TUNINGS },
  acoustic: { label: 'Acoustic', strings: ['e', 'B', 'G', 'D', 'A', 'E'], tunings: GUITAR_TUNINGS },
  bass: {
    label: 'Bass',
    strings: ['G', 'D', 'A', 'E'],
    tunings: [
      { id: 'standard', label: 'Standard', strings: ['G', 'D', 'A', 'E'] },
      { id: 'dropd', label: 'Drop D', strings: ['G', 'D', 'A', 'D'] },
    ],
  },
  bass5: {
    label: 'Bass 5',
    strings: ['G', 'D', 'A', 'E', 'B'],
    tunings: [{ id: 'standard', label: 'Standard', strings: ['G', 'D', 'A', 'E', 'B'] }],
  },
};
