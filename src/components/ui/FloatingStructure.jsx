// A floating, space-minimal overlay for the structure (section flow) ribbon when
// the user moves it out of the header (Labs → structure position). It is
// `position: fixed` and reserves no layout space; only the ribbon is interactive.
//   - bottom: a centred strip floating above the nav pill (translucent surface).
//   - left/right: a slim, transparent vertical strip edge-centred — no background,
//     no border; just the chips/dots floating over the chart.
const bottomSurface = {
  background: 'var(--chart-header-bg, var(--header-bg-blur))',
  borderColor: 'var(--chart-header-border, var(--ds-gray-400))',
  color: 'var(--chart-text, var(--ds-gray-1000))',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
};

export default function FloatingStructure({ position, children }) {
  if (position === 'bottom') {
    return (
      <div
        className="fixed left-0 right-0 z-[95] flex justify-center pointer-events-none"
        style={{ bottom: 'calc(6.25rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div
          className="pointer-events-auto max-w-[92vw] overflow-x-auto no-scrollbar rounded-full border shadow-lg px-2 py-1"
          style={bottomSurface}
        >
          {children}
        </div>
      </div>
    );
  }

  // left / right — transparent vertical strip, edge-centred. No surface so it
  // floats lightly over the chart; colour comes from the chips themselves.
  const side = position === 'left' ? { left: '0.25rem' } : { right: '0.25rem' };
  return (
    <div
      className="fixed z-[95] -translate-y-1/2 pointer-events-none"
      style={{ top: '50%', ...side, color: 'var(--chart-text, var(--ds-gray-1000))' }}
    >
      <div className="pointer-events-auto max-h-[80vh] overflow-y-auto no-scrollbar">
        {children}
      </div>
    </div>
  );
}
