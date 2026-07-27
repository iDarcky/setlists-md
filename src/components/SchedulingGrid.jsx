import { useMemo, useState } from 'react';
import PageHeader from '@/ui/PageHeader';
import { useTeam } from '@/auth/useTeam';
import { useAuth } from '@/auth/useAuth';
import { useTeamSchedules } from '@/hooks/useTeamSchedules';
import { useTeamAvailability } from '@/hooks/useTeamAvailability';
import { useTeamSetlistMap } from '@/hooks/useTeamSetlistMap';
import { toast } from '@/ui/use-toast';

// Standard instruments offered when a member hasn't declared their own. Mirrors
// RosterPanel's list (team_schedules.role holds the assigned instrument).
const INSTRUMENT_OPTIONS = [
  'Acoustic Guitar', 'Electric Guitar', 'Bass', 'Drums', 'Keys', 'Piano',
];

const VOCAL_PARTS = [
  'Lead male', 'Lead female', 'Soprano', 'Alto', 'Tenor', 'Bass', 'Backing',
];

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Availability colour language — shared with the rest of the app:
// green = available, amber = maybe, red = unavailable.
function availClasses(status) {
  if (status === 'available') return 'bg-[var(--ds-green-100)] text-[var(--ds-green-800)]';
  if (status === 'unavailable') return 'bg-[var(--ds-red-100)] text-[var(--ds-red-800)]';
  if (status === 'maybe') return 'bg-[var(--ds-amber-100)] text-[var(--ds-amber-900)]';
  return 'text-[var(--ds-gray-500)]';
}

const TeamFeatureNotice = ({ onBack }) => (
  <div data-theme-variant="modes" className="relative h-full overflow-y-auto">
    <PageHeader title="Scheduling" onClose={onBack} />
    <div className="w-full max-w-[1320px] mx-auto px-5 sm:px-8 py-16">
      <div className="modes-card p-8 text-center flex flex-col items-center gap-3">
        <h2 className="text-heading-20 text-[var(--modes-text)] m-0">Scheduling is a team feature</h2>
        <p className="text-copy-14 text-[var(--modes-text-muted)] max-w-sm m-0">
          Create or join a team to assign roles and coordinate availability across every service.
        </p>
      </div>
    </div>
  </div>
);

