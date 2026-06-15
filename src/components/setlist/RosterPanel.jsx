import { useMemo, useState } from 'react';
import { useTeam } from '../../auth/useTeam';
import { useTeamSchedules } from '../../hooks/useTeamSchedules';
import { useTeamAvailability } from '../../hooks/useTeamAvailability';
import { useTeamSetlistMap } from '../../hooks/useTeamSetlistMap';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { toast } from '../ui/use-toast';
import { useConfirm } from '../ui/useConfirmHook';

// Instrument is the team_schedules.role column; vocal part is a separate
// column so a person can have both (e.g. Electric Guitar + Backing).
const INSTRUMENT_OPTIONS = [
  "Acoustic Guitar",
  "Electric Guitar",
  "Bass",
  "Drums",
  "Keys",
  "Piano",
];

const VOCAL_PARTS = [
  "Lead male",
  "Lead female",
  "Soprano",
  "Alto",
  "Tenor",
  "Bass",
  "Backing",
];

// Sort priority: available (0) → unknown (1) → maybe (2) → unavailable (3).
const AVAIL_RANK = { available: 0, maybe: 2, unavailable: 3 };

function availabilityBadgeClasses(status) {
  if (status === 'available') return 'bg-[var(--ds-green-100)] text-[var(--ds-green-800)]';
  if (status === 'unavailable') return 'bg-[var(--ds-red-100)] text-[var(--ds-red-800)]';
  if (status === 'maybe') return 'bg-[var(--ds-amber-100)] text-[var(--ds-amber-900)]';
  return 'bg-[var(--ds-gray-200)] text-[var(--ds-gray-600)]';
}

// Solid status dot overlaid on the avatar — same semantics as the badge.
function availabilityDotClasses(status) {
  if (status === 'available') return 'bg-[var(--ds-green-700)]';
  if (status === 'unavailable') return 'bg-[var(--ds-red-700)]';
  if (status === 'maybe') return 'bg-[var(--ds-amber-700)]';
  return 'bg-[var(--ds-gray-400)]';
}

