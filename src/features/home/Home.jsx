import { useEffect, useMemo, useState } from 'react';
import { FileText, List, Music } from 'lucide-react';
import { useTeam } from '@/auth/useTeam';
import { useAuth } from '@/auth/useAuth';
import { useTeamActivity } from '@/hooks/useTeamActivity';
import {
  myAsks, myServices, nextUp, syncProblem, daysUntil, bandFor, twoWeeks, needsYou, recentActivity, activityFromSongs, setupSteps,
} from '@/lib/homeData';
import { needsCheck } from '@/lib/importCheck';
import { usePushSubscription } from '@/push/usePushSubscription';
import HomeView from './HomeView';
import { HomeSkeleton } from '@/ui/AppSkeleton';
import { partLabel, normalize } from '@/data/instruments';
import { PartsSheet } from '@/features/team/PartsPicker';
import { membersWithoutParts } from '@/lib/memberInstruments';
import { useNow } from '@/hooks/useNow';
import { setlistStartMs } from '@/lib/setlistTime';
import AddSongFlow from '@/features/songs/AddSongFlow';
import { supabase } from '@/auth/supabase';
import { sendChurchRequest, sentChurchRequest, rememberChurchRequest } from '@/lib/churchRequest';
import { signupSource } from '@/lib/siteEntry';
import { StartChurchCard, StartChurchSheet } from './StartChurch';

// Home: works out what to show from the library, the schedule and the team,
// and hands it to HomeView. Schedules and the row-id map come from App, which
// already keeps them live for the bell.


