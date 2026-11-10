import { useEffect, useMemo, useRef, useState } from 'react';
import { useTeamAvailability } from '@/hooks/useTeamAvailability';
import { bandFor } from '@/lib/homeData';
import { bandSlots, candidates, lastParts, partName } from '@/lib/bandParts';
import { BandPlanner, PartSheet, AddPartSheet } from './BandPlanner';

// The leader's Band: the plan (picks not sent yet), the part sheet, and Send.
// A setlist that has never synced has no server row for team_schedules to
// point at; Send pushes it first (`ensureRow`) instead of telling the leader
// to go and sync.

export default function BandSection({
  setlist, setlists = [], schedules = [], setlistMap = {}, team, members = [], nameOf,
  createSchedule, deleteSchedule, ensureRow, availability: given,
  // New setlist: `planOnly` keeps every pick local and reports it through
  // `onPlanChange` (nobody is asked until the setlist is saved). On the
  // setlist page, `setlist.plannedBand` is that plan; `autoSend` sends it
  // once and `onPlanSent` clears it from the setlist.
  planOnly = false, needed: neededParts = null, initialExtra = [], onPlanChange, autoSend = false, onPlanSent,
}) {
  const fetched = useTeamAvailability(given ? null : team?.id).availability;
  const availability = given || fetched;
  const [adds, setAdds] = useState(() => (Array.isArray(setlist.plannedBand) ? setlist.plannedBand.filter(a => a?.userId) : []));           // [{ part, userId }]
  const [removes, setRemoves] = useState(() => new Set());
  const [extra, setExtra] = useState(initialExtra);         // parts added by hand
  const [open, setOpen] = useState(null);         // the slot whose sheet is open
  const [adding, setAdding] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const rows = bandFor(setlist, schedules, setlistMap);
  const from = useMemo(() => lastParts({ setlist, setlists, schedules, setlistMap }), [setlist, setlists, schedules, setlistMap]);
  const slots = bandSlots({ rows, adds, removes, needed: [...(neededParts || from), ...extra] });
  const planRef = useRef(onPlanChange);
  planRef.current = onPlanChange;
  useEffect(() => { if (planOnly) planRef.current?.(adds, extra); }, [planOnly, adds, extra]);
  const memberOf = (uid) => members.find(m => m.user_id === uid);
  const person = (uid) => ({ name: nameOf(uid), url: memberOf(uid)?.profile?.avatar_url });
  const taken = slots.filter(s => s.userId).map(s => s.userId);
  const groups = open ? candidates({
    part: open.part, setlist, members, schedules, setlists, setlistMap, availability, taken,
    nameOf: (m) => nameOf(m.user_id),
  }) : null;

  const dropSlot = (slot) => {
    if (slot.add != null) setAdds(xs => xs.filter((_, i) => i !== slot.add));
    else if (slot.schedule) setRemoves(s => new Set(s).add(slot.schedule.id));
  };
  const choose = (uid) => {
    const slot = open;
    if (slot.add != null) setAdds(xs => xs.map((a, i) => (i === slot.add ? { ...a, userId: uid } : a)));
    else {
      if (slot.schedule) setRemoves(s => new Set(s).add(slot.schedule.id));
      setAdds(xs => [...xs, { part: slot.part, userId: uid }]);
    }
    setError(null);
    setOpen(null);
  };

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const rowId = setlistMap[setlist.id] || (adds.length ? await ensureRow?.(setlist) : null);
      if (adds.length && !rowId) throw new Error('no-row');
      for (const id of removes) {
        await deleteSchedule(id);
        setRemoves(s => { const n = new Set(s); n.delete(id); return n; });
      }
      for (const a of adds) {
        await createSchedule(rowId, a.userId, a.part);
        setAdds(xs => xs.filter(x => x !== a));
      }
      if (setlist.plannedBand?.length) onPlanSent?.();
    } catch (err) {
      console.error('Send asks failed:', err);
      setError(typeof navigator !== 'undefined' && !navigator.onLine
        ? 'You’re offline. Your picks are kept here; send again when you’re back.'
        : 'Some asks weren’t sent. Try again.');
    } finally {
      setSending(false);
    }
  };

  // A setlist saved from New setlist arrives with its plan: send it once.
  const autoSent = useRef(false);
  useEffect(() => {
    if (!autoSend || planOnly || autoSent.current || !adds.length || !createSchedule) return;
    autoSent.current = true;
    send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend, planOnly]);

  const pending = planOnly ? 0 : adds.length + removes.size;
  const sendLabel = adds.length
    ? `Send ${adds.length} ${adds.length === 1 ? 'ask' : 'asks'}${removes.size ? ` · take ${removes.size} off` : ''}`
    : 'Save changes';
  const dateLabel = setlist.date ? new Date(`${setlist.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '';

  return (
    <>
      <BandPlanner
        slots={slots} person={person}
        note={planOnly ? '' : (from.length && !neededParts ? `Parts from the last ${setlist.name}.` : '')}
        onSlot={(s) => setOpen(s)} onAddPart={() => setAdding(true)}
        pending={pending} sendLabel={sendLabel} onSend={send} sending={sending} error={error}
      />
      {open && (
        <PartSheet key={open.key} open onOpenChange={(o) => { if (!o) setOpen(null); }}
          title={[partName(open.part), dateLabel].filter(Boolean).join(' · ')}
          groups={groups} current={open.userId} currentName={open.userId ? nameOf(open.userId) : ''}
          onChoose={choose} onRemove={() => { dropSlot(open); setOpen(null); }} />
      )}
      <AddPartSheet open={adding} onOpenChange={setAdding} onAdd={(p) => { setExtra(xs => [...xs, p]); setAdding(false); }} />
    </>
  );
}
