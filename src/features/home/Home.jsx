import { useMemo, useState } from 'react';
import { useTeam } from '@/auth/useTeam';
import { useAuth } from '@/auth/useAuth';
import { useTeamAvailability } from '@/hooks/useTeamAvailability';
import { useTeamActivity } from '@/hooks/useTeamActivity';
import { usePushSubscription } from '@/push/usePushSubscription';
import {
  myAsks, myServices, nextUp, daysUntil, bandFor, twoWeeks, whoCanPlay, needsYou, recentActivity, activityFromSongs,
} from '@/lib/homeData';
import HomeView from './HomeView';
import { partLabel } from '@/data/instruments';

// Home: works out what to show from the library, the schedule and the team,
// and hands it to HomeView. Schedules and the row-id map come from App, which
// already keeps them live for the bell.

function syncLine(syncState, now) {
  if (!syncState?.provider) return { state: 'offline', label: 'On this device only' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { state: 'offline', label: 'Offline' };
  if (syncState.state === 'error') return { state: 'error', label: 'Not synced' };
  if (syncState.state === 'syncing') return { state: 'pending', label: 'Syncing…' };
  const mins = syncState.lastSync ? Math.round((now - new Date(syncState.lastSync).getTime()) / 60000) : null;
  return { state: 'ok', label: mins == null || mins < 2 ? 'Up to date' : `Up to date · ${mins < 60 ? `${mins} min` : `${Math.round(mins / 60)} h`} ago` };
}

export default function Home({
  songs = [], setlists = [], settings, displayName, syncState,
  schedules = [], updateSchedule, setlistMap = {},
  onOpenSetlist, onOpenSong, onOpenSongs, onOpenSchedule, onOpenTeam, onEditSetlist, onMarkReady,
  install, // { onInstall } when this device can still put the app on the home screen
}) {
  const { user } = useAuth();
  const { team, members, isAdmin, canManageBand, joinRequests = [] } = useTeam();
  const leader = !!team && (isAdmin || canManageBand);
  const { availability } = useTeamAvailability(leader ? team?.id : null);
  const { activity: activityRows } = useTeamActivity(team?.id, { limit: 60 });
  const push = usePushSubscription();
  // Render-time clock: one read per render keeps the derived lists consistent.
  const [now] = useState(() => Date.now());
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState(null);
  const userId = user?.id;
  const inTeam = !!team;

  const asks = useMemo(() => myAsks({ schedules, userId, setlists, setlistMap, now }), [schedules, userId, setlists, setlistMap, now]);
  const plays = useMemo(() => myServices({ schedules, userId, setlists, setlistMap, now }), [schedules, userId, setlists, setlistMap, now]);
  const next = useMemo(() => {
    const n = nextUp({ setlists, schedules, userId, setlistMap, now, inTeam, leader });
    if (!n) return null;
    const rows = inTeam ? bandFor(n.setlist, schedules, setlistMap) : [];
    const nameOf = (uid) => {
      const m = (members || []).find(x => x.user_id === uid);
      return m?.profile?.display_name || m?.profile?.email?.split('@')[0] || 'Member';
    };
    return {
      setlist: n.setlist,
      part: n.schedule ? partLabel(n.schedule) || null : null,
      band: rows.map(r => ({ id: r.id, name: nameOf(r.user_id), yes: r.availability === 'available' })),
      days: daysUntil(n.setlist, now),
    };
  }, [setlists, schedules, userId, setlistMap, now, inTeam, leader, members]);

  // Personal library: every dated setlist is "yours".
  const stripPlays = inTeam ? plays : setlists.filter(sl => sl.date).map(setlist => ({ setlist }));
  const days = twoWeeks({ now, weekStart: settings?.firstDayOfWeek === 'monday' ? 'monday' : 'sunday', offset, setlists, plays: stripPlays, asks });
  // The day under the strip: the one picked, else the first day ahead with something on.
  const firstBusy = days.find(d => !d.isPast && (d.play || d.asked || d.services.length || d.rehearsals.length));
  const selected = picked && days.some(d => d.date === picked) ? picked : (firstBusy || days.find(d => d.isToday) || days[0])?.date;

  const needs = leader ? needsYou({ joinRequests, setlists, schedules, setlistMap, now }) : [];
  const onNeed = (it) => {
    if (it.kind === 'join') onOpenTeam?.();
    else if (it.kind === 'nosongs') (onEditSetlist || onOpenSetlist)?.(it.setlist);
    else onOpenSetlist?.(it.setlist);
  };

  const setup = inTeam && !leader ? [
    { id: 'join', label: `Join ${team.name}`, done: true },
    ...(install ? [{ id: 'install', label: 'Put the app on your home screen', done: false, onClick: install.onInstall }] : []),
    ...(push.supported && !push.denied
      ? [{ id: 'push', label: 'Turn on notifications', hint: 'So you hear when you are asked to play', done: push.subscribed, onClick: () => push.enable() }]
      : []),
  ] : null;

  const nameOf = (uid) => {
    const m = (members || []).find(x => x.user_id === uid);
    return m?.profile?.display_name || m?.profile?.email?.split('@')[0] || null;
  };
  const activity = inTeam ? recentActivity(activityRows, { nameFor: nameOf, userId }) : activityFromSongs(songs);
  // Activity rows name the server row; find the local copy by row map, then by name.
  const openActivity = (it) => {
    if (it.kind === 'song') {
      const song = songs.find(s => s.id === it.songId) || songs.find(s => s.title === it.object);
      if (song) onOpenSong?.(song);
    } else if (it.kind === 'setlist') {
      const sl = setlists.find(x => setlistMap[x.id] === it.rowId) || setlists.find(x => x.name === it.object);
      if (sl) onOpenSetlist?.(sl);
    }
  };

  const first = (displayName || '').trim().split(/\s+/)[0] || 'there';
  const dateLabel = new Date(now).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <HomeView
      name={first}
      dateLabel={dateLabel}
      sync={syncLine(syncState, now)}
      leader={leader}
      clockFormat={settings?.clockFormat || '12h'}
      needs={needs}
      onNeed={onNeed}
      asks={asks}
      onAnswer={(id, availabilityValue) => updateSchedule?.(id, { availability: availabilityValue })}
      next={next}
      onOpenSetlist={onOpenSetlist}
      onMarkReady={onMarkReady}
      strip={{ days, offset, onOffset: setOffset, selected, onSelect: setPicked }}
      whoCanPlay={leader ? whoCanPlay({ setlists, availability, schedules, setlistMap, memberCount: (members || []).length, now }) : null}
      onOpenSchedule={onOpenSchedule}
      setup={setup}
      activity={activity}
      now={now}
      onOpenActivity={openActivity}
      onOpenSongs={onOpenSongs}
      showNothingPlanned={!next && asks.length === 0}
    />
  );
}
