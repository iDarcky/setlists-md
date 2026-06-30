import React from 'react';
import { cn } from '../../lib/utils';
import { Spinner } from './Spinner';

const Button = React.forwardRef(({
  className,
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled = false,
  children,
  ...props
}, ref) => {
  const baseStyles = "inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap select-none cursor-pointer transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ds-background-100)] disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97]";

  const variants = {
    primary: "bg-[var(--text-1)] text-[var(--bg-1)] shadow-sm hover:bg-[var(--text-2)] focus-visible:ring-[var(--text-2)]",
    secondary: "bg-[var(--bg-1)] text-[var(--text-1)] border border-[var(--border-1)] hover:bg-[var(--bg-2)] hover:border-[var(--border-2)] focus-visible:ring-[var(--border-2)]",
    ghost: "bg-transparent text-[var(--text-1)] hover:bg-[var(--bg-2)] focus-visible:ring-[var(--border-1)]",
    error: "bg-[var(--ds-red-100)] text-[var(--ds-red-1000)] border border-[var(--ds-red-400)] hover:bg-[var(--ds-red-200)] focus-visible:ring-[var(--ds-red-400)]",
    danger: "bg-[var(--ds-red-700)] text-white border-none shadow-sm hover:bg-[var(--ds-red-800)] focus-visible:ring-[var(--ds-red-700)]",
    warning: "bg-[var(--ds-amber-100)] text-[var(--ds-amber-1000)] border border-[var(--ds-amber-400)] hover:bg-[var(--ds-amber-200)] focus-visible:ring-[var(--ds-amber-400)]",
    brand: "bg-[var(--color-brand)] text-white shadow-sm hover:opacity-90 focus-visible:ring-[var(--color-brand)]",
  };

  const sizes = {
    xs: "h-7 px-2 text-label-11",
    sm: "h-8 px-3 text-label-12",
    md: "h-10 px-4 text-button-14",
    lg: "h-12 px-6 text-heading-16",
    icon: "h-10 w-10 p-0",
  };

  // Brand/danger variants need inline style to guarantee white text
  const brandStyle = (variant === 'brand' || variant === 'danger') ? { color: '#ffffff' } : undefined;

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      style={brandStyle}
      {...props}
    >
      {loading ? (
        <Spinner className="mr-2 h-4 w-4" />
      ) : null}
      {children}
    </button>
  );
});

Button.displayName = "Button";

export { Button };
