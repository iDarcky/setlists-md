import { useMemo, useState } from 'react';
import { Sheet } from '@/ui/shadcn/sheet';
import { useTeam } from '@/auth/useTeam';
import { useAuth } from '@/auth/useAuth';
import { bandFor } from '@/lib/homeData';
import { partLabel } from '@/data/instruments';
import { formatClockTime } from '@/lib/dateFormat';
import { buildOrder, daysAway, daysLabel, changesSinceReady, nowInOrder } from '@/lib/setlistView';
import { useNow } from '@/hooks/useNow';
import { SHARE_ENABLED } from '@/lib/setlistShare';
import { useConfirm } from '@/ui/useConfirmHook';
import { toast } from '@/ui/use-toast';
import ShareSheet from '@/features/sharing/ShareSheet';
import PrintSheet from './PrintSheet';
import SetlistView from './SetlistView';
import RunSheet from './RunSheet';
import BandSection from './BandSection';

// The setlist page's container: works out the order, the band and your row,
// and owns the ⋯ menu and the run sheet. SetlistView draws it.

function nameFor(members, uid, myId) {
  const m = members.find(x => x.user_id === uid);
  return m?.profile?.display_name || m?.profile?.email?.split('@')[0] || (uid === myId ? 'You' : 'Member');
}

const dayLabel = (date, opts) => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', opts);

