import { APP_HEIGHT } from '@/lib/appViewport';

// Launch placeholder while the app works out which church to open: the shape
// of the top bar and Home, in grey, so nothing jumps when the church arrives
// (owner, 2026-11-03: "show skeletons until it's loaded").
const Bar = ({ className = '' }) => <div className={`animate-pulse rounded-md bg-raised ${className}`} />;

export default function AppSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex w-full flex-col overflow-hidden bg-background" style={{ height: APP_HEIGHT }}>
      <div className="flex h-14 shrink-0 items-center justify-between px-4 lg:h-16 lg:border-b lg:border-border lg:px-5">
        <div className="flex items-center gap-2.5"><Bar className="size-[30px] rounded-[8px]" /><Bar className="h-4 w-28" /></div>
        <div className="hidden lg:block"><Bar className="h-10 w-72 rounded-full" /></div>
        <div className="flex items-center gap-3"><Bar className="size-8 rounded-full" /><Bar className="size-8 rounded-full" /></div>
      </div>
      <HomeSkeleton />
    </div>
  );
}

/** Home's body in grey: the same blocks as AppSkeleton, for Home itself to
 *  show until its team data is all in (owner, 21 Nov 2026: "bring all the
 *  items at once"). */
export function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="mx-auto flex w-full max-w-[1040px] flex-col gap-3 px-4 pt-2 sm:px-6 sm:pt-4 lg:px-8 lg:pt-8">
      <Bar className="h-7 w-40" />
      <Bar className="h-4 w-56" />
      <Bar className="mt-2 h-40 w-full rounded-card" />
      <Bar className="h-28 w-full rounded-card" />
      <Bar className="h-48 w-full rounded-card" />
    </div>
  );
}

/** Launch placeholder when no team is coming (signed out, or no team yet):
 *  just the page colour. The app's shape here would flash a team space
 *  before the welcome or set-up screens (owner, 21 Nov 2026). */
export function PlainLoading() {
  return <div aria-busy="true" aria-label="Loading" className="w-full bg-background" style={{ height: APP_HEIGHT }} />;
}
