import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from './utils';

function Label({ className, ...props }) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn('text-caption font-medium text-foreground select-none', className)}
      {...props}
    />
  );
}

export { Label };
