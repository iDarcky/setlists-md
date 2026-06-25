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
export default function StageHeader({ collapsed = false, title, close, meta, actions, info, ribbon, extras, onExpand }) {
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

      {/* Render this row when there's a ribbon OR when collapsed and we need the
          "show header" affordance — so a header with the structure ribbon moved
          out (floating positions) can still be brought back. */}
      {(ribbon || (collapsed && onExpand)) && (
        <div className={`wide-container flex items-center gap-2 ${collapsed ? 'py-1.5' : 'pb-2'}`}>
          <div className="min-w-0 flex-1">{ribbon}</div>
          {/* When collapsed, the title-row collapse toggle is hidden — keep an
              explicit "show header" affordance here so the header can always be
              brought back without hunting for a tap target. */}
          {collapsed && onExpand && (
            <button
              type="button"
              onClick={onExpand}
              aria-label="Show header"
              title="Show header"
              className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg cursor-pointer border-none bg-transparent text-[var(--text-2)] hover:bg-[var(--ds-gray-200)] hover:text-[var(--text-1)] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      )}

      {!collapsed && extras}
    </div>
  );
}
