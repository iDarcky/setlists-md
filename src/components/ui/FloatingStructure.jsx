// A floating, transparent, space-minimal overlay for the structure (section
// flow) ribbon when the user moves it out of the header (Labs → structure
// position). It is `position: fixed` and reserves no layout space; only the
// ribbon itself is interactive. Translucent + backdrop-blur so it sits lightly
// over the chart like the nav pill.
//   - bottom: a centred strip floating above the nav pill.
//   - left/right: a slim vertical strip, edge-centred.
const surface = {
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
          style={surface}
        >
          {children}
        </div>
      </div>
    );
  }

  // left / right — vertical strip centred on the edge.
  const side = position === 'left' ? { left: '0.5rem' } : { right: '0.5rem' };
  return (
    <div
      className="fixed z-[95] -translate-y-1/2 pointer-events-none"
      style={{ top: '50%', ...side }}
    >
      <div
        className="pointer-events-auto max-h-[70vh] overflow-y-auto no-scrollbar rounded-2xl border shadow-lg px-1 py-2"
        style={surface}
      >
        {children}
      </div>
    </div>
  );
}
