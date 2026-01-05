// service-worker.js - Enhanced Service Worker
const CACHE_VERSION = 'v2.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;

const OFFLINE_URL = 'offline.html';

// Static assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/script.js',
    '/offline-storage.js',
    '/cache-controller.js',
    '/offline-manager.js',
    '/manifest.json',
    '/offline.html',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Roboto:wght@300;400;500&display=swap'
];

// Install event
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing...');

    event.waitUntil(
        Promise.all([
            // Cache static assets
            caches.open(STATIC_CACHE)
            .then(cache => cache.addAll(STATIC_ASSETS)),

            // Skip waiting to activate immediately
            self.skipWaiting()
        ])
        .then(() => {
            console.log('[Service Worker] Installation complete');
        })
    );
});

// Activate event
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating...');

    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (![STATIC_CACHE, API_CACHE, IMAGE_CACHE].includes(cacheName)) {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),

            // Claim clients
            self.clients.claim()
        ])
        .then(() => {
            console.log('[Service Worker] Activation complete');

            // Send message to all clients
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SW_ACTIVATED',
                        version: CACHE_VERSION
                    });
                });
            });
        })
    );
});

// Fetch event with enhanced strategies
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests and chrome-extension requests
    if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
        return;
    }

    // Handle different types of requests with different strategies
    if (url.hostname === 'api.currentsapi.services') {
        event.respondWith(apiFirstStrategy(event));
    } else if (isImageRequest(request)) {
        event.respondWith(imageStrategy(event));
    } else if (isStaticAsset(request)) {
        event.respondWith(cacheFirstStrategy(event));
    } else {
        event.respondWith(networkFirstStrategy(event));
    }
});

// API-first strategy: Try network first, then cache
async function apiFirstStrategy(event) {
    const { request } = event;
    const cache = await caches.open(API_CACHE);

    try {
        // Try network first
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            // Cache the successful response
            const responseToCache = networkResponse.clone();
            cache.put(request, responseToCache);
            console.log('[Service Worker] API cached:', request.url);
            return networkResponse;
        }

        throw new Error('Network response not ok');
    } catch (error) {
        console.log('[Service Worker] Network failed, trying cache:', request.url);

        // Try cache
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
            console.log('[Service Worker] Serving cached API:', request.url);
            return cachedResponse;
        }

        // No cache available, return error
        return new Response(JSON.stringify({
            status: 'error',
            message: 'You are offline and no cached data available.'
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Image strategy: Cache first, then network
async function imageStrategy(event) {
    const { request } = event;
    const cache = await caches.open(IMAGE_CACHE);

    // Try cache first
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
        console.log('[Service Worker] Serving cached image:', request.url);
        return cachedResponse;
    }

    try {
        // Try network
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            // Cache the image for future use
            const responseToCache = networkResponse.clone();
            cache.put(request, responseToCache);
            console.log('[Service Worker] Image cached:', request.url);
        }

        return networkResponse;
    } catch (error) {
        console.log('[Service Worker] Image fetch failed:', request.url);

        // Return a placeholder image or error
        return new Response(
            `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
                <rect width="400" height="300" fill="#f3f4f6"/>
                <text x="200" y="150" text-anchor="middle" font-family="Arial" font-size="16" fill="#6b7280">
                    Image not available offline
                </text>
            </svg>`, {
                headers: { 'Content-Type': 'image/svg+xml' }
            }
        );
    }
}

// Cache-first strategy for static assets
async function cacheFirstStrategy(event) {
    const { request } = event;
    const cache = await caches.open(STATIC_CACHE);

    // Try cache first
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
        console.log('[Service Worker] Serving cached static:', request.url);
        return cachedResponse;
    }

    // Try network
    try {
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            // Don't cache non-static assets
            if (isStaticAsset(request)) {
                const responseToCache = networkResponse.clone();
                cache.put(request, responseToCache);
            }
        }

        return networkResponse;
    } catch (error) {
        console.log('[Service Worker] Static asset fetch failed:', request.url);

        // If it's a navigation request, show offline page
        if (request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
        }

        return new Response('Offline - content not available', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// Network-first strategy for other requests
async function networkFirstStrategy(event) {
    const { request } = event;

    try {
        // Try network first
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            // Cache successful responses
            const cache = await caches.open(STATIC_CACHE);
            const responseToCache = networkResponse.clone();
            cache.put(request, responseToCache);
        }

        return networkResponse;
    } catch (error) {
        console.log('[Service Worker] Network failed, trying cache:', request.url);

        // Try cache
        const cache = await caches.open(STATIC_CACHE);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        // If it's a navigation request, show offline page
        if (request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
        }

        return new Response('Offline - content not available', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// Helper functions
function isImageRequest(request) {
    const url = new URL(request.url);
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.pathname) ||
        url.hostname.includes('unsplash.com') ||
        url.hostname.includes('images.unsplash.com');
}

function isStaticAsset(request) {
    const url = new URL(request.url);
    return url.origin === self.location.origin ||
        url.hostname === 'cdnjs.cloudflare.com' ||
        url.hostname === 'fonts.googleapis.com' ||
        url.hostname === 'fonts.gstatic.com';
}

// Background sync
self.addEventListener('sync', event => {
    if (event.tag === 'sync-news') {
        console.log('[Service Worker] Background sync triggered');

        event.waitUntil(
            syncNewsData()
            .then(() => {
                console.log('[Service Worker] Background sync completed');

                // Notify clients
                self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'BACKGROUND_SYNC_COMPLETED'
                        });
                    });
                });
            })
            .catch(error => {
                console.error('[Service Worker] Background sync failed:', error);
            })
        );
    }
});

