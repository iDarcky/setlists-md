import { useCallback } from 'react';

/**
 * The notification feed.
 *
 * Three sources are merged into one list:
 *
 *   1. VIRTUAL prompts derived live from schedules — "you've been scheduled"
 *      and the "still a maybe?" nudge. These are the interactive ones
 *      (Accept / Decline).
 *   2. SERVER rows from team_notifications, written by DB triggers and the
 *      notify-worker. They exist to reach lock screens via web push and to
 *      carry read state across devices.
 *   3. LOCAL rows stored in settings.notifications (device-local).
 *
 * The subtle part is (2) vs (1): a server row is SUPPRESSED while a live
 * virtual prompt covers the same schedule, and once the schedule is resolved.
 * Without that, every scheduling request renders twice — once as a prompt you
 * can act on, once as a dead copy of the same sentence.
 */
export function useNotificationFeed({
  schedules,
  setlists,
  members,
  teamNotifications,
  user,
  settings,
  setSettings,
  matchesSetlistId,
  markTeamNotifRead,
  dismissTeamNotif,
  dismissAllTeamNotifs,
}) {
  // Notification system
  const handleMarkNotificationRead = useCallback((notifId) => {
    if (typeof notifId === 'string' && notifId.startsWith('tn-')) {
      markTeamNotifRead(notifId.slice(3));
      return;
    }
    setSettings(prev => ({
      ...prev,
      notifications: (prev.notifications || []).map(n =>
        n.id === notifId ? { ...n, read: true } : n
      ),
    }));
  }, [markTeamNotifRead, setSettings]);

  const handleNotificationAction = () => {
    // Actions are usually strings like "view_setlist_123" or similar
    // Actually the action might not have been implemented in previous iterations.
    // If we have an actionable notification, we can handle it here if it's not handled internally by the tray
  };

  // Dismiss a single notification: drop it from the stored list and remember
  // its id so derived (virtual) notifications stay dismissed too. The dismissed
  // set is device-local (not a PORTABLE_PREF_KEY) like `notifications` itself.
  const handleDismissNotification = useCallback((notifId) => {
    if (typeof notifId === 'string' && notifId.startsWith('tn-')) {
      dismissTeamNotif(notifId.slice(3));
      return;
    }
    setSettings(prev => ({
      ...prev,
      notifications: (prev.notifications || []).filter(n => n.id !== notifId),
      dismissedNotifications: [...new Set([...(prev.dismissedNotifications || []), notifId])],
    }));
  }, [dismissTeamNotif, setSettings]);

  // --- Compute Virtual Notifications ---
  // Pending schedules for the current user → "you've been scheduled" prompts.
  const pendingSchedules = schedules?.filter(s => s.user_id === user?.id && s.availability === 'pending') || [];
  const virtualNotifications = pendingSchedules.map(s => {
    const setlist = setlists.find(sl => matchesSetlistId(sl, s.setlist_id)) || { name: 'a setlist' };
    return {
      id: `schedule-${s.id}`,
      type: 'schedule_request',
      title: 'You have been scheduled!',
      message: `You are scheduled for "${setlist.name}"${s.role ? ` as ${s.role}` : ''}.`,
      read: false,
      scheduleId: s.id,
      setlistId: s.setlist_id,
    };
  });

  // Admins get notified when a member declines an UPCOMING setlist. Derived
  // client-side (no schema change): any 'unavailable' schedule for a future
  // setlist we can resolve locally. Dismissible; stays dismissed via the set.
  const todayStr = new Date().toISOString().slice(0, 10);
  const memberDisplayName = (uid) => {
    const m = (members || []).find(mm => mm.user_id === uid);
    return m?.profile?.display_name || m?.profile?.email || 'A member';
  };
  // Decline alerts are now server-authoritative: the DB trigger fans a row out
  // to every band manager (see 20260616_team_notifications.sql), so they land
  // even if this client never loaded that setlist, and read/dismiss persists
  // across devices. We enrich the generic server copy with locally-resolvable
  // names where possible, falling back to the row's stored body.
  const resolveSetlistName = (setlistId) =>
    setlists.find(sl => matchesSetlistId(sl, setlistId))?.name;

  // Nudge: a "maybe" on a setlist coming up within ~2 weeks → ask the user to
  // commit. Reuses the schedule_request Accept/Decline UI (Accept→available,
  // Decline→unavailable), so resolving it clears the maybe.
  const MAYBE_NUDGE_DAYS = 14;
  const maybeNudges = (schedules || [])
    .filter(s => s.user_id === user?.id && s.availability === 'maybe')
    .map(s => ({ s, setlist: setlists.find(sl => matchesSetlistId(sl, s.setlist_id)) }))
    .filter(({ setlist }) => {
      if (!setlist?.date) return false;
      const days = (new Date(`${setlist.date}T00:00:00`) - new Date(`${todayStr}T00:00:00`)) / 86400000;
      return days >= 0 && days <= MAYBE_NUDGE_DAYS;
    })
    .map(({ s, setlist }) => ({
      id: `maybe-${s.id}`,
      type: 'schedule_request',
      title: 'Still a maybe?',
      message: `"${setlist.name}" is coming up — confirm whether you can make it.`,
      read: false,
      scheduleId: s.id,
      setlistId: s.setlist_id,
    }));

  // Server schedule rows (schedule_request from the scheduling trigger,
  // schedule_maybe_nudge from the notify-worker) exist to reach LOCK SCREENS
  // via web push and to carry cross-device read state. In the tray, the
  // interactive virtual prompt above is the better rendering of the same fact
  // — so a server row is suppressed while a live prompt covers its schedule,
  // and once the schedule is resolved (stale request/nudge).
  const scheduleById = new Map((schedules || []).map(s => [s.id, s]));
  const virtualScheduleIds = new Set([
    ...pendingSchedules.map(s => s.id),
    ...maybeNudges.map(n => n.scheduleId),
  ]);
  const serverNotifications = (teamNotifications || [])
    .filter(n => {
      const sid = n.metadata?.schedule_id;
      if (!sid) return true;
      if (virtualScheduleIds.has(sid)) return false; // interactive prompt shown instead
      const sch = scheduleById.get(sid);
      if (n.type === 'schedule_request') return !(sch && sch.availability !== 'pending');
      if (n.type === 'schedule_maybe_nudge') return !(sch && sch.availability !== 'maybe');
      return true;
    })
    .map(n => {
      const meta = n.metadata || {};
      let message = n.body;
      if (n.type === 'schedule_decline') {
        const who = meta.declined_by ? memberDisplayName(meta.declined_by) : 'A team member';
        const name = resolveSetlistName(meta.setlist_id);
        message = name
          ? `${who} can't make "${name}"${meta.role ? ` (${meta.role})` : ''}.`
          : `${who} can't make a service${meta.role ? ` (${meta.role})` : ''}.`;
      }
      return {
        id: `tn-${n.id}`,
        type: n.type === 'schedule_request' || n.type === 'schedule_maybe_nudge' ? 'server_schedule_info' : n.type,
        title: n.title || 'Notification',
        message,
        read: !!n.read_at,
        scheduleId: meta.schedule_id,
        setlistId: meta.setlist_id,
      };
    });

  const dismissedNotifs = settings?.dismissedNotifications || [];
  const mergedNotifications = [
    ...virtualNotifications,
    ...maybeNudges,
    ...serverNotifications,
    ...(settings?.notifications || []),
  ].filter(n => !dismissedNotifs.includes(n.id));

  // Clear all dismissible notifications (schedule_request prompts stay — they
  // still need an Accept/Decline).
  const handleClearAllNotifications = () => {
    const ids = mergedNotifications.filter(n => n.type !== 'schedule_request').map(n => n.id);
    // Server-backed rows clear via the hook (persists across devices); the rest
    // go onto the device-local dismissed set.
    dismissAllTeamNotifs();
    const localIds = ids.filter(id => !id.startsWith('tn-'));
    if (localIds.length === 0) return;
    setSettings(prev => ({
      ...prev,
      notifications: (prev.notifications || []).filter(n => !localIds.includes(n.id)),
      dismissedNotifications: [...new Set([...(prev.dismissedNotifications || []), ...localIds])],
    }));
  };

  const hasUnreadNotifications = mergedNotifications.some(n => !n.read);

  // Mark every notification read (the notifications-view FAB action). Local
  // rows flip in one settings write; team rows go through the hook per id.
  const handleMarkAllNotificationsRead = () => {
    const teamUnread = mergedNotifications.filter(n => !n.read && n.id.startsWith('tn-'));
    teamUnread.forEach(n => markTeamNotifRead(n.id.slice(3)));
    setSettings(prev => ({
      ...prev,
      notifications: (prev.notifications || []).map(n => (n.read ? n : { ...n, read: true })),
    }));
  };

  return {
    notifications: mergedNotifications,
    hasUnread: hasUnreadNotifications,
    markRead: handleMarkNotificationRead,
    dismiss: handleDismissNotification,
    clearAll: handleClearAllNotifications,
    markAllRead: handleMarkAllNotificationsRead,
    onAction: handleNotificationAction,
  };
}
