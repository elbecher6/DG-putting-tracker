const CACHE = 'putt-tracker-v9';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './storage.js',
  './nav.js',
  './practice.js',
  './round.js',
  './stats.js',
  './sessions.js',
  './more.js',
  './app.js',
  './manifest.json',
  './DG-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .catch(err => console.warn('SW cache addAll failed', err))
  );
  // Take over immediately without waiting for old tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    // Delete all old caches, then force-reload any open tabs so they
    // immediately get the new files rather than waiting for a manual refresh
    caches.keys()
      .then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => clients.forEach(client => client.navigate(client.url)))
  );
});

self.addEventListener('fetch', e => {
  // Only handle GET requests; let everything else pass through normally
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        // Cache a copy of newly-fetched same-origin files for next time offline
        if (response.ok && e.request.url.startsWith(self.location.origin)) {
          const copy = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return response;
      }).catch(() => {
        // Offline and not cached — for navigations, fall back to the cached app shell
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        throw new Error('Offline and not cached');
      });
    })
  );
});