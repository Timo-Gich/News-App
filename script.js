// Currents News API Application - Enhanced with Offline Capabilities
class CurrentsNewsApp {
    constructor() {
        this.apiKey = null;
        this.baseUrl = 'https://api.currentsapi.services/v1';
        this.currentPage = 1;
        this.pageSize = 12;
        this.totalPages = 1;
        this.currentCategory = 'latest';
        this.currentLanguage = 'en';
        this.searchQuery = '';
        this.filters = {
            start_date: '',
            end_date: '',
            category: '',
            domain: '',
            keywords: ''
        };
        this.articles = [];
        this.bookmarks = JSON.parse(localStorage.getItem('currents_bookmarks') || '[]');
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';
        this.deferredPrompt = null;

        // === NEW: Offline capabilities state ===
        this.offlineMode = false;
        this.offlineArticles = [];
        this.cacheInfo = {
            totalArticles: 0,
            lastSync: null,
            cacheSize: '0 MB'
        };
        this.offlineActionsQueue = JSON.parse(localStorage.getItem('offlineActionsQueue') || '[]');

        // Initialize the app
        this.init();
    }

    // ==================== ENHANCED INITIALIZATION ====================
    init() {
        // Set up theme
        this.setTheme(this.isDarkMode);

        // Check for saved API key
        const savedKey = localStorage.getItem('currents_api_key');
        if (savedKey) {
            this.apiKey = savedKey;
            this.hideApiKeyModal();
            this.loadLatestNews();
        } else {
            this.showApiKeyModal();
        }

        // Set up event listeners
        this.setupEventListeners();

        // Update dates for filters
        this.updateDateFilters();

        // Register service worker
        this.registerServiceWorker();

        // === NEW: Initialize offline capabilities ===
        this.initOfflineCapabilities();

        // Check initial online status
        this.checkOnlineStatus();
    }

    // === NEW: Initialize offline capabilities ===
    initOfflineCapabilities() {
        console.log('Initializing offline capabilities...');

        // Check if IndexedDB is available
        if (!window.indexedDB) {
            console.warn('IndexedDB not supported - offline features limited');
            this.showToast('Some offline features not available in this browser', 'warning');
        }

        // Load offline articles count
        this.updateOfflineStats();

        // Process any queued offline actions
        this.processOfflineActionsQueue();

        // Set up periodic cache updates when online
        this.setupCacheUpdateInterval();
    }

    // === NEW: Update offline statistics ===
    async updateOfflineStats() {
        try {
            // Get cache info from service worker
            const cacheInfo = await this.getCacheInfo();
            this.cacheInfo = cacheInfo;

            // Update UI if elements exist
            const offlineStats = document.getElementById('offline-stats');
            if (offlineStats) {
                offlineStats.innerHTML = `
                    <i class="fas fa-download"></i>
                    <span>${cacheInfo.totalArticles} articles offline</span>
                `;
            }

            // Update last sync time
            const lastSync = document.getElementById('last-sync');
            if (lastSync && cacheInfo.lastSync) {
                lastSync.textContent = this.formatRelativeTime(cacheInfo.lastSync);
            }

        } catch (error) {
            console.log('Could not update offline stats:', error);
        }
    }

