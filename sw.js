const CACHE = 'putt-tracker-v10';

const APP_SHELL = [
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

// Install
self.addEventListener('install', event => {

  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
  );

  self.skipWaiting();

});

// Activate
self.addEventListener('activate', event => {

  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );

});

// Fetch
self.addEventListener('fetch', event => {

  if (event.request.method !== 'GET') return;

  const request = event.request;

  //
  // HTML / Navigation
  // Always try the network first so new deployments are picked up quickly.
  //
  if (request.mode === 'navigate') {

    event.respondWith(

      fetch(request)
        .then(response => {

          const copy = response.clone();

          caches.open(CACHE).then(cache => {
            cache.put('./index.html', copy);
          });

          return response;

        })
        .catch(async () => {

          return (
            await caches.match('./index.html')
            || Response.error()
          );

        })

    );

    return;

  }

  //
  // Everything else
  // Serve cache immediately while refreshing in the background.
  //
  event.respondWith(

    caches.match(request).then(cached => {

      const networkFetch = fetch(request)
        .then(response => {

          if (
            response.ok &&
            request.url.startsWith(self.location.origin)
          ) {

            caches.open(CACHE).then(cache => {
              cache.put(request, response.clone());
            });

          }

          return response;

        })
        .catch(() => cached);

      return cached || networkFetch;

    })

  );

});