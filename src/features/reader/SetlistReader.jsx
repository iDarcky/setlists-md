import { useState, useMemo, useCallback, useEffect } from 'react';
import { resolveSongView } from '@/arrangements';
import { semitonesBetween, transposeKey } from '@/music';
import { resolveReaderConfig } from '@/lib/readerConfig';
import { resolveOpeningMode } from '@/lib/openingMode';
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
import { BAR_BUTTON } from './readerChrome';
import { IconButton } from '@/ui/IconButton';

const RAIL_OPEN_KEY = 'setlists-md:reader-rail-open';

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
  //
  // Since the union (2026-08-11) this is STATE, not a route: one entry point
  // opens the set and the chip in the top bar switches. `onModeChange` absent →
  // no chip, which is how the public share link stays Live forever.
  mode = 'live',
  onModeChange = null,
  // Element 12 — a tapped tempo saves to the song.
  onUpdateSong = null,
  // A key chosen in PRACTICE sticks, onto the setlist item. Absent → the key
  // stays session-only, which is what LIVE wants: a scramble mid-service is
  // not a decision about the set.
  onUpdateSetlist = null,
  // Edit mode's fork — only App can build it, from the real v2 song in state.
  onSaveAsArrangement = null,
  // Which item to open on. Tapping a song in the setlist overview means "start
  // HERE", and until now the reader ignored it and always opened song 1 — the
  // old `PracticeView` honoured it, the reader that replaced it did not.
  startIndex = 0,
  // Element 28 — where a locked control in the ☰ sends you.
  onUpgrade = null,
}) {
  const [idx, setIdx] = useState(() => {
    const n = (setlist?.items || []).length;
    return Number.isInteger(startIndex) && startIndex > 0 && startIndex < n ? startIndex : 0;
  });
  // The key you are reading in. Session-only in LIVE; in PRACTICE it is also
  // written onto the setlist item (`saveKey`), because practice is where
  // changing a key is a DECISION rather than a scramble.
  //
  // ⚠ `saveKey` was the second capability declared in `readerConfig` and read
  // by NOTHING — the same shape as `writeNotes`. So a key changed in practice
  // looked applied, survived until you left, and was gone next time, with the
  // setlist still showing the old one (owner, 2026-08-09).
  const [keys, setKeys] = useState({});
  // Remembered per DEVICE, not synced: whether you want the running order
  // beside the chart is a fact about the screen you are on, not a preference
  // that should follow you from a tablet to a phone. Same key idea as
  // `PerformanceView`'s RAIL_OPEN_KEY, which this rail is modelled on.
  const [railOpen, setRailOpen] = useState(() => {
    try { return localStorage.getItem(RAIL_OPEN_KEY) === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(RAIL_OPEN_KEY, railOpen ? '1' : '0'); } catch { /* private mode */ }
  }, [railOpen]);
  // The ☰ for the break / missing-song screens — see `openMenu` below. STAMPED
  // with the item it was opened on, and derived rather than cleared by an
  // effect: this menu is mounted a level above the screen it belongs to, so
  // navigating away would otherwise leave it hanging over the next song still
  // holding the break's anchor rect. Same shape as `Reader`'s `tempoSet`.
  const [menu, setMenu] = useState(null);
  // Set by `Reader` while its edit mode is open — see `locked` below.
  const [editingSong, setEditingSong] = useState(false);
  const wide = useMediaQuery('(min-width: 768px)');
  // Element 28: below 700 the ☰ DOCKS under the reader rather than opening a
  // popover. Declared up here with the other hooks — there is an early return
  // for an empty setlist below, and a hook after it is called conditionally.
  const menuDocks = useMediaQuery('(max-width: 699.98px)');
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

  // ── What key is this slot in? ────────────────────────────────────────────
  // ⚠ The setlist stores a TRANSPOSE, not a key. `SetlistBuilder` writes
  // `item.transpose` (semitones) and `SetlistOverview` reads it back through
  // `transposeKey`; `item.key` was read HERE and written by nobody, so a key
  // set in the builder never reached the reader — it opened in the song's
  // original key every time (owner, 2026-08-09). One representation, and it is
  // the one the rest of the app already agreed on.
  //
  // `it.key` stays as a fallback because an imported or shared setlist could
  // carry one, but nothing in this app writes it.
  const slotKey = (it) => {
    if (!it?.song) return null;
    if (it.transpose) return transposeKey(it.song.key, it.transpose);
    return it.key || it.song.key;
  };

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

  const cfg = resolveReaderConfig(settings, { wide, mode });
  // ── Is live on the table at all right now ────────────────────────────────
  // The same question `App` asks to decide which mode to OPEN in, asked again
  // for the ☰'s Live row — because the row has to survive the switch being
  // turned off, and `mode` stops saying live the instant it is.
  //
  // Read on every render rather than memoised: it is two string parses, and a
  // value frozen on mount would be wrong for anyone whose service starts while
  // they are already looking at the set — which is most of a band.
  const liveAvailable = resolveOpeningMode(setlist) === 'live';

  // Picking a key. Always applies to what you are reading; in practice it is
  // ALSO written onto the setlist item, which is what `saveKey` was declared
  // for. Writing to `items[idx].key` (the slot) rather than to the song keeps
  // it a decision about THIS set — the same song in another service is
  // untouched, and the song's own written key never moves.
  const pickKey = useCallback((k) => {
    const it = items[idx];
    if (!it?.song) return;
    setKeys(prev => ({ ...prev, [it.song.id]: k }));
    if (!cfg.can.saveKey || !onUpdateSetlist || !setlist) return;
    // ⚠ Write a TRANSPOSE, not a key — see `slotKey`. Writing `key` here is
    // what the builder and the overview would then fail to read, which is the
    // same bug pointing the other way.
    const semis = semitonesBetween(it.song.key, k);
    const nextItems = (setlist.items || []).map((raw, i) => (i === idx ? { ...raw, transpose: semis } : raw));
    onUpdateSetlist({ ...setlist, items: nextItems });
  }, [items, idx, cfg.can.saveKey, onUpdateSetlist, setlist]);

  // The reader reports when it is mid-edit, and the setlist's own controls go
  // inert — moving song, or opening the rail, would strand an applied change
  // with no way back to Cancel it. The reader holds the ✕ for the same reason.
  const locked = editingSong;

  // `SetlistList` keys each row off the song's own key plus a transpose, so
  // give it the key actually being read rather than the one on the song.
  const railItems = useMemo(() => items.map(it => {
    if (it.isBreak || it.isMissing || !it.song) return it;
    const shown = keys[it.song.id] || slotKey(it);
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
    ? (keys[nxt.song.id] || slotKey(nxt) || null)
    : null;

  // Element 13. The finale takes ONE thing: when the session started. An
  // earlier cut also handed over the whole set (`played`) to list on the finale;
  // that list turned a full stop into a page you scroll, and was cut. Don't
  // reintroduce the payload without the screen that needs it.
  const finish = () => onFinish?.({ startTime });

  const openRail = () => setRailOpen(o => !o);

  // Where you are in the SET, as a percentage. Drawn by `ReaderTopBar` so it
  // survives the set bar being off — it used to belong to `ReaderSetlistBar`,
  // which meant turning that off took the progress with it.
  // `null` hides the line entirely — `ReaderTopBar` already treats it that way,
  // so the knob needs no new branch anywhere.
  const progress = cfg.progress
    ? (total > 1 ? (idx / (total - 1)) * 100 : 100)
    : null;

  // ONE footer, built once, handed to both surfaces — a break must not draw
  // its own bar with the exit stranded inside it.
  // Hidden entirely while editing, like the pill and the edge arrows: every
  // button on it is disabled in that mode, and a whole bar of dead controls
  // under the edit row is worse than the room it takes.
  const footer = cfg.nav === 'footer' && !locked ? (
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
      {cfg.nav === 'pill' && !locked && (
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
      {cfg.nav === 'edge' && !locked && (
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
      {/* The pill, the edge arrows and the counter chip are all `fixed` to the
          bottom, so they sit ON TOP of the edit row rather than above it
          (owner, 2026-08-04). They are hidden while editing rather than
          restacked: song navigation is locked in edit mode anyway, so a control
          that cannot do anything is worse than no control. */}
      {(cfg.nav === 'edge' || cfg.nav === 'swipe') && !railOpen && !locked && (
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
      {/* Element 29's strip, and it can be turned off now (Layout → The set).
          It used to be unconditional: only its open/closed state was a
          preference, and that lived in localStorage per device. */}
      <SetlistRail
        open={railOpen}
        wide={wide}
        onClose={() => setRailOpen(false)}
        locked={locked}
        title={setlist?.name}
        items={railItems}
        idx={idx}
        onSelect={go}
      />
    </>
  );

  // Element 8 — the app's original player bar as a top-bar option. Only the
  // setlist can build it: the reader knows one song, this maps the whole set.
  // ABOVE the title row, not under it (element 8b, 2026-08-01) — it takes
  // nothing from the song's own structure ribbon, which keeps its place below.
  const aboveBar = cfg.topBar === 'setlist' ? (
    <ReaderSetlistBar items={railItems} idx={idx} onSelect={go} />
  ) : null;

  // NO rail button in the top bar any more. The toggle lives ON the rail (see
  // `SetlistRail`): the control that opens a panel belongs to the panel, and it
  // gives element 1's right edge back to the ✕ alone — the one control whose
  // position must never move, because it is the one reached without looking.
  const railButton = null;


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
  const menuNode = menuAnchor ? (
    <ReaderMenu
      dock={menuDocks ? 'bottom' : 'side'}
      onUpgrade={onUpgrade}
      anchorRect={menuAnchor}
      onClose={() => setMenu(null)}
      settings={settings}
      onUpdateSettings={onUpdateSettings}
      song={null}
      config={cfg}
      // The break and missing-song screens get the Live row too — you can be
      // sitting on a break when the service starts, and a menu that offers it
      // on a song but not on a break is the fork coming back in miniature.
      onModeChange={onModeChange}
      liveAvailable={liveAvailable}
      lyricSize={cfg.display.lyricFontSize}
      onLyricSize={(v) => onUpdateSettings?.('defaultFontSize', v)}
      chordSize={cfg.display.chordFontSize}
      onChordSize={(v) => onUpdateSettings?.('chordFontSize', v)}
    />
  ) : null;
  const menuDock = menuDocks ? menuNode : null;

  const body = cur?.isMissing ? (
    <MissingSongScreen
      title={cur.songTitle || recoverable?.song?.title}
      onExit={onBack}
      onMenu={openMenu}
      menuDock={menuDock}
      menuOpen={!!menuAnchor}
      aboveBar={aboveBar}
      leading={railButton}
      progress={progress}
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
      menuDock={menuDock}
      menuOpen={!!menuAnchor}
      aboveBar={aboveBar}
      leading={railButton}
      progress={progress}
      footer={footer}
    />
  ) : (
    <Reader
      song={cur.song}
      settings={settings}
      onUpdateSettings={onUpdateSettings}
      myInstrument={myInstrument}
      mode={mode}
      onModeChange={onModeChange}
      liveAvailable={liveAvailable}
      onUpdateSong={onUpdateSong}
      onSaveAsArrangement={onSaveAsArrangement}
      onUpgrade={onUpgrade}
      onExit={onBack}
      selectedKey={keys[cur.song.id] || slotKey(cur)}
      onSelectKey={pickKey}
      footer={footer}
      aboveBar={aboveBar}
      railButton={railButton}
      progress={progress}
      onEditingChange={setEditingSong}
      {...swipe}
    />
  );

  // A flex row, so the wide rail is a COLUMN beside the chart rather than an
  // overlay: the chart narrows instead of being covered. The pill, the edge
  // arrows and the phone sheet are all `fixed`, so they ignore this box.
  return (
    <div className="h-full flex">
      {/* On a phone the ☰ docks under the break/missing screen (`menuDock`);
          on a desktop `Reader` places it inside its own scroller, below the
          top bar. These two screens are not the reader, so they get the
          simpler treatment: the panel beside them, full height. */}
      {!menuDocks && menuNode && !cur?.song && (
        <div className="shrink-0 h-full" style={{ width: 'min(320px, 30vw)' }}>{menuNode}</div>
      )}
      <div className="flex-1 min-w-0 h-full">{body}</div>
      {overlay}

    </div>
  );
}
