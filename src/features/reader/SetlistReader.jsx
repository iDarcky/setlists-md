import { useState, useMemo, useCallback, useEffect } from 'react';
import { resolveSongView } from '@/arrangements';
import { semitonesBetween } from '@/music';
import { resolveReaderConfig } from '@/lib/readerConfig';
import { useMediaQuery } from '@/lib/useMediaQuery';
import FloatingNavPill from '@/ui/FloatingNavPill';
import EdgeNavArrows from '@/ui/EdgeNavArrows';
import Reader from './Reader';
import ReaderFooter from './ReaderFooter';
import BreakScreen from './BreakScreen';
import SetlistRail from './SetlistRail';

/**
 * A setlist read through the reader — element 10, and nothing more.
 *
 * The practice tools bar, wake-lock, session stats and the finale screens
 * belong to elements we have not designed yet, and carrying them early is what
 * buried elements 1–6 last time. They come back when their element does.
 */
export default function SetlistReader({
  setlist, songs, settings, onUpdateSettings, onBack, onFinish,
  // What this player is scheduled on for the service, so their instrument's
  // tabs open and everyone else's collapse.
  myInstrument = null,
}) {
  const [idx, setIdx] = useState(0);
  const [keys, setKeys] = useState({});
  const [railOpen, setRailOpen] = useState(false);
  const wide = useMediaQuery('(min-width: 768px)');
  // Element 13. The ONLY thing tracked through a session: when it started.
  // Everything else the old views carried in refs — farthest index, transpose
  // count, cue count, touched-song set — was tracking maintained all session
  // for a number on a screen nobody acts on.
  const [startTime] = useState(() => Date.now());

  const items = useMemo(() => (setlist?.items || []).map(it => {
    if (it.type === 'break') return { ...it, isBreak: true };
    let raw = songs.find(s => s.id === it.songId);
    if (!raw && it.songTitle) raw = songs.find(s => s.title === it.songTitle);
    if (!raw) return { ...it, isMissing: true };
    const song = resolveSongView(raw, it.arrangementId);
    return song ? { ...it, song } : { ...it, isMissing: true };
  }), [setlist, songs]);

  const total = items.length;
  const go = useCallback((n) => setIdx(Math.max(0, Math.min(total - 1, n))), [total]);
  const goPrev = useCallback(() => setIdx(p => Math.max(0, p - 1)), []);
  const goNext = useCallback(() => setIdx(p => Math.min(total - 1, p + 1)), [total]);

  // Keyboard and Bluetooth pedals are NOT one of the nav choices — a pedal
  // user has no other hands, so they work whatever else is on screen.
  useEffect(() => {
    const handler = (e) => {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goPrev(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev]);

  const cfg = resolveReaderConfig(settings, { wide });

  // `SetlistList` keys each row off the song's own key plus a transpose, so
  // give it the key actually being read rather than the one on the song.
  const railItems = useMemo(() => items.map(it => {
    if (it.isBreak || it.isMissing || !it.song) return it;
    const shown = keys[it.song.id] || it.key || it.song.key;
    return { ...it, transpose: semitonesBetween(it.song.key, shown) };
  }), [items, keys]);

  if (!total) {
    return (
      <div className="h-full flex items-center justify-center p-10 text-center text-copy-14 text-[var(--ds-gray-600)]">
        This setlist has no songs yet.
      </div>
    );
  }

  const cur = items[idx];
  const nxt = items[idx + 1] || null;
  const nextLabel = nxt
    ? (nxt.isBreak ? (nxt.label || 'Break') : (nxt.song?.title || nxt.songTitle || 'Song'))
    : null;
  const prevLabel = idx > 0
    ? (items[idx - 1].isBreak ? (items[idx - 1].label || 'Break') : (items[idx - 1].song?.title || 'Song'))
    : null;
  const nextKey = nxt && !nxt.isBreak && nxt.song
    ? (keys[nxt.song.id] || nxt.key || nxt.song.key || null)
    : null;

  // Element 13's "What changed": the keys actually moved during this session.
  // Derived from the transpose state the reader already holds — no writes, and no
  // editing added to a read-only surface. It is key changes ONLY; the reader
  // cannot touch cues or notes, so listing them would be listing nothing.
  // Element 13. The set as it was actually read, handed to the finale whole:
  // running order, and the key each song was read in rather than the key it is
  // written in. Resolved HERE because the reader has already done the work —
  // making the finale re-resolve items against `songs` would duplicate the
  // song-matching and arrangement logic on a screen that only wants to list it.
  //
  // A moved key travels on its own row (`fromKey`), so "what changed" is marked
  // where the song is instead of in a separate block that is usually empty.
  const finish = () => {
    const played = items.map((it, i) => {
      if (it.isBreak) return { id: `i${i}`, kind: 'break', title: it.label || 'Break' };
      if (it.isMissing || !it.song) {
        return { id: `i${i}`, kind: 'missing', title: it.songTitle || 'Missing song' };
      }
      const from = it.key || it.song.key;
      const to = keys[it.song.id] || from;
      return {
        id: `i${i}`,
        kind: 'song',
        title: it.song.title,
        key: to || null,
        fromKey: to && from && to !== from ? from : null,
      };
    });
    onFinish?.({ startTime, played });
  };
  const openRail = () => setRailOpen(o => !o);

  // ONE footer, built once, handed to both surfaces — a break must not draw
  // its own bar with the exit stranded inside it.
  const footer = cfg.nav === 'footer' ? (
    <ReaderFooter
      index={idx}
      total={total}
      style={cfg.footer}
      nextLabel={nextLabel}
      nextKey={nextKey}
      onPrev={goPrev}
      onNext={goNext}
      onFinish={finish}
      onOpenSetlist={openRail}
    />
  ) : null;

  // The overlay navs live outside the reader's scroll container, so they are
  // rendered here rather than passed down.
  const overlay = (
    <>
      {cfg.nav === 'pill' && (
        <FloatingNavPill
          current={idx + 1}
          total={total}
          nextLabel={cfg.footer === 'next' ? nextLabel : null}
          hasPrev={idx > 0}
          hasNext={idx < total - 1}
          onPrev={goPrev}
          onNext={goNext}
          onFinish={finish}
          onOpenSetlist={openRail}
        />
      )}
      {cfg.nav === 'edge' && (
        <EdgeNavArrows
          hasPrev={idx > 0}
          hasNext={idx < total - 1}
          onPrev={goPrev}
          onNext={goNext}
          onFinish={finish}
          nextLabel={nextLabel}
          prevLabel={prevLabel}
        />
      )}
      {/* Edge arrows and swipe carry no counter of their own, so without this
          there is no way into the setlist at all. */}
      {(cfg.nav === 'edge' || cfg.nav === 'swipe') && !railOpen && (
        <button
          type="button"
          onClick={openRail}
          aria-label="Open setlist"
          // min-h-0: the global `button { min-height: 44px }` on phones would
          // otherwise blow this chip up into a capsule.
          className="fixed left-1/2 -translate-x-1/2 z-[95] min-h-0 px-3 py-1 rounded-full border text-label-11 font-mono tabular-nums backdrop-blur-md cursor-pointer"
          style={{
            bottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
            background: 'var(--chart-header-bg, var(--header-bg-blur))',
            borderColor: 'var(--chart-header-border, var(--ds-gray-400))',
            color: 'var(--chart-subtle, var(--ds-gray-700))',
          }}
        >
          {idx + 1} / {total}
        </button>
      )}
      <SetlistRail
        open={railOpen}
        wide={wide}
        onClose={() => setRailOpen(false)}
        title={setlist?.name}
        items={railItems}
        idx={idx}
        onSelect={go}
      />
    </>
  );

  const swipe = cfg.nav === 'swipe'
    ? { onSwipeLeft: goNext, onSwipeRight: goPrev }
    : {};

  const body = (cur?.isBreak || cur?.isMissing) ? (
    <BreakScreen
      label={cur.label}
      duration={cur.duration}
      note={cur.note}
      missing={!!cur.isMissing}
      onExit={onBack}
      footer={footer}
    />
  ) : (
    <Reader
      song={cur.song}
      settings={settings}
      onUpdateSettings={onUpdateSettings}
      myInstrument={myInstrument}
      onExit={onBack}
      selectedKey={keys[cur.song.id] || cur.key || cur.song.key}
      onSelectKey={(k) => setKeys(prev => ({ ...prev, [cur.song.id]: k }))}
      footer={footer}
      {...swipe}
    />
  );

  // A flex row, so the wide rail is a COLUMN beside the chart rather than an
  // overlay: the chart narrows instead of being covered. The pill, the edge
  // arrows and the phone sheet are all `fixed`, so they ignore this box.
  return (
    <div className="h-full flex">
      <div className="flex-1 min-w-0 h-full">{body}</div>
      {overlay}
    </div>
  );
}
