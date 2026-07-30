import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/ui/Button';
import NoteContent from '@/ui/NoteContent';
import { useTeam } from '@/auth/useTeam';
import { useTeamSchedules } from '@/hooks/useTeamSchedules';
import { useTeamSetlistMap } from '@/hooks/useTeamSetlistMap';
import { useLeaderNote } from '@/hooks/useLeaderNote';
import { formatElapsed } from '@/lib/duration';
import { headerFrostStyle } from '@/lib/headerFrost';

/**
 * Element 13 — the finale. ONE screen for both live and practice.
 *
 * It replaces `LiveFinale` (246 lines) and `PracticeFinale` (252), which were
 * ~80% the same file — `formatDuration` and `StatGrid` were duplicated verbatim,
 * and the two had already drifted apart in copy. What actually differs between a
 * service and a practice is small enough to be a table: the phrase, the badge,
 * one section, and which note it writes.
 *
 * Wake lock is deliberately NOT acquired here — the finale lives off-stage.
 *
 * **Time is the only stat**, by decision. The old screens showed songs-reached,
 * breaks-crossed, key-change and cue counts; each one is tracking code carried
 * through the whole session for a number nobody acts on, and two of them
 * (cues, and the "what changed" tags) could not be made truthful at all while the
 * reader is read-only.
 */

