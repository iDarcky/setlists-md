import { READER_DEFAULT_MODE } from '@/lib/readerConfig';

/**
 * Which mode a setlist OPENS in, from the clock.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * One entry point cannot have a fixed default without being wrong for one of
 * its two audiences, and both fixed defaults shipped in this element were wrong
 * half the time by construction: "always practice" was wrong on Sunday morning,
 * "always live" was wrong every other day of the week — open a setlist on a
 * Tuesday to learn it and the metronome, Edit and note-writing are all gone
 * until you find the ☰. That is the complaint this whole element started from.
 *
 * The owner's question, 2026-08-11: *"If someone opens the setlist on a normal
 * day it goes to practice. If it opens the setlist with let's say 30 min before
 * the setlist it goes to live. Is this a good idea or not?"* — yes, and it is
 * the piece that makes a single entry point work at all. Time is the one signal
 * that separates the two audiences without asking anybody anything.
 *
 * ── The rule ────────────────────────────────────────────────────────────────
 *
 *   live   from  (service start − 30 min)  to  endTime, or +3h if none set
 *   BUT    if a rehearsal is recorded that day, live does not start until the
 *          service does
 *   practice  everywhere else, including any setlist with no date or no time
 *
 * The rehearsal clause is not a nicety, it is the case the owner described:
 * *"we typically have a practice one hour before the service and finish at
 * let's say :45."* A 10:00 service with a 09:00 rehearsal means the plain
 * 30-minute window opens at 09:30 — a quarter of an hour BEFORE the band stops
 * rehearsing. Nobody starts a rehearsal at 09:30; theirs is still running.
 * `rehearsalDate`/`rehearsalTime` are fields the leader already fills in, so
 * this is a fact the app has rather than an inference it makes.
 *
 * Generous on the back edge on purpose: a service that started twenty minutes
 * ago is unambiguously live, and people pick their phone up mid-service.
 *
 * ⚠ The rule is invisible when it is right, which is only survivable because
 * the mode is now legible and reversible: the fold names the state, `LiveIntro`
 * explains it once per account, the ☰ carries a one-line switch, and a pull
 * gets you out. Do not make this rule cleverer without keeping those four.
 */

const MIN = 60 * 1000;
const LEAD_IN = 30 * MIN;       // how early "live" can begin
const DEFAULT_RUN = 3 * 60 * MIN; // how long a service lasts with no endTime

// `YYYY-MM-DD` + `HH:MM` in the DEVICE's timezone, which is where the person
// holding it is standing. A setlist time is a wall-clock fact about a room.
function at(date, time) {
  if (!date || typeof date !== 'string') return null;
  const t = /^\d{2}:\d{2}$/.test(time || '') ? time : null;
  if (!t) return null;
  const d = new Date(`${date}T${t}:00`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * @param setlist  the setlist being opened
 * @param now      ms since epoch; injectable so the tests do not depend on today
 * @returns 'live' | 'practice'
 */
export function resolveOpeningMode(setlist, now = Date.now()) {
  // Campfire has no schedule at all, and neither does a setlist someone never
  // put a time on. Both are "I am looking at this", which is practice.
  const start = at(setlist?.date, setlist?.time);
  if (start == null) return READER_DEFAULT_MODE;

  const end = at(setlist?.date, setlist?.endTime) ?? (start + DEFAULT_RUN);
  // A malformed endTime BEFORE the start would otherwise make the window empty
  // and live unreachable — silently, on the day it matters.
  const closes = end > start ? end : start + DEFAULT_RUN;

  let opens = start - LEAD_IN;

  // A rehearsal recorded for the same day pushes live back to the service
  // itself: the pre-service half hour belongs to the rehearsal that is still
  // happening in it.
  const rehearsal = at(setlist?.rehearsalDate, setlist?.rehearsalTime);
  if (rehearsal != null && setlist.rehearsalDate === setlist.date && rehearsal < start) {
    opens = start;
  }

  return now >= opens && now <= closes ? 'live' : READER_DEFAULT_MODE;
}
