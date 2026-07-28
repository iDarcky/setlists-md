import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { resolveSongView } from '@/arrangements';
import { resolveReaderConfig } from '@/lib/readerConfig';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useConfirm } from '@/ui/useConfirmHook';
import { Button } from '@/ui/Button';
import NoteContent from '@/ui/NoteContent';
import Reader from './Reader';

/**
 * A setlist read through the one reader.
 *
 * Songs are **paged** — swipe or tap moves song to song, and you still scroll
 * within a song, because a five-verse hymn does not fit a phone screen at
 * readable type. Breaks render as their own card rather than an empty chart.
 */
export default function SetlistReader({
  setlist, songs, settings, onUpdateSettings, onBack, onFinish,
  preset = 'live', onPresetChange,
}) {
  const [idx, setIdx] = useState(0);
  const [keys, setKeys] = useState({});
  const wide = useMediaQuery('(min-width: 768px)');
  const confirm = useConfirm();
  // Lazily stamped on the first render that needs it — calling Date.now()
  // during render is impure and the compiler rejects it.
  const startedAt = useRef(null);
  const farthest = useRef(0);
  useEffect(() => { startedAt.current ??= Date.now(); }, []);

  const config = useMemo(
    () => resolveReaderConfig(settings, preset, { wide, setlist: true }),
    [settings, preset, wide]
  );

  // Wake-lock is a user choice, not a default. The old SetlistPlayer forced it
  // on unconditionally, which contradicts the setting that already exists.
  useWakeLock(settings?.keepAwake === true);

  const items = useMemo(() => {
    const acc = { count: 0 };
    return (setlist?.items || []).map(it => {
      if (it.type === 'break') return { ...it, isBreak: true };
      let raw = songs.find(s => s.id === it.songId);
      if (!raw && it.songTitle) raw = songs.find(s => s.title === it.songTitle);
      if (!raw) return { ...it, isMissing: true };
      const song = resolveSongView(raw, it.arrangementId);
      if (!song) return { ...it, isMissing: true };
      acc.count += 1;
      return { ...it, song, songNum: acc.count };
    });
  }, [setlist, songs]);

  const cur = items[idx];
  const total = items.length;

  const go = useCallback((next) => {
    const v = Math.max(0, Math.min(total - 1, next));
    if (v > farthest.current) farthest.current = v;
    setIdx(v);
  }, [total]);

  const goNext = useCallback(() => go(idx + 1), [go, idx]);
  const goPrev = useCallback(() => go(idx - 1), [go, idx]);

  const exit = useCallback(async () => {
    if (config.confirmExit) {
      const ok = await confirm({
        title: 'Leave the set?',
        description: 'You are part-way through. Your place will not be saved.',
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
      });
      if (!ok) return;
    }
    onBack?.();
  }, [config.confirmExit, confirm, onBack]);

  // Keyboard + foot pedal. The pedal sends the configured key codes.
  useEffect(() => {
    const nextKey = settings?.pedalNext || 'ArrowRight';
    const prevKey = settings?.pedalPrev || 'ArrowLeft';
    const handler = (e) => {
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
      if (e.key === nextKey) { e.preventDefault(); goNext(); }
      else if (e.key === prevKey) { e.preventDefault(); goPrev(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, settings?.pedalNext, settings?.pedalPrev]);

  const finish = useCallback(() => {
    const started = startedAt.current ?? Date.now();
    onFinish?.({
      songCount: items.filter(i => !i.isBreak && !i.isMissing).length,
      minutes: Math.max(1, Math.round((Date.now() - started) / 60000)),
      farthest: farthest.current,
    });
  }, [items, onFinish]);

  if (!total) {
    return (
      <div className="h-full flex items-center justify-center p-10 text-center text-copy-14 text-[var(--ds-gray-600)]">
        This setlist has no songs yet.
      </div>
    );
  }

  const pager = (
    <>
      <span className="text-label-11 tabular-nums text-[var(--chart-subtle,var(--ds-gray-700))]">
        {idx + 1} / {total}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        <Button size="sm" variant="secondary" onClick={goPrev} disabled={idx === 0}>Prev</Button>
        {idx === total - 1
          ? <Button size="sm" variant="brand" onClick={finish}>Finish</Button>
          : <Button size="sm" variant="secondary" onClick={goNext}>Next</Button>}
      </div>
    </>
  );

  const tools = config.showTools ? (
    <div className="flex items-center gap-1.5 mr-2">
      {/* Metronome, count-in, loop and slow-down all run on the YouTube player:
          seekTo + getCurrentTime gives a section loop, and setPlaybackRate
          preserves pitch so slowing down does not go flat. Pitch shift is not
          available, so there is deliberately no key control here. */}
      <Button size="sm" variant="secondary">♩ {cur?.song?.tempo || '—'}</Button>
      <Button size="sm" variant="secondary">Count-in</Button>
      <Button size="sm" variant="secondary">Loop</Button>
      <Button size="sm" variant="secondary">−10%</Button>
    </div>
  ) : null;

  if (cur?.isBreak) {
    return (
      <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--chart-bg, var(--ds-background-100))' }}>
        <div className="flex-1 min-h-0 flex items-center justify-center p-6">
          <div
            className="w-full max-w-md rounded-2xl border p-6 text-center"
            style={{ borderColor: 'var(--chart-rule, var(--ds-gray-300))', background: 'var(--chart-card, var(--ds-background-200))' }}
          >
            <div className="text-heading-24 text-[var(--chart-text,var(--ds-gray-1000))]">{cur.label || 'Break'}</div>
            {cur.duration && (
              <div className="mt-1 text-copy-15 font-mono text-[var(--color-brand)]">{cur.duration} min</div>
            )}
            {cur.note && (
              <div className="mt-4 pt-4 border-t text-copy-13 text-[var(--ds-gray-700)] text-left" style={{ borderColor: 'var(--chart-rule, var(--ds-gray-300))' }}>
                <NoteContent text={cur.note} />
              </div>
            )}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-t" style={{ borderColor: 'var(--chart-rule, var(--ds-gray-300))' }}>
          <Button size="sm" variant="ghost" onClick={exit}>Exit</Button>
          {pager}
        </div>
      </div>
    );
  }

  if (cur?.isMissing) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center gap-2 p-10 text-center">
          <div className="text-heading-20 text-[var(--ds-gray-1000)]">Song not available</div>
          <div className="text-copy-14 text-[var(--ds-gray-600)]">
            {cur.songTitle ? `“${cur.songTitle}” is not in this library yet.` : 'Waiting for sync.'}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-t border-[var(--ds-gray-300)]">
          <Button size="sm" variant="ghost" onClick={exit}>Exit</Button>
          {pager}
        </div>
      </div>
    );
  }

  const songId = cur.song.id;
  const selectedKey = keys[songId] || cur.key || cur.song.key;

  return (
    <Reader
      song={cur.song}
      settings={settings}
      onUpdateSettings={onUpdateSettings}
      preset={preset}
      onPresetChange={onPresetChange}
      onExit={exit}
      setlist
      selectedKey={selectedKey}
      onSelectKey={(k) => setKeys(prev => ({ ...prev, [songId]: k }))}
      footer={<>{tools}{pager}</>}
    />
  );
}
