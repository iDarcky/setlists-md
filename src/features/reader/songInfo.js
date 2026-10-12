// The song's facts, resolved — which ones the strip has left to say.
//
// Its own module for the same reason `readerChrome.js` is: a component file
// that also exports a plain function breaks Fast Refresh, because the bundler
// cannot tell whether a changed export is a component to hot-swap or a value
// something else depends on.

import { rankedTempos, tempoHistoryIsInteresting } from '@/tempoHistory';

/**
 * "usually in G ×5 · A ×3" — the leader's question, answered.
 */
function playedIn(keyHistory) {
  const entries = Object.entries(keyHistory || {});
  if (entries.length === 0) return null;
  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, n]) => `${k} ×${n}`)
    .join('  ·  ');
}

/**
 * "♩72 ×5 · 76 ×2" — the same question about speed.
 *
 * ⚠ It used to be impossible, and the reason is worth keeping: `keyHistory`
 * works because a setlist item records `transpose`, so every past performance
 * carries the key it was played in, while the setlist editor's tempo field
 * wrote straight back to the SONG. The cards row records `item.tempo` as a
 * per-setlist override, so there is a real history now — but only when it says
 * something the bar does not. One recorded tempo equal to the song's own is
 * the bar's number printed twice, one row down, which is the exact
 * carelessness `songInfoFacts` exists to avoid.
 */
function playedAt(tempoHistory, songTempo) {
  if (!tempoHistoryIsInteresting(tempoHistory, songTempo)) return null;
  return rankedTempos(tempoHistory)
    .slice(0, 3)
    .map(([bpm, n], i) => (i === 0 ? `♩ ${bpm} ×${n}` : `${bpm} ×${n}`))
    .join('  ·  ');
}

/**
 * What the strip would actually SAY, given what the bar is already showing.
 *
 * ⚠ It is NOT "everything about this song". The first cut was, and seen on a
 * tablet it printed Key · Capo · Tempo · Time in the strip forty pixels under
 * the same four in the bar. Four facts twice, one row apart, reads as
 * carelessness — and it is: the bar is not a summary of the strip, it is the
 * part of the strip that fits.
 *
 * So the strip is the COMPLEMENT. Key and capo are never in it — the bar
 * carries both at every width, and they are the two live controls. Tempo and
 * time are in it only when the bar has dropped them, which on a phone it has.
 *
 * Exported because the caller needs the same answer to decide whether the
 * title is a control at all: a title styled as a button that unfolds an empty
 * row is READER.md's trap 23 with extra steps. One function, both ends.
 */
export function songInfoFacts({ song, displayKey, showTempoTime, arrangementName, notes }) {
  if (!song) return [];
  const facts = [];
  // The song's own key, but only when it is NOT the one you are reading. On a
  // transposed song this is the fact people actually hunt for; untransposed it
  // would print the same letter the bar's pill is already showing.
  if (song.key && displayKey && song.key !== displayKey) {
    facts.push({ label: 'Written in', value: song.key });
  }
  if (!showTempoTime && song.tempo) facts.push({ label: 'Tempo', value: `♩ ${song.tempo}` });
  if (!showTempoTime && song.time) facts.push({ label: 'Time', value: song.time });
  const history = playedIn(song.keyHistory);
  if (history) facts.push({ label: 'Usually played in', value: history });
  const tempos = playedAt(song.tempoHistory, song.tempo);
  if (tempos) facts.push({ label: 'Usually played at', value: tempos });
  // Which arrangement you are reading. A song can carry several and the chart
  // never says which is on screen — the one place that ambiguity costs you
  // something is a rehearsal where half the band is on a different one.
  if (arrangementName) facts.push({ label: 'Arrangement', value: arrangementName });
  // ⚠ The only two fields borrowed from the hub's cataloguing set, and they are
  // here on a test rather than because they exist: **does it change how you play
  // the song in the next four minutes?** Scripture and story set the intent, so
  // a leader reads them before a rehearsal. CCLI, publisher, label, copyright,
  // album and year never do, and they stay in the hub.
  if (song.scripture) facts.push({ label: 'Scripture', value: song.scripture });
  if (song.story) facts.push({ prose: 'story' });
  if (notes) facts.push({ notes });
  return facts;
}
