import { sectionTone } from '@/lib/sectionTone';
import type { StructureBox } from './plays';

export type RibbonStyle = 'codes' | 'chips' | 'dots';
export type RibbonPosition = 'top' | 'bottom' | 'left' | 'right' | 'off';

interface Props {
  boxes: StructureBox[];
  activeSlot: number;
  style: RibbonStyle;
  position: RibbonPosition;
  live: boolean;
  onJump: (slot: number) => void;
}

const tone = (type: string) => sectionTone(type) as { code: string; fg: string; bg: string };

/** The red LIVE label that opens the pinned row (owner, 2026-11-17). */
function LiveLabel({ compact }: { compact: boolean }) {
  if (compact) {
    return <span role="status" aria-label="Live" className="my-1 size-2 rounded-full bg-[#E5484D] shadow-[0_0_0_3px_rgba(229,72,77,.25)]" />;
  }
  return (
    <span role="status" className="mr-1.5 inline-flex h-6 shrink-0 items-center gap-[5px] rounded-[7px] bg-[#B4413A] px-2 text-[11px] font-semibold tracking-[0.04em] text-white">
      <span className="size-1.5 rounded-full bg-white" />LIVE
    </span>
  );
}

/**
 * The song's structure: Boxes (default), Chips or Dots, along the top or the
 * bottom, or down a side. It is the one part of the top that stays pinned.
 */
export function StructureRow({ boxes, activeSlot, style, position, live, onJump }: Props) {
  const side = position === 'left' || position === 'right';
  const activeIdx = boxes.findIndex(b => b.slots.includes(activeSlot));

  const items = boxes.map((b, i) => {
    const t = tone(b.type);
    const on = i === activeIdx;
    const past = i < activeIdx;
    const label = `${b.type}${b.count > 1 ? `, ${b.count} times` : ''}`;
    const common = { type: 'button' as const, onClick: () => onJump(b.slot), 'aria-label': label, 'aria-current': on ? ('true' as const) : undefined };
    if (style === 'dots') {
      const size = on ? 11 : 7;
      return (
        <button key={b.slot} {...common} className={`flex min-h-0 shrink-0 items-center justify-center ${side ? 'h-[22px] w-7' : 'h-7 w-[22px]'}`} style={{ opacity: past ? 0.45 : 1 }}>
          <span className="rounded-full" style={{ width: size, height: size, background: t.fg, boxShadow: on ? `0 0 0 2px var(--background), 0 0 0 3.5px ${t.fg}` : undefined }} />
        </button>
      );
    }
    // Down a side there is no room for the space: "T×2".
    const text = `${t.code}${b.count > 1 ? `${side ? '' : ' '}×${b.count}` : ''}`;
    if (style === 'chips') {
      return (
        <button key={b.slot} {...common} className="h-7 min-h-0 shrink-0 rounded-full px-[11px] text-caption font-semibold" style={{ opacity: past ? 0.45 : 1, background: on ? t.fg : 'var(--raised)', color: on ? 'var(--background)' : t.fg }}>
          {text}
        </button>
      );
    }
    return (
      <button key={b.slot} {...common} className="h-6 min-h-0 shrink-0 whitespace-nowrap rounded-[7px] border px-[5px] font-mono text-[11px] tracking-[0.06em]" style={{ opacity: past ? 0.45 : 1, background: on ? t.fg : 'transparent', borderColor: on ? t.fg : 'var(--border)', color: on ? 'var(--background)' : t.fg, fontWeight: on ? 600 : 500 }}>
        {text}
      </button>
    );
  });

  if (side) {
    // A floating, frosted pill for Dots and Boxes alike (owner, 2026-11-18):
    // no column, the chart keeps its width and shows through.
    return (
      <nav
        aria-label="Song structure"
        className={`absolute top-1/2 z-chrome flex max-h-[calc(100%-16px)] -translate-y-1/2 flex-col items-center overflow-y-auto border border-border/70 bg-raised/60 shadow-[0_8px_24px_rgba(0,0,0,.25)] backdrop-blur-md backdrop-saturate-150 [scrollbar-width:none] ${style === 'dots' ? 'gap-1 rounded-full px-0.5 py-2' : 'gap-1.5 rounded-[14px] p-1.5'} ${position === 'left' ? 'left-1.5' : 'right-1.5'}`}
      >
        {live && (
          <>
            <LiveLabel compact />
            <span aria-hidden className="mb-1 h-px w-3 bg-border" />
          </>
        )}
        {items}
      </nav>
    );
  }
  return (
    <nav aria-label="Song structure" className={`flex h-10 items-center bg-background px-3 ${position === 'bottom' ? 'border-t' : 'border-b'} border-border`}>
      {live && <LiveLabel compact={false} />}
      <div className={`flex min-w-0 flex-1 items-center overflow-x-auto [scrollbar-width:none] ${style === 'dots' ? 'gap-0.5' : 'gap-1.5'} justify-center-safe`}>
        {items}
      </div>
    </nav>
  );
}