    // ==================== ENHANCED EVENT LISTENERS ====================
    setupEventListeners() {
        // Helper function to safely add event listeners
        const addListener = (selector, event, handler) => {
            const element = typeof selector === 'string' ?
                document.querySelector(selector) :
                document.getElementById(selector);
            if (element) {
                element.addEventListener(event, handler);
            }
        };

        // Helper function for ID elements
        const addIdListener = (id, event, handler) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
            }
        };

        // Helper function for class elements
        const addClassListener = (className, event, handler) => {
            const element = document.querySelector(className);
            if (element) {
                element.addEventListener(event, handler);
            }
        };

        // === EXISTING LISTENERS (unchanged) ===
        // Theme toggle
        addClassListener('.theme-toggle', 'click', () => {
            this.toggleTheme();
        });

        // Navigation category clicks
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const category = e.currentTarget.dataset.category;
                this.setActiveCategory(category);
                this.loadCategoryNews(category);
            });
        });

        // Language change
        addIdListener('language-select', 'change', (e) => {
            this.currentLanguage = e.target.value;
            this.updateStats();
            this.loadCategoryNews(this.currentCategory);
        });

        // Search
        addIdListener('search-btn', 'click', () => {
            this.performSearch();
        });

        addIdListener('search-input', 'keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        // Advanced filters toggle
        addIdListener('advanced-toggle', 'click', () => {
            const filters = document.getElementById('advanced-filters');
            if (filters) {
                filters.classList.toggle('show');
            }
        });

        // Apply filters
        addIdListener('apply-filters', 'click', () => {
            this.applyFilters();
        });

        // Clear filters
        addIdListener('clear-filters', 'click', () => {
            this.clearFilters();
        });

        // Pagination
        addIdListener('prev-page', 'click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.loadArticles();
            }
        });

        addIdListener('next-page', 'click', () => {
            if (this.currentPage < this.totalPages) {
                this.currentPage++;
                this.loadArticles();
            }
        });

        // Historical search
        addIdListener('historical-search-btn', 'click', () => {
            this.performHistoricalSearch();
        });

        addIdListener('historical-search', 'keypress', (e) => {
            if (e.key === 'Enter') {
                this.performHistoricalSearch();
            }
        });

        // Refresh news
        addIdListener('refresh-news', 'click', (e) => {
            e.preventDefault();
            this.loadCategoryNews(this.currentCategory);
        });

        // Retry button
        addIdListener('retry-btn', 'click', () => {
            this.loadCategoryNews(this.currentCategory);
        });

        // API Key modal
        addIdListener('save-key-btn', 'click', () => {
            this.saveApiKey();
        });

        addIdListener('try-demo-btn', 'click', () => {
            this.useDemoMode();
        });

        // Reset API key
        addIdListener('reset-api-key', 'click', (e) => {
            e.preventDefault();
            this.resetApiKey();
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('article-modal');
            if (e.target === modal) {
                this.hideArticleModal();
            }
        });

        // Modal close buttons
        addIdListener('modal-close', 'click', () => {
            this.hideArticleModal();
        });

        // Mobile menu toggle
        addClassListener('.nav-toggle', 'click', () => {
            const navMenu = document.querySelector('.nav-menu');
            if (navMenu) {
                navMenu.classList.toggle('show');
            }
        });

        // Close mobile menu when clicking a link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                const navMenu = document.querySelector('.nav-menu');
                if (navMenu) {
                    navMenu.classList.remove('show');
                }
            });
        });

        // PWA Install button
        addIdListener('install-btn', 'click', () => {
            this.installPWA();
        });

        // Listen for beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            this.deferredPrompt = e;
            this.showInstallButton();
        });

        // Listen for app installed event
        window.addEventListener('appinstalled', () => {
            console.log('App installed successfully');
            this.hideInstallButton();
            this.showToast('App installed successfully!', 'success');
            this.deferredPrompt = null;
        });

        // === NEW: Offline-specific event listeners ===

        // Download for offline button (if exists)
        addIdListener('download-offline', 'click', () => {
            this.downloadCurrentArticlesForOffline();
        });

        // Clear cache button
        addIdListener('clear-cache-btn', 'click', () => {
            this.clearOfflineCache();
        });

        // View offline articles
        addIdListener('view-offline-articles', 'click', () => {
            this.showOfflineArticles();
        });

        // Save article for offline reading
        addIdListener('save-for-offline', 'click', () => {
            const modalTitle = document.getElementById('modal-title');
            if (modalTitle) {
                this.saveArticleForOffline({
                    title: modalTitle.textContent,
                    // We need to get current article data
                });
            }
        });

        // Service Worker messages
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                this.handleServiceWorkerMessage(event.data);
            });
        }
    }

    // ==================== ENHANCED API METHODS ====================
    async makeApiRequest(url) {
        if (!this.apiKey) {
            this.showApiKeyModal();
            throw new Error('API key required');
        }

        // Check if offline - use enhanced offline handling
        if (!navigator.onLine) {
            console.log('Offline mode: Using enhanced offline capabilities');

            // Try to get cached data first
            const cachedData = await this.getEnhancedCachedNews();
            if (cachedData.length > 0) {
                return { status: 'ok', news: cachedData };
            }

            // Try IndexedDB
            const indexedDBData = await this.getArticlesFromIndexedDB();
            if (indexedDBData.length > 0) {
                return { status: 'ok', news: indexedDBData };
            }

            throw new Error('You are offline and no cached data available');
        }

        try {
            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 401) {
                    // Invalid API key
                    localStorage.removeItem('currents_api_key');
                    this.apiKey = null;
                    this.showApiKeyModal();
                    this.showToast('Your API key is invalid. Please enter a new one.', 'error');
                    throw new Error('Invalid API key');
                }
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();

            // === NEW: Cache the response for offline use ===
            if (data.news && data.news.length > 0) {
                this.cacheApiResponse(url, data.news);
            }

            return data;
        } catch (error) {
            console.error('API request failed:', error);

            // Enhanced fallback: try multiple sources
            const cachedData = await this.getEnhancedCachedNews();
            if (cachedData.length > 0) {
                this.showToast('Using enhanced cached data', 'warning');
                return { status: 'ok', news: cachedData };
            }

            throw error;
        }
    }

    // === NEW: Enhanced cache method ===
    async cacheApiResponse(url, articles) {
        try {
            // Store in service worker cache
            if ('caches' in window) {
                const cache = await caches.open('currents-news-v2.0');
                const response = new Response(JSON.stringify({
                    status: 'ok',
                    news: articles,
                    cachedAt: Date.now()
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });

                await cache.put(url, response);
                console.log('Enhanced cache: Stored API response');
            }

            // Store in IndexedDB for offline search
            await this.storeArticlesInIndexedDB(articles);

            // Update offline stats
            this.updateOfflineStats();

        } catch (error) {
            console.log('Enhanced caching failed:', error);
        }
    }

    // === NEW: Store articles in IndexedDB ===
    async storeArticlesInIndexedDB(articles) {
        if (!window.indexedDB) return;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open('CurrentsOfflineDB', 1);

            request.onsuccess = (event) => {
                const db = event.target.result;
                const tx = db.transaction('articles', 'readwrite');
                const store = tx.objectStore('articles');

                // Add metadata to each article
                const articlesWithMeta = articles.map(article => ({
                    ...article,
                    id: article.id || article.url || `${Date.now()}-${Math.random()}`,
                    timestamp: Date.now(),
                    cachedAt: Date.now(),
                    readStatus: 'unread',
                    offlineAvailable: true
                }));

                // Store each article
                articlesWithMeta.forEach(article => {
                    store.put(article);
                });

                tx.oncomplete = () => {
                    console.log(`Enhanced: Stored ${articles.length} articles in IndexedDB`);
                    resolve();
                };

                tx.onerror = () => reject(tx.error);
            };

            request.onerror = () => reject(request.error);
        });
    }

    // === NEW: Get articles from IndexedDB ===
    async getArticlesFromIndexedDB(limit = 50, category = null) {
        if (!window.indexedDB) return [];

        return new Promise((resolve, reject) => {
            const request = indexedDB.open('CurrentsOfflineDB', 1);

            request.onsuccess = (event) => {
                const db = event.target.result;
                const tx = db.transaction('articles', 'readonly');
                const store = tx.objectStore('articles');

                let getAllRequest;

                if (category) {
                    const index = store.index('category');
                    getAllRequest = index.getAll(category);
                } else {
                    getAllRequest = store.getAll();
                }

                getAllRequest.onsuccess = () => {
                    let articles = getAllRequest.result || [];

                    // Sort by timestamp (newest first)
                    articles.sort((a, b) => b.timestamp - a.timestamp);

                    // Apply limit
                    articles = articles.slice(0, limit);

                    resolve(articles);
                };

                getAllRequest.onerror = () => reject(getAllRequest.error);
            };

            request.onerror = () => {
                console.log('IndexedDB access error');
                resolve([]);
            };
        });
    }

    // ==================== ENHANCED DATA LOADING ====================
    async loadLatestNews() {
        try {
            // Show appropriate loading message
            if (!navigator.onLine) {
                this.showToast('Loading cached articles...', 'info');
            }

            this.articles = await this.fetchLatestNews();
            this.currentPage = 1;
            this.totalPages = Math.ceil(this.articles.length / this.pageSize);
            this.renderArticles();
            this.hideLoading();
            this.updateStats();

            const message = navigator.onLine ?
                'Latest news loaded successfully!' :
                `Loaded ${this.articles.length} cached articles`;
            this.showToast(message, 'success');

        } catch (error) {
            this.hideLoading();

            // Enhanced error handling
            if (error.message.includes('offline')) {
                this.showOfflineMode();
            } else {
                this.showError(error.message);
            }

            // Fallback to mock data if API fails
            if (error.message.includes('Invalid API key') || this.apiKey === 'demo_key_placeholder') {
                this.useMockData();
            }
        }
    }

    // ==================== ENHANCED UI RENDERING ====================
    renderArticles() {
        const grid = document.getElementById('news-grid');
        if (!grid) return;

        grid.innerHTML = '';

        // Calculate pagination slice
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const articlesToShow = this.articles.slice(startIndex, endIndex);

        if (articlesToShow.length === 0) {
            grid.innerHTML = `
                <div class="no-articles" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
                    <i class="fas fa-inbox" style="font-size: 64px; color: var(--text-secondary); margin-bottom: 20px;"></i>
                    <h3>No articles found</h3>
                    <p>${!navigator.onLine ? 'You are offline. Try connecting to the internet for latest news.' : 'Try a different search or category'}</p>
                    ${!navigator.onLine ? '<button onclick="newsApp.showOfflineArticles()" class="btn btn-primary" style="margin-top: 20px;"><i class="fas fa-download"></i> View Cached Articles</button>' : ''}
                </div>
            `;
            return;
        }

        articlesToShow.forEach(article => {
            const card = this.createArticleCard(article);
            grid.appendChild(card);
        });

        this.updatePagination();
    }

    createArticleCard(article) {
            const card = document.createElement('div');
            card.className = 'news-card';

            // Format date
            const date = new Date(article.published);
            const formattedDate = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            // Get domain from URL
            let domain = 'Unknown Source';
            try {
                if (article.url) {
                    domain = new URL(article.url).hostname.replace('www.', '');
                }
            } catch (e) {
                console.log('Invalid URL:', article.url);
            }

            // Get first category or default
            const category = article.category && article.category.length > 0 ?
                article.category[0] :
                'general';

            // === NEW: Add offline indicator if article is cached ===
            const isCached = article.offlineAvailable || article.cachedAt;
            const offlineBadge = isCached ?
                '<span class="offline-badge" title="Available offline"><i class="fas fa-download"></i></span>' :
                '';

            // Check if image is available
            const hasImage = article.image && article.image !== "None";

            card.innerHTML = `
            <div class="news-image">
                ${hasImage ? 
                    `<img src="${article.image}" alt="${article.title}" loading="lazy">` : 
                    `<div class="no-image"><i class="fas fa-newspaper"></i></div>`
                }
                ${offlineBadge}
            </div>
            <div class="news-content">
                <h3 class="news-title">${this.truncateText(article.title, 100)}</h3>
                <p class="news-description">${this.truncateText(article.description || 'No description available', 150)}</p>
                <div class="news-meta">
                    <div class="news-source">
                        <i class="fas fa-globe"></i>
                        <span>${domain}</span>
                    </div>
                    <div class="news-date">
                        <i class="far fa-clock"></i>
                        <span>${formattedDate}</span>
                    </div>
                    <span class="news-category">${category}</span>
                </div>
                ${isCached ? '<div class="cache-status"><i class="fas fa-check-circle"></i> Available offline</div>' : ''}
            </div>
        `;
        
        // Add click event to open modal
        card.addEventListener('click', () => {
            this.showArticleModal(article);
        });
        
        return card;
    }

    showArticleModal(article) {
        // Format date
        const date = new Date(article.published);
        const formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Get domain from URL
        let domain = 'Unknown Source';
        try {
            if (article.url) {
                domain = new URL(article.url).hostname.replace('www.', '');
            }
        } catch (e) {
            console.log('Invalid URL:', article.url);
        }
        
        // Get categories
        const categories = article.category && article.category.length > 0 
            ? article.category.join(', ') 
            : 'General';
        
        // Update modal content
        document.getElementById('modal-title').textContent = article.title;
        document.getElementById('modal-source').innerHTML = `<i class="fas fa-globe"></i> ${domain}`;
        document.getElementById('modal-date').innerHTML = `<i class="far fa-clock"></i> ${formattedDate}`;
        document.getElementById('modal-author').innerHTML = article.author ? 
            `<i class="fas fa-user"></i> ${article.author}` : 
            `<i class="fas fa-user"></i> Unknown Author`;
        document.getElementById('modal-category').innerHTML = `<i class="fas fa-tag"></i> ${categories}`;
        
        const modalImage = document.getElementById('modal-image');
        if (article.image && article.image !== "None") {
            modalImage.src = article.image;
            modalImage.alt = article.title;
            modalImage.style.display = 'block';
        } else {
            modalImage.style.display = 'none';
        }
        
        document.getElementById('modal-description').textContent = 
            article.description || 'No description available for this article.';
        
        document.getElementById('modal-read-full').href = article.url;
        
        // Update bookmark button
        const bookmarkBtn = document.getElementById('modal-bookmark');
        if (bookmarkBtn) {
            const isBookmarked = this.bookmarks.some(b => b.id === article.id);
            bookmarkBtn.innerHTML = isBookmarked ? 
                `<i class="fas fa-bookmark"></i> Remove Bookmark` : 
                `<i class="far fa-bookmark"></i> Bookmark`;
            
            bookmarkBtn.onclick = () => this.toggleBookmark(article);
        }
        
        // === NEW: Add save for offline button ===
        const saveForOfflineBtn = document.getElementById('save-for-offline');
        if (saveForOfflineBtn) {
            const isCached = article.offlineAvailable || article.cachedAt;
            saveForOfflineBtn.innerHTML = isCached ? 
                `<i class="fas fa-check"></i> Already Saved` : 
                `<i class="fas fa-download"></i> Save for Offline`;
            saveForOfflineBtn.disabled = isCached;
            saveForOfflineBtn.onclick = () => this.saveArticleForOffline(article);
        }
        
        // Update share button
        const shareBtn = document.getElementById('modal-share');
        if (shareBtn) {
            shareBtn.onclick = () => this.shareArticle(article);
        }
        
        // Show modal
        document.getElementById('article-modal')?.classList.add('show');
    }

    // ==================== ENHANCED UTILITY METHODS ====================
    
    // === NEW: Enhanced offline detection ===
    checkOnlineStatus() {
        const isOnline = navigator.onLine;
        this.offlineMode = !isOnline;
        
        let statusElement = document.getElementById('online-status');
        
        if (!statusElement) {
            statusElement = this.createOnlineStatusIndicator();
        }
        
        if (isOnline) {
            statusElement.className = 'online-status online';
            statusElement.innerHTML = '<i class="fas fa-wifi"></i> Online';
            statusElement.title = 'Connected to the internet';
            
            // Remove offline banner if it exists
            const offlineBanner = document.querySelector('.offline-banner');
            if (offlineBanner) {
                offlineBanner.remove();
            }
            
        } else {
            statusElement.className = 'online-status offline';
            statusElement.innerHTML = '<i class="fas fa-wifi-slash"></i> Offline';
            statusElement.title = 'Working offline - cached articles available';
            
            // Show offline banner
            this.showOfflineBanner();
        }
    }
    
    // === NEW: Show offline banner ===
    showOfflineBanner() {
        // Check if banner already exists
        if (document.querySelector('.offline-banner')) return;
        
        const banner = document.createElement('div');
        banner.className = 'offline-banner';
        banner.innerHTML = `
            <div class="container">
                <i class="fas fa-wifi-slash"></i>
                <span>You are offline. Reading cached articles.</span>
                <button onclick="newsApp.showOfflineArticles()" class="btn btn-sm">
                    View Offline Articles
                </button>
                <button onclick="this.parentElement.parentElement.remove()" class="btn-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Add CSS for banner
        if (!document.querySelector('#offline-banner-styles')) {
            const style = document.createElement('style');
            style.id = 'offline-banner-styles';
            style.textContent = `
                .offline-banner {
                    background: linear-gradient(135deg, #f59e0b, #d97706);
                    color: white;
                    padding: 10px 0;
                    position: sticky;
                    top: var(--header-height);
                    z-index: 999;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .offline-banner .container {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    justify-content: center;
                    flex-wrap: wrap;
                }
                .offline-banner .btn-sm {
                    background: rgba(255,255,255,0.2);
                    border: 1px solid rgba(255,255,255,0.3);
                    padding: 4px 12px;
                    font-size: 12px;
                }
                .offline-banner .btn-close {
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                }
                @media (max-width: 768px) {
                    .offline-banner .container {
                        font-size: 14px;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.prepend(banner);
    }
    
    // === NEW: Enhanced cached news getter ===
    async getEnhancedCachedNews() {
        console.log('Getting enhanced cached news...');
        
        // Try multiple sources in order
        const sources = [
            this.getCachedNewsFromServiceWorker(),
            this.getArticlesFromIndexedDB(30),
            this.getCachedNews()
        ];
        
        for (const source of sources) {
            try {
                const articles = await source;
                if (articles && articles.length > 0) {
                    console.log(`Found ${articles.length} articles from source`);
                    return articles;
                }
            } catch (error) {
                console.log('Source failed:', error);
                continue;
            }
        }
        
        return [];
    }
    
    // === NEW: Get cached news from Service Worker ===
    async getCachedNewsFromServiceWorker() {
        return new Promise((resolve, reject) => {
            if (!navigator.serviceWorker?.controller) {
                reject('No service worker');
                return;
            }
            
            const messageChannel = new MessageChannel();
            
            messageChannel.port1.onmessage = (event) => {
                if (event.data.success) {
                    resolve(event.data.articles || []);
                } else {
                    reject(event.data.error);
                }
            };
            
            navigator.serviceWorker.controller.postMessage({
                type: 'GET_CACHED_ARTICLES',
                limit: 50
            }, [messageChannel.port2]);
        });
    }
    
    // === NEW: Get cache info ===
    async getCacheInfo() {
        return new Promise((resolve, reject) => {
            if (!navigator.serviceWorker?.controller) {
                resolve({ totalArticles: 0, lastSync: null, cacheSize: '0 MB' });
                return;
            }
            
            const messageChannel = new MessageChannel();
            
            messageChannel.port1.onmessage = (event) => {
                if (event.data.success) {
                    resolve({
                        totalArticles: event.data.itemCount || 0,
                        lastSync: Date.now(),
                        cacheSize: this.formatBytes(event.data.itemCount * 50000) // Estimate 50KB per article
                    });
                } else {
                    resolve({ totalArticles: 0, lastSync: null, cacheSize: '0 MB' });
                }
            };
            
            navigator.serviceWorker.controller.postMessage({
                type: 'GET_CACHE_INFO'
            }, [messageChannel.port2]);
        });
    }

    // ==================== NEW OFFLINE-SPECIFIC METHODS ====================
    
    // === Save article for offline reading ===
    async saveArticleForOffline(article) {
        try {
            await this.storeArticlesInIndexedDB([article]);
            this.showToast('Article saved for offline reading!', 'success');
            this.updateOfflineStats();
            
            // Update UI
            const saveBtn = document.getElementById('save-for-offline');
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-check"></i> Saved';
                saveBtn.disabled = true;
            }
            
        } catch (error) {
            this.showToast('Failed to save article for offline', 'error');
            console.error('Save for offline failed:', error);
        }
    }
    
    // === Download current articles for offline ===
    async downloadCurrentArticlesForOffline() {
        if (this.articles.length === 0) {
            this.showToast('No articles to save', 'warning');
            return;
        }
        
        this.showToast(`Saving ${this.articles.length} articles for offline...`, 'info');
        
        try {
            await this.storeArticlesInIndexedDB(this.articles);
            this.showToast(`Saved ${this.articles.length} articles for offline reading!`, 'success');
            this.updateOfflineStats();
        } catch (error) {
            this.showToast('Failed to save articles for offline', 'error');
        }
    }
    
    // === Show offline articles view ===
    async showOfflineArticles() {
        this.showLoading();
        
        try {
            const offlineArticles = await this.getArticlesFromIndexedDB(100);
            this.articles = offlineArticles;
            this.currentPage = 1;
            this.totalPages = Math.ceil(this.articles.length / this.pageSize);
            
            this.renderArticles();
            this.hideLoading();
            this.updateStats();
            
            // Update header to show offline mode
            this.setActiveCategory('offline');
            
            this.showToast(`Showing ${offlineArticles.length} offline articles`, 'success');
            
        } catch (error) {
            this.hideLoading();
            this.showError('No offline articles found');
        }
    }
    
    // === Show offline mode UI ===
    showOfflineMode() {
        const grid = document.getElementById('news-grid');
        if (!grid) return;
        
        grid.innerHTML = `
            <div class="offline-mode" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
                <div class="offline-icon" style="font-size: 64px; color: var(--warning-color); margin-bottom: 20px;">
                    <i class="fas fa-wifi-slash"></i>
                </div>
                <h3>You are Offline</h3>
                <p style="color: var(--text-secondary); margin-bottom: 30px; max-width: 500px; margin-left: auto; margin-right: auto;">
                    You are currently offline. You can read previously cached articles or save new ones for offline reading.
                </p>
                <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                    <button onclick="newsApp.showOfflineArticles()" class="btn btn-primary">
                        <i class="fas fa-newspaper"></i> View Cached Articles
                    </button>
                    <button onclick="location.reload()" class="btn btn-secondary">
                        <i class="fas fa-redo"></i> Retry Connection
                    </button>
                </div>
                <div style="margin-top: 30px; padding: 20px; background: var(--bg-secondary); border-radius: var(--border-radius-sm); max-width: 400px; margin-left: auto; margin-right: auto;">
                    <h4><i class="fas fa-info-circle"></i> Offline Tips</h4>
                    <ul style="text-align: left; margin-top: 10px; padding-left: 20px; color: var(--text-secondary);">
                        <li>Save articles for offline by clicking the download icon</li>
                        <li>Bookmarked articles are automatically saved</li>
                        <li>Connect to WiFi to download multiple articles at once</li>
                    </ul>
                </div>
            </div>
        `;
        
        this.hideLoading();
    }
    
    // === Clear offline cache ===
    async clearOfflineCache() {
        if (!confirm('Clear all offline articles? This cannot be undone.')) return;
        
        try {
            // Clear IndexedDB
            if (window.indexedDB) {
                const request = indexedDB.deleteDatabase('CurrentsOfflineDB');
                request.onsuccess = () => {
                    console.log('IndexedDB cleared');
                };
            }
            
            // Clear service worker cache
            if ('caches' in window) {
                await caches.delete('currents-news-v2.0');
            }
            
            // Clear local storage bookmarks
            localStorage.removeItem('offlineActionsQueue');
            
            this.showToast('Offline cache cleared successfully', 'success');
            this.updateOfflineStats();
            
            // Reload if in offline mode
            if (this.offlineMode) {
                this.showOfflineMode();
            }
            
        } catch (error) {
            this.showToast('Failed to clear cache', 'error');
        }
    }
    
    // === Process offline actions queue ===
    async processOfflineActionsQueue() {
        if (this.offlineActionsQueue.length === 0 || !navigator.onLine) return;
        
        this.showToast('Processing offline actions...', 'info');
        
        // Process each action
        for (const action of this.offlineActionsQueue) {
            try {
                switch (action.type) {
                    case 'bookmark':
                        await this.syncBookmark(action.data);
                        break;
                    case 'read':
                        await this.syncReadingProgress(action.data);
                        break;
                }
            } catch (error) {
                console.log('Failed to process offline action:', error);
            }
        }
        
        // Clear processed actions
        this.offlineActionsQueue = [];
        localStorage.setItem('offlineActionsQueue', JSON.stringify(this.offlineActionsQueue));
        
        this.showToast('Offline actions synced successfully', 'success');
    }
    
    // === Sync bookmark (stub - implement based on your backend) ===
    async syncBookmark(article) {
        // Implement actual sync with your backend
        console.log('Syncing bookmark:', article);
    }
    
    // === Sync reading progress (stub) ===
    async syncReadingProgress(progress) {
        // Implement actual sync with your backend
        console.log('Syncing reading progress:', progress);
    }
    
    // === Handle service worker messages ===
    handleServiceWorkerMessage(data) {
        switch (data.type) {
            case 'SW_UPDATED':
                this.showToast(`App updated to version ${data.version}!`, 'success');
                break;
            case 'UPDATE_AVAILABLE':
                this.showUpdateAvailableNotification(data);
                break;
            case 'UPDATE_INSTALLED':
                this.showToast('Update installed successfully', 'success');
                this.reloadApp();
                break;
                case 'UPDATE_CHECK_FAILED':
                this.showToast('Update check failed', 'warning');
                break;
            case 'SYNC_COMPLETE':
                this.updateOfflineStats();
                break;
        }
    }

    // === NEW: Update notification system ===
    showUpdateNotification() {
        const notificationContainer = document.createElement('div');
        notificationContainer.className = 'update-notification';
        notificationContainer.innerHTML = `
            <div class="update-toast">
                <i class="fas fa-download"></i>
                <div class="update-content">
                    <div class="update-title">New Version Available</div>
                    <div class="update-message">A new version of Currents News is available. Your changes will be saved.</div>
                    <div class="update-actions">
                        <button class="btn btn-sm btn-primary update-btn">Update Now</button>
                        <button class="btn btn-sm btn-secondary">Remind Me Later</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add to body
        document.body.appendChild(notificationContainer);
        
        // Add CSS
        this.addUpdateNotificationStyles();
        
        // Set up event listeners
        this.setupUpdateNotificationListeners(notificationContainer);
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            this.hideUpdateNotification(notificationContainer);
        }, 10000);
    }

    showUpdateAvailableNotification(data) {
        console.log('Update available:', data);
        
        // Only show update notification if not already shown
        if (!document.querySelector('.update-notification')) {
            this.showUpdateNotification();
        }
    }

    addUpdateNotificationStyles() {
        if (document.getElementById('update-notification-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'update-notification-styles';
        style.textContent = `
            .update-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                animation: slideInDown 0.3s ease-out;
            }
            
            .update-toast {
                background: linear-gradient(135deg, #10b98d, #059666);
                color: white;
                border-radius: 12px;
                padding: 15px 20px;
                display: flex;
                align-items: center;
                box-shadow: 0 8px 25px rgba(16, 185, 221, 0.3);
                max-width: 400px;
                animation: slideInRight 0.3s ease-out;
                animation-fill-mode: both;
                opacity: 0;
                animation-delay: 0.1s;
            }
            
            .update-content {
                flex: 1;
                margin-left: 15px;
            }
            
            .update-title {
                font-weight: 600;
                font-size: 16px;
                margin: 0 0 4px 0;
            }
            
            .update-message {
                font-size: 14px;
                opacity: 0.9;
                margin: 0 0 10px 0;
            }
            
            .update-actions {
                display: flex;
                gap: 10px;
            }
            
            .update-btn {
                padding: 6px 12px;
                font-size: 12px;
                font-weight: 500;
                border-radius: 6px;
                border: none;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .update-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(16, 154, 255, 0.3);
            }
            
            .update-btn:active {
                transform: translateY(0);
            }
            
            @keyframes slideInDown {
                from {
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                    display: block;
                }
            }
            
            @media (max-width: 768px) {
                .update-notification {
                    left: 20px;
                    right: 20px;
                }
                
                .update-toast {
                    flex-direction: column;
                    align-items: stretch;
                    padding: 15px;
                }
                
                .update-actions {
                    justify-content: space-between;
                    margin-top: 10px;
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    setupUpdateNotificationStyles() {
        // Add the styles
        this.addUpdateNotificationStyles();
    }

    setupUpdateNotificationListeners(container) {
        const updateBtn = container.querySelector('.update-btn');
        const laterBtn = container.querySelector('.update-btn:last-child');
        
        // Update now
        updateBtn.addEventListener('click', async () => {
            try {
                await this.installUpdate();
                this.hideUpdateNotification(container);
            } catch (error) {
                this.showToast('Failed to install update', 'error');
            }
        });
        
        // Remind later
        laterBtn.addEventListener('click', () => {
            this.hideUpdateNotification(container);
        });
        
        // Close on click outside
        container.addEventListener('click', (e) => {
            if (e.target === container) {
                this.hideUpdateNotification(container);
            }
        });
    }

    hideUpdateNotification(container) {
        if (container) {
            container.style.animation = 'slideOutRight 0.3s ease-in';
            container.addEventListener('animationend', () => {
                if (container.parentElement) {
                    container.remove();
                }
            });
        }
    }

    // === Update management methods ===
    async checkForUpdates() {
        try {
            const response = await fetch('/sw.js?' + Date.now());
            const swCode = await response.text();
            
            // Simple version check
            const versionMatch = swCode.match(/VERSION = ['"]([^'"]+)['"]/);
            const currentVersion = versionMatch ? versionMatch[1] : 'unknown';
            
            if (currentVersion !== this.currentVersion) {
                this.showUpdateAvailable();
                this.newVersionAvailable = true;
            }
        } catch (error) {
            console.log('Update check failed:', error);
        }
    }

    async installUpdate() {
        try {
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready;
                
                if (registration.waiting) {
                    // Show loading state
                    this.showUpdateProgress();
                    
                    // Install update
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    
                    // Wait for the new service worker to activate
                    const activationPromise = new Promise((resolve) => {
                        registration.waiting.addEventListener('statechange', (event) => {
                            if (registration.waiting.state === 'activated') {
                                resolve();
                            }
                        });
                    });
                    
                    await activationPromise;
                    
                    // Reload the page to complete the update
                    window.location.reload();
                }
            }
        } catch (error) {
            console.error('Update installation failed:', error);
            throw error;
        }
    }

    showUpdateProgress() {
        this.showToast('Installing update...', 'info');
    }

    async performUpdate() {
        try {
            await this.installUpdate();
            this.showToast('Update completed successfully!', 'success');
        } catch (error) {
            this.showToast('Update failed', 'error');
        }
    }

    reloadApp() {
        window.location.reload();
    }

    // === Service Worker Registration Enhancement ===
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then(registration => {
                console.log('Service Worker registered successfully');
                
                // Listen for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('New content is available');
                                // Send message to service worker to check for updates
                                if (newWorker.postMessage) {
                                    newWorker.postMessage({ type: 'CHECK_FOR_UPDATES' });
                                }
                            }
                        });
                    }
                });

                // Set up message handling
                navigator.serviceWorker.addEventListener('message', (event) => {
                    this.handleServiceWorkerMessage(event.data);
                });

                // Start periodic update checks
                setInterval(() => {
                    if (navigator.onLine) {
                        if (registration.active) {
                            // Check for updates
                            registration.active.postMessage({ type: 'CHECK_FOR_UPDATES' });
                        }
                    }
                }, 30 * 60 * 1000); // Check every 30 minutes

            }).catch(err => {
                console.log('Service Worker registration failed:', err);
                this.showToast('Service worker registration failed', 'error');
            });
        }
    }
    
    // === Setup cache update interval ===
    setupCacheUpdateInterval() {
        // Update cache stats every 5 minutes when online
        setInterval(() => {
            if (navigator.onLine) {
                this.updateOfflineStats();
            }
        }, 5 * 60 * 1000);
    }

    // ==================== HELPER METHODS ====================
    
    // === Format bytes to human readable ===
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    // === Format relative time ===
    formatRelativeTime(timestamp) {
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
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.newsApp = new CurrentsNewsApp();
});