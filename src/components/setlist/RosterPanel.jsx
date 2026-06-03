import { useMemo, useState } from 'react';
import { useTeam } from '../../auth/useTeam';
import { useTeamSchedules } from '../../hooks/useTeamSchedules';
import { useTeamAvailability } from '../../hooks/useTeamAvailability';
import { useTeamSetlistMap } from '../../hooks/useTeamSetlistMap';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { IconButton } from '../ui/IconButton';
import { toast } from '../ui/use-toast';
import { useConfirm } from '../ui/useConfirmHook';

const PREDEFINED_ROLES = [
  "Acoustic Guitar",
  "Electric Guitar",
  "Bass",
  "Drums",
  "Keys",
  "Vocals",
  "Lead Vocal",
  "Piano"
];

// Sort priority: available (0) → unknown (1) → maybe (2) → unavailable (3).
const AVAIL_RANK = { available: 0, maybe: 2, unavailable: 3 };

function availabilityBadgeClasses(status) {
  if (status === 'available') return 'bg-[var(--ds-green-100)] text-[var(--ds-green-800)]';
  if (status === 'unavailable') return 'bg-[var(--ds-red-100)] text-[var(--ds-red-800)]';
  if (status === 'maybe') return 'bg-[var(--ds-orange-100)] text-[var(--ds-orange-800)]';
  return 'bg-[var(--ds-gray-200)] text-[var(--ds-gray-600)]';
}

