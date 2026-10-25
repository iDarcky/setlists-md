import * as TogglePrimitive from '@radix-ui/react-toggle';
import { cva } from 'class-variance-authority';
import { cn } from './utils';

// `chip` is the pick-all-that-fit chip: quiet outline off, soft green fill
// with a green edge and a tick on.
const toggleVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-sans font-medium cursor-pointer outline-none transition-[background-color,border-color,color] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        chip: 'rounded-control border border-chip-border bg-transparent text-muted-foreground hover:text-foreground data-[state=on]:border-link data-[state=on]:bg-selected data-[state=on]:text-foreground',
      },
      size: {
        // min-h-0: the chip is 40px (36 from the iPad up); the ::after makes
        // the tap area 48px tall, over index.css's 44px floor for buttons.
        default: "relative h-10 min-h-0 px-3.5 text-small sm:h-9 sm:px-3 after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
      },
    },
    defaultVariants: { variant: 'chip', size: 'default' },
  },
);

const Tick = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

function Toggle({ className, variant, size, children, ...props }) {
  return (
    <TogglePrimitive.Root data-slot="toggle" className={cn(toggleVariants({ variant, size }), className)} {...props}>
      {props.pressed && <Tick />}
      {children}
    </TogglePrimitive.Root>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export { Toggle, toggleVariants };
