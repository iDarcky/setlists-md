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

const countLine = (items = []) => {
  const songs = items.filter(it => it && it.type !== 'break' && it.songId).length;
  const moments = items.filter(it => it?.type === 'break').length;
  return [songs && `${songs} ${songs === 1 ? 'song' : 'songs'}`, moments && `${moments} ${moments === 1 ? 'moment' : 'moments'}`].filter(Boolean).join(', ');
};

const shortDay = (date) => dayOf(date).toLocaleDateString('en-GB', { weekday: 'short' });

/**
 * → [{ id, name, sub, date, from }] templates first, then services, newest
 * pattern wins. `from` is what `newSetlistFrom` copies.
 */
export function serviceStarts(setlists = [], today = ymd(new Date())) {
  const real = setlists.filter(s => s && !s.isTemplate);
  const newestOf = (name) => real
    .filter(s => s.date && ((s.service || '').trim() === name || baseName(s) === name))
    .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  const takenFor = (name) => new Set(real.filter(s => s.date && ((s.service || '').trim() === name || baseName(s) === name)).map(s => s.date));

  const out = [];
  const seen = new Set();
  const push = (name, pattern, items, kind) => {
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return;
    seen.add(key);
    const dow = pattern?.date ? weekday(pattern.date) : 0;
    const date = nextFreeDay(dow, takenFor(name), today);
    const sub = [pattern?.date && [shortDay(pattern.date), pattern.time].filter(Boolean).join(' '), pattern?.location, countLine(items)].filter(Boolean).join(' · ');
    out.push({ id: `${kind}:${key}`, name, sub, date, from: { name, pattern, items, service: pattern?.service || (kind === 'service' ? name : '') } });
  };

  setlists.filter(s => s?.isTemplate).forEach(t => {
    const name = baseName(t) || 'Setlist';
    const pattern = newestOf(name) || t;
    push(name, { ...pattern, service: pattern.service || t.service || '' }, t.items || [], 'template');
  });
  const names = [...new Set(real.map(s => (s.service || '').trim()).filter(Boolean))];
  names
    .map(n => newestOf(n))
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach(p => push(p.service.trim(), p, (p.items || []).filter(it => it?.type === 'break'), 'service'));
  return out;
}

/** The default date for a blank setlist: the next Sunday. */
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
// two), items (moments + "Song" placeholders). Every field is optional: older
// templates (saved from a setlist) carry only templateName + items.

/** A slot in the order that still waits for a song. */
export const isPlaceholder = (it) => !!it && it.type !== 'break' && !it.songId && !!it.placeholder;
export const placeholderItem = (label = '') => ({ placeholder: true, ...(label ? { label } : {}) });

export const templatesOf = (setlists = []) => setlists.filter(s => s?.isTemplate);
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
const pad = (n) => String(n).padStart(3, '0');

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
  return `${parts.before}${pad(n)}${parts.after}`.trim();
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
    sl.rehearsalDate = addDays(sl.date, -(Number(tpl.rehearsalOffset) || 0));
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
  id: generateId(), isTemplate: true, templateName: '', name: '', weekday: 0, time: '10:00', location: '',
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

/**
 * Services the church already runs that have no template yet, read from its
 * setlists, as template-shaped objects (not saved, not editable), so New
 * setlist can still start from "Sunday Morning" before anyone makes one.
 */
export function serviceTemplates(setlists = []) {
  const named = new Set(templatesOf(setlists).map(t => templateTitle(t).toLowerCase()));
  return serviceStarts(setlists)
    .filter(s => s.id.startsWith('service:') && !named.has(s.name.toLowerCase()))
    .map(s => {
      const p = s.from.pattern || {};
      const gap = p.rehearsalDate && p.date ? Math.round((dayOf(p.date) - dayOf(p.rehearsalDate)) / 86400000) : null;
      return {
        id: s.id, virtual: true, isTemplate: true, templateName: s.name, service: s.from.service || s.name,
        weekday: p.date ? weekday(p.date) : 0, time: p.time || '', location: p.location || '',
        rehearsalOn: !!(p.rehearsalDate || p.rehearsalTime), rehearsalOffset: gap != null && gap >= 0 && gap < 14 ? gap : 1,
        rehearsalTime: p.rehearsalTime || '', rehearsalLocation: p.rehearsalLocation || '',
        items: (s.from.items || []).map(it => ({ ...it })),
      };
    });
}

/** "Sun 8" */
export const shortDayLabel = (date) => (date ? dayOf(date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }) : '');
