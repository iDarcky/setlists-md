import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { IconButton } from './IconButton';

/**
 * Kebab ("⋮") overflow menu. Collects secondary actions behind a single
 * three-dot button so toolbars stay uncluttered.
 *
 * Usage:
 *   <OverflowMenu
 *     items={[
 *       { label: 'Print', icon: <PrinterIcon/>, onClick: handlePrint },
 *       { label: 'Edit', onClick: handleEdit },
 *       { label: 'Delete', onClick: handleDelete, danger: true },
 *     ]}
 *   />
 *
 * Falsy entries in `items` are skipped, so callers can inline-gate actions:
 *   items={[ onEdit && { label: 'Edit', onClick: onEdit }, ... ]}
 */
export function OverflowMenu({ items = [], align = 'right', size = 'sm', ariaLabel = 'More actions', className }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const rootRef = useRef(null);
  const menuRef = useRef(null);

  const visible = items.filter(Boolean);

  // Position the menu against the button in viewport coordinates. The menu is
  // portaled to <body> so it escapes the chart's sticky header + overflow
  // ancestors that were clipping the lower menu items.
  const reposition = useCallback(() => {
    const btn = rootRef.current?.querySelector('button');
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    setCoords({
      top: r.bottom + 4,
      ...(align === 'right'
        ? { right: window.innerWidth - r.right }
        : { left: r.left }),
    });
  }, [align]);

  const toggle = () => {
    // Measure before opening so the portal renders in the right spot on the
    // first paint (no effect → no cascading-render lint hit).
    if (!open) reposition();
    setOpen(v => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      const inRoot = rootRef.current && rootRef.current.contains(e.target);
      const inMenu = menuRef.current && menuRef.current.contains(e.target);
      if (!inRoot && !inMenu) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    // Keep the menu glued to the button while the chart body scrolls or the
    // window resizes (capture catches the inner scroll container too).
    const onReflow = () => reposition();
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open, reposition]);

  if (visible.length === 0) return null;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <IconButton
        variant="ghost"
        size={size}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </IconButton>
      {open && coords && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ position: 'fixed', ...coords, maxHeight: '70vh', overflowY: 'auto' }}
          className="z-[200] min-w-[180px] rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] shadow-lg py-1"
        >
          {visible.map((it, i) => {
            if (it.divider) return <div key={`d${i}`} role="separator" className="my-1 h-px bg-[var(--ds-gray-200)]" />;
            if (it.heading) return <div key={`h${i}`} className="px-3.5 pt-2 pb-1 text-label-10 uppercase tracking-wider text-[var(--ds-gray-600)]">{it.label}</div>;
            return (
              <button
                key={it.label || i}
                type="button"
                role={it.selected != null ? 'menuitemradio' : 'menuitem'}
                aria-checked={it.selected != null ? !!it.selected : undefined}
                onClick={() => { setOpen(false); it.onClick?.(); }}
                className={cn(
                  'w-full flex items-center gap-2.5 text-left px-3.5 py-2.5 cursor-pointer border-none bg-transparent text-label-13 transition-colors',
                  it.danger
                    ? 'text-[var(--ds-error-900)] hover:bg-[var(--ds-error-soft)]'
                    : it.selected
                      ? 'text-[var(--color-brand)] font-semibold hover:bg-[var(--ds-gray-200)]'
                      : 'text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-200)]'
                )}
              >
                {it.icon && <span className="shrink-0 inline-flex items-center text-[var(--ds-gray-700)]">{it.icon}</span>}
                <span className="truncate flex-1">{it.label}</span>
                {it.selected && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

OverflowMenu.displayName = 'OverflowMenu';

export default OverflowMenu;
