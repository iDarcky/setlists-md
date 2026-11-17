import { Sheet as Scroll } from 'scrollsheet';
import { cn } from './utils';
import { CloseIcon } from './dialog';

// The phone's bottom sheet, on scrollsheet (MIT, scrollsheet.dev). The swipe is
// the browser's own scroll snapping, so it keeps native momentum and stays
// smooth while the app is busy; the panel is a native <dialog> (focus trap and
// inert background for free) and it lifts above the on-screen keyboard.
// Silk works the same way and felt best, but it is paid for commercial use
// (owner, 2026-11-15: "Silk is not free").
//
// Colours come from our tokens through scrollsheet's CSS variables, so the
// sheet follows the app's light/dark theme, not the OS.
const THEME = {
  '--scrollsheet-bg': 'var(--card)',
  '--scrollsheet-fg': 'var(--card-foreground)',
  '--scrollsheet-panel-bg': 'var(--card)',
  '--scrollsheet-backdrop': 'var(--scrim, rgb(0 0 0 / 0.5))',
  '--scrollsheet-handle': 'var(--input)',
  '--scrollsheet-handle-hover': 'var(--muted-foreground)',
  '--scrollsheet-radius': '20px',
  '--scrollsheet-shadow': 'none',
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
        className="border-t border-border font-sans outline-none">
        {/* Never taller than what you can see. On Android the keyboard shrinks
            only the visual viewport (dvh stays put), so a sheet sized in dvh
            outgrew the space above the keyboard: the panel turned into a
            second scroller, fought the swipe track, jumped up and down and
            finally dismissed itself (owner's recording, 2026-11-17).
            scrollsheet publishes the visible height as --scrollsheet-vv-height. */}
        <div className="flex max-h-[min(calc(100dvh-64px),calc(var(--scrollsheet-vv-height,100dvh)-8px))] flex-col">
        <div className={cn('flex min-h-0 shrink flex-col', className)}>
          {dismissible ? <Scroll.Handle className="mx-auto mb-0 mt-2 block h-1 min-h-0 w-9 shrink-0 cursor-grab rounded-full bg-input p-0" /> : <div aria-hidden="true" className="h-2 shrink-0" />}
          <div className={cn('flex shrink-0 items-center justify-between gap-2 py-2 pl-6 pr-3', !dismissible && 'pb-1 pr-6 pt-5')}>
            <Scroll.Title className="m-0 text-[18px] font-semibold leading-6 tracking-[-0.2px]">{title}</Scroll.Title>
            {dismissible && (
              <Scroll.Close asChild>
                <button type="button" aria-label="Close"
                  className="flex size-11 cursor-pointer items-center justify-center rounded-control border-0 bg-transparent text-foreground outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring">
                  <CloseIcon />
                </button>
              </Scroll.Close>
            )}
          </div>
          {description && <Scroll.Description className="sr-only">{description}</Scroll.Description>}
          <div data-scrollsheet-nested-scroll className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2">{children}</div>
        </div>
        </div>
      </Scroll.Content>
    </Scroll.Root>
  );
}