function availabilityLabel(status) {
  if (!status) return '—';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function RosterPanel({ setlistId, setlistDate, onClose, readOnly = false, inline = false }) {
  const confirm = useConfirm();
  const { team, members } = useTeam();
  const { schedules, createSchedule, updateSchedule, deleteSchedule, loading } = useTeamSchedules(team?.id);
  const { availability } = useTeamAvailability(team?.id);
  const { map: setlistIdMap } = useTeamSetlistMap(team?.id);

  const teamSetlistId = setlistIdMap[setlistId] || null;

  const [addingMemberId, setAddingMemberId] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [instrumentFilter, setInstrumentFilter] = useState(null);

  // The ID used for DB operations (team_schedules.setlist_id is a UUID FK to
  // team_setlists.id). Local setlists use base-36 IDs from generateId(), so
  // we need the mapped UUID. Fall back to the local ID only if no mapping
  // exists (shouldn't happen in practice for synced team setlists).
  const dbSetlistId = teamSetlistId || setlistId;

  // Filter schedules for this specific setlist (match against the DB ID)
  const setlistSchedules = schedules.filter(s => s.setlist_id === dbSetlistId);

  // Members not yet on the roster
  const candidates = useMemo(() => {
    const onRoster = new Set(setlistSchedules.map(s => s.user_id));
    let list = members.filter(m => !onRoster.has(m.user_id));
    // Attach availability for the setlist's date.
    list = list.map(m => {
      const status = setlistDate
        ? availability.find(a => a.user_id === m.user_id && a.date === setlistDate)?.status || null
        : null;
      return { ...m, availStatus: status };
    });
    if (instrumentFilter) {
      list = list.filter(m => Array.isArray(m.instruments) && m.instruments.includes(instrumentFilter));
    }
    list.sort((a, b) => {
      const ra = a.availStatus ? AVAIL_RANK[a.availStatus] ?? 1 : 1;
      const rb = b.availStatus ? AVAIL_RANK[b.availStatus] ?? 1 : 1;
      if (ra !== rb) return ra - rb;
      const an = a.profile?.display_name || a.profile?.email || '';
      const bn = b.profile?.display_name || b.profile?.email || '';
      return an.localeCompare(bn);
    });
    return list;
  }, [members, setlistSchedules, availability, setlistDate, instrumentFilter]);

  // Set of distinct instruments across all team members for the filter chips.
  const allInstruments = useMemo(() => {
    const set = new Set();
    members.forEach(m => (m.instruments || []).forEach(i => set.add(i)));
    return Array.from(set).sort();
  }, [members]);

  const handleAddMember = async (member) => {
    if (!member?.user_id || isAdding) return;
    if (!teamSetlistId) {
      console.warn('[roster] No team setlist UUID for local id:', setlistId);
      toast({ title: 'Sync required', description: 'This setlist needs to sync to the team library before you can manage the roster. Try switching to the team library and syncing first.', variant: 'error' });
      return;
    }
    setIsAdding(true);
    setAddingMemberId(member.user_id);
    try {
      const defaultRole = (member.instruments && member.instruments[0]) || 'Vocals';
      await createSchedule(dbSetlistId, member.user_id, defaultRole, 'pending');
      toast({ title: 'Added to roster', description: 'Member has been scheduled.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: err.message || 'Could not add member to roster.', variant: 'error' });
    } finally {
      setIsAdding(false);
      setAddingMemberId('');
    }
  };

  const handleUpdateRole = async (scheduleId, role) => {
    try {
      await updateSchedule(scheduleId, { role });
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemove = async (scheduleId) => {
    const ok = await confirm({
      title: 'Remove from roster?',
      description: 'They will be unassigned from this setlist. You can add them again later.',
      confirmLabel: 'Remove',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteSchedule(scheduleId);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className={inline
      ? 'flex flex-col bg-transparent w-full'
      : 'flex flex-col h-full bg-[var(--ds-background-100)] border-l border-[var(--ds-gray-300)] w-[360px] max-w-full'}>
      {!inline && (
        <div className="p-4 border-b border-[var(--ds-gray-300)] flex items-center justify-between">
          <h3 className="text-heading-18 font-bold m-0">{readOnly ? 'Roster' : 'Setlist Roster'}</h3>
          <IconButton size="sm" onClick={onClose} aria-label="Close roster">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </IconButton>
        </div>
      )}

      <div className={inline ? 'flex flex-col gap-6' : 'flex-1 overflow-y-auto p-4 flex flex-col gap-6'}>
        {loading && schedules.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-copy-14 text-[var(--ds-gray-500)]">Loading roster...</span>
          </div>
        ) : (
          <>
            {/* Current Roster */}
            <div className="flex flex-col gap-3">
              <p className="text-label-12 text-[var(--ds-gray-600)] uppercase tracking-wider font-bold">Scheduled Team</p>

              {setlistSchedules.length === 0 && (
                <p className="text-copy-14 text-[var(--ds-gray-500)] italic py-4 text-center">
                  No one is scheduled yet.
                </p>
              )}

              {setlistSchedules.map(schedule => {
                const member = members.find(m => m.user_id === schedule.user_id);
                const displayName = member?.profile?.display_name || member?.profile?.email || 'Unknown User';
                const avatarUrl = member?.profile?.avatar_url;

                return (
                  <div key={schedule.id} className="p-3 rounded-xl bg-[var(--ds-background-200)] border border-[var(--ds-gray-300)] flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[var(--ds-gray-200)] flex items-center justify-center text-label-12 font-bold shrink-0 overflow-hidden">
                          {avatarUrl
                            ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                            : (displayName.slice(0, 2).toUpperCase() || '?')}
                        </div>
                        <div className="flex flex-col min-w-0">
                        <span className="text-copy-14 font-bold truncate">{displayName}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-label-11 px-2 py-0.5 rounded-full ${availabilityBadgeClasses(schedule.availability)}`}>
                            {availabilityLabel(schedule.availability)}
                          </span>
                          {readOnly && schedule.role && (
                            <span className="text-label-11 px-2 py-0.5 rounded-full bg-[var(--ds-gray-100)] text-[var(--ds-gray-700)]">
                              {schedule.role}
                            </span>
                          )}
                        </div>
                        </div>
                      </div>
                      {!readOnly && (
                        <IconButton size="sm" onClick={() => handleRemove(schedule.id)} variant="ghost" className="text-[var(--ds-gray-400)] hover:text-[var(--ds-red-600)]">
                          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </IconButton>
                      )}
                    </div>

                    {!readOnly && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-label-11 text-[var(--ds-gray-600)] uppercase font-semibold">Role</span>
                        <div className="flex flex-col gap-1">
                          {(() => {
                            let availableRoles = (member?.instruments && member.instruments.length > 0)
                              ? [...member.instruments]
                              : [...PREDEFINED_ROLES];
                            
                            // Ensure current role is in the list if it matches a predefined one,
                            // or it will fall into 'custom'.
                            const isCustom = schedule.role && !availableRoles.includes(schedule.role);
                            
                            return (
                              <>
                                <select
                                  className="w-full bg-[var(--ds-background-100)] border border-[var(--ds-gray-300)] rounded-md text-copy-13 px-2 py-1 outline-none"
                                  value={isCustom ? 'custom' : (schedule.role || '')}
                                  onChange={(e) => {
                                    if (e.target.value !== 'custom') {
                                      handleUpdateRole(schedule.id, e.target.value);
                                    }
                                  }}
                                >
                                  <option value="" disabled>Select role...</option>
                                  {availableRoles.map(role => (
                                    <option key={role} value={role}>{role}</option>
                                  ))}
                                  <option value="custom">Custom...</option>
                                </select>

                                {isCustom && (
                                  <Input
                                    size="sm"
                                    placeholder="Enter custom role"
                                    value={schedule.role === 'custom' ? '' : (schedule.role || '')}
                                    onChange={(e) => handleUpdateRole(schedule.id, e.target.value)}
                                    className="mt-1"
                                  />
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add Member — admins only */}
            {!readOnly && (
              <div className="flex flex-col gap-3">
                <p className="text-label-12 text-[var(--ds-gray-600)] uppercase tracking-wider font-bold">Add to Roster</p>

                {!setlistDate && (
                  <p className="text-copy-12 text-[var(--ds-orange-700)] bg-[var(--ds-orange-100)] px-3 py-2 rounded-lg">
                    Set a date for this setlist to see who's available.
                  </p>
                )}

                {allInstruments.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setInstrumentFilter(null)}
                      className={`text-label-11 px-2 py-0.5 rounded-full border cursor-pointer ${
                        instrumentFilter === null
                          ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white'
                          : 'bg-transparent border-[var(--ds-gray-300)] text-[var(--ds-gray-700)]'
                      }`}
                    >
                      All
                    </button>
                    {allInstruments.map(inst => (
                      <button
                        key={inst}
                        type="button"
                        onClick={() => setInstrumentFilter(inst === instrumentFilter ? null : inst)}
                        className={`text-label-11 px-2 py-0.5 rounded-full border cursor-pointer ${
                          inst === instrumentFilter
                            ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white'
                            : 'bg-transparent border-[var(--ds-gray-300)] text-[var(--ds-gray-700)]'
                        }`}
                      >
                        {inst}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {candidates.length > 0 ? (
                    candidates.map(member => (
                      <div
                        key={member.id}
                        className="flex items-start justify-between gap-2 p-2 hover:bg-[var(--ds-gray-100)] rounded-lg cursor-pointer group"
                        onClick={() => handleAddMember(member)}
                      >
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-full bg-[var(--ds-gray-200)] flex items-center justify-center text-label-12 font-bold shrink-0 overflow-hidden">
                            {member.profile?.avatar_url
                              ? <img src={member.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                              : (member.profile?.display_name?.slice(0, 2).toUpperCase() || '?')}
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-copy-14 truncate">
                                {member.profile?.display_name || member.profile?.email || 'Member'}
                              </span>
                              {setlistDate && (
                                <span className={`text-label-11 px-1.5 py-0.5 rounded-full shrink-0 ${availabilityBadgeClasses(member.availStatus)}`}>
                                  {availabilityLabel(member.availStatus)}
                                </span>
                              )}
                            </div>
                            {member.instruments && member.instruments.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {member.instruments.map(inst => (
                                  <span
                                    key={inst}
                                    className="text-label-11 px-1.5 py-0.5 rounded-full bg-[var(--ds-gray-100)] text-[var(--ds-gray-700)]"
                                  >
                                    {inst}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          size="xs"
                          variant="ghost"
                          className={`shrink-0 ${isAdding && addingMemberId === member.user_id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                          disabled={isAdding && addingMemberId === member.user_id}
                        >
                          {isAdding && addingMemberId === member.user_id ? 'Adding...' : 'Add'}
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-copy-13 text-[var(--ds-gray-500)] py-2">
                      {instrumentFilter ? `No available members play ${instrumentFilter}.` : 'All members are scheduled.'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="p-4 border-t border-[var(--ds-gray-300)] bg-[var(--ds-background-200)]">
        <p className="text-label-11 text-[var(--ds-gray-500)] text-center">
          {readOnly
            ? 'Members will see their assignments on their dashboard calendar.'
            : 'Members will see their assignments on their dashboard calendar.'}
        </p>
      </div>
    </div>
  );
}
