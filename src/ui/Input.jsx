import React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef(({
  className,
  type = 'text',
  size = 'md',
  variant = 'default',
  prefix,
  suffix,
  disabled,
  ...props
}, ref) => {
  const variantStyles = {
    default: "bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] focus-within:ring-2 focus-within:ring-[var(--ds-gray-400)] focus-within:border-[var(--ds-gray-600)]",
    ghost: "bg-transparent border border-[var(--ds-gray-300)] focus-within:ring-1 focus-within:ring-[var(--ds-gray-400)] focus-within:border-[var(--ds-gray-400)]",
  };

  const sizeStyles = {
    sm: "text-copy-13",
    md: "text-copy-14",
  };

  const inputPadding = {
    sm: "px-2 py-1",
    md: "px-3 py-2",
  };

  return (
    <div className={cn(
      "flex items-center w-full rounded-md transition-all duration-100",
      variantStyles[variant],
      disabled && "opacity-50 pointer-events-none",
      className
    )}>
      {prefix && (
        <div className={cn("flex items-center justify-center text-[var(--ds-gray-900)]", size === 'sm' ? "pl-2" : "pl-3")}>
          {prefix}
        </div>
      )}
      <input
        type={type}
        className={cn(
          "w-full bg-transparent border-none outline-none placeholder:text-[var(--ds-gray-700)] text-[var(--ds-gray-1000)]",
          inputPadding[size],
          sizeStyles[size],
          prefix && "pl-2",
          suffix && "pr-2"
        )}
        ref={ref}
        disabled={disabled}
        {...props}
      />
      {suffix && (
        <div className={cn("flex items-center justify-center text-[var(--ds-gray-900)]", size === 'sm' ? "pr-2" : "pr-3")}>
          {suffix}
        </div>
      )}
    </div>
  );
});

Input.displayName = "Input";

export { Input };
