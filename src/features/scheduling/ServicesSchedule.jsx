import { useState } from 'react';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { myServiceDates, serviceIdsFor, serviceColor, setlistFor } from '@/lib/services';
import MyDates, { OwnDatesStrip, YourDatesList, DateDetail, NotOnService } from './MyDates';
import PlanList, { DatePlan } from './PlanList';
import { planKey, planRows } from './scheduleFormat';

// Schedule once a Space has services, laid out as the "Schedule and services"
// canvas draws it. Phone: one column (a leader gets their own answers as a
// small strip above the plan; a date opens full screen). From 900px: a list on
// the left and the selected date on the right — a leader's list is the plan,
// with their own dates one tap away.

const PILL = 'h-10 px-3.5 rounded-full inline-flex items-center gap-1.5 text-copy-14 font-semibold cursor-pointer border border-[#2A2A2E] bg-transparent text-[var(--modes-text)] hover:bg-[var(--modes-surface)]';

function YoureOn({ services }) {
  if (services.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-copy-14 text-[var(--modes-text-muted)]">
      You're on
      {services.map((s, i) => (
        <span key={s.id} className="inline-flex items-center gap-1.5">
          {i > 0 && <span>{i === services.length - 1 ? 'and' : ','}</span>}
          <span className="inline-flex items-center gap-[5px] text-[var(--modes-text)]">
            <span aria-hidden="true" className="w-2 h-2 rounded-full" style={{ background: serviceColor(s.color) }} />{s.name}
          </span>
        </span>
      ))}
    </span>
  );
}

function Header({ leader, myServices, onBack, onOpenServices, onOpenSetlists, onOpenGrid, wide }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button type="button" onClick={onBack} aria-label="Back" className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center bg-transparent border-none text-[var(--modes-text)] cursor-pointer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
          )}
          <h1 className={`m-0 font-bold tracking-[-0.02em] text-[var(--modes-text)] ${wide ? 'text-[34px] leading-[38px]' : 'text-[32px] leading-9'}`}>Schedule</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!leader && onOpenSetlists && <button type="button" onClick={onOpenSetlists} className={PILL}>Setlists</button>}
          {leader && onOpenServices && (
            <button type="button" onClick={onOpenServices} className={PILL}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
              Services
            </button>
          )}
          {leader && wide && onOpenGrid && <button type="button" onClick={onOpenGrid} className={PILL}>Grid</button>}
        </div>
      </div>
      {!leader && <YoureOn services={myServices} />}
    </div>
  );
}