const FLAVOUR = {
  live: {
    badge: 'Live',
    badgeStyle: { background: 'var(--ds-gray-1000)', color: 'var(--ds-background-100)' },
    phrases: ['Service done.', 'And that\'s a wrap.', 'Lights down.', 'Big sound today.', 'Set delivered.'],
    sub: 'Wrap it with a thought while it\'s fresh.',
    noteLabel: 'How did it feel?',
    notePlaceholder: 'Pads carried the bridge. Click track was solid. Pull up the second verse next time…',
    legacyField: 'serviceNote',
    primaryCta: 'View setlist',
    showBand: true,
  },
  practice: {
    badge: 'Practice',
    badgeStyle: { background: 'var(--color-brand)', color: 'white' },
    phrases: ['Practice wrapped.', 'Nice rep.', 'Nailed it.', 'Tight run.', 'Rehearsal logged.'],
    sub: 'Make a note before you put the guitar down.',
    noteLabel: 'For the leaders',
    notePlaceholder: 'Run the bridge slower next time. Keys felt right in F. Drummer wants a bigger pickup into the chorus…',
    legacyField: 'practiceNote',
    primaryCta: 'Back to setlist',
    showBand: false,
  },
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export default function ReaderFinale({
  setlist,
  mode = 'live',
  session = null,
  userId = null,
  onRunAgain,
  onUpdateSetlist,
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

  const { team, members, isAdmin } = useTeam();
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

  // ── The reflection ───────────────────────────────────────────────────────
  // Three cases, and the middle one is the reason the table exists:
  //   no team          → the setlist's own field. Your device, your setlist.
  //   team + leader    → the leaders-only table (RLS-enforced).
  //   team + member    → NO reflection at all. Falling back to the setlist field
  //                      here would put the text back on every member's device,
  //                      which is exactly what this element moved away from.
  const inTeam = !!team;
  const leaderNote = useLeaderNote({
    teamId: team?.id || null,
    setlistKey: setlist.id,
    kind: mode,
    userId,
    isLeader: !!isAdmin,
  });

  const legacyValue = setlist?.[flavour.legacyField] || '';
  const showNote = inTeam ? leaderNote.enabled : true;
  const savedValue = inTeam ? leaderNote.note : legacyValue;

  // The draft is DERIVED, not seeded by an effect or during render: `null` means
  // untouched, so the saved value shows through as soon as it arrives (the leader
  // note loads async) without ever overwriting something being typed.
  const [draft, setDraft] = useState(null);
  const value = draft ?? savedValue;

  const persist = () => {
    if (!showNote || draft === null) return;
    if (inTeam) { leaderNote.save(value); return; }
    const next = value.trim();
    if (next === legacyValue.trim()) return;
    onUpdateSetlist?.({ ...setlist, [flavour.legacyField]: next || undefined });
  };

  const leave = (fn) => () => { persist(); fn?.(); };

  const played = session?.played || [];

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
            style={flavour.badgeStyle}
          >
            {flavour.badge}
          </span>
        </div>
      </div>

      <div className="wide-container pt-8 pb-12 max-w-2xl mx-auto flex flex-col gap-8">
        <div>
          <h2 className="text-heading-32 sm:text-heading-40 font-serif text-[var(--ds-gray-1000)] m-0 tracking-tight">
            {phrase}
          </h2>
          <p className="mt-2 text-copy-15 text-[var(--ds-gray-700)] m-0">{flavour.sub}</p>

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

        {/* What you played — the body of the screen.
            The old cut of this had a lone `w-fit` Time tile floating in a
            max-w-2xl column with both other sections hidden, which read as three
            missing tiles above an empty page. A wrap-up that never says what you
            played was the actual gap; the running order costs no tracking at all,
            because the reader has already resolved it. */}
        {played.length > 0 && (
          <section>
            <SectionLabel>What you played</SectionLabel>
            <ol className="flex flex-col gap-1 m-0 p-0 list-none">
              {played.map((item, i) => (
                <PlayedRow
                  key={item.id}
                  item={item}
                  // Breaks are not numbered — they aren't songs, and numbering
                  // them makes a 9-song set read as 11.
                  number={played.slice(0, i + 1).filter(p => p.kind !== 'break').length}
                />
              ))}
            </ol>
          </section>
        )}

        {band.length > 0 && (
          <section>
            <SectionLabel>You served with</SectionLabel>
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

        {showNote && (
          <section>
            <label
              htmlFor="finale-reflection"
              className="text-label-12 uppercase tracking-[0.15em] text-[var(--ds-gray-600)] font-bold mb-3 block"
            >
              {flavour.noteLabel}
            </label>
            <textarea
              id="finale-reflection"
              value={value}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={persist}
              rows={4}
              placeholder={flavour.notePlaceholder}
              className="w-full resize-y rounded-xl border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] px-4 py-3 text-copy-14 text-[var(--ds-gray-1000)] outline-none focus:border-[var(--color-brand)] placeholder:text-[var(--ds-gray-500)]"
              style={{ fontFamily: 'inherit', minHeight: '6rem' }}
            />
            <p className="mt-2 text-label-11 text-[var(--ds-gray-500)] m-0">
              {inTeam
                ? 'Only leaders can read this — it never reaches a member\'s device.'
                : 'Saved with this setlist.'}
            </p>
          </section>
        )}

        {/* The previous note, when they haven't started typing over it. */}
        {!value && savedValue && (
          <NoteContent
            text={savedValue}
            className="px-4 py-3 rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-gray-alpha-100)] text-copy-14 text-[var(--ds-gray-900)]"
          />
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button variant="brand" size="lg" onClick={leave(onGoOverview)} className="flex-1">
            {flavour.primaryCta}
          </Button>
          <Button variant="secondary" size="lg" onClick={leave(onRunAgain)} className="flex-1">
            Run it again
          </Button>
          <Button variant="ghost" size="lg" onClick={leave(onGoHome)} className="sm:w-auto">
            Home
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * One line of the set as it was read. A record, not navigation — by decision.
 * Nothing here is tappable: one mis-tap after a service should not put you back
 * on stage, and the list's job is to say what happened.
 */
function PlayedRow({ item, number }) {
  if (item.kind === 'break') {
    return (
      <li className="flex items-center gap-3 px-3 py-1.5">
        <span className="w-5 shrink-0" aria-hidden="true" />
        <span className="text-label-12 uppercase tracking-[0.12em] text-[var(--ds-gray-500)] truncate">
          {item.title}
        </span>
        <span className="flex-1 border-t border-dashed border-[var(--ds-gray-300)]" aria-hidden="true" />
      </li>
    );
  }

  const missing = item.kind === 'missing';
  return (
    <li className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--ds-gray-300)] bg-[var(--ds-background-200)]">
      <span className="w-5 shrink-0 text-label-11 font-mono tabular-nums text-[var(--ds-gray-500)]">
        {number}
      </span>
      <span
        className={`flex-1 min-w-0 truncate text-copy-14 ${missing ? 'italic text-[var(--ds-gray-500)]' : 'text-[var(--ds-gray-1000)]'}`}
      >
        {item.title}
      </span>

      {/* A moved key is marked ON the song, so "what changed" lives where the
          song is rather than in a separate block that is empty most nights. */}
      {item.fromKey && (
        <span className="shrink-0 text-label-11 font-mono text-[var(--ds-gray-500)] line-through">
          {item.fromKey}
        </span>
      )}
      {item.key && (
        <span
          className="shrink-0 text-label-11 font-mono font-bold rounded px-1.5 py-0.5"
          style={item.fromKey
            ? { background: 'var(--color-brand-soft)', color: 'var(--color-brand)', border: '1px solid var(--color-brand-border)' }
            : { color: 'var(--chord)' }}
        >
          {item.key}
        </span>
      )}
    </li>
  );
}

function SectionLabel({ children }) {
  return (
    <h3 className="text-label-12 uppercase tracking-[0.15em] text-[var(--ds-gray-600)] font-bold mb-3">
      {children}
    </h3>
  );
}
