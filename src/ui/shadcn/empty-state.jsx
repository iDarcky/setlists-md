import { cn } from './utils';

// When a list or page has nothing in it.
// EmptyState: a card with an optional icon tile, a title (16 semibold), one
//   or two lines that say what will show up here or what to do (14 muted),
//   and at most one action. Used for a whole page or list.
// EmptyNote: one quiet line inside a card or sheet ("No templates yet.").
function EmptyState({ icon, title, children, action, className }) {
  return (
    <div data-slot="empty-state" className={cn('flex flex-col items-center gap-2 rounded-card material-base px-5 py-8 text-center', className)}>
      {icon && <span aria-hidden="true" className="mb-1 flex size-10 items-center justify-center rounded-control bg-raised text-muted-foreground [&_svg]:size-5">{icon}</span>}
      <h2 className="m-0 text-body font-semibold">{title}</h2>
      {children && <p className="m-0 max-w-[320px] text-small text-muted-foreground">{children}</p>}
      {action && <div className="mt-2 flex w-full max-w-[300px] flex-col gap-2">{action}</div>}
    </div>
  );
}

function EmptyNote({ children, className }) {
  return <p data-slot="empty-note" className={cn('m-0 px-4 py-6 text-center text-small text-muted-foreground', className)}>{children}</p>;
}

export { EmptyState, EmptyNote };
