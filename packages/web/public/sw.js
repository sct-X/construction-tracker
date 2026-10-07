// Clean-up worker. The old five-person prototype on this site registered a
// service worker at this path (scope /construction-tracker/) that cached the
// app for offline use. This app registers no worker. Browsers that still have
// the old one check this file for updates, install this version, and it then
// deletes every cache, unregisters itself and reloads open tabs, so they load
// the current app from the network. Nothing here caches or intercepts fetches.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        await self.clients.claim();
      } catch {
        // Not fatal: clean up anyway.
      }
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const tabs = await self.clients.matchAll({ type: 'window' });
      await Promise.all(tabs.map((tab) => tab.navigate(tab.url).catch(() => undefined)));
    })(),
  );
});
