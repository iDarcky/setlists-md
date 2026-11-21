import { useEffect, useId, useRef } from 'react';
import { Sheet } from 'react-modal-sheet';
import { cn } from './utils';

// The phone's bottom sheet, on react-modal-sheet (MIT, built on Motion, which
// the app already ships). History, so nobody walks the same road twice:
// - Vaul: unmaintained.
// - Silk: the best feel, but paid for commercial use (owner, 2026-11-15).
// - scrollsheet (CSS scroll snap, PR #200): the sheet trembled and dismissed
//   itself on Android with the keyboard up, and lists inside it (the artist
//   suggestions) would not scroll (owner, 2026-11-17).
//
// Rules here:
// - Only the handle + title drag the sheet. The body never does, so anything
//   that scrolls inside it (the form, a suggestion list) just scrolls.
// - No ✕ (owner, 2026-11-17): swipe the handle down, tap outside, or Esc.
// - The library pads for the on-screen keyboard and stops dragging while it
//   is up.
/**
 * @param {boolean} open
 * @param {(open: boolean) => void} onOpenChange
 * @param {boolean} [dismissible=true]  false = no swipe-down, no tap-outside, no Esc
 * @param {string} [className]  sizes the sheet (e.g. `h-auto`, a fixed height)
 * @param {React.ReactNode} [footer]  buttons pinned under the content (Cancel / Next)
 */
export function BottomSheet({ open, onOpenChange, title, description, children, className, footer, dismissible = true }) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef(null);
  // Callers pass a fresh onOpenChange every render; read it through a ref so
  // the focus effect below runs once per opening (re-running it bounced focus
  // back to the button that opened the sheet).
  const latest = useRef({ onOpenChange, dismissible });
  useEffect(() => { latest.current = { onOpenChange, dismissible }; });
  const close = () => { if (dismissible) onOpenChange?.(false); };

  // Esc closes. Focus stays inside while it is open: the menu that opened
  // the sheet hands focus back to its button as it closes, which pulled it
  // off the autofocused field. On close, focus goes back where it was.
  useEffect(() => {
    if (!open) return undefined;
    // autoFocus inside the sheet may already have run by now.
    const active = document.activeElement;
    const startedInside = !!panelRef.current?.contains(active);
    const previous = startedInside ? null : active;
    let lastInside = startedInside ? active : null;
    const onFocusIn = (e) => {
        const panel = panelRef.current;
      if (!panel) return;
      if (panel.contains(e.target)) { lastInside = e.target; return; }
      // Something outside took focus (not another sheet or popover on top).
      if (e.target.closest?.('[data-slot=bottom-sheet], [role=dialog], [role=menu], [role=listbox]')) return;
      // e.relatedTarget is what just lost focus: usually the field the
      // autoFocus put focus on (it can fire before this listener exists).
      const from = e.relatedTarget;
      const back = from instanceof HTMLElement && panel.contains(from) ? from
        : lastInside && panel.contains(lastInside) ? lastInside : panel;
      back.focus({ preventScroll: true });
    };
    const t = setTimeout(() => {
      const panel = panelRef.current;
      if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    }, 400);
    const onKey = (e) => {
      if (e.key !== 'Escape' || !latest.current.dismissible) return;
      e.stopPropagation();
      latest.current.onOpenChange?.(false);
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('keydown', onKey);
    return () => {
        clearTimeout(t);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('keydown', onKey);
      if (previous instanceof HTMLElement && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    // style: our layer (z 1000, like the dialogs), and always visible. The
    // library hides the sheet until it has measured it, which made React's
    // autoFocus miss and hid it from tests (jsdom measures 0). It starts
    // off-screen and renders nothing when closed, so nothing flashes.
    <Sheet isOpen={!!open} onClose={close} detent="content" disableDrag={!dismissible} unstyled
      style={{ zIndex: 1000, visibility: 'visible' }}>
      <Sheet.Container
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        data-slot="bottom-sheet"
        className={cn(
          // Material `modal` (ds.css): float fill, edge, highlight and modal shadow.
          'flex max-h-[calc(100dvh-64px)] flex-col rounded-t-sheet border-t border-float-border bg-float font-sans text-card-foreground shadow-[var(--float-highlight),var(--shadow-modal)] outline-none',
          className,
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* While a field has focus the library will not drag (the keyboard is
            up). Touching the handle closes the keyboard first, as on iOS. */}
        <Sheet.Header disableDrag={!dismissible} className="shrink-0 cursor-grab touch-none"
          onPointerDown={() => {
            const el = document.activeElement;
            if (el instanceof HTMLElement && el !== panelRef.current && panelRef.current?.contains(el)) el.blur();
          }}>
          {dismissible
            ? <div aria-hidden="true" className="mx-auto mt-2 h-1 w-9 rounded-full bg-input" />
            : <div aria-hidden="true" className="h-2" />}
          <div className={cn('px-6 pb-2 pt-3', !dismissible && 'pb-1 pt-5')}>
            <h2 id={titleId} className="m-0 text-heading">{title}</h2>
          </div>
          {description && <p id={descId} className="sr-only">{description}</p>}
        </Sheet.Header>
        <Sheet.Content disableDrag className="min-h-0 flex-1">
          <div className="px-6 pb-6 pt-2">{children}</div>
        </Sheet.Content>
        {footer && <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-2.5">{footer}</div>}
      </Sheet.Container>
      <Sheet.Backdrop onTap={close} className="bg-scrim" />
    </Sheet>
  );
}
