import { APP_HEIGHT } from '@/lib/appViewport';

// Launch placeholder while the app works out which church to open: the shape
// of the top bar and Home, in grey, so nothing jumps when the church arrives
// (owner, 2026-11-03: "show skeletons until it's loaded", not Personal).
const Bar = ({ className = '' }) => <div className={`animate-pulse rounded-md bg-raised ${className}`} />;

export default function AppSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex w-full flex-col overflow-hidden bg-background" style={{ height: APP_HEIGHT }}>
      <div className="flex h-14 shrink-0 items-center justify-between px-4 lg:h-16 lg:border-b lg:border-border lg:px-5">
        <div className="flex items-center gap-2.5"><Bar className="size-[30px] rounded-[8px]" /><Bar className="h-4 w-28" /></div>
        <div className="hidden lg:block"><Bar className="h-10 w-72 rounded-full" /></div>
        <div className="flex items-center gap-3"><Bar className="size-8 rounded-full" /><Bar className="size-8 rounded-full" /></div>
      </div>
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-3 px-4 pt-2 sm:px-6 sm:pt-4 lg:px-8 lg:pt-8">
        <Bar className="h-7 w-40" />
        <Bar className="h-4 w-56" />
        <Bar className="mt-2 h-40 w-full rounded-card" />
        <Bar className="h-28 w-full rounded-card" />
        <Bar className="h-48 w-full rounded-card" />
      </div>
    </div>
  );
}
