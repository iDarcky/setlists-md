import { useRef, useState } from 'react';
import type { ReactNode, TouchEvent } from 'react';
import { cn } from '@/ui/shadcn/utils';

// Chart | Info on the song page (approved mockup "new song chart" v3/v4,
// owner 2026-11-20): two tabs under the header, and on a touch screen a
// sideways swipe moves between them, the ink bar following the finger. Each
// page scrolls on its own, so swiping back finds Chart where you left it.
//
// A swipe starts only when the finger moves clearly sideways, and never from
// a text box or anything marked `data-no-swipe` (the order chips drag).

const NO_SWIPE = 'input, textarea, select, [contenteditable="true"], [data-no-swipe]';

export function SwipeTabs({ labels, index, onIndex, pages, swipe = true, className, tabsClassName }: {
  labels: string[];
  index: number;
  onIndex: (i: number) => void;
  /** One node per label. */
  pages: ReactNode[];
  /** Off from the iPad landscape up, where a mouse has no swipe. */
  swipe?: boolean;
  className?: string;
  tabsClassName?: string;
}) {
  const n = labels.length;
  const view = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; axis: 'x' | 'y' | null } | null>(null);
  // How far the finger has moved sideways, in page widths (−0.4 = 40% left).
  const [dx, setDx] = useState(0);
  // Where the track sits, in pages: 0 = first, 0.4 = on the way to the second.
  const pos = Math.min(n - 1, Math.max(0, index - dx));

  const onTouchStart = (e: TouchEvent) => {
    const el = e.target as Element;
    if (!swipe || e.touches.length !== 1 || el.closest?.(NO_SWIPE)) { start.current = null; return; }
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, axis: null };
  };
  const onTouchMove = (e: TouchEvent) => {
    const s = start.current;
    if (!s) return;
    const mx = e.touches[0].clientX - s.x;
    const my = e.touches[0].clientY - s.y;
    if (!s.axis) {
      if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
      s.axis = Math.abs(mx) > Math.abs(my) * 1.5 ? 'x' : 'y';
    }
    if (s.axis === 'x') setDx(mx / (view.current?.clientWidth || 1));
  };
  const onTouchEnd = () => {
    const s = start.current;
    start.current = null;
    if (s?.axis !== 'x') return;
    const next = Math.round(pos + (dx < 0 ? 0.25 : -0.25));
    setDx(0);
    const to = Math.min(n - 1, Math.max(0, next));
    if (to !== index) onIndex(to);
  };
  const dragging = dx !== 0;

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="shrink-0 border-b border-border">
      <div role="tablist" className={cn('relative flex', tabsClassName)}>
        {labels.map((t, i) => (
          <button key={t} type="button" role="tab" aria-selected={index === i} onClick={() => onIndex(i)}
            className={cn('h-11 min-h-0 flex-1 cursor-pointer border-0 bg-transparent font-sans text-body font-semibold outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              Math.round(pos) === i ? 'text-foreground' : 'text-muted-foreground')}>{t}</button>
        ))}
        <span aria-hidden="true" className={cn('absolute bottom-[-1px] left-0 h-0.5 rounded-full bg-foreground', !dragging && 'transition-transform duration-200')}
          style={{ width: `${100 / n}%`, transform: `translateX(${pos * 100}%)` }} />
      </div>
      </div>
      <div ref={view} className="relative min-h-0 flex-1 overflow-hidden [touch-action:pan-y]"
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
        <div className={cn('flex h-full', !dragging && 'transition-transform duration-200 ease-out')}
          style={{ width: `${n * 100}%`, transform: `translateX(${(-pos * 100) / n}%)` }}>
          {pages.map((p, i) => (
            <div key={labels[i]} role="tabpanel" aria-label={labels[i]} inert={!dragging && i !== index}
              className="h-full min-w-0 overflow-y-auto overscroll-contain" style={{ width: `${100 / n}%` }}>
              {p}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
