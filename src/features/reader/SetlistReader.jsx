import { useState, useMemo, useCallback } from 'react';
import { resolveSongView } from '@/arrangements';
import { Button } from '@/ui/Button';
import NoteContent from '@/ui/NoteContent';
import Reader from './Reader';

/**
 * A setlist read through the reader — deliberately thin.
 *
 * This is prev/next and nothing more. Paging gestures, the practice tools bar,
 * wake-lock, session stats and the finale screens all belong to elements we
 * have not designed yet, and carrying them early is what buried elements 1–6
 * last time. They come back when their element does.
 */
export default function SetlistReader({
  setlist, songs, settings, onUpdateSettings, onBack, onFinish,
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
  const go = useCallback((n) => setIdx(Math.max(0, Math.min(total - 1, n))), [total]);

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
        <Button size="sm" variant="secondary" onClick={() => go(idx - 1)} disabled={idx === 0}>Prev</Button>
        {idx === total - 1
          ? <Button size="sm" variant="brand" onClick={() => onFinish?.({ songCount: total })}>Finish</Button>
          : <Button size="sm" variant="secondary" onClick={() => go(idx + 1)}>Next</Button>}
      </div>
    </>
  );

  if (cur?.isBreak || cur?.isMissing) {
    return (
      <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--chart-bg, var(--ds-background-100))' }}>
        <div className="flex-1 min-h-0 flex items-center justify-center p-6">
          <div
            className="w-full max-w-md rounded-2xl border p-6 text-center"
            style={{ borderColor: 'var(--chart-rule, var(--ds-gray-300))' }}
          >
            <div className="text-heading-20 text-[var(--chart-text,var(--ds-gray-1000))]">
              {cur.isBreak ? (cur.label || 'Break') : 'Song not available'}
            </div>
            {cur.isBreak && cur.duration && (
              <div className="mt-1 text-copy-15 font-mono text-[var(--chord)]">{cur.duration} min</div>
            )}
            {cur.isBreak && cur.note && (
              <div className="mt-4 pt-4 border-t text-copy-13 text-left text-[var(--chart-subtle,var(--ds-gray-700))]"
                style={{ borderColor: 'var(--chart-rule, var(--ds-gray-300))' }}>
                <NoteContent text={cur.note} />
              </div>
            )}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-t" style={{ borderColor: 'var(--chart-rule, var(--ds-gray-300))' }}>
          <Button size="sm" variant="ghost" onClick={onBack}>Exit</Button>
          {pager}
        </div>
      </div>
    );
  }

  const songId = cur.song.id;
  return (
    <Reader
      song={cur.song}
      settings={settings}
      onUpdateSettings={onUpdateSettings}
      onExit={onBack}
      selectedKey={keys[songId] || cur.key || cur.song.key}
      onSelectKey={(k) => setKeys(prev => ({ ...prev, [songId]: k }))}
      footer={pager}
    />
  );
}