export default function SetlistPage({
  setlist, songs = [], setlists = [], schedules = [], updateSchedule, createSchedule, deleteSchedule, ensureRow, setlistMap = {}, settings,
  canEdit = false, onBack, onEdit, onPlay, onMarkReady, onDelete,
  onExportZip, onPrint,
}) {
  const { user } = useAuth();
  const { team, members = [], isAdmin, canManageBand } = useTeam();
  const confirm = useConfirm();
  const [now] = useState(() => Date.now());
  const [menuOpen, setMenuOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const fmt = settings?.clockFormat || '24h';
  const leader = canEdit && (!team || isAdmin || canManageBand);

  const memberOf = (uid) => members.find(m => m.user_id === uid);
  const nameOf = (uid) => nameFor(members, uid, user?.id);
  const order = useMemo(() => buildOrder(setlist, songs, (uid) => nameFor(members, uid, user?.id)), [setlist, songs, members, user?.id]);

  const rows = team ? bandFor(setlist, schedules, setlistMap) : [];
  const band = rows.map(r => ({
    id: r.id, userId: r.user_id, name: nameOf(r.user_id),
    url: memberOf(r.user_id)?.profile?.avatar_url, part: partLabel(r), status: r.availability,
  }));
  const mineRow = rows.find(r => r.user_id === user?.id);
  const me = mineRow ? { part: partLabel(mineRow), status: changing ? 'pending' : mineRow.availability } : null;

  const days = daysAway(setlist.date, now);
  // On the day itself the order follows the clock (the run sheet does too).
  const clock = useNow(30000, days === 0);
  const live = days === 0 ? nowInOrder(setlist, order, clock) : { state: 'none' };
  const head = {
    date: setlist.date ? [dayLabel(setlist.date, { weekday: 'short', day: 'numeric', month: 'short' }), daysLabel(days)].filter(Boolean).join(' · ') : '',
    time: setlist.time ? formatClockTime(setlist.time, fmt) + (setlist.endTime ? `–${formatClockTime(setlist.endTime, fmt)}` : '') : '',
    place: setlist.location || '',
    rehearsal: setlist.rehearsalDate
      ? [dayLabel(setlist.rehearsalDate, { weekday: 'short', day: 'numeric', month: 'short' }), setlist.rehearsalTime && formatClockTime(setlist.rehearsalTime, fmt)].filter(Boolean).join(' ')
      : '',
  };

  const answer = async (status) => {
    if (!status) { setChanging(true); return; }
    if (!mineRow) return;
    try {
      await updateSchedule?.(mineRow.id, { availability: status });
      setChanging(false);
    } catch {
      toast({ title: 'Couldn’t save your answer', description: 'Check your connection and try again.', variant: 'error' });
    }
  };

  const copyOrder = async () => {
    const lines = [setlist.name || 'Setlist', [head.date, head.time, head.place].filter(Boolean).join(' · '), ''];
    for (const r of order.rows) {
      lines.push(r.kind === 'moment'
        ? `— ${r.title}${r.minutes ? ` (${r.minutes} min)` : ''} —`
        : `${r.n}. ${r.title}${r.key ? ` · ${r.key}` : ''}${r.tempo ? ` · ${r.tempo} BPM` : ''}${r.leads ? ` · ${r.leads}` : ''}`);
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast({ title: 'Order copied' });
    } catch {
      toast({ title: 'Couldn’t copy', description: 'The clipboard isn’t available here.', variant: 'error' });
    }
  };

  // The printout is for the band, so it names them (a guest link never does).
  const print = (choice) => onPrint?.({
    ...choice,
    nameOf,
    clock: (t) => formatClockTime(t, fmt),
    band: band.filter(b => b.status !== 'unavailable').map(b => (b.part ? `${b.name} (${b.part})` : b.name)),
    church: team ? { name: team.name, logo: team.logo_url } : null,
  });

  const del = async () => {
    setMenuOpen(false);
    const ok = await confirm({ title: 'Delete this setlist?', description: `“${setlist.name || 'Untitled'}” is removed for everyone. You can undo right after.`, confirmLabel: 'Delete', variant: 'danger' });
    if (ok) onDelete?.();
  };

  const canShare = leader && SHARE_ENABLED && !!user?.id;
  const items = [
    leader && onEdit && ['Edit name, date and time', () => onEdit()],
    canShare && ['Share a guest link', () => setShareOpen(true)],
    onPrint && ['Print for the band', () => setPrintOpen(true)],
    leader && onExportZip && ['Download songs (.zip)', onExportZip],
    order.rows.length > 0 && ['Copy the order', copyOrder],
  ].filter(Boolean);

  return (
    <>
      <SetlistView
        setlist={setlist} order={order} head={head} me={me} band={band} leader={leader}
        onBack={onBack} backLabel="Back"
        onPlay={onPlay}
        onEdit={leader ? onEdit : null}
        onMarkReady={leader ? onMarkReady : null}
        onAnswer={answer}
        onRunSheet={order.rows.length ? () => setRunOpen(true) : null}
        onMenu={() => setMenuOpen(true)}
        onBand={leader ? onEdit : null}
        changes={changesSinceReady(setlist, songs)}
        nowIdx={live.state === 'during' ? live.idx : null}
        bandSlot={leader && team && createSchedule ? (
          <BandSection setlist={setlist} setlists={setlists} schedules={schedules} setlistMap={setlistMap}
            team={team} members={members} nameOf={nameOf}
            createSchedule={createSchedule} deleteSchedule={deleteSchedule} ensureRow={ensureRow} />
        ) : null}
      />
      <Sheet open={menuOpen} onOpenChange={setMenuOpen} title={setlist.name || 'Setlist'} className="h-auto max-h-[80dvh] sm:max-w-[440px]">
        <div className="-mx-2 flex flex-col">
          {items.map(([label, fn]) => (
            <button key={label} type="button" onClick={() => { setMenuOpen(false); fn(); }}
              className="flex h-[52px] min-h-0 cursor-pointer items-center rounded-control border-0 bg-transparent px-2 text-left font-sans text-[16px] text-foreground outline-none hover:bg-raised focus-visible:bg-raised">
              {label}
            </button>
          ))}
          {leader && onDelete && (
            <button type="button" onClick={del}
              className="flex h-[52px] min-h-0 cursor-pointer items-center rounded-control border-0 bg-transparent px-2 text-left font-sans text-[16px] text-danger outline-none hover:bg-raised focus-visible:bg-raised">
              Delete setlist
            </button>
          )}
        </div>
      </Sheet>
      <RunSheet open={runOpen} onClose={() => setRunOpen(false)} title={setlist.name || 'Setlist'} order={order} setlist={setlist} clockFormat={fmt} />
      {canShare && (
        <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} setlist={setlist} songs={songs}
          ownerId={user?.id} teamId={team?.id} ensureRow={ensureRow} setlistMap={setlistMap} clockFormat={fmt} />
      )}
      {onPrint && (
        <PrintSheet open={printOpen} onClose={() => setPrintOpen(false)} onPrint={print}
          hasLeads={(setlist.items || []).some(it => it.leadBy)} />
      )}
    </>
  );
}
