/**
 * Enhanced Service Worker for Veritas News PWA
 * Handles multiple cache strategies and offline functionality
 */

const CACHE_NAME = 'veritas-news-v2.0';
const STATIC_CACHE = 'veritas-static-v2.0';
const IMAGES_CACHE = 'veritas-images-v2.0';
const API_CACHE = 'veriAPI-v2.0';
const FALLBACK_PAGE = 'offline.html';

// Files to cache
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/script.js',
    '/offline-storage.js',
    '/cache-controller.js',
    '/offline-manager.js',
    '/manifest.json',
    '/404.html',
    '/offline.html',
    // External resources
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500&display=swap'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');

    event.waitUntil(
        caches.open(STATIC_CACHE)
        .then(cache => {
            console.log('Service Worker: Caching static assets');
            return cache.addAll(STATIC_ASSETS);
        })
        .then(() => {
            console.log('Service Worker: Installation complete');
            return self.skipWaiting();
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');

    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Delete old caches
                    if (cacheName !== CACHE_NAME &&
                        cacheName !== STATIC_CACHE &&
                        cacheName.includes('veritas-')) {
                        console.log('Service Worker: Clearing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
        .then(() => {
            console.log('Service Worker: Activation complete');
            return self.clients.claim();
        })
    );
});

// Fetch event - handle different types of requests
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip chrome-extension requests
    if (url.protocol === 'chrome-extension:') {
        return;
    }

    // Handle navigation requests (PWA routing)
    if (request.mode === 'navigate') {
        event.respondWith(handleNavigationRequest(event));
        return;
    }

    // Handle API requests
    if (url.hostname === 'api.currentsapi.services') {
        event.respondWith(handleApiRequest(event));
        return;
    }

    // Handle image requests
    if (request.destination === 'image') {
        event.respondWith(handleImageRequest(event));
        return;
    }

    // Default fetch handling
    event.respondWith(
        cacheFirstWithFallback(event.request)
    );
});

// Handle navigation requests with PWA routing
async function handleNavigationRequest(event) {
    const { request } = event;

    // Try to serve from cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        console.log('Service Worker: Serving navigation request from cache:', request.url);
        return cachedResponse;
    }

    // Try to fetch from network
    const networkResponse = await fetch(request);
    // Cache the response
    const cache = await caches.open(STATIC_CACHE);
    event.waitUntil(cache.put(request, networkResponse.clone()));

    return networkResponse;
}

// Handle API requests with cache strategies
async function handleApiRequest(event) {
    const { request } = event;

    // Try network first for API requests
    try {
        const networkResponse = await fetch(request);

        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(API_CACHE);
            cache.put(request, networkResponse.clone());
            return networkResponse;
        }

        return networkResponse;
    } catch (error) {
        console.log('Service Worker: API request failed, serving from cache');

        // Fall back to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // If no cache available, show offline page
        return caches.match('/offline.html');
    }
}

// Handle image requests with cache-first strategy
async function handleImageRequest(event) {
    const { request } = event;
    const cache = await caches.open(IMAGES_CACHE);

    // Try cache first
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        // Cache the image
        cache.put(request, networkResponse.clone());
        return networkResponse;
    } catch (error) {
        // Fall back to placeholder
        const offlineImage = await caches.match('/offline.html');
        return offlineImage;
    }
}

// Cache-first with network fallback
async function cacheFirstWithFallback(request) {
    const cache = await caches.open(STATIC_CACHE);

    // Try cache first
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        // Cache the successful response
        cache.put(request, networkResponse.clone());
        return networkResponse;
    } catch (error) {
        // Fallback to cache or offline page
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        return caches.match('/offline.html');
    }
}

// Handle background sync events
self.addEventListener('sync', event => {
    if (event.tag === 'sync-offline-actions') {
        console.log('Service Worker: Background sync triggered');
        event.waitUntil(handleBackgroundSync());
    }
});

async function handleBackgroundSync() {
    try {
        // This would handle syncing offline actions
        console.log('Service Worker: Processing offline actions');

        // Send message to main thread
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'SYNC_COMPLETED',
                    data: { status: 'success', message: 'Background sync completed' }
                });
            });
        });

    } catch (error) {
        console.error('Service Worker: Sync failed:', error);
    }
}

