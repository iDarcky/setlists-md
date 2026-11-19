import { cva } from 'class-variance-authority';
import { cn } from './utils';

// A status pill: 24px, 12px semibold, one tone per meaning (same in every list).
const badgeVariants = cva(
  'inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-caption font-semibold',
  {
    variants: {
      variant: {
        selected: 'bg-selected text-link',      // Yes, Ready, You play, Next
        neutral: 'bg-raised text-muted-foreground', // Draft, Not playing
        outline: 'border border-border text-muted-foreground',
        danger: 'bg-danger-fill text-danger-text',
        warning: 'bg-warning-fill text-warning-text',
        success: 'bg-success-fill text-success-text',
        info: 'bg-info-fill text-info-text',
      },
    },
    defaultVariants: { variant: 'selected' },
  },
);

function Badge({ className, variant, ...props }) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// eslint-disable-next-line react-refresh/only-export-components
export { Badge, badgeVariants };
