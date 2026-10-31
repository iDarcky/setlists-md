import { Button } from '@/ui/shadcn/button';
import { Order } from '@/features/setlist/SetlistView';

// The page a guest link opens: the church, the service, the order with keys and
// Open the charts. No band and no people (GDPR); nothing to edit.

function ChurchMark({ church, size = 24 }) {
  const name = church?.name || '';
  if (church?.logo_url) {
    return <img src={church.logo_url} alt="" width={size} height={size} className="shrink-0 rounded-md object-cover" style={{ width: size, height: size }} />;
  }
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'S';
  return (
    <span className="flex shrink-0 items-center justify-center rounded-md bg-raised font-semibold text-foreground" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {initials}
    </span>
  );
}

const PlayIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" /></svg>;

export default function GuestView({ setlist, order, church, when, live = false, ends, onPlay, onGetApp }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background font-sans text-foreground">
      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-3 px-4 pb-10 sm:px-6"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)' }}>
        <div className="flex h-14 items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2.5 text-[15px] font-semibold">
            {church?.name ? <><ChurchMark church={church} /><span className="truncate">{church.name}</span></> : <span className="text-muted-foreground">Shared setlist</span>}
          </span>
          {onGetApp && <Button variant="link" className="text-[14px]" onClick={onGetApp}>Get the app</Button>}
        </div>

        <div className="flex flex-col gap-2 pt-2">
          {when && <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{when}</span>}
          <h1 className="m-0 text-[26px] font-semibold leading-8 tracking-[-0.6px] sm:text-[32px] sm:leading-10 sm:tracking-[-1px]">{setlist.name || 'Untitled setlist'}</h1>
          <span className="flex items-start gap-2 text-[14px] leading-5 text-muted-foreground">
            {live && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-success" aria-hidden="true" />}
            {[live ? 'Live: updates when the leader changes it' : 'A copy from when it was shared', ends && `link ends ${ends}`].filter(Boolean).join(' · ')}
          </span>
        </div>

        <Button className="mt-1 h-12 text-[16px]" disabled={!order.songCount} onClick={() => onPlay(0)}><PlayIcon />Open the charts</Button>

        <Order order={order} empty="No songs yet."
          onOpenRow={(r) => { if (r.kind === 'song') onPlay(r.idx); }} />

        <footer className="mt-auto flex items-center justify-center gap-2 pt-10 text-[13px] text-muted-foreground">
          {church?.name && <><ChurchMark church={church} size={16} /><span>{church.name}</span><span aria-hidden="true">·</span></>}
          <span>Made with <b className="font-semibold text-foreground">Setlists.md</b></span>
        </footer>
      </div>
    </div>
  );
}
