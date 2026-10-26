import { useMemo, useState } from 'react';
import { useTeam } from '@/auth/useTeam';
import { usePushSubscription } from '@/push/usePushSubscription';
import { buildNotifs } from '@/lib/notifData';
import NotificationsPanel from './NotificationsPanel';

// What the bell opens (AppTopBar `notifications.content`). Wires the panel to
// the feed, the Space's join requests, schedule answers and this device's push.
export default function NotificationsBell({
  feed, schedules, setlists, matchesSetlistId, settings, setSettings,
  onUpdateSchedule, onMarkRead, onMarkAllRead, onOpenSetlist, onSettings, onClose,
}) {
  const { joinRequests = [], approveJoinRequest, declineJoinRequest } = useTeam();
  const push = usePushSubscription();
  // Read once per opening: the panel mounts each time the bell opens.
  const [now] = useState(() => Date.now());
  const data = useMemo(
    () => buildNotifs({ feed, joinRequests, schedules, setlists, matchesSetlistId, now }),
    [feed, joinRequests, schedules, setlists, matchesSetlistId, now],
  );
  // Device-local, like the rest of the notification state.
  const dismissPush = () => setSettings(prev => ({ ...prev, pushCardDismissed: true }));
  const showPush = push.supported && !push.subscribed && !push.denied && !settings?.pushCardDismissed;

  return (
    <NotificationsPanel
      data={data}
      now={now}
      push={{ show: showPush, onEnable: push.enable, onDismiss: dismissPush }}
      onMarkAllRead={onMarkAllRead}
      onAnswer={(it, status) => onUpdateSchedule?.(it.scheduleId, { availability: status })}
      onApprove={approveJoinRequest ? (it) => approveJoinRequest(it.requestId) : undefined}
      onDecline={declineJoinRequest ? (it) => declineJoinRequest(it.requestId) : undefined}
      onOpen={(it) => {
        if (it.unread && it.sourceId) onMarkRead?.(it.sourceId);
        const sl = it.setlistId && matchesSetlistId ? setlists.find(s => matchesSetlistId(s, it.setlistId)) : null;
        if (sl) { onClose?.(); onOpenSetlist?.(sl); }
      }}
      onSettings={onSettings ? () => { onClose?.(); onSettings(); } : undefined}
    />
  );
}
