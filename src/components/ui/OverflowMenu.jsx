import React, { useEffect, useRef, useState } from 'react';
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
  const rootRef = useRef(null);

  const visible = items.filter(Boolean);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (visible.length === 0) return null;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <IconButton
        variant="ghost"
        size={size}
        onClick={() => setOpen(v => !v)}
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
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute top-full mt-1 z-50 min-w-[180px] rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] shadow-lg py-1',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {visible.map((it, i) => (
            <button
              key={it.label || i}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); it.onClick?.(); }}
              className={cn(
                'w-full flex items-center gap-2.5 text-left px-3.5 py-2.5 cursor-pointer border-none bg-transparent text-label-13 transition-colors',
                it.danger
                  ? 'text-[var(--ds-error-900)] hover:bg-[var(--ds-error-soft)]'
                  : 'text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-200)]'
              )}
            >
              {it.icon && <span className="shrink-0 inline-flex items-center text-[var(--ds-gray-700)]">{it.icon}</span>}
              <span className="truncate">{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

OverflowMenu.displayName = 'OverflowMenu';

export default OverflowMenu;
