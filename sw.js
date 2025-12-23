self.addEventListener('install', function(e) {
  console.log('Kuwait Zoo App Installed');
});

self.addEventListener('fetch', function(e) {
  // Basic fetch handling
  e.respondWith(fetch(e.request));
});
