import { useEffect, useRef } from 'react';
import { Button } from './ui/Button';
import { usePushSubscription } from '../push/usePushSubscription';
import NotificationItems from './NotificationItems';

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

export default function NotificationTray({ open, onClose, notifications = [], onMarkRead, onAction, onUpdateSchedule, onDismiss, onClearAll }) {
  const trayRef = useRef(null);
  // Per-device Web Push opt-in (no-op UI on unsupported browsers / guests).
  const push = usePushSubscription();

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (trayRef.current && !trayRef.current.contains(e.target)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [open, onClose]);

  if (!open) return null;

  const unreadCount = notifications.filter(n => !n.read).length;
  // schedule_request notifications resolve via Accept/Decline, so they're not
  // manually dismissible; everything else can be cleared.
  const dismissible = notifications.filter(n => n.type !== 'schedule_request');

  return (
    <>
      {/* Transparent click-away layer */}
      <div className="fixed inset-0 z-[199]" onClick={onClose} />

      {/* Dropdown anchored under the header bell on every breakpoint. */}
      <div
        ref={trayRef}
        className="
          fixed z-[200] w-[calc(100%-2rem)] max-w-[360px] rounded-2xl
          bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)]
          shadow-2xl flex flex-col overflow-hidden max-h-[70vh]
          top-[60px] right-4 left-auto sm:right-5
        "
        style={{
          top: 'calc(56px + env(safe-area-inset-top, 0px))',
          animation: 'notifSlideDown 0.15s ease-out'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--ds-gray-200)] shrink-0">
          <div className="flex items-center gap-2">
            <BellIcon />
            <h2 className="text-heading-16 text-[var(--ds-gray-1000)] m-0 font-semibold">Notifications</h2>
            {unreadCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-[var(--ds-red-600)] text-white text-label-12 font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-transparent border-none cursor-pointer text-[var(--ds-gray-600)] hover:bg-[var(--ds-gray-200)] hover:text-[var(--ds-gray-1000)] transition-colors"
            aria-label="Close notifications"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto">
          <NotificationItems
            notifications={notifications}
            onMarkRead={onMarkRead}
            onAction={onAction}
            onUpdateSchedule={onUpdateSchedule}
            onDismiss={onDismiss}
            onAfterAction={onClose}
          />
        </div>

        {/* Per-device push opt-in — shown until enabled. */}
        {push.supported && !push.subscribed && !push.denied && (
          <div className="px-5 py-3 border-t border-[var(--ds-gray-200)] shrink-0">
            <Button variant="secondary" size="sm" loading={push.busy} onClick={() => push.enable()} className="w-full">
              Enable push notifications on this device
            </Button>
          </div>
        )}

        {/* Footer: Mark all read + Clear all */}
        {(unreadCount > 0 || dismissible.length > 0) && (
          <div className="px-5 py-3 border-t border-[var(--ds-gray-200)] bg-[var(--ds-background-200)] shrink-0 flex gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { notifications.forEach(n => { if (!n.read) onMarkRead?.(n.id); }); }}
                className="flex-1 text-center text-[var(--color-brand)] hover:bg-[var(--color-brand-soft)]"
              >
                Mark all as read
              </Button>
            )}
            {dismissible.length > 0 && onClearAll && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearAll}
                className="flex-1 text-center text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)]"
              >
                Clear all
              </Button>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes notifSlideDown {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
