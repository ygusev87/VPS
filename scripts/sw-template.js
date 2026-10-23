// Offline support: keeps a copy of every file of the game on the device.
// Generated into dist/sw.js at build time (see vite.config.ts) with the file
// list and a version; a new build means a new version and a fresh copy.
const VERSION = '__VERSION__';
const FILES = __FILES__;
const CACHE = `electro-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(['./', ...FILES]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('electro-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // The page itself: fresh from the network when online, the saved copy
    // otherwise — and on a weak connection after 3 s rather than a long wait.
    const saved = () => caches.match('./', { cacheName: CACHE });
    const slow = new Promise((resolve) => setTimeout(resolve, 3000)).then(saved);
    event.respondWith(Promise.race([fetch(req).catch(saved), slow]).then((res) => res ?? fetch(req)));
    return;
  }
  // Everything else (scripts, models, voice) from the saved copy first.
  event.respondWith(caches.match(req, { cacheName: CACHE }).then((hit) => hit ?? fetch(req)));
});
