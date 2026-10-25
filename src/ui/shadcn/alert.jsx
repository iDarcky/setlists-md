import { cva } from 'class-variance-authority';
import { cn } from './utils';

// The line under a form that says what just happened. `danger` for errors,
// `success` for "we sent it", `info` for anything else.
const alertVariants = cva('rounded-control px-3.5 py-2.5 text-small', {
  variants: {
    variant: {
      info: 'bg-info-fill text-info-text',
      success: 'bg-success-fill text-success-text',
      warning: 'bg-warning-fill text-warning-text',
      danger: 'bg-danger-fill text-danger-text',
    },
  },
  defaultVariants: { variant: 'info' },
});

function Alert({ className, variant, ...props }) {
  return (
    <div
      data-slot="alert"
      role={variant === 'danger' ? 'alert' : 'status'}
      aria-live="polite"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export { Alert, alertVariants };
