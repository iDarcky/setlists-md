import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Geist-style icon-only button. Used for compact toolbar actions
 * like undo/redo, back, remove, prev/next navigation.
 *
 * Usage:
 *   <IconButton onClick={onBack} aria-label="Go back">←</IconButton>
 *   <IconButton variant="active" onClick={toggle}>Aa</IconButton>
 */
const IconButton = React.forwardRef(({
  className,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  children,
  ...props
}, ref) => {
  const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-gray-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ds-background-100)] disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97] border cursor-pointer";

  const variants = {
    ghost: "bg-transparent border-transparent text-[var(--ds-gray-700)] hover:text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-200)]",
    default: "bg-[var(--ds-background-100)] border-[var(--ds-gray-400)] text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-200)] hover:border-[var(--ds-gray-600)]",
    active: "bg-[var(--color-brand-soft)] border-[var(--color-brand-border)] text-[var(--color-brand-text)]",
    error: "bg-transparent border-transparent text-[var(--ds-gray-700)] hover:text-[var(--ds-error-900)] hover:bg-[var(--ds-error-soft)]",
  };

  const sizes = {
    xs: "h-7 w-7 text-[13px]",
    sm: "h-8 w-8 text-[14px]",
    md: "h-10 w-10 text-[16px]",
    lg: "h-12 w-12 text-[20px]",
  };

  return (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
});

IconButton.displayName = "IconButton";

export { IconButton };
