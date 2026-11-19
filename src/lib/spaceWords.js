// Church words for churches, plain band words for everyone else (2026-11-19).
//
// A group is a church when `teams.kind` is 'church'. Everything else (kind
// 'team', missing) is a band: weddings, covers, cruise ships, youth bands.
// Use these instead of writing "church", "service" or "worship leader" in a
// screen that both can see.

const CHURCH = {
  kind: 'church',
  space: 'church', Space: 'Church',
  event: 'service', Event: 'Service', events: 'services', Events: 'Services',
  leader: 'worship leader', Leader: 'Worship leader',
  day: 'Sunday', days: 'Sundays',
  namePlaceholder: 'Sunday Morning',
  team: 'the worship team',
};

const BAND = {
  kind: 'band',
  space: 'band', Space: 'Band',
  event: 'event', Event: 'Event', events: 'events', Events: 'Events',
  leader: 'leader', Leader: 'Leader',
  day: 'date', days: 'dates',
  namePlaceholder: 'Friday night',
  team: 'the band',
};

/** True when the group is set up as a church. */
export function isChurchSpace(team) {
  return (team?.kind || '').toLowerCase() === 'church';
}

/** The word set for a group. No group (signed out, not in one yet) reads as a band. */
export function wordsFor(team) {
  return isChurchSpace(team) ? CHURCH : BAND;
}

export { CHURCH as CHURCH_WORDS, BAND as BAND_WORDS };
