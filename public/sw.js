/* Construction Tracker service worker.
 * Plain JS, no build step. Served from the sub-path, so every URL is built
 * from the registration scope rather than the origin root.
 *
 * Strategy:
 *  - install: fetch the app shell (index.html), find the hashed assets it
 *    references, and precache shell + assets + manifest + icons.
 *  - navigation requests: network first, fall back to the cached shell.
 *  - hashed assets (/assets/): cache first, then network (and cache it).
 *  - everything else same-origin: network, fall back to cache.
 */
const VERSION = 'ct-shell-v1';
const SCOPE = self.registration.scope; // e.g. https://host/construction-tracker/
const SHELL_URL = new URL('./', SCOPE).href;
const STATIC = ['./manifest.webmanifest', './icons/icon.svg', './icons/icon-maskable.svg'].map(
  (p) => new URL(p, SCOPE).href,
);

async function precache() {
  const cache = await caches.open(VERSION);
  const shellResponse = await fetch(SHELL_URL, { cache: 'no-cache' });
  if (!shellResponse.ok) throw new Error('shell fetch failed');
  const html = await shellResponse.clone().text();
  await cache.put(SHELL_URL, shellResponse);
  const assetUrls = new Set();
  const re = /(?:src|href)="([^"]+\/assets\/[^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) assetUrls.add(new URL(m[1], SCOPE).href);
  const all = [...assetUrls, ...STATIC];
  await Promise.all(
    all.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (res.ok) await cache.put(url, res);
      } catch (_) {
        /* a missing optional file must not fail the install */
      }
    }),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.href.startsWith(SCOPE)) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(async (res) => {
          const cache = await caches.open(VERSION);
          cache.put(SHELL_URL, res.clone());
          return res;
        })
        .catch(async () => (await caches.match(SHELL_URL)) || Response.error()),
    );
    return;
  }

  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then(async (res) => {
            if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
            return res;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then(async (res) => {
        if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
        return res;
      })
      .catch(async () => (await caches.match(req)) || Response.error()),
  );
});