export default function Home({
  songs = [], setlists = [], settings, displayName, syncState,
  schedules = [], updateSchedule, setlistMap = {},
  onOpenSetlist, onPlaySetlist, onOpenSong, onOpenSongs, onOpenSchedule, onOpenTeam, onEditSetlist, onMarkReady, onNewSetlist,
  canAddSongs = false, onImportSongs, onImportSetlistFile, onEditImported, onBlank, onSetupDone, onRetrySync, onNotFound,
}) {
  // New song and Import open their sheets here, on Home, not on Songs.
  const [adding, setAdding] = useState(null); // null | 'add' | 'new' | 'import'
  const { user } = useAuth();
  const { team, teams = [], teamsLoaded, members, membersReady = true, isAdmin, canManageBand, canSetParts, updateMyInstruments, joinRequests = [] } = useTeam();
  const leader = !!team && (isAdmin || canManageBand);
  const { activity: activityRows, ready: activityReady } = useTeamActivity(team?.id, { limit: 60, userId: user?.id || null });
  // Draw Home whole: names, faces and the activity feed together, not one
  // block at a time (owner, 21 Nov 2026). A grey Home until they're in; a
  // slow or offline connection gets what's there after 2.5 s.
  const [waitedOut, setWaitedOut] = useState(false);
  const dataReady = !team || (activityReady && membersReady);
  useEffect(() => {
    if (dataReady) return undefined;
    const t = setTimeout(() => setWaitedOut(true), 2500);
    return () => clearTimeout(t);
  }, [dataReady]);
  const homeReady = dataReady || waitedOut;
  // Render-time clock: one read per render keeps the derived lists consistent.
  const [now] = useState(() => Date.now());
  const ticking = useNow(60000, syncState?.state === 'error');
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
    const memberOf = (uid) => (members || []).find(x => x.user_id === uid);
    const nameOf = (uid) => {
      const m = memberOf(uid);
      return m?.profile?.display_name || m?.profile?.email?.split('@')[0] || 'Member';
    };
    return {
      setlist: n.setlist,
      part: n.schedule ? partLabel(n.schedule) || null : null,
      band: rows.map(r => ({ id: r.id, name: nameOf(r.user_id), avatarUrl: memberOf(r.user_id)?.profile?.avatar_url || null, yes: r.availability === 'available' })),
      days: daysUntil(n.setlist, now),
      // Started and not over: Home keeps it as "On now" until it ends.
      onNow: !!n.setlist.time && setlistStartMs(n.setlist) <= now,
    };
  }, [setlists, schedules, userId, setlistMap, now, inTeam, leader, members]);

  const stripPlays = inTeam ? plays : [];
  const days = twoWeeks({ now, weekStart: settings?.firstDayOfWeek === 'monday' ? 'monday' : 'sunday', offset, setlists, plays: stripPlays, asks });
  // The day under the strip: the one picked, else the first day ahead with something on.
  const firstBusy = days.find(d => !d.isPast && (d.play || d.asked || d.services.length || d.rehearsals.length));
  const selected = picked && days.some(d => d.date === picked) ? picked : (firstBusy || days.find(d => d.isToday) || days[0])?.date;

  // What you play: a step on the one-time checklist (church only, once the roster is in).
  const church = inTeam;
  const myMember = church ? (members || []).find(m => m.user_id === userId) : null;
  const myParts = useMemo(() => Array.from(new Set((myMember?.instruments || []).map(normalize).filter(Boolean))), [myMember?.instruments]);
  const [partsOpen, setPartsOpen] = useState(false);
  // Leaders: who else hasn't said.
  const noParts = church && canSetParts
    ? membersWithoutParts((members || []).filter(m => m.user_id !== userId))
      .map(m => m.profile?.display_name || m.profile?.email?.split('@')[0] || 'Someone')
    : [];

  const toCheck = leader ? songs.filter(needsCheck).length : 0;
  const needs = leader
    ? [...needsYou({ joinRequests, setlists, schedules, setlistMap, now, noParts }), ...(toCheck ? [{ kind: 'check', count: toCheck }] : [])]
    : [];
  const onNeed = (it) => {
    if (it.kind === 'check') onOpenSongs?.();
    else if (it.kind === 'join' || it.kind === 'parts') onOpenTeam?.();
    else if (it.kind === 'nosongs') (onEditSetlist || onOpenSetlist)?.(it.setlist);
    else onOpenSetlist?.(it.setlist);
  };


  const nameOf = (uid) => {
    const m = (members || []).find(x => x.user_id === uid);
    return m?.profile?.display_name || m?.profile?.email?.split('@')[0] || null;
  };
  const avatarOf = (uid) => (members || []).find(x => x.user_id === uid)?.profile?.avatar_url || null;
  // Three rows show and the rest scroll inside the card, so hand it a dozen.
  const activity = inTeam ? recentActivity(activityRows, { nameFor: nameOf, avatarFor: avatarOf, userId, limit: 12 }) : activityFromSongs(songs, 12);

  // Get ready: once per account, in a church, until every step is done or
  // it's hidden (owner, 2026-11-15: "should only be showed once").
  const push = usePushSubscription();
  const answered = useMemo(
    () => !!userId && schedules.some(s => s.user_id === userId && s.availability && s.availability !== 'pending'),
    [schedules, userId],
  );
  const steps = church && myMember && !settings?.homeSetupDone
    ? setupSteps({ leader, songs, setlists, memberCount: (members || []).length, hasParts: myParts.length > 0, push, answered })
    : null;
  const allDone = !!steps && steps.every(s => s.done);
  useEffect(() => { if (allDone) onSetupDone?.(); }, [allDone]); // eslint-disable-line react-hooks/exhaustive-deps
  const onStep = (id) => {
    if (id === 'song' && canAddSongs) setAdding('new');
    else if (id === 'import' && canAddSongs) setAdding('import');
    else if (id === 'parts') setPartsOpen(true);
    else if (id === 'setlist') onNewSetlist?.();
    else if (id === 'invite') onOpenTeam?.();
    else if (id === 'push') push.enable?.();
    else if (id === 'answer') onOpenSchedule?.();
  };
  const setup = steps && !allDone
    ? { title: leader ? 'Get your band ready' : 'Get ready to play', steps, onStep, onHide: () => onSetupDone?.() }
    : null;

  // The + menu: the three ways to start something a leader has.
  const create = [
    canAddSongs && { icon: Music, label: 'New song', onSelect: () => setAdding('new') },
    canAddSongs && onImportSongs && { icon: FileText, label: 'Import PDFs', onSelect: () => setAdding('import') },
    onNewSetlist && { icon: List, label: 'New setlist', onSelect: onNewSetlist, divider: true },
  ].filter(Boolean);
  // Activity rows name the server row; find the local copy by row map, then by name.
  const openActivity = (it) => {
    if (it.kind === 'song') {
      const song = songs.find(s => s.id === it.songId) || songs.find(s => s.title === it.object);
      if (song) onOpenSong?.(song);
      else onNotFound?.('song');
    } else if (it.kind === 'setlist') {
      const sl = setlists.find(x => setlistMap[x.id] === it.rowId) || setlists.find(x => x.name === it.object);
      if (sl) onOpenSetlist?.(sl);
      else onNotFound?.('setlist');
    }
  };

  // No church yet (loaded, and none): offer the join link or a church request.
  const noChurch = !!userId && !!teamsLoaded && teams.length === 0;
  const [churchAsk, setChurchAsk] = useState(false);
  const [churchSent, setChurchSent] = useState(() => (userId ? sentChurchRequest(userId) : null));
  const askForChurch = async (answers) => {
    await sendChurchRequest(supabase, {
      ...answers,
      userId,
      email: user?.email || null,
      name: displayName || null,
      from: user?.user_metadata?.signup_from || signupSource(),
    });
    rememberChurchRequest(userId, answers.church.trim());
    setChurchSent({ church: answers.church.trim() });
  };

  const first = (displayName || '').trim().split(/\s+/)[0] || 'there';
  const dateLabel = new Date(now).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
    {!homeReady ? <HomeSkeleton /> : (
    <HomeView
      name={first}
      dateLabel={dateLabel}
      syncProblem={syncProblem(syncState, ticking, typeof navigator === 'undefined' || navigator.onLine !== false)
        ? { onRetry: onRetrySync } : null}
      setup={setup}
      leader={leader}
      clockFormat={settings?.clockFormat || '12h'}
      needs={needs}
      onNeed={onNeed}
      asks={asks}
      onAnswer={(id, availabilityValue) => updateSchedule?.(id, { availability: availabilityValue })}
      next={next}
      onOpenSetlist={onOpenSetlist}
      onPlaySetlist={onPlaySetlist}
      onMarkReady={onMarkReady}
      strip={{ days, offset, onOffset: setOffset, selected, onSelect: setPicked }}
      onOpenSchedule={onOpenSchedule}
      activity={activity}
      now={now}
      onOpenActivity={openActivity}
      onOpenSongs={onOpenSongs}
      showNothingPlanned={!next && asks.length === 0}
      create={leader || !inTeam ? create : []}
      startChurch={noChurch ? <StartChurchCard sent={churchSent} onStart={() => setChurchAsk(true)} /> : null}
    />
    )}
    {canAddSongs && (
      <AddSongFlow
        mode={adding}
        onMode={setAdding}
        songs={songs}
        onImportSongs={onImportSongs}
        onImportSetlistFile={onImportSetlistFile}
        onEditImported={onEditImported}
        onBlank={onBlank}
      />
    )}
    {noChurch && !churchSent && (
      <StartChurchSheet open={churchAsk} onOpenChange={setChurchAsk} email={user?.email} onSend={askForChurch} />
    )}
    {myMember && (
      <PartsSheet open={partsOpen} onOpenChange={setPartsOpen} title="What do you play?"
        intro="Pick everything you play and sing. You can change it any time in your profile."
        tokens={myParts} onSave={updateMyInstruments} playLabel="You play" singLabel="You sing" />
    )}
    </>
  );
}
