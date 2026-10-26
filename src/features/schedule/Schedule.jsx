import { useMemo, useState } from 'react';
import { useTeam } from '@/auth/useTeam';
import { useAuth } from '@/auth/useAuth';
import { useTeamAvailability } from '@/hooks/useTeamAvailability';
import { bandFor, myAsks, myServices } from '@/lib/homeData';
import { groupByMonth, myStatus, bandSummary, needsPeople, isDraft, canYouPlay, bandGrid, planKey, planSummary } from '@/lib/scheduleData';
import { useMediaQuery } from '@/lib/useMediaQuery';
import ScheduleView from './ScheduleView';
import AvailabilitySheet from './AvailabilitySheet';
import BandView from './BandView';

// Schedule: works out the rows from the setlists, the team's schedule rows and
// per-day availability, and hands them to ScheduleView. Schedules and the
// row-id map come from App, which already keeps them live for the bell.

export default function Schedule({
  setlists = [], schedules = [], updateSchedule, createSchedule, deleteSchedule, setlistMap = {},
  onOpenSetlist, onNewSetlist, clockFormat = '12h', firstDayOfWeek = 'sunday',
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
  // The strip: the next five Sundays and any day you're asked about.
  const canPlay = useMemo(() => {
    if (!team || !userId) return null;
    const args = { schedules, userId, setlists, setlistMap, now };
    return canYouPlay({ now, setlists, asks: myAsks(args), plays: myServices(args), mine: availability.filter(a => a.user_id === userId) })
      .map(t => ({ ...t, setlists: setlists.filter(sl => sl.date === t.date) }));
  }, [team, userId, schedules, setlists, setlistMap, now, availability]);
  // ── Band ──
  // Taps only fill `plan`; Send asks writes it. An ask is a new schedule row
  // (the DB trigger notifies the person); taking someone off deletes theirs.
  const wide = useMediaQuery('(min-width: 640px)');
  const pageSize = wide ? 6 : 4;
  const [page, setPage] = useState(0);
  const [plan, setPlan] = useState({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const upcoming = useMemo(() => groupByMonth(setlists, { now }).flatMap(g => g.setlists), [setlists, now]);
  const grid = useMemo(() => bandGrid({
    setlists: upcoming, members: members || [], schedules, setlistMap, availability, plan,
    nameOf: (m) => m.profile?.display_name || m.profile?.email?.split('@')[0] || 'Member',
  }), [upcoming, members, schedules, setlistMap, availability, plan]);
  const pages = Math.max(1, Math.ceil(upcoming.length / pageSize));
  const at = Math.min(page, pages - 1) * pageSize;
  const shown = grid.columns.slice(at, at + pageSize);
  const short = (d, withMonth) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', withMonth ? { day: 'numeric', month: 'long' } : { day: 'numeric' });
  const first = shown[0]?.setlist.date;
  const last = shown[shown.length - 1]?.setlist.date;
  const range = !first ? '' : first === last ? short(first, true)
    : first.slice(0, 7) === last.slice(0, 7) ? `${short(first)} – ${short(last, true)}` : `${short(first, true)} – ${short(last, true)}`;
  const bandPage = {
    columns: shown,
    people: grid.people.map(p => ({ ...p, cells: p.cells.slice(at, at + pageSize) })),
    range,
    canPrev: at > 0,
    canNext: at + pageSize < upcoming.length,
    onPrev: () => setPage(Math.max(0, Math.min(page, pages - 1) - 1)),
    onNext: () => setPage(Math.min(page, pages - 1) + 1),
  };
  const tapCell = (setlistId, uid) => {
    const key = planKey(setlistId, uid);
    const cell = grid.people.find(p => p.userId === uid)?.cells.find(c => c.setlistId === setlistId);
    setSendError(null);
    setPlan(prev => {
      const { [key]: had, ...rest } = prev;
      if (had) return rest;
      return { ...rest, [key]: cell?.schedule ? 'remove' : 'add' };
    });
  };
  const sendPlan = async () => {
    setSending(true);
    setSendError(null);
    const left = { ...plan };
    try {
      for (const [key, action] of Object.entries(plan)) {
        const cut = key.lastIndexOf(':');
        const setlistId = key.slice(0, cut);
        const uid = key.slice(cut + 1);
        const col = grid.columns.find(c => c.setlist.id === setlistId);
        const cell = grid.people.find(p => p.userId === uid)?.cells.find(c => c.setlistId === setlistId);
        if (action === 'add' && col?.rowId && !cell?.schedule) {
          await createSchedule(col.rowId, uid, grid.people.find(p => p.userId === uid)?.part || null);
        } else if (action === 'remove' && cell?.schedule) {
          await deleteSchedule(cell.schedule.id);
        }
        delete left[key];
      }
    } catch (err) {
      setSendError(`Some changes were not sent${navigator.onLine ? '' : ' (you are offline)'}. Try again.`);
      console.error('Send asks failed:', err);
    } finally {
      setPlan(left);
      setSending(false);
    }
  };

  const busyDates = useMemo(() => new Set(setlists.map(sl => sl.date).filter(Boolean)), [setlists]);

  return (
    <>
      <ScheduleView
        leader={leader}
        tab={tab}
        onTab={setTab}
        showBand={leader && !!createSchedule}
        band={tab === 'band' ? (
          <BandView
            {...bandPage}
            onTap={tapCell}
            onOpen={onOpenSetlist}
            plan={planSummary(plan)}
            onSend={sendPlan}
            onClear={() => { setPlan({}); setSendError(null); }}
            sending={sending}
            error={sendError}
          />
        ) : null}
        filter={filter}
        onFilter={setFilter}
        counts={counts}
        groups={groups}
        clockFormat={clockFormat}
        onOpen={onOpenSetlist}
        onAnswer={answerAsk}
        onNew={leader ? onNewSetlist : null}
        onAvailability={team ? () => setSheet(true) : null}
        canPlay={canPlay}
        onAnswerDay={(tile, value) => answerDay(tile.date, value)}
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
