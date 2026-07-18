import { Button } from './ui/Button';

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);
const DismissIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// The notification list, shared by the dropdown tray and the full-page view so
// item rendering + actions never drift. `onAfterAction` lets the tray close
// itself after a tap/accept/decline while the page stays put (no-op).
export default function NotificationItems({
  notifications = [],
  onMarkRead,
  onAction,
  onUpdateSchedule,
  onDismiss,
  onAfterAction = () => {},
  emptyLabel = 'No notifications yet.',
}) {
  if (notifications.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <p className="text-copy-14 text-[var(--ds-gray-600)] m-0">{emptyLabel}</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-[var(--ds-gray-200)]">
      {notifications.map(notification => (
        <div
          key={notification.id}
          onClick={() => {
            if (!notification.read) onMarkRead?.(notification.id);
            if (notification.action) onAction?.(notification.action);
            if (notification.type !== 'schedule_request') onAfterAction();
          }}
          className={`w-full text-left px-5 py-4 bg-transparent border-none ${notification.type !== 'schedule_request' && notification.action ? 'cursor-pointer hover:bg-[var(--ds-gray-100)]' : ''} transition-colors flex items-start gap-3 ${
            !notification.read ? 'bg-[var(--color-brand-soft)]' : ''
          }`}
        >
          <div className="pt-1.5 shrink-0">
            <span className={`block w-2 h-2 rounded-full ${!notification.read ? 'bg-[var(--color-brand)]' : 'bg-transparent'}`} />
          </div>

          <div className="flex-1 min-w-0 flex flex-col">
            <p className={`text-copy-14 m-0 ${!notification.read ? 'font-semibold text-[var(--ds-gray-1000)]' : 'text-[var(--ds-gray-900)]'}`}>
              {notification.title}
            </p>
            <p className="text-copy-13 text-[var(--ds-gray-600)] m-0 mt-1 leading-relaxed">
              {notification.message}
            </p>

            {notification.type === 'schedule_request' && (
              <div className="flex gap-2 mt-3 w-full">
                <Button
                  size="sm"
                  className="flex-1 bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)] border-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateSchedule?.(notification.scheduleId, { availability: 'available' });
                    onAfterAction();
                  }}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 bg-[var(--bg-1)] border-[var(--border-1)] text-[var(--text-1)] hover:bg-[var(--bg-2)]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateSchedule?.(notification.scheduleId, { availability: 'unavailable' });
                    onAfterAction();
                  }}
                >
                  Decline
                </Button>
              </div>
            )}
          </div>

          {notification.type !== 'schedule_request' && onDismiss ? (
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss(notification.id); }}
              aria-label="Dismiss notification"
              className="shrink-0 -mt-1 -mr-1 p-1.5 rounded-lg bg-transparent border-none cursor-pointer text-[var(--ds-gray-500)] hover:bg-[var(--ds-gray-200)] hover:text-[var(--ds-gray-1000)] transition-colors"
            >
              <DismissIcon />
            </button>
          ) : notification.action && notification.type !== 'schedule_request' && (
            <div className="shrink-0 pt-1 text-[var(--ds-gray-500)]">
              <ArrowIcon />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
