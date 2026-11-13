import { useKeyboardInset } from '@/hooks/useKeyboardInset';
import { cn } from './utils';

// Save and Cancel under the thumb on a phone (user, 13 Nov 2026: "move
// save/cancel on the bottom on phone everywhere"). One bar for every editor so
// they all look and behave the same: outline Cancel on the left, the primary
// action on the right, a hairline on top, safe-area padding under it.
//
// ── The keyboard ────────────────────────────────────────────────────────────
// iOS (and Android since Chrome 108) does not shrink the layout viewport when
// the on-screen keyboard opens, only the VISUAL one. A bar pinned to the bottom
// of the layout viewport then sits behind the keyboard, which is exactly when
// someone typing a name wants to tap Save. So the bar lifts by the part of the
// layout viewport the keyboard covers (`hooks/useKeyboardInset`). `appViewport.js` deliberately keeps the
// shell on `innerHeight`; only this bar follows the keyboard.

/**
 * The phone action bar. Put it LAST in a full-height flex column (it is
 * `shrink-0`), or pass `fixed` to pin it to the bottom of the window.
 * Hide it from the iPad up yourself (`className="sm:hidden"`, or don't render
 * it), because each screen decides where "wide" starts.
 *
 * @param {object} props
 * @param {boolean} [props.fixed]  pin to the window instead of sitting in the flow
 */
export function BottomActions({ fixed = false, className, style, children, ...props }) {
  const kb = useKeyboardInset();
  return (
    <div data-slot="bottom-actions" {...props}
      className={cn('flex shrink-0 items-center gap-2 border-t border-border bg-background px-4 pt-2.5', fixed && 'fixed inset-x-0 bottom-0 z-20', className)}
      style={{
        // Over the keyboard the home indicator is not in the way any more.
        paddingBottom: kb ? 10 : 'max(env(safe-area-inset-bottom, 0px), 10px)',
        ...(kb ? (fixed ? { bottom: kb } : { marginBottom: kb }) : null),
        ...style,
      }}>
      {children}
    </div>
  );
}
