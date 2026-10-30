import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/ui/shadcn/utils';
import { CloseIcon } from '@/app/navIcons';
import { formatClockTime } from '@/lib/dateFormat';
import { totalLabel } from '@/lib/setlistView';

// The run sheet: the whole order, large, for the sound desk and the slides
// laptop. Clock time per row, no chords, moment notes in full. Always dark, so
// it never glares in a dim room.

export default function RunSheet({ open, onClose, title, order, clockFormat = '24h' }) {
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
          <span className="text-[14px] text-[#A39C92]">{order.songCount} songs · {totalLabel(order.totalSeconds, order.estimated)}</span>
        </span>
        <button type="button" onClick={onClose} aria-label="Close run sheet"
          className="flex size-11 min-h-0 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-[#23201D] text-[#F3EFE8] outline-none focus-visible:ring-2 focus-visible:ring-[#7AA89C]">
          <CloseIcon />
        </button>
      </div>
      <ol className="m-0 mx-auto flex max-w-[900px] list-none flex-col p-0 px-5 pb-16">
        {order.rows.map(r => (
          <li key={r.idx} className="flex gap-4 border-b border-[#2E2A26] py-4 sm:gap-6">
            <span className="w-16 shrink-0 pt-1 text-[16px] tabular-nums text-[#A39C92] sm:w-20 sm:text-[18px]">{r.startsAt ? formatClockTime(r.startsAt, clockFormat) : ''}</span>
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
        ))}
      </ol>
    </div>,
    document.body,
  );
}
