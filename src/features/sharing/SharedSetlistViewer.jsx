import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { fetchSharedSetlist } from '@/lib/setlistShare';
import { Button } from '@/ui/Button';
import StatusScreen from '@/ui/StatusScreen';

const SetlistOverview = lazy(() => import('@/features/setlist-viewer/SetlistOverview'));
const SetlistReader = lazy(() => import('@/features/reader/SetlistReader'));

// Public, read-only viewer for a shared setlist link (`/?setlist=<token>`).
// Renders without auth or the user's local library — everything comes from the
// frozen snapshot stored under the token. Expired/missing links show a notice.
export default function SharedSetlistViewer({ token, onExit, settings }) {
  const [state, setState] = useState({ status: 'loading', data: null });
  const [playing, setPlaying] = useState(false);
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
    (async () => {
      try {
        const data = await fetchSharedSetlist(token);
        if (!alive) return;
        setState(data ? { status: 'ready', data } : { status: 'gone', data: null });
      } catch {
        if (alive) setState({ status: 'error', data: null });
      }
    })();
    return () => { alive = false; };
  }, [token]);

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

  const { setlist, songs } = state.data;

  // A public, read-only read of the frozen snapshot. No app shell, no account.
  //
  // ⚠ ALWAYS Live, and NO mode chip (`onModeChange` absent, owner 2026-08-11:
  // *"yes, always locked, but we don't use the locked chip there"*). This
  // closes the one row `docs/READER.md`'s view table left undecided: a shared
  // link is not a fifth view, it is the reader with the mode nailed down.
  //
  // A chip here would offer Practice to someone with no account — no settings
  // to write to, no song to edit, nothing on the other side of the tap. Every
  // capability Practice adds needs a writer this surface does not have.
  if (playing) {
    return (
      <Suspense fallback={<div className="min-h-[100dvh] bg-[var(--ds-background-100)]" />}>
        <div className="h-[100dvh]">
          <SetlistReader
            setlist={setlist}
            songs={songs || []}
            settings={viewSettings}
            onUpdateSettings={updateViewSetting}
            mode="live"
            onBack={() => setPlaying(false)}
            onFinish={() => setPlaying(false)}
          />
        </div>
      </Suspense>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--ds-background-100)] flex flex-col">
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 h-12 border-b border-[var(--ds-gray-300)] bg-[var(--ds-background-200)]">
        <span className="text-label-12 font-semibold uppercase tracking-wider text-[var(--ds-gray-600)]">
          Shared setlist · read-only
        </span>
        <div className="flex items-center gap-2">
          <Button variant="brand" size="sm" onClick={() => setPlaying(true)}>Play</Button>
          <Button variant="secondary" size="sm" onClick={onExit}>Open app</Button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Suspense fallback={<div className="p-8 text-copy-14 text-[var(--ds-gray-600)]">Loading…</div>}>
          <SetlistOverview
            setlist={setlist}
            songs={songs || []}
            embedded
            canEdit={false}
            hidePlay
          />
        </Suspense>
      </div>
    </div>
  );
}
