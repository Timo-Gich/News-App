/**
 * CacheController Module
 * Enhanced service worker management with multiple cache strategies
 */

class CacheController {
    constructor() {
        this.cacheName = 'veritas-news-v2.0';
        this.staticCacheName = 'veritas-static-v2.0';
        this.imagesCacheName = 'veritas-images-v2.0';
        this.apiCacheName = 'veritas-api-v2.0';

        this.isServiceWorkerSupported = 'serviceWorker' in navigator;
        this.registration = null;

        if (this.isServiceWorkerSupported) {
            this.init();
        }
    }

    /**
     * Initialize service worker registration
     */
    async init() {
        try {
            this.registration = await navigator.serviceWorker.register('/sw-enhanced.js', {
                scope: '/'
            });

            console.log('Service Worker registered successfully:', this.registration.scope);

            // Set up message handling
            this.setupMessageHandling();

            // Check for updates
            this.checkForUpdates();

        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }

    /**
     * Set up message handling between main thread and service worker
     */
    setupMessageHandling() {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                const { type, data } = event.data;

                switch (type) {
                    case 'CACHE_UPDATED':
                        console.log('Cache updated:', data);
                        break;
                    case 'SYNC_COMPLETED':
                        console.log('Background sync completed:', data);
                        break;
                    case 'PUSH_NOTIFICATION':
                        this.handlePushNotification(data);
                        break;
                    case 'STORAGE_QUOTA_EXCEEDED':
                        this.handleStorageQuotaExceeded(data);
                        break;
                }
            });
        }
    }

    /**
     * Check for service worker updates
     */
    checkForUpdates() {
        if (this.registration && this.registration.waiting) {
            this.showUpdateNotification();
        }

        this.registration.addEventListener('updatefound', () => {
            const newWorker = this.registration.installing;

            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    this.showUpdateNotification();
                }
            });
        });
    }

    /**
     * Show update notification to user
     */
    showUpdateNotification() {
        // Create a toast notification for update available
        const container = document.getElementById('toast-container');
        if (container) {
            const toast = document.createElement('div');
            toast.className = 'toast info';
            toast.innerHTML = `
                <div class="toast-icon">
                    <i class="fas fa-download"></i>
                </div>
                <div class="toast-message">New version available! <button onclick="window.location.reload()" style="background:none;border:none;color:#2563eb;cursor:pointer;text-decoration:underline;">Refresh</button></div>
                <button class="toast-close">
                    <i class="fas fa-times"></i>
                </button>
            `;

            container.appendChild(toast);

            // Remove toast after 10 seconds
            setTimeout(() => {
                toast.remove();
            }, 10000);

            // Close button
            toast.querySelector('.toast-close').addEventListener('click', () => {
                toast.remove();
            });
        }
    }

    /**
     * Cache static assets (cache-first strategy)
     */
    async cacheStaticAssets() {
        if (!this.registration || !this.registration.active) {
            return false;
        }

        try {
            const message = {
                type: 'CACHE_STATIC_ASSETS',
                data: {
                    cacheName: this.staticCacheName,
                    assets: [
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
                        'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
                        'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Roboto:wght@300;400;500&display=swap'
                    ]
                }
            };

            await this.sendMessage(message);
            return true;
        } catch (error) {
            console.error('Failed to cache static assets:', error);
            return false;
        }
    }

    /**
     * Cache API responses (network-first strategy)
     */
    async cacheApiResponse(url, response) {
        if (!this.registration || !this.registration.active) {
            return false;
        }

        try {
            const message = {
                type: 'CACHE_API_RESPONSE',
                data: {
                    cacheName: this.apiCacheName,
                    url: url,
                    response: response,
                    timestamp: Date.now()
                }
            };

            await this.sendMessage(message);
            return true;
        } catch (error) {
            console.error('Failed to cache API response:', error);
            return false;
        }
    }

    /**
     * Cache images (cache-first with expiration)
     */
    async cacheImage(url, imageData) {
        if (!this.registration || !this.registration.active) {
            return false;
        }

        try {
            const message = {
                type: 'CACHE_IMAGE',
                data: {
                    cacheName: this.imagesCacheName,
                    url: url,
                    imageData: imageData,
                    timestamp: Date.now()
                }
            };

            await this.sendMessage(message);
            return true;
        } catch (error) {
            console.error('Failed to cache image:', error);
            return false;
        }
    }

    /**
     * Get cached response
     */
    async getCachedResponse(url) {
        if (!this.registration || !this.registration.active) {
            return null;
        }

        try {
            const message = {
                type: 'GET_CACHED_RESPONSE',
                data: { url: url }
            };

            const response = await this.sendMessage(message);
            return response;
        } catch (error) {
            console.error('Failed to get cached response:', error);
            return null;
        }
    }

    /**
     * Clear specific cache
     */
    async clearCache(cacheType = 'all') {
        if (!this.registration || !this.registration.active) {
            return false;
        }

        try {
            const message = {
                type: 'CLEAR_CACHE',
                data: { cacheType: cacheType }
            };

            await this.sendMessage(message);
            return true;
        } catch (error) {
            console.error('Failed to clear cache:', error);
            return false;
        }
    }

    /**
     * Get cache statistics
     */
    async getCacheStats() {
        if (!this.registration || !this.registration.active) {
            return null;
        }

        try {
            const message = {
                type: 'GET_CACHE_STATS'
            };

            const stats = await this.sendMessage(message);
            return stats;
        } catch (error) {
            console.error('Failed to get cache stats:', error);
            return null;
        }
    }

    /**
     * Register background sync
     */
    async registerBackgroundSync(tag = 'sync-offline-actions') {
        if (!this.registration || !this.registration.active) {
            return false;
        }

        try {
            const message = {
                type: 'REGISTER_BACKGROUND_SYNC',
                data: { tag: tag }
            };

            await this.sendMessage(message);
            return true;
        } catch (error) {
            console.error('Failed to register background sync:', error);
            return false;
        }
    }

    /**
     * Register push notification subscription
     */
    async registerPushSubscription() {
        if (!this.registration || !this.registration.active) {
            return false;
        }

        try {
            // Check if push is supported
            if (!('PushManager' in window)) {
                console.warn('Push notifications not supported');
                return false;
            }

            // Request notification permission
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.warn('Notification permission denied');
                return false;
            }

            // Get VAPID key from server (you would need to implement this)
            const vapidKey = await this.getVapidKey();
            if (!vapidKey) {
                console.warn('VAPID key not available');
                return false;
            }

            const subscription = await this.registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(vapidKey)
            });

            // Send subscription to server
            await this.sendPushSubscription(subscription);

            return true;
        } catch (error) {
            console.error('Failed to register push subscription:', error);
            return false;
        }
    }

    /**
     * Send message to service worker
     */
    async sendMessage(message) {
        return new Promise((resolve, reject) => {
            const messageChannel = new MessageChannel();

            messageChannel.port1.onmessage = (event) => {
                if (event.data.error) {
                    reject(new Error(event.data.error));
                } else {
                    resolve(event.data);
                }
            };

            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2]);
            } else {
                reject(new Error('No active service worker'));
            }
        });
    }

    /**
     * Handle push notifications
     */
    handlePushNotification(data) {
        // Show notification to user
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(data.title || 'Veritas News', {
                body: data.body || 'New articles available',
                icon: '/icon-192.png',
                badge: '/badge-72.png',
                tag: 'veritas-news-update',
                actions: [{
                        action: 'open',
                        title: 'Open App',
                        icon: '/icon-192.png'
                    },
                    {
                        action: 'dismiss',
                        title: 'Dismiss',
                        icon: '/icon-192.png'
                    }
                ]
            });

            notification.onclick = (event) => {
                event.preventDefault();
                window.focus();
                window.open('/', '_blank');
                notification.close();
            };
        }
    }

    /**
     * Handle storage quota exceeded
     */
    handleStorageQuotaExceeded(data) {
        console.warn('Storage quota exceeded:', data);

        // Show warning to user
        const container = document.getElementById('toast-container');
        if (container) {
            const toast = document.createElement('div');
            toast.className = 'toast warning';
            toast.innerHTML = `
                <div class="toast-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="toast-message">Storage space is running low. Some offline features may be limited.</div>
                <button class="toast-close">
                    <i class="fas fa-times"></i>
                </button>
            `;

            container.appendChild(toast);

            // Remove toast after 8 seconds
            setTimeout(() => {
                toast.remove();
            }, 8000);

            // Close button
            toast.querySelector('.toast-close').addEventListener('click', () => {
                toast.remove();
            });
        }
    }

    /**
     * Get VAPID key from server
     */
    async getVapidKey() {
        // This would typically fetch from your server
        // For now, return null to disable push notifications
        return null;
    }

    /**
     * Send push subscription to server
     */
    async sendPushSubscription(subscription) {
        // This would send the subscription to your server
        // For now, just log it
        console.log('Push subscription:', subscription);
    }

    /**
     * Convert base64 string to Uint8Array
     */
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    /**
     * Pre-cache likely next articles
     */
    async preCacheArticles(articles) {
        if (!this.registration || !this.registration.active) {
            return false;
        }

        try {
            const message = {
                type: 'PRE_CACHE_ARTICLES',
                data: {
                    articles: articles.slice(0, 5) // Cache first 5 articles
                }
            };

            await this.sendMessage(message);
            return true;
        } catch (error) {
            console.error('Failed to pre-cache articles:', error);
            return false;
        }
    }

    /**
     * Cleanup old cache entries
     */
    async cleanupCache() {
        if (!this.registration || !this.registration.active) {
            return false;
        }

        try {
            const message = {
                type: 'CLEANUP_CACHE',
                data: {
                    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
                }
            };

            await this.sendMessage(message);
            return true;
        } catch (error) {
            console.error('Failed to cleanup cache:', error);
            return false;
        }
    }

    /**
     * Get service worker status
     */
    getStatus() {
        return {
            supported: this.isServiceWorkerSupported,
            registered: !!this.registration,
            active: !!(this.registration && this.registration.active),
            waiting: !!(this.registration && this.registration.waiting),
            installing: !!(this.registration && this.registration.installing)
        };
    }

    /**
     * Unregister service worker (for debugging)
     */
    async unregister() {
        if (this.registration) {
            const result = await this.registration.unregister();
            console.log('Service Worker unregistered:', result);
            return result;
        }
        return false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CacheController;
} else {
    window.CacheController = CacheController;
}