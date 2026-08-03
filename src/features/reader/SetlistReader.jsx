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
import MissingSongScreen from './MissingSongScreen';
import SetlistRail from './SetlistRail';
import ReaderSetlistBar from './ReaderSetlistBar';
import ReaderMenu from './ReaderMenu';

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
  // Element 14. The 30-day bin, so a missing song can be put back from the
  // place you notice it's gone rather than from Settings → Data.
  trash = [], onRestoreSong,
  // 'live' | 'practice' — see the note on Reader's own `mode`.
  mode = 'live',
  // Element 12 — a tapped tempo saves to the song.
  onUpdateSong = null,
  // Which item to open on. Tapping a song in the setlist overview means "start
  // HERE", and until now the reader ignored it and always opened song 1 — the
  // old `PracticeView` honoured it, the reader that replaced it did not.
  startIndex = 0,
}) {
  const [idx, setIdx] = useState(() => {
    const n = (setlist?.items || []).length;
    return Number.isInteger(startIndex) && startIndex > 0 && startIndex < n ? startIndex : 0;
  });
  const [keys, setKeys] = useState({});
  const [railOpen, setRailOpen] = useState(false);
  // The ☰ for the break / missing-song screens — see `openMenu` below. STAMPED
  // with the item it was opened on, and derived rather than cleared by an
  // effect: this menu is mounted a level above the screen it belongs to, so
  // navigating away would otherwise leave it hanging over the next song still
  // holding the break's anchor rect. Same shape as `Reader`'s `tempoSet`.
  const [menu, setMenu] = useState(null);
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
    return { ...it, shownKey: shown, transpose: semitonesBetween(it.song.key, shown) };
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

  // Element 13. The finale takes ONE thing: when the session started. An
  // earlier cut also handed over the whole set (`played`) to list on the finale;
  // that list turned a full stop into a page you scroll, and was cut. Don't
  // reintroduce the payload without the screen that needs it.
  const finish = () => onFinish?.({ startTime });

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

  // Element 8 — the app's original player bar as a top-bar option. Only the
  // setlist can build it: the reader knows one song, this maps the whole set.
  const underBar = cfg.topBar === 'setlist' ? (
    <ReaderSetlistBar items={railItems} idx={idx} onSelect={go} />
  ) : null;

  const swipe = cfg.nav === 'swipe'
    ? { onSwipeLeft: goNext, onSwipeRight: goPrev }
    : {};

  // Element 14 — a missing song is not a break, and must not look like one.
  // `songId` is matched against the bin because the setlist item still holds
  // the id of the song that was deleted; that's the whole recovery path.
  const recoverable = cur?.isMissing && onRestoreSong
    ? trash.find(e => e.song?.id === cur.songId)
    : null;

  // The ☰ on a screen that has no song. `Reader` owns its own menu (it is also
  // used standalone, by `FullscreenReader`), so this second mount is only ever
  // reached by the break and missing-song branches below — the two bodies that
  // are NOT the reader. `ReaderMenu` already optional-chains `song`, so Look,
  // Layout and the role picker work exactly as they do on a song; the panels
  // that read the song simply have nothing to show.
  const menuAnchor = menu?.idx === idx ? menu.rect : null;
  const openMenu = (rect) => setMenu(m => (m?.idx === idx ? null : { idx, rect }));

  const body = cur?.isMissing ? (
    <MissingSongScreen
      title={cur.songTitle || recoverable?.song?.title}
      onExit={onBack}
      onMenu={openMenu}
      aboveBar={underBar}
      onRestore={recoverable ? () => onRestoreSong(cur.songId) : null}
      onSkip={goNext}
      hasNext={idx < total - 1}
      footer={footer}
    />
  ) : cur?.isBreak ? (
    <BreakScreen
      label={cur.label}
      duration={cur.duration}
      note={cur.note}
      onExit={onBack}
      onMenu={openMenu}
      aboveBar={underBar}
      footer={footer}
    />
  ) : (
    <Reader
      song={cur.song}
      settings={settings}
      onUpdateSettings={onUpdateSettings}
      myInstrument={myInstrument}
      mode={mode}
      onUpdateSong={onUpdateSong}
      onExit={onBack}
      selectedKey={keys[cur.song.id] || cur.key || cur.song.key}
      onSelectKey={(k) => setKeys(prev => ({ ...prev, [cur.song.id]: k }))}
      footer={footer}
      underBar={underBar}
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
      {menuAnchor && (
        <ReaderMenu
          anchorRect={menuAnchor}
          onClose={() => setMenu(null)}
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          song={null}
          config={cfg}
          mode={mode}
          lyricSize={cfg.display.lyricFontSize}
          onLyricSize={(v) => onUpdateSettings?.('defaultFontSize', v)}
          chordSize={cfg.display.chordFontSize}
          onChordSize={(v) => onUpdateSettings?.('chordFontSize', v)}
        />
      )}
    </div>
  );
}
