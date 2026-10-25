import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from './utils';
import { Spinner } from './spinner';

// 48px tall on a phone, 44px from the iPad up. `default` is the ink button:
// one per screen, for the thing the screen is for.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-sans font-semibold cursor-pointer transition-[background-color,border-color,color,opacity] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:opacity-90 active:opacity-80',
        outline: 'border border-input bg-transparent text-foreground hover:bg-raised active:bg-raised',
        ghost: 'bg-transparent text-muted-foreground hover:bg-raised hover:text-foreground',
        destructive: 'bg-danger text-white hover:opacity-90',
        link: 'h-auto bg-transparent p-0 font-medium text-link underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-12 px-5 text-body sm:h-11 sm:text-[15px]',
        // 36px to look at, 44px to tap: the ::after stretches the hit area.
        sm: "relative h-9 min-h-0 px-3.5 text-small after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
        icon: 'size-11 p-0',
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
