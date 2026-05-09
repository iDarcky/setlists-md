import { useState, useSyncExternalStore } from 'react';
import ScreenHeader from './ui/ScreenHeader';
import { SegmentedControl } from './ui/SegmentedControl';
import RecurringPicker from './schedule/RecurringPicker';
import ScheduleListView from './schedule/ScheduleListView';
import ScheduleCalendarView from './schedule/ScheduleCalendarView';
import RosterPanel from './setlist/RosterPanel';
import DateStatusModal from './schedule/DateStatusModal';
import { useTeam } from '../auth/useTeam';
import { useAuth } from '../auth/useAuth';
import { useTeamAvailability } from '../hooks/useTeamAvailability';

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const MOBILE_QUERY = '(max-width: 639px)';

function subscribeMobile(cb) {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
}

function useIsMobile() {
  return useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

export default function Schedule({ setlists, onBack, onOpenSetlist, clockFormat = '12h', firstDayOfWeek = 'sunday' }) {
  const { team, members, isAdmin } = useTeam();
  const { user } = useAuth();
  const { availability, setStatus, clearStatus } = useTeamAvailability(team?.id);
  const isMobile = useIsMobile();

  const [userPick, setUserPick] = useState(null); // null = follow screen size
  const [weeksAhead, setWeeksAhead] = useState(8);
  const [rosterSetlist, setRosterSetlist] = useState(null);
  const [pickerDate, setPickerDate] = useState(null);

  // Default tracks the screen size; user's explicit pick wins once made.
  const viewMode = userPick ?? (isMobile ? 'list' : 'calendar');
  const handleSetView = (next) => setUserPick(next);

  const pickerDateStr = pickerDate ? toLocalDateStr(pickerDate) : null;
  const pickerStatus = pickerDateStr
    ? availability.find(a => a.user_id === user?.id && a.date === pickerDateStr)?.status || null
    : null;
  const pickerAvailableCount = pickerDateStr
    ? availability.filter(a => a.date === pickerDateStr && a.status === 'available').length
    : 0;

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
      <div className="material-page min-h-screen pb-8">
        <ScreenHeader title="Schedule" onBack={onBack} />
        <div className="a4-container py-12 text-center">
          <p className="text-copy-14 text-[var(--ds-gray-700)]">
            Schedule planning is a team feature. Create or join a team to start coordinating availability.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="material-page min-h-screen pb-8">
      <ScreenHeader
        title="Schedule"
        subtitle={team.name}
        onBack={onBack}
        actions={
          <SegmentedControl
            value={viewMode}
            onChange={handleSetView}
            options={[
              { value: 'list', label: 'List' },
              { value: 'calendar', label: 'Calendar' },
            ]}
          />
        }
      />

      <div className="a4-container pt-6 flex flex-col gap-6">
        <RecurringPicker onApply={handleApplyRecurring} />

        {viewMode === 'list' ? (
          <ScheduleListView
            weeksAhead={weeksAhead}
            onLoadMore={() => setWeeksAhead(w => w + 8)}
            setlists={setlists}
            availability={availability}
            members={members}
            userId={user?.id}
            isAdmin={isAdmin}
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
            isAdmin={isAdmin}
            onSelectDate={(date) => setPickerDate(date)}
            onOpenSetlist={(sl) => onOpenSetlist?.(sl)}
            onOpenRoster={(sl) => setRosterSetlist(sl)}
          />
        )}
      </div>

      {rosterSetlist && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-[2px]"
          onClick={() => setRosterSetlist(null)}
        >
          <div className="h-full" onClick={e => e.stopPropagation()}>
            <RosterPanel
              setlistId={rosterSetlist.id}
              setlistDate={rosterSetlist.date}
              onClose={() => setRosterSetlist(null)}
              readOnly={!isAdmin}
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
          onSetStatus={handleSetStatus}
          onClear={handleClearStatus}
          onClose={() => setPickerDate(null)}
        />
      )}
    </div>
  );
}
