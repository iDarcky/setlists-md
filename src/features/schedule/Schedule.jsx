import { useMemo, useState } from 'react';
import { useTeam } from '@/auth/useTeam';
import { useAuth } from '@/auth/useAuth';
import { useTeamAvailability } from '@/hooks/useTeamAvailability';
import { bandFor } from '@/lib/homeData';
import { groupByMonth, myStatus, bandSummary, needsPeople, isDraft } from '@/lib/scheduleData';
import ScheduleView from './ScheduleView';
import AvailabilitySheet from './AvailabilitySheet';

// Schedule: works out the rows from the setlists, the team's schedule rows and
// per-day availability, and hands them to ScheduleView. Schedules and the
// row-id map come from App, which already keeps them live for the bell.

export default function Schedule({
  setlists = [], schedules = [], updateSchedule, setlistMap = {},
  onOpenSetlist, onNewSetlist, onOpenBand, clockFormat = '12h', firstDayOfWeek = 'sunday',
}) {
  const { user } = useAuth();
  const { team, members, isAdmin, canManageBand } = useTeam();
  const leader = !!team && (isAdmin || canManageBand);
  const { availability, setStatus, clearStatus } = useTeamAvailability(team?.id);
  const [now] = useState(() => Date.now());
  const [tab, setTab] = useState('upcoming');
  const [filter, setFilter] = useState('all');
  const [sheet, setSheet] = useState(false);
  const userId = user?.id;

  const nameOf = (uid) => {
    const m = (members || []).find(x => x.user_id === uid);
    return m?.profile?.display_name || m?.profile?.email?.split('@')[0] || 'Member';
  };

  const ctx = { schedules, setlistMap, userId, availability };
  const rowFor = (sl) => {
    const summary = bandSummary(sl, ctx);
    return {
      setlist: sl,
      me: myStatus(sl, ctx),
      summary,
      faces: summary.rows.map(r => ({ id: r.id, name: nameOf(r.user_id), yes: r.availability === 'available' })),
      songCount: (sl.items || []).filter(i => i.songId).length,
    };
  };

  const all = useMemo(() => groupByMonth(setlists, { now, past: tab === 'past' }), [setlists, now, tab]);
  const upcomingRows = tab === 'past' ? [] : all.flatMap(g => g.setlists.map(rowFor));
  const counts = {
    needs: upcomingRows.filter(r => needsPeople(r.summary)).length,
    drafts: upcomingRows.filter(r => isDraft(r.setlist)).length,
  };
  const keep = (r) => !leader || tab === 'past' || filter === 'all'
    || (filter === 'needs' ? needsPeople(r.summary) : isDraft(r.setlist));
  const groups = all
    .map(g => ({ month: g.month, rows: g.setlists.map(rowFor).filter(keep) }))
    .filter(g => g.rows.length);

  // One answer covers the day, as on Home: the availability row and every
  // schedule row of yours on that date.
  const answerDay = async (date, value) => {
    await setStatus(date, value);
    const mine = setlists
      .filter(sl => sl.date === date)
      .flatMap(sl => bandFor(sl, schedules, setlistMap))
      .filter(r => r.user_id === userId && r.availability !== value);
    await Promise.all(mine.map(r => updateSchedule?.(r.id, { availability: value })));
  };
  const answerAsk = (schedule, value) => {
    const sl = setlists.find(x => bandFor(x, [schedule], setlistMap).length);
    return sl?.date ? answerDay(sl.date, value) : updateSchedule?.(schedule.id, { availability: value });
  };

  const mine = useMemo(
    () => Object.fromEntries(availability.filter(a => a.user_id === userId).map(a => [a.date, a.status])),
    [availability, userId],
  );
  const busyDates = useMemo(() => new Set(setlists.map(sl => sl.date).filter(Boolean)), [setlists]);

  return (
    <>
      <ScheduleView
        leader={leader}
        tab={tab}
        onTab={(t) => (t === 'band' ? onOpenBand?.() : setTab(t))}
        showBand={leader && !!onOpenBand}
        filter={filter}
        onFilter={setFilter}
        counts={counts}
        groups={groups}
        clockFormat={clockFormat}
        onOpen={onOpenSetlist}
        onAnswer={answerAsk}
        onNew={leader ? onNewSetlist : null}
        onAvailability={team ? () => setSheet(true) : null}
      />
      {team && (
        <AvailabilitySheet
          open={sheet}
          onOpenChange={setSheet}
          mine={mine}
          busyDates={busyDates}
          onSet={answerDay}
          onClear={(date) => clearStatus(date)}
          firstDay={firstDayOfWeek}
          now={now}
        />
      )}
    </>
  );
}
