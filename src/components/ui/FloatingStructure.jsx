// A floating, space-minimal overlay for the structure (section flow) ribbon when
// the user moves it out of the header (Labs → structure position). It is
// `position: fixed` and reserves no layout space; only the ribbon is interactive.
// Fully transparent — no fill/border/blur. Legibility over busy lyrics comes from
// a thin halo in the chart background colour around each chip/dot (a crisp outline
// that reads on any theme), not from a panel.
const halo = {
  color: 'var(--chart-text, var(--ds-gray-1000))',
  filter:
    'drop-shadow(0 0 1px var(--chart-bg, #000)) drop-shadow(0 0 2px var(--chart-bg, #000)) drop-shadow(0 0 2px var(--chart-bg, #000))',
};

// `raised` lifts the bottom strip above the floating nav pill; without a pill
// it drops down to the bottom edge so it doesn't float in empty space.
export default function FloatingStructure({ position, children, raised = false }) {
  if (position === 'bottom') {
    return (
      <div
        className="fixed left-0 right-0 z-[95] flex justify-center pointer-events-none"
        style={{ bottom: `calc(${raised ? '6.25rem' : '1.5rem'} + env(safe-area-inset-bottom, 0px))` }}
      >
        <div className="pointer-events-auto max-w-[92vw] overflow-x-auto no-scrollbar px-2 py-1" style={halo}>
          {children}
        </div>
      </div>
    );
  }

  // left / right — transparent vertical strip, edge-centred. A fixed width keeps
  // the bar from shifting horizontally as the active item (which grows) changes
  // while scrolling the song.
  const side = position === 'left' ? { left: '0.25rem' } : { right: '0.25rem' };
  return (
    <div
      className="fixed z-[95] -translate-y-1/2 pointer-events-none"
      style={{ top: '50%', ...side, ...halo }}
    >
      <div className="pointer-events-auto w-16 max-h-[80vh] overflow-y-auto overflow-x-hidden no-scrollbar">
        {children}
      </div>
    </div>
  );
}
