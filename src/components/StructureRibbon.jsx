import { sectionStyle, sectionLabel, compactLabel } from '../music';
import { cn } from '../lib/utils';

export function StructureRibbon({
  structure,
  compact,
  onSelect,
  sectionColors,
  sectionLabels,
  customSectionTypes,
  // Visual variant the user picks in Settings → Chart Defaults:
  //   'chips'    — coloured pills (default)
  //   'numbered' — plain colour-coded short codes, separated by middots
  //   'dots'     — minimal coloured dots, most compact
  style = 'chips',
}) {
  // Collapse consecutive duplicates: "C1, C1, C1" → one entry "C1 ×3".
  const runs = [];
  structure.forEach((name, i) => {
    const last = runs[runs.length - 1];
    if (last && last.name === name) last.count += 1;
    else runs.push({ name, count: 1, index: i });
  });

  // Shared single-row scroller so the ribbon stays one line tall regardless of
  // the chosen style.
  const rowClass = 'flex gap-1 flex-nowrap overflow-x-auto no-scrollbar py-1 min-w-0';
  const colorOf = (name) => sectionStyle(name.replace(/\s*\d+$/, ''), sectionColors, customSectionTypes);
  const labelOf = (name) => (compact ? compactLabel(name) : sectionLabel(name, sectionLabels));

  if (style === 'dots') {
    return (
      <div className={cn(rowClass, 'items-center gap-1.5')}>
        {runs.map((run, i) => {
          const s = colorOf(run.name);
          const Tag = onSelect ? 'button' : 'span';
          return (
            <Tag
              key={i}
              {...(onSelect ? { type: 'button', onClick: () => onSelect(run.index), title: labelOf(run.name) } : {})}
              className={cn('shrink-0 inline-flex items-center gap-0.5', onSelect && 'cursor-pointer hover:opacity-80')}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.br }} />
              {run.count > 1 && (
                <span className="text-[10px] font-semibold" style={{ color: s.d }}>×{run.count}</span>
              )}
            </Tag>
          );
        })}
      </div>
    );
  }

  if (style === 'numbered') {
    return (
      <div className={cn(rowClass, 'items-baseline')}>
        {runs.map((run, i) => {
          const s = colorOf(run.name);
          const Tag = onSelect ? 'button' : 'span';
          return (
            <span key={i} className="shrink-0 inline-flex items-baseline">
              {i > 0 && <span className="text-[var(--ds-gray-500)] mx-1 text-[11px]">·</span>}
              <Tag
                {...(onSelect ? { type: 'button', onClick: () => onSelect(run.index) } : {})}
                className={cn('bg-transparent border-none p-0 font-bold text-[11px] font-mono', onSelect && 'cursor-pointer hover:opacity-80')}
                style={{ color: s.d }}
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
    <div className={rowClass}>
      {runs.map((run, i) => {
        const s = colorOf(run.name);
        const Tag = onSelect ? 'button' : 'span';
        return (
          <Tag
            key={i}
            {...(onSelect ? { type: 'button', onClick: () => onSelect(run.index) } : {})}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border font-medium transition-colors",
              compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-[12px]",
              onSelect && "cursor-pointer hover:opacity-80"
            )}
            style={{
              borderColor: s.br,
              background: s.bg,
              color: s.d,
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
