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
  return (
    <div className="flex gap-1 flex-wrap py-1">
      {structure.map((name, i) => {
        const s = sectionStyle(name.replace(/\s*\d+$/, ''), sectionColors, customSectionTypes);
        const displayName = compact
          ? compactLabel(name)
          : sectionLabel(name, sectionLabels);
        const Tag = onSelect ? 'button' : 'span';
        return (
          <Tag
            key={i}
            {...(onSelect ? { type: 'button', onClick: () => onSelect(i) } : {})}
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
            <span
              className={cn("rounded-full flex-shrink-0", compact ? "w-1.5 h-1.5" : "w-2 h-2")}
              style={{ background: s.b }}
            />
            {displayName}
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
