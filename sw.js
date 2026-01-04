// Enhanced Service Worker for Offline News App - v2.0
// MAINTAINED STRUCTURE: Same events, enhanced logic

const CACHE_NAME = 'currents-news-v2.0';
const OFFLINE_URL = 'offline.html';

// === ENHANCED: Added versioning and more assets ===
const STATIC_CACHE_URLS = [
    '/',
    '/index.html',
    '/offline.html',
    '/404.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Roboto:wght@300;400;500&display=swap',
    // Keep original icons
    'https://img.icons8.com/color/96/000000/news.png',
    'https://img.icons8.com/color/144/000000/news.png',
    'https://img.icons8.com/color/192/000000/news.png',
    'https://img.icons8.com/color/512/000000/news.png'
];

// === ENHANCED: Added offline data store in IndexedDB ===
const setupIndexedDB = async() => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('CurrentsOfflineDB', 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Store for articles
            if (!db.objectStoreNames.contains('articles')) {
                const store = db.createObjectStore('articles', { keyPath: 'id' });
                store.createIndex('category', 'category', { multiEntry: true });
                store.createIndex('timestamp', 'timestamp');
                store.createIndex('readStatus', 'readStatus');
            }

            // Store for offline actions (queued when offline)
            if (!db.objectStoreNames.contains('offlineActions')) {
                const actionStore = db.createObjectStore('offlineActions', {
                    keyPath: 'id',
                    autoIncrement: true
                });
                actionStore.createIndex('type', 'type');
                actionStore.createIndex('status', 'status');
            }

            // Store for reading progress
            if (!db.objectStoreNames.contains('readingProgress')) {
                const progressStore = db.createObjectStore('readingProgress', {
                    keyPath: 'articleId'
                });
                progressStore.createIndex('lastRead', 'lastRead');
            }
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
};

// === Install Event - ENHANCED with better caching ===
self.addEventListener('install', event => {
    console.log('Service Worker v2.0: Installing with enhanced offline capabilities...');

    event.waitUntil(
        Promise.all([
            // Cache static assets
            caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Caching static assets');
                // Try to cache all, but continue even if some fail
                return Promise.all(
                    STATIC_CACHE_URLS.map(url =>
                        cache.add(url).catch(err =>
                            console.log('Failed to cache:', url, err)
                        )
                    )
                );
            }),

            // Setup IndexedDB for offline storage
            setupIndexedDB().then(db => {
                console.log('Service Worker: IndexedDB setup complete');
                return db;
            }).catch(err => {
                console.log('Service Worker: IndexedDB setup failed (non-critical):', err);
            }),

            // Skip waiting to activate immediately
            self.skipWaiting()
        ]).then(() => {
            console.log('Service Worker v2.0: Installation complete');
        })
    );
});

// === Activate Event - ENHANCED with better cleanup ===
self.addEventListener('activate', event => {
    console.log('Service Worker v2.0: Activating...');

    event.waitUntil(
        Promise.all([
            // Clean up old caches (keep only current version)
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Service Worker: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),

            // Claim clients immediately
            self.clients.claim(),

            // Send message to all clients about new version
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SW_UPDATED',
                        version: '2.0',
                        message: 'Offline capabilities enhanced'
                    });
                });
            })
        ]).then(() => {
            console.log('Service Worker v2.0: Activation complete');
        })
    );
});

// === ENHANCED: New function - Cache API response intelligently ===
const cacheApiResponse = async(request, response) => {
    if (!response || response.status !== 200) return;

    const url = new URL(request.url);

    // Only cache specific API endpoints
    if (url.pathname.includes('/latest-news') || url.pathname.includes('/search')) {
        const cache = await caches.open(CACHE_NAME);

        // Clone response for caching
        const responseToCache = response.clone();

        // Store in cache with timestamp
        await cache.put(request, responseToCache);
        console.log('Service Worker: Cached API response for:', url.pathname);

        // Also store individual articles in IndexedDB for offline search
        try {
            const data = await response.clone().json();
            if (data.news && data.news.length > 0) {
                await storeArticlesInIndexedDB(data.news);
            }
        } catch (err) {
            console.log('Service Worker: Could not parse API response for IndexedDB:', err);
        }
    }
};

