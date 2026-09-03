import { songInfoFacts } from './songInfo';
import NoteContent from '@/ui/NoteContent';

/**
 * What this song IS — read before you play it, gone while you play it.
 *
 * ── Why it exists ───────────────────────────────────────────────────────────
 * The reader's top bar can carry four things at most: key, capo, tempo, time.
 * When the chrome went up a size (2026-08-21) even that stopped fitting on a
 * phone. Owner: *"we need like a new song info panel or something similar in
 * the reader, because we removed the tempo and time signature. And that's quite
 * important to se."*
 *
 * But the bar was never the real limit. **The keys you usually play it in, which
 * arrangement you are reading, the scripture, the story and the song's own notes
 * have never fitted anywhere at any width.**
 *
 * ── Two shapes, because a phone and an iPad have different problems ─────────
 * Not one component stretched. Measured: the bar already shows FOUR of the six
 * facts from 640px up, so a wide screen is not missing numbers — it is missing
 * the reading. The two shapes follow from that:
 *
 *   phone  — a TAKEOVER. 390 points cannot be shared, and this is the only
 *            shape where the notes and the story get read rather than glimpsed.
 *            Owner picked it from ten: *"I want to go 04."*
 *   wide   — a COLUMN beside the chart, which pushes rather than covers
 *            (owner: *"let's do the rail, but let's keep the cool part"*). The
 *            chart narrows; nothing is dimmed and nothing is hidden behind it.
 *
 * `SetlistRail` already makes exactly this split for exactly this reason, so
 * the rule is not a new one to learn.
 *
 * ── Why it was NOT a modal, and NOT Details ────────────────────────────────
 * It was a `Dialog` for one round. Owner: *"I think the song panel is ugly,
 * maybe we can use something else, not necessarily a panel?"* — and the
 * objection is structural: a modal reads as Settings because every other modal
 * in the app is one, it dims the chart, and it adds a surface to a reader that
 * already has too many.
 *
 * It is also not the Song Hub's Details tab, which he turned down for carrying
 * *"too many info there that are not relevant in a practice/live scenario"*.
 * The line between them, asked and answered 2026-08-21: **a field belongs here
 * if it changes how you PLAY the song in the next four minutes.** Scripture and
 * story pass — they set the intent, which is why a leader reads them before a
 * rehearsal. CCLI, publisher, label, copyright, album and year never do. When
 * something new wants in, apply that test rather than the "it exists" test.
 *
 * ⚠ VIEW ONLY (owner: *"This one should be view only and look cool"*). Nothing
 * here writes. The key and capo remain the bar's controls; this says what they
 * currently are and nothing more.
 */

/** A quiet label over a loud value — the shape every fact here takes. */
function Fact({ label, value, big = false }) {
  if (value == null || value === '') return null;
  return (
    <div className="min-w-0">
      <div
        className="text-label-11 uppercase"
        style={{ letterSpacing: '0.09em', color: 'var(--chart-subtle, var(--ds-gray-600))' }}
      >
        {label}
      </div>
      <div
        className={big ? 'font-mono font-bold' : 'font-mono font-semibold'}
        style={{
          fontSize: big ? '3.4rem' : '1.25rem',
          lineHeight: big ? 0.95 : 1.25,
          marginTop: big ? '0.15rem' : '0.1rem',
          letterSpacing: big ? '-0.02em' : 0,
          color: big ? 'var(--chord)' : 'var(--chart-text, var(--ds-gray-1000))',
        }}
      >
        {value}
      </div>
    </div>
  );
}

/** A paragraph of prose — the scripture, the story, the notes. */
function Prose({ label, children }) {
  return (
    <div>
      <div
        className="text-label-11 uppercase mb-1.5"
        style={{ letterSpacing: '0.09em', color: 'var(--chart-subtle, var(--ds-gray-600))' }}
      >
        {label}
      </div>
      <div className="text-copy-14" style={{ color: 'var(--chart-text, var(--ds-gray-1000))', opacity: 0.88 }}>
        {children}
      </div>
    </div>
  );
}

