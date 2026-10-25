import { cn } from '@/ui/shadcn/utils';
import { churchInitials } from '@/lib/joinLink';

// The one layout every signed-out and joining screen shares (canvas "Signed
// out and joining", Version 2). On a phone the heading sits at the top and
// the buttons at the bottom, within thumb reach. From the iPad up everything
// is one 400px column in the middle of the screen, buttons right under the
// form. The switch is at 640px of the screen's OWN width (a container query). No card around the form, headings left-aligned.

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
);

const TickIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

/**
 * @param {Function} [onBack]   shows "← Back" in the top-left corner
 * @param {boolean}  [embedded] fills its parent instead of the window (/design)
 */
export function AuthLayout({ onBack, embedded = false, className, children }) {
  return (
    <div
      data-slot="auth-layout"
      className={cn(
        embedded ? 'absolute inset-0' : 'fixed inset-0 z-[60]',
        // A container, so the phone/iPad switch follows this screen's width:
        // the /design gallery shows a phone layout inside a desktop window.
        '@container overflow-y-auto bg-background font-sans text-foreground',
      )}
    >
      <div
        className="relative flex min-h-full flex-col px-6 @min-[640px]:items-center @min-[640px]:justify-center @min-[640px]:px-10"
        style={{
          paddingTop: 'calc(64px + env(safe-area-inset-top))',
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
        }}
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="absolute left-3.5 flex h-11 cursor-pointer items-center gap-1.5 rounded-control border-0 bg-transparent pl-2 pr-3 font-sans text-[15px] font-medium text-muted-foreground outline-none hover:bg-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring @min-[640px]:left-5"
            style={{ top: 'calc(12px + env(safe-area-inset-top))' }}
          >
            <BackIcon />
            Back
          </button>
        )}
        <div className={cn('flex w-full flex-1 flex-col gap-6 @min-[640px]:max-w-[400px] @min-[640px]:flex-none', className)}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** The app's mark. 32px over a form, 56px on Welcome. */
export function LogoMark({ size = 32, className }) {
  return (
    <img
      src="/setlists-md-mark.svg"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={cn('block', className)}
    />
  );
}

/** The church's logo, or its initials on a raised square. */
export function ChurchBadge({ name, logoUrl, initials, quiet = false }) {
  if (logoUrl) {
    return <img src={logoUrl} alt="" aria-hidden="true" className="size-10 rounded-[10px] object-cover" />;
  }
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex size-10 items-center justify-center rounded-[10px] bg-raised text-[15px] font-semibold',
        quiet ? 'text-muted-foreground' : 'text-link',
      )}
    >
      {initials || churchInitials(name)}
    </div>
  );
}

/** The green tick square on "You're in!". */
export function SuccessBadge() {
  return (
    <div aria-hidden="true" className="flex size-10 items-center justify-center rounded-[10px] bg-success-fill text-success-text">
      <TickIcon />
    </div>
  );
}

/**
 * Mark, eyebrow, heading, line under it.
 * @param {'title'|'display'} [size] 24px for forms, 32px for invitations
 */
export function AuthHeader({ mark, eyebrow, title, sub, size = 'title' }) {
  return (
    <div className="flex flex-col gap-2">
      {mark && <div className="mb-2">{mark}</div>}
      {eyebrow && <span className="text-caption font-medium text-muted-foreground">{eyebrow}</span>}
      <h1 className={cn('m-0 text-foreground', size === 'display' ? 'text-display' : 'text-title')}>{title}</h1>
      {sub && <p className="m-0 text-body text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** The buttons: pinned to the bottom on a phone, under the form from iPad up. */
export function AuthActions({ className, children }) {
  return <div className={cn('mt-auto flex flex-col gap-3 @min-[640px]:mt-2', className)}>{children}</div>;
}

/** "New here? Create an account" — muted question, green answer. */
export function TextLink({ question, answer, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 cursor-pointer items-center justify-center gap-1 rounded-control border-0 bg-transparent font-sans text-[15px] text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {question} <b className="font-medium text-link">{answer}</b>
    </button>
  );
}
