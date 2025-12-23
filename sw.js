// sw.js - Updated for Direct PWA Installation
const CACHE_NAME = 'kuwait-zoo-direct-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/admin-login.html',
  '/authorinfo.html',
  '/zooinfo.htmm',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap'
];

// Enhanced install event
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[Service Worker] Skip waiting activated');
        return self.skipWaiting();
      })
  );
});

// Activate and clean old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Now ready to handle fetches');
      return self.clients.claim();
    })
  );
});

// Fetch handler with network-first strategy
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // For same-origin requests, try cache first
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request)
            .then(response => {
              // Cache the new response
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
              return response;
            })
            .catch(() => {
              // If fetch fails and no cache, return offline page
              if (event.request.destination === 'document') {
                return caches.match('/index.html');
              }
              return new Response('Offline', { 
                status: 503, 
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/plain' }
              });
            });
        })
    );
  } else {
    // For cross-origin requests, network first
    event.respondWith(fetch(event.request));
  }
});

// Handle messages from the page
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
