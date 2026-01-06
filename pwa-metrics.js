// pwa-metrics.js - Runtime metrics and version tracking for production PWA
class PWAMetrics {
    constructor() {
        this.version = '2.1';
        this.swVersion = null;
        this.metrics = {
            cachedItems: 0,
            lastSyncTime: null,
            onlineState: navigator.onLine,
            cacheSize: 0,
            offlineArticles: 0,
            apiCalls: 0,
            failedRequests: 0
        };
        
        this.init();
    }

    async init() {
        console.log(`[PWA Metrics] Initializing v${this.version}`);
        
        // Log version info
        this.logVersionInfo();
        
        // Setup network listeners
        this.setupNetworkListeners();
        
        // Get SW version
        this.getSWVersion();
        
        // Update metrics periodically
        setInterval(() => this.updateMetrics(), 30000); // Every 30 seconds
        
        // Initial metrics update
        await this.updateMetrics();
    }

    logVersionInfo() {
        console.log(`[PWA Metrics] App Version: ${this.version}`);
        console.log(`[PWA Metrics] User Agent: ${navigator.userAgent}`);
        console.log(`[PWA Metrics] Platform: ${navigator.platform}`);
        console.log(`[PWA Metrics] Online: ${navigator.onLine}`);
        console.log(`[PWA Metrics] Service Worker: ${('serviceWorker' in navigator ? 'Supported' : 'Not Supported')}`);
        console.log(`[PWA Metrics] IndexedDB: ${('indexedDB' in window ? 'Supported' : 'Not Supported')}`);
        console.log(`[PWA Metrics] Cache API: ${('caches' in window ? 'Supported' : 'Not Supported')}`);
    }

    async getSWVersion() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.ready;
                if (registration.active) {
                    console.log('[PWA Metrics] Service Worker is active');
                    
                    // Request version from SW
                    registration.active.postMessage({ type: 'GET_VERSION' });
                }
            } catch (error) {
                console.warn('[PWA Metrics] Failed to get SW version:', error);
            }
        }
    }

    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.metrics.onlineState = true;
            console.log('[PWA Metrics] Online');
            this.updateUI();
            this.notifyOnlineStatus(true);
        });

        window.addEventListener('offline', () => {
            this.metrics.onlineState = false;
            console.log('[PWA Metrics] Offline');
            this.updateUI();
            this.notifyOnlineStatus(false);
        });
    }

    async updateMetrics() {
        try {
            // Update cache count
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                let totalItems = 0;
                let totalSize = 0;

                for (const cacheName of cacheNames) {
                    const cache = await caches.open(cacheName);
                    const requests = await cache.keys();
                    totalItems += requests.length;

                    // Estimate cache size
                    for (const request of requests) {
                        const response = await cache.match(request);
                        if (response) {
                            const blob = await response.blob();
                            totalSize += blob.size;
                        }
                    }
                }

                this.metrics.cachedItems = totalItems;
                this.metrics.cacheSize = totalSize;
            }

            // Update offline articles count
            if (window.offlineManager) {
                const stats = await window.offlineManager.updateStats();
                this.metrics.offlineArticles = stats.offlineArticles || 0;
                this.metrics.lastSyncTime = stats.lastSync;
            }

            this.updateUI();
        } catch (error) {
            console.warn('[PWA Metrics] Failed to update metrics:', error);
        }
    }

    updateUI() {
        // Update online/offline indicator
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            const statusText = statusEl.querySelector('.status-text');
            const statusDot = statusEl.querySelector('.status-dot');
            
            if (this.metrics.onlineState) {
                statusText.textContent = 'Online';
                statusDot.style.backgroundColor = '#10b981';
            } else {
                statusText.textContent = 'Offline';
                statusDot.style.backgroundColor = '#ef4444';
            }
        }

        // Update metrics display
        this.displayMetrics();
    }

    displayMetrics() {
        const metricsHTML = `
            <div class="pwa-metrics-panel">
                <div class="metrics-header">
                    <h3><i class="fas fa-chart-bar"></i> PWA Metrics</h3>
                    <button class="metrics-close" onclick="this.parentElement.parentElement.style.display='none'">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="metrics-content">
                    <div class="metric-item">
                        <span class="metric-label">App Version:</span>
                        <span class="metric-value">${this.version}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Status:</span>
                        <span class="metric-value ${this.metrics.onlineState ? 'online' : 'offline'}">
                            ${this.metrics.onlineState ? '🟢 Online' : '🔴 Offline'}
                        </span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Cached Items:</span>
                        <span class="metric-value">${this.metrics.cachedItems}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Cache Size:</span>
                        <span class="metric-value">${this.formatBytes(this.metrics.cacheSize)}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Offline Articles:</span>
                        <span class="metric-value">${this.metrics.offlineArticles}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Last Sync:</span>
                        <span class="metric-value">${this.metrics.lastSyncTime ? new Date(this.metrics.lastSyncTime).toLocaleTimeString() : 'Never'}</span>
                    </div>
                </div>
            </div>
        `;

        // Store for later use
        window.pwaMetricsHTML = metricsHTML;
    }

    notifyOnlineStatus(isOnline) {
        if (window.newsApp && window.newsApp.showToast) {
            const message = isOnline ? 
                '🟢 Back online! Syncing data...' : 
                '🔴 You are offline. Using cached content.';
            const type = isOnline ? 'success' : 'warning';
            window.newsApp.showToast(message, type);
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    getMetrics() {
        return {
            ...this.metrics,
            version: this.version,
            timestamp: new Date().toISOString()
        };
    }

    logMetrics() {
        console.table(this.getMetrics());
    }
}

// Initialize metrics when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.pwaMetrics = new PWAMetrics();
    });
} else {
    window.pwaMetrics = new PWAMetrics();
}
