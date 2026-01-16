// Service Worker for Furbank ERP PWA
// Version-based cache invalidation
const CACHE_VERSION = 'v1';
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;
const STATIC_ASSETS_CACHE = `static-assets-${CACHE_VERSION}`;
const API_CACHE = `api-cache-${CACHE_VERSION}`;

// Assets to cache on install (app shell)
const APP_SHELL_ASSETS = [
  '/',
  '/dashboard',
  '/index.html',
];

// Never cache these patterns
const NEVER_CACHE_PATTERNS = [
  /\/auth\/v1\//,
  /\/storage\/v1\/.*upload/,
  /\/functions\/v1\//,
];

// Check if request should never be cached
function shouldNeverCache(url) {
  return NEVER_CACHE_PATTERNS.some(pattern => pattern.test(url));
}

// Check if request has auth token (should not cache)
function hasAuthToken(request) {
  return request.headers.get('Authorization')?.startsWith('Bearer ');
}

// Check if request is a write operation
function isWriteOperation(request) {
  return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method);
}

// Install event - cache app shell
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => {
      console.log('[SW] Caching app shell');
      return cache.addAll(APP_SHELL_ASSETS).catch((err) => {
        console.warn('[SW] Failed to cache some app shell assets:', err);
      });
    })
  );
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            // Delete old cache versions
            return (
              name.startsWith('app-shell-') ||
              name.startsWith('static-assets-') ||
              name.startsWith('api-cache-')
            ) && !name.includes(CACHE_VERSION);
          })
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all clients immediately
  return self.clients.claim();
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (except for app shell)
  if (isWriteOperation(request) && !APP_SHELL_ASSETS.includes(url.pathname)) {
    return; // Let network handle write operations
  }

  // Never cache auth, storage uploads, or edge functions
  if (shouldNeverCache(url.href)) {
    return; // Pass through to network
  }

  // Never cache requests with auth tokens
  if (hasAuthToken(request)) {
    // For authenticated requests, use network-first but don't cache
    event.respondWith(
      fetch(request).catch(() => {
        // If network fails, don't serve from cache for auth requests
        return new Response('Network error', { status: 503 });
      })
    );
    return;
  }

  // Static assets - Cache First strategy
  if (
    url.origin === self.location.origin &&
    (request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'image' ||
      request.destination === 'font' ||
      url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/))
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((response) => {
          // Only cache successful responses
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(STATIC_ASSETS_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML/App Shell - Stale While Revalidate
  if (
    url.origin === self.location.origin &&
    (request.destination === 'document' || request.mode === 'navigate')
  ) {
    event.respondWith(
      caches.open(APP_SHELL_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          // Start fetching fresh content in background
          const fetchPromise = fetch(request)
            .then((response) => {
              // Only cache successful responses
              if (response.status === 200) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => {
              // Network failed, return cached if available
              return cachedResponse ?? new Response('Offline', { status: 503 });
            });

          // Return cached immediately if available, otherwise wait for network
          return cachedResponse ?? fetchPromise;
        });
      })
    );
    return;
  }

  // Supabase API calls - Network First strategy
  if (url.href.includes('/rest/v1/') || url.href.includes('/storage/v1/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful GET requests
          if (response.status === 200 && request.method === 'GET' && !hasAuthToken(request)) {
            const responseToCache = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed, try cache for GET requests only
          if (request.method === 'GET') {
            return caches.match(request).then((cachedResponse) => {
              if (cachedResponse) {
                // Add header to indicate this is cached data
                const headers = new Headers(cachedResponse.headers);
                headers.set('X-Cached-Data', 'true');
                return new Response(cachedResponse.body, {
                  status: cachedResponse.status,
                  statusText: cachedResponse.statusText,
                  headers: headers,
                });
              }
              return new Response('Network error', { status: 503 });
            });
          }
          return new Response('Network error', { status: 503 });
        })
    );
    return;
  }

  // Default: Network only (for other requests)
  event.respondWith(fetch(request));
});

// Message handler for cache clearing
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[SW] Clearing all caches...');
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          console.log('[SW] Deleting cache:', name);
          return caches.delete(name);
        })
      );
    }).then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
