import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from './utils';
import { Spinner } from './spinner';

// 44px tall on a phone (the tap minimum), 40px from the iPad up, medium
// weight: a 48px semibold ink slab read as oversized on the dark theme. `default` is the ink button:
// one per screen, for the thing the screen is for.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-sans font-medium cursor-pointer transition-[background-color,border-color,color,opacity] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // Disabled = a quiet grey chip, not a 50% ink slab (on dark that read as a big grey block).
        default: 'bg-primary text-primary-foreground hover:opacity-90 active:opacity-80 disabled:bg-raised disabled:text-muted-foreground',
        outline: 'border border-control-edge bg-transparent text-foreground hover:bg-raised active:bg-raised disabled:text-muted-foreground disabled:opacity-60',
        ghost: 'bg-transparent text-muted-foreground hover:bg-raised hover:text-foreground disabled:opacity-50',
        destructive: 'bg-danger text-white hover:opacity-90 disabled:bg-raised disabled:text-muted-foreground',
        link: 'h-auto bg-transparent p-0 font-medium text-link underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-4 text-body sm:h-10 sm:text-small',
        // 36px to look at, 44px to tap: the ::after stretches the hit area.
        sm: "relative h-9 min-h-0 px-3.5 text-small after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
        // Same height as `default` so a row of buttons lines up.
        icon: 'size-11 p-0 sm:size-10',
      },
    },
    // A link takes the size of the sentence it sits in. min-h-0 undoes the
    // 44px phone floor index.css gives every button: this one is a word.
    compoundVariants: [
      { variant: 'link', className: 'inline h-auto min-h-0 px-0 align-baseline text-[length:inherit] sm:h-auto sm:text-[length:inherit]' },
    ],
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

// `type` defaults to "button": a button inside a form submits only when asked.
function Button({ className, variant, size, asChild = false, loading = false, disabled, type = 'button', children, ...props }) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      type={asChild ? undefined : type}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? children : (
        <>
          {loading && <Spinner />}
          {children}
        </>
      )}
    </Comp>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants };
