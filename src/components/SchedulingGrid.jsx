import { useMemo, useState } from 'react';
import PageHeader from './ui/PageHeader';
import { useTeam } from '../auth/useTeam';
import { useAuth } from '../auth/useAuth';
import { useTeamSchedules } from '../hooks/useTeamSchedules';
import { useTeamAvailability } from '../hooks/useTeamAvailability';
import { useTeamSetlistMap } from '../hooks/useTeamSetlistMap';
import { toast } from './ui/use-toast';

// Standard instruments offered when a member hasn't declared their own. Mirrors
// RosterPanel's list (team_schedules.role holds the assigned instrument).
const INSTRUMENT_OPTIONS = [
  'Acoustic Guitar', 'Electric Guitar', 'Bass', 'Drums', 'Keys', 'Piano',
];

const HORIZONS = [
  { value: 4, label: '4 wks' },
  { value: 8, label: '8 wks' },
  { value: 12, label: '12 wks' },
];

// Availability colour language — shared with the rest of the app:
// green = available, amber = maybe, red = unavailable.
function availClasses(status) {
  if (status === 'available') return 'bg-[var(--ds-green-100)] text-[var(--ds-green-800)]';
  if (status === 'unavailable') return 'bg-[var(--ds-red-100)] text-[var(--ds-red-800)]';
  if (status === 'maybe') return 'bg-[var(--ds-amber-100)] text-[var(--ds-amber-900)]';
  return 'text-[var(--ds-gray-500)]';
}

