// Stage modes — named presets that apply a batch of layout settings in
// one tap. Each mode targets a band role; the user picks one and the
// chart instantly switches to a layout tuned for that instrument /
// voice. Settings are written through normally so the user can still
// fine-tune size or toggle anything afterwards.

export const STAGE_MODES = [
  {
    id: 'leader',
    name: 'Leader',
    description: 'The all-rounder — chords, lyrics, structure.',
    settings: {
      showChords: true,
      showInlineNotes: true,
      lyricFontSize: 18,
      chordFontSize: 17,
      nashville: false,
      notation: 'letters',
      showDiagrams: false,
    },
  },
  {
    id: 'vocalist',
    name: 'Vocalist',
    description: 'Big lyrics, no chord clutter.',
    settings: {
      showChords: false,
      showInlineNotes: true,
      lyricFontSize: 22,
      chordFontSize: 17,
      nashville: false,
      notation: 'letters',
      showDiagrams: false,
    },
  },
  {
    id: 'guitarist',
    name: 'Guitarist',
    description: 'Chord diagrams + lyrics.',
    settings: {
      showChords: true,
      showInlineNotes: true,
      lyricFontSize: 18,
      chordFontSize: 18,
      nashville: false,
      notation: 'letters',
      showDiagrams: true,
    },
  },
  {
    id: 'bassist',
    name: 'Bassist',
    description: 'Slimmer lyrics, chord-forward.',
    settings: {
      showChords: true,
      showInlineNotes: false,
      lyricFontSize: 16,
      chordFontSize: 19,
      nashville: false,
      notation: 'letters',
      showDiagrams: false,
    },
  },
  {
    id: 'keys',
    name: 'Keys',
    description: 'Chord-forward with numbers for quick transposing.',
    settings: {
      showChords: true,
      showInlineNotes: false,
      lyricFontSize: 16,
      chordFontSize: 19,
      nashville: true,
      notation: 'nashville',
      showDiagrams: false,
    },
  },
  {
    id: 'drummer',
    name: 'Drummer',
    description: 'Structure-first, minimal lyrics.',
    settings: {
      showChords: false,
      showInlineNotes: false,
      lyricFontSize: 14,
      chordFontSize: 17,
      nashville: false,
      notation: 'letters',
      showDiagrams: false,
    },
  },
];

export const STAGE_MODE_MAP = Object.fromEntries(STAGE_MODES.map(m => [m.id, m]));

// Settings keys the picker writes through. Kept here so any code that
// resets or copies stage-mode state doesn't have to re-list them.
export const STAGE_MODE_SETTING_KEYS = [
  'showChords',
  'showInlineNotes',
  'lyricFontSize',
  'chordFontSize',
  'nashville',
  'notation',
  'showDiagrams',
];
