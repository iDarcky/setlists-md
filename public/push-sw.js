// Web Push handlers, importScripts'd into the generated Workbox service
// worker (see vite.config.js). Payloads are produced by the notify-worker
// edge function: { title, body, tag, url }.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'setlists.md', {
      body: data.body || '',
      tag: data.tag || undefined, // same tag replaces, so re-pushes don't stack
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus an existing app window if one is open; otherwise open one.
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          if (url !== '/' && 'navigate' in client) client.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
