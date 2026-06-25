// Docks the structure (section flow) ribbon to an edge of a reading view when
// the user moves it out of the header (Settings → Structure position).
// 'top' is owned by StageHeader, so this only renders bottom/left/right.
//   - bottom: a sticky horizontal band at the foot of the scroll area.
//   - left/right: a slim vertical rail; the ribbon wraps into a column.
// Colours follow the chart theme so the dock matches the header/pill.
export default function StructureDock({ position, children, className = '' }) {
  if (position === 'bottom') {
    return (
      <div
        className={`sticky bottom-0 z-40 px-2 py-1.5 border-t ${className}`}
        style={{
          background: 'var(--chart-header-bg, var(--chart-bg, var(--ds-background-100)))',
          borderColor: 'var(--chart-header-border, var(--ds-gray-300))',
        }}
      >
        {children}
      </div>
    );
  }
  if (position === 'left' || position === 'right') {
    return (
      <aside
        className={`shrink-0 h-full overflow-y-auto no-scrollbar w-12 flex flex-col items-center py-2 ${position === 'left' ? 'border-r' : 'border-l'} ${className}`}
        style={{
          background: 'var(--chart-header-bg, var(--chart-bg, var(--ds-background-100)))',
          borderColor: 'var(--chart-header-border, var(--ds-gray-300))',
        }}
      >
        {children}
      </aside>
    );
  }
  return null;
}