export default function SchedulingGrid({ setlists, onBack, onOpenSetlist, onAddSetlist }) {
  const { team, members, canManageRoster } = useTeam();
  const { user } = useAuth();
  const { schedules, createSchedule, updateSchedule, deleteSchedule } = useTeamSchedules(team?.id);
  const { availability, setStatus, clearStatus } = useTeamAvailability(team?.id);
  const { map: setlistIdMap } = useTeamSetlistMap(team?.id);

  const [activeCell, setActiveCell] = useState(null); // { columnId }

  // Columns: every Sunday from this week through year-end (the recurring
  // backbone), MERGED with any dated team setlist (so AM/PM and midweek
  // services each get their own column). Sundays without a service stay as
  // scaffold columns offering "+ Add setlist".
  const columns = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const firstSunday = new Date(today);
    firstSunday.setDate(today.getDate() - today.getDay()); // back to this week's Sunday
    const yearEnd = new Date(today.getFullYear(), 11, 31);
    const firstStr = toDateStr(firstSunday);

    // Existing services (one column each).
    const serviceCols = setlists
      .filter(sl => sl.date && sl.date >= firstStr)
      .map(sl => ({
        type: 'service',
        id: sl.id,
        dbId: setlistIdMap[sl.id] || null,
        name: sl.name || 'Untitled',
        date: sl.date,
        sl,
        ts: new Date(`${sl.date}T${sl.time || '00:00'}:00`).getTime(),
      }));
    const serviceDates = new Set(serviceCols.map(s => s.date));

    // Sundays with no service → scaffold columns.
    const emptyCols = [];
    for (let d = new Date(firstSunday); d <= yearEnd; d.setDate(d.getDate() + 7)) {
      const ds = toDateStr(d);
      if (!serviceDates.has(ds)) {
        emptyCols.push({ type: 'empty', id: `empty-${ds}`, date: ds, ts: new Date(`${ds}T09:00:00`).getTime() });
      }
    }
    return [...serviceCols, ...emptyCols].sort((a, b) => a.ts - b.ts);
  }, [setlists, setlistIdMap]);

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const an = a.profile?.display_name || a.profile?.email || '';
      const bn = b.profile?.display_name || b.profile?.email || '';
      return an.localeCompare(bn);
    });
  }, [members]);

  if (!team) return <TeamFeatureNotice onBack={onBack} />;

  const scheduleFor = (memberId, col) =>
    col.dbId ? schedules.find(s => s.setlist_id === col.dbId && s.user_id === memberId) : null;
  const availFor = (memberId, dateStr) =>
    availability.find(a => a.user_id === memberId && a.date === dateStr)?.status || null;

  // --- mutations -----------------------------------------------------------
  // Ensure a schedule row exists for member×service, then apply a patch
  // ({ role } and/or { vocal_part }).
  const patchSchedule = async (member, col, patch) => {
    if (!col.dbId) {
      toast({ title: 'Sync required', description: 'This service must sync to the team library before you can roster it.', variant: 'error' });
      return;
    }
    try {
      const existing = scheduleFor(member.user_id, col);
      if (existing) {
        await updateSchedule(existing.id, patch);
      } else {
        const row = await createSchedule(col.dbId, member.user_id, patch.role ?? null, 'pending');
        if (row && patch.vocal_part !== undefined) await updateSchedule(row.id, { vocal_part: patch.vocal_part });
      }
    } catch (err) {
      console.error('[scheduling] roster update failed:', err);
      toast({ title: 'Error', description: err.message || 'Could not update roster.', variant: 'error' });
    }
  };

  const removeFromRoster = async (sched) => {
    if (!sched) return;
    try { await deleteSchedule(sched.id); }
    catch (err) { console.error('[scheduling] remove failed:', err); }
  };

  const setMyAvailability = async (col, status) => {
    try { await setStatus(col.date, status); }
    catch (err) { console.error('[scheduling] availability failed:', err); }
  };
  const clearMyAvailability = async (col) => {
    try { await clearStatus(col.date); }
    catch (err) { console.error('[scheduling] clear availability failed:', err); }
  };

  // --- active cell context -------------------------------------------------
  const active = activeCell
    ? {
        member: sortedMembers.find(m => m.user_id === activeCell.memberId),
        col: columns.find(c => c.id === activeCell.columnId),
      }
    : null;
  const activeSched = active?.col ? scheduleFor(active.member.user_id, active.col) : null;
  const activeIsMe = active && active.member.user_id === user?.id;
  const canRosterActive = active && canManageRoster && active.col.type === 'service';
  const roleOptions = active
    ? [...new Set([
        ...((active.member.instruments && active.member.instruments.length) ? active.member.instruments : INSTRUMENT_OPTIONS),
        ...INSTRUMENT_OPTIONS,
        ...(activeSched?.role ? [activeSched.role] : []),
      ])]
    : [];

  const colHeader = (c) => {
    const d = new Date(`${c.date}T00:00:00`);
    return {
      wd: d.toLocaleDateString('en-US', { weekday: 'short' }),
      day: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  };

  return (
    <div data-theme-variant="modes" className="relative h-full overflow-y-auto">
      <PageHeader title="Scheduling" onBack={onBack} />

      <div className="w-full max-w-[1320px] mx-auto px-5 sm:px-8 pt-6 pb-28 flex flex-col gap-4">
        <p className="text-copy-13 text-[var(--modes-text-muted)] m-0">
          {canManageRoster
            ? 'Every Sunday this year, plus your scheduled services. Tap a cell to assign a role/vocal or mark your own availability.'
            : 'Every Sunday this year, plus your team’s services. Tap a cell on your own row to set your availability.'}
        </p>

        <div className="modes-card overflow-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          <table className="border-collapse w-full" style={{ minWidth: 'max-content' }}>
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-30 bg-[var(--ds-background-200)] border-b border-r border-[var(--modes-border)] text-left px-3 py-2.5 text-label-12 uppercase tracking-wider font-bold text-[var(--modes-text-muted)]" style={{ minWidth: 168 }}>
                  Member
                </th>
                {columns.map(c => {
                  const h = colHeader(c);
                  return (
                    <th key={c.id} className="sticky top-0 z-20 bg-[var(--ds-background-200)] border-b border-r border-[var(--modes-border)] px-2 py-2 align-bottom" style={{ minWidth: 134 }}>
                      {c.type === 'service' ? (
                        <button
                          type="button"
                          onClick={() => onOpenSetlist?.(c.sl)}
                          className="w-full text-left bg-transparent border-none cursor-pointer p-0 group"
                        >
                          <div className="text-label-11 font-semibold uppercase tracking-wide text-[var(--color-brand)]">{h.wd} · {h.day}</div>
                          <div className="text-copy-13 font-semibold text-[var(--modes-text)] truncate group-hover:underline">{c.name}</div>
                        </button>
                      ) : (
                        <div className="w-full text-left">
                          <div className="text-label-11 font-semibold uppercase tracking-wide text-[var(--modes-text-muted)]">{h.wd} · {h.day}</div>
                          {onAddSetlist ? (
                            <button
                              type="button"
                              onClick={() => onAddSetlist(c.date)}
                              className="inline-flex items-center gap-1 text-copy-13 font-semibold text-[var(--color-brand)] bg-transparent border-none cursor-pointer p-0 hover:underline"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                              Add setlist
                            </button>
                          ) : (
                            <div className="text-copy-13 text-[var(--modes-text-muted)]">No service</div>
                          )}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedMembers.map(member => {
                const name = member.profile?.display_name || member.profile?.email?.split('@')[0] || 'Member';
                const isMe = member.user_id === user?.id;
                return (
                  <tr key={member.user_id}>
                    <td className="sticky left-0 z-10 bg-[var(--ds-background-100)] border-b border-r border-[var(--modes-border)] px-3 py-2" style={{ minWidth: 168 }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-[var(--ds-gray-200)] flex items-center justify-center text-label-11 font-bold shrink-0 overflow-hidden">
                          {member.profile?.avatar_url
                            ? <img src={member.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                            : name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-copy-13 font-semibold text-[var(--modes-text)] truncate">
                          {name}{isMe ? ' (you)' : ''}
                        </span>
                      </div>
                    </td>
                    {columns.map(col => {
                      const sched = scheduleFor(member.user_id, col);
                      const avail = availFor(member.user_id, col.date);
                      const canRoster = canManageRoster && col.type === 'service';
                      const canEdit = canRoster || isMe;
                      return (
                        <td key={col.id} className="border-b border-r border-[var(--modes-border)] p-1 align-middle">
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => setActiveCell({ memberId: member.user_id, columnId: col.id })}
                            className={`w-full min-h-[42px] rounded-lg px-2 py-1.5 flex flex-col items-center justify-center gap-1 text-center transition-colors ${
                              canEdit ? 'cursor-pointer hover:bg-[var(--modes-surface)]' : 'cursor-default'
                            }`}
                          >
                            {sched?.role && (
                              <span className="text-label-12 font-semibold px-2 py-0.5 rounded-full bg-[var(--ds-purple-100)] text-[var(--ds-purple-800)] border border-[var(--ds-purple-400)] max-w-full truncate">
                                {sched.role}
                              </span>
                            )}
                            {sched?.vocal_part && (
                              <span className="text-label-12 font-medium px-2 py-0.5 rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand)] max-w-full truncate">
                                {sched.vocal_part}
                              </span>
                            )}
                            {!sched?.role && !sched?.vocal_part && (
                              sched ? (
                                <span className="text-label-12 font-medium px-2 py-0.5 rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand)]">Rostered</span>
                              ) : avail ? (
                                <span className={`text-label-12 font-medium px-2 py-0.5 rounded-full ${availClasses(avail)}`}>
                                  {avail.charAt(0).toUpperCase() + avail.slice(1)}
                                </span>
                              ) : (
                                <span className="text-copy-14 text-[var(--ds-gray-500)]">{canEdit ? '+' : '·'}</span>
                              )
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {active && active.member && active.col && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px] p-0 sm:p-4"
          onClick={() => setActiveCell(null)}
        >
          <div
            className="w-full sm:max-w-sm bg-[var(--ds-background-100)] border border-[var(--ds-gray-300)] rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-4 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h3 className="text-heading-18 font-bold text-[var(--ds-gray-1000)] m-0">
                {active.member.profile?.display_name || active.member.profile?.email?.split('@')[0] || 'Member'}
              </h3>
              <p className="text-copy-13 text-[var(--ds-gray-600)] m-0 mt-0.5">
                {(active.col.type === 'service' ? active.col.name : 'Sunday')} · {colHeader(active.col).wd} {colHeader(active.col).day}
              </p>
            </div>

            {canRosterActive && (
              <>
                <div className="flex flex-col gap-2">
                  <span className="text-label-11 uppercase tracking-wider font-bold text-[var(--ds-gray-600)]">Instrument</span>
                  <div className="flex flex-wrap gap-1.5">
                    {roleOptions.map(role => {
                      const selected = activeSched?.role === role;
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => patchSchedule(active.member, active.col, { role: selected ? null : role })}
                          className={`text-label-12 font-medium px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
                            selected
                              ? 'bg-[var(--ds-purple-100)] text-[var(--ds-purple-800)] border-[var(--ds-purple-400)]'
                              : 'bg-transparent text-[var(--ds-gray-700)] border-[var(--ds-gray-300)] hover:border-[var(--ds-gray-500)]'
                          }`}
                        >
                          {role}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-label-11 uppercase tracking-wider font-bold text-[var(--ds-gray-600)]">Vocals</span>
                  <div className="flex flex-wrap gap-1.5">
                    {VOCAL_PARTS.map(part => {
                      const selected = activeSched?.vocal_part === part;
                      return (
                        <button
                          key={part}
                          type="button"
                          onClick={() => patchSchedule(active.member, active.col, { vocal_part: selected ? null : part })}
                          className={`text-label-12 font-medium px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
                            selected
                              ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand)] border-[var(--color-brand-border)]'
                              : 'bg-transparent text-[var(--ds-gray-700)] border-[var(--ds-gray-300)] hover:border-[var(--ds-gray-500)]'
                          }`}
                        >
                          {part}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {activeSched && (
                  <button
                    type="button"
                    onClick={() => { removeFromRoster(activeSched); setActiveCell(null); }}
                    className="self-start text-label-12 font-medium text-[var(--ds-red-700)] bg-transparent border-none cursor-pointer px-0 hover:underline"
                  >
                    Remove from roster
                  </button>
                )}
              </>
            )}

            {activeIsMe && (
              <div className="flex flex-col gap-2">
                <span className="text-label-11 uppercase tracking-wider font-bold text-[var(--ds-gray-600)]">My availability</span>
                <div className="flex flex-wrap gap-1.5">
                  {['available', 'maybe', 'unavailable'].map(st => {
                    const selected = availFor(active.member.user_id, active.col.date) === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setMyAvailability(active.col, st)}
                        className={`text-label-12 font-medium px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
                          selected
                            ? `${availClasses(st)} border-transparent`
                            : 'bg-transparent text-[var(--ds-gray-700)] border-[var(--ds-gray-300)] hover:border-[var(--ds-gray-500)]'
                        }`}
                      >
                        {st.charAt(0).toUpperCase() + st.slice(1)}
                      </button>
                    );
                  })}
                  {availFor(active.member.user_id, active.col.date) && (
                    <button
                      type="button"
                      onClick={() => clearMyAvailability(active.col)}
                      className="text-label-12 font-medium px-2.5 py-1 rounded-full border border-[var(--ds-gray-300)] text-[var(--ds-gray-600)] bg-transparent cursor-pointer hover:border-[var(--ds-gray-500)]"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}

            {active.col.type === 'empty' && onAddSetlist && (
              <button
                type="button"
                onClick={() => { onAddSetlist(active.col.date); setActiveCell(null); }}
                className="self-start inline-flex items-center gap-1.5 text-label-12 font-semibold text-[var(--color-brand)] bg-transparent border-none cursor-pointer px-0 hover:underline"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                Add a setlist for this Sunday
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveCell(null)}
              className="self-stretch mt-1 text-copy-14 font-semibold text-[var(--ds-gray-700)] bg-[var(--ds-gray-100)] rounded-lg py-2.5 border-none cursor-pointer hover:bg-[var(--ds-gray-200)]"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
