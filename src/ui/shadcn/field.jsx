import { cn } from './utils';
import { Label } from './label';

// A label, its control and the line under it, 8px apart. Fields in a form sit
// 16px apart (`FieldGroup`).
function FieldGroup({ className, ...props }) {
  return <div data-slot="field-group" className={cn('flex flex-col gap-4', className)} {...props} />;
}

function Field({ className, ...props }) {
  return <div role="group" data-slot="field" className={cn('flex flex-col gap-2', className)} {...props} />;
}

function FieldSet({ className, ...props }) {
  return <fieldset data-slot="field-set" className={cn('m-0 flex min-w-0 flex-col gap-2 border-0 p-0', className)} {...props} />;
}

function FieldLegend({ className, ...props }) {
  return <legend data-slot="field-legend" className={cn('mb-0 p-0 text-caption font-medium text-foreground', className)} {...props} />;
}

function FieldLabel({ className, ...props }) {
  return <Label data-slot="field-label" className={className} {...props} />;
}

function FieldDescription({ className, ...props }) {
  return <p data-slot="field-description" className={cn('m-0 text-small text-muted-foreground', className)} {...props} />;
}

function FieldError({ className, children, ...props }) {
  if (!children) return null;
  return (
    <p role="alert" data-slot="field-error" className={cn('m-0 text-small text-danger-text', className)} {...props}>
      {children}
    </p>
  );
}

export { FieldGroup, Field, FieldSet, FieldLegend, FieldLabel, FieldDescription, FieldError };
