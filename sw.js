/* Baltic Voyage — service worker
   The app shell is cached for offline use. The HTML is fetched network-first so
   new versions appear immediately when online; other assets stay cache-first.
   On activation the new worker reloads open windows so updates apply at once. */
const CACHE = 'baltic-voyage-v15';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(cs => cs.forEach(c => { try { c.navigate(c.url); } catch (e) {} }))
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never cache live APIs — always go to the network.
  if (/open-meteo\.com|er-api\.com/.test(url.hostname)) {
    e.respondWith(fetch(req).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  if (url.origin === location.origin) {
    const isHTML = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
    if (isHTML) {
      // Network-first for the shell HTML so updates land immediately when online.
      e.respondWith(
        fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          return res;
        }).catch(() => caches.match(req).then(h => h || caches.match('./index.html')))
      );
    } else {
      // Cache-first for other same-origin assets (icons, manifest).
      e.respondWith(
        caches.match(req).then(hit => hit || fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          return res;
        }).catch(() => caches.match('./index.html')))
      );
    }
    return;
  }

  // Cross-origin (fonts, leaflet, map tiles): stale-while-revalidate.
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