// Periodic sync (if supported)
self.addEventListener('periodicsync', event => {
    if (event.tag === 'news-update') {
        console.log('[Service Worker] Periodic sync triggered');

        event.waitUntil(
            updateNewsCache()
            .then(() => {
                console.log('[Service Worker] Periodic sync completed');
            })
            .catch(error => {
                console.error('[Service Worker] Periodic sync failed:', error);
            })
        );
    }
});

// Push notifications
self.addEventListener('push', event => {
    console.log('[Service Worker] Push notification received');

    const options = {
        body: event.data ? event.data.text() : 'New news articles available!',
        icon: 'https://img.icons8.com/color/96/000000/news.png',
        badge: 'https://img.icons8.com/color/72/000000/news.png',
        vibrate: [100, 50, 100],
        data: {
            url: '/',
            timestamp: Date.now()
        },
        actions: [{
                action: 'read',
                title: 'Read Now',
                icon: 'https://img.icons8.com/color/96/000000/news.png'
            },
            {
                action: 'dismiss',
                title: 'Dismiss',
                icon: 'https://img.icons8.com/color/96/000000/close.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('Currents News', options)
    );
});

self.addEventListener('notificationclick', event => {
    console.log('[Service Worker] Notification click:', event.notification);
    event.notification.close();

    if (event.action === 'read') {
        event.waitUntil(
            clients.openWindow('/')
        );
    } else if (event.action === 'dismiss') {
        // Do nothing
    } else {
        // Default action - open the app
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                for (const client of windowClients) {
                    if (client.url.includes('/') && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
        );
    }
});

// Message handler
self.addEventListener('message', event => {
    const { data } = event;

    switch (data.type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;

        case 'UPDATE_CACHE':
            updateNewsCache();
            break;

        case 'CLEAR_CACHE':
            clearOldCache();
            break;
    }
});

// Cache update functions
async function syncNewsData() {
    // This would sync offline actions with the server
    // For now, just update the cache
    return updateNewsCache();
}

async function updateNewsCache() {
    console.log('[Service Worker] Updating news cache...');

    // This would fetch latest news and update cache
    // For now, just clean old cache
    return cleanOldCache();
}

async function cleanOldCache() {
    const cache = await caches.open(API_CACHE);
    const requests = await cache.keys();
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
            const cachedTime = response.headers.get('sw-cached-timestamp');
            if (cachedTime && parseInt(cachedTime) < oneHourAgo) {
                await cache.delete(request);
                console.log('[Service Worker] Deleted old cache:', request.url);
            }
        }
    }
}

async function clearOldCache() {
    const cacheNames = await caches.keys();

    for (const cacheName of cacheNames) {
        if (cacheName.startsWith('currents-') &&
            !cacheName.includes(CACHE_VERSION)) {
            await caches.delete(cacheName);
            console.log('[Service Worker] Deleted old cache:', cacheName);
        }
    }
}