import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/ui/Button';
import { useTeam } from '@/auth/useTeam';
import { useTeamSchedules } from '@/hooks/useTeamSchedules';
import { useTeamSetlistMap } from '@/hooks/useTeamSetlistMap';
import { formatElapsed } from '@/lib/duration';
import { headerFrostStyle } from '@/lib/headerFrost';

/**
 * Element 13 — the finale. ONE screen for both live and practice.
 *
 * It replaces `LiveFinale` (246 lines) and `PracticeFinale` (252), which were
 * ~80% the same file — `formatDuration` and `StatGrid` duplicated verbatim, and
 * the two had already drifted apart in copy. What actually differs between a
 * service and a practice is small enough to be a lookup table: the phrase, the
 * badge, and one section.
 *
 * **It is one screenful, and the page never scrolls.** Root is a flex column:
 * header, a middle that is the only scroller (and only when it has to be), and
 * the buttons pinned below it. Two buttons — View setlist, Home — always on
 * screen, because the way off this screen must never be something you scroll to
 * find.
 *
 * **Time is the only stat**, by decision, and it sits on a meta line rather than
 * in a tile. The old screens showed songs-reached, breaks-crossed, key-change and
 * cue counts; each one is tracking code carried through the whole session for a
 * number nobody acts on.
 *
 * Wake lock is deliberately NOT acquired here — the finale lives off-stage.
 *
 * THREE things were built here and then cut. Read the boxed note in
 * `docs/READER.md` §13 before adding any of them back — this screen is a full
 * stop, not a page to read.
 */

const FLAVOUR = {
  live: {
    badge: 'Live',
    badgeStyle: { background: 'var(--ds-gray-1000)', color: 'var(--ds-background-100)' },
    phrases: ['Service done.', 'And that\'s a wrap.', 'Lights down.', 'Big sound today.', 'Set delivered.'],
    showBand: true,
  },
  practice: {
    badge: 'Practice',
    badgeStyle: { background: 'var(--color-brand)', color: 'white' },
    phrases: ['Practice wrapped.', 'Nice rep.', 'Nailed it.', 'Tight run.', 'Rehearsal logged.'],
    showBand: false,
  },
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export default function ReaderFinale({
  setlist,
  mode = 'live',
  session = null,
  onGoOverview,
  onGoHome,
}) {
  const flavour = FLAVOUR[mode] || FLAVOUR.live;
  const startTime = session?.startTime || null;

  const [phrase] = useState(() => pick(flavour.phrases));
  const [now, setNow] = useState(() => Date.now());
  // Tick once a minute so the clock stays honest if they linger on the screen.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { team, members } = useTeam();
  const { schedules } = useTeamSchedules(team?.id || null);
  // Schedules reference the team_setlists ROW uuid; bridge the local id to it.
  const { map: setlistMap } = useTeamSetlistMap(team?.id || null);

  const band = useMemo(() => {
    if (!flavour.showBand || !team || !schedules?.length || !members?.length) return [];
    return schedules
      .filter(s => (s.setlist_id === setlist.id || setlistMap[setlist.id] === s.setlist_id)
        && s.availability !== 'unavailable')
      .map(s => {
        const m = members.find(mm => mm.user_id === s.user_id);
        return {
          key: s.id,
          name: m?.profile?.display_name || m?.profile?.email || 'Bandmate',
          role: s.role || null,
        };
      });
  }, [flavour.showBand, team, schedules, members, setlist.id, setlistMap]);

  // Context, all of it free — no session tracking behind any of it. Only the
  // parts that actually exist are shown; a placeholder dash for a setlist with
  // no date is noise pretending to be information.
  const meta = [];
  if (startTime) meta.push(formatElapsed(now - startTime));
  if (setlist?.date) {
    const d = new Date(`${setlist.date}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      meta.push(d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }));
    }
  }
  if (setlist?.location) meta.push(setlist.location);

  return (
    <div
      className="h-full flex flex-col overflow-hidden bg-[var(--ds-background-100)]"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="shrink-0 material-header" style={{ zIndex: 50, ...headerFrostStyle }}>
        <div className="wide-container flex items-center gap-2 py-3">
          <h1 className="text-heading-16 text-[var(--ds-gray-1000)] m-0 flex-1 min-w-0 truncate">
            {setlist.name}
          </h1>
          <span
            className="inline-flex shrink-0 items-center px-2 py-0.5 rounded-md text-label-10 font-black uppercase tracking-widest"
            style={flavour.badgeStyle}
          >
            {flavour.badge}
          </span>
        </div>
      </div>

      {/* The ONLY scroller on the screen, and only when it has to be. The page
          itself never scrolls, so the buttons below can never be scrolled off. */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="wide-container pt-6 pb-6 max-w-2xl mx-auto flex flex-col gap-6">
          <div>
            <h2 className="text-heading-32 sm:text-heading-40 font-serif text-[var(--ds-gray-1000)] m-0 tracking-tight">
              {phrase}
            </h2>

            {/* Time sits on a meta line, not in a card of its own. A single stat
                tile spanning the page reads as three tiles that failed to load. */}
            {meta.length > 0 && (
              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-label-12 text-[var(--ds-gray-600)] m-0">
                {meta.map((bit, i) => (
                  <span key={bit} className="flex items-center gap-2">
                    {i > 0 && <span aria-hidden="true" className="opacity-50">·</span>}
                    <span className={bit.match(/^\d/) ? 'tabular-nums' : undefined}>{bit}</span>
                  </span>
                ))}
              </p>
            )}
          </div>

          {band.length > 0 && (
            <section>
              <h3 className="text-label-12 uppercase tracking-[0.15em] text-[var(--ds-gray-600)] font-bold mb-3">
                You served with
              </h3>
              <ul className="flex flex-wrap gap-2 m-0 p-0 list-none">
                {band.map(p => (
                  <li
                    key={p.key}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--ds-gray-300)] bg-[var(--ds-background-200)]"
                  >
                    <span className="text-copy-13 font-semibold text-[var(--ds-gray-1000)]">{p.name}</span>
                    {p.role && <span className="text-label-11 text-[var(--ds-gray-600)]">· {p.role}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {/* TWO buttons, pinned. They sit OUTSIDE the scroller by decision — the
          way off this screen must never be something you have to scroll to
          find. "Run it again" is gone: finishing a set and immediately
          restarting it is not a thing that happens. */}
      <div
        className="shrink-0 border-t border-[var(--ds-gray-300)] bg-[var(--ds-background-100)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="wide-container max-w-2xl mx-auto flex gap-2 py-3">
          <Button variant="brand" size="lg" onClick={onGoOverview} className="flex-1">
            View setlist
          </Button>
          <Button variant="secondary" size="lg" onClick={onGoHome} className="flex-1">
            Home
          </Button>
        </div>
      </div>
    </div>
  );
}
