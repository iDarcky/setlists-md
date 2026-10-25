import { cva } from 'class-variance-authority';
import { cn } from './utils';

const badgeVariants = cva(
  'inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md px-2.5 text-caption font-medium',
  {
    variants: {
      variant: {
        selected: 'bg-selected text-foreground',
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
