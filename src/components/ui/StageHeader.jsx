import { headerFrostStyle } from '../../lib/headerFrost';

// Shared three-row stage header for Chart / Practice / Live.
//
//   Row 1: title (left) + close/exit (right)
//   Row 2: meta (key / tempo / time) on the left, actions on the right
//   Row 3: structure ribbon (always visible)
//   extras: optional rows beneath the ribbon (e.g. Chart's arrangement /
//           details / notes peek), shown only when expanded.
//
// When `collapsed`, rows 1+2 animate away (and extras hide), leaving just the
// ribbon — the immersive reading state. Each view supplies its own controls as
// nodes; this component owns the layout and the collapse animation only.
export default function StageHeader({ collapsed = false, title, close, meta, actions, info, ribbon, extras }) {
  return (
    <div
      className="material-header"
      style={{
        zIndex: 50,
        color: 'var(--chart-text, var(--text-1))',
        fontFamily: 'var(--font-sans)',
        // Re-map the foreground tokens the header's controls read so they track
        // the chart theme too (the header bg already does, via useChartTheme).
        // Popover menus portal to <body>, so they keep the app-theme tokens.
        '--text-1': 'var(--chart-text, var(--ds-gray-1000))',
        '--text-2': 'var(--chart-subtle, var(--ds-gray-900))',
        '--ds-gray-1000': 'var(--chart-text, var(--ds-gray-1000))',
        '--ds-gray-700': 'var(--chart-subtle, var(--ds-gray-700))',
        ...headerFrostStyle,
      }}
    >
      <div
        className="overflow-hidden transition-[max-height,opacity] duration-200 ease-out"
        style={{ maxHeight: collapsed ? 0 : '12rem', opacity: collapsed ? 0 : 1 }}
        aria-hidden={collapsed}
      >
        {(title || close) && (
          <div className="wide-container flex items-center gap-2 pt-2.5 pb-1">
            <div className="min-w-0 flex-1 flex items-center gap-2">{title}</div>
            {close && <div className="shrink-0 flex items-center">{close}</div>}
          </div>
        )}
        {(meta || actions) && (
          <div className="wide-container flex items-center gap-2 pb-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">{meta}</div>
            <div className="flex items-center gap-0.5 shrink-0">{actions}</div>
          </div>
        )}
      </div>

      {/* Optional disclosure (e.g. Chart's song-details) — rendered directly
          beneath the title/meta block and above the ribbon, outside the
          collapse-clip so its own scroll container works. */}
      {!collapsed && info}

      {ribbon && (
        <div className={`wide-container ${collapsed ? 'py-1.5' : 'pb-2'}`}>
          {ribbon}
        </div>
      )}

      {!collapsed && extras}
    </div>
  );
}
