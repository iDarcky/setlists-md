import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/ui/shadcn/utils';
import { CloseIcon } from '@/app/navIcons';
import { formatClockTime } from '@/lib/dateFormat';
import { totalLabel, nowInOrder, minutesLabel } from '@/lib/setlistView';
import { useNow } from '@/hooks/useNow';

// The run sheet: the whole order, large, for the sound desk and the slides
// laptop. Clock time per row, no chords, moment notes in full. Always dark, so
// it never glares in a dim room. During the service it follows the clock: the
// row the plan says is on now is marked, with a bar for how far through it is,
// and the sheet scrolls to keep it in view.

export default function RunSheet({ open, onClose, title, order, setlist, clockFormat = '24h', now: fixedNow }) {
  const ticking = useNow(15000, open && fixedNow == null);
  const now = fixedNow ?? ticking;
  const live = nowInOrder(setlist, order, now);
  const listRef = useRef(null);
  const liveIdx = live.state === 'during' ? live.idx : null;
  useEffect(() => {
    if (!open || liveIdx == null) return;
    listRef.current?.querySelector(`[data-row="${liveIdx}"]`)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [open, liveIdx]);
  const current = liveIdx != null ? order.rows.find(r => r.idx === liveIdx) : null;
  const status = live.state === 'during' ? `Now: ${current?.title} · ${minutesLabel(live.left)} left`
    : live.state === 'before' && live.startsIn < 12 * 3600 ? `Starts in ${minutesLabel(live.startsIn)}`
    : live.state === 'after' ? 'Finished' : '';
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Run sheet · ${title}`} data-theme="dark"
      className="fixed inset-0 z-[60] overflow-y-auto bg-[#11100E] font-sans text-[#F3EFE8]">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#2E2A26] bg-[#11100E] px-5 py-3" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
        <span className="flex min-w-0 flex-col">
          <b className="truncate text-[20px] font-semibold">{title}</b>
          <span className="text-[14px] text-[#A39C92]">{order.songCount} songs · {totalLabel(order.totalSeconds, order.estimated)}{status && <> · <b className="font-semibold text-[#7AA89C]">{status}</b></>}</span>
        </span>
        <button type="button" onClick={onClose} aria-label="Close run sheet"
          className="flex size-11 min-h-0 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-[#23201D] text-[#F3EFE8] outline-none focus-visible:ring-2 focus-visible:ring-[#7AA89C]">
          <CloseIcon />
        </button>
      </div>
      <ol ref={listRef} className="m-0 mx-auto flex max-w-[900px] list-none flex-col p-0 px-5 pb-16">
        {order.rows.map(r => {
          const on = r.idx === liveIdx;
          const done = liveIdx != null ? r.idx < liveIdx : live.state === 'after';
          return (
          <li key={r.idx} data-row={r.idx} className={cn('relative flex gap-4 border-b border-[#2E2A26] py-4 sm:gap-6', on && '-mx-5 bg-[#1B2522] px-5', done && 'opacity-45')}>
            {on && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[#7AA89C]" />}
            {on && <span aria-hidden="true" className="absolute bottom-0 left-0 h-[3px] bg-[#7AA89C]" style={{ width: `${Math.round(live.progress * 100)}%` }} />}
            <span className="flex w-16 shrink-0 flex-col pt-1 text-[16px] tabular-nums text-[#A39C92] sm:w-20 sm:text-[18px]">
              {r.startsAt ? formatClockTime(r.startsAt, clockFormat) : ''}
              {on && <b className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#7AA89C]">Now</b>}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className={cn('text-[24px] font-semibold leading-8 sm:text-[30px] sm:leading-10', r.kind === 'moment' && 'text-[#A39C92]')}>
                {r.kind === 'song' && <span className="mr-2 text-[#A39C92]">{r.n}.</span>}{r.title}
              </span>
              {r.kind === 'song' && (
                <span className="flex flex-wrap gap-x-4 text-[17px] text-[#A39C92]">
                  {r.key && <span>Key <b className="font-mono font-semibold text-[#D9A441]">{r.key}</b></span>}
                  {r.tempo && <span>{r.tempo} BPM</span>}
                  {r.leads && <span>{r.leads} leads</span>}
                </span>
              )}
              {r.kind === 'moment' && r.minutes > 0 && <span className="text-[17px] text-[#A39C92]">{r.minutes} min</span>}
              {r.note && <span className="whitespace-pre-wrap text-[18px] leading-7">{r.note.replace(/\*\*/g, '').replace(/^#+\s*/gm, '')}</span>}
            </span>
          </li>
          );
        })}
      </ol>
    </div>,
    document.body,
  );
}