function Body({ song, displayKey, capo, capoShapeKey, arrangementName, notes, facts }) {
  const inline = facts.filter(f => f.label);
  const usually = inline.find(f => f.label === 'Usually played in');
  const written = inline.find(f => f.label === 'Written in');

  return (
    <div className="flex flex-col gap-7">
      <div>
        <div
          className="text-label-11 uppercase"
          style={{ letterSpacing: '0.14em', color: 'var(--chart-subtle, var(--ds-gray-600))' }}
        >
          the song
        </div>
        <h2
          className="m-0 font-semibold"
          style={{
            fontSize: '1.55rem', lineHeight: 1.12, letterSpacing: '-0.02em',
            marginTop: '0.35rem', color: 'var(--chart-text, var(--ds-gray-1000))',
            textWrap: 'balance',
          }}
        >
          {song.title}
        </h2>
        {song.artist && song.artist !== 'Unknown' && (
          <div className="text-copy-14 mt-1" style={{ color: 'var(--chart-subtle, var(--ds-gray-700))' }}>
            {song.artist}
          </div>
        )}
      </div>

      {/* ── The key, and everything else under it ─────────────────────────
          The key is the fact you are checking nine times out of ten, so it is
          the biggest thing here. ⚠ It sits ALONE on its line: the first cut put
          the capo and tempo in a column beside it, and at these sizes the two
          columns came out the same height — so it read as a 2×2 grid of peers
          rather than one hero with its footnotes. Subordination has to be
          visible in the layout, not just in the type size. */}
      <div>
        <Fact label="Key" value={displayKey || song.key} big />
        <div
          className="font-mono mt-2.5 flex flex-wrap gap-x-4 gap-y-1"
          style={{ fontSize: '0.95rem', color: 'var(--chart-subtle, var(--ds-gray-700))' }}
        >
          {capo ? (
            <span style={{ color: 'var(--chart-text, var(--ds-gray-1000))' }}>
              capo {capo}{capoShapeKey ? ` · ${capoShapeKey}` : ''}
            </span>
          ) : null}
          {song.tempo ? <span>♩ {song.tempo}</span> : null}
          {song.time ? <span>{song.time}</span> : null}
          {written && <span>written in {written.value}</span>}
        </div>
      </div>

      {usually && <Fact label="Usually played in" value={usually.value} />}
      {arrangementName && <Fact label="Arrangement" value={arrangementName} />}

      {/* ⚠ These two are the ONLY fields borrowed from the hub's set, and they
          are here on the "does it change how you play it" test rather than
          because they exist. Owner, on resurfacing `story`: *"maybe it could be
          an inspiration?"* — which is exactly the job. */}
      {song.scripture && <Prose label="Scripture">{song.scripture}</Prose>}
      {song.story && <Prose label="Story"><NoteContent text={song.story} /></Prose>}
      {notes && <Prose label="Notes"><NoteContent text={notes} /></Prose>}
    </div>
  );
}

export default function SongInfoView({
  open, onClose, wide, song, displayKey, capo = 0, capoShapeKey = null,
  showTempoTime = false, arrangementName = null, notes = null,
}) {
  if (!open || !song) return null;
  const facts = songInfoFacts({ song, displayKey, showTempoTime, arrangementName, notes });
  const body = (
    <Body
      song={song} displayKey={displayKey} capo={capo} capoShapeKey={capoShapeKey}
      arrangementName={arrangementName} notes={notes} facts={facts}
    />
  );

  if (wide) {
    return (
      <aside
        aria-label={`${song.title} — song info`}
        className="shrink-0 h-full overflow-y-auto border-l"
        style={{
          width: 'min(340px, 34vw)',
          borderColor: 'var(--chart-rule, var(--ds-gray-300))',
          background: 'var(--chart-bg, var(--ds-background-100))',
          padding: '1.25rem 1.25rem 2rem',
        }}
      >
        <div className="flex justify-end mb-1">
          <button
            type="button" onClick={onClose} aria-label="Close song info"
            className="min-h-0 w-11 h-11 grid place-items-center rounded-lg bg-transparent border-none cursor-pointer"
            style={{ color: 'var(--chart-subtle, var(--ds-gray-700))' }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
        </div>
        {body}
      </aside>
    );
  }

  // ── The phone takeover ────────────────────────────────────────────────────
  // ⚠ `absolute`, not `fixed`, and it covers the READER rather than the
  // viewport. The reader's root is `relative` for exactly this reason (element
  // 5's floating action anchors to it too) — anchored to the viewport instead,
  // this would sit over the app's own chrome on any surface that embeds the
  // reader rather than filling the screen.
  //
  // The whole surface closes it. There is nothing to aim at, which is the point
  // of a takeover: you summoned it, you read it, you tap and it is gone.
  return (
    <div
      role="dialog" aria-modal="true" aria-label={`${song.title} — song info`}
      onClick={onClose}
      className="absolute inset-0 z-[60] overflow-y-auto"
      style={{
        background: 'var(--chart-bg, var(--ds-background-100))',
        padding: '1.5rem 1.25rem calc(2rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {body}
      <div
        className="text-label-11 text-center mt-9"
        style={{ letterSpacing: '0.08em', color: 'var(--chart-subtle, var(--ds-gray-600))' }}
      >
        tap anywhere to go back
      </div>
    </div>
  );
}
