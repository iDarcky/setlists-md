import BottomSheet from '@/ui/BottomSheet';
import { Dialog } from '@/ui/Dialog';
import NoteContent from '@/ui/NoteContent';

/**
 * What this song IS — the facts you want mid-rehearsal, and only those.
 *
 * ── Why it exists ───────────────────────────────────────────────────────────
 * The reader's top bar can carry four things at most: key, capo, tempo, time.
 * When the chrome went up a size (2026-08-21) even that stopped fitting on a
 * phone, and tempo/time were the two that gave way. Owner: *"I think that we
 * need like a new song info panel or something similar in the reader, because
 * we removed the tempo and time signature. And that's quite important to se."*
 *
 * But the bar was never the real limit. **Most-played keys, the arrangement you
 * are reading, and the song's own notes have never fitted anywhere at any
 * width** — so this is not a phone workaround for a phone problem. It opens at
 * every width, from the same place.
 *
 * ── Why it is NOT `SongDetails` ─────────────────────────────────────────────
 * The obvious move was to reuse the Song Hub's Details tab. The owner said no,
 * and he is right: *"there might be too many info there that are not relevant
 * in a practice/live scenario."* Details carries CCLI, publishers, copyright,
 * writers, album, label, year, themes, genres, translator — a cataloguing
 * surface. None of it changes how you play the song in the next four minutes.
 *
 * So the test for anything on this panel is: **would a musician holding the
 * iPad act on it during a rehearsal?** Six things pass —
 *
 *   key (what you are in, what it was written in, what you usually play it in)
 *   capo · tempo · time · which arrangement · the song's own notes
 *
 * Everything else belongs in the hub, where you are cataloguing rather than
 * playing. When something new wants to live here, apply the test again.
 *
 * ── The way in ──────────────────────────────────────────────────────────────
 * The TITLE, at every width (owner: *"The tap target should be the title
 * everywhere"*). It is the widest, safest target in the bar, it did nothing at
 * all until now, and "what is this song" is what a title is for. No new chrome.
 *
 * ── The shape ───────────────────────────────────────────────────────────────
 * A bottom sheet on a phone, a centred dialog on a wide screen — the same
 * split `SetlistRail` already makes, for the same reason: 260px of side column
 * on a 390pt phone leaves no chart.
 */

/** One labelled fact. `hint` is the quiet second line under the value. */
function Fact({ label, value, hint }) {
  if (value == null || value === '') return null;
  return (
    <div className="min-w-0">
      <div
        className="text-label-11 uppercase tracking-wide"
        style={{ color: 'var(--ds-gray-600)' }}
      >
        {label}
      </div>
      <div className="text-heading-16 font-semibold mt-0.5" style={{ color: 'var(--ds-gray-1000)' }}>
        {value}
      </div>
      {hint && (
        <div className="text-label-12 mt-0.5" style={{ color: 'var(--ds-gray-600)' }}>
          {hint}
        </div>
      )}
    </div>
  );
}

/**
 * "usually in G ×5 · A ×3" — the leader's question, answered.
 *
 * ⚠ There is deliberately no tempo equivalent. `keyHistory` works because a
 * setlist item records `transpose`, so every past performance carries the key
 * it was played in. **Nothing records a tempo per performance** —
 * `SetlistItemRow`'s tempo field writes straight back to the SONG — so a
 * "most played tempo" would be one number repeated, not a history. Recording a
 * per-item tempo comes first; until it does, this panel shows the song's tempo
 * and does not pretend to know more.
 */
function playedIn(keyHistory) {
  const entries = Object.entries(keyHistory || {});
  if (entries.length === 0) return null;
  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, n]) => `${k} ×${n}`)
    .join('  ·  ');
}

function Body({ song, displayKey, capo, capoShapeKey, arrangementName, notes }) {
  const history = playedIn(song?.keyHistory);
  // The song's own key is only worth saying when it is NOT what you are
  // reading — otherwise the panel says "G" twice and neither one means
  // anything. Same rule the capo chip already follows in the bar.
  const written = song?.key && song.key !== displayKey ? `written in ${song.key}` : null;

  return (
    <div className="flex flex-col gap-5">
      {song?.artist && song.artist !== 'Unknown' && (
        <div className="text-copy-14" style={{ color: 'var(--ds-gray-700)' }}>{song.artist}</div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        <Fact label="Key" value={displayKey || song?.key} hint={written} />
        {capo ? <Fact label="Capo" value={`Capo ${capo}`} hint={capoShapeKey ? `${capoShapeKey} shapes` : null} /> : null}
        <Fact label="Tempo" value={song?.tempo ? `♩ ${song.tempo}` : null} />
        <Fact label="Time" value={song?.time} />
      </div>

      {history && (
        <div>
          <div className="text-label-11 uppercase tracking-wide" style={{ color: 'var(--ds-gray-600)' }}>
            Usually played in
          </div>
          <div className="text-copy-14 font-mono mt-1" style={{ color: 'var(--ds-gray-1000)' }}>
            {history}
          </div>
        </div>
      )}

      {/* Which arrangement you are reading. A song can carry several and the
          chart never says which one is on screen — the one place that
          ambiguity actually costs you something is a rehearsal where half the
          band is on a different one. */}
      {arrangementName && (
        <Fact label="Arrangement" value={arrangementName} />
      )}

      {notes && (
        <div>
          <div className="text-label-11 uppercase tracking-wide mb-1.5" style={{ color: 'var(--ds-gray-600)' }}>
            Notes
          </div>
          <NoteContent text={notes} className="text-copy-14" />
        </div>
      )}
    </div>
  );
}

export default function SongInfoSheet({
  open, onClose, wide,
  song, displayKey, capo = 0, capoShapeKey = null,
  arrangementName = null, notes = null,
}) {
  if (!open || !song) return null;
  const body = (
    <Body
      song={song}
      displayKey={displayKey}
      capo={capo}
      capoShapeKey={capoShapeKey}
      arrangementName={arrangementName}
      notes={notes}
    />
  );

  if (!wide) {
    return (
      <BottomSheet open onClose={onClose} title={song.title || 'Song'}>
        {body}
      </BottomSheet>
    );
  }

  return (
    <Dialog open onClose={onClose} size="sm" ariaLabel={`${song.title || 'Song'} — song info`}>
      <h2 className="m-0 mb-4 text-heading-20 font-semibold" style={{ color: 'var(--ds-gray-1000)' }}>
        {song.title}
      </h2>
      {body}
    </Dialog>
  );
}
