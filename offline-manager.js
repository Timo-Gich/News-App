// offline-manager.js - Main Coordinator for Offline Features

class OfflineManager {
    constructor() {
        this.storage = new OfflineStorage();
        this.cacheController = new CacheController();

        this.isOnline = navigator.onLine;
        this.offlineMode = false;
        this.syncInProgress = false;

        this.stats = {
            totalArticles: 0,
            offlineArticles: 0,
            storageUsage: 0,
            lastSync: null
        };
    }

    async init() {
        console.log('Initializing Offline Manager...');

        // Initialize storage
        const storageInitialized = await this.storage.init();
        if (!storageInitialized) {
            console.warn('Offline storage initialization failed');
        }

        // Initialize cache controller
        const cacheInitialized = await this.cacheController.init();
        if (!cacheInitialized) {
            console.warn('Cache controller initialization failed');
        }

        // Set up online/offline listeners
        this.setupNetworkListeners();

        // Update initial stats
        await this.updateStats();

        // Check if we should start in offline mode
        this.checkInitialConnection();

        console.log('Offline Manager initialized');
        return true;
    }

    setupNetworkListeners() {
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());

        // Listen for service worker messages
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                this.handleServiceWorkerMessage(event);
            });
        }
    }

    checkInitialConnection() {
        this.isOnline = navigator.onLine;

        if (!this.isOnline) {
            this.enableOfflineMode();
            this.showOfflineIndicator();
        } else {
            this.disableOfflineMode();
            this.hideOfflineIndicator();
        }
    }

    async handleOnline() {
        console.log('Network: Online');
        this.isOnline = true;
        this.disableOfflineMode();
        this.hideOfflineIndicator();

        // Try to sync pending actions
        await this.syncPendingActions();

        // Update cache in background
        this.updateCacheInBackground();

        // Update stats
        await this.updateStats();

        // Show online notification
        this.showToast('Back online! Syncing your data...', 'success');
    }

    async handleOffline() {
        console.log('Network: Offline');
        this.isOnline = false;
        this.enableOfflineMode();
        this.showOfflineIndicator();

        // Update stats
        await this.updateStats();

        // Show offline notification
        this.showToast('You are offline. Using cached articles.', 'warning');
    }

    enableOfflineMode() {
        this.offlineMode = true;
        document.body.classList.add('offline-mode');

        // Update UI elements
        this.updateConnectionStatus('offline');
    }

    disableOfflineMode() {
        this.offlineMode = false;
        document.body.classList.remove('offline-mode');

        // Update UI elements
        this.updateConnectionStatus('online');
    }

    async saveArticleForOffline(article) {
        if (!article || !article.id) {
            throw new Error('Invalid article');
        }

        try {
            // Save to IndexedDB
            const saved = await this.storage.saveArticle(article, true);

            if (saved) {
                // Cache the article image if available
                if (article.image && article.image !== "None") {
                    await this.cacheArticleImage(article.image);
                }

                // Update stats
                await this.updateStats();

                // Show success message
                this.showToast('Article saved for offline reading!', 'success');

                return true;
            }

            return false;
        } catch (error) {
            console.error('Failed to save article for offline:', error);
            this.showToast('Failed to save article for offline', 'error');
            return false;
        }
    }

    async cacheArticleImage(imageUrl) {
        if (!imageUrl || !this.isOnline) return false;

        try {
            const response = await fetch(imageUrl);
            if (response.ok) {
                await this.cacheController.cacheImage(imageUrl, response.clone());
                return true;
            }
        } catch (error) {
            console.error('Failed to cache image:', error);
        }

        return false;
    }

    async getOfflineArticles(limit = 50, offset = 0) {
        try {
            const articles = await this.storage.getOfflineArticles(limit, offset);
            return articles;
        } catch (error) {
            console.error('Failed to get offline articles:', error);
            return [];
        }
    }

    async searchOfflineArticles(query, filters = {}) {
        try {
            const articles = await this.storage.searchArticles(query, filters);
            return articles;
        } catch (error) {
            console.error('Failed to search offline articles:', error);
            return [];
        }
    }

    async getArticleWithOfflineStatus(articleId) {
        try {
            // Get article from IndexedDB
            const offlineArticle = await this.storage.getArticle(articleId);

            if (offlineArticle) {
                // Check if it's saved for offline
                return {
                    ...offlineArticle,
                    availableOffline: offlineArticle.savedForOffline || false,
                    read: offlineArticle.read || false
                };
            }

            return null;
        } catch (error) {
            console.error('Failed to get article offline status:', error);
            return null;
        }
    }

    async updateReadingProgress(articleId, progress) {
        try {
            await this.storage.updateReadingProgress(articleId, progress);

            // Queue sync action if online
            if (this.isOnline) {
                await this.storage.queueOfflineAction({
                    type: 'update_progress',
                    articleId: articleId,
                    progress: progress
                });
            }

            return true;
        } catch (error) {
            console.error('Failed to update reading progress:', error);
            return false;
        }
    }

    async toggleBookmark(article) {
        try {
            const result = await this.storage.toggleBookmark(article);

            // Queue sync action if online
            if (this.isOnline) {
                await this.storage.queueOfflineAction({
                    type: 'bookmark',
                    articleId: article.id,
                    bookmarked: result.bookmarked,
                    article: article
                });
            }

            // Update stats
            await this.updateStats();

            this.showToast(
                result.bookmarked ? 'Article bookmarked!' : 'Bookmark removed!',
                result.bookmarked ? 'success' : 'info'
            );

            return result;
        } catch (error) {
            console.error('Failed to toggle bookmark:', error);
            this.showToast('Failed to update bookmark', 'error');
            return { bookmarked: false };
        }
    }

    async isArticleBookmarked(articleId) {
        try {
            return await this.storage.isArticleBookmarked(articleId);
        } catch (error) {
            console.error('Failed to check bookmark status:', error);
            return false;
        }
    }

    async getBookmarkedArticles() {
        try {
            return await this.storage.getBookmarkedArticles();
        } catch (error) {
            console.error('Failed to get bookmarked articles:', error);
            return [];
        }
    }

    async syncPendingActions() {
        if (this.syncInProgress || !this.isOnline) {
            return;
        }

        this.syncInProgress = true;

        try {
            const pendingActions = await this.storage.getPendingActions();

            if (pendingActions.length === 0) {
                this.syncInProgress = false;
                return;
            }

            console.log(`Syncing ${pendingActions.length} pending actions...`);

            let successCount = 0;
            let failCount = 0;

            for (const action of pendingActions) {
                try {
                    // Here you would sync with your backend
                    // For now, we'll just mark as completed
                    await this.storage.updateActionStatus(action.id, 'completed');
                    successCount++;

                    // Simulate API call delay
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                    console.error('Failed to sync action:', error);
                    await this.storage.updateActionStatus(action.id, 'failed');
                    failCount++;
                }
            }

            console.log(`Sync completed: ${successCount} succeeded, ${failCount} failed`);

            if (successCount > 0) {
                this.showToast(`Synced ${successCount} actions`, 'success');
            }

            // Update last sync time
            this.stats.lastSync = new Date().toISOString();
            await this.storage.setSetting('lastSync', this.stats.lastSync);

        } catch (error) {
            console.error('Sync failed:', error);
        } finally {
            this.syncInProgress = false;
        }
    }

    async updateCacheInBackground() {
        if (!this.isOnline) return;

        try {
            // Update latest news cache
            await this.cacheController.sendMessageToServiceWorker({
                type: 'UPDATE_CACHE',
                timestamp: Date.now()
            });

            // Clean up expired cache
            await this.cacheController.cleanupExpiredCache();

            console.log('Background cache update completed');
        } catch (error) {
            console.error('Background cache update failed:', error);
        }
    }

    async updateStats() {
        try {
            // Get storage stats
            const storageStats = await this.storage.getStorageStats();
            if (storageStats) {
                this.stats.totalArticles = storageStats.totalArticles || 0;
                this.stats.offlineArticles = storageStats.offlineArticles || 0;
                this.stats.readArticles = storageStats.readArticles || 0;
                this.stats.bookmarkedArticles = storageStats.bookmarkedArticles || 0;
            }

            // Get storage usage
            const storageUsage = await this.storage.estimateStorageUsage();
            if (storageUsage) {
                this.stats.storageUsage = storageUsage.usage || 0;
                this.stats.storageQuota = storageUsage.quota || 0;
                this.stats.storagePercentage = storageUsage.percentage || 0;
            }

            // Get last sync time
            const lastSync = await this.storage.getSetting('lastSync');
            this.stats.lastSync = lastSync;

            // Update UI
            this.updateStatsUI();

            return this.stats;
        } catch (error) {
            console.error('Failed to update stats:', error);
            return this.stats;
        }
    }

    updateStatsUI() {
        // Update offline count in stats bar
        const offlineCountEl = document.getElementById('offline-count');
        if (offlineCountEl) {
            offlineCountEl.textContent = this.stats.offlineArticles;
        }

        // Update storage progress bar
        const storageBar = document.getElementById('storage-bar');
        const storageText = document.getElementById('storage-text');

        if (storageBar && storageText) {
            const percentage = this.stats.storagePercentage;
            const usedMB = Math.round(this.stats.storageUsage / (1024 * 1024) * 100) / 100;
            const quotaMB = Math.round(this.stats.storageQuota / (1024 * 1024) * 100) / 100;

            storageBar.style.width = Math.min(percentage, 100) + '%';
            storageBar.style.backgroundColor = percentage > 90 ? '#ef4444' :
                percentage > 70 ? '#f59e0b' : '#10b981';

            storageText.textContent = `${usedMB} MB of ${quotaMB} MB used`;
        }
    }

    updateConnectionStatus(status) {
        const connectionStatusEl = document.getElementById('connection-status');
        const offlineIndicatorEl = document.getElementById('offline-indicator');

        if (connectionStatusEl) {
            connectionStatusEl.className = `connection-status ${status}`;
            connectionStatusEl.querySelector('.status-text').textContent =
                status === 'online' ? 'Online' : 'Offline';
        }

        if (offlineIndicatorEl) {
            offlineIndicatorEl.style.display = status === 'offline' ? 'flex' : 'none';
        }
    }

    showOfflineIndicator() {
        const indicator = document.getElementById('offline-indicator');
        if (indicator) {
            indicator.style.display = 'flex';
            indicator.innerHTML = '<i class="fas fa-wifi-slash"></i><span>Offline</span>';
        }
    }

    hideOfflineIndicator() {
        const indicator = document.getElementById('offline-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    async clearOldArticles(days = 30) {
        try {
            const deletedCount = await this.storage.clearOldArticles(days);

            // Also clean expired cache
            await this.cacheController.cleanupExpiredCache();

            // Update stats
            await this.updateStats();

            this.showToast(`Cleared ${deletedCount} old articles`, 'success');
            return deletedCount;
        } catch (error) {
            console.error('Failed to clear old articles:', error);
            this.showToast('Failed to clear old articles', 'error');
            return 0;
        }
    }

    async clearAllOfflineData() {
        if (!confirm('Are you sure you want to clear all offline data? This cannot be undone.')) {
            return false;
        }

        try {
            // Clear IndexedDB
            await this.storage.clearAllData();

            // Clear cache
            await this.cacheController.clearAllCache();

            // Update stats
            await this.updateStats();

            this.showToast('All offline data cleared', 'success');
            return true;
        } catch (error) {
            console.error('Failed to clear offline data:', error);
            this.showToast('Failed to clear offline data', 'error');
            return false;
        }
    }

    async exportLibrary() {
        try {
            const articles = await this.storage.getOfflineArticles(1000, 0);
            const bookmarks = await this.storage.getBookmarkedArticles();

            const exportData = {
                version: '1.0',
                exportedAt: new Date().toISOString(),
                articles: articles,
                bookmarks: bookmarks,
                stats: this.stats
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `currents-news-library-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showToast('Library exported successfully', 'success');
            return true;
        } catch (error) {
            console.error('Failed to export library:', error);
            this.showToast('Failed to export library', 'error');
            return false;
        }
    }

    handleServiceWorkerMessage(event) {
        const { data } = event;

        switch (data.type) {
            case 'CACHE_UPDATED':
                console.log('Cache updated via service worker');
                break;

            case 'BACKGROUND_SYNC_COMPLETED':
                console.log('Background sync completed');
                this.showToast('Background sync completed', 'info');
                break;

            case 'NEW_CONTENT_AVAILABLE':
                console.log('New content available');
                this.showToast('New content is available. Refresh to see it.', 'info');
                break;
        }
    }

    showToast(message, type = 'info') {
        // Create toast element
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
            if (toast.parentNode) {
                toast.remove();
            }
        }, 5000);

        // Close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });
    }

    async prefetchRelatedArticles(currentArticle) {
        if (!this.isOnline) return;

        try {
            // Get articles from same category
            const offlineArticles = await this.storage.searchArticles('', {
                category: currentArticle.category && currentArticle.category[0]
            });

            // Prefetch images for related articles
            const articlesToPrefetch = offlineArticles
                .filter(article => article.id !== currentArticle.id)
                .slice(0, 3);

            await this.cacheController.prefetchArticleImages(articlesToPrefetch);
        } catch (error) {
            // Silent fail for prefetching
        }
    }

    async getCacheStats() {
        try {
            const cacheStats = await this.cacheController.getCacheStats();
            const storageStats = await this.storage.getStorageStats();

            return {
                cache: cacheStats,
                storage: storageStats,
                total: cacheStats.total + (storageStats.totalArticles * 50) // Estimate
            };
        } catch (error) {
            console.error('Failed to get cache stats:', error);
            return null;
        }
    }

    // ===== HYBRID OFFLINE DOWNLOAD SYSTEM =====

    // Smart Auto-Download Controller (Background, Small)
    async autoDownloadLatestPages() {
        try {
            // Check if auto-download already ran this session
            const sessionStatus = await this.storage.getSessionAutoDownloadStatus();
            if (sessionStatus) {
                console.log('[AutoDownload] Already ran this session, skipping');
                return;
            }

            // Check prerequisites
            if (!this.isOnline) {
                console.log('[AutoDownload] Offline, skipping auto-download');
                return;
            }

            if (!navigator.onLine) {
                console.log('[AutoDownload] Navigator offline, skipping');
                return;
            }

            // Check connection quality (Wi-Fi preferred)
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (connection) {
                // Skip if on cellular connection (unless explicitly allowed)
                if (connection.effectiveType && connection.effectiveType.includes('2g')) {
                    console.log('[AutoDownload] Poor connection, skipping');
                    return;
                }
            }

            // Check battery level (if available)
            if (navigator.getBattery) {
                try {
                    const battery = await navigator.getBattery();
                    if (battery.level < 0.2) {
                        console.log('[AutoDownload] Low battery, skipping');
                        return;
                    }
                } catch (error) {
                    console.log('[AutoDownload] Battery check failed, proceeding');
                }
            }

            // Check storage quota
            const storageUsage = await this.storage.estimateStorageUsage();
            if (storageUsage.percentage > 80) {
                console.log('[AutoDownload] Storage nearly full, skipping');
                return;
            }

            console.log('[AutoDownload] Starting auto-download of pages 1-2');

            // Download pages 1 and 2 of latest news
            const downloadPromises = [];
            for (let pageNum = 1; pageNum <= 2; pageNum++) {
                downloadPromises.push(this.downloadPageForOffline(pageNum, 'latest', 'auto'));
            }

            const results = await Promise.allSettled(downloadPromises);
            const successfulDownloads = results.filter(r => r.status === 'fulfilled').length;

            if (successfulDownloads > 0) {
                // Mark auto-download as completed for this session
                await this.storage.setSessionAutoDownloadStatus(true);
                await this.storage.setLastAutoDownloadTime(new Date().toISOString());

                console.log(`[AutoDownload] Completed: ${successfulDownloads} pages downloaded`);
                this.showToast(`Auto-downloaded ${successfulDownloads} pages for offline reading`, 'success');
            }

        } catch (error) {
            console.error('[AutoDownload] Failed:', error);
        }
    }

    // Manual Bulk Download Controller (User-Controlled, Large)
    async manualDownloadLatestPages(pageCount = 15) {
        try {
            // Check if online
            if (!this.isOnline || !navigator.onLine) {
                this.showToast('You must be online to download articles', 'error');
                return false;
            }

            // Check storage quota
            const storageUsage = await this.storage.estimateStorageUsage();
            if (storageUsage.percentage > 80) {
                this.showToast('Storage nearly full. Please clear some space first.', 'warning');
                return false;
            }

            // Estimate download size
            const sizeEstimate = await this.storage.estimateDownloadSize(pageCount);
            const proceed = confirm(
                `Download ${pageCount} pages (${sizeEstimate.sizeText})?\n\n` +
                `Estimated: ${sizeEstimate.articles} articles\n` +
                `Storage used: ${sizeEstimate.sizeText}\n\n` +
                `This will download the latest news pages for offline reading.`
            );

            if (!proceed) {
                return false;
            }

            console.log(`[ManualDownload] Starting download of ${pageCount} pages`);

            // Show progress UI
            this.showDownloadProgress(true, 0, pageCount);

            let downloadedPages = 0;
            let totalSizeMB = 0;
            let cancelled = false;

            // Download pages sequentially
            for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
                // Check if cancelled
                if (cancelled) {
                    console.log('[ManualDownload] Cancelled by user');
                    this.showToast('Download cancelled', 'info');
                    break;
                }

                try {
                    const result = await this.downloadPageForOffline(pageNum, 'latest', 'manual');
                    if (result.success) {
                        downloadedPages++;
                        totalSizeMB += result.sizeMB;

                        // Update progress
                        this.updateDownloadProgress(downloadedPages, pageCount, result.sizeMB);
                    } else {
                        console.log(`[ManualDownload] Failed to download page ${pageNum}`);
                    }
                } catch (error) {
                    console.error(`[ManualDownload] Error downloading page ${pageNum}:`, error);
                }
            }

            // Hide progress UI
            this.showDownloadProgress(false);

            if (downloadedPages > 0) {
                this.showToast(
                    `Downloaded ${downloadedPages} pages (${totalSizeMB.toFixed(1)} MB)`,
                    'success'
                );

                // Update stats
                await this.updateStats();
                return true;
            } else {
                this.showToast('No pages were downloaded', 'warning');
                return false;
            }

        } catch (error) {
            console.error('[ManualDownload] Failed:', error);
            this.showToast('Download failed', 'error');
            return false;
        }
    }

    // Helper: Download a single page for offline
    async downloadPageForOffline(pageNum, source, origin) {
        try {
            // Fetch articles for this page
            const apiResponse = await this._fetchFromAPI({
                source: 'latest',
                category: null,
                query: null,
                filters: {},
                language: this.currentLanguage || 'en',
                apiKey: this.apiKey,
                baseUrl: this.baseUrl,
                pageNum: pageNum,
                pageSize: 12
            });

            if (!apiResponse.articles || apiResponse.articles.length === 0) {
                return { success: false, sizeMB: 0 };
            }

            // Cache the page
            const cached = await this.storage.cacheArticlesPage(apiResponse.articles, pageNum, source, origin);

            if (cached) {
                const sizeMB = this.storage.calculateArticlesSize(apiResponse.articles);
                console.log(`[Download] Cached page ${pageNum} (${apiResponse.articles.length} articles, ${sizeMB.toFixed(2)}MB)`);
                return { success: true, sizeMB: sizeMB };
            } else {
                return { success: false, sizeMB: 0 };
            }

        } catch (error) {
            console.error(`[Download] Failed to download page ${pageNum}:`, error);
            return { success: false, sizeMB: 0 };
        }
    }

    // Download Progress UI Management
    showDownloadProgress(show, current = 0, total = 0) {
        const progressContainer = document.getElementById('download-progress-container');
        if (!progressContainer) return;

        if (show) {
            progressContainer.style.display = 'block';
            progressContainer.querySelector('.progress-count').textContent = `${current}/${total}`;
            progressContainer.querySelector('.progress-bar-fill').style.width = '0%';
            progressContainer.querySelector('.progress-text').textContent = 'Downloading...';
        } else {
            progressContainer.style.display = 'none';
        }
    }

    updateDownloadProgress(current, total, pageMB) {
        const progressContainer = document.getElementById('download-progress-container');
        if (!progressContainer) return;

        const percentage = (current / total) * 100;
        const progressFill = progressContainer.querySelector('.progress-bar-fill');
        const progressText = progressContainer.querySelector('.progress-text');
        const progressCount = progressContainer.querySelector('.progress-count');

        progressFill.style.width = `${percentage}%`;
        progressText.textContent = `Downloading page ${current} (${pageMB.toFixed(2)} MB)`;
        progressCount.textContent = `${current}/${total}`;

        // Update color based on progress
        if (percentage > 90) {
            progressFill.style.backgroundColor = '#10b981';
        } else if (percentage > 50) {
            progressFill.style.backgroundColor = '#f59e0b';
        }
    }

    // Cancel download handler
    cancelDownload() {
        // This would be called from UI button
        console.log('[ManualDownload] Cancel requested');
        // Implementation would need to track active downloads
    }

    // ===== UNIFIED DATA FETCHER: Online/Offline/Cache Pipeline =====
    async fetchArticles(params = {}) {
        const {
            source = 'latest', // 'latest', 'category', 'search'
                category = null,
                query = null,
                filters = {},
                pageNum = 1,
                pageSize = 12,
                language = 'en',
                apiKey = null,
                baseUrl = null
        } = params;

        console.log(`[DataFetcher] Fetching ${source} (page ${pageNum}, online: ${this.isOnline})`);

        // ===== SPECIAL HANDLING FOR SEARCH =====
        if (source === 'search' && query) {
            // Step 1: Try cached search results first
            const cachedResults = await this.storage.getCachedSearchResults(query, filters);
            if (cachedResults && cachedResults.length > 0) {
                console.log(`[DataFetcher] Using cached search results for "${query}" (${cachedResults.length} articles)`);
                return {
                    articles: cachedResults,
                    source: 'search_cache',
                    pageNum: pageNum,
                    isCached: true,
                    totalResults: cachedResults.length
                };
            }

            // Step 2: If online, perform API search
            if (this.isOnline && apiKey && baseUrl) {
                try {
                    console.log(`[DataFetcher] Performing API search for "${query}"`);
                    const apiResponse = await this._fetchFromAPI({
                        source: 'search',
                        query,
                        filters,
                        language,
                        apiKey,
                        baseUrl,
                        pageNum,
                        pageSize
                    });

                    if (apiResponse.articles && apiResponse.articles.length > 0) {
                        // Cache search results for future use
                        await this.storage.cacheSearchResults(query, filters, apiResponse.articles);

                        console.log(`[DataFetcher] Search found ${apiResponse.articles.length} articles from API`);
                        return {
                            articles: apiResponse.articles,
                            source: 'search_api',
                            pageNum: pageNum,
                            isCached: false,
                            totalResults: apiResponse.totalResults,
                            hasMore: apiResponse.hasMore
                        };
                    }
                } catch (error) {
                    console.warn(`[DataFetcher] Search API failed: ${error.message}`);
                    // Fall through to offline search
                }
            }

            // Step 3: Offline search fallback
            try {
                console.log(`[DataFetcher] Performing offline search for "${query}"`);
                const offlineResults = await this.storage.searchOfflineArticles(query, filters);

                if (offlineResults && offlineResults.length > 0) {
                    console.log(`[DataFetcher] Offline search found ${offlineResults.length} articles`);
                    return {
                        articles: offlineResults,
                        source: 'search_offline',
                        pageNum: pageNum,
                        isCached: true,
                        totalResults: offlineResults.length
                    };
                }
            } catch (error) {
                console.warn(`[DataFetcher] Offline search failed: ${error.message}`);
            }

            // No search results found
            return {
                articles: [],
                source: 'search_empty',
                pageNum: pageNum,
                isCached: false,
                totalResults: 0
            };
        }

        // ===== STANDARD ARTICLE FETCHING (non-search) =====

        // Step 1: Try to get cached page first (if offline or as fallback)
        if (!this.isOnline) {
            const cachedPage = await this.storage.getArticlesPage(pageNum, source);
            if (cachedPage && cachedPage.length > 0) {
                console.log(`[DataFetcher] Using cached page ${pageNum} (${cachedPage.length} articles)`);
                return {
                    articles: cachedPage,
                    source: 'cache',
                    pageNum: pageNum,
                    isCached: true
                };
            }
        }

        // Step 2: If online, try API
        if (this.isOnline && apiKey && baseUrl) {
            try {
                const apiResponse = await this._fetchFromAPI({
                    source,
                    category,
                    query,
                    filters,
                    language,
                    apiKey,
                    baseUrl,
                    pageNum,
                    pageSize
                });

                if (apiResponse.articles && apiResponse.articles.length > 0) {
                    // Cache this page for offline use
                    await this.cacheArticlesPage(apiResponse.articles, pageNum, source);

                    console.log(`[DataFetcher] Fetched ${apiResponse.articles.length} articles from API`);
                    return {
                        articles: apiResponse.articles,
                        source: 'api',
                        pageNum: pageNum,
                        isCached: false,
                        totalResults: apiResponse.totalResults,
                        hasMore: apiResponse.hasMore
                    };
                }
            } catch (error) {
                console.warn(`[DataFetcher] API fetch failed: ${error.message}`);
                // Fall through to offline fallback
            }
        }

        // Step 3: Fallback: Try IndexedDB (all saved articles)
        try {
            const offlineArticles = await this.storage.getOfflineArticles(pageSize, (pageNum - 1) * pageSize);
            if (offlineArticles && offlineArticles.length > 0) {
                console.log(`[DataFetcher] Using IndexedDB fallback (${offlineArticles.length} articles)`);
                return {
                    articles: offlineArticles,
                    source: 'offline',
                    pageNum: pageNum,
                    isCached: true
                };
            }
        } catch (error) {
            console.warn(`[DataFetcher] IndexedDB fallback failed: ${error.message}`);
        }

        // Step 4: Try cached pages from latest news
        try {
            const cachedPages = await this.storage.getAllCachedPages('latest');
            if (cachedPages.length > 0) {
                // Merge all cached pages into one array
                const allCachedArticles = cachedPages.flatMap(page => page.articles);

                if (allCachedArticles.length > 0) {
                    console.log(`[DataFetcher] Using cached pages (${allCachedArticles.length} articles)`);
                    return {
                        articles: allCachedArticles,
                        source: 'cached_pages',
                        pageNum: pageNum,
                        isCached: true
                    };
                }
            }
        } catch (error) {
            console.warn(`[DataFetcher] Cached pages fallback failed: ${error.message}`);
        }

        // No data available
        throw new Error('No articles available (offline and no cache)');
    }

    // ===== HELPER: Fetch from API with proper error handling =====
    async _fetchFromAPI(params) {
        const { source, category, query, filters, language, apiKey, baseUrl, pageNum, pageSize } = params;

        let url = `${baseUrl}/latest-news?language=${language}&page=${pageNum}&page_size=${pageSize}&apiKey=${apiKey}`;

        if (source === 'category' && category) {
            url = `${baseUrl}/latest-news?language=${language}&category=${encodeURIComponent(category)}&page=${pageNum}&page_size=${pageSize}&apiKey=${apiKey}`;
        } else if (source === 'search' && query) {
            url = `${baseUrl}/search?language=${language}&keywords=${encodeURIComponent(query)}&page=${pageNum}&page_size=${pageSize}&apiKey=${apiKey}`;

            if (filters.start_date && filters.end_date) {
                url += `&start_date=${filters.start_date}&end_date=${filters.end_date}`;
            }
            if (filters.domain) {
                url += `&domain=${encodeURIComponent(filters.domain)}`;
            }
            if (filters.category) {
                url += `&category=${encodeURIComponent(filters.category)}`;
            }
        }

        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Invalid API key');
            }
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        return {
            articles: data.news || [],
            totalResults: data.totalResults || data.total || 0,
            page: data.page || pageNum,
            hasMore: data.hasMore || false
        };
    }

    // ===== HELPER: Cache articles page for offline use =====
    async cacheArticlesPage(articles, pageNum, source) {
        if (!articles || articles.length === 0) return;

        try {
            // Store page metadata for retrieval
            await this.storage.cacheArticlesPage(articles, pageNum, source);
            console.log(`[DataFetcher] Cached page ${pageNum} for source "${source}"`);
        } catch (error) {
            console.warn(`[DataFetcher] Failed to cache page: ${error.message}`);
        }
    }
}
