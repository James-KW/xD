// Kuwait Zoo PWA Service Worker - Version 6.0.0
// Auto Update System for Vercel/GitHub

const SW_VERSION = '6.0.0';
const CACHE_NAME = `kuwait-zoo-${SW_VERSION}`;

// All files to cache - MUST match your GitHub structure
const CORE_FILES = [
  '/',
  '/index.html',
  '/zooinfo.html',
  '/admin-login.html',
  '/authorinfo.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&family=Italianno&family=Parisienne&family=Great+Vibes&family=Alex+Brush&display=swap'
];

// GitHub repo info for auto-update
const GITHUB_REPO = 'https://raw.githubusercontent.com/James-KW/Zoo-Dataa/main/';
const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes

// Install - Cache core files
self.addEventListener('install', event => {
  console.log(`⚡ Installing Service Worker v${SW_VERSION}`);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching core files...');
        return cache.addAll(CORE_FILES);
      })
      .then(() => {
        console.log('✅ Core files cached');
        return self.skipWaiting();
      })
      .catch(err => console.error('❌ Cache failed:', err))
  );
});

// Activate - Clean old caches
self.addEventListener('activate', event => {
  console.log(`🚀 Activating Service Worker v${SW_VERSION}`);
  
  event.waitUntil(
    caches.keys()
      .then(keys => {
        return Promise.all(
          keys.map(key => {
            if (key !== CACHE_NAME) {
              console.log(`🗑️ Removing old cache: ${key}`);
              return caches.delete(key);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker ready');
        return self.clients.claim();
      })
  );
  
  // Start auto-update check
  event.waitUntil(startAutoUpdate());
});

// Fetch with network-first strategy
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Skip non-GET and chrome-extension
  if (event.request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Handle HTML pages (always try network first)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Update cache with fresh content
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });
          return response;
        })
        .catch(() => {
          // Offline - serve from cache
          return caches.match(event.request)
            .then(cached => cached || caches.match('/index.html'));
        })
    );
    return;
  }
  
  // For other resources
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        // Return cached if available
        if (cached) return cached;
        
        // Fetch from network
        return fetch(event.request)
          .then(networkResponse => {
            // Cache successful responses
            if (networkResponse.ok) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, clone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Return fallback for failed requests
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Auto-update system
async function startAutoUpdate() {
  console.log('🔄 Starting auto-update system...');
  
  // Check for updates immediately
  await checkForUpdates();
  
  // Schedule periodic checks
  setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL);
  
  // Also check when coming online
  self.addEventListener('online', checkForUpdates);
}

// Check GitHub for updates
async function checkForUpdates() {
  try {
    console.log('🔍 Checking for updates on GitHub...');
    
    // Check multiple files for changes
    const filesToCheck = [
      'index.html',
      'zooinfo.html',
      'admin-login.html',
      'authorinfo.html'
    ];
    
    let hasUpdates = false;
    
    for (const file of filesToCheck) {
      const needsUpdate = await checkFileForUpdate(file);
      if (needsUpdate) {
        hasUpdates = true;
        console.log(`📄 Update found for: ${file}`);
      }
    }
    
    if (hasUpdates) {
      console.log('🔄 Updates available, refreshing caches...');
      await refreshCaches();
      notifyClientsAboutUpdate();
    } else {
      console.log('✅ All files up-to-date');
    }
    
  } catch (error) {
    console.error('❌ Update check failed:', error);
  }
}

// Check if a file has changed on GitHub
async function checkFileForUpdate(filename) {
  try {
    // Get current cached version
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(`/${filename}`);
    
    if (!cachedResponse) {
      console.log(`⚠️ ${filename} not in cache, will fetch`);
      return true;
    }
    
    // Get GitHub version (with cache busting)
    const githubUrl = `${GITHUB_REPO}${filename}?t=${Date.now()}`;
    const response = await fetch(githubUrl, {
      headers: { 'Cache-Control': 'no-cache' }
    });
    
    if (!response.ok) {
      console.error(`❌ Failed to fetch ${filename} from GitHub`);
      return false;
    }
    
    const githubText = await response.text();
    const cachedText = await cachedResponse.text();
    
    // Compare content (simple hash)
    const githubHash = await hashString(githubText);
    const cachedHash = await hashString(cachedText);
    
    return githubHash !== cachedHash;
    
  } catch (error) {
    console.error(`❌ Error checking ${filename}:`, error);
    return false;
  }
}

// Refresh all caches from GitHub
async function refreshCaches() {
  try {
    console.log('🔄 Refreshing caches from GitHub...');
    
    const cache = await caches.open(CACHE_NAME);
    const updatePromises = [];
    
    // Refresh all HTML files
    const htmlFiles = [
      { url: '/', githubPath: 'index.html' },
      { url: '/index.html', githubPath: 'index.html' },
      { url: '/zooinfo.html', githubPath: 'zooinfo.html' },
      { url: '/admin-login.html', githubPath: 'admin-login.html' },
      { url: '/authorinfo.html', githubPath: 'authorinfo.html' }
    ];
    
    for (const file of htmlFiles) {
      const promise = fetchFromGitHub(file.githubPath)
        .then(response => {
          if (response) {
            return cache.put(file.url, response);
          }
        })
        .catch(err => {
          console.error(`❌ Failed to update ${file.url}:`, err);
        });
      
      updatePromises.push(promise);
    }
    
    await Promise.all(updatePromises);
    console.log('✅ Caches refreshed successfully');
    
  } catch (error) {
    console.error('❌ Cache refresh failed:', error);
  }
}

// Fetch file directly from GitHub
async function fetchFromGitHub(filepath) {
  try {
    const url = `${GITHUB_REPO}${filepath}?t=${Date.now()}`;
    const response = await fetch(url, {
      headers: { 'Cache-Control': 'no-cache' }
    });
    
    if (response.ok) {
      return response;
    }
    return null;
  } catch (error) {
    console.error(`❌ Failed to fetch ${filepath} from GitHub:`, error);
    return null;
  }
}

// Notify all clients about update
function notifyClientsAboutUpdate() {
  self.clients.matchAll()
    .then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'UPDATE_AVAILABLE',
          version: SW_VERSION,
          timestamp: Date.now()
        });
      });
    });
}

// Simple string hash function
async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Handle messages from clients
self.addEventListener('message', event => {
  const { data } = event;
  
  if (data.type === 'CHECK_FOR_UPDATES') {
    checkForUpdates().then(hasUpdate => {
      event.ports[0].postMessage({ hasUpdate });
    });
  }
  
  if (data.type === 'FORCE_UPDATE') {
    refreshCaches();
  }
  
  if (data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: SW_VERSION });
  }
});