// === ENHANCED: New function - Store articles in IndexedDB ===
const storeArticlesInIndexedDB = async(articles) => {
    try {
        const db = await setupIndexedDB();
        const tx = db.transaction('articles', 'readwrite');
        const store = tx.objectStore('articles');

        // Add timestamp to each article
        const articlesWithMeta = articles.map(article => ({
            ...article,
            id: article.id || article.url || Date.now() + Math.random(),
            timestamp: Date.now(),
            readStatus: 'unread',
            offlineAvailable: true
        }));

        // Store each article
        await Promise.all(
            articlesWithMeta.map(article =>
                store.put(article).catch(err =>
                    console.log('Failed to store article in IndexedDB:', err)
                )
            )
        );

        await tx.done;
        console.log(`Service Worker: Stored ${articles.length} articles in IndexedDB`);
    } catch (err) {
        console.log('Service Worker: IndexedDB storage failed:', err);
    }
};

// === ENHANCED: New function - Get cached articles from IndexedDB ===
const getCachedArticlesFromIndexedDB = async(limit = 50) => {
    try {
        const db = await setupIndexedDB();
        const tx = db.transaction('articles', 'readonly');
        const store = tx.objectStore('articles');
        const index = store.index('timestamp');

        // Get most recent articles
        const articles = await index.getAll();
        await tx.done;

        // Sort by timestamp (newest first) and limit
        return articles
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    } catch (err) {
        console.log('Service Worker: Failed to get articles from IndexedDB:', err);
        return [];
    }
};

// === Fetch Event - ENHANCED with smarter strategies ===
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // === ENHANCED: Different strategies for different content types ===

    // 1. API Requests - Network First, Cache Fallback
    if (url.hostname === 'api.currentsapi.services') {
        event.respondWith(handleApiRequest(event));
        return;
    }

    // 2. Navigation Requests - Cache First, Network Fallback with offline page
    if (request.mode === 'navigate') {
        event.respondWith(handleNavigationRequest(event));
        return;
    }

    // 3. Static Assets - Cache First, Network Fallback
    if (STATIC_CACHE_URLS.some(assetUrl => request.url.includes(assetUrl)) ||
        request.url.includes('cdnjs.cloudflare.com') ||
        request.url.includes('fonts.googleapis.com') ||
        request.url.includes('icons8.com')) {
        event.respondWith(handleStaticRequest(event));
        return;
    }

    // 4. Images - Cache First with Stale Revalidation
    if (request.destination === 'image') {
        event.respondWith(handleImageRequest(event));
        return;
    }

    // 5. Default - Network First, Cache Fallback
    event.respondWith(handleDefaultRequest(event));
});

