import React, { useState, useRef, useEffect } from 'react';
import SongCard from './SongCard';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Chip } from './ui/Chip';
import ProgressChecklist from '../onboarding/ProgressChecklist';
import { CalendarWidget } from './ui/CalendarWidget';
import { useTeam } from '../auth/useTeam';
import { useTeamSchedules } from '../hooks/useTeamSchedules';
import { useTeamAvailability } from '../hooks/useTeamAvailability';
import { useAuth } from '../auth/useAuth';
import { formatClockTime } from '../lib/dateFormat';

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
}) {
  const { team } = useTeam();
  const { user } = useAuth();
  const { schedules, updateSchedule } = useTeamSchedules(team?.id);
  const { availability } = useTeamAvailability(team?.id);

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
    .slice(0, 2);

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
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 pt-6 sm:pt-10 pb-4 sm:pb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
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
          <div className="relative w-full sm:w-64 hidden sm:block" ref={searchContainerRef}>
            <Input
              ref={searchInputRef}
              placeholder="Search songs…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              prefix={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              }
            />
            {searchFocused && searchQuery.trim().length > 0 && (
              <div className="absolute top-full right-0 left-0 sm:left-auto sm:w-80 mt-2 rounded-xl border border-white/10 bg-[rgba(20,16,28,0.95)] backdrop-blur-md shadow-xl z-50 overflow-hidden divide-y divide-white/10 max-h-[400px] overflow-y-auto">
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

          <div className="flex items-center gap-2 mt-2 sm:mt-0 hidden sm:flex">
            <Button variant="secondary" onClick={onNewSong}>New Song</Button>
            <Button variant="brand" onClick={onNewSetlist}>New Setlist</Button>
          </div>
        </div>
      </div>



      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-8 flex flex-col gap-6 sm:gap-8">

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

        {/* My Schedule Calendar Widget */}
        {user && (
          <section className="flex flex-col gap-3 sm:gap-4 -mt-2 mb-2">
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

        {/* Pending Requests */}
        {user && schedules?.filter(s => s.user_id === user.id && s.availability === 'pending').length > 0 && (
          <section className="flex flex-col gap-3 sm:gap-4">
            <h2 className="text-heading-20 font-bold text-[var(--modes-text)]">
              Pending Requests
            </h2>
            <div className="flex flex-col gap-3">
              {schedules
                .filter(s => s.user_id === user.id && s.availability === 'pending')
                .map(schedule => {
                  const sl = setlists.find(l => l.id === schedule.setlist_id);
                  if (!sl) return null;
                  return (
                    <div 
                      key={schedule.id}
                      className="modes-card p-4 flex items-center justify-between"
                    >
                      <div className="flex flex-col">
                        <span className="text-copy-16 font-bold">{sl.name}</span>
                        <span className="text-label-13 text-[var(--modes-text-muted)]">
                          {new Date(sl.date + 'T' + (sl.time || '00:00')).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} • {schedule.role}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={() => updateSchedule(schedule.id, { availability: 'unavailable' })}
                        >
                          Decline
                        </Button>
                        <Button 
                          size="sm" 
                          variant="brand"
                          onClick={() => updateSchedule(schedule.id, { availability: 'available' })}
                        >
                          Accept
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        {/* Upcoming Setlists */}
        <section className="flex flex-col gap-3 sm:gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-heading-20 font-bold text-[var(--modes-text)]">
              Upcoming Setlists
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onGoSetlists}
              className="text-[var(--color-brand)] hover:text-[var(--color-brand)] hover:bg-white/5"
            >
              View All
            </Button>
          </div>

          <div>
            {upcomingSetlists.length > 0 ? (
              <div
                className="modes-card-strong flex flex-col md:flex-row w-full overflow-hidden shadow-[0_8px_28px_rgba(0,0,0,0.35)] h-auto md:h-64 cursor-pointer group transition-transform duration-150 active:scale-[0.99]"
                onClick={() => onViewSetlist(upcomingSetlists[0])}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {/* Left part (Branded Gradient) */}
                <div className="w-full md:w-1/3 bg-gradient-to-br from-[var(--color-brand)] to-[#3a1a3b] h-28 md:h-full relative overflow-hidden">
                   <div className="absolute inset-0 bg-black/10"></div>
                </div>

                {/* Right part (Details) */}
                <div className="flex-1 p-5 md:p-8 flex flex-col justify-center group-hover:bg-white/[0.02] transition-colors">
                  {/* Tags — rendered only when the setlist has any. No
                      placeholder chip, mirrors SetlistCard behavior. */}
                  {upcomingSetlists[0].tags?.length > 0 && (
                    <div className="flex items-center gap-2 mb-3">
                      {upcomingSetlists[0].tags.slice(0, 2).map(tag => (
                        <Chip key={tag} variant="success" size="sm">
                          {tag}
                        </Chip>
                      ))}
                    </div>
                  )}

                  {/* Setlist Name */}
                  <h3 className="text-heading-24 md:text-[32px] md:leading-[36px] font-bold text-[var(--modes-text)] m-0 mb-3 tracking-tight">
                    {upcomingSetlists[0].name || "Untitled Setlist"}
                  </h3>

                  {/* Time & Location */}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-label-14 text-[var(--modes-text-muted)] mb-6 font-medium">
                    <div className="flex items-center gap-2">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                      {formatDateFriendly(upcomingSetlists[0].date)} • {formatTimeFriendly(upcomingSetlists[0].time)}
                    </div>
                    <div className="flex items-center gap-2">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      {upcomingSetlists[0].location || "No Location Set"}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-6 mt-auto">
                    <Button
                      variant="brand"
                      className="border-none text-white shadow-sm px-6 font-bold"
                      onClick={(e) => { e.stopPropagation(); onPlaySetlist(upcomingSetlists[0]); }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="mr-2"><path d="M8 5v14l11-7z"/></svg>
                      Play Live
                    </Button>
                    <div className="text-label-13 text-[var(--modes-text-dim)] font-medium">
                      {upcomingSetlists[0].items.length} Songs • 1h 45m
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="modes-card py-14 text-center flex flex-col items-center gap-3 border-dashed">
                <p className="text-copy-14 text-[var(--modes-text-muted)] font-medium">
                  No upcoming setlists.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Recently Edited */}
        <section className="flex flex-col gap-3 sm:gap-4 sm:mt-2">
          <div className="flex justify-between items-center text-left">
            <h2 className="text-heading-20 font-bold text-[var(--modes-text)]">
              Recently Edited
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onGoLibrary}
              className="text-[var(--color-brand)] hover:text-[var(--color-brand)] hover:bg-white/5"
            >
              Full Library
            </Button>
          </div>

          <div className="modes-card overflow-hidden divide-y" style={{ borderColor: 'var(--modes-border)' }}>
            {latestSongs.map(song => (
              <SongCard
                key={song.id}
                song={song}
                variant="row"
                onClick={() => onSelectSong(song)}
              />
            ))}
            {latestSongs.length === 0 && (
              <div className="py-14 text-center flex flex-col items-center gap-3">
                <p className="text-copy-14 text-[var(--modes-text-muted)] font-medium">
                  Your library is empty.
                </p>
                <Button variant="brand" size="sm" onClick={onNewSong}>
                  Add Your First Song
                </Button>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
