// Retires the app's old offline copy on this address.
//
// The app lived on setlists.md until it moved to app.setlists.md. Every
// browser that used it here still has its service worker, which answers every
// page load from its own cache, so those people would keep seeing the old app
// instead of this website. Browsers check /sw.js for updates; this file is
// that "update". It clears the caches, unregisters itself and reloads open
// tabs, so the next load comes from the website. On-device data (IndexedDB,
// localStorage) is not touched.
//
// Nothing on the website registers this worker. It only replaces an existing one.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const tabs = await self.clients.matchAll({ type: 'window' });
    for (const tab of tabs) {
      try { tab.navigate(tab.url); } catch { /* tab already gone */ }
    }
  })());
});
