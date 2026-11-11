import { useMemo, useState } from 'react';
import { Button } from '@/ui/shadcn/button';
import { useTeam } from '@/auth/useTeam';
import { useTeamSchedules } from '@/hooks/useTeamSchedules';
import { useTeamSetlistMap } from '@/hooks/useTeamSetlistMap';
import { formatElapsed } from '@/lib/duration';

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
    badgeClass: 'bg-danger-fill text-danger-text',
    phrases: ['Service done.', 'And that\'s a wrap.', 'Lights down.', 'Big sound today.', 'Set delivered.'],
    showBand: true,
  },
  practice: {
    badge: 'Practice',
    badgeClass: 'bg-raised text-muted-foreground',
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
  // ⚠ FROZEN, and it used to tick once a minute "so the clock stays honest if
  // they linger". It did the opposite. This screen mounts when Finish is
  // pressed, so the set ended at exactly this instant — and a running clock
  // then counted the time somebody spent looking at the finale INTO the
  // session it is reporting. Leave it up on a music stand and a 20-minute
  // practice reads as an hour and a half. The one number on the screen has to
  // be a fact about the run, not about the screen.
  const [endedAt] = useState(() => Date.now());

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
  if (startTime) meta.push(formatElapsed(endedAt - startTime));
  if (setlist?.date) {
    const d = new Date(`${setlist.date}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      meta.push(d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }));
    }
  }
  if (setlist?.location) meta.push(setlist.location);

  // The new look (QA 11 Nov, row 175): app tokens and type scale, the
  // app's buttons, the badge as a soft chip. Same one screenful, same two
  // pinned ways out (see the note on the component).
  return (
    <div
      className="h-full flex flex-col overflow-hidden bg-background text-foreground"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="shrink-0 border-b border-border">
        <div className="wide-container flex items-center gap-3 py-3">
          <h1 className="m-0 flex-1 min-w-0 truncate text-body font-semibold">{setlist.name}</h1>
          <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-caption font-semibold ${flavour.badgeClass}`}>
            {flavour.badge}
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="wide-container pt-10 pb-6 max-w-2xl mx-auto flex flex-col gap-8">
          <div>
            <h2 className="m-0 text-display">{phrase}</h2>
            {meta.length > 0 && (
              <p className="m-0 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-muted-foreground">
                {meta.map((bit, i) => (
                  <span key={bit} className="flex items-center gap-2">
                    {i > 0 && <span aria-hidden="true">·</span>}
                    <span className={bit.match(/^\d/) ? 'tabular-nums' : undefined}>{bit}</span>
                  </span>
                ))}
              </p>
            )}
          </div>

          {band.length > 0 && (
            <section>
              <h3 className="m-0 mb-3 text-small font-semibold text-muted-foreground">You served with</h3>
              <ul className="m-0 p-0 list-none flex flex-wrap gap-2">
                {band.map(p => (
                  <li key={p.key} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-small">
                    <span className="font-semibold">{p.name}</span>
                    {p.role && <span className="text-muted-foreground">· {p.role}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-background" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="wide-container max-w-2xl mx-auto flex gap-2 py-3">
          <Button onClick={onGoOverview} className="flex-1">View setlist</Button>
          <Button variant="outline" onClick={onGoHome} className="flex-1">Home</Button>
        </div>
      </div>
    </div>
  );
}
