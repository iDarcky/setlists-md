import { useMemo } from 'react';
import { useTeamActivity } from '../../hooks/useTeamActivity';

function relativeTime(iso) {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function shortDate(s) {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  return isNaN(d) ? s : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Build a human sentence + the bolded object for one activity row.
function describe(row, nameFor) {
  const actor = nameFor(row.actor_id) || 'Someone';
  const m = row.metadata || {};
  switch (row.action) {
    case 'song_added': return { actor, verb: 'added', object: row.entity_name };
    case 'song_edited': return { actor, verb: 'edited', object: row.entity_name };
    case 'song_removed': return { actor, verb: 'removed', object: row.entity_name };
    case 'setlist_created': return { actor, verb: 'created', object: row.entity_name };
    case 'setlist_edited': return { actor, verb: 'updated', object: row.entity_name };
    case 'setlist_removed': return { actor, verb: 'deleted', object: row.entity_name };
    case 'member_joined': return { actor, verb: 'joined the team', object: null };
    case 'roster_assigned': {
      const who = nameFor(row.entity_id) || 'someone';
      const part = [m.role, m.vocal_part].filter(Boolean).join(' · ');
      return { actor, verb: `scheduled ${who}${part ? ` on ${part}` : ''}`, object: null };
    }
    case 'availability_set': return { actor, verb: `marked ${m.status || 'a status'} for`, object: shortDate(m.date) };
    default: return { actor, verb: row.action, object: row.entity_name };
  }
}

function initials(name) {
  return (name || '?').trim().slice(0, 2).toUpperCase();
}

export default function ActivityFeed({ teamId, members = [], limit = 100, compact = false }) {
  const { activity, loading } = useTeamActivity(teamId, { limit });

  const nameFor = useMemo(() => {
    const map = new Map();
    members.forEach(mem => {
      map.set(mem.user_id, mem.profile?.display_name || mem.profile?.email?.split('@')[0] || null);
    });
    return (id) => map.get(id) || null;
  }, [members]);

  const avatarFor = useMemo(() => {
    const map = new Map();
    members.forEach(mem => map.set(mem.user_id, mem.profile?.avatar_url || null));
    return (id) => map.get(id) || null;
  }, [members]);

  // Collapse repeats of the same event (e.g. a song edited many times) to its
  // most recent occurrence so the feed stays readable.
  const rows = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const r of activity) {
      const key = `${r.action}:${r.entity_id}:${r.metadata?.date || r.metadata?.setlist_id || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
      if (compact && out.length >= 5) break;
    }
    return out;
  }, [activity, compact]);

  if (loading && rows.length === 0) {
    return <div className="text-copy-13 text-[var(--modes-text-dim)] py-4">Loading activity…</div>;
  }
  if (rows.length === 0) {
    return (
      <div className="modes-card px-4 py-6 text-center text-copy-13 text-[var(--modes-text-dim)]">
        No activity yet — changes your team makes will show up here.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {rows.map(row => {
        const { actor, verb, object } = describe(row, nameFor);
        const url = avatarFor(row.actor_id);
        return (
          <div key={row.id} className="flex items-start gap-2.5 px-1 py-2">
            <div className="w-7 h-7 rounded-full bg-[var(--modes-surface-strong)] border border-[var(--modes-border)] flex items-center justify-center overflow-hidden shrink-0 text-label-10 font-bold text-[var(--modes-text-muted)] mt-0.5">
              {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : initials(actor)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-copy-13 text-[var(--modes-text)] m-0 leading-snug">
                <span className="font-semibold">{actor}</span> {verb}
                {object ? <> <span className="font-semibold">{object}</span></> : ''}
              </p>
              <span className="text-label-11 text-[var(--modes-text-dim)]">{relativeTime(row.created_at)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
