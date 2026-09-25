// ═══════════════════════════════════════════════════════════
//  مداد — Service Worker (PWA Offline Support)
// ═══════════════════════════════════════════════════════════

const CACHE_NAME = 'mdad-v1.0.2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './css/theme.css',
  './js/app.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap'
];

/* ── Install ─────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('📦 Caching assets...');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

/* ── Activate ────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch Strategy: Cache First, Network Fallback ────────── */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  // Skip external requests (Telegram, etc.)
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.startsWith('https://fonts.')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Return cached + update in background
        fetch(event.request)
          .then(response => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
            }
          })
          .catch(() => {});
        
        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) return response;
        
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        
        return response;
      }).catch(() => {
        // Offline fallback
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

/* ── Push Notifications (optional) ──────────────────────── */
self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'مداد للمعرفة والتعلم', {
      body: data.body || 'لديك رسالة جديدة',
      icon: './icons/icon-192.png',
      badge: './icons/badge-72.png',
      dir: 'rtl',
      lang: 'ar',
      vibrate: [100, 50, 100],
      data: { url: data.url || './' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || './')
  );
});
