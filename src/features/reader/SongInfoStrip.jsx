import { songInfoFacts } from './songInfo';
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
 * ── Why it is NOT a panel ───────────────────────────────────────────────────
 * It was one, for exactly one round: a centred `Dialog` on wide and a
 * `BottomSheet` on a phone. Owner: *"I think the song panel is ugly, maybe we
 * can use something else, not necessarily a panel?"* — and the objection is
 * structural, not cosmetic. A modal is the wrong OBJECT here on three counts:
 *
 *   · it reads as a settings dialog, because that is what every other modal in
 *     the app is;
 *   · it dims and covers the chart, which is the one thing the reader exists to
 *     show — during a service that is actively wrong;
 *   · it is a new surface, and the reader already has too many (the owner's
 *     own "unify the ☰ with the rest" complaint, same day).
 *
 * So the chrome UNFOLDS instead. The sticky block already stacks set bar →
 * header → ribbon; this is a fourth row that appears when asked and folds away
 * when asked again. Nothing is covered, nothing is dimmed, and it behaves
 * identically live — the chart just starts lower for as long as you want it to.
 *
 * ── Why it is NOT `SongDetails` ─────────────────────────────────────────────
 * The obvious build was to reuse the Song Hub's Details tab. The owner said no,
 * and he is right: *"there might be too many info there that are not relevant
 * in a practice/live scenario."* Details carries CCLI, publishers, copyright,
 * writers, album, label, year, themes, genres, translator — a cataloguing
 * surface. None of it changes how you play the song in the next four minutes.
 *
 * So the test for anything here is: **would a musician holding the iPad act on
 * it during a rehearsal?** Six things pass — key, capo, tempo, time, which
 * arrangement, and the song's own notes. Everything else belongs in the hub,
 * where you are cataloguing rather than playing. When something new wants to
 * live here, apply the test again.
 *
 * Of those six, the strip draws only the ones the BAR is not already drawing —
 * see `songInfoFacts`.
 *
 * ── The way in ──────────────────────────────────────────────────────────────
 * The TITLE, at every width (owner: *"The tap target should be the title
 * everywhere"*). It is the widest, safest target in the bar, it did nothing at
 * all until now, and "what is this song" is what a title is for. No new chrome.
 */

/**
 * One fact, read as a sentence fragment rather than a form field.
 *
 * The panel version laid these out as a grid of LABEL-over-value cards, which
 * is what made it look like Settings. A strip wants them inline and small: the
 * label is a quiet prefix, the value carries the weight, and the whole row
 * reads left to right like the top of a printed chart.
 */
function Fact({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-label-11" style={{ color: 'var(--chart-subtle, var(--ds-gray-600))' }}>
        {label}
      </span>
      <span className="text-label-13 font-semibold" style={{ color: 'var(--chart-text, var(--ds-gray-1000))' }}>
        {value}
      </span>
    </span>
  );
}

export default function SongInfoStrip({
  open, song, displayKey, showTempoTime = false,
  arrangementName = null, notes = null,
}) {
  if (!open || !song) return null;
  const facts = songInfoFacts({ song, displayKey, showTempoTime, arrangementName, notes });
  if (facts.length === 0) return null;
  const inline = facts.filter(f => !f.notes);

  return (
    <div
      className="wide-container py-2"
      // A hairline above, not around. The strip is part of the chrome block, so
      // a box would draw a card inside a bar — the mistake the panel made, at
      // a smaller scale.
      style={{ borderTop: '1px solid var(--chart-rule, var(--ds-gray-300))' }}
    >
      {inline.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          {inline.map(f => <Fact key={f.label} label={f.label} value={f.value} />)}
        </div>
      )}
      {notes && (
        <div className={inline.length ? 'mt-2' : ''} style={{ color: 'var(--chart-subtle, var(--ds-gray-700))' }}>
          <NoteContent text={notes} className="text-copy-14" />
        </div>
      )}
    </div>
  );
}
