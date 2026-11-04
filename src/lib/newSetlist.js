// "New setlist → start from a service" (canvas → Setlist, SetNew). Pure.
//
// A service is what the church already runs: every saved template, then every
// service name its setlists use. Starting from one copies its name, day, time,
// place and rehearsal from the newest setlist of that service, and its order of
// moments (the slots: Welcome, Offering…), never its songs; a template also
// brings its songs. The date is the next day of that weekday with no setlist of
// that service yet.

import { generateId } from '@/parser';

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayOf = (date) => new Date(`${date}T12:00:00`);
const addDays = (date, n) => { const d = dayOf(date); d.setDate(d.getDate() + n); return ymd(d); };
const weekday = (date) => dayOf(date).getDay();
const baseName = (sl) => (sl.templateName || sl.name || '').replace(/\s*template$/i, '').trim();

/** The next date on or after `from` that falls on `dow` and is not in `taken`. */
export function nextFreeDay(dow, taken = new Set(), from = ymd(new Date())) {
  let d = from;
  while (weekday(d) !== dow) d = addDays(d, 1);
  for (let i = 0; i < 104 && taken.has(d); i++) d = addDays(d, 7);
  return d;
}

export const blankDate = (today = ymd(new Date())) => nextFreeDay(0, new Set(), today);

/** A fresh, unsaved draft setlist. `from` null = blank. */
export function newSetlistFrom(from, date) {
  const sl = { id: generateId(), name: from?.name || '', date: date || '', status: 'draft', items: [] };
  if (!from) return sl;
  const p = from.pattern || {};
  if (from.service) sl.service = from.service;
  if (p.time) sl.time = p.time;
  if (p.endTime) sl.endTime = p.endTime;
  if (p.location) sl.location = p.location;
  if (p.rehearsalTime) sl.rehearsalTime = p.rehearsalTime;
  if (p.rehearsalDate && p.date && date) {
    const gap = Math.round((dayOf(p.date) - dayOf(p.rehearsalDate)) / 86400000);
    if (gap >= 0 && gap < 14) sl.rehearsalDate = addDays(date, -gap);
  }
  // Who leads is per service, never copied.
  sl.items = (from.items || []).map(({ leadBy: _l, ...it }) => ({ ...it }));
  return sl;
}

