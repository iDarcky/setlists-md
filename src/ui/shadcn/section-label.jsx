import { cn } from './utils';

// The small UPPERCASE heading above a group (YOU, APP, NEXT SUNDAYS, ORDER).
// One size everywhere: `text-label` = 12px, semibold, 0.06em, muted.
// Optional count (normal case, after the words) and an action on the right
// (a link-coloured word like "See all" or "Clear"). Spacing above/below is
// the parent's job: pass it in className.
function SectionLabel({ children, count, action, as: Comp = 'h2', className, ...props }) {
  return (
    <div data-slot="section-label" className={cn('flex min-h-4 items-center justify-between gap-3', className)} {...props}>
      <Comp className="m-0 flex items-center gap-2 text-label text-muted-foreground">
        {children}
        {count != null && <span className="font-medium normal-case tracking-normal tabular-nums">{count}</span>}
      </Comp>
      {action}
    </div>
  );
}

/** The word on the right of a section label: "See all", "Clear", "Edit". */
function SectionAction({ className, ...props }) {
  return (
    <button
      type="button"
      className={cn('min-h-0 cursor-pointer border-0 bg-transparent p-0 font-sans text-small font-medium text-link outline-none hover:underline focus-visible:underline', className)}
      {...props}
    />
  );
}

export { SectionLabel, SectionAction };
