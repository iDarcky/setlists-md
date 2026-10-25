import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from './utils';

// shadcn's Popover: a small panel anchored to its trigger (chip dropdowns).
// Longer choices still go in a Sheet.

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;

function PopoverContent({ className, align = 'start', sideOffset = 6, ...props }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          'z-50 w-72 max-w-[calc(100vw-24px)] rounded-card border border-border bg-card p-3 font-sans text-foreground shadow-[0_8px_30px_rgba(0,0,0,.25)] outline-none',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverContent };
