import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/ui/shadcn/utils';
import { CloseIcon } from '@/app/navIcons';
import { formatClockTime } from '@/lib/dateFormat';
import { compactLabel, sectionStyle } from '@/music';
import { totalLabel, nowInOrder, minutesLabel } from '@/lib/setlistView';
import { useNow } from '@/hooks/useNow';

// The service order (RunSheet in code; renamed 11 Nov): the whole order, large, for the sound desk and the slides
// laptop. Clock time per row, no chords, each song's structure as chips.
// Moments show only their name and length: what is said in the prayer or the
// sermon stays off the big screen (QA 2026-11-11). Always dark, so
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
    <div role="dialog" aria-modal="true" aria-label={`Service order · ${title}`} data-theme="dark"
      className="fixed inset-0 z-[60] overflow-y-auto bg-[#0E0D0B] font-sans text-[#F3EFE8]">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#2E2A26] bg-[#0E0D0B] px-4 py-3 sm:px-5" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
        <span className="flex min-w-0 flex-col">
          <b className="truncate text-[17px] font-semibold sm:text-[20px]">{title}</b>
          <span className="text-[13px] text-[#A39C92] sm:text-[14px]">{order.songCount} songs · {totalLabel(order.totalSeconds, order.estimated)}{status && <> · <b className="font-semibold text-[#7AA89C]">{status}</b></>}</span>
        </span>
        <button type="button" onClick={onClose} aria-label="Close service order"
          className="flex size-10 min-h-0 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-[#23201D] sm:size-11 text-[#F3EFE8] outline-none focus-visible:ring-2 focus-visible:ring-[#7AA89C]">
          <CloseIcon />
        </button>
      </div>
      <ol ref={listRef} className="m-0 mx-auto flex max-w-[900px] list-none flex-col p-0 px-4 pb-16 sm:px-5">
        {order.rows.map(r => {
          const on = r.idx === liveIdx;
          const done = liveIdx != null ? r.idx < liveIdx : live.state === 'after';
          return (
          <li key={r.idx} data-row={r.idx} className={cn('relative flex gap-3 border-b border-[#2E2A26] py-3 sm:gap-6 sm:py-4', on && '-mx-4 bg-[#1B2522] px-4 sm:-mx-5 sm:px-5', done && 'opacity-45')}>
            {on && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[#7AA89C]" />}
            {on && <span aria-hidden="true" className="absolute bottom-0 left-0 h-[3px] bg-[#7AA89C]" style={{ width: `${Math.round(live.progress * 100)}%` }} />}
            <span className="flex w-11 shrink-0 flex-col pt-0.5 text-[14px] tabular-nums text-[#A39C92] sm:w-20 sm:pt-1 sm:text-[18px]">
              {r.startsAt ? formatClockTime(r.startsAt, clockFormat) : ''}
              {on && <b className="text-[11px] font-semibold uppercase sm:text-[13px] tracking-[0.06em] text-[#7AA89C]">Now</b>}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className={cn('text-[19px] font-semibold leading-6 sm:text-[30px] sm:leading-10', r.kind === 'moment' && 'text-[#A39C92]')}>
                {r.kind === 'song' && <span className="mr-2 text-[#A39C92]">{r.n}.</span>}{r.title}
              </span>
              {r.kind === 'song' && (
                <span className="flex flex-wrap gap-x-3 text-[14px] text-[#A39C92] sm:gap-x-4 sm:text-[17px]">
                  {r.key && <span>Key <b className="font-mono font-semibold text-[#D9A441]">{r.key}</b></span>}
                  {r.tempo && <span>{r.tempo} BPM</span>}
                  {r.leads && <span>{r.leads} leads</span>}
                </span>
              )}
              {r.kind === 'song' && r.structure?.length > 0 && (
                <span aria-label={`Structure: ${r.structure.join(', ')}`} className="flex flex-wrap gap-1 pt-1 sm:gap-1.5">
                  {r.structure.map((name, i) => {
                    const st = sectionStyle(name);
                    return (
                      <span key={i} aria-hidden="true" className="rounded-[5px] px-1.5 py-px font-mono text-[12px] font-semibold sm:rounded-[6px] sm:px-2 sm:py-0.5 sm:text-[14px]"
                        style={{ color: st.b, background: st.bg }}>
                        {compactLabel(name)}
                      </span>
                    );
                  })}
                </span>
              )}
              {r.kind === 'moment' && r.minutes > 0 && <span className="text-[14px] text-[#A39C92] sm:text-[17px]">{r.minutes} min</span>}
              {r.kind === 'song' && r.note && <span className="whitespace-pre-wrap text-[15px] leading-6 sm:text-[18px] sm:leading-7">{r.note.replace(/\*\*/g, '').replace(/^#+\s*/gm, '')}</span>}
            </span>
          </li>
          );
        })}
      </ol>
    </div>,
    document.body,
  );
}