/** "Sun 8 Nov" */
export const dayLabel = (date) => (date ? dayOf(date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '');

// ── Templates + the step-by-step New setlist (canvas → New setlist) ─────────
//
// A template is a setlist with `isTemplate: true` (so it syncs like one) and
// these fields: templateName, service, weekday (0 = Sunday), time, location,
// rehearsalOn, rehearsalOffset (days before), rehearsalTime, rehearsalLocation,
// namePattern ("BBPT #{n} AM"), startNumber, parts (part ids, repeated for
// two), items (moments + "Song" placeholders), templateKind ('service').

/** A slot in the order that still waits for a song. */
export const isPlaceholder = (it) => !!it && it.type !== 'break' && !it.songId && !!it.placeholder;
export const placeholderItem = (label = '') => ({ placeholder: true, ...(label ? { label } : {}) });

// A template is its own kind: made only in the template editor, which stamps
// `templateKind: 'service'`. Never derived from service names on setlists, and
// never an old "Save as template" copy (those keep `isTemplate` without the
// kind, stay in the data untouched, and are no longer shown anywhere).
export const TEMPLATE_KIND = 'service';
export const isRealTemplate = (s) => !!s?.isTemplate && s.templateKind === TEMPLATE_KIND;
export const templatesOf = (setlists = []) => setlists.filter(isRealTemplate);
export const templateTitle = (t) => (t?.templateName || baseName(t) || 'Service').trim();

const NUM_TOKEN = '{n}';
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** "BBPT #{n} AM" → { before: "BBPT #", after: " AM" }, or null without {n}. */
export function splitPattern(pattern) {
  const i = (pattern || '').indexOf(NUM_TOKEN);
  if (i < 0) return null;
  return { before: pattern.slice(0, i), after: pattern.slice(i + NUM_TOKEN.length) };
}
export const joinPattern = (before = '', after = '') => `${before}${NUM_TOKEN}${after}`;
const pad = (n, width = 1) => String(n).padStart(Math.max(1, Number(width) || 1), '0');
/** "BBPT #{n} AM" + 424 + 3 → "BBPT #424 AM". */
export const formatName = (pattern, n, width = 1) => {
  const parts = splitPattern(pattern);
  return parts ? `${parts.before}${pad(n, width)}${parts.after}`.trim() : '';
};
/**
 * A typed example of the next name → its pattern: "BBPT #424 AM" →
 * { pattern: "BBPT #{n} AM", number: 424, pad: 3 }. The last number in the
 * text is the counter; its digit count is kept ("#007" stays three wide).
 * Null when there is no number.
 */
export function patternFromName(text) {
  const s = String(text || '');
  const m = /(\d+)(?!.*\d)/.exec(s);
  if (!m) return null;
  return { pattern: `${s.slice(0, m.index)}${NUM_TOKEN}${s.slice(m.index + m[1].length)}`, number: Number(m[1]), pad: m[1].length };
}

/** The number in a setlist name made from this pattern's family, or null. */
function numberIn(name, before) {
  const m = (name || '').match(new RegExp(`^${escapeRe(before.trim())}\\s*(\\d+)`, 'i'));
  return m ? Number(m[1]) : null;
}

/**
 * The number for a new setlist on `date`. Setlists whose name starts with the
 * same text before the number share one counter ("BBPT #423 AM" and
 * "BBPT #423 PM"), and one date shares one number: the evening service on a
 * Sunday that already has #424 is #424 too. Otherwise the highest number used
 * plus one, never below the template's `startNumber`.
 */
export function nextNumber(pattern, setlists = [], date = '', startNumber = 1, exceptId = null) {
  const parts = splitPattern(pattern);
  if (!parts) return null;
  let max = 0;
  for (const sl of setlists) {
    if (!sl || sl.isTemplate || sl.id === exceptId) continue;
    const n = numberIn(sl.name, parts.before);
    if (n == null) continue;
    if (date && sl.date === date) return n;
    max = Math.max(max, n);
  }
  return Math.max(max + 1, Number(startNumber) || 1);
}

/** The automatic name: the pattern with its number, else the template's name. */
export function autoName(tpl, setlists = [], date = '', exceptId = null) {
  if (!tpl) return '';
  const parts = splitPattern(tpl.namePattern);
  if (!parts) return templateTitle(tpl);
  const n = nextNumber(tpl.namePattern, setlists, date, tpl.startNumber, exceptId);
  return formatName(tpl.namePattern, n, tpl.namePad);
}

/** The next `count` free days of `weekday` (dates already used by this service skipped). */
export function nextDates(weekday, taken = new Set(), count = 3, from = ymd(new Date())) {
  const out = [];
  let d = nextFreeDay(weekday, taken, from);
  for (let i = 0; i < 60 && out.length < count; i++) {
    if (!taken.has(d)) out.push(d);
    d = addDays(d, 7);
  }
  return out;
}

/** Days this template's service already has a setlist on. */
export function takenDates(tpl, setlists = []) {
  const name = templateTitle(tpl).toLowerCase();
  const svc = (tpl?.service || '').trim().toLowerCase();
  return new Set(setlists
    .filter(s => s && !s.isTemplate && s.date && (s.templateId === tpl?.id || (svc && (s.service || '').trim().toLowerCase() === svc) || baseName(s).toLowerCase() === name))
    .map(s => s.date));
}

export const shiftDate = (date, days) => (date ? addDays(date, days) : '');

/** A fresh draft from a template (or blank with `tpl` null). Never saved here. */
export function draftFromTemplate(tpl, setlists = [], today = ymd(new Date())) {
  const sl = { id: generateId(), name: '', date: '', status: 'draft', items: [] };
  if (!tpl) {
    sl.date = blankDate(today);
    return sl;
  }
  const weekdayOf = Number.isInteger(tpl.weekday) ? tpl.weekday : (tpl.date ? weekday(tpl.date) : 0);
  sl.templateId = tpl.id;
  sl.date = nextFreeDay(weekdayOf, takenDates(tpl, setlists), today);
  const svc = tpl.service || templateTitle(tpl);
  if (svc) sl.service = svc;
  if (tpl.time) sl.time = tpl.time;
  if (tpl.location) sl.location = tpl.location;
  if (tpl.rehearsalOn !== false && (tpl.rehearsalTime || tpl.rehearsalOffset != null)) {
    // "Pick each week": the time and place come along, the day is chosen on the setlist.
    if (!tpl.rehearsalPick) sl.rehearsalDate = addDays(sl.date, -(Number(tpl.rehearsalOffset) || 0));
    if (tpl.rehearsalTime) sl.rehearsalTime = tpl.rehearsalTime;
    if (tpl.rehearsalLocation || tpl.location) sl.rehearsalLocation = tpl.rehearsalLocation || tpl.location;
  }
  // Who leads is per service, never copied.
  sl.items = (tpl.items || []).map(({ leadBy: _l, ...it }) => ({ ...it }));
  sl.name = autoName(tpl, setlists, sl.date, sl.id);
  return sl;
}

/** A blank template. */
export const blankTemplate = () => ({
  id: generateId(), isTemplate: true, templateKind: TEMPLATE_KIND, templateName: '', name: '', weekday: 0, time: '10:00', location: '',
  rehearsalOn: false, rehearsalOffset: 1, rehearsalTime: '18:00', rehearsalLocation: '',
  namePattern: '', startNumber: 1, parts: [], items: [placeholderItem(), placeholderItem(), placeholderItem()],
});

/**
 * The last time a song was played (a past-dated setlist), as it was played:
 * { date, transpose, tempo, time, leadBy, arrangementId } or null.
 */
export function lastPlayed(songId, setlists = [], today = ymd(new Date()), exceptId = null) {
  let best = null;
  for (const sl of setlists) {
    if (!sl || sl.isTemplate || !sl.date || sl.date >= today || sl.id === exceptId) continue;
    if (best && sl.date <= best.date) continue;
    const it = (sl.items || []).find(x => x?.songId === songId);
    if (it) best = { date: sl.date, transpose: it.transpose || 0, tempo: it.tempo ?? null, time: it.time || '', leadBy: it.leadBy || null, arrangementId: it.arrangementId || null };
  }
  return best;
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Sun 8" */
export const shortDayLabel = (date) => (date ? dayOf(date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }) : '');

// ── Hints on the order (2026-11-04) ─────────────────────────────────────────

const PITCH = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const pitchOf = (key) => {
  const m = /^([A-G])([#b♯♭]?)(m(?!aj))?/.exec(String(key || '').trim());
  if (!m) return null;
  const acc = m[2] === '♯' ? '#' : m[2] === '♭' ? 'b' : m[2];
  const p = PITCH[m[1] + acc];
  return p == null ? null : { p, minor: !!m[3] };
};
/** Steps apart on the circle of fifths (0–6); a minor key counts as its relative major. */
export function keyDistance(a, b) {
  const x = pitchOf(a); const y = pitchOf(b);
  if (!x || !y) return null;
  const px = x.minor ? (x.p + 3) % 12 : x.p;
  const py = y.minor ? (y.p + 3) % 12 : y.p;
  const k = (((py - px) * 7) % 12 + 12) % 12;
  return Math.min(k, 12 - k);
}

/**
 * "E♭ → A, far key" / "72 → 128 BPM" between a song and the song before it
 * (moments and empty slots in between don't count). { [rowIdx]: text }
 */
export function flowHints(rows = []) {
  const out = {};
  let prev = null;
  rows.forEach(r => {
    if (r.kind !== 'song' || r.placeholder) return;
    if (prev) {
      const bits = [];
      const d = keyDistance(prev.key, r.key);
      if (d != null && d >= 3) bits.push(`${prev.key} → ${r.key}, far key`);
      const a = Number(prev.tempo); const b = Number(r.tempo);
      if (a && b && Math.abs(a - b) >= 35) bits.push(`${a} → ${b} BPM`);
      if (bits.length) out[r.idx] = bits.join(' · ');
    }
    prev = r;
  });
  return out;
}

/** "Played last Sunday" / "Played 1 Nov" when a song was played in the 3 weeks before `date`. */
export function playedRecently(songId, setlists = [], date = ymd(new Date()), exceptId = null) {
  if (!songId || !date) return '';
  let best = '';
  setlists.forEach(sl => {
    if (!sl || sl.isTemplate || sl.id === exceptId || !sl.date || sl.date >= date) return;
    if ((sl.items || []).some(it => it?.songId === songId) && sl.date > best) best = sl.date;
  });
  if (!best) return '';
  const days = Math.round((dayOf(date) - dayOf(best)) / 86400000);
  if (days > 21) return '';
  if (days === 7 && weekday(best) === 0) return 'Played last Sunday';
  if (days <= 7) return `Played ${dayOf(best).toLocaleDateString('en-GB', { weekday: 'long' })}`;
  return `Played ${dayOf(best).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

/** "930" → "09:30", "18" → "18:00", "7:5" → "07:05"; null when it is not a time. */
export function parseTime(text) {
  const s = String(text || '').trim().replace(/[.,h ]/g, ':');
  let h; let m;
  const c = /^(\d{1,2}):(\d{1,2})$/.exec(s);
  if (c) { h = +c[1]; m = +c[2]; } else if (/^\d{1,4}$/.test(s)) {
    if (s.length <= 2) { h = +s; m = 0; } else { h = +s.slice(0, s.length - 2); m = +s.slice(-2); }
  } else return null;
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * As the time is typed: the colon comes by itself after the hours ("10" →
 * "10:"), a first digit above 2 is an hour on its own ("9" → "09:"), and
 * deleting never fights back (the colon goes with a backspace).
 */
export function typeTime(next, prev = '') {
  const digits = String(next || '').replace(/\D/g, '').slice(0, 4);
  if (String(next).length < String(prev).length) {
    // Backspace over the auto colon also takes the digit before it.
    if (/:$/.test(prev) && !/:/.test(next)) return digits.slice(0, -1);
    return next.replace(/[^\d:]/g, '');
  }
  const d = digits.length === 1 && Number(digits) > 2 ? `0${digits}` : digits;
  return d.length >= 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
}

/**
 * A time signature as it is typed: "68" → "6/8", "34" → "3/4", "128" →
 * "12/8". The slash comes by itself; a backspace over it takes the digit too.
 */
export function typeTimeSig(next, prev = '') {
  if (String(next).length < String(prev).length) {
    if (/\/$/.test(prev) && !/\//.test(next)) return String(next).replace(/\D/g, '').slice(0, -1);
    return String(next).replace(/[^\d/]/g, '');
  }
  const d = String(next || '').replace(/\D/g, '').slice(0, 4);
  if (!d || d === '1') return d;
  const top = d.startsWith('12') ? 2 : 1;
  return `${d.slice(0, top)}/${d.slice(top, top + 2)}`;
}
export const isTimeSig = (s) => /^\d{1,2}\/\d{1,2}$/.test(String(s || ''));

