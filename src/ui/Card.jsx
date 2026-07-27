import React from 'react';
import { cn } from '@/lib/utils';

const Card = React.forwardRef(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] p-6 transition-all duration-150 hover:border-[var(--ds-gray-600)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = "Card";

export { Card };
