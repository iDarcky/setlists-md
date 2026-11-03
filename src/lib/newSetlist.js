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