// === ENHANCED: API Request Handler ===
async function handleApiRequest(event) {
    const { request } = event;
    const cache = await caches.open(CACHE_NAME);

    // Try network first
    try {
        const networkResponse = await fetch(request);

        // Cache successful responses
        if (networkResponse.ok) {
            await cacheApiResponse(request, networkResponse);
        }

        return networkResponse;
    } catch (networkError) {
        console.log('Service Worker: Network failed, trying cache...');

        // Try cache
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
            console.log('Service Worker: Serving cached API response');
            return cachedResponse;
        }

        // Try IndexedDB as last resort
        const articles = await getCachedArticlesFromIndexedDB(20);
        if (articles.length > 0) {
            console.log('Service Worker: Serving articles from IndexedDB');
            return new Response(JSON.stringify({
                status: 'ok',
                news: articles,
                message: 'Offline mode: Showing previously cached articles'
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Return empty response
        return new Response(JSON.stringify({
            status: 'ok',
            news: [],
            message: 'You are offline and no cached articles available'
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// === ENHANCED: Navigation Request Handler ===
async function handleNavigationRequest(event) {
    const { request } = event;
    const cache = await caches.open(CACHE_NAME);

    // Try cache first for fast navigation
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
        // Update in background
        event.waitUntil(
            fetch(request).then(networkResponse => {
                if (networkResponse.ok) {
                    cache.put(request, networkResponse.clone());
                }
            }).catch(() => { /* Ignore background update errors */ })
        );
        return cachedResponse;
    }

    // Try network
    try {
        return await fetch(request);
    } catch (error) {
        // Fallback to offline page
        const offlineResponse = await cache.match(OFFLINE_URL);
        if (offlineResponse) {
            return offlineResponse;
        }

        // Last resort - create offline response
        return new Response(
            '<h1>Offline</h1><p>Please check your internet connection.</p>', { headers: { 'Content-Type': 'text/html' } }
        );
    }
}

// === ENHANCED: Static Asset Handler ===
async function handleStaticRequest(event) {
    const { request } = event;
    const cache = await caches.open(CACHE_NAME);

    // Cache first
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;

    // Network fallback
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        return new Response('Offline - static asset not available', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// === ENHANCED: Image Handler with placeholder fallback ===
async function handleImageRequest(event) {
    const { request } = event;
    const cache = await caches.open(CACHE_NAME);

    // Try cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;

    // Try network
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        // Return SVG placeholder
        return new Response(
            `<svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f3f4f6"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em" 
              fill="#9ca3af" font-family="Arial" font-size="14">
          Image unavailable offline
        </text>
      </svg>`, { headers: { 'Content-Type': 'image/svg+xml' } }
        );
    }
}

// === ENHANCED: Default Request Handler ===
async function handleDefaultRequest(event) {
    const { request } = event;

    try {
        const networkResponse = await fetch(request);
        return networkResponse;
    } catch (error) {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        return new Response('Resource unavailable offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// === KEEPING ORIGINAL: Background sync (enhanced) ===
self.addEventListener('sync', event => {
    if (event.tag === 'sync-news') {
        console.log('Service Worker: Background sync triggered');
        event.waitUntil(
            syncNewsData().catch(err =>
                console.log('Background sync failed:', err)
            )
        );
    }
});

// === ENHANCED: Background Sync Function ===
async function syncNewsData() {
    console.log('Service Worker: Syncing news data in background');

    try {
        const cache = await caches.open(CACHE_NAME);
        const requests = await cache.keys();

        // Find API requests to refresh
        const apiRequests = requests.filter(req => {
            const url = new URL(req.url);
            return url.hostname === 'api.currentsapi.services';
        });

        // Refresh each API request
        const updatePromises = apiRequests.map(async(request) => {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    await cache.put(request, response.clone());
                    console.log('Service Worker: Refreshed cached data:', request.url);
                }
            } catch (err) {
                console.log('Service Worker: Failed to refresh:', request.url, err);
            }
        });

        await Promise.all(updatePromises);
        console.log('Service Worker: Background sync complete');

        // Notify clients sync is complete
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'SYNC_COMPLETE',
                    timestamp: Date.now()
                });
            });
        });
    } catch (error) {
        console.log('Service Worker: Background sync failed:', error);
    }
}

// === KEEPING ORIGINAL: Push notifications ===
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'New news articles available!',
        icon: 'https://img.icons8.com/color/96/000000/news.png',
        badge: 'https://img.icons8.com/color/72/000000/news.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [{
                action: 'explore',
                title: 'Read Now',
                icon: 'https://img.icons8.com/color/96/000000/news.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: 'https://img.icons8.com/color/96/000000/news.png'
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

// === NEW: Message handler for communication with main app ===
self.addEventListener('message', event => {
    console.log('Service Worker: Received message', event.data);

    switch (event.data.type) {
        case 'GET_CACHED_ARTICLES':
            getCachedArticlesFromIndexedDB(event.data.limit || 50)
                .then(articles => {
                    event.ports[0].postMessage({ success: true, articles });
                })
                .catch(error => {
                    event.ports[0].postMessage({ success: false, error: error.message });
                });
            break;

        case 'CLEAR_CACHE':
            caches.delete(CACHE_NAME)
                .then(() => {
                    event.ports[0].postMessage({ success: true });
                })
                .catch(error => {
                    event.ports[0].postMessage({ success: false, error: error.message });
                });
            break;

        case 'GET_CACHE_INFO':
            caches.open(CACHE_NAME)
                .then(cache => cache.keys())
                .then(requests => {
                    event.ports[0].postMessage({
                        success: true,
                        cacheName: CACHE_NAME,
                        itemCount: requests.length,
                        requests: requests.map(req => req.url)
                    });
                })
                .catch(error => {
                    event.ports[0].postMessage({ success: false, error: error.message });
                });
            break;
    }
});