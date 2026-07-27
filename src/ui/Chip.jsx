import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Geist-style chip — a small rectangular label tag.
 * More compact and squared than Badge (which is pill-shaped).
 *
 * Usage:
 *   <Chip>Main Service</Chip>
 *   <Chip variant="success">Confirmed</Chip>
 *   <Chip variant="warning" size="sm">Draft</Chip>
 */
const Chip = React.forwardRef(({
  className,
  variant = 'default',
  size = 'md',
  children,
  ...props
}, ref) => {
  const variants = {
    default: 'bg-[var(--bg-1)] text-[var(--text-1)] border-[var(--border-1)]',
    success: 'bg-[var(--ds-green-100)] text-[var(--ds-green-1000)] border-[var(--ds-green-400)]',
    error: 'bg-[var(--ds-red-100)] text-[var(--ds-red-1000)] border-[var(--ds-red-400)]',
    warning: 'bg-[var(--ds-amber-100)] text-[var(--ds-amber-1000)] border-[var(--ds-amber-400)]',
    brand: 'bg-[var(--ds-teal-100)] text-[var(--ds-teal-1000)] border-[var(--ds-teal-400)]',
  };

  const sizes = {
    sm: 'px-1.5 py-0.5 text-[12px] tracking-wider',
    md: 'px-2 py-0.5 text-[13px] tracking-wide',
    lg: 'px-2.5 py-1 text-[14px] tracking-wide',
  };

  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-md border font-semibold uppercase leading-tight select-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
});

Chip.displayName = 'Chip';

export { Chip };
