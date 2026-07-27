import { useTeam } from '@/auth/useTeam';
import { useTeamSchedules } from '@/hooks/useTeamSchedules';
import { useTeamAvailability } from '@/hooks/useTeamAvailability';
import { useTeamSetlistMap } from '@/hooks/useTeamSetlistMap';

// Sort priority: available → unknown → maybe → unavailable.
const AVAIL_RANK = { available: 0, maybe: 2, unavailable: 3 };

function dotClass(status) {
  if (status === 'available') return 'bg-[var(--ds-green-700)]';
  if (status === 'unavailable') return 'bg-[var(--ds-red-700)]';
  if (status === 'maybe') return 'bg-[var(--ds-amber-700)]';
  return 'bg-[var(--ds-gray-400)]';
}

/**
 * Read-only "Who's playing" card for the desktop/tablet viewer (mockup's side
 * card). Everyone can see it; editing the roster stays in the Band tab / editor
 * (admin-only). Renders a hint when there's no team, or when no one is rostered.
 */
export default function RosterReadCard({ setlistId, setlistDate }) {
  const { team, members } = useTeam();
  const { schedules } = useTeamSchedules(team?.id);
  const { availability } = useTeamAvailability(team?.id);
  const { map: setlistIdMap } = useTeamSetlistMap(team?.id);

  const dbSetlistId = team ? (setlistIdMap[setlistId] || setlistId) : null;
  const rows = team
    ? schedules
        .filter(s => s.setlist_id === dbSetlistId)
        .map(s => {
          const member = members.find(m => m.user_id === s.user_id);
          const dateStatus = setlistDate
            ? availability.find(a => a.user_id === s.user_id && a.date === setlistDate)?.status
            : null;
          const status = s.availability && s.availability !== 'pending' ? s.availability : dateStatus;
          return { ...s, status, name: member?.profile?.display_name || 'Member' };
        })
        .sort((a, b) => (AVAIL_RANK[a.status] ?? 1) - (AVAIL_RANK[b.status] ?? 1))
    : [];

  return (
    <div className="rounded-2xl border border-[var(--border-1)] bg-[var(--ds-background-100)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border-1)]">
        <h3 className="text-heading-14 font-semibold text-[var(--ds-gray-1000)] m-0">Who's playing</h3>
      </div>
      {!team ? (
        <p className="px-4 py-5 text-copy-13 text-[var(--ds-gray-600)] m-0">Assigning the band is part of a team workspace.</p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-5 text-copy-13 text-[var(--ds-gray-600)] m-0">No one rostered yet.</p>
      ) : (
        <div className="divide-y divide-[var(--ds-gray-200)]">
          {rows.map(r => {
            const role = [r.role, r.vocal_part].filter(Boolean).join(' · ');
            return (
              <div key={r.id || r.user_id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="relative shrink-0">
                  <span className="grid place-items-center w-8 h-8 rounded-full bg-[var(--ds-gray-200)] text-label-12 font-semibold text-[var(--ds-gray-700)]">{r.name.charAt(0).toUpperCase()}</span>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--ds-background-100)] ${dotClass(r.status)}`} aria-hidden="true" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-copy-14 font-semibold text-[var(--ds-gray-1000)] m-0 truncate">{r.name}</p>
                  {role && <p className="text-label-11 text-[var(--ds-gray-600)] m-0 truncate">{role}</p>}
                </div>
                {r.status === 'available' && <span className="text-[var(--color-brand)] text-label-13" aria-label="Available">✓</span>}
                {r.status === 'maybe' && <span className="text-[var(--ds-gray-500)] text-label-11">maybe</span>}
                {r.status === 'unavailable' && <span className="text-[var(--ds-red-700)] text-label-11">out</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
