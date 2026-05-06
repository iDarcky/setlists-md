import { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import NoteContent from './ui/NoteContent';

// Wake-lock is intentionally NOT acquired here — the finale lives off-stage.

const PRACTICE_PHRASES = [
  'Practice wrapped.',
  'Nice rep.',
  'Nailed it.',
  'Tight run.',
  'Rehearsal logged.',
];

function pickPhrase() {
  return PRACTICE_PHRASES[Math.floor(Math.random() * PRACTICE_PHRASES.length)];
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

export default function PracticeFinale({ setlist, songs, sessionStats, onBack, onRunAgain, onUpdateSetlist, onGoOverview, onGoHome }) {
  const stats = sessionStats || {};
  const [startTime] = useState(() => stats.startTime || Date.now());
  const farthestIdx = Number.isInteger(stats.farthestIdx) ? stats.farthestIdx : 0;
  const transposeCount = stats.transposeCount || 0;
  const cueCount = stats.cueCount || 0;
  const touchedSongIds = useMemo(
    () => (stats.touchedSongIds instanceof Set
      ? stats.touchedSongIds
      : new Set(stats.touchedSongIds || [])),
    [stats.touchedSongIds],
  );

  const [phrase] = useState(pickPhrase);
  const [now, setNow] = useState(() => Date.now());

  // Tick once a minute so the duration stays fresh if the user lingers.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const totalItems = setlist.items.length;
  const songsCovered = Math.min(farthestIdx + 1, totalItems);
  const fullRun = songsCovered >= totalItems;

  // What changed in this session — items the user touched (key change,
  // setlist note) plus songs whose section cues they edited. We only show
  // the items they touched this session so prior edits don't leak in.
  const changes = useMemo(() => {
    const out = [];
    setlist.items.forEach((it, i) => {
      if (it.type === 'break') return;
      const song = songs.find(s => s.id === it.songId) || songs.find(s => s.title === it.songTitle);
      if (!song) return;
      if (!touchedSongIds.has(song.id)) return;
      const bits = [];
      if (it.transpose) {
        const sign = it.transpose > 0 ? '+' : '';
        bits.push(`Key ${sign}${it.transpose}`);
      }
      if (it.notes) bits.push('Setlist note');
      // Cues live on the song itself, not the setlist item — the touched
      // set already proves the user edited at least one thing on this song,
      // so add a generic "Cue" tag if neither transpose nor notes accounts
      // for it.
      if (bits.length === 0) bits.push('Cue');
      out.push({ key: `${i}-${song.id}`, title: song.title, bits });
    });
    return out;
  }, [setlist.items, songs, touchedSongIds]);

  const reflectionInitial = setlist.practiceNote || '';
  const [reflection, setReflection] = useState(reflectionInitial);
  const reflectionRef = useRef(reflectionInitial);

  const persistReflection = () => {
    const next = reflection.trim();
    if (next === (reflectionRef.current || '').trim()) return;
    reflectionRef.current = next;
    onUpdateSetlist?.({ ...setlist, practiceNote: next || undefined });
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
      <div className="material-header" style={{ zIndex: 50 }}>
        <div className="a4-container flex items-center gap-2 py-3">
          <IconButton variant="ghost" size="sm" onClick={onBack} aria-label="Back">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
            </svg>
          </IconButton>
          <h1 className="text-heading-16 text-[var(--ds-gray-1000)] m-0 flex-1 min-w-0 truncate">
            {setlist.name}
          </h1>
          <span
            className="inline-flex shrink-0 items-center px-2 py-0.5 rounded-md text-label-10 font-black uppercase tracking-widest"
            style={{ background: 'var(--color-brand)', color: 'white' }}
          >
            Practice
          </span>
        </div>
      </div>

      <div className="a4-container pt-8 pb-12 max-w-2xl mx-auto flex flex-col gap-8">
        {/* Headline */}
        <div>
          <h2 className="text-heading-32 sm:text-heading-40 font-serif text-[var(--ds-gray-1000)] m-0 tracking-tight">
            {phrase}
          </h2>
          <p className="mt-2 text-copy-15 text-[var(--ds-gray-700)] m-0">
            {fullRun
              ? 'You ran the full set. Make a note before you put the guitar down.'
              : `You worked through ${songsCovered} of ${totalItems}. Capture what you want to remember.`}
          </p>
        </div>

        {/* Stat tiles */}
        <StatGrid
          items={[
            { label: 'Time', value: formatDuration(now - startTime) },
            { label: 'Songs', value: `${songsCovered}/${totalItems}` },
            { label: 'Key changes', value: transposeCount },
            { label: 'Cues added', value: cueCount },
          ]}
        />

        {/* Changes list */}
        {changes.length > 0 && (
          <section>
            <h3 className="text-label-12 uppercase tracking-[0.15em] text-[var(--ds-gray-600)] font-bold mb-3">
              What changed
            </h3>
            <ul className="flex flex-col gap-1.5 m-0 p-0 list-none">
              {changes.map(c => (
                <li
                  key={c.key}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--ds-gray-300)] bg-[var(--ds-background-200)]"
                >
                  <span className="flex-1 text-copy-14 text-[var(--ds-gray-1000)] truncate">
                    {c.title}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {c.bits.map((b, i) => (
                      <span
                        key={i}
                        className="text-label-11 font-semibold text-[var(--color-brand)] bg-[var(--color-brand-soft)] border border-[var(--color-brand-border)] rounded px-1.5 py-0.5"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Reflection */}
        <section>
          <label
            htmlFor="practice-reflection"
            className="text-label-12 uppercase tracking-[0.15em] text-[var(--ds-gray-600)] font-bold mb-3 block"
          >
            For the band
          </label>
          <textarea
            id="practice-reflection"
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            onBlur={persistReflection}
            rows={4}
            placeholder="Run bridge slower next time. Keys felt right in F. Drummer wants a bigger pickup into the chorus…"
            className="w-full resize-y rounded-xl border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] px-4 py-3 text-copy-14 text-[var(--ds-gray-1000)] outline-none focus:border-[var(--color-brand)] placeholder:text-[var(--ds-gray-500)]"
            style={{ fontFamily: 'inherit', minHeight: '6rem' }}
          />
          {reflectionInitial && (
            <p className="mt-2 text-label-11 text-[var(--ds-gray-500)] m-0">
              Saved with this setlist — visible the next time you wrap a practice.
            </p>
          )}
        </section>

        {/* Saved reflection preview when not editing */}
        {!reflection && reflectionInitial && (
          <NoteContent
            text={reflectionInitial}
            className="px-4 py-3 rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-gray-alpha-100)] text-copy-14 text-[var(--ds-gray-900)]"
          />
        )}

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button variant="brand" size="lg" onClick={handleViewOverview} className="flex-1">
            Back to setlist
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
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
