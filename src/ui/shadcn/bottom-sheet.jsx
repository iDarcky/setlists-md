import { Sheet as Scroll } from 'scrollsheet';
import { cn } from './utils';

// The phone's bottom sheet, on scrollsheet (MIT, scrollsheet.dev). The swipe is
// the browser's own scroll snapping, so it keeps native momentum and stays
// smooth while the app is busy; the panel is a native <dialog> (focus trap and
// inert background for free) and it lifts above the on-screen keyboard.
// Silk works the same way and felt best, but it is paid for commercial use
// (owner, 2026-11-15: "Silk is not free").
//
// Material: `modal` (ds.css): the float fill, edge and modal shadow.
// Colours come from our tokens through scrollsheet's CSS variables, so the
// sheet follows the app's light/dark theme, not the OS.
const THEME = {
  '--scrollsheet-bg': 'var(--float)',
  '--scrollsheet-fg': 'var(--card-foreground)',
  '--scrollsheet-panel-bg': 'var(--float)',
  '--scrollsheet-backdrop': 'var(--scrim, rgb(0 0 0 / 0.5))',
  '--scrollsheet-handle': 'var(--input)',
  '--scrollsheet-handle-hover': 'var(--muted-foreground)',
  '--scrollsheet-radius': '20px',
  '--scrollsheet-shadow': 'var(--float-highlight), var(--shadow-modal)',
  '--scrollsheet-focus-ring': 'var(--ring)',
};

/**
 * @param {boolean} open
 * @param {(open: boolean) => void} onOpenChange
 * @param {boolean} [dismissible=true]  false = no ✕, no swipe-down, no tap-outside
 * @param {string} [className]  sizes the sheet (e.g. `h-auto`, a fixed height)
 */
export function BottomSheet({ open, onOpenChange, title, description, children, className, dismissible = true }) {
  return (
    <Scroll.Root open={!!open} onOpenChange={(o) => onOpenChange?.(o)} dismissible={dismissible} keyboardExpands themeColorDimming>
      <Scroll.Content data-slot="bottom-sheet" style={THEME}
        className="border-t border-float-border font-sans outline-none">
        <div className={cn('flex max-h-[calc(100dvh-64px)] flex-col', className)}>
          {dismissible ? <Scroll.Handle className="mx-auto mb-0 mt-2 block h-1 min-h-0 w-9 shrink-0 cursor-grab rounded-full bg-input p-0" /> : <div aria-hidden="true" className="h-2 shrink-0" />}
          {/* No ✕ on a phone sheet (owner, 15 Nov): the handle, a swipe down
              and a tap outside close it. iPad/desktop dialogs keep theirs. */}
          <div className={cn('flex shrink-0 items-center gap-2 px-6 py-2', !dismissible && 'pb-1 pt-5')}>
            <Scroll.Title className="m-0 min-h-11 content-center text-heading">{title}</Scroll.Title>
          </div>
          {description && <Scroll.Description className="sr-only">{description}</Scroll.Description>}
          <div data-scrollsheet-nested-scroll className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2">{children}</div>
        </div>
      </Scroll.Content>
    </Scroll.Root>
  );
}
