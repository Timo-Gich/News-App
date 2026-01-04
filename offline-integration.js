// Offline Capabilities Integration for Currents News App
// This file bridges the enhanced HTML/CSS with the main app

class OfflineIntegration {
    constructor(app) {
        this.app = app;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupUIUpdates();
        this.checkOfflineCapabilities();
    }

    setupEventListeners() {
        // Offline navigation
        const offlineNavLink = document.getElementById('offline-nav-link');
        if (offlineNavLink) {
            offlineNavLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.app.showOfflineArticles();
            });
        }

        // Offline actions button
        const offlineActionsBtn = document.getElementById('offline-actions-btn');
        if (offlineActionsBtn) {
            offlineActionsBtn.addEventListener('click', () => {
                this.toggleOfflineManagement();
            });
        }

        // Save for offline button in modal
        const saveForOfflineBtn = document.getElementById('save-for-offline');
        if (saveForOfflineBtn) {
            saveForOfflineBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const article = this.getCurrentArticle();
                if (article) {
                    this.app.saveArticleForOffline(article);
                }
            });
        }

        // View offline articles button
        const viewOfflineBtn = document.getElementById('view-offline-btn');
        if (viewOfflineBtn) {
            viewOfflineBtn.addEventListener('click', () => {
                this.app.showOfflineArticles();
            });
        }

        // Download current page for offline
        const downloadCurrentBtn = document.getElementById('download-current-btn');
        if (downloadCurrentBtn) {
            downloadCurrentBtn.addEventListener('click', () => {
                this.app.downloadCurrentArticlesForOffline();
            });
        }

        // Clear cache buttons
        const clearCacheBtns = [
            document.getElementById('clear-cache-btn'),
            document.getElementById('clear-cache-footer'),
            document.getElementById('clear-cache-confirm-btn')
        ];

        clearCacheBtns.forEach(btn => {
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.app.clearOfflineCache();
                });
            }
        });

        // Cache management modal
        const cacheModalClose = document.getElementById('cache-modal-close');
        if (cacheModalClose) {
            cacheModalClose.addEventListener('click', () => {
                this.hideCacheManagementModal();
            });
        }

        const toggleOfflineManagement = document.getElementById('toggle-offline-management');
        if (toggleOfflineManagement) {
            toggleOfflineManagement.addEventListener('click', (e) => {
                e.preventDefault();
                this.showCacheManagementModal();
            });
        }

        // Quick actions
        const quickOfflineBtn = document.getElementById('quick-offline');
        if (quickOfflineBtn) {
            quickOfflineBtn.addEventListener('click', () => {
                this.showCacheManagementModal();
            });
        }

        const quickCacheBtn = document.getElementById('quick-cache');
        if (quickCacheBtn) {
            quickCacheBtn.addEventListener('click', () => {
                this.showCacheManagementModal();
            });
        }

        // Offline indicator close
        const offlineIndicatorClose = document.getElementById('offline-indicator-close');
        if (offlineIndicatorClose) {
            offlineIndicatorClose.addEventListener('click', () => {
                this.hideOfflineIndicator();
            });
        }

        // Offline fallback button
        const offlineFallbackBtn = document.getElementById('offline-fallback-btn');
        if (offlineFallbackBtn) {
            offlineFallbackBtn.addEventListener('click', () => {
                this.app.showOfflineArticles();
            });
        }

        // Refresh cache button
        const refreshCacheBtn = document.getElementById('refresh-cache-btn');
        if (refreshCacheBtn) {
            refreshCacheBtn.addEventListener('click', () => {
                this.app.loadLatestNews();
            });
        }

        // Download all button
        const downloadAllBtn = document.getElementById('download-all-btn');
        if (downloadAllBtn) {
            downloadAllBtn.addEventListener('click', () => {
                this.app.downloadCurrentArticlesForOffline();
            });
        }

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            const cacheModal = document.getElementById('cache-management-modal');
            if (e.target === cacheModal) {
                this.hideCacheManagementModal();
            }
        });

        // Handle service worker messages for UI updates
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                this.handleServiceWorkerMessage(event.data);
            });
        }
    }

    setupUIUpdates() {
        // Update offline stats periodically
        setInterval(() => this.updateOfflineUI(), 30000); // Every 30 seconds

        // Initial update
        setTimeout(() => this.updateOfflineUI(), 1000);

        // Listen for online/offline events
        window.addEventListener('online', () => this.updateOfflineUI());
        window.addEventListener('offline', () => this.updateOfflineUI());
    }

    async updateOfflineUI() {
        const isOnline = navigator.onLine;

        // Update online/offline indicators
        this.updateOnlineStatusUI(isOnline);

        // Update offline stats if online
        if (isOnline) {
            await this.updateOfflineStats();
        }

        // Show/hide offline nav based on cached content
        await this.updateOfflineNav();

        // Update storage progress
        this.updateStorageProgress();
    }

    updateOnlineStatusUI(isOnline) {
        const offlineIndicator = document.getElementById('offline-indicator');
        const offlineStatus = document.getElementById('offline-status');
        const apiStatus = document.getElementById('api-status');

        if (offlineIndicator) {
            offlineIndicator.style.display = !isOnline ? 'flex' : 'none';
        }

        if (offlineStatus) {
            offlineStatus.style.display = !isOnline ? 'flex' : 'none';
        }

        if (apiStatus) {
            const statusText = apiStatus.querySelector('.status-text');
            if (statusText) {
                statusText.textContent = isOnline ? 'Connected' : 'Offline';
            }
        }
    }

    async updateOfflineStats() {
        try {
            // Get cache info from app
            const cacheInfo = this.app.cacheInfo || {};

            // Update header stats
            const offlineArticleCount = document.getElementById('offline-article-count');
            if (offlineArticleCount) {
                offlineArticleCount.textContent = cacheInfo.totalArticles || '0';
            }

            // Update nav badge
            const offlineCountBadge = document.getElementById('offline-count');
            if (offlineCountBadge) {
                offlineCountBadge.textContent = cacheInfo.totalArticles || '0';
            }

            // Update cache stats in stats bar
            const cacheSizeElement = document.getElementById('cache-size');
            if (cacheSizeElement) {
                cacheSizeElement.textContent = cacheInfo.cacheSize || '0 MB';
            }

            // Update last sync
            const lastSyncElement = document.getElementById('last-sync');
            if (lastSyncElement && cacheInfo.lastSync) {
                lastSyncElement.textContent = this.formatRelativeTime(cacheInfo.lastSync);
            }

            // Update footer cache info
            const footerCacheSize = document.getElementById('footer-cache-size');
            if (footerCacheSize) {
                footerCacheSize.textContent = `${cacheInfo.totalArticles || 0} articles`;
            }

            const footerLastUpdate = document.getElementById('footer-last-update');
            if (footerLastUpdate && cacheInfo.lastSync) {
                footerLastUpdate.textContent = this.formatRelativeTime(cacheInfo.lastSync);
            }

            // Update cache modal stats
            const cacheArticleCount = document.getElementById('cache-article-count');
            if (cacheArticleCount) {
                cacheArticleCount.textContent = cacheInfo.totalArticles || '0';
            }

            const cacheStorageUsed = document.getElementById('cache-storage-used');
            if (cacheStorageUsed) {
                cacheStorageUsed.textContent = cacheInfo.cacheSize || '0 MB';
            }

            const cacheLastUpdated = document.getElementById('cache-last-updated');
            if (cacheLastUpdated) {
                cacheLastUpdated.textContent = cacheInfo.lastSync ?
                    this.formatRelativeTime(cacheInfo.lastSync) : 'Never';
            }

            // Show/hide cache stats based on whether we have cached content
            const cacheStats = document.getElementById('cache-stats');
            const lastSyncItem = document.getElementById('last-sync-item');
            const footerCacheInfo = document.getElementById('cache-info');

            const hasCache = cacheInfo.totalArticles > 0;

            if (cacheStats) cacheStats.style.display = hasCache ? 'flex' : 'none';
            if (lastSyncItem) lastSyncItem.style.display = hasCache ? 'flex' : 'none';
            if (footerCacheInfo) footerCacheInfo.style.display = hasCache ? 'block' : 'none';

        } catch (error) {
            console.log('Failed to update offline stats:', error);
        }
    }

    async updateOfflineNav() {
        const offlineNavLink = document.getElementById('offline-nav-link');
        const offlineActionsBtn = document.getElementById('offline-actions-btn');
        const offlineStats = document.getElementById('offline-stats');

        try {
            // Get cached article count
            const cachedCount = await this.getCachedArticleCount();
            const hasCache = cachedCount > 0;

            if (offlineNavLink) {
                offlineNavLink.style.display = hasCache ? 'flex' : 'none';
            }

            if (offlineActionsBtn) {
                offlineActionsBtn.style.display = hasCache ? 'flex' : 'none';
            }

            if (offlineStats) {
                offlineStats.style.display = hasCache ? 'flex' : 'none';
            }

        } catch (error) {
            console.log('Failed to update offline nav:', error);
        }
    }

    updateStorageProgress() {
        const storageUsed = document.getElementById('storage-used');
        const storageTotal = document.getElementById('storage-total');
        const storageProgress = document.getElementById('storage-progress');

        if (storageUsed && storageTotal && storageProgress) {
            // This is a simplified example - in production you'd get real storage data
            const usedMB = 5; // Example: 5MB used
            const totalMB = 50; // Example: 50MB total
            const percentage = (usedMB / totalMB) * 100;

            storageUsed.textContent = `${usedMB} MB`;
            storageTotal.textContent = `${totalMB} MB`;
            storageProgress.style.width = `${Math.min(percentage, 100)}%`;

            // Add warning class if storage is almost full
            if (percentage > 80) {
                storageProgress.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
            } else {
                storageProgress.style.background = 'linear-gradient(90deg, var(--accent-color), var(--primary-color))';
            }
        }
    }

    async getCachedArticleCount() {
        try {
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                return new Promise((resolve) => {
                    const messageChannel = new MessageChannel();

                    messageChannel.port1.onmessage = (event) => {
                        if (event.data.success) {
                            resolve(event.data.itemCount || 0);
                        } else {
                            resolve(0);
                        }
                    };

                    navigator.serviceWorker.controller.postMessage({
                        type: 'GET_CACHE_INFO'
                    }, [messageChannel.port2]);
                });
            }
        } catch (error) {
            console.log('Failed to get cached article count:', error);
        }
        return 0;
    }

    showCacheManagementModal() {
        const modal = document.getElementById('cache-management-modal');
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    hideCacheManagementModal() {
        const modal = document.getElementById('cache-management-modal');
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    }

    toggleOfflineManagement() {
        const section = document.getElementById('offline-management-section');
        if (section) {
            const isVisible = section.style.display !== 'none';
            section.style.display = isVisible ? 'none' : 'block';

            // Scroll to section if showing
            if (!isVisible) {
                section.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }

    showOfflineIndicator() {
        const indicator = document.getElementById('offline-indicator');
        if (indicator) {
            indicator.style.display = 'flex';
        }
    }

    hideOfflineIndicator() {
        const indicator = document.getElementById('offline-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    getCurrentArticle() {
        // This should get the current article from the modal
        // You'll need to adapt this based on how your app stores current article
        try {
            const titleElement = document.getElementById('modal-title');
            const descriptionElement = document.getElementById('modal-description');
            const sourceElement = document.getElementById('modal-source');
            const urlElement = document.getElementById('modal-read-full');

            const title = titleElement ? titleElement.textContent : null;
            const description = descriptionElement ? descriptionElement.textContent : null;
            const source = sourceElement ? sourceElement.textContent : null;
            const url = urlElement ? urlElement.href : null;

            if (title) {
                return {
                    id: `modal-${Date.now()}`,
                    title: title,
                    description: description,
                    source: source,
                    url: url,
                    published: new Date().toISOString()
                };
            }
        } catch (error) {
            console.log('Could not get current article:', error);
        }
        return null;
    }

    handleServiceWorkerMessage(data) {
        switch (data.type) {
            case 'SW_UPDATED':
                this.showToast('Offline capabilities updated!', 'success');
                break;
            case 'SYNC_COMPLETE':
                this.updateOfflineUI();
                break;
        }
    }

    formatRelativeTime(timestamp) {
        if (!timestamp) return 'Never';

        const now = Date.now();
        const diff = now - timestamp;

        const minute = 60 * 1000;
        const hour = minute * 60;
        const day = hour * 24;

        if (diff < minute) return 'just now';
        if (diff < hour) return Math.floor(diff / minute) + ' minutes ago';
        if (diff < day) return Math.floor(diff / hour) + ' hours ago';
        return Math.floor(diff / day) + ' days ago';
    }

    showToast(message, type = 'info') {
        // Use the app's toast method if available
        if (this.app && this.app.showToast) {
            this.app.showToast(message, type);
        } else {
            // Fallback toast
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    checkOfflineCapabilities() {
        // Check if offline features are supported
        const offlineSupported = 'serviceWorker' in navigator && 'indexedDB' in window;

        if (!offlineSupported) {
            console.warn('Some offline features not supported in this browser');

            // Disable offline UI elements
            const offlineElements = document.querySelectorAll('[data-offline-feature]');
            offlineElements.forEach(el => {
                el.style.opacity = '0.5';
                el.style.pointerEvents = 'none';
                el.title = 'Offline features not supported in this browser';
            });
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait for the main app to be initialized
    const initOfflineIntegration = () => {
        if (window.newsApp) {
            window.offlineIntegration = new OfflineIntegration(window.newsApp);
        } else {
            setTimeout(initOfflineIntegration, 100);
        }
    };

    initOfflineIntegration();
});