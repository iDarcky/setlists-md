import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Toaster } from 'sileo';
import { setToastHost } from './toast';

// The one Sileo toaster, mounted once in App. Bottom right; below 1024px the
// nav pill is at the bottom, so it sits above it. It lives in a manual popover
// (top layer) so a toast shows even over a phone sheet (a native <dialog>).
// Calls go through ./toast.js. Styles: `.app-toaster` in styles/index.css.

const WIDE = '(min-width: 1024px)';
const subscribeWide = (cb) => {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
const getWide = () => window.matchMedia(WIDE).matches;

/** Mounted once in App. */
export default function AppToaster() {
  const ref = useRef(null);
  const wide = useSyncExternalStore(subscribeWide, getWide, () => true);
  useEffect(() => {
    const el = ref.current;
    setToastHost(el);
    try { el?.showPopover?.(); } catch { /* already open */ }
    return () => setToastHost(null);
  }, []);

  // Sileo opens a toast on mouse hover; a tap on a phone opens it too, and a
  // tap anywhere else closes it (same as the update pill).
  useEffect(() => {
    const onDown = (e) => {
      const open = ref.current?.querySelector('[data-sileo-toast][data-expanded="true"]');
      if (open && !open.contains(e.target)) {
        open.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, []);
  const openOnTap = (e) => {
    if (e.target.closest('[data-sileo-button]')) return;
    const t = e.target.closest('[data-sileo-toast]');
    if (t && t.dataset.expanded !== 'true') {
      t.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
    }
  };

  return (
    <div ref={ref} popover="manual" onClickCapture={openOnTap}
      className="app-toaster m-0 size-0 overflow-visible border-0 bg-transparent p-0">
      <Toaster position="bottom-right"
        offset={{ right: 12, bottom: wide ? 12 : 'calc(88px + env(safe-area-inset-bottom, 0px))' }} />
    </div>
  );
}
