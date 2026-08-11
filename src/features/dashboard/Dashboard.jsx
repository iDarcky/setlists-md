import React, { useState, useRef, useEffect } from 'react';
import SongCard from '@/features/library/SongCard';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { SearchBar } from '@/ui/SearchBar';
import BottomSheet from '@/ui/BottomSheet';
import ProgressChecklist from '@/features/onboarding/ProgressChecklist';
import { CalendarWidget } from '@/ui/CalendarWidget';
import ActivityFeed from '@/features/team/ActivityFeed';
import { useTeam } from '@/auth/useTeam';
import { usePushSubscription } from '@/push/usePushSubscription';

// Prompt to turn on push, shown on the dashboard for a signed-in user whose
// current device has push available but not enabled. Dismissal is per-device
// (localStorage, not synced) since push itself is per-device.
function PushPromptCard() {
  const push = usePushSubscription();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('setlists-md:push-prompt-dismissed') === '1'; } catch { return false; }
  });
  if (dismissed || !push.supported || push.subscribed || push.denied) return null;
  const dismiss = () => {
    try { localStorage.setItem('setlists-md:push-prompt-dismissed', '1'); } catch { /* ignore */ }
    setDismissed(true);
  };
  return (
    <div className="modes-card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-copy-16 font-semibold text-[var(--modes-text)] m-0">Turn on notifications</p>
        <p className="text-copy-14 text-[var(--modes-text-muted)] mt-1 m-0">
          Get a heads-up on this device when you're scheduled, when a service or rehearsal is coming up, or when a set changes.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="ghost" size="sm" onClick={dismiss}>Not now</Button>
        <Button variant="brand" size="sm" loading={push.busy} onClick={() => push.enable()}>Turn on</Button>
      </div>
    </div>
  );
}
import { useTeamSchedules } from '@/hooks/useTeamSchedules';
import { useTeamAvailability } from '@/hooks/useTeamAvailability';
import DateStatusModal from '@/features/scheduling/DateStatusModal';
import { useTeamSetlistMap } from '@/hooks/useTeamSetlistMap';
import { useAuth } from '@/auth/useAuth';
import { formatClockTime } from '@/lib/dateFormat';
import { setlistStartMs, isSetlistUpcoming } from '@/lib/setlistTime';

// Order + metadata for the reorderable dashboard widgets. `requires` gates a
// widget by context (auth / team); the customize sheet hides ineligible ones.
const WIDGET_META = [
  { id: 'nextup', label: 'Next up', requires: null },
  { id: 'thisweek', label: 'This week', requires: null },
  { id: 'schedule', label: 'My Schedule', requires: 'auth' },
  { id: 'pending', label: 'Pending requests', requires: 'auth' },
  { id: 'upcoming', label: 'Upcoming setlists', requires: null },
  { id: 'availability', label: 'Team availability', requires: 'team' },
  { id: 'activity', label: 'Recent activity', requires: 'team' },
  { id: 'stats', label: 'Library stats', requires: null },
  { id: 'sync', label: 'Sync status', requires: null },
  { id: 'recent', label: 'Recently edited', requires: null },
];
const DEFAULT_ORDER = WIDGET_META.map(w => w.id);

// Local YYYY-MM-DD (avoids UTC shift from toISOString).
function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Compact brand-tinted date chip (Month / Day) used on dashboard service rows.
function DateChip({ date }) {
  if (!date) {
    return <div className="w-12 h-12 rounded-xl bg-[var(--modes-surface-strong)] shrink-0" />;
  }
  const d = new Date(date + 'T12:00:00');
  return (
    <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-[var(--color-brand-soft)] shrink-0">
      <span className="text-label-10 uppercase tracking-wider text-[var(--color-brand-text)] leading-none">
        {d.toLocaleDateString(undefined, { month: 'short' })}
      </span>
      <span className="text-heading-18 leading-none mt-0.5 text-[var(--color-brand-text)]">{d.getDate()}</span>
    </div>
  );
}

function SectionHeading({ title, action }) {
  return (
    <div className="flex justify-between items-center">
      <h2 className="text-heading-20 font-bold text-[var(--modes-text)]">{title}</h2>
      {action}
    </div>
  );
}

