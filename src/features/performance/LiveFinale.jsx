import { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/ui/Button';
import NoteContent from '@/ui/NoteContent';
import { useTeam } from '@/auth/useTeam';
import { useTeamSchedules } from '@/hooks/useTeamSchedules';
import { useTeamSetlistMap } from '@/hooks/useTeamSetlistMap';
import { headerFrostStyle } from '@/lib/headerFrost';

// Wake-lock is intentionally NOT acquired here — the finale lives off-stage.

const LIVE_PHRASES = [
  'Service done.',
  'And that\'s a wrap.',
  'Lights down.',
  'Big sound today.',
  'Set delivered.',
];

function pickPhrase() {
  return LIVE_PHRASES[Math.floor(Math.random() * LIVE_PHRASES.length)];
}

function formatDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

export default function LiveFinale({ setlist, sessionStats, onRunAgain, onUpdateSetlist, onGoOverview, onGoHome }) {
  const stats = sessionStats || {};
  const [startTime] = useState(() => stats.startTime || Date.now());
  const farthestIdx = Number.isInteger(stats.farthestIdx) ? stats.farthestIdx : 0;

  const [phrase] = useState(pickPhrase);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const totalItems = setlist.items.length;
  const songsPlayed = useMemo(() => {
    let count = 0;
    for (let i = 0; i <= farthestIdx && i < setlist.items.length; i++) {
      if (setlist.items[i].type !== 'break') count++;
    }
    return count;
  }, [setlist.items, farthestIdx]);
  const totalSongs = useMemo(
    () => setlist.items.filter(it => it.type !== 'break').length,
    [setlist.items],
  );
  const breaksCrossed = useMemo(() => {
    let count = 0;
    for (let i = 0; i <= farthestIdx && i < setlist.items.length; i++) {
      if (setlist.items[i].type === 'break') count++;
    }
    return count;
  }, [setlist.items, farthestIdx]);
  const fullRun = farthestIdx + 1 >= totalItems;

  // Band acknowledgement — only resolves with a team plan + scheduled rows.
  const { team, members } = useTeam();
  const { schedules } = useTeamSchedules(team?.id || null);
  // Schedules reference the team_setlists row UUID; map the local id to it.
  const { map: setlistMap } = useTeamSetlistMap(team?.id || null);
  const band = useMemo(() => {
    if (!team || !schedules?.length || !members?.length) return [];
    return schedules
      .filter(s => (s.setlist_id === setlist.id || setlistMap[setlist.id] === s.setlist_id) && s.availability !== 'unavailable')
      .map(s => {
        const m = members.find(mm => mm.user_id === s.user_id);
        const name = m?.profile?.display_name || m?.profile?.email || 'Bandmate';
        return { key: s.id, name, role: s.role || null };
      });
  }, [team, schedules, members, setlist.id, setlistMap]);

  const reflectionInitial = setlist.serviceNote || '';
  const [reflection, setReflection] = useState(reflectionInitial);
  const reflectionRef = useRef(reflectionInitial);

  const persistReflection = () => {
    const next = reflection.trim();
    if (next === (reflectionRef.current || '').trim()) return;
    reflectionRef.current = next;
    onUpdateSetlist?.({ ...setlist, serviceNote: next || undefined });
  };

  const handleRunAgain = () => {
    persistReflection();
    onRunAgain?.();
  };

  const handleViewOverview = () => {
    persistReflection();
    onGoOverview?.();
  };

  const handleGoHome = () => {
    persistReflection();
    onGoHome?.();
  };

  return (
    <div
      className="h-full overflow-y-auto overflow-x-hidden bg-[var(--ds-background-100)]"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="material-header" style={{ zIndex: 50, ...headerFrostStyle }}>
        <div className="wide-container flex items-center gap-2 py-3">
          <h1 className="text-heading-16 text-[var(--ds-gray-1000)] m-0 flex-1 min-w-0 truncate">
            {setlist.name}
          </h1>
          <span
            className="inline-flex shrink-0 items-center px-2 py-0.5 rounded-md text-label-10 font-black uppercase tracking-widest"
            style={{ background: 'var(--ds-gray-1000)', color: 'var(--ds-background-100)' }}
          >
            Live
          </span>
        </div>
      </div>

      <div className="wide-container pt-8 pb-12 max-w-2xl mx-auto flex flex-col gap-8">
        {/* Headline */}
        <div>
          <h2 className="text-heading-32 sm:text-heading-40 font-serif text-[var(--ds-gray-1000)] m-0 tracking-tight">
            {phrase}
          </h2>
          <p className="mt-2 text-copy-15 text-[var(--ds-gray-700)] m-0">
            {fullRun
              ? 'Set delivered front to back. Take the win.'
              : `You played ${songsPlayed} of ${totalSongs}. Wrap with a thought before you walk off.`}
          </p>
        </div>

        {/* Stat tiles */}
        <StatGrid
          items={[
            { label: 'Time', value: formatDuration(now - startTime) },
            { label: 'Songs', value: `${songsPlayed}/${totalSongs}` },
            { label: 'Breaks', value: breaksCrossed },
          ]}
        />

        {/* Band acknowledgement — team plan only, scheduled rows only */}
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
                  <span className="text-copy-13 font-semibold text-[var(--ds-gray-1000)]">
                    {p.name}
                  </span>
                  {p.role && (
                    <span className="text-label-11 text-[var(--ds-gray-600)]">
                      · {p.role}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Reflection */}
        <section>
          <label
            htmlFor="service-reflection"
            className="text-label-12 uppercase tracking-[0.15em] text-[var(--ds-gray-600)] font-bold mb-3 block"
          >
            How did it feel?
          </label>
          <textarea
            id="service-reflection"
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            onBlur={persistReflection}
            rows={4}
            placeholder="Pads carried the bridge. Click track was solid. Pull-up the second verse next time…"
            className="w-full resize-y rounded-xl border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] px-4 py-3 text-copy-14 text-[var(--ds-gray-1000)] outline-none focus:border-[var(--color-brand)] placeholder:text-[var(--ds-gray-500)]"
            style={{ fontFamily: 'inherit', minHeight: '6rem' }}
          />
          {reflectionInitial && (
            <p className="mt-2 text-label-11 text-[var(--ds-gray-500)] m-0">
              Saved with this setlist — there next time you reach this screen.
            </p>
          )}
        </section>

        {!reflection && reflectionInitial && (
          <NoteContent
            text={reflectionInitial}
            className="px-4 py-3 rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-gray-alpha-100)] text-copy-14 text-[var(--ds-gray-900)]"
          />
        )}

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button variant="brand" size="lg" onClick={handleViewOverview} className="flex-1">
            View setlist
          </Button>
          <Button variant="secondary" size="lg" onClick={handleRunAgain} className="flex-1">
            Run it again
          </Button>
          <Button variant="ghost" size="lg" onClick={handleGoHome} className="sm:w-auto">
            Home
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatGrid({ items }) {
  return (
    <div className={`grid gap-3 ${items.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
      {items.map((it, i) => (
        <div
          key={i}
          className="rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-200)] px-4 py-3"
        >
          <div className="text-label-11 uppercase tracking-[0.15em] text-[var(--ds-gray-600)] font-bold">
            {it.label}
          </div>
          <div className="mt-1 text-heading-24 font-semibold text-[var(--ds-gray-1000)] tabular-nums">
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}
