import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { IconButton } from './IconButton';
import { MenuItem, MenuSeparator, MenuLabel } from '@/ui/shadcn/menu';

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
          className="z-menu flex min-w-[200px] flex-col rounded-card material-menu p-1 font-sans text-foreground"
        >
          {visible.map((it, i) => {
            if (it.divider) return <MenuSeparator key={`d${i}`} />;
            if (it.heading) return <MenuLabel key={`h${i}`}>{it.label}</MenuLabel>;
            return (
              <MenuItem
                key={it.label || i}
                icon={it.icon || null}
                selected={it.selected != null ? !!it.selected : undefined}
                danger={it.danger}
                onClick={() => { setOpen(false); it.onClick?.(); }}
              >
                {it.label}
              </MenuItem>
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
