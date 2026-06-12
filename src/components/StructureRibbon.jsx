import { sectionStyle, sectionLabel, compactLabel } from '../music';
import { cn } from '../lib/utils';

export function StructureRibbon({
  structure,
  compact,
  onSelect,
  sectionColors,
  sectionLabels,
  customSectionTypes,
}) {
  // Collapse consecutive duplicates: "C1, C1, C1" → one chip "C1 ×3".
  const runs = [];
  structure.forEach((name, i) => {
    const last = runs[runs.length - 1];
    if (last && last.name === name) last.count += 1;
    else runs.push({ name, count: 1, index: i });
  });

  return (
    <div className="flex gap-1 flex-wrap py-1">
      {runs.map((run, i) => {
        const s = sectionStyle(run.name.replace(/\s*\d+$/, ''), sectionColors, customSectionTypes);
        const displayName = compact
          ? compactLabel(run.name)
          : sectionLabel(run.name, sectionLabels);
        const Tag = onSelect ? 'button' : 'span';
        return (
          <Tag
            key={i}
            {...(onSelect ? { type: 'button', onClick: () => onSelect(run.index) } : {})}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border font-medium transition-colors",
              compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-[12px]",
              onSelect && "cursor-pointer hover:opacity-80"
            )}
            style={{
              borderColor: s.br,
              background: s.bg,
              color: s.d,
            }}
          >
            {displayName}
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
