import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { fetchSharedSetlist } from '@/lib/setlistShare';
import { Button } from '@/ui/Button';

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
      <div className="min-h-[100dvh] flex items-center justify-center bg-[var(--ds-background-100)]">
        <div className="text-copy-14 text-[var(--ds-gray-600)]">Loading shared setlist…</div>
      </div>
    );
  }

  if (state.status !== 'ready') {
    const gone = state.status === 'gone';
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-6 bg-[var(--ds-background-100)]">
        <div className="max-w-sm text-center flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-[var(--ds-gray-100)] border border-[var(--ds-gray-300)] flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--ds-gray-600)]">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-heading-20 text-[var(--ds-gray-1000)] m-0">
            {gone ? 'This link has expired' : 'Setlist not found'}
          </h1>
          <p className="text-copy-14 text-[var(--ds-gray-600)] m-0">
            {gone
              ? 'The person who shared it may have set it to expire or revoked it.'
              : 'The link may be mistyped or no longer available.'}
          </p>
          <Button variant="brand" onClick={onExit}>Open Setlists.md</Button>
        </div>
      </div>
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