function availabilityLabel(status) {
  if (!status) return '—';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function RosterPanel({ setlistId, setlistDate, onClose, readOnly = false, inline = false, v2 = false }) {
  const confirm = useConfirm();
  const { team, members } = useTeam();
  const { schedules, createSchedule, updateSchedule, deleteSchedule, loading } = useTeamSchedules(team?.id);
  const { availability } = useTeamAvailability(team?.id);
  const { map: setlistIdMap } = useTeamSetlistMap(team?.id);

  const teamSetlistId = setlistIdMap[setlistId] || null;

  const [addingMemberId, setAddingMemberId] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [instrumentFilter, setInstrumentFilter] = useState(null);
  // v2-only: search + "available only" filter for the add list, and which
  // scheduled card has its inline edit (instrument/vocal) disclosure open.
  const [search, setSearch] = useState('');
  const [availOnly, setAvailOnly] = useState(false);
  const [editingId, setEditingId] = useState(null);
  // Section labels: v2 uses Title Case; v1 keeps the existing upper-case style.
  const bandLabel = v2 ? 'The Band' : 'THE BAND';
  const addLabel = v2 ? 'Add to the Band' : 'ADD TO THE BAND';
  const labelClass = `text-label-13 text-[var(--ds-gray-700)] ${v2 ? 'font-bold' : 'uppercase tracking-wider font-bold'} m-0`;

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

  // v2 add-list refinements: free-text search + an "available only" toggle.
  const visibleCandidates = useMemo(() => {
    if (!v2) return candidates;
    const q = search.trim().toLowerCase();
    return candidates.filter(m => {
      if (availOnly && m.availStatus !== 'available') return false;
      if (!q) return true;
      const name = (m.profile?.display_name || m.profile?.email || '').toLowerCase();
      return name.includes(q);
    });
  }, [candidates, v2, search, availOnly]);

  // Set of distinct instruments across all team members for the filter chips.
  const allInstruments = useMemo(() => {
    const set = new Set();
    members.forEach(m => (m.instruments || []).forEach(i => set.add(i)));
    return Array.from(set).sort();
  }, [members]);

  const handleAddMember = async (member, role) => {
    if (!member?.user_id || isAdding) return;
    if (!teamSetlistId) {
      console.warn('[roster] No team setlist UUID for local id:', setlistId);
      toast({ title: 'Sync required', description: 'This setlist needs to sync to the team library before you can manage the roster. Try switching to the team library and syncing first.', variant: 'error' });
      return;
    }
    setIsAdding(true);
    setAddingMemberId(member.user_id);
    try {
      // Quick-assign (tapping an instrument) pre-fills that instrument; the
      // instrument tab also pre-fills; otherwise it's left for the leader.
      const defaultRole = role || instrumentFilter || null;
      await createSchedule(dbSetlistId, member.user_id, defaultRole, 'pending');
      toast({ title: 'Added to roster', description: role ? `Scheduled on ${role}.` : 'Member has been scheduled.' });
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

  const handleUpdateVocalPart = async (scheduleId, vocal_part) => {
    try {
      await updateSchedule(scheduleId, { vocal_part: vocal_part || null });
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
          <h3 className="text-heading-18 font-bold m-0">{readOnly ? 'Band' : 'Setlist Band'}</h3>
          <IconButton size="sm" onClick={onClose} aria-label="Close band">
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
              <p className={labelClass}>{bandLabel}</p>

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
                  <div key={schedule.id} className="rounded-xl bg-[var(--ds-background-200)] border border-[var(--ds-gray-300)] flex flex-col">
                    <div className="flex items-center gap-3 p-3">
                      {/* Avatar with an availability status dot overlaid. */}
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-[var(--ds-gray-200)] flex items-center justify-center text-label-13 font-bold overflow-hidden">
                          {avatarUrl
                            ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                            : (displayName.slice(0, 2).toUpperCase() || '?')}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--ds-background-200)] ${availabilityDotClasses(schedule.availability)}`}
                          title={availabilityLabel(schedule.availability)}
                          aria-hidden="true"
                        />
                      </div>

                      <div className="flex flex-col min-w-0 flex-1 gap-1">
                        <span className="text-copy-14 font-bold truncate leading-tight">{displayName}</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* v2: the avatar dot already carries availability, so
                              only surface the text pill when it needs attention
                              (anything other than a confirmed "available"). */}
                          {(!v2 || schedule.availability !== 'available') && (
                            <span className={`inline-flex items-center gap-1 text-label-11 px-2 py-0.5 rounded-full ${availabilityBadgeClasses(schedule.availability)}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" aria-hidden="true" />
                              {availabilityLabel(schedule.availability)}
                            </span>
                          )}
                          {(readOnly || v2) && schedule.role && (
                            <span className="text-label-11 px-2 py-0.5 rounded-full bg-[var(--ds-gray-100)] text-[var(--ds-gray-700)]">
                              {schedule.role}
                            </span>
                          )}
                          {(readOnly || v2) && schedule.vocal_part && (
                            <span className="text-label-11 px-2 py-0.5 rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-text)]">
                              {schedule.vocal_part}
                            </span>
                          )}
                          {v2 && !readOnly && !schedule.role && !schedule.vocal_part && (
                            <span className="text-label-11 text-[var(--ds-gray-500)] italic">No role yet</span>
                          )}
                        </div>
                      </div>

                      {!readOnly && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          {v2 && (
                            <IconButton
                              size="sm"
                              onClick={() => setEditingId(id => id === schedule.id ? null : schedule.id)}
                              variant={editingId === schedule.id ? 'active' : 'ghost'}
                              aria-label={editingId === schedule.id ? 'Done editing' : 'Edit role'}
                              title="Edit instrument & vocal"
                            >
                              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </IconButton>
                          )}
                          <IconButton size="sm" onClick={() => handleRemove(schedule.id)} variant="ghost" className="text-[var(--ds-gray-400)] hover:text-[var(--ds-red-600)]">
                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </IconButton>
                        </div>
                      )}
                    </div>

                    {!readOnly && (!v2 || editingId === schedule.id) && (
                      <div className="grid grid-cols-2 gap-2 px-3 pb-3 pt-3 border-t border-[var(--ds-gray-200)]">
                        <div className="flex flex-col gap-1">
                          <span className="text-label-11 text-[var(--ds-gray-600)] uppercase font-semibold">Instrument</span>
                          {(() => {
                            // Offer the member's declared instruments first, then
                            // the standard list; keep whatever's set even if custom.
                            const base = (member?.instruments && member.instruments.length > 0)
                              ? member.instruments
                              : INSTRUMENT_OPTIONS;
                            const opts = [...new Set([...base, ...INSTRUMENT_OPTIONS, ...(schedule.role ? [schedule.role] : [])])];
                            return (
                              <select
                                className="w-full bg-[var(--ds-background-100)] border border-[var(--ds-gray-300)] rounded-md text-copy-13 px-2 py-1 outline-none"
                                value={schedule.role || ''}
                                onChange={(e) => handleUpdateRole(schedule.id, e.target.value)}
                              >
                                <option value="">None</option>
                                {opts.map(role => (
                                  <option key={role} value={role}>{role}</option>
                                ))}
                              </select>
                            );
                          })()}
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-label-11 text-[var(--ds-gray-600)] uppercase font-semibold">Vocal part</span>
                          <select
                            className="w-full bg-[var(--ds-background-100)] border border-[var(--ds-gray-300)] rounded-md text-copy-13 px-2 py-1 outline-none"
                            value={schedule.vocal_part || ''}
                            onChange={(e) => handleUpdateVocalPart(schedule.id, e.target.value)}
                          >
                            <option value="">None</option>
                            {VOCAL_PARTS.map(part => (
                              <option key={part} value={part}>{part}</option>
                            ))}
                          </select>
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
                <p className={labelClass}>{addLabel}</p>

                {!setlistDate && (
                  <p className="text-copy-12 text-[var(--ds-orange-700)] bg-[var(--ds-orange-100)] px-3 py-2 rounded-lg">
                    Set a date for this setlist to see who's available.
                  </p>
                )}

                {/* v2: search the team + filter to only those who're available. */}
                {v2 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[160px]">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ds-gray-500)] pointer-events-none">
                        <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
                      </svg>
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search members…"
                        className="w-full h-9 pl-8 pr-3 rounded-lg bg-[var(--ds-background-100)] border border-[var(--ds-gray-300)] text-copy-13 outline-none focus:border-[var(--ds-gray-500)]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setAvailOnly(v => !v)}
                      disabled={!setlistDate}
                      className={`h-9 px-3 rounded-lg text-label-12 font-semibold border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        availOnly
                          ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white'
                          : 'bg-transparent border-[var(--ds-gray-300)] text-[var(--ds-gray-700)]'
                      }`}
                      title={setlistDate ? 'Show only members available on this date' : 'Set a date to filter by availability'}
                    >
                      Available only
                    </button>
                  </div>
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
                  {visibleCandidates.length > 0 ? (
                    visibleCandidates.map(member => {
                      const adding = isAdding && addingMemberId === member.user_id;
                      const rowAdd = () => handleAddMember(member);
                      // v2: tapping the whole row adds (using the active
                      // instrument filter as the role). When no filter is
                      // active, the member's own instruments show as quick
                      // chips so the leader can assign a specific one.
                      const showChips = v2 && !instrumentFilter && member.instruments && member.instruments.length > 0;
                      return (
                      <div
                        key={member.id}
                        className={`flex items-start justify-between gap-2 p-2 rounded-lg group cursor-pointer hover:bg-[var(--ds-gray-100)] ${adding ? 'opacity-60' : ''}`}
                        onClick={rowAdd}
                        {...(v2 ? { role: 'button', tabIndex: 0, onKeyDown: (e) => { if (e.key === 'Enter') rowAdd(); } } : {})}
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
                            {/* v1: static instrument tags */}
                            {!v2 && member.instruments && member.instruments.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {member.instruments.map(inst => (
                                  <span key={inst} className="text-label-11 px-1.5 py-0.5 rounded-full bg-[var(--ds-gray-100)] text-[var(--ds-gray-700)]">
                                    {inst}
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* v2: quick-assign chips (only when no instrument filter) */}
                            {showChips && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {member.instruments.map(inst => (
                                  <button
                                    key={inst}
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleAddMember(member, inst); }}
                                    disabled={isAdding}
                                    className="inline-flex items-center gap-0.5 text-label-11 px-2 py-0.5 rounded-full border border-[var(--ds-gray-300)] text-[var(--ds-gray-800)] cursor-pointer hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-colors disabled:opacity-50"
                                  >
                                    <span className="text-[13px] leading-none">+</span>{inst}
                                  </button>
                                ))}
                              </div>
                            )}
                            {v2 && !instrumentFilter && (!member.instruments || member.instruments.length === 0) && (
                              <span className="text-label-11 text-[var(--ds-gray-500)] italic mt-1">No instruments set</span>
                            )}
                          </div>
                        </div>

                        {v2 ? (
                          <span className="shrink-0 self-center text-[var(--ds-gray-400)] group-hover:text-[var(--color-brand)] transition-colors" aria-hidden="true">
                            {adding ? (
                              <span className="text-label-12 text-[var(--ds-gray-500)]">Adding…</span>
                            ) : (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>
                            )}
                          </span>
                        ) : (
                          <Button
                            size="xs"
                            variant="ghost"
                            className={`shrink-0 ${adding ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                            disabled={adding}
                          >
                            {adding ? 'Adding...' : 'Add'}
                          </Button>
                        )}
                      </div>
                      );
                    })
                  ) : (
                    <p className="text-copy-13 text-[var(--ds-gray-500)] py-2">
                      {v2 && search.trim()
                        ? `No members match “${search.trim()}”.`
                        : v2 && availOnly
                          ? 'No one is marked available for this date.'
                          : instrumentFilter
                            ? `No available members play ${instrumentFilter}.`
                            : 'All members are scheduled.'}
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
