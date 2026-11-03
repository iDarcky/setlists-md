import { useEffect, useMemo, useState, useCallback, lazy, Suspense } from 'react';
import { fetchSharedSetlist, endsLabel } from '@/lib/setlistShare';
import { buildOrder } from '@/lib/setlistView';
import { formatClockTime } from '@/lib/dateFormat';
import { cn } from '@/ui/shadcn/utils';
import StatusScreen from '@/ui/StatusScreen';
import GuestView from './GuestView';

const SetlistReader = lazy(() => import('@/features/reader/SetlistReader'));

// A live link re-reads the setlist this often while the page is open, so a
// change the leader makes reaches the guest without a reload.
const REFRESH_MS = 60 * 1000;

// Public, read-only viewer for a guest link (`/?setlist=<token>`). Renders
// without auth or the user's local library. A church link is live (the current
// setlist, through `get_shared_setlist`); an older one is a frozen snapshot.
// Ended/missing links show a notice.
export default function SharedSetlistViewer({ token, onExit, settings }) {
  const [state, setState] = useState({ status: 'loading', data: null });
  const [playing, setPlaying] = useState(null);
  // ⚠ THE ☰ DID NOTHING HERE. Owner, 2026-08-11: *"nothing from the ☰ menu
  // works in a shared setlist, why?"*
  //
  // Because this surface passed `settings` and no `onUpdateSettings`, and
  // `ReaderMenu`'s writer is `onUpdateSettings?.(key, value)` — so every
  // control in all three tabs rendered, looked live, and silently discarded the
  // change. The house bug, on the one surface where the visitor has no other
  // way to make the chart readable.
  //
  // Session-only by design: a shared link has no account to save to, and
  // writing to this device's real settings would let a link someone opened once
  // change the app they own. It resets when the tab closes, which is the right
  // lifetime for a page you were sent.
  const [viewSettings, setViewSettings] = useState(() => ({ ...(settings || {}) }));
  const updateViewSetting = useCallback(
    (key, value) => setViewSettings(prev => ({ ...prev, [key]: value })),
    [],
  );

  useEffect(() => {
    let alive = true;
    const load = async (quiet) => {
      try {
        const data = await fetchSharedSetlist(token);
        if (!alive) return;
        setState(data ? { status: 'ready', data } : { status: 'gone', data: null });
      } catch {
        // A refresh that fails keeps what's on screen.
        if (alive && !quiet) setState({ status: 'error', data: null });
      }
    };
    load(false);
    const tick = setInterval(() => { if (document.visibilityState === 'visible') load(true); }, REFRESH_MS);
    return () => { alive = false; clearInterval(tick); };
  }, [token]);

  const order = useMemo(
    () => (state.data ? buildOrder(state.data.setlist, state.data.songs) : null),
    [state.data],
  );

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background font-sans">
        <div className="text-[15px] text-muted-foreground">Opening the setlist…</div>
      </div>
    );
  }

  if (state.status !== 'ready') {
    // A link ends 2–3 hours after its service, or when the leader stops
    // sharing it. The server hides an ended link entirely, so "ended" and
    // "never existed" look the same from here; say the likely one.
    const offline = state.status === 'error' && typeof navigator !== 'undefined' && navigator.onLine === false;
    if (offline) {
      return (
        <StatusScreen title="You’re offline"
          actions={[{ label: 'Try again', onClick: () => window.location.reload() }]}>
          <p className="m-0">This setlist opens from the internet. Connect and try again.</p>
        </StatusScreen>
      );
    }
    if (state.status === 'error') {
      return (
        <StatusScreen title="This link didn’t open"
          actions={[{ label: 'Try again', onClick: () => window.location.reload() }, { label: 'Open Setlists.md', onClick: onExit }]}>
          <p className="m-0">Something went wrong on our side. Try again in a minute.</p>
        </StatusScreen>
      );
    }
    return (
      <StatusScreen title="This link has ended"
        actions={[{ label: 'Open Setlists.md', onClick: onExit }]}>
        <p className="m-0">Shared setlists stop working a few hours after the service, or when the leader stops sharing them.</p>
        <p className="m-0">Ask whoever sent it for a new link.</p>
      </StatusScreen>
    );
  }

  const { setlist, songs, church, live, expires_at: expiresAt } = state.data;
  const fmt = viewSettings.clockFormat || '24h';
  const when = [
    setlist.date && new Date(`${setlist.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
    setlist.time && formatClockTime(setlist.time, fmt),
  ].filter(Boolean).join(' · ');
  const shows = viewSettings.displayMode === 'lyrics' ? 'lyrics' : 'chords';

  // The full reader, with the ☰ working (session-only settings, above). It is
  // always Live and has NO mode chip (`onModeChange` absent, owner 2026-08-11:
  // *"yes, always locked, but we don't use the locked chip there"*): a chip
  // would offer Practice to someone with nothing on the other side of it.
  //
  // Chords / Lyrics sits on top for singers and whoever runs the slides
  // (owner, 2026-10-30: guests "have access to the whole chart view"). It is
  // the ☰'s own Show setting, so the two never disagree.
  if (playing != null) {
    return (
      <div className="flex h-[100dvh] flex-col bg-background font-sans">
        <div className="flex shrink-0 justify-center border-b border-border px-4 py-2" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)' }}>
          <div role="radiogroup" aria-label="What the chart shows" className="flex rounded-control bg-raised p-1">
            {[['chords', 'Chords'], ['lyrics', 'Lyrics']].map(([v, label]) => (
              <button key={v} type="button" role="radio" aria-checked={shows === v}
                onClick={() => updateViewSetting('displayMode', v)}
                className={cn('h-8 min-h-0 min-w-[96px] cursor-pointer rounded-[8px] border-0 px-4 font-sans text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  shows === v ? 'bg-background text-foreground shadow-sm' : 'bg-transparent text-muted-foreground')}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <Suspense fallback={<div className="h-full bg-background" />}>
            <SetlistReader
              setlist={setlist}
              songs={songs || []}
              settings={viewSettings}
              onUpdateSettings={updateViewSetting}
              mode="live"
              startIndex={playing}
              onBack={() => setPlaying(null)}
              onFinish={() => setPlaying(null)}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <GuestView
      setlist={setlist} order={order} church={church} when={when} live={live}
      ends={expiresAt ? endsLabel(new Date(expiresAt).getTime(), fmt) : ''}
      onPlay={setPlaying} onGetApp={onExit}
    />
  );
}
