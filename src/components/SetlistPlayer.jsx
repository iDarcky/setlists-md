import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { transposeKey, sectionStyle } from '@/music';
import { resolveSongView } from '@/arrangements';
import { IconButton } from '@/ui/IconButton';
import NoteContent from '@/ui/NoteContent';
import ChartView from './ChartView';
import { useWakeLock } from '@/hooks/useWakeLock';

export default function SetlistPlayer({ setlist, songs, onBack, onFinish, defaultColumns, defaultFontSize, showInlineNotes, inlineNoteStyle, displayRole, duplicateSections }) {
  useWakeLock(true);
  const [idx, setIdx] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const songBarRef = useRef(null);

  // Session metrics for the finale screen.
  const [sessionStartTime] = useState(() => Date.now());
  const startTimeRef = useRef(sessionStartTime);
  const farthestIdxRef = useRef(0);

  const resolved = useMemo(() => {
    const acc = { count: 0 };
    return setlist.items
      .map(it => {
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

  const goNext = useCallback(() => setIdx(p => {
    const next = Math.min(resolved.length - 1, p + 1);
    if (next > farthestIdxRef.current) farthestIdxRef.current = next;
    return next;
  }), [resolved.length]);
  const goPrev = useCallback(() => setIdx(p => Math.max(0, p - 1)), []);

  const handleFinish = useCallback(() => {
    onFinish?.({
      startTime: startTimeRef.current,
      farthestIdx: farthestIdxRef.current,
    });
  }, [onFinish]);

  // Auto-scroll song strip to keep active item visible
  useEffect(() => {
    const container = songBarRef.current;
    if (!container) return;
    const activeBtn = container.children[idx];
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [idx]);

  // Keyboard / Bluetooth pedal navigation
  useEffect(() => {
    const handler = (e) => {
      // Ignore when typing in an input/textarea
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goPrev(); }
      if (e.key === '?' || (e.shiftKey && e.key === '/')) { e.preventDefault(); setShowHelp(s => !s); }
      if (e.key === 'Escape') { setShowHelp(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev]);

  if (!resolved.length) {
    return (
      <div className="p-10 text-center text-[var(--ds-gray-600)] text-copy-14">
        No items in setlist
      </div>
    );
  }

  const cur = resolved[idx];

  const isLast = idx === resolved.length - 1;
  const showFinish = isLast && typeof onFinish === 'function';
  const nav = (
    <div className="flex items-center gap-1.5">
      <span className="text-label-11-mono text-[var(--ds-gray-600)]">
        {idx + 1}/{resolved.length}
      </span>
      <IconButton
        variant="default"
        size="sm"
        onClick={goPrev}
        disabled={idx === 0}
        aria-label="Previous song"
      >
        &#9664;
      </IconButton>
      {showFinish ? (
        <button
          type="button"
          onClick={handleFinish}
          aria-label="Finish session"
          className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-label-12 font-semibold border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] text-[var(--ds-gray-900)] hover:bg-[var(--ds-gray-100)] hover:text-[var(--ds-gray-1000)] transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Finish
        </button>
      ) : (
        <IconButton
          variant="default"
          size="sm"
          onClick={goNext}
          disabled={idx === resolved.length - 1}
          aria-label="Next song"
        >
          &#9654;
        </IconButton>
      )}
      <IconButton
        variant="default"
        size="sm"
        onClick={() => setShowHelp(s => !s)}
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
      >
        ?
      </IconButton>
    </div>
  );

  const progress = (
    <div className="flex gap-0.5 px-5 pt-2 overflow-hidden">
      {resolved.map((r, i) => {
        const color = r.isBreak || r.isMissing
          ? '#6b7280'
          : sectionStyle(r.song.sections?.[0]?.type || 'Verse').b;
        return (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className="flex-1 rounded-sm border-none cursor-pointer transition-all duration-200 min-w-0 p-0"
            style={{
              height: i === idx ? 6 : 4,
              background: i === idx ? color : i < idx ? 'var(--ds-gray-500)' : 'var(--ds-gray-300)',
              minHeight: 'auto',
            }}
          />
        );
      })}
    </div>
  );

  const songBar = (
    <div ref={songBarRef} className="hide-scrollbar flex gap-1.5 px-5 py-1.5 overflow-auto">
      {resolved.map((r, i) => {
        const active = i === idx;
        if (r.isBreak) {
          return (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Break: ${r.label || 'Break'}`}
              className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed cursor-pointer transition-all duration-150 bg-transparent ${
                active ? 'border-[var(--ds-gray-600)] bg-[var(--ds-gray-200)]' : 'border-[var(--ds-gray-400)]'
              }`}
              style={{ minHeight: 'auto' }}
            >
              <svg
                width="11" height="11" viewBox="0 0 24 24" fill="currentColor"
                className={active ? 'text-[var(--ds-gray-700)]' : 'text-[var(--ds-gray-500)]'}
                aria-hidden="true"
              >
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
              <span className={`text-copy-11 whitespace-nowrap italic ${active ? 'font-semibold text-[var(--ds-gray-1000)]' : 'text-[var(--ds-gray-600)]'}`}>
                {r.label || 'Break'}
              </span>
            </button>
          );
        }
        if (r.isMissing) {
          return (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label="Missing song"
              className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed cursor-pointer transition-all duration-150 bg-transparent ${
                active ? 'border-[var(--ds-gray-600)] bg-[var(--ds-gray-200)]' : 'border-[var(--ds-gray-400)]'
              }`}
              style={{ minHeight: 'auto' }}
            >
              <span className="text-label-11-mono font-bold text-[var(--ds-gray-500)]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className={`text-copy-11 whitespace-nowrap italic ${active ? 'font-semibold text-[var(--ds-gray-1000)]' : 'text-[var(--ds-gray-600)]'}`}>
                Missing song
              </span>
            </button>
          );
        }
        const s = sectionStyle(r.song.sections?.[0]?.type || 'Verse');
        return (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border cursor-pointer transition-all duration-150 ${
              active ? '' : 'border-[var(--ds-gray-300)] bg-transparent'
            }`}
            style={{
              borderColor: active ? `${s.b}66` : undefined,
              background: active ? `${s.b}15` : undefined,
              minHeight: 'auto',
            }}
          >
            <span
              className="text-label-11-mono font-bold"
              style={{ color: active ? s.d : 'var(--ds-gray-500)' }}
            >
              {String(r.songNum || (i + 1)).padStart(2, '0')}
            </span>
            <span className={`text-copy-11 whitespace-nowrap ${active ? 'font-semibold text-[var(--ds-gray-1000)]' : 'text-[var(--ds-gray-600)]'}`}>
              {r.song.title}
            </span>
            <span
              className="text-label-10-mono"
              style={{ color: active ? 'var(--chord)' : 'var(--ds-gray-400)' }}
            >
              {transposeKey(r.song.key, r.transpose)}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        background: 'var(--chart-bg, var(--ds-background-100))',
        color: 'var(--chart-text, var(--ds-gray-1000))',
        fontFamily: 'var(--chart-font-lyric, var(--font-sans))',
        minHeight: '100dvh',
      }}
    >
      {/* Top row — setlist name on the left, close X on the right */}
      <div className="flex items-center gap-2.5 px-5 pt-2.5">
        <span className="text-label-13 font-semibold text-[var(--ds-gray-600)] flex-1 min-w-0 truncate">
          {setlist.name}
        </span>
        <IconButton variant="ghost" size="sm" onClick={onBack} aria-label="Close player">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </IconButton>
      </div>
      {progress}
      {songBar}
      {cur.note && !cur.isBreak && !cur.isMissing && (
        <div className="px-5 pt-1">
          <div className="px-3 py-1.5 rounded-md bg-[var(--ds-warning-soft)] border border-[var(--ds-warning-border)] text-label-12 text-[var(--ds-warning-900)]">
            {cur.note}
          </div>
        </div>
      )}
      {cur.isBreak ? (
        <div className="flex flex-col items-center justify-center px-5 py-20 min-h-[50vh]">
          <div className="text-heading-32 text-[var(--ds-gray-1000)] mb-2">
            {cur.label || 'Break'}
          </div>
          {cur.duration > 0 && (
            <div className="text-copy-16 text-[var(--ds-gray-600)] font-mono mb-2">
              {cur.duration} min
            </div>
          )}
          {cur.note && (
            <NoteContent
              text={cur.note}
              className="w-full max-w-xl mt-4 px-5 py-4 rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-gray-alpha-100)] text-copy-16 text-[var(--ds-gray-900)]"
            />
          )}
          <div className="mt-6">{nav}</div>
        </div>
      ) : cur.isMissing ? (
        <div className="flex flex-col items-center justify-center px-5 py-20 min-h-[50vh]">
          <div className="text-heading-32 text-[var(--ds-gray-1000)] mb-2 text-center">
            Missing Song
          </div>
          <div className="text-copy-16 text-[var(--ds-gray-600)] text-center mb-2">
            Waiting for sync
          </div>
          <div className="mt-6">{nav}</div>
        </div>
      ) : (
        <ChartView
          song={{ ...cur.song, key: transposeKey(cur.song.key, cur.transpose) }}
          onBack={onBack}
          navOverride={nav}
          compact
          forceTranspose={cur.transpose}
          capo={cur.capo || 0}
          defaultColumns={defaultColumns}
          defaultFontSize={defaultFontSize}
          showInlineNotes={showInlineNotes}
          inlineNoteStyle={inlineNoteStyle}
          displayRole={displayRole}
          duplicateSections={duplicateSections}
          notesPeekDefaultOpen={false}
        />
      )}
      {showHelp && (
        <ShortcutHelp onClose={() => setShowHelp(false)} />
      )}
    </div>
  );
}

function ShortcutHelp({ onClose }) {
  const rows = [
    { keys: ['→', 'PageDown'], desc: 'Next song' },
    { keys: ['←', 'PageUp'], desc: 'Previous song' },
    { keys: ['?'], desc: 'Show / hide this help' },
    { keys: ['Esc'], desc: 'Close this dialog' },
  ];
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="w-full max-w-sm rounded-xl bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--ds-gray-300)]">
          <h2 className="text-heading-16 text-[var(--ds-gray-1000)] m-0">Keyboard shortcuts</h2>
          <IconButton variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </IconButton>
        </div>
        <ul className="px-5 py-4 space-y-2.5">
          {rows.map((row, i) => (
            <li key={i} className="flex items-center justify-between gap-4">
              <span className="text-copy-14 text-[var(--ds-gray-1000)]">{row.desc}</span>
              <span className="flex gap-1.5">
                {row.keys.map((k) => (
                  <kbd
                    key={k}
                    className="px-2 py-0.5 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] text-label-11-mono text-[var(--ds-gray-1000)] font-semibold"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <div className="px-5 pb-4 text-copy-12 text-[var(--ds-gray-700)]">
          Tip: Bluetooth pedals that send Page Up/Page Down work for hands-free navigation.
        </div>
      </div>
    </div>
  );
}