function availDot(status) {
  if (status === 'available') return 'bg-[var(--ds-green-500)]';
  if (status === 'unavailable') return 'bg-[var(--ds-red-600)]';
  if (status === 'maybe') return 'bg-[var(--ds-amber-500)]';
  if (status === 'pending') return 'bg-[var(--color-brand)]';
  return 'bg-transparent';
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

export default function SchedulingGrid({ setlists, onBack, onOpenSetlist }) {
  const { team, members, canManageRoster } = useTeam();
  const { user } = useAuth();
  const { schedules, createSchedule, updateSchedule, deleteSchedule } = useTeamSchedules(team?.id);
  const { availability, setStatus, clearStatus } = useTeamAvailability(team?.id);
  const { map: setlistIdMap } = useTeamSetlistMap(team?.id);

  const [weeksAhead, setWeeksAhead] = useState(8);
  const [activeCell, setActiveCell] = useState(null); // { memberId, serviceId }

  // Columns are data-driven: every dated team setlist in the window becomes a
  // service column. This handles AM-only / AM+PM / midweek for free.
  const services = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today); start.setDate(start.getDate() - 2);
    const end = new Date(today); end.setDate(end.getDate() + weeksAhead * 7);
    return setlists
      .filter(sl => sl.date)
      .map(sl => ({
        id: sl.id,
        dbId: setlistIdMap[sl.id] || null,
        name: sl.name || 'Untitled',
        date: sl.date,
        time: sl.time || '',
        sl,
        ts: new Date(`${sl.date}T${sl.time || '00:00'}:00`),
      }))
      .filter(s => {
        const d = new Date(`${s.date}T00:00:00`);
        return d >= start && d <= end;
      })
      .sort((a, b) => a.ts - b.ts);
  }, [setlists, setlistIdMap, weeksAhead]);

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const an = a.profile?.display_name || a.profile?.email || '';
      const bn = b.profile?.display_name || b.profile?.email || '';
      return an.localeCompare(bn);
    });
  }, [members]);

  if (!team) return <TeamFeatureNotice onBack={onBack} />;

  const scheduleFor = (memberId, service) =>
    service.dbId ? schedules.find(s => s.setlist_id === service.dbId && s.user_id === memberId) : null;
  const availFor = (memberId, dateStr) =>
    availability.find(a => a.user_id === memberId && a.date === dateStr)?.status || null;

  // --- mutations -----------------------------------------------------------
  const assignRole = async (member, service, role) => {
    if (!service.dbId) {
      toast({ title: 'Sync required', description: 'This service must sync to the team library before you can roster it.', variant: 'error' });
      return;
    }
    try {
      const existing = scheduleFor(member.user_id, service);
      if (existing) await updateSchedule(existing.id, { role: role || null });
      else await createSchedule(service.dbId, member.user_id, role || null, 'pending');
    } catch (err) {
      console.error('[scheduling] assign role failed:', err);
      toast({ title: 'Error', description: err.message || 'Could not update roster.', variant: 'error' });
    }
  };

  const removeFromRoster = async (sched) => {
    if (!sched) return;
    try { await deleteSchedule(sched.id); }
    catch (err) { console.error('[scheduling] remove failed:', err); }
  };

  const setMyAvailability = async (service, status) => {
    try { await setStatus(service.date, status); }
    catch (err) { console.error('[scheduling] availability failed:', err); }
  };

  const clearMyAvailability = async (service) => {
    try { await clearStatus(service.date); }
    catch (err) { console.error('[scheduling] clear availability failed:', err); }
  };

  // --- active cell context -------------------------------------------------
  const active = activeCell
    ? {
        member: sortedMembers.find(m => m.user_id === activeCell.memberId),
        service: services.find(s => s.id === activeCell.serviceId),
      }
    : null;
  const activeSched = active ? scheduleFor(active.member.user_id, active.service) : null;
  const activeIsMe = active && active.member.user_id === user?.id;
  const roleOptions = active
    ? [...new Set([
        ...((active.member.instruments && active.member.instruments.length) ? active.member.instruments : INSTRUMENT_OPTIONS),
        ...INSTRUMENT_OPTIONS,
        ...(activeSched?.role ? [activeSched.role] : []),
      ])]
    : [];

  const colHeader = (s) => {
    const d = new Date(`${s.date}T00:00:00`);
    return {
      wd: d.toLocaleDateString('en-US', { weekday: 'short' }),
      day: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  };

  return (
    <div data-theme-variant="modes" className="relative h-full overflow-y-auto">
      <PageHeader
        title="Scheduling"
        onBack={onBack}
        actions={
          <div className="flex items-center gap-1 rounded-lg bg-[var(--modes-surface)] p-0.5">
            {HORIZONS.map(h => (
              <button
                key={h.value}
                type="button"
                onClick={() => setWeeksAhead(h.value)}
                className={`text-label-12 font-semibold px-2.5 py-1 rounded-md cursor-pointer border-none transition-colors ${
                  weeksAhead === h.value
                    ? 'bg-[var(--ds-background-100)] text-[var(--modes-text)]'
                    : 'bg-transparent text-[var(--modes-text-muted)]'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="w-full max-w-[1320px] mx-auto px-5 sm:px-8 pt-6 pb-28 flex flex-col gap-4">
        <p className="text-copy-13 text-[var(--modes-text-muted)] m-0">
          {canManageRoster
            ? 'Tap a cell to assign a role or mark your own availability. Roles show in purple; availability uses green / amber / red.'
            : 'Tap a cell on your own row to set your availability. Roles your leader assigns show in purple.'}
        </p>

        {services.length === 0 ? (
          <div className="modes-card p-8 text-center">
            <p className="text-copy-14 text-[var(--modes-text-muted)] m-0">
              No services in this window. Add a dated setlist, or widen the range.
            </p>
          </div>
        ) : (
          <div className="modes-card overflow-auto" style={{ maxHeight: 'calc(100vh - 230px)' }}>
            <table className="border-collapse w-full" style={{ minWidth: 'max-content' }}>
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 z-30 bg-[var(--ds-background-200)] border-b border-r border-[var(--modes-border)] text-left px-3 py-2.5 text-label-12 uppercase tracking-wider font-bold text-[var(--modes-text-muted)]" style={{ minWidth: 168 }}>
                    Member
                  </th>
                  {services.map(s => {
                    const h = colHeader(s);
                    return (
                      <th key={s.id} className="sticky top-0 z-20 bg-[var(--ds-background-200)] border-b border-r border-[var(--modes-border)] px-2 py-2 align-bottom" style={{ minWidth: 132 }}>
                        <button
                          type="button"
                          onClick={() => onOpenSetlist?.(s.sl)}
                          className="w-full text-left bg-transparent border-none cursor-pointer p-0 group"
                        >
                          <div className="text-label-11 font-semibold uppercase tracking-wide text-[var(--color-brand)]">{h.wd} · {h.day}</div>
                          <div className="text-copy-13 font-semibold text-[var(--modes-text)] truncate group-hover:underline">{s.name}</div>
                        </button>
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
                      {services.map(service => {
                        const sched = scheduleFor(member.user_id, service);
                        const avail = availFor(member.user_id, service.date);
                        const canEdit = canManageRoster || isMe;
                        return (
                          <td key={service.id} className="border-b border-r border-[var(--modes-border)] p-1 align-middle">
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => setActiveCell({ memberId: member.user_id, serviceId: service.id })}
                              className={`w-full min-h-[42px] rounded-lg px-2 py-1.5 flex items-center justify-center text-center transition-colors ${
                                canEdit ? 'cursor-pointer hover:bg-[var(--modes-surface)]' : 'cursor-default'
                              }`}
                            >
                              {sched?.role ? (
                                <span className="inline-flex items-center gap-1.5 text-label-12 font-semibold px-2 py-0.5 rounded-full bg-[var(--ds-purple-100)] text-[var(--ds-purple-800)] border border-[var(--ds-purple-400)] max-w-full">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${availDot(sched.availability)}`} />
                                  <span className="truncate">{sched.role}</span>
                                </span>
                              ) : sched ? (
                                <span className="inline-flex items-center gap-1.5 text-label-12 font-medium px-2 py-0.5 rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
                                  <span className={`w-1.5 h-1.5 rounded-full ${availDot(sched.availability)}`} />
                                  Rostered
                                </span>
                              ) : avail ? (
                                <span className={`text-label-12 font-medium px-2 py-0.5 rounded-full ${availClasses(avail)}`}>
                                  {avail.charAt(0).toUpperCase() + avail.slice(1)}
                                </span>
                              ) : (
                                <span className="text-copy-14 text-[var(--ds-gray-500)]">{canEdit ? '+' : '·'}</span>
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
        )}
      </div>

      {active && active.member && active.service && (
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
                {active.service.name} · {colHeader(active.service).wd} {colHeader(active.service).day}
              </p>
            </div>

            {canManageRoster && (
              <div className="flex flex-col gap-2">
                <span className="text-label-11 uppercase tracking-wider font-bold text-[var(--ds-gray-600)]">Role</span>
                <div className="flex flex-wrap gap-1.5">
                  {roleOptions.map(role => {
                    const selected = activeSched?.role === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => assignRole(active.member, active.service, role)}
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
                {activeSched && (
                  <button
                    type="button"
                    onClick={() => { removeFromRoster(activeSched); setActiveCell(null); }}
                    className="self-start text-label-12 font-medium text-[var(--ds-red-700)] bg-transparent border-none cursor-pointer px-0 hover:underline"
                  >
                    Remove from roster
                  </button>
                )}
              </div>
            )}

            {activeIsMe && (
              <div className="flex flex-col gap-2">
                <span className="text-label-11 uppercase tracking-wider font-bold text-[var(--ds-gray-600)]">My availability</span>
                <div className="flex flex-wrap gap-1.5">
                  {['available', 'maybe', 'unavailable'].map(st => {
                    const selected = availFor(active.member.user_id, active.service.date) === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setMyAvailability(active.service, st)}
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
                  {availFor(active.member.user_id, active.service.date) && (
                    <button
                      type="button"
                      onClick={() => clearMyAvailability(active.service)}
                      className="text-label-12 font-medium px-2.5 py-1 rounded-full border border-[var(--ds-gray-300)] text-[var(--ds-gray-600)] bg-transparent cursor-pointer hover:border-[var(--ds-gray-500)]"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
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
