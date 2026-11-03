import { cn } from './utils';

// 16px text on every device: anything smaller makes iOS zoom the page.
function Input({ className, type = 'text', ...props }) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-12 w-full min-w-0 rounded-control border border-input bg-transparent px-3.5 font-sans text-body text-foreground outline-none transition-[border-color,box-shadow] sm:h-11',
        'placeholder:text-muted-foreground',
        'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30',
        'aria-invalid:border-danger aria-invalid:ring-danger/25',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
