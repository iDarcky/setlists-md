import { partLabel, labelFor } from '@/data/instruments';

// Notifications, rebuilt (canvas → Notifications). Turns the merged feed
// (useNotificationFeed) plus the church's join requests into what the bell
// shows: "Needs you" first — things you answer right there — then Today,
// This week and Earlier. Pure; NotificationsPanel renders it.

const DAY = 86400000;
export const KEEP_DAYS = 30;

const dayLabel = (date) => (date
  ? new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  : '');

/** "now", "5m", "3h", "Tue", "8 Nov". */
export function timeLabel(ms, now = Date.now()) {
  if (!ms) return '';
  const d = now - ms;
  if (d < 60000) return 'now';
  if (d < 3600000) return `${Math.floor(d / 60000)}m`;
  if (d < DAY) return `${Math.floor(d / 3600000)}h`;
  if (d < 7 * DAY) return new Date(ms).toLocaleDateString('en-GB', { weekday: 'short' });
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';

const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

/**
 * @returns {{ needs: Item[], groups: Array<{ label: string, items: Item[] }>, unread: number }}
 * Item = { id, kind: 'ask'|'join'|'info', title, sub, time, unread, scheduleId?, requestId?, setlistId?, avatar?, tone? }
 */
export function buildNotifs({ feed = [], joinRequests = [], schedules = [], setlists = [], matchesSetlistId, now = Date.now() }) {
  const scheduleById = new Map(schedules.map(s => [s.id, s]));
  const setlistFor = (id) => (id && matchesSetlistId ? setlists.find(sl => matchesSetlistId(sl, id)) : null);

  const needs = [];
  const rest = [];

  for (const n of feed) {
    if (n.type === 'schedule_request') {
      const sch = scheduleById.get(n.scheduleId);
      const sl = setlistFor(n.setlistId);
      const maybe = n.id?.startsWith('maybe-');
      needs.push({
        id: n.id,
        kind: 'ask',
        title: sl?.date ? `Can you play ${dayLabel(sl.date)}?` : 'Can you play?',
        sub: [maybe ? 'You said maybe' : null, sl?.name, partLabel(sch)].filter(Boolean).join(' · '),
        time: null,
        unread: true,
        scheduleId: n.scheduleId,
        avatar: { icon: 'cal' },
      });
      continue;
    }
    const time = n.createdAt ? new Date(n.createdAt).getTime() : (n.timestamp || null);
    if (time && now - time > KEEP_DAYS * DAY) continue;
    rest.push({
      id: n.id,
      kind: 'info',
      title: n.title || 'Notification',
      sub: n.message || '',
      time,
      unread: !n.read,
      tone: n.type === 'schedule_decline' ? 'no' : null,
      setlistId: n.setlistId || null,
      sourceId: n.id,
      avatar: { icon: n.type?.startsWith('song') ? 'music' : n.type?.startsWith('member') || n.type?.startsWith('join') ? 'team' : 'cal' },
    });
  }

  for (const r of joinRequests) {
    const name = r.display_name || r.email || 'Someone';
    needs.push({
      id: `join-${r.id}`,
      kind: 'join',
      title: `${name} wants to join`,
      sub: (r.parts || []).map(p => labelFor(p) || p).join(', '),
      time: r.created_at ? new Date(r.created_at).getTime() : null,
      unread: true,
      requestId: r.id,
      avatar: { initials: initials(name), url: r.avatar_url || null },
    });
  }

  const today = startOfDay(now);
  const buckets = [['Today', []], ['This week', []], ['Earlier', []]];
  rest
    .sort((a, b) => (b.time || now) - (a.time || now))
    .forEach(it => {
      const t = it.time || now;
      buckets[t >= today ? 0 : t >= today - 6 * DAY ? 1 : 2][1].push(it);
    });

  return {
    needs,
    groups: buckets.filter(([, items]) => items.length).map(([label, items]) => ({ label, items })),
    unread: needs.length + rest.filter(i => i.unread).length,
  };
}
