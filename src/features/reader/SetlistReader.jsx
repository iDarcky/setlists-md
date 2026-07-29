import { useState, useMemo, useCallback } from 'react';
import { resolveSongView } from '@/arrangements';
import { resolveReaderConfig } from '@/lib/readerConfig';
import Reader from './Reader';
import ReaderFooter from './ReaderFooter';
import BreakScreen from './BreakScreen';

/**
 * A setlist read through the reader — prev/next and nothing more.
 *
 * Paging gestures, the practice tools bar, wake-lock, session stats and the
 * finale screens belong to elements we have not designed yet, and carrying
 * them early is what buried elements 1–6 last time. They come back when their
 * element does.
 */
export default function SetlistReader({
  setlist, songs, settings, onUpdateSettings, onBack, onFinish,
  // What this player is scheduled on for the service, so their instrument's
  // tabs open and everyone else's collapse.
  myInstrument = null,
}) {
  const [idx, setIdx] = useState(0);
  const [keys, setKeys] = useState({});

  const items = useMemo(() => (setlist?.items || []).map(it => {
    if (it.type === 'break') return { ...it, isBreak: true };
    let raw = songs.find(s => s.id === it.songId);
    if (!raw && it.songTitle) raw = songs.find(s => s.title === it.songTitle);
    if (!raw) return { ...it, isMissing: true };
    const song = resolveSongView(raw, it.arrangementId);
    return song ? { ...it, song } : { ...it, isMissing: true };
  }), [setlist, songs]);

  const total = items.length;
  const cur = items[idx];
  const nxt = items[idx + 1] || null;
  const go = useCallback((n) => setIdx(Math.max(0, Math.min(total - 1, n))), [total]);

  // The footer needs only the one knob, but it has to come from the same
  // resolver as the rest of the reader or the setting silently does nothing.
  const footerStyle = resolveReaderConfig(settings).footer;

  if (!total) {
    return (
      <div className="h-full flex items-center justify-center p-10 text-center text-copy-14 text-[var(--ds-gray-600)]">
        This setlist has no songs yet.
      </div>
    );
  }

  const nextLabel = nxt
    ? (nxt.isBreak ? (nxt.label || 'Break') : (nxt.song?.title || nxt.songTitle || 'Song'))
    : null;
  const nextKey = nxt && !nxt.isBreak && nxt.song
    ? (keys[nxt.song.id] || nxt.key || nxt.song.key || null)
    : null;

  // ONE footer, built once, handed to both surfaces — a break must not draw
  // its own bar with the exit stranded inside it.
  const footer = (
    <ReaderFooter
      index={idx}
      total={total}
      style={footerStyle}
      nextLabel={nextLabel}
      nextKey={nextKey}
      onPrev={() => go(idx - 1)}
      onNext={() => go(idx + 1)}
      onFinish={() => onFinish?.({ songCount: total })}
    />
  );

  if (cur?.isBreak || cur?.isMissing) {
    return (
      <BreakScreen
        label={cur.label}
        duration={cur.duration}
        note={cur.note}
        missing={!!cur.isMissing}
        onExit={onBack}
        footer={footer}
      />
    );
  }

  const songId = cur.song.id;
  return (
    <Reader
      song={cur.song}
      settings={settings}
      onUpdateSettings={onUpdateSettings}
      myInstrument={myInstrument}
      onExit={onBack}
      selectedKey={keys[songId] || cur.key || cur.song.key}
      onSelectKey={(k) => setKeys(prev => ({ ...prev, [songId]: k }))}
      footer={footer}
    />
  );
}
