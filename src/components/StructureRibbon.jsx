import { useRef, useEffect } from 'react';
import { sectionStyle, sectionLabel, compactLabel } from '../music';
import { cn } from '../lib/utils';

export function StructureRibbon({
  structure,
  compact,
  onSelect,
  sectionColors,
  sectionLabels,
  customSectionTypes,
  // Index of the section currently in view; highlights its chip and keeps it
  // scrolled into view as the song scrolls (scroll-sync).
  activeIndex = null,
  // Visual variant the user picks in Settings → Chart Defaults:
  //   'chips'    — coloured pills (default)
  //   'numbered' — plain colour-coded short codes, separated by middots
  //   'dots'     — minimal coloured dots, most compact
  style = 'chips',
  // When true, chips wrap to multiple lines instead of horizontal-scrolling.
  // Used by the setlist overview v2 song cards (avoids the odd mobile scroll).
  wrap = false,
  // When false, consecutive duplicates are NOT merged into "×N" — each entry
  // renders as its own item (used by the vertical floating side rail, where the
  // user wants the repeats spelled out rather than collapsed).
  collapse = true,
  // 'horizontal' (default) or 'vertical' — the side floating rail stacks the
  // items in a column.
  orientation = 'horizontal',
  // For the 'dots' style: also show the compact section label next to each dot
  // (the side rail wants dots + labels).
  withLabels = false,
}) {
  // Collapse consecutive duplicates: "C1, C1, C1" → one entry "C1 ×3".
  const runs = [];
  structure.forEach((name, i) => {
    const last = runs[runs.length - 1];
    if (collapse && last && last.name === name) last.count += 1;
    else runs.push({ name, count: 1, index: i });
  });

  const scrollerRef = useRef(null);
  const activeRef = useRef(null);

  // Keep the active chip centred as the song scrolls (horizontal only — avoid
  // scrollIntoView so it never nudges the page vertically).
  useEffect(() => {
    const el = activeRef.current;
    const sc = scrollerRef.current;
    if (!el || !sc) return;
    const left = el.offsetLeft - (sc.clientWidth - el.clientWidth) / 2;
    sc.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [activeIndex]);

  const isActiveRun = (run) => activeIndex != null && activeIndex >= run.index && activeIndex < run.index + run.count;
  // px-1 keeps the first/last chip (and the active chip's ring) from being
  // clipped at the scroller's edges.
  const vertical = orientation === 'vertical';
  const rowClass = cn(
    'flex gap-1 py-1 px-1 min-w-0',
    vertical
      ? 'flex-col items-center'
      : (wrap ? 'flex-wrap' : 'flex-nowrap overflow-x-auto no-scrollbar'),
  );
  const colorOf = (name) => sectionStyle(name.replace(/\s*\d+$/, ''), sectionColors, customSectionTypes);
  const labelOf = (name) => (compact ? compactLabel(name) : sectionLabel(name, sectionLabels));

  if (style === 'dots') {
    return (
      <div ref={scrollerRef} className={cn(rowClass, 'items-center gap-1.5')}>
        {runs.map((run, i) => {
          const s = colorOf(run.name);
          const active = isActiveRun(run);
          const Tag = onSelect ? 'button' : 'span';
          return (
            <Tag
              key={i}
              ref={active ? activeRef : null}
              {...(onSelect ? { type: 'button', onClick: () => onSelect(run.index), title: labelOf(run.name) } : {})}
              className={cn('shrink-0 inline-flex items-center gap-1', onSelect && 'cursor-pointer hover:opacity-80')}
            >
              {/* The dot uses the section's base colour (`s.b`) so it matches the
                  in-chart section titles, not a washed-out border tint. */}
              <span
                className={cn('rounded-full transition-all', active ? 'w-3.5 h-3.5 ring-2 ring-offset-1 ring-offset-transparent' : 'w-2.5 h-2.5')}
                style={{ background: s.b, boxShadow: active ? `0 0 0 2px ${s.b}` : undefined }}
              />
              {withLabels && (
                <span className={cn('font-mono font-bold text-[11px]', !active && 'opacity-70')} style={{ color: s.b }}>{labelOf(run.name)}</span>
              )}
              {run.count > 1 && (
                <span className="text-[10px] font-semibold" style={{ color: s.b }}>×{run.count}</span>
              )}
            </Tag>
          );
        })}
      </div>
    );
  }

  if (style === 'numbered') {
    return (
      <div ref={scrollerRef} className={cn(rowClass, 'items-baseline')}>
        {runs.map((run, i) => {
          const s = colorOf(run.name);
          const active = isActiveRun(run);
          const Tag = onSelect ? 'button' : 'span';
          return (
            <span key={i} ref={active ? activeRef : null} className="shrink-0 inline-flex items-baseline">
              {i > 0 && <span className="text-[var(--ds-gray-500)] mx-1 text-[11px]">·</span>}
              <Tag
                {...(onSelect ? { type: 'button', onClick: () => onSelect(run.index) } : {})}
                className={cn('bg-transparent border-none p-0 font-bold text-[11px] font-mono', active && 'underline underline-offset-4', onSelect && 'cursor-pointer hover:opacity-80')}
                style={{ color: s.d, opacity: active || activeIndex == null ? 1 : 0.6 }}
              >
                {compactLabel(run.name)}
                {run.count > 1 && <span className="opacity-70">×{run.count}</span>}
              </Tag>
            </span>
          );
        })}
      </div>
    );
  }

  // Default: chips.
  return (
    <div ref={scrollerRef} className={rowClass}>
      {runs.map((run, i) => {
        const s = colorOf(run.name);
        const active = isActiveRun(run);
        const Tag = onSelect ? 'button' : 'span';
        return (
          <Tag
            key={i}
            ref={active ? activeRef : null}
            {...(onSelect ? { type: 'button', onClick: () => onSelect(run.index) } : {})}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border font-medium transition-all",
              compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-[12px]",
              onSelect && "cursor-pointer hover:opacity-80",
              active && "ring-2 ring-offset-1 ring-offset-transparent"
            )}
            style={{
              borderColor: s.br,
              background: s.bg,
              color: s.d,
              opacity: active || activeIndex == null ? 1 : 0.72,
              ...(active ? { boxShadow: `0 0 0 2px ${s.br}` } : {}),
            }}
          >
            {labelOf(run.name)}
            {run.count > 1 && (
              <span className="opacity-70 font-semibold">×{run.count}</span>
            )}
          </Tag>
        );
      })}
    </div>
  );
}

export function MetaPill({ label, value, highlight }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)]">
      <span className="text-label-10 font-semibold text-[var(--ds-gray-600)]">
        {label}
      </span>
      <span
        className={cn("text-label-14-mono font-bold", highlight ? "text-[var(--chord)]" : "text-[var(--ds-gray-1000)]")}
      >
        {value}
      </span>
    </div>
  );
}
