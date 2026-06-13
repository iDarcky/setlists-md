import { headerFrostStyle } from '../../lib/headerFrost';

// Shared three-row stage header for Chart / Practice / Live.
//
//   Row 1: title
//   Row 2: meta (key / tempo / time) on the left, actions on the right
//   Row 3: structure ribbon (always visible)
//   extras: optional rows beneath the ribbon (e.g. Chart's arrangement /
//           details / notes peek), shown only when expanded.
//
// When `collapsed`, rows 1, 2 and the extras hide, leaving just the ribbon —
// the immersive reading state. Each view supplies its own controls as nodes;
// this component owns the layout and the collapse behaviour only.
export default function StageHeader({ collapsed = false, title, meta, actions, ribbon, extras }) {
  return (
    <div className="material-header" style={{ zIndex: 50, color: 'var(--text-1)', fontFamily: 'var(--font-sans)', ...headerFrostStyle }}>
      {!collapsed && (
        <>
          {title && (
            <div className="wide-container flex items-center gap-2 pt-2.5 pb-1">
              {title}
            </div>
          )}
          {(meta || actions) && (
            <div className="wide-container flex items-center gap-2 pb-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">{meta}</div>
              <div className="flex items-center gap-0.5 shrink-0">{actions}</div>
            </div>
          )}
        </>
      )}

      {ribbon && (
        <div className={`wide-container ${collapsed ? 'py-1.5' : 'pb-2'}`}>
          {ribbon}
        </div>
      )}

      {!collapsed && extras}
    </div>
  );
}
