// Songs added from a batch import without being opened carry a "To check" tag
// until a leader has looked at each one in the editor. A converted chart can
// be wrong in ways only a person spots (a chord a syllable off, a wrapped line),
// and 50 songs is more than one sitting — the tag is where the progress lives,
// so stopping halfway loses nothing and the band can use the songs meanwhile.
export const TO_CHECK = 'To check';

const tagsOf = (song) => (Array.isArray(song?.tags) ? song.tags : []);

export const needsCheck = (song) => tagsOf(song).includes(TO_CHECK);

export function markToCheck(song) {
  return needsCheck(song) ? song : { ...song, tags: [...tagsOf(song), TO_CHECK] };
}

export function clearCheck(song) {
  return needsCheck(song) ? { ...song, tags: tagsOf(song).filter(t => t !== TO_CHECK) } : song;
}
