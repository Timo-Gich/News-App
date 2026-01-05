/**
 * OfflineManager Module
 * Main coordinator for offline operations and user experience
 */

class OfflineManager {
    constructor() {
        this.offlineStorage = new OfflineStorage();
        this.cacheController = new CacheController();

        this.isOnline = navigator.onLine;
        this.syncInProgress = false;
        this.storageUsage = { articles: 0, bookmarks: 0, queue: 0, totalSize: 0 };

        this.init();
    }

    /**
     * Initialize offline manager
     */
    async init() {
        // Set up event listeners
        this.setupEventListeners();

        // Initialize storage and cache
        await this.initializeOfflineCapabilities();

        // Update UI state
        this.updateUIState();

        // Start background sync if online
        if (this.isOnline) {
            this.startBackgroundSync();
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Online/offline events
        window.addEventListener('online', () => {
            this.handleOnline();
        });

        window.addEventListener('offline', () => {
            this.handleOffline();
        });

        // Page visibility for sync optimization
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isOnline) {
                this.syncOfflineActions();
            }
        });

        // Beforeunload for cleanup
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Storage quota monitoring
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            this.monitorStorageQuota();
        }
    }

    /**
     * Initialize offline capabilities
     */
    async initializeOfflineCapabilities() {
        try {
            // Initialize storage
            if (this.offlineStorage.isSupported) {
                await this.offlineStorage.init();
                this.storageUsage = await this.offlineStorage.getStorageUsage();
            }

            // Cache static assets
            if (this.cacheController.isServiceWorkerSupported) {
                await this.cacheController.cacheStaticAssets();
            }

            console.log('Offline capabilities initialized');
        } catch (error) {
            console.error('Failed to initialize offline capabilities:', error);
        }
    }

    /**
     * Handle online state
     */
    async handleOnline() {
        if (this.isOnline) return;

        this.isOnline = true;
        console.log('Back online, syncing offline actions...');

        // Update UI
        this.updateUIState();

        // Sync offline actions
        await this.syncOfflineActions();

        // Update storage usage
        this.storageUsage = await this.offlineStorage.getStorageUsage();
        this.updateStorageUI();

        // Show success message
        this.showToast('Back online! Syncing your offline actions...', 'success');
    }

    /**
     * Handle offline state
     */
    handleOffline() {
        if (!this.isOnline) return;

        this.isOnline = false;
        console.log('Going offline');

        // Update UI
        this.updateUIState();

        // Show warning message
        this.showToast('You are now offline. Some features may be limited.', 'warning');
    }

    /**
     * Save article for offline reading
     */
    async saveArticleForOffline(article) {
        try {
            // Store in IndexedDB
            const success = await this.offlineStorage.storeArticle(article);

            if (success) {
                // Cache images
                if (article.image && article.image !== "None") {
                    await this.cacheController.cacheImage(article.image, null);
                }

                // Update storage usage
                this.storageUsage = await this.offlineStorage.getStorageUsage();
                this.updateStorageUI();

                this.showToast('Article saved for offline reading!', 'success');
                return true;
            } else {
                this.showToast('Failed to save article offline.', 'error');
                return false;
            }
        } catch (error) {
            console.error('Error saving article offline:', error);
            this.showToast('Error saving article offline.', 'error');
            return false;
        }
    }

    /**
     * Remove article from offline storage
     */
    async removeArticleFromOffline(articleId) {
        try {
            const success = await this.offlineStorage.deleteArticle(articleId);

            if (success) {
                // Update storage usage
                this.storageUsage = await this.offlineStorage.getStorageUsage();
                this.updateStorageUI();

                this.showToast('Article removed from offline storage.', 'info');
                return true;
            } else {
                this.showToast('Failed to remove article from offline storage.', 'error');
                return false;
            }
        } catch (error) {
            console.error('Error removing article from offline storage:', error);
            this.showToast('Error removing article from offline storage.', 'error');
            return false;
        }
    }

    /**
     * Toggle bookmark with offline support
     */
    async toggleBookmark(articleId, isBookmarked, articleData = null) {
        try {
            // Update local storage immediately
            const success = await this.offlineStorage.toggleBookmark(articleId, isBookmarked);

            if (success) {
                if (this.isOnline) {
                    // Sync immediately if online
                    // (This would call your existing bookmark API)
                } else {
                    // Queue for sync if offline
                    await this.offlineStorage.queueAction('bookmark', {
                        article_id: articleId,
                        action: isBookmarked ? 'add' : 'remove',
                        article_data: articleData
                    });
                }

                this.showToast(isBookmarked ? 'Article bookmarked!' : 'Bookmark removed!', 'success');
                return true;
            } else {
                this.showToast('Failed to update bookmark.', 'error');
                return false;
            }
        } catch (error) {
            console.error('Error toggling bookmark:', error);
            this.showToast('Error updating bookmark.', 'error');
            return false;
        }
    }

    /**
     * Update reading progress with offline support
     */
    async updateReadingProgress(articleId, scrollPosition, readPercentage) {
        try {
            // Update local storage immediately
            const success = await this.offlineStorage.updateReadingProgress(articleId, scrollPosition, readPercentage);

            if (success && this.isOnline) {
                // Sync to server if online
                // (This would call your existing reading progress API)
            } else if (!this.isOnline) {
                // Queue for sync if offline
                await this.offlineStorage.queueAction('reading_progress', {
                    article_id: articleId,
                    scroll_position: scrollPosition,
                    read_percentage: readPercentage
                });
            }

            return success;
        } catch (error) {
            console.error('Error updating reading progress:', error);
            return false;
        }
    }

    /**
     * Search articles offline
     */
    async searchOfflineArticles(query) {
        try {
            const results = await this.offlineStorage.searchArticles(query);
            return results;
        } catch (error) {
            console.error('Error searching offline articles:', error);
            return [];
        }
    }

    /**
     * Get all offline articles
     */
    async getOfflineArticles() {
        try {
            const articles = await this.offlineStorage.getAllArticles();
            return articles;
        } catch (error) {
            console.error('Error getting offline articles:', error);
            return [];
        }
    }

    /**
     * Get all bookmarks
     */
    async getBookmarks() {
        try {
            const bookmarks = await this.offlineStorage.getBookmarks();
            return bookmarks;
        } catch (error) {
            console.error('Error getting bookmarks:', error);
            return [];
        }
    }

    /**
     * Sync offline actions to server
     */
    async syncOfflineActions() {
        if (!this.isOnline || this.syncInProgress) {
            return;
        }

        this.syncInProgress = true;

        try {
            const pendingActions = await this.offlineStorage.getPendingActions();

            for (const action of pendingActions) {
                try {
                    await this.processOfflineAction(action);
                    await this.offlineStorage.markActionSynced(action.id);
                } catch (error) {
                    console.error('Failed to sync action:', action, error);
                }
            }

            this.showToast('Offline actions synced successfully!', 'success');
        } catch (error) {
            console.error('Error syncing offline actions:', error);
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Process individual offline action
     */
    async processOfflineAction(action) {
        switch (action.action_type) {
            case 'bookmark':
                // Call your existing bookmark API
                console.log('Syncing bookmark action:', action.data);
                break;
            case 'reading_progress':
                // Call your existing reading progress API
                console.log('Syncing reading progress:', action.data);
                break;
            default:
                console.warn('Unknown action type:', action.action_type);
        }
    }

    /**
     * Start background sync
     */
    startBackgroundSync() {
        if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
            this.cacheController.registerBackgroundSync('sync-offline-actions');
        }

        // Also sync periodically
        setInterval(() => {
            if (this.isOnline) {
                this.syncOfflineActions();
            }
        }, 5 * 60 * 1000); // Every 5 minutes
    }

    /**
     * Monitor storage quota
     */
    async monitorStorageQuota() {
        try {
            const quota = await navigator.storage.estimate();
            const usagePercentage = (quota.usage / quota.quota) * 100;

            if (usagePercentage > 80) {
                this.handleStorageQuotaWarning(usagePercentage);
            }
        } catch (error) {
            console.error('Failed to monitor storage quota:', error);
        }
    }

    /**
     * Handle storage quota warning
     */
    handleStorageQuotaWarning(percentage) {
        this.showToast(`Storage usage is ${Math.round(percentage)}%. Consider cleaning up old articles.`, 'warning');
    }

    /**
     * Update UI state based on online/offline status
     */
    updateUIState() {
        // Update online status indicator
        const statusElement = document.getElementById('online-status');
        if (statusElement) {
            if (this.isOnline) {
                statusElement.className = 'online-status online';
                statusElement.innerHTML = '<i class="fas fa-wifi"></i> Online';
            } else {
                statusElement.className = 'online-status offline';
                statusElement.innerHTML = '<i class="fas fa-wifi-slash"></i> Offline';
            }
        }

        // Update storage usage
        this.updateStorageUI();
    }

    /**
     * Update storage usage UI
     */
    updateStorageUI() {
        // Update storage usage indicators
        const storageBar = document.getElementById('storage-usage-bar');
        const storageText = document.getElementById('storage-usage-text');

        if (storageBar && storageText) {
            const totalItems = this.storageUsage.totalSize;
            const percentage = Math.min((totalItems / 100) * 100, 100); // Simplified calculation

            storageBar.style.width = `${percentage}%`;
            storageText.textContent = `${totalItems} items stored`;

            // Color coding
            if (percentage > 80) {
                storageBar.style.backgroundColor = '#ef4444'; // Red
            } else if (percentage > 60) {
                storageBar.style.backgroundColor = '#f59e0b'; // Orange
            } else {
                storageBar.style.backgroundColor = '#10b981'; // Green
            }
        }
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            'success': 'fas fa-check-circle',
            'error': 'fas fa-exclamation-circle',
            'warning': 'fas fa-exclamation-triangle',
            'info': 'fas fa-info-circle'
        };

        toast.innerHTML = `
            <div class="toast-icon">
                <i class="${icons[type] || icons.info}"></i>
            </div>
            <div class="toast-message">${message}</div>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(toast);

        // Remove toast after 5 seconds
        setTimeout(() => {
            toast.remove();
        }, 5000);

        // Close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Save any pending data
        // Clean up event listeners if needed
        console.log('Cleaning up offline manager');
    }

    /**
     * Get offline status summary
     */
    getOfflineStatus() {
        return {
            isOnline: this.isOnline,
            storageUsage: this.storageUsage,
            syncInProgress: this.syncInProgress,
            storageSupported: this.offlineStorage.isSupported,
            cacheSupported: this.cacheController.isServiceWorkerSupported
        };
    }

    /**
     * Clear all offline data (for debugging/reset)
     */
    async clearAllOfflineData() {
        try {
            // Clear IndexedDB
            await this.offlineStorage.clearAllData();

            // Clear cache
            await this.cacheController.clearCache('all');

            // Update UI
            this.storageUsage = { articles: 0, bookmarks: 0, queue: 0, totalSize: 0 };
            this.updateStorageUI();

            this.showToast('All offline data cleared.', 'info');
            return true;
        } catch (error) {
            console.error('Error clearing offline data:', error);
            this.showToast('Error clearing offline data.', 'error');
            return false;
        }
    }

    /**
     * Pre-cache likely next articles for better performance
     */
    async preCacheNextArticles(articles) {
        if (!this.isOnline) return;

        try {
            // Cache images for next few articles
            const nextArticles = articles.slice(0, 3);
            for (const article of nextArticles) {
                if (article.image && article.image !== "None") {
                    await this.cacheController.cacheImage(article.image, null);
                }
            }

            // Pre-cache article content
            await this.cacheController.preCacheArticles(nextArticles);
        } catch (error) {
            console.error('Error pre-caching articles:', error);
        }
    }

    /**
     * Cleanup old data based on retention policy
     */
    async cleanupOldData() {
        try {
            // Clean up old articles (30-day retention)
            await this.offlineStorage.cleanupOldArticles();

            // Update storage usage
            this.storageUsage = await this.offlineStorage.getStorageUsage();
            this.updateStorageUI();

            this.showToast('Old offline data cleaned up.', 'info');
        } catch (error) {
            console.error('Error cleaning up old data:', error);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineManager;
} else {
    window.OfflineManager = OfflineManager;
}