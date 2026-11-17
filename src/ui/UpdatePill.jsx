import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Toaster, sileo } from 'sileo';

// The green "Update available" pill (Sileo). Phone: the very top centre of
// the screen. iPad/desktop (640px and up, Tailwind's sm): bottom right, clear
// of the top bar's tabs (user, 14 Nov). Tap it (hover on desktop) and it opens to show Refresh. It can't be
// closed or swiped away. Loaded lazily by UpdatePrompt only when an update is
// waiting, so Sileo and its animation library cost nothing on a normal start.

// Brand success green (ds.css --success). Same in light and dark: the pill is
// the one message we want people to notice, so it is the only green toast.
const GREEN = '#357A4A';
let shown = 0;

const ArrowIcon = (
  <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" />
  </svg>
);

const WIDE = '(min-width: 640px)';
const subscribeWide = cb => {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
const getWide = () => window.matchMedia(WIDE).matches;

export default function UpdatePill({ onRefresh }) {
  // Kept in a ref so the pill is not re-created when the callback changes.
  const refreshRef = useRef(onRefresh);
  const wide = useSyncExternalStore(subscribeWide, getWide, () => false);
  const position = wide ? 'bottom-right' : 'top-center';
  useEffect(() => { refreshRef.current = onRefresh; }, [onRefresh]);

  // Mounted = shown, unmounted (left Home) = dismissed. Each showing gets its
  // own id: Sileo removes a dismissed id after its exit animation, which would
  // also take a pill re-shown under the same id straight away (back to Home
  // quickly, or React's dev double mount).
  useEffect(() => {
    const id = `app-update-${++shown}`;
    sileo.show({
      id,
      type: 'success',
      title: 'Update available',
      button: { title: 'Refresh', onClick: () => refreshRef.current?.() },
      icon: ArrowIcon,
      fill: GREEN,
      position,
      duration: null,
      autopilot: false,
    });
    return () => sileo.dismiss(id);
  }, [position]);

  // Sileo opens a toast on mouse hover only, which a finger on a phone does
  // not reliably send. So a tap on the pill opens it (Sileo listens for the
  // hover through React's mouseover), and a tap anywhere else closes it again.
  // The Refresh button is left alone.
  const wrapRef = useRef(null);
  useEffect(() => {
    const onDown = e => {
      const toast = wrapRef.current?.querySelector('[data-sileo-toast][data-expanded="true"]');
      if (toast && !toast.contains(e.target)) {
        toast.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, []);
  const openOnTap = e => {
    if (e.target.closest('[data-sileo-button]')) return;
    const toast = e.target.closest('[data-sileo-toast]');
    if (toast && toast.dataset.expanded !== 'true') {
      toast.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
    }
  };

  // Sileo dismisses a toast on a vertical swipe. Stopping pointerdown before it
  // reaches the toast keeps the pill on screen.
  // Styles: `.update-pill` in styles/index.css.
  return (
    <div ref={wrapRef} className="update-pill" onClickCapture={openOnTap} onPointerDownCapture={e => e.stopPropagation()}>
      <Toaster position={position} />
    </div>
  );
}
