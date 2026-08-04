import { useEffect, useState } from 'react';
import Reader from './Reader';

/**
 * Full screen, from the Song Hub — the Reader with nothing around it.
 *
 * `docs/READER.md` weighed three ways to build this and picked the cheapest
 * one that also stops the drift: full screen IS the Reader, single-song. Not a
 * fork, not a scaled-up hub view. Everything elements 1–13 settled — the top
 * bar, the ☰, the ribbon, the practice tools, the sticky headings — arrives
 * because it is literally the same component the setlist reads through. The
 * only thing missing is prev/next, and that is missing because there is no
 * next.
 *
 * Escape closes. The reader's own exit (⨯ in element 1's bar) closes too, so
 * there is no separate chrome layered on top; the previous scaffold drew its
 * own title bar over the chart's, which is two title bars for one song.
 */
export default function FullscreenReader({
  song, settings, onUpdateSettings, displayMode, selectedKey, onSelectKey, onClose,
  onUpdateSong = null,
  // Element 28 — where a locked control in the ☰ sends you.
  onUpgrade = null,
}) {
  // ── The flashbang ──────────────────────────────────────────────────────────
  // Owner, 2026-07-31: "the leader searches for a song at night and the reader
  // is set to light mode and presses full screen and bang flashbang."
  //
  // The hub wears the APP theme; the reader wears the CHART theme. A dark app
  // with a light chart theme means tapping full screen replaces the whole
  // screen with paper-white, instantly, in a dark room.
  //
  // This is the interim guard and it is deliberately the modest one: a scrim in
  // the app's own background colour, painted over the reader on mount and faded
  // out. The chart theme still wins — it is what the user set — it just stops
  // ARRIVING in one frame. The real policy question (should full screen honour
  // a light chart theme at all when the app is dark?) is the owner's to answer;
  // it is written up in `docs/READER.md` under "The flashbang".
  const [settling, setSettling] = useState(true);
  useEffect(() => {
    const id = requestAnimationFrame(() => setSettling(false));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.documentElement.classList.add('dialog-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('dialog-open');
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label={`${song?.title || 'Song'}, full screen`}>
      <Reader
        song={song}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
        onUpdateSong={onUpdateSong}
        onUpgrade={onUpgrade}
        displayMode={displayMode}
        selectedKey={selectedKey}
        onSelectKey={onSelectKey}
        onExit={onClose}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none transition-opacity duration-500 ease-out"
        style={{ background: 'var(--ds-background-100)', opacity: settling ? 1 : 0 }}
      />
    </div>
  );
}
