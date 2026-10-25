import { cn } from './utils';

function Card({ className, ...props }) {
  return (
    <div
      data-slot="card"
      className={cn('flex flex-col gap-2.5 rounded-card border border-border bg-card p-4 text-card-foreground', className)}
      {...props}
    />
  );
}

function CardLabel({ className, ...props }) {
  return <span data-slot="card-label" className={cn('text-caption font-medium text-muted-foreground', className)} {...props} />;
}

export { Card, CardLabel };
