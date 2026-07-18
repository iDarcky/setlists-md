import { useMemo, useState } from 'react';
import PageHeader from './ui/PageHeader';
import { Button } from './ui/Button';
import { usePushSubscription } from '../push/usePushSubscription';
import NotificationItems from './NotificationItems';

const SCHEDULE_TYPES = new Set([
  'schedule_request', 'schedule_maybe_nudge', 'schedule_reminder',
  'rehearsal_reminder', 'schedule_decline', 'roster_assigned',
]);
const isSchedule = (n) => SCHEDULE_TYPES.has(n.type) || (n.type || '').startsWith('schedule') || (n.type || '').startsWith('rehearsal');

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'schedule', label: 'Schedule' },
];

// Full-screen notifications view (the mobile bell opens this). Reuses
// NotificationItems so rows + actions match the desktop dropdown exactly.
export default function NotificationsPage({
  notifications = [],
  onBack,
  onMarkRead,
  onAction,
  onUpdateSchedule,
  onDismiss,
  onClearAll,
}) {
  const [tab, setTab] = useState('all');
  const push = usePushSubscription();

  const unreadCount = notifications.filter(n => !n.read).length;
  const dismissible = notifications.filter(n => n.type !== 'schedule_request');

  const filtered = useMemo(() => {
    if (tab === 'unread') return notifications.filter(n => !n.read);
    if (tab === 'schedule') return notifications.filter(isSchedule);
    return notifications;
  }, [notifications, tab]);

  const emptyLabel = tab === 'unread' ? "You're all caught up." : tab === 'schedule' ? 'No schedule notifications.' : 'No notifications yet.';

  return (
    <div data-theme-variant="modes" className="flex flex-col min-h-full">
      <PageHeader title="Notifications" onBack={onBack} />

      {/* Filter tabs */}
      <div className="px-3 pt-3">
        <div className="flex p-1 bg-[var(--ds-gray-100)] rounded-xl gap-1">
          {TABS.map(t => {
            const active = tab === t.key;
            const count = t.key === 'unread' ? unreadCount : 0;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 h-9 rounded-lg text-copy-13 font-medium transition-colors border-none cursor-pointer ${
                  active ? 'bg-[var(--ds-background-100)] text-[var(--ds-gray-1000)] shadow-sm' : 'bg-transparent text-[var(--ds-gray-600)]'
                }`}
              >
                {t.label}{count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Push opt-in */}
      {push.supported && !push.subscribed && !push.denied && (
        <div className="px-4 pt-3">
          <div className="modes-card p-4 flex items-center justify-between gap-3">
            <span className="text-copy-13 text-[var(--modes-text-muted)]">Get these on your lock screen.</span>
            <Button variant="brand" size="sm" loading={push.busy} onClick={() => push.enable()}>Turn on</Button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 mt-3">
        <NotificationItems
          notifications={filtered}
          onMarkRead={onMarkRead}
          onAction={onAction}
          onUpdateSchedule={onUpdateSchedule}
          onDismiss={onDismiss}
          onAfterAction={() => {}}
          emptyLabel={emptyLabel}
        />
      </div>

      {/* Footer actions */}
      {(unreadCount > 0 || dismissible.length > 0) && (
        <div className="sticky bottom-0 px-4 py-3 border-t border-[var(--ds-gray-200)] bg-[var(--ds-background-100)] flex gap-2" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
          {unreadCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => notifications.forEach(n => { if (!n.read) onMarkRead?.(n.id); })}
              className="flex-1"
            >
              Mark all as read
            </Button>
          )}
          {dismissible.length > 0 && onClearAll && (
            <Button variant="ghost" size="sm" onClick={onClearAll} className="flex-1">Clear all</Button>
          )}
        </div>
      )}
    </div>
  );
}
