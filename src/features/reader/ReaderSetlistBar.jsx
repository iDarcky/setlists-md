import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Element 8 — the setlist bar, the reader's second top-bar treatment.
 *
 * This is the app's ORIGINAL player bar, kept because the owner still likes it:
 * a thin progress line across the whole set, then every item as a chip —
 * numbered songs with their key, breaks dashed and italic. The whole running
 * order is visible and tappable without opening anything.
 *
 * It replaces the structure ribbon when chosen, and it is a REPLACEMENT rather
 * than an addition on purpose: the ribbon maps where you are in a SONG, this
 * maps where you are in the SET, and stacking both is two maps competing for
 * the same glance.
 *
 * Element 1 said the top bar takes no customization, and this is the one
 * exception the owner asked for by name. The bar itself — menu, title, key,
 * exit — is still fixed; only what hangs under it changes.
 */
export default function ReaderSetlistBar({ items, idx, onSelect }) {
  const barRef = useRef(null);
  const activeRef = useRef(null);
  // Which ends have more set beyond them. Owner, 2026-08-03: the bar "is not
  // scrollable on desktop" — it always was (`overflow-x-auto`), but
  // `no-scrollbar` hides the only affordance a mouse has, so on a desktop
  // there was no bar to drag, no gesture, and nothing saying the set continued.
  const [edges, setEdges] = useState({ start: false, end: false });

  const syncEdges = useCallback(() => {
    const el = barRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges(prev => {
      // 1px of slack: fractional DPRs never land exactly on 0 or on max.
      const next = { start: el.scrollLeft > 1, end: el.scrollLeft < max - 1 };
      return (prev.start === next.start && prev.end === next.end) ? prev : next;
    });
  }, []);

  // Keep the current chip in view, the same way the ribbon does. Without this
  // the bar is a map of a set you can't see your place in.
  useEffect(() => {
    const el = activeRef.current;
    const bar = barRef.current;
    if (!el || !bar || typeof el.scrollIntoView !== 'function') return;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [idx]);

  // A vertical wheel scrolls it sideways while the pointer is over it — the
  // same idiom the ☰'s theme strip uses. `passive: false` because the handler
  // calls preventDefault; React's onWheel is passive and cannot.
  useEffect(() => {
    const el = barRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!e.deltaY || el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Re-measure when the set changes or the bar is resized (rotation, the rail
  // opening beside it), not only on scroll.
  useEffect(() => {
    syncEdges();
    const el = barRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(syncEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncEdges, items, idx]);

  const fade = (dir) => ({
    background: `linear-gradient(to ${dir}, var(--chart-bg, var(--ds-background-100)), transparent)`,
  });

  return (
    <div className="shrink-0">
      {/* The progress line moved to `ReaderTopBar`: living here meant turning
          the set bar off took the progress with it. */}
      {/* `relative` so the fades can sit over the ends of the scroller. */}
      <div className="relative">
      <div
        ref={barRef}
        onScroll={syncEdges}
        // items-center: this was the ONE row in the sticky block that did not
        // centre its children (the default `stretch` made each chip's box
        // taller than its own content). py-1 to match the bar and the ribbon.
        className="no-scrollbar flex items-center gap-1.5 px-3 sm:px-5 py-1 overflow-x-auto"
      >
        {items.map((item, i) => {
          const active = i === idx;
          const ref = active ? activeRef : undefined;
          const common = 'min-h-0 shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg cursor-pointer transition-colors bg-transparent';

          if (item.isBreak) {
            return (
              <button
                key={i} ref={ref} type="button" onClick={() => onSelect(i)}
                aria-label={`Break: ${item.label || 'Break'}`}
                aria-current={active ? 'true' : undefined}
                className={`${common} border border-dashed`}
                style={{
                  borderColor: active ? 'var(--chart-text, var(--ds-gray-1000))' : 'var(--chart-rule, var(--ds-gray-400))',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
                  style={{ color: 'var(--chart-subtle, var(--ds-gray-600))' }}>
                  <rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
                <span
                  className={`text-label-11 whitespace-nowrap italic ${active ? 'font-semibold' : ''}`}
                  style={{ color: active ? 'var(--chart-text, var(--ds-gray-1000))' : 'var(--chart-subtle, var(--ds-gray-600))' }}
                >
                  {item.label || 'Break'}
                </span>
              </button>
            );
          }

          const title = item.song?.title || item.songTitle || 'Song';
          const key = item.song ? (item.shownKey || item.song.key) : null;
          // Songs are numbered; breaks are not. A 9-song set that numbers its
          // breaks reads as 11 songs.
          const number = items.slice(0, i + 1).filter(it => !it.isBreak).length;

          return (
            <button
              key={i} ref={ref} type="button" onClick={() => onSelect(i)}
              aria-current={active ? 'true' : undefined}
              className={`${common} border`}
              style={{
                borderColor: active ? 'transparent' : 'var(--chart-rule, var(--ds-gray-300))',
                background: active ? 'var(--chart-text, var(--ds-gray-1000))' : 'transparent',
              }}
            >
              <span
                className="text-label-11 font-mono font-bold tabular-nums"
                style={{ color: active ? 'var(--chart-bg, var(--ds-background-100))' : 'var(--chart-subtle, var(--ds-gray-500))' }}
              >
                {String(number).padStart(2, '0')}
              </span>
              <span
                className={`text-label-11 whitespace-nowrap ${active ? 'font-semibold' : ''}`}
                style={{ color: active ? 'var(--chart-bg, var(--ds-background-100))' : 'var(--chart-text, var(--ds-gray-900))' }}
              >
                {title}
              </span>
              {key && (
                <span className="text-label-11 font-mono font-bold" style={{ color: 'var(--chord)' }}>
                  {key}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* The affordance a mouse has instead of a scrollbar: the set visibly
          runs off the edge. `pointer-events-none` so the chips underneath
          stay tappable right up to the edge. */}
      {edges.start && (
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8" style={fade('right')} />
      )}
      {edges.end && (
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8" style={fade('left')} />
      )}
      </div>
    </div>
  );
}
