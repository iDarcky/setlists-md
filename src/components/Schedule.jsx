import { useState, useSyncExternalStore } from 'react';
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

// Modern header matching the Setlists / Library / Team shell.
function ScheduleHeader({ teamName, viewMode, onSetView, onBack, showBack = true, hideToggle = false }) {
  return (
    <header
      className="sticky top-0 z-20 backdrop-blur-md bg-[color-mix(in_srgb,var(--ds-background-100)_80%,transparent)] border-b border-[var(--modes-border)]"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="w-full max-w-[1320px] mx-auto px-5 sm:px-8 h-16 flex items-center gap-3">
        {onBack && showBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="w-10 h-10 -ml-1 rounded-xl flex items-center justify-center text-[var(--modes-text)] hover:bg-[var(--modes-surface)] active:scale-95 transition-all cursor-pointer border-none bg-transparent shrink-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-heading-32 font-bold text-[var(--modes-text)] m-0 truncate leading-tight">Schedule</h1>
          {teamName && <p className="text-label-12 text-[var(--modes-text-dim)] m-0 truncate">{teamName}</p>}
        </div>
        {!hideToggle && (
          <SegmentedControl
            value={viewMode}
            onChange={onSetView}
            options={[
              { value: 'list', label: 'List' },
              { value: 'calendar', label: 'Calendar' },
            ]}
            size="sm"
          />
        )}
      </div>
    </header>
  );
}

export default function Schedule({ setlists, onBack, onOpenSetlist, clockFormat = '12h', firstDayOfWeek = 'sunday' }) {
  const { team, members, canManageRoster } = useTeam();
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
  // Setlists scheduled on the picked date, and every member's availability for
  // it — so the day sheet shows what's happening and who can serve.
  const pickerSetlists = pickerDateStr ? setlists.filter(sl => sl.date === pickerDateStr) : [];
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
        <ScheduleHeader teamName={null} viewMode={viewMode} onSetView={handleSetView} onBack={onBack} showBack={isMobile} hideToggle />
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
      <ScheduleHeader teamName={team.name} viewMode={viewMode} onSetView={handleSetView} onBack={onBack} showBack={isMobile} />

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
          memberStatuses={pickerMemberStatuses}
          isAdmin={canManageRoster}
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
