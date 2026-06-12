import React, { useState, useRef, useEffect } from 'react';
import SongCard from './SongCard';
import { Button } from './ui/Button';
import { SearchBar } from './ui/SearchBar';
import ProgressChecklist from '../onboarding/ProgressChecklist';
import { CalendarWidget } from './ui/CalendarWidget';
import ActivityFeed from './team/ActivityFeed';
import { useTeam } from '../auth/useTeam';
import { useTeamSchedules } from '../hooks/useTeamSchedules';
import { useTeamAvailability } from '../hooks/useTeamAvailability';
import { useTeamSetlistMap } from '../hooks/useTeamSetlistMap';
import { useAuth } from '../auth/useAuth';
import { formatClockTime } from '../lib/dateFormat';

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
  canEdit = true,
  onSignIn,
}) {
  const { team, members } = useTeam();
  const { user } = useAuth();
  const { schedules, updateSchedule } = useTeamSchedules(team?.id);
  const { availability } = useTeamAvailability(team?.id);
  // team_schedules.setlist_id is the remote UUID; local setlists use base-36
  // ids. Resolve either way so pending requests actually find their setlist.
  const { map: setlistMap } = useTeamSetlistMap(team?.id);
  const resolveScheduleSetlist = (schedule) =>
    setlists.find(l => l.id === schedule.setlist_id || setlistMap[l.id] === schedule.setlist_id) || null;
  const pendingRequests = (schedules || []).filter(s => s.user_id === user?.id && s.availability === 'pending');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);

  // Recently edited songs (latest first)
  const latestSongs = [...songs].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 5);

  // Upcoming setlists (closest date+time first, future only)
  const now = new Date();
  const upcomingSetlists = [...setlists]
    .filter(sl => {
      const slDate = new Date(`${sl.date}T${sl.time || '00:00'}:00`);
      return slDate >= now;
    })
    .sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time || '00:00'}:00`);
      const dateB = new Date(`${b.date}T${b.time || '00:00'}:00`);
      return dateA - dateB;
    })
    .slice(0, 6);

  const songCountOf = (sl) => (sl.items || []).filter(i => i.songId).length;

  // Date formatting: "Monday, April 6"
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  });

  // Greeting name
  const userName = settings?.userName || 'Guest';

  // Search results
  const searchResults = searchQuery.trim()
    ? songs.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.artist?.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 8)
    : [];

  // Close search results when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') setSearchFocused(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const formatDateFriendly = (dateStr) => {
    if (!dateStr) return 'Tonight';
    const date = new Date(dateStr + 'T12:00:00');
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

  return (
    <div
      className="min-h-screen pb-[140px] sm:pb-8"
      data-theme-variant="modes"
    >

      {/* Dashboard Header: Welcome + Search + Actions */}
      <div className="max-w-[1320px] mx-auto w-full px-4 sm:px-8 pt-6 sm:pt-10 pb-4 sm:pb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h1 className="text-heading-40 text-[var(--modes-text)] m-0">
            Welcome, <span className="italic font-serif text-[var(--modes-text)]">{userName}</span>
          </h1>
          <p className="text-copy-16 text-[var(--modes-text-muted)] mt-1">
            {dateStr}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Search Bar - hidden on mobile header, we'll put it in content below */}
          <div className="relative w-full sm:w-72 hidden sm:block" ref={searchContainerRef}>
            <SearchBar
              ref={searchInputRef}
              placeholder="Search songs by title or artist…"
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
                      <SongCard
                        song={song}
                        variant="row"
                        onClick={() => {
                          setSearchFocused(false);
                          setSearchQuery('');
                          onSelectSong(song);
                        }}
                      />
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-6 text-center text-copy-14 text-white/60">
                    No songs found.
                  </div>
                )}
              </div>
            )}
          </div>

          {canEdit && (
            <div className="flex items-center gap-2 mt-2 sm:mt-0 hidden sm:flex">
              {onNewSong && <Button variant="secondary" onClick={onNewSong}>New Song</Button>}
              {onNewSetlist && <Button variant="brand" onClick={onNewSetlist}>New Setlist</Button>}
            </div>
          )}
        </div>
      </div>



      <div className="max-w-[1320px] mx-auto w-full px-4 sm:px-8 py-4 sm:py-8 flex flex-col gap-6 sm:gap-8">

        {/* Onboarding progress checklist — hides itself when complete or dismissed */}
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

        {/* Sign-in nudge for guests */}
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

        {/* ── Next up — the soonest service/setlist (compact, no big hero) ── */}
        {upcomingSetlists.length > 0 && (
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
                Play Live
              </Button>
            </div>
          </section>
        )}

        {/* ── Schedule ── */}
        {user && (
          <section className="flex flex-col gap-3 sm:gap-4">
            <CalendarWidget
              setlists={setlists}
              schedules={schedules}
              userId={user.id}
              onDateClick={onViewSetlist}
              availability={team ? availability : null}
              onOpenSchedule={team ? onOpenSchedule : undefined}
            />
          </section>
        )}

        {/* ── Pending requests (schedule-related) ── */}
        {user && pendingRequests.length > 0 && (
          <section className="flex flex-col gap-3 sm:gap-4">
            <h2 className="text-heading-20 font-bold text-[var(--modes-text)]">Pending Requests</h2>
            <div className="flex flex-col gap-3">
              {pendingRequests.map(schedule => {
                const sl = resolveScheduleSetlist(schedule);
                const part = [schedule.role, schedule.vocal_part].filter(Boolean).join(' · ');
                return (
                  <div key={schedule.id} className="modes-card p-4 flex items-center justify-between gap-3">
                    <div className="flex flex-col min-w-0">
                      <span className="text-copy-16 font-bold truncate text-[var(--modes-text)]">{sl?.name || 'Team service'}</span>
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
        )}

        {/* ── Upcoming services / setlists (after the next-up) ── */}
        {(upcomingSetlists.length === 0 || upcomingSetlists.length > 1) && (
          <section className="flex flex-col gap-3 sm:gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-heading-20 font-bold text-[var(--modes-text)]">{team ? 'Upcoming Services' : 'Upcoming Setlists'}</h2>
              <Button variant="ghost" size="sm" onClick={onGoSetlists} className="text-[var(--color-brand)] hover:text-[var(--color-brand)] hover:bg-white/5">View All</Button>
            </div>
            {upcomingSetlists.length > 1 ? (
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
                      aria-label="Play live"
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-transparent border-none cursor-pointer text-[var(--modes-text-muted)] hover:text-[var(--color-brand)] hover:bg-[var(--modes-surface-strong)] transition-colors"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="modes-card py-14 text-center flex flex-col items-center gap-3 border-dashed">
                <p className="text-copy-14 text-[var(--modes-text-muted)] font-medium">No upcoming {team ? 'services' : 'setlists'}.</p>
              </div>
            )}
          </section>
        )}

        {/* ── Recent team activity ── */}
        {team && (
          <section className="flex flex-col gap-3 sm:gap-4">
            <h2 className="text-heading-20 font-bold text-[var(--modes-text)]">Recent Activity</h2>
            <div className="modes-card p-2">
              <ActivityFeed teamId={team.id} members={members} compact />
            </div>
          </section>
        )}

        {/* ── Recently edited ── */}
        <section className="flex flex-col gap-3 sm:gap-4">
          <div className="flex justify-between items-center text-left">
            <h2 className="text-heading-20 font-bold text-[var(--modes-text)]">Recently Edited</h2>
            <Button variant="ghost" size="sm" onClick={onGoLibrary} className="text-[var(--color-brand)] hover:text-[var(--color-brand)] hover:bg-white/5">Full Library</Button>
          </div>
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

      </div>
    </div>
  );
}