export default function Dashboard({
  songs,
  setlists,
  settings,
  onSelectSong,
  onNewSong,
  onNewSetlist,
  onViewSetlist,
  onPlaySetlist,
  onGoLibrary,
  onGoSetlists,
  onOpenSchedule,
  hasCloud,
  checklistActions,
  onDismissChecklist,
  onUpdateSettings,
  syncState,
  canEdit = true,
  onSignIn,
}) {
  const { team, members, isAdmin, canManageBand } = useTeam();
  const { user } = useAuth();
  const { schedules, updateSchedule } = useTeamSchedules(team?.id);
  const { availability, setStatus: setAvailabilityStatus, clearStatus: clearAvailabilityStatus } = useTeamAvailability(team?.id);
  const { map: setlistMap } = useTeamSetlistMap(team?.id);
  const resolveScheduleSetlist = (schedule) =>
    setlists.find(l => l.id === schedule.setlist_id || setlistMap[l.id] === schedule.setlist_id) || null;
  const pendingRequests = (schedules || []).filter(s => s.user_id === user?.id && s.availability === 'pending');

  // Day-detail modal opened from the My-schedule widget. Mirrors the wiring in
  // Schedule.jsx so the same DateStatusModal works on the dashboard.
  const [pickerDate, setPickerDate] = useState(null);
  const pickerDateStr = pickerDate ? toLocalDateStr(pickerDate) : null;
  const pickerStatus = pickerDateStr
    ? availability.find(a => a.user_id === user?.id && a.date === pickerDateStr)?.status || null
    : null;
  const pickerAvailableCount = pickerDateStr
    ? availability.filter(a => a.date === pickerDateStr && a.status === 'available').length
    : 0;
  const pickerSetlists = pickerDateStr ? setlists.filter(sl => sl.date === pickerDateStr) : [];
  const pickerRehearsals = pickerDateStr ? setlists.filter(sl => sl.rehearsalDate === pickerDateStr) : [];
  const pickerMemberStatuses = pickerDateStr
    ? (members || []).map(m => ({
        id: m.user_id,
        name: m.profile?.display_name || m.profile?.email?.split('@')[0] || 'Member',
        avatarUrl: m.profile?.avatar_url || null,
        isYou: m.user_id === user?.id,
        status: availability.find(a => a.user_id === m.user_id && a.date === pickerDateStr)?.status || 'pending',
      }))
    : [];
  const handlePickerSetStatus = async (status) => {
    if (!pickerDate) return;
    try { await setAvailabilityStatus(pickerDate, status); } catch (err) { console.error('[dashboard] set availability failed:', err); }
    setPickerDate(null);
  };
  const handlePickerClear = async () => {
    if (!pickerDate) return;
    try { await clearAvailabilityStatus(pickerDate); } catch (err) { console.error('[dashboard] clear availability failed:', err); }
    setPickerDate(null);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);

  // Recently edited songs (latest first). Sort by the real edit timestamp —
  // ids are base-36 strings, so subtracting them yields NaN and leaves the
  // list in insertion order (the old bug that showed the wrong "latest").
  const latestSongs = [...songs]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 5);

  const now = new Date();
  // Upcoming until the set actually *ends* (its end time, or 1h after start) —
  // so a service stays here through its slot instead of vanishing at start.
  const upcomingSetlists = [...setlists]
    .filter(sl => isSetlistUpcoming(sl, now.getTime()))
    .sort((a, b) => setlistStartMs(a) - setlistStartMs(b))
    .slice(0, 6);

  const songCountOf = (sl) => (sl.items || []).filter(i => i.songId).length;

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const userName = settings?.userName || 'Guest';

  const searchResults = searchQuery.trim()
    ? songs.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.artist?.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 8)
    : [];

  useEffect(() => {
    const handler = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) setSearchFocused(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setSearchFocused(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const formatDateFriendly = (ds) => {
    if (!ds) return 'Tonight';
    const date = new Date(ds + 'T12:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.getTime() === today.getTime()) return 'Tonight';
    if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const formatTimeFriendly = (timeStr) => {
    const fallback = settings?.clockFormat === '24h' ? '20:00' : '8:00 PM';
    if (!timeStr) return fallback;
    return formatClockTime(timeStr, settings?.clockFormat || '12h');
  };

  // ── Widget order + visibility (synced via settings) ──────────────────────
  // Saved order first (valid ids only), then any new widgets appended.
  const savedOrder = Array.isArray(settings?.dashboardWidgetOrder) ? settings.dashboardWidgetOrder : [];
  const order = [
    ...savedOrder.filter(id => DEFAULT_ORDER.includes(id)),
    ...DEFAULT_ORDER.filter(id => !savedOrder.includes(id)),
  ];
  const hidden = new Set(Array.isArray(settings?.dashboardHidden) ? settings.dashboardHidden : []);

  const isEligible = (w) => (w.requires !== 'team' || !!team) && (w.requires !== 'auth' || !!user);
  const saveOrder = (next) => onUpdateSettings?.('dashboardWidgetOrder', next);
  const moveWidget = (id, dir) => {
    const i = order.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    saveOrder(next);
  };
  const toggleWidget = (id) => {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id); else next.add(id);
    onUpdateSettings?.('dashboardHidden', [...next]);
  };

  // ── Widget renderers (return null to render nothing) ─────────────────────
  const widgets = {
    nextup: () => upcomingSetlists.length === 0 ? null : (
      <section>
        <div
          className="modes-card-strong p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 cursor-pointer hover:bg-[var(--modes-surface-strong)] transition-colors"
          onClick={() => onViewSetlist(upcomingSetlists[0])}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <DateChip date={upcomingSetlists[0].date} />
            <div className="min-w-0">
              <div className="text-label-11 uppercase tracking-wider font-semibold text-[var(--color-brand-text)]">Next up</div>
              <h3 className="text-heading-20 font-bold text-[var(--modes-text)] truncate m-0">{upcomingSetlists[0].name || 'Untitled Setlist'}</h3>
              <div className="text-label-13 text-[var(--modes-text-muted)] truncate">
                {formatDateFriendly(upcomingSetlists[0].date)} · {formatTimeFriendly(upcomingSetlists[0].time)}
                {upcomingSetlists[0].location ? ` · ${upcomingSetlists[0].location}` : ''}
                {' · '}{songCountOf(upcomingSetlists[0])} song{songCountOf(upcomingSetlists[0]) !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <Button variant="brand" className="shrink-0" onClick={(e) => { e.stopPropagation(); onPlaySetlist(upcomingSetlists[0]); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="mr-1.5"><path d="M8 5v14l11-7z"/></svg>
            Play
          </Button>
        </div>
      </section>
    ),

    thisweek: () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const end = new Date(today); end.setDate(end.getDate() + 7);
      const toDate = (ds) => ds ? new Date(ds + 'T12:00:00') : null;
      // Hide events that have already happened. Timed events drop after their
      // start time; untimed events linger until the end of their day. Reuse the
      // component-scope `now` (Date.now() is flagged impure in render).
      const nowTs = now.getTime();
      const notPast = (ds, ts) => new Date(`${ds}T${ts || '23:59'}:00`).getTime() >= nowTs;
      const events = [];
      for (const sl of setlists) {
        const sd = toDate(sl.date);
        if (sd && sd <= end && notPast(sl.date, sl.time)) events.push({ kind: 'service', date: sl.date, time: sl.time, sl });
        const rd = toDate(sl.rehearsalDate);
        if (rd && rd <= end && notPast(sl.rehearsalDate, sl.rehearsalTime)) events.push({ kind: 'rehearsal', date: sl.rehearsalDate, time: sl.rehearsalTime, sl });
      }
      events.sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`));
      if (!events.length) return null;
      return (
        <section className="flex flex-col gap-3 sm:gap-4">
          <SectionHeading title="This week" />
          <div className="modes-card overflow-hidden divide-y divide-[var(--modes-border)]">
            {events.slice(0, 6).map((ev, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--modes-surface)] transition-colors" onClick={() => onViewSetlist(ev.sl)}>
                <DateChip date={ev.date} />
                <div className="flex-1 min-w-0">
                  <div className="text-copy-15 font-semibold text-[var(--modes-text)] truncate">{ev.sl.name || 'Untitled Setlist'}</div>
                  <div className="text-label-13 text-[var(--modes-text-muted)] truncate">
                    {formatDateFriendly(ev.date)} · {formatTimeFriendly(ev.time)}
                  </div>
                </div>
                <span
                  className={`shrink-0 text-label-11 font-semibold px-2 py-0.5 rounded-full ${
                    ev.kind === 'rehearsal'
                      ? 'bg-[var(--ds-blue-100)] text-[var(--ds-blue-900)]'
                      : 'bg-[var(--ds-teal-100)] text-[var(--ds-teal-1000)]'
                  }`}
                >
                  {ev.kind === 'rehearsal' ? 'Rehearsal' : 'Service'}
                </span>
              </div>
            ))}
          </div>
        </section>
      );
    },

    schedule: () => !user ? null : (
      <section className="flex flex-col gap-3 sm:gap-4">
        <CalendarWidget
          setlists={setlists}
          schedules={schedules}
          setlistMap={setlistMap}
          userId={user.id}
          onDateClick={onViewSetlist}
          onDayClick={team ? (date) => setPickerDate(date) : undefined}
          availability={team ? availability : null}
          onOpenSchedule={team ? onOpenSchedule : undefined}
        />
      </section>
    ),

    pending: () => (!user || pendingRequests.length === 0) ? null : (
      <section className="flex flex-col gap-3 sm:gap-4">
        <SectionHeading title="Pending Requests" />
        <div className="flex flex-col gap-3">
          {pendingRequests.map(schedule => {
            const sl = resolveScheduleSetlist(schedule);
            const part = [schedule.role, schedule.vocal_part].filter(Boolean).join(' · ');
            return (
              <div key={schedule.id} className="modes-card p-4 flex items-center justify-between gap-3">
                <div
                  className={`flex flex-col min-w-0 ${sl ? 'cursor-pointer' : ''}`}
                  role={sl ? 'button' : undefined}
                  tabIndex={sl ? 0 : undefined}
                  onClick={sl ? () => onViewSetlist(sl) : undefined}
                  onKeyDown={sl ? (e) => { if (e.key === 'Enter') onViewSetlist(sl); } : undefined}
                >
                  <span className="text-copy-16 font-bold truncate text-[var(--modes-text)] hover:underline">{sl?.name || 'Team service'}</span>
                  <span className="text-label-13 text-[var(--modes-text-muted)]">
                    {sl?.date
                      ? new Date(sl.date + 'T' + (sl.time || '00:00')).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
                      : 'Date TBD'}{part ? ` • ${part}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="secondary" onClick={() => updateSchedule(schedule.id, { availability: 'unavailable' })}>Decline</Button>
                  <Button size="sm" variant="brand" onClick={() => updateSchedule(schedule.id, { availability: 'available' })}>Accept</Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    ),

    upcoming: () => (upcomingSetlists.length <= 1) ? null : (
      <section className="flex flex-col gap-3 sm:gap-4">
        <SectionHeading
          title={team ? 'Upcoming Services' : 'Upcoming Setlists'}
          action={<Button variant="ghost" size="sm" onClick={onGoSetlists} className="text-[var(--color-brand)] hover:text-[var(--color-brand)] hover:bg-white/5">View All</Button>}
        />
        <div className="modes-card overflow-hidden divide-y divide-[var(--modes-border)]">
          {upcomingSetlists.slice(1).map(sl => (
            <div key={sl.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--modes-surface)] transition-colors" onClick={() => onViewSetlist(sl)}>
              <DateChip date={sl.date} />
              <div className="flex-1 min-w-0">
                <div className="text-copy-15 font-semibold text-[var(--modes-text)] truncate">{sl.name || 'Untitled Setlist'}</div>
                <div className="text-label-13 text-[var(--modes-text-muted)] truncate">
                  {formatDateFriendly(sl.date)} · {formatTimeFriendly(sl.time)} · {songCountOf(sl)} song{songCountOf(sl) !== 1 ? 's' : ''}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onPlaySetlist(sl); }}
                aria-label="Play"
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-transparent border-none cursor-pointer text-[var(--modes-text-muted)] hover:text-[var(--color-brand)] hover:bg-[var(--modes-surface-strong)] transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              </button>
            </div>
          ))}
        </div>
      </section>
    ),

    availability: () => {
      // Leader tool: spot coverage gaps across the next month of services,
      // using the team's date availability (team_availability). Hidden for
      // non-leaders — members get their own "My schedule" widget instead.
      if (!team || !isAdmin) return null;
      const totalMembers = (members || []).length;
      const nowTs = now.getTime();
      const monthEnd = new Date(now); monthEnd.setDate(monthEnd.getDate() + 31);
      const services = [...setlists]
        .filter(sl => sl.date)
        .map(sl => ({ sl, dt: new Date(`${sl.date}T${sl.time || '23:59'}:00`) }))
        .filter(({ dt }) => dt.getTime() >= nowTs && dt <= monthEnd)
        .sort((a, b) => a.dt - b.dt)
        .slice(0, 6);
      if (!services.length) return null;

      const statsFor = (dateStr) => {
        const rows = (availability || []).filter(a => a.date === dateStr);
        const available = rows.filter(a => a.status === 'available').length;
        const maybe = rows.filter(a => a.status === 'maybe').length;
        const unavailable = rows.filter(a => a.status === 'unavailable').length;
        const noReply = Math.max(0, totalMembers - rows.length);
        // Flag a gap when nobody's confirmed yet, or confirmed < half the team.
        const needsAttention = available === 0 || (totalMembers > 0 && available < Math.ceil(totalMembers / 2));
        return { available, maybe, unavailable, noReply, needsAttention };
      };

      return (
        <section className="flex flex-col gap-3 sm:gap-4">
          <SectionHeading
            title="Team availability"
            action={onOpenSchedule && <Button variant="ghost" size="sm" onClick={onOpenSchedule} className="text-[var(--color-brand)] hover:text-[var(--color-brand)] hover:bg-white/5">Full schedule</Button>}
          />
          <div className="modes-card overflow-hidden divide-y divide-[var(--modes-border)]">
            {services.map(({ sl }) => {
              const st = statsFor(sl.date);
              return (
                <button
                  key={sl.id}
                  type="button"
                  onClick={() => setPickerDate(new Date(`${sl.date}T12:00:00`))}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-transparent border-none text-left cursor-pointer hover:bg-[var(--modes-surface)] transition-colors"
                >
                  <DateChip date={sl.date} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-copy-15 font-semibold text-[var(--modes-text)] truncate">{sl.name || 'Untitled service'}</span>
                      {st.needsAttention && (
                        <span className="shrink-0 text-label-11 font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--ds-red-100)', color: 'var(--ds-red-800)' }}>
                          Needs cover
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-label-12 text-[var(--modes-text-muted)]">
                      <span style={{ color: 'var(--ds-green-700)' }}>{st.available} in</span>
                      {st.maybe > 0 && <span style={{ color: 'var(--ds-amber-700)' }}>{st.maybe} maybe</span>}
                      {st.unavailable > 0 && <span style={{ color: 'var(--ds-red-700)' }}>{st.unavailable} out</span>}
                      {st.noReply > 0 && <span>{st.noReply} no reply</span>}
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--modes-text-dim)]"><path d="m9 18 6-6-6-6" /></svg>
                </button>
              );
            })}
          </div>
        </section>
      );
    },

    activity: () => !team ? null : (
      <section className="flex flex-col gap-3 sm:gap-4">
        <SectionHeading title="Recent Activity" />
        <div className="modes-card p-2">
          <ActivityFeed teamId={team.id} members={members} compact />
        </div>
      </section>
    ),

    stats: () => {
      const distinctKeys = new Set(songs.map(s => s.key).filter(Boolean)).size;
      const Stat = ({ n, label }) => (
        <div className="flex-1 flex flex-col items-center py-3">
          <span className="text-heading-28 font-bold text-[var(--modes-text)]">{n}</span>
          <span className="text-label-12 text-[var(--modes-text-muted)]">{label}</span>
        </div>
      );
      return (
        <section className="flex flex-col gap-3 sm:gap-4">
          <SectionHeading title="Library" />
          <div className="modes-card flex divide-x divide-[var(--modes-border)]">
            <Stat n={songs.length} label="Songs" />
            <Stat n={setlists.length} label="Setlists" />
            <Stat n={distinctKeys} label="Keys" />
          </div>
        </section>
      );
    },

    sync: () => {
      const state = syncState?.state;
      const provider = syncState?.provider;
      const last = syncState?.lastSync ? new Date(syncState.lastSync) : null;
      const tone = state === 'error' ? 'var(--ds-red-700)' : state === 'syncing' ? 'var(--ds-amber-700)' : hasCloud ? 'var(--ds-green-700)' : 'var(--modes-text-muted)';
      const label = !hasCloud
        ? 'Saved on this device'
        : state === 'error' ? 'Sync error'
        : state === 'syncing' ? 'Syncing…'
        : 'Synced';
      const sub = !hasCloud
        ? 'Connect cloud sync in Settings to back up across devices.'
        : `${provider ? provider.replace(/^supabase-team:.*/, 'Team cloud').replace(/^(\w)/, c => c.toUpperCase()) : 'Cloud'}${last ? ` · ${last.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}`;
      return (
        <section className="flex flex-col gap-3 sm:gap-4">
          <div className="modes-card p-4 flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: tone }} />
            <div className="flex-1 min-w-0">
              <div className="text-copy-15 font-semibold text-[var(--modes-text)]">{label}</div>
              <div className="text-label-13 text-[var(--modes-text-muted)] truncate">{sub}</div>
            </div>
          </div>
        </section>
      );
    },

    recent: () => (
      <section className="flex flex-col gap-3 sm:gap-4">
        <SectionHeading
          title="Recently Edited"
          action={<Button variant="ghost" size="sm" onClick={onGoLibrary} className="text-[var(--color-brand)] hover:text-[var(--color-brand)] hover:bg-white/5">Full Library</Button>}
        />
        <div className="modes-card overflow-hidden divide-y divide-[var(--modes-border)]" style={{ borderColor: 'var(--modes-border)' }}>
          {latestSongs.map(song => (
            <SongCard key={song.id} song={song} variant="row" onClick={() => onSelectSong(song)} />
          ))}
          {latestSongs.length === 0 && (
            <div className="py-14 text-center flex flex-col items-center gap-3">
              <p className="text-copy-14 text-[var(--modes-text-muted)] font-medium">Your library is empty.</p>
              {canEdit && onNewSong && (
                <Button variant="brand" size="sm" onClick={onNewSong}>Add Your First Song</Button>
              )}
            </div>
          )}
        </div>
      </section>
    ),
  };

  return (
    <div className="min-h-screen pb-[140px] sm:pb-8" data-theme-variant="modes">

      {/* Header: Welcome + Search + Actions */}
      <div className="max-w-[1320px] mx-auto w-full px-4 sm:px-8 pt-6 sm:pt-10 pb-4 sm:pb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h1 className="text-heading-40 text-[var(--modes-text)] m-0">
            Welcome, <span className="italic font-serif text-[var(--modes-text)]">{userName}</span>
          </h1>
          <p className="text-copy-16 text-[var(--modes-text-muted)] mt-1">{dateStr}</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-72 hidden sm:block" ref={searchContainerRef}>
            <SearchBar
              ref={searchInputRef}
              placeholder="Search library…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
            />
            {searchFocused && searchQuery.trim().length > 0 && (
              <div
                className="absolute top-full right-0 left-0 sm:left-auto sm:w-80 mt-2 rounded-xl border border-[var(--modes-border)] backdrop-blur-md shadow-xl z-50 overflow-hidden divide-y divide-[var(--modes-border)] max-h-[400px] overflow-y-auto"
                style={{ background: 'color-mix(in srgb, var(--modes-bg) 92%, transparent)' }}
              >
                {searchResults.length > 0 ? (
                  searchResults.map(song => (
                    <div key={song.id} className="hover:bg-white/5 cursor-pointer">
                      <SongCard song={song} variant="row" onClick={() => { setSearchFocused(false); setSearchQuery(''); onSelectSong(song); }} />
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-6 text-center text-copy-14 text-white/60">No songs found.</div>
                )}
              </div>
            )}
          </div>

          <div className="items-center gap-2 mt-2 sm:mt-0 hidden sm:flex">
            {canEdit && onNewSong && <Button variant="secondary" onClick={onNewSong}>New Song</Button>}
            {canEdit && onNewSetlist && <Button variant="brand" onClick={onNewSetlist}>New Setlist</Button>}
            <IconButton variant="ghost" size="md" onClick={() => setCustomizeOpen(true)} aria-label="Customize dashboard" title="Customize dashboard">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
              </svg>
            </IconButton>
          </div>
        </div>
      </div>

      <div className="max-w-[1320px] mx-auto w-full px-4 sm:px-8 py-4 sm:py-8 flex flex-col gap-6 sm:gap-8">

        {/* Transient items always pinned to the top (not customizable). */}
        {!settings?.checklistDismissed && checklistActions && (
          <ProgressChecklist
            settings={settings}
            songs={songs}
            setlists={setlists}
            hasCloud={hasCloud}
            actions={checklistActions}
            onDismiss={onDismissChecklist}
          />
        )}
        {user && <PushPromptCard />}
        {!user && onSignIn && (
          <div className="modes-card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-copy-16 font-semibold text-[var(--modes-text)] m-0">Save your work across devices</p>
              <p className="text-copy-14 text-[var(--modes-text-muted)] mt-1 m-0">
                Create a free account to sync your songs and setlists — or sign in if you already have one.
              </p>
            </div>
            <Button variant="brand" onClick={onSignIn}>Sign in / Sign up</Button>
          </div>
        )}

        {/* Reorderable widgets */}
        {order.map(id => {
          if (hidden.has(id)) return null;
          const meta = WIDGET_META.find(w => w.id === id);
          if (!meta || !isEligible(meta)) return null;
          const node = widgets[id]?.();
          return node ? <React.Fragment key={id}>{node}</React.Fragment> : null;
        })}

        {/* Mobile customize entry */}
        <button
          type="button"
          onClick={() => setCustomizeOpen(true)}
          className="sm:hidden self-center text-label-13 text-[var(--modes-text-muted)] bg-transparent border-none cursor-pointer py-2"
        >
          Customize dashboard
        </button>
      </div>

      <BottomSheet open={customizeOpen} onClose={() => setCustomizeOpen(false)} title="Customize dashboard">
        <div className="flex flex-col gap-1">
          <p className="text-copy-13 text-[var(--modes-text-muted)] m-0 pb-2">Show, hide, and reorder your dashboard widgets.</p>
          {order.map((id, idx) => {
            const meta = WIDGET_META.find(w => w.id === id);
            if (!meta || !isEligible(meta)) return null;
            const isHidden = hidden.has(id);
            return (
              <div key={id} className="flex items-center gap-2 py-2 border-b border-[var(--modes-border)] last:border-0">
                <span className={`flex-1 text-copy-14 ${isHidden ? 'text-[var(--modes-text-dim)]' : 'text-[var(--modes-text)]'}`}>{meta.label}</span>
                <IconButton variant="ghost" size="sm" onClick={() => moveWidget(id, -1)} disabled={idx === 0} aria-label="Move up">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
                </IconButton>
                <IconButton variant="ghost" size="sm" onClick={() => moveWidget(id, 1)} disabled={idx === order.length - 1} aria-label="Move down">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                </IconButton>
                <Button variant={isHidden ? 'secondary' : 'ghost'} size="sm" onClick={() => toggleWidget(id)} className="w-16">
                  {isHidden ? 'Show' : 'Hide'}
                </Button>
              </div>
            );
          })}
        </div>
      </BottomSheet>

      {pickerDate && (
        <DateStatusModal
          date={pickerDate}
          currentStatus={pickerStatus}
          availableCount={pickerAvailableCount}
          totalMembers={(members || []).length}
          setlists={pickerSetlists}
          rehearsals={pickerRehearsals}
          memberStatuses={pickerMemberStatuses}
          canViewTeam={canManageBand}
          clockFormat={settings?.clockFormat || '12h'}
          onSetStatus={handlePickerSetStatus}
          onClear={handlePickerClear}
          onOpenSetlist={(sl) => { setPickerDate(null); onViewSetlist?.(sl); }}
          onClose={() => setPickerDate(null)}
        />
      )}
    </div>
  );
}