export default function ServicesSchedule({
  user, members, canManageBand,
  services, serviceMembers, availability, setStatus, clearStatus,
  setlists, schedules, setlistMap, songs, clockFormat,
  onBack, onOpenServices, onOpenSetlists, onOpenGrid, onOpenSetlist, onAddSetlist,
  onUpdateSchedule, onCreateSchedule, onDeleteSchedule,
}) {
  const wide = useMediaQuery('(min-width: 900px)');
  const leader = canManageBand;
  const mine = serviceIdsFor(user?.id, serviceMembers);
  const myServices = services.filter(s => mine.has(s.id));
  const entries = myServiceDates(user?.id, services, serviceMembers);

  // Leaders on a wide screen switch the left pane between the plan and their own dates.
  const [pane, setPane] = useState('plan');
  const [selected, setSelected] = useState(null);

  const shared = { availability, userId: user?.id, setlists, schedules, setlistMap, clockFormat };
  const answerFns = { onSetStatus: setStatus, onClearStatus: clearStatus };
  const respond = onUpdateSchedule ? (schedule, availabilityValue) => onUpdateSchedule(schedule.id, { availability: availabilityValue }) : null;

  const plan = planRows(services);
  const unanswered = new Set(entries.filter(e => !availability.some(a => a.user_id === user?.id && a.date === e.date)).map(e => e.date)).size;
  const planEntry = plan.find(r => planKey(r.date, r.service) === selected) || null;
  const myEntry = entries.find(e => planKey(e.date, e.service) === selected) || null;

  const datePlan = (r) => {
    // Remount when the band changes underneath (realtime, another leader) so
    // the ticks start from what is on the server.
    const sl = setlistFor(r.service, r.date, setlists);
    const rowId = sl ? setlistMap[sl.id] : null;
    const bandKey = rowId ? schedules.filter(x => x.setlist_id === rowId).map(x => x.id).join(',') : '';
    return (
      <DatePlan
        key={`${planKey(r.date, r.service)}|${rowId || ''}|${bandKey}`}
        date={r.date}
        service={r.service}
        serviceMembers={serviceMembers}
        members={members}
        {...shared}
        onCreateSchedule={onCreateSchedule}
        onDeleteSchedule={onDeleteSchedule}
        onCreate={onAddSetlist}
        onOpenSetlist={onOpenSetlist}
      />
    );
  };
  const dateDetail = (e) => (
    <DateDetail entry={e} members={members} songs={songs} {...shared} {...answerFns} onRespond={respond} onOpenSetlist={onOpenSetlist} />
  );

  // Leaders' header has no room for a third pill; every setlist stays one tap away under the plan.
  const allSetlists = leader && onOpenSetlists && (
    <button type="button" onClick={onOpenSetlists} className="self-start h-10 px-1 inline-flex items-center gap-1 bg-transparent border-none text-copy-14 font-semibold text-[var(--modes-text-muted)] cursor-pointer">
      All setlists <span aria-hidden="true">›</span>
    </button>
  );

  const header = <Header leader={leader} myServices={myServices} onBack={onBack} onOpenServices={onOpenServices} onOpenSetlists={onOpenSetlists} onOpenGrid={onOpenGrid} wide={wide} />;

  if (!wide) {
    // Phone: a leader's date opens full screen over the list.
    if (leader && planEntry) {
      return (
        <div className="w-full px-4 pt-4 pb-32 flex flex-col gap-4">
          <button type="button" onClick={() => setSelected(null)} className="self-start h-10 -ml-2 px-2 rounded-full inline-flex items-center gap-1 bg-transparent border-none text-copy-15 font-semibold text-[var(--modes-text)] cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            Schedule
          </button>
          {datePlan(planEntry)}
        </div>
      );
    }
    return (
      <div className="w-full px-4 pt-4 pb-32 flex flex-col gap-[18px]">
        {header}
        {leader ? (
          <>
            <OwnDatesStrip entries={entries} {...shared} {...answerFns} />
            <PlanList services={services} serviceMembers={serviceMembers} {...shared} onSelect={setSelected} compact />
            {allSetlists}
          </>
        ) : (
          <MyDates entries={entries} myServices={myServices} {...shared} {...answerFns} onOpenSetlist={onOpenSetlist} />
        )}
      </div>
    );
  }

  // Wide: list | detail.
  const showMine = !leader || pane === 'mine';
  const firstMine = entries[0] || null;
  const detailMine = myEntry || firstMine;
  const detailPlan = planEntry || plan[0] || null;
  const left = showMine ? (
    <>
      {leader && (
        <button type="button" onClick={() => { setPane('plan'); setSelected(null); }} className="self-start h-9 -ml-1 px-1 inline-flex items-center gap-1 bg-transparent border-none text-copy-14 font-semibold text-[var(--modes-text-muted)] cursor-pointer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          Plan
        </button>
      )}
      {myServices.length === 0
        ? <NotOnService />
        : <YourDatesList entries={entries} {...shared} selected={detailMine ? planKey(detailMine.date, detailMine.service) : null} onSelect={setSelected} />}
    </>
  ) : (
    <>
      {entries.length > 0 && (
        <button type="button" onClick={() => { setPane('mine'); setSelected(null); }} className="flex items-center gap-3 px-3.5 py-3 rounded-[14px] bg-[var(--modes-surface)] border border-[var(--modes-border)] text-left text-[var(--modes-text)] cursor-pointer">
          <span className="flex-1 flex flex-col gap-0.5">
            <span className="text-copy-15 font-semibold">Can you play?</span>
            <span className="text-label-13 text-[var(--modes-text-muted)]">Your own dates · {unanswered === 0 ? 'all answered' : `${unanswered} to answer`}</span>
          </span>
          <span aria-hidden="true" className="text-[18px] text-[var(--modes-text-muted)]">›</span>
        </button>
      )}
      <PlanList services={services} serviceMembers={serviceMembers} {...shared} selected={detailPlan ? planKey(detailPlan.date, detailPlan.service) : null} onSelect={setSelected} />
      {allSetlists}
    </>
  );

  return (
    <div className="flex h-full min-h-0">
      <section aria-label={showMine ? 'Your dates' : 'Plan'} className="w-[460px] shrink-0 border-r border-[var(--modes-border)] overflow-y-auto px-7 pt-9 pb-32 flex flex-col gap-[22px] [&>*]:shrink-0">
        {header}
        {left}
      </section>
      <main className="flex-1 min-w-0 overflow-y-auto p-9 pb-32">
        <div className="max-w-[720px]">
          {showMine ? (detailMine && dateDetail(detailMine)) : (detailPlan && datePlan(detailPlan))}
        </div>
      </main>
    </div>
  );
}

