import { Button } from '@/ui/shadcn/button';

// A whole page that explains why there is nothing to show: a link to
// something deleted, a share link that ended. Same shape as the error screen:
// heading, one or two sentences, the way out first.
//
// actions: [{ label, onClick, variant? }], the first is the main button.
export default function StatusScreen({ title, children, actions = [], fill = true }) {
  return (
    <div data-slot="status-screen"
      className={fill
        ? 'flex min-h-dvh items-center justify-center bg-background px-6 font-sans text-foreground'
        : 'flex flex-1 items-center justify-center bg-background px-6 py-16 font-sans text-foreground'}>
      <div className="flex w-full max-w-[400px] flex-col gap-4">
        <h1 className="m-0 text-[24px] font-semibold leading-8">{title}</h1>
        {children && <div className="flex flex-col gap-2 text-[15px] leading-6 text-muted-foreground">{children}</div>}
        {actions.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            {actions.map((a, i) => (
              <Button key={a.label} variant={a.variant || (i === 0 ? 'default' : 'ghost')} onClick={a.onClick}>{a.label}</Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
