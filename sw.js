// sw.js - Service Worker for Offline News App

const CACHE_NAME = 'currents-news-v1.1';
const OFFLINE_URL = 'offline.html';

// Files to cache immediately on install
const STATIC_CACHE_URLS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Roboto:wght@300;400;500&display=swap'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');

    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => {
            console.log('Service Worker: Caching static assets');
            return cache.addAll(STATIC_CACHE_URLS);
        })
        .then(() => {
            console.log('Service Worker: Installation complete');
            return self.skipWaiting();
        })
    );
});

// Activate event - clean up old caches

self.addEventListener('activate', event => {
    event.waitUntil(
        self.clients.matchAll().then(clients => {
            // Send message to all open tabs/windows
            clients.forEach(client => {
                client.postMessage({
                    type: 'SW_UPDATED',
                    version: '1.1',
                    message: 'New version available. Please refresh.'
                });
            });
        })
    );
});

self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');

    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Clearing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Activation complete');
            return self.clients.claim();
        })
    );
});

// Fetch event - serve from cache if offline
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Fix for PWA routing - serve index.html for all navigation requests
    if (event.request.mode === 'navigate') {
        event.respondWith(
            caches.match('/index.html')
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
            .catch(() => {
                return caches.match('/offline.html');
            })
        );
        return;
    }

    // ... rest of your fetch event code
});

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests and chrome-extension requests
    if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
        return;
    }

    // Handle API requests differently
    if (url.hostname === 'api.currentsapi.services') {
        event.respondWith(handleApiRequest(event));
        return;
    }

    // For all other requests, try cache first with network fallback
    event.respondWith(
        caches.match(request)
        .then(response => {
            // Return cached response if found
            if (response) {
                console.log('Service Worker: Serving from cache:', request.url);
                return response;
            }

            // Otherwise fetch from network
            return fetch(request)
                .then(networkResponse => {
                    // Don't cache non-successful responses
                    if (!networkResponse || networkResponse.status !== 200) {
                        return networkResponse;
                    }

                    // Cache successful responses (except API calls)
                    if (!url.hostname.includes('api.')) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(request, responseToCache);
                                console.log('Service Worker: Cached new resource:', request.url);
                            });
                    }

                    return networkResponse;
                })
                .catch(() => {
                    // If both cache and network fail, show offline page for navigation requests
                    if (request.mode === 'navigate') {
                        return caches.match(OFFLINE_URL);
                    }
                    return new Response('Offline - content not available', {
                        status: 503,
                        statusText: 'Service Unavailable',
                        headers: new Headers({ 'Content-Type': 'text/plain' })
                    });
                });
        })
    );
});

// Special handling for API requests
function handleApiRequest(event) {
    const { request } = event;
    const url = new URL(request.url);

    return caches.match(request)
        .then(cachedResponse => {
            // If we have cached API data, return it immediately
            if (cachedResponse) {
                console.log('Service Worker: Serving cached API data:', url.pathname);
                return cachedResponse;
            }

            // Try network for API calls
            return fetch(request)
                .then(networkResponse => {
                    // Cache successful API responses for offline use
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();

                        // Only cache certain API endpoints
                        if (shouldCacheApiRequest(url)) {
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(request, responseToCache);
                                    console.log('Service Worker: Cached API response:', url.pathname);
                                });
                        }
                    }

                    return networkResponse;
                })
                .catch(error => {
                    console.log('Service Worker: API request failed:', error);

                    // For search/latest-news endpoints, return previously cached data if available
                    if (url.pathname.includes('/latest-news') || url.pathname.includes('/search')) {
                        return getCachedNewsFallback();
                    }

                    return new Response(JSON.stringify({
                        status: 'error',
                        message: 'You are offline. Please connect to the internet to fetch latest news.'
                    }), {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' }
                    });
                });
        });
}

// Check if API request should be cached
function shouldCacheApiRequest(url) {
    const path = url.pathname;

    // Cache these API endpoints
    if (path.includes('/latest-news') || path.includes('/search')) {
        const params = new URLSearchParams(url.search);

        // Don't cache searches with specific filters (they might be unique)
        if (params.has('keywords') && params.get('keywords').length > 0) {
            return false;
        }

        // Cache category-based requests
        if (params.has('category')) {
            return true;
        }

        // Cache language-based latest news
        if (path.includes('/latest-news') && params.has('language')) {
            return true;
        }
    }

    return false;
}

// Get cached news as fallback
function getCachedNewsFallback() {
    return caches.open(CACHE_NAME)
        .then(cache => {
            return cache.keys()
                .then(requests => {
                    // Find cached API responses
                    const apiRequests = requests.filter(req => {
                        const reqUrl = new URL(req.url);
                        return reqUrl.hostname === 'api.currentsapi.services' &&
                            (reqUrl.pathname.includes('/latest-news') || reqUrl.pathname.includes('/search'));
                    });

                    if (apiRequests.length === 0) {
                        throw new Error('No cached news available');
                    }

                    // Get the most recent cached response
                    return cache.match(apiRequests[apiRequests.length - 1]);
                });
        })
        .then(response => {
            if (response) {
                return response;
            }
            throw new Error('No cached news available');
        })
        .catch(() => {
            return new Response(JSON.stringify({
                status: 'ok',
                news: [],
                message: 'You are offline. No cached articles available.'
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        });
}

// Background sync for offline article reading
self.addEventListener('sync', event => {
    if (event.tag === 'sync-news') {
        console.log('Service Worker: Background sync triggered');
        event.waitUntil(syncNewsData());
    }
});

// Sync news when back online
function syncNewsData() {
    return caches.open(CACHE_NAME)
        .then(cache => {
            return cache.keys()
                .then(requests => {
                    const apiRequests = requests.filter(req => {
                        const url = new URL(req.url);
                        return url.hostname === 'api.currentsapi.services';
                    });

                    // Re-fetch cached API requests to update data
                    const updatePromises = apiRequests.map(request => {
                        return fetch(request)
                            .then(response => {
                                if (response.ok) {
                                    const responseToCache = response.clone();
                                    return cache.put(request, responseToCache);
                                }
                            })
                            .catch(error => {
                                console.log('Failed to update:', request.url, error);
                            });
                    });

                    return Promise.all(updatePromises);
                });
        });
}

// Push notifications (optional)
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'New news articles available!',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [{
                action: 'explore',
                title: 'Read Now',
                icon: '/icon-192.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/icon-192.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('Currents News Update', options)
    );
});

self.addEventListener('notificationclick', event => {
    console.log('Notification click received:', event.notification);
    event.notification.close();

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
});