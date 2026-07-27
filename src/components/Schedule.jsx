import { useState } from 'react';
import { SegmentedControl } from '@/ui/SegmentedControl';
import PageHeader from '@/ui/PageHeader';
import RecurringPicker from '@/components/schedule/RecurringPicker';
import ScheduleListView from '@/components/schedule/ScheduleListView';
import ScheduleCalendarView from '@/components/schedule/ScheduleCalendarView';
import RosterPanel from '@/components/setlist/RosterPanel';
import DateStatusModal from '@/components/schedule/DateStatusModal';
import { useTeam } from '@/auth/useTeam';
import { useAuth } from '@/auth/useAuth';
import { useTeamAvailability } from '@/hooks/useTeamAvailability';

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// view mode (list/calendar) is controlled by App so the BottomNav FAB can toggle
// it alongside the desktop header switch.
export default function Schedule({ setlists, onBack, onOpenSetlist, onOpenGrid, viewMode = 'calendar', onSetView, clockFormat = '12h', firstDayOfWeek = 'sunday' }) {
  const { team, members, canManageRoster } = useTeam();
  const { user } = useAuth();
  const { availability, setStatus, clearStatus } = useTeamAvailability(team?.id);

  const [weeksAhead, setWeeksAhead] = useState(8);
  const [rosterSetlist, setRosterSetlist] = useState(null);
  const [pickerDate, setPickerDate] = useState(null);

  const handleSetView = (next) => onSetView?.(next);

  const pickerDateStr = pickerDate ? toLocalDateStr(pickerDate) : null;
  const pickerStatus = pickerDateStr
    ? availability.find(a => a.user_id === user?.id && a.date === pickerDateStr)?.status || null
    : null;
  const pickerAvailableCount = pickerDateStr
    ? availability.filter(a => a.date === pickerDateStr && a.status === 'available').length
    : 0;
  // Setlists scheduled on the picked date, and every member's availability for
  // it — so the day sheet shows what's happening and who can serve.
  const pickerSetlists = pickerDateStr ? setlists.filter(sl => sl.date === pickerDateStr) : [];
  const pickerRehearsals = pickerDateStr ? setlists.filter(sl => sl.rehearsalDate === pickerDateStr) : [];
  const pickerMemberStatuses = pickerDateStr
    ? members.map(m => ({
        id: m.user_id,
        name: m.profile?.display_name || m.profile?.email?.split('@')[0] || 'Member',
        avatarUrl: m.profile?.avatar_url || null,
        isYou: m.user_id === user?.id,
        status: availability.find(a => a.user_id === m.user_id && a.date === pickerDateStr)?.status || 'pending',
      }))
    : [];

  const handleSetStatus = async (status) => {
    if (!pickerDate) return;
    try {
      await setStatus(pickerDate, status);
      setPickerDate(null);
    } catch (err) {
      console.error('[schedule] set availability failed:', err);
    }
  };

  const handleClearStatus = async () => {
    if (!pickerDate) return;
    try {
      await clearStatus(pickerDate);
      setPickerDate(null);
    } catch (err) {
      console.error('[schedule] clear availability failed:', err);
    }
  };

  const handleApplyRecurring = async (dates, status) => {
    // Sequential to keep load light; small batches in practice (≤ 12).
    for (const d of dates) {
      await setStatus(d, status);
    }
  };

  if (!team) {
    return (
      <div data-theme-variant="modes" className="relative h-full overflow-y-auto">
        <PageHeader title="Schedule" onClose={onBack} />
        <div className="w-full max-w-[1320px] mx-auto px-5 sm:px-8 py-16">
          <div className="modes-card p-8 text-center flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-[var(--modes-surface-strong)] border border-[var(--modes-border)] flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--modes-text-muted)]">
                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </div>
            <h2 className="text-heading-20 text-[var(--modes-text)] m-0">Schedule is a team feature</h2>
            <p className="text-copy-14 text-[var(--modes-text-muted)] max-w-sm m-0">
              Create or join a team to plan services, coordinate availability, and build rosters together.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-theme-variant="modes" className="relative h-full overflow-y-auto">
      <PageHeader
        title="Schedule"
        onClose={onBack}
        actions={
          <div className="flex items-center gap-2">
            <SegmentedControl
              value={viewMode}
              onChange={handleSetView}
              options={[{ value: 'list', label: 'List' }, { value: 'calendar', label: 'Calendar' }]}
              size="sm"
            />
            {onOpenGrid && (
              <button
                type="button"
                onClick={onOpenGrid}
                className="inline-flex items-center gap-1.5 text-label-12 font-semibold px-3 py-1.5 rounded-lg bg-[var(--modes-surface)] text-[var(--modes-text)] border border-[var(--modes-border)] cursor-pointer hover:bg-[var(--modes-surface-strong)] transition-colors"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>
                Grid
              </button>
            )}
          </div>
        }
      />

      <div className="w-full max-w-[1320px] mx-auto px-5 sm:px-8 pt-6 pb-28 flex flex-col gap-6">
        <RecurringPicker onApply={handleApplyRecurring} />

        {viewMode === 'list' ? (
          <ScheduleListView
            weeksAhead={weeksAhead}
            onLoadMore={() => setWeeksAhead(w => w + 8)}
            setlists={setlists}
            availability={availability}
            members={members}
            userId={user?.id}
            isAdmin={canManageRoster}
            clockFormat={clockFormat}
            onSelectDate={(date) => setPickerDate(date)}
            onOpenSetlist={(sl) => onOpenSetlist?.(sl)}
            onOpenRoster={(sl) => setRosterSetlist(sl)}
          />
        ) : (
          <ScheduleCalendarView
            setlists={setlists}
            availability={availability}
            members={members}
            userId={user?.id}
            firstDayOfWeek={firstDayOfWeek}
            isAdmin={canManageRoster}
            onSelectDate={(date) => setPickerDate(date)}
            onOpenSetlist={(sl) => onOpenSetlist?.(sl)}
            onOpenRoster={(sl) => setRosterSetlist(sl)}
          />
        )}
      </div>

      {rosterSetlist && (
        <div
          className="fixed inset-0 z-[200] flex justify-end bg-black/20 backdrop-blur-[2px]"
          onClick={() => setRosterSetlist(null)}
        >
          <div className="h-full" onClick={e => e.stopPropagation()}>
            <RosterPanel
              setlistId={rosterSetlist.id}
              setlistDate={rosterSetlist.date}
              onClose={() => setRosterSetlist(null)}
              readOnly={!canManageRoster}
            />
          </div>
        </div>
      )}

      {pickerDate && (
        <DateStatusModal
          date={pickerDate}
          currentStatus={pickerStatus}
          availableCount={pickerAvailableCount}
          totalMembers={members.length}
          setlists={pickerSetlists}
          rehearsals={pickerRehearsals}
          memberStatuses={pickerMemberStatuses}
          canViewTeam={canManageRoster}
          clockFormat={clockFormat}
          onSetStatus={handleSetStatus}
          onClear={handleClearStatus}
          onOpenSetlist={(sl) => { setPickerDate(null); onOpenSetlist?.(sl); }}
          onOpenRoster={(sl) => { setPickerDate(null); setRosterSetlist(sl); }}
          onClose={() => setPickerDate(null)}
        />
      )}
    </div>
  );
}