// Handle push notifications
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'New news available!',
        icon: '/icon-128.png',
        badge: '/badge-72.png',
        requireInteraction: true,
        data: {
            url: '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification('Veritas News', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    const { action, notification } = event;
    console.log('Service Worker: Notification clicked:', action);

    event.notification.close();

    const actions = {
        'open': '/index.html',
        'open-latest': '/#/latest',
        'open-search': '/#/search',
        'close': null
    };

    const url = actions[action] || '/index.html';

    if (url) {
        event.waitUntil(
            clients.openWindow(url)
        );
    }
    event.notification.close();
});

// Handle messages from main thread
self.addEventListener('message', event => {
    const { type, data } = event.data;

    switch (type) {
        case 'CACHE_STATIC_ASSETS':
            handleCacheStaticAssets(data);
            break;
        case 'CACHE_API_RESPONSE':
            handleCacheApiResponse(data);
            break;
        case 'CACHE_IMAGE':
            handleCacheImage(data);
            break;
        case 'GET_CACHED_RESPONSE':
            handleGetCachedResponse(event);
            break;
        case 'CLEAR_CACHE':
            handleClearCache(data);
            break;
        case 'GET_CACHE_STATS':
            handleCacheStats(event);
            break;
        default:
            console.log('Service Worker: Unknown message type:', type);
    }
});

async function handleCacheStaticAssets(data) {
    const { assets } = data;

    const cache = await caches.open(STATIC_CACHE);
    await Promise.all(assets.map(asset => cache.add(asset)));
    console.log('Service Worker: Cached assets:', assets.length);

    if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({
            type: 'CACHE_UPDATED',
            data: { assets: assets }
        });
    }
}

async function handleCacheApiResponse(data) {
    const { url, responseData } = data;
    const cache = await caches.open(API_CACHE);
    const response = new Response(responseData);
    await cache.put(url, response);
    console.log('Service Worker: Cached API response:', url);
}

async function handleCacheImage(data) {
    const { url, imageData } = data;
    const cache = await caches.open(IMAGES_CACHE);
    const response = new Response(imageData, { headers: { 'Content-Type': 'image/*' } });
    await cache.put(url, response);
    console.log('Service Worker: Cached image:', url);
}

async function handleGetCachedResponse(event) {
    const { url } = event.data;
    const cache = await caches.open(API_CACHE);
    const response = await cache.match(url);

    if (event.ports && event.ports[0]) {
        event.ports[0].postMessage(response);
    }
}

async function handleClearCache(data) {
    const { cacheType } = data;

    if (cacheType === 'all') {
        await caches.delete(API_CACHE);
        await caches.delete(IMAGES_CACHE);
        console.log('Service Worker: Cleared all caches');
    } else if (cacheType === 'api') {
        await caches.delete(API_CACHE);
        console.log('Service Worker: Cleared API cache');
    } else if (cacheType === 'images') {
        await caches.delete(IMAGES_CACHE);
        console.log('Service Worker: Cleared image cache');
    }

    if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({
            type: 'CACHE_CLEARED',
            data: { cacheType }
        });
    }
}

async function handleCacheStats(event) {
    const cacheNames = await caches.keys();
    const stats = {};

    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        stats[cacheName] = keys.length;
    }

    event.ports[0].postMessage({
        type: 'CACHE_STATS',
        data: stats
    });
}

// Handle periodic sync
self.addEventListener('periodicsync', event => {
    if (event.tag === 'periodic-content-sync') {
        event.waitUntil(handlePeriodicSync());
    }
});

async function handlePeriodicSync() {
    try {
        console.log('Service Worker: Periodic sync triggered');
        // Implement periodic caching logic here
    } catch (error) {
        console.error('Service Worker: Periodic sync failed:', error);
    }
}

// Handle fetch events for pre-cached articles
self.addEventListener('fetch', event => {
    const { request } = event;

    // Pre-cache likely next articles
    if (request.mode === 'navigate') {
        event.waitUntil(preCacheAssets(request.url));
    }
});

async function preCacheAssets(url) {
    const requestUrl = new URL(url);

    if (requestUrl.pathname.startsWith('/index.html') || requestUrl.pathname.startsWith('/#/')) {
        // Pre-cache next articles based on current page
        try {
            // This would implement pre-caching logic
            console.log('Service Worker: Pre-caching next articles');
        } catch (error) {
            console.error('Service Worker: Pre-caching failed:', error);
        }
    }
}

// Handle app installation
self.addEventListener('canmakepayment', event => {
    console.log('Service Worker: App is ready for installation');
});

// Handle app installation
self.addEventListener('appinstalled', event => {
    console.log('Service Worker: App installed successfully');
});

// Handle beforeinstallprompt
self.addEventListener('beforeinstallprompt', event => {
    console.log('Service Worker: Install prompt available');
});