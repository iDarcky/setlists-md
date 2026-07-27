import { useEffect, useState, lazy, Suspense } from 'react';
import { fetchSharedSetlist } from '@/share/setlistShare';
import { Button } from '@/ui/Button';

const SetlistOverview = lazy(() => import('@/features/setlist-viewer/SetlistOverview'));
const SetlistPlayer = lazy(() => import('@/features/performance/SetlistPlayer'));

// Public, read-only viewer for a shared setlist link (`/?setlist=<token>`).
// Renders without auth or the user's local library — everything comes from the
// frozen snapshot stored under the token. Expired/missing links show a notice.
export default function SharedSetlistViewer({ token, onExit }) {
  const [state, setState] = useState({ status: 'loading', data: null });
  const [playing, setPlaying] = useState(false);

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

  // Play Live: a public, read-only live player over the frozen snapshot. No
  // practice mode, no app shell — just the live chart navigation.
  if (playing) {
    return (
      <Suspense fallback={<div className="min-h-[100dvh] bg-[var(--ds-background-100)]" />}>
        <SetlistPlayer
          setlist={setlist}
          songs={songs || []}
          onBack={() => setPlaying(false)}
          onFinish={() => setPlaying(false)}
        />
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
          <Button variant="brand" size="sm" onClick={() => setPlaying(true)}>Play Live</Button>
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
