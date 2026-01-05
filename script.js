// Currents News API Application
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
        this.bookmarks = JSON.parse(localStorage.getItem('veritas_bookmarks') || '[]');
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';
        this.deferredPrompt = null;
        this.offlineManager = null;

        // Initialize the app
        this.init();
    }

    // ==================== INITIALIZATION ====================
    async init() {
        // Initialize offline manager first
        this.offlineManager = new OfflineManager();

        // Wait for offline manager to initialize
        await new Promise(resolve => setTimeout(resolve, 100));

        // Set up theme
        this.setTheme(this.isDarkMode);

        // Check for saved API key
        const savedKey = localStorage.getItem('veritas_api_key');
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

        // Initialize offline UI elements
        this.initializeOfflineUI();

        // Initialize theme toggle button state
        this.initializeThemeToggle();
    }

    initializeThemeToggle() {
        const themeToggle = document.querySelector('.theme-toggle');
        if (themeToggle) {
            const themeIcon = themeToggle.querySelector('i');
            if (themeIcon) {
                themeIcon.className = this.isDarkMode ? 'fas fa-sun' : 'fas fa-moon';
            }
        }
    }

    // ==================== OFFLINE UI INITIALIZATION ====================
    initializeOfflineUI() {
        // Add storage usage indicator to header
        this.addStorageUsageIndicator();

        // Update existing article cards with offline indicators
        this.updateExistingCardsWithOfflineIndicators();

        // Set up offline management panel
        this.setupOfflineManagementPanel();

        // Update UI based on offline manager state
        if (this.offlineManager) {
            this.updateUIState();
        }
    }

    addStorageUsageIndicator() {
        // Add storage usage indicator to header
        const headerControls = document.querySelector('.header-controls');
        if (headerControls) {
            const storageContainer = document.createElement('div');
            storageContainer.id = 'storage-indicator';
            storageContainer.className = 'storage-indicator';
            storageContainer.innerHTML = `
                <div class="storage-info">
                    <span id="storage-usage-text">0 items stored</span>
                    <div class="storage-bar">
                        <div id="storage-usage-bar" class="storage-usage-bar"></div>
                    </div>
                </div>
            `;

            // Insert before the theme toggle
            const themeToggle = document.querySelector('.theme-toggle');
            if (themeToggle) {
                headerControls.insertBefore(storageContainer, themeToggle);
            } else {
                headerControls.appendChild(storageContainer);
            }
        }
    }

    updateExistingCardsWithOfflineIndicators() {
        // Add offline indicators to existing article cards
        const cards = document.querySelectorAll('.news-card');
        cards.forEach(card => {
            this.addOfflineIndicatorToCard(card);
        });
    }

    addOfflineIndicatorToCard(card) {
        // Add offline availability badge
        const meta = card.querySelector('.news-meta');
        if (meta) {
            const offlineBadge = document.createElement('span');
            offlineBadge.className = 'offline-badge';
            offlineBadge.innerHTML = '<i class="fas fa-download"></i> Save for Offline';
            offlineBadge.title = 'Save this article for offline reading';

            // Make it clickable
            offlineBadge.addEventListener('click', (e) => {
                e.stopPropagation();
                const articleId = card.getAttribute('data-article-id');
                if (articleId) {
                    this.saveArticleForOffline(articleId);
                }
            });

            meta.appendChild(offlineBadge);
        }
    }

    setupOfflineManagementPanel() {
        // Add offline management panel button
        const headerControls = document.querySelector('.header-controls');
        if (headerControls) {
            const offlineBtn = document.createElement('button');
            offlineBtn.id = 'offline-btn';
            offlineBtn.className = 'btn btn-secondary offline-btn';
            offlineBtn.innerHTML = '<i class="fas fa-cloud-download-alt"></i> Offline';
            offlineBtn.title = 'Manage offline articles';

            offlineBtn.addEventListener('click', () => {
                this.showOfflineManagementPanel();
            });

            headerControls.appendChild(offlineBtn);
        }
    }

    updateUIState() {
        if (this.offlineManager) {
            const status = this.offlineManager.getOfflineStatus();

            // Update online status
            const statusElement = document.getElementById('online-status');
            if (statusElement) {
                if (status.isOnline) {
                    statusElement.className = 'online-status online';
                    statusElement.innerHTML = '<i class="fas fa-wifi"></i> Online';
                } else {
                    statusElement.className = 'online-status offline';
                    statusElement.innerHTML = '<i class="fas fa-wifi-slash"></i> Offline';
                }
            }

            // Update storage usage
            if (status.storageUsage) {
                this.updateStorageUI(status.storageUsage);
            }
        }
    }

    updateStorageUI(storageUsage) {
        const storageBar = document.getElementById('storage-usage-bar');
        const storageText = document.getElementById('storage-usage-text');

        if (storageBar && storageText) {
            const totalItems = storageUsage.totalSize || 0;
            const percentage = Math.min((totalItems / 100) * 100, 100);

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

    // ==================== OFFLINE FUNCTIONALITY ====================
    async saveArticleForOffline(articleId) {
        try {
            // Find the article in current articles
            const article = this.articles.find(a => a.id === articleId);
            if (!article) {
                this.showToast('Article not found', 'error');
                return;
            }

            // Save to offline storage
            const success = await this.offlineManager.saveArticleForOffline(article);

            if (success) {
                // Update UI indicator
                this.updateOfflineIndicator(articleId, true);
            }
        } catch (error) {
            console.error('Error saving article for offline:', error);
            this.showToast('Failed to save article for offline reading', 'error');
        }
    }

    updateOfflineIndicator(articleId, isSaved) {
        // Update the offline badge on the article card
        const badge = document.querySelector(`[data-article-id="${articleId}"] .offline-badge`);
        if (badge) {
            if (isSaved) {
                badge.innerHTML = '<i class="fas fa-check-circle"></i> Saved';
                badge.className = 'offline-badge saved';
                badge.title = 'Article saved for offline reading';
            }
        }
    }

    async showOfflineManagementPanel() {
        // Create offline management panel
        const panel = document.createElement('div');
        panel.id = 'offline-panel';
        panel.className = 'offline-panel';

        panel.innerHTML = `
            <div class="offline-panel-header">
                <h3><i class="fas fa-cloud-download-alt"></i> Offline Articles</h3>
                <button class="btn btn-close" onclick="newsApp.hideOfflineManagementPanel()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="offline-panel-content">
                <div class="offline-stats">
                    <div class="stat-item">
                        <span class="stat-label">Total Articles</span>
                        <span id="offline-article-count" class="stat-value">0</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Bookmarks</span>
                        <span id="offline-bookmark-count" class="stat-value">0</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Storage Used</span>
                        <span id="offline-storage-used" class="stat-value">0</span>
                    </div>
                </div>
                
                <div class="offline-search">
                    <input type="text" id="offline-search-input" placeholder="Search offline articles..." />
                    <button id="offline-search-btn" class="btn btn-primary">
                        <i class="fas fa-search"></i>
                    </button>
                </div>
                
                <div id="offline-articles-list" class="offline-articles-list">
                    <div class="loading">Loading offline articles...</div>
                </div>
                
                <div class="offline-actions">
                    <button id="clear-offline-data" class="btn btn-danger">
                        <i class="fas fa-trash"></i> Clear All
                    </button>
                    <button id="cleanup-old-data" class="btn btn-secondary">
                        <i class="fas fa-broom"></i> Cleanup
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        // Load offline articles
        this.loadOfflineArticles();

        // Set up event listeners
        this.setupOfflinePanelListeners();
    }

    hideOfflineManagementPanel() {
        const panel = document.getElementById('offline-panel');
        if (panel) {
            panel.remove();
        }
    }

    setupOfflinePanelListeners() {
        const searchBtn = document.getElementById('offline-search-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.searchOfflineArticles());
        }

        const clearBtn = document.getElementById('clear-offline-data');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.confirmClearOfflineData());
        }

        const cleanupBtn = document.getElementById('cleanup-old-data');
        if (cleanupBtn) {
            cleanupBtn.addEventListener('click', () => this.cleanupOldData());
        }
    }

    async loadOfflineArticles() {
        try {
            const offlineArticles = await this.offlineManager.getOfflineArticles();
            const bookmarks = await this.offlineManager.getBookmarks();

            // Update stats
            this.updateOfflineStats(offlineArticles.length, bookmarks.length);

            // Display articles
            this.displayOfflineArticles(offlineArticles, bookmarks);
        } catch (error) {
            console.error('Error loading offline articles:', error);
            this.showToast('Failed to load offline articles', 'error');
        }
    }

    updateOfflineStats(articleCount, bookmarkCount) {
        document.getElementById('offline-article-count').textContent = articleCount;
        document.getElementById('offline-bookmark-count').textContent = bookmarkCount;

        // Get storage usage
        if (this.offlineManager) {
            const usage = this.offlineManager.storageUsage;
            document.getElementById('offline-storage-used').textContent = `${usage.totalSize} items`;
        }
    }

    displayOfflineArticles(articles, bookmarks) {
        const listContainer = document.getElementById('offline-articles-list');
        if (!listContainer) return;

        if (articles.length === 0) {
            listContainer.innerHTML = `
                <div class="no-offline-articles">
                    <i class="fas fa-inbox" style="font-size: 48px; color: var(--text-secondary); margin-bottom: 16px;"></i>
                    <h4>No offline articles</h4>
                    <p>No articles saved for offline reading. Use the "Save for Offline" button on articles to save them for later.</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = articles.map(article => {
            const isBookmarked = bookmarks.some(b => b.article_id === article.id);

            return `
                <div class="offline-article-item">
                    <div class="offline-article-content">
                        <h4>${this.truncateText(article.title, 80)}</h4>
                        <p class="offline-article-description">${this.truncateText(article.description || '', 150)}</p>
                        <div class="offline-article-meta">
                            <span class="offline-article-category">${article.category ? article.category[0] : 'General'}</span>
                            <span class="offline-article-date">${new Date(article.published).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div class="offline-article-actions">
                        <button class="btn btn-sm btn-primary" onclick="newsApp.openArticle('${article.id}')">
                            <i class="fas fa-eye"></i> Read
                        </button>
                        <button class="btn btn-sm ${isBookmarked ? 'btn-danger' : 'btn-secondary'}" onclick="newsApp.toggleBookmark('${article.id}', ${isBookmarked})">
                            <i class="fas fa-${isBookmarked ? 'bookmark' : 'bookmarks'}"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="newsApp.removeArticleFromOffline('${article.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async searchOfflineArticles() {
        const searchInput = document.getElementById('offline-search-input');
        const query = searchInput.value.trim();

        if (!query) {
            this.showToast('Please enter a search term', 'warning');
            return;
        }

        try {
            const results = await this.offlineManager.searchOfflineArticles(query);
            const bookmarks = await this.offlineManager.getBookmarks();

            // Update stats
            this.updateOfflineStats(results.length, bookmarks.length);

            // Display results
            this.displayOfflineArticles(results, bookmarks);

            this.showToast(`Found ${results.length} articles for "${query}"`, 'success');
        } catch (error) {
            console.error('Error searching offline articles:', error);
            this.showToast('Failed to search offline articles', 'error');
        }
    }

    async openArticle(articleId) {
        // Find article in offline storage and open it
        const article = await this.offlineManager.offlineStorage.getArticle(articleId);
        if (article) {
            this.showArticleModal(article);
        } else {
            this.showToast('Article not found', 'error');
        }
    }

    async removeArticleFromOffline(articleId) {
        try {
            const success = await this.offlineManager.removeArticleFromOffline(articleId);
            if (success) {
                this.loadOfflineArticles();
                this.showToast('Article removed from offline storage', 'success');
            }
        } catch (error) {
            console.error('Error removing article:', error);
            this.showToast('Failed to remove article', 'error');
        }
    }

    confirmClearOfflineData() {
        if (confirm('Are you sure you want to clear all offline data? This will remove all saved articles and bookmarks.')) {
            this.clearAllOfflineData();
        }
    }

    async clearAllOfflineData() {
        try {
            const success = await this.offlineManager.clearAllOfflineData();
            if (success) {
                this.loadOfflineArticles();
                this.updateStorageUI({ articles: 0, bookmarks: 0, queue: 0, totalSize: 0 });
                this.showToast('All offline data cleared', 'success');
            }
        } catch (error) {
            console.error('Error clearing offline data:', error);
            this.showToast('Failed to clear offline data', 'error');
        }
    }

    async cleanupOldData() {
        try {
            await this.offlineManager.cleanupOldData();
            this.showToast('Old data cleaned up', 'success');
        } catch (error) {
            console.error('Error cleaning up old data:', error);
            this.showToast('Failed to clean up old data', 'error');
        }
    }

    // ==================== EVENT LISTENERS ====================
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

        // Theme toggle
        const themeToggle = document.querySelector('.theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }

        // Navigation category clicks
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const category = e.currentTarget.dataset.category;
                this.setActiveCategory(category);
                this.loadCategoryNews(category);
            });
        });

        // Language change
        const languageSelect = document.getElementById('language-select');
        if (languageSelect) {
            languageSelect.addEventListener('change', (e) => {
                this.currentLanguage = e.target.value;
                this.updateStats();
                this.loadCategoryNews(this.currentCategory);
            });
        }

        // Search
        const searchBtn = document.getElementById('search-btn');
        const searchInput = document.getElementById('search-input');

        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.performSearch();
            });
        }

        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch();
                }
            });
        }

        // Advanced filters toggle
        const advancedToggle = document.getElementById('advanced-toggle');
        if (advancedToggle) {
            advancedToggle.addEventListener('click', () => {
                const filters = document.getElementById('advanced-filters');
                if (filters) {
                    filters.classList.toggle('show');
                }
            });
        }

        // Apply filters
        const applyFiltersBtn = document.getElementById('apply-filters');
        const clearFiltersBtn = document.getElementById('clear-filters');

        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => {
                this.applyFilters();
            });
        }

        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                this.clearFilters();
            });
        }

        // Pagination
        const prevPageBtn = document.getElementById('prev-page');
        const nextPageBtn = document.getElementById('next-page');

        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.loadArticles();
                }
            });
        }

        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => {
                if (this.currentPage < this.totalPages) {
                    this.currentPage++;
                    this.loadArticles();
                }
            });
        }

        // Historical search
        const historicalSearchBtn = document.getElementById('historical-search-btn');
        const historicalSearchInput = document.getElementById('historical-search');

        if (historicalSearchBtn) {
            historicalSearchBtn.addEventListener('click', () => {
                this.performHistoricalSearch();
            });
        }

        if (historicalSearchInput) {
            historicalSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performHistoricalSearch();
                }
            });
        }

        // Refresh news
        const refreshNewsLink = document.getElementById('refresh-news');
        const retryBtn = document.getElementById('retry-btn');

        if (refreshNewsLink) {
            refreshNewsLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.loadCategoryNews(this.currentCategory);
            });
        }

        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                this.loadCategoryNews(this.currentCategory);
            });
        }

        // API Key modal
        const saveKeyBtn = document.getElementById('save-key-btn');
        const tryDemoBtn = document.getElementById('try-demo-btn');

        if (saveKeyBtn) {
            saveKeyBtn.addEventListener('click', () => {
                this.saveApiKey();
            });
        }

        if (tryDemoBtn) {
            tryDemoBtn.addEventListener('click', () => {
                this.useDemoMode();
            });
        }

        // Reset API key
        const resetApiKeyLink = document.getElementById('reset-api-key');
        if (resetApiKeyLink) {
            resetApiKeyLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.resetApiKey();
            });
        }

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('article-modal');
            if (e.target === modal) {
                this.hideArticleModal();
            }
        });

        // Modal close buttons
        const modalClose = document.getElementById('modal-close');
        if (modalClose) {
            modalClose.addEventListener('click', () => {
                this.hideArticleModal();
            });
        }

        // Mobile menu toggle
        const navToggle = document.querySelector('.nav-toggle');
        if (navToggle) {
            navToggle.addEventListener('click', () => {
                const navMenu = document.querySelector('.nav-menu');
                if (navMenu) {
                    navMenu.classList.toggle('show');
                }
            });
        }

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
        const installBtn = document.getElementById('install-btn');
        if (installBtn) {
            installBtn.addEventListener('click', () => {
                this.installPWA();
            });
        }

        // Listen for beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            this.deferredPrompt = e;
            this.showInstallButton();
            // Remove e.preventDefault() unless you want to control WHEN to show it
        });

        // Listen for app installed event
        window.addEventListener('appinstalled', () => {
            console.log('App installed successfully');
            this.hideInstallButton();
            this.showToast('App installed successfully!', 'success');
            this.deferredPrompt = null;
        });

        // Online/offline events
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
    }

    // ==================== API METHODS ====================
    async makeApiRequest(url) {
        if (!this.apiKey) {
            this.showApiKeyModal();
            throw new Error('API key required');
        }

        // Check if offline
        if (!navigator.onLine) {
            console.log('Offline mode: using cached data');
            const cachedData = await this.getCachedNews();
            if (cachedData.length > 0) {
                return { status: 'ok', news: cachedData };
            }
            throw new Error('You are offline and no cached data available');
        }

        try {
            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 401) {
                    // Invalid API key
                    localStorage.removeItem('veritas_api_key');
                    this.apiKey = null;
                    this.showApiKeyModal();
                    this.showToast('Your API key is invalid. Please enter a new one.', 'error');
                    throw new Error('Invalid API key');
                }
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API request failed:', error);

            // Try cached data as fallback
            if (error.message !== 'You are offline and no cached data available') {
                const cachedData = await this.getCachedNews();
                if (cachedData.length > 0) {
                    this.showToast('Using cached data', 'warning');
                    return { status: 'ok', news: cachedData };
                }
            }

            throw error;
        }
    }

    async fetchLatestNews() {
        this.showLoading();

        try {
            const url = new URL(`${this.baseUrl}/latest-news`);
            url.searchParams.append('language', this.currentLanguage);
            url.searchParams.append('apiKey', this.apiKey);

            const data = await this.makeApiRequest(url.toString());

            if (data.status === 'ok' && data.news) {
                return data.news;
            } else {
                throw new Error('Invalid response format from API');
            }
        } catch (error) {
            console.error('Error fetching latest news:', error);
            throw error;
        }
    }

    async fetchHistoricalNews(keywords, filters = {}) {
        this.showLoading();

        try {
            const url = new URL(`${this.baseUrl}/search`);
            url.searchParams.append('apiKey', this.apiKey);
            url.searchParams.append('keywords', keywords);
            url.searchParams.append('language', this.currentLanguage);

            // Add filters if provided
            if (filters.start_date) url.searchParams.append('start_date', filters.start_date);
            if (filters.end_date) url.searchParams.append('end_date', filters.end_date);
            if (filters.category) url.searchParams.append('category', filters.category);
            if (filters.domain) url.searchParams.append('domain', filters.domain);

            const data = await this.makeApiRequest(url.toString());

            if (data.status === 'ok' && data.news) {
                return data.news;
            } else {
                throw new Error('Invalid response format from API');
            }
        } catch (error) {
            console.error('Error fetching historical news:', error);
            throw error;
        }
    }

    // ==================== DATA LOADING ====================
    async loadLatestNews() {
        try {
            this.articles = await this.fetchLatestNews();
            this.currentPage = 1;
            this.totalPages = Math.ceil(this.articles.length / this.pageSize);
            this.renderArticles();
            this.hideLoading();
            this.updateStats();
            this.showToast('Latest news loaded successfully!', 'success');
        } catch (error) {
            this.hideLoading();
            this.showError(error.message);

            // Fallback to mock data if API fails
            if (error.message.includes('Invalid API key') || this.apiKey === 'demo_key_placeholder') {
                this.useMockData();
            }
        }
    }

    async loadCategoryNews(category) {
        this.setActiveCategory(category);

        if (category === 'latest') {
            await this.loadLatestNews();
            return;
        }

        try {
            // For categories, we'll use search with category filter
            this.articles = await this.fetchHistoricalNews('', { category });
            this.currentPage = 1;
            this.totalPages = Math.ceil(this.articles.length / this.pageSize);
            this.renderArticles();
            this.hideLoading();
            this.updateStats();
            this.showToast(`${category.charAt(0).toUpperCase() + category.slice(1)} news loaded!`, 'success');
        } catch (error) {
            this.hideLoading();
            this.showError(error.message);
        }
    }

    async performSearch() {
        const searchInput = document.getElementById('search-input');
        const query = searchInput ? searchInput.value.trim() : '';

        if (!query) {
            this.showToast('Please enter a search term', 'warning');
            return;
        }

        this.searchQuery = query;

        try {
            this.articles = await this.fetchHistoricalNews(query, this.filters);
            this.currentPage = 1;
            this.totalPages = Math.ceil(this.articles.length / this.pageSize);
            this.renderArticles();
            this.hideLoading();
            this.updateStats();
            this.showToast(`Found ${this.articles.length} articles for "${query}"`, 'success');
        } catch (error) {
            this.hideLoading();
            this.showError(error.message);
        }
    }

    async performHistoricalSearch() {
        const searchInput = document.getElementById('historical-search');
        let query = '';

        if (searchInput && searchInput.value) {
            query = searchInput.value.trim();
        }

        if (!query) {
            this.showToast('Please enter keywords for historical search', 'warning');
            return;
        }

        try {
            this.articles = await this.fetchHistoricalNews(query, this.filters);
            this.currentPage = 1;
            this.totalPages = Math.ceil(this.articles.length / this.pageSize);
            this.renderArticles();
            this.hideLoading();
            this.updateStats();
            this.showToast(`Found ${this.articles.length} historical articles for "${query}"`, 'success');
        } catch (error) {
            this.hideLoading();
            this.showError(error.message);
        }
    }

    // ==================== UI RENDERING ====================
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
                    <p>Try a different search or category</p>
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
            card.setAttribute('data-article-id', article.id);

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

            // Check if image is available
            const hasImage = article.image && article.image !== "None";

            card.innerHTML = `
            <div class="news-image">
                ${hasImage ? 
                    `<img src="${article.image}" alt="${article.title}" loading="lazy">` : 
                    `<div class="no-image"><i class="fas fa-newspaper"></i></div>`
                }
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
        
        // Update share button
        const shareBtn = document.getElementById('modal-share');
        if (shareBtn) {
            shareBtn.onclick = () => this.shareArticle(article);
        }
        
        // Show modal
        document.getElementById('article-modal')?.classList.add('show');
    }

    hideArticleModal() {
        document.getElementById('article-modal')?.classList.remove('show');
    }

    // ==================== UTILITY METHODS ====================
    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    setActiveCategory(category) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.category === category) {
                link.classList.add('active');
            }
        });
        this.currentCategory = category;
    }

    applyFilters() {
        this.filters = {
            start_date: document.getElementById('start-date')?.value || '',
            end_date: document.getElementById('end-date')?.value || '',
            category: document.getElementById('category-filter')?.value || '',
            domain: document.getElementById('domain-filter')?.value.trim() || '',
            keywords: document.getElementById('search-input')?.value.trim() || ''
        };
        
        // If we have a search query, perform search with filters
        if (this.filters.keywords) {
            this.performSearch();
        } else {
            this.loadCategoryNews(this.currentCategory);
        }
        
        this.showToast('Filters applied successfully!', 'success');
    }

    clearFilters() {
        document.getElementById('start-date').value = '';
        document.getElementById('end-date').value = '';
        document.getElementById('category-filter').value = '';
        document.getElementById('domain-filter').value = '';
        
        this.filters = {
            start_date: '',
            end_date: '',
            category: '',
            domain: '',
            keywords: ''
        };
        
        this.showToast('Filters cleared!', 'success');
    }

    updateDateFilters() {
        const today = new Date().toISOString().split('T')[0];
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        const lastWeekFormatted = lastWeek.toISOString().split('T')[0];
        
        const startDate = document.getElementById('start-date');
        const endDate = document.getElementById('end-date');
        
        if (startDate) startDate.max = today;
        if (endDate) {
            endDate.max = today;
            endDate.min = lastWeekFormatted;
        }
    }

    updatePagination() {
        document.getElementById('current-page').textContent = this.currentPage;
        document.getElementById('total-pages').textContent = this.totalPages;
        
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        
        if (prevBtn) prevBtn.disabled = this.currentPage === 1;
        if (nextBtn) nextBtn.disabled = this.currentPage === this.totalPages || this.totalPages === 0;
    }

    updateStats() {
        const articleCount = document.getElementById('article-count');
        const lastUpdated = document.getElementById('last-updated');
        const currentLanguage = document.getElementById('current-language');
        
        if (articleCount) articleCount.textContent = this.articles.length;
        if (lastUpdated) lastUpdated.textContent = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const languageNames = {
            'en': 'English',
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'it': 'Italian',
            'pt': 'Portuguese'
        };
        
        if (currentLanguage) {
            currentLanguage.textContent = languageNames[this.currentLanguage] || this.currentLanguage;
        }
    }

    // ==================== UI STATE MANAGEMENT ====================
    showLoading() {
        const loading = document.getElementById('loading');
        const errorContainer = document.getElementById('error-container');
        const newsGrid = document.getElementById('news-grid');
        const pagination = document.getElementById('pagination');
        const statsBar = document.getElementById('stats-bar');
        
        if (loading) loading.style.display = 'block';
        if (errorContainer) errorContainer.style.display = 'none';
        if (newsGrid) newsGrid.style.display = 'none';
        if (pagination) pagination.style.display = 'none';
        if (statsBar) statsBar.style.display = 'none';
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        const newsGrid = document.getElementById('news-grid');
        const pagination = document.getElementById('pagination');
        const statsBar = document.getElementById('stats-bar');
        
        if (loading) loading.style.display = 'none';
        if (newsGrid) newsGrid.style.display = 'grid';
        if (pagination) pagination.style.display = 'flex';
        if (statsBar) statsBar.style.display = 'flex';
    }

    showError(message) {
        const loading = document.getElementById('loading');
        const errorContainer = document.getElementById('error-container');
        const newsGrid = document.getElementById('news-grid');
        const pagination = document.getElementById('pagination');
        const statsBar = document.getElementById('stats-bar');
        const errorMessage = document.getElementById('error-message');
        
        if (loading) loading.style.display = 'none';
        if (errorContainer) errorContainer.style.display = 'block';
        if (newsGrid) newsGrid.style.display = 'none';
        if (pagination) pagination.style.display = 'none';
        if (statsBar) statsBar.style.display = 'none';
        if (errorMessage) errorMessage.textContent = message;
    }

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

    // ==================== THEME MANAGEMENT ====================
    setTheme(isDark) {
        this.isDarkMode = isDark;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        localStorage.setItem('darkMode', isDark);

        const themeIcon = document.querySelector('.theme-toggle i');
        if (themeIcon) {
            themeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    toggleTheme() {
        this.setTheme(!this.isDarkMode);
    }

    // ==================== API KEY MANAGEMENT ====================
    showApiKeyModal() {
        document.getElementById('api-key-modal')?.classList.add('show');
    }

    hideApiKeyModal() {
        document.getElementById('api-key-modal')?.classList.remove('show');
    }

    async saveApiKey() {
        const keyInput = document.getElementById('api-key-input');
        const saveCheckbox = document.getElementById('save-api-key');
        
        if (!keyInput || !keyInput.value.trim()) {
            this.showToast('Please enter a valid API key', 'error');
            return;
        }

        const key = keyInput.value.trim();
        
        // Test the API key first
        try {
            const testUrl = `${this.baseUrl}/latest-news?language=en&apiKey=${key}&limit=1`;
            const response = await fetch(testUrl);
            
            if (response.status === 401) {
                this.showToast('Invalid API key. Please check and try again.', 'error');
                return;
            }
            
            const data = await response.json();
            if (data.status !== 'ok') {
                this.showToast('Invalid API key. Please check and try again.', 'error');
                return;
            }
            
            this.apiKey = key;
            
            if (saveCheckbox?.checked) {
                localStorage.setItem('veritas_api_key', key);
            }
            
            this.hideApiKeyModal();
            this.showToast('API key saved successfully!', 'success');
            this.loadLatestNews();
            
        } catch (error) {
            this.showToast('Could not verify API key. Check your connection.', 'error');
        }
    }

    resetApiKey() {
        localStorage.removeItem('veritas_api_key');
        this.apiKey = null;
        this.showApiKeyModal();
        this.showToast('API key cleared. Please enter a new one.', 'info');
    }

    useDemoMode() {
        this.showToast('Using demo mode with sample articles. Get a free API key for real news!', 'warning');
        this.apiKey = 'demo_key_placeholder';
        this.hideApiKeyModal();
        this.useMockData();
    }

    // ==================== BOOKMARK FUNCTIONALITY ====================
    toggleBookmark(article) {
        const index = this.bookmarks.findIndex(b => b.id === article.id);
        
        if (index === -1) {
            // Add bookmark
            this.bookmarks.push(article);
            this.showToast('Article bookmarked!', 'success');
        } else {
            // Remove bookmark
            this.bookmarks.splice(index, 1);
            this.showToast('Bookmark removed!', 'info');
        }
        
        // Save to localStorage
        localStorage.setItem('veritas_bookmarks', JSON.stringify(this.bookmarks));
        
        // Update modal button
        const bookmarkBtn = document.getElementById('modal-bookmark');
        if (bookmarkBtn) {
            const isBookmarked = index === -1;
            bookmarkBtn.innerHTML = isBookmarked ? 
                `<i class="fas fa-bookmark"></i> Remove Bookmark` : 
                `<i class="far fa-bookmark"></i> Bookmark`;
        }
    }

    // ==================== SHARE FUNCTIONALITY ====================
    shareArticle(article) {
        if (navigator.share) {
            navigator.share({
                title: article.title,
                text: article.description,
                url: article.url,
            })
            .then(() => this.showToast('Article shared successfully!', 'success'))
            .catch(error => {
                if (error.name !== 'AbortError') {
                    this.showToast('Sharing failed: ' + error.message, 'error');
                }
            });
        } else {
            // Fallback: Copy to clipboard
            navigator.clipboard.writeText(`${article.title} - ${article.url}`)
                .then(() => this.showToast('Link copied to clipboard!', 'success'))
                .catch(() => this.showToast('Failed to copy link', 'error'));
        }
    }

    // ==================== OFFLINE & CACHING ====================
    async getCachedNews() {
        try {
            if ('caches' in window) {
                const cache = await caches.open('currents-news-v1.0');
                const requests = await cache.keys();
                
                // Find latest cached news
                const newsRequests = requests.filter(req => {
                    const url = new URL(req.url);
                    return url.hostname === 'api.currentsapi.services' &&
                          (url.pathname.includes('/latest-news') || url.pathname.includes('/search'));
                });
                
                if (newsRequests.length > 0) {
                    const response = await cache.match(newsRequests[newsRequests.length - 1]);
                    const data = await response.json();
                    
                    if (data.status === 'ok' && data.news) {
                        this.showToast(`Showing ${data.news.length} cached articles`, 'info');
                        return data.news;
                    }
                }
            }
            
            // If no cache, return mock data
            return this.getMockNews();
        } catch (error) {
            console.error('Error getting cached news:', error);
            return this.getMockNews();
        }
    }

    getMockNews() {
        return [
            {
                id: 'offline-1',
                title: 'Offline Mode Active',
                description: 'You are currently offline. Previously viewed articles are shown here. Connect to the internet for latest news.',
                url: '#',
        author: 'Veritas',
                image: 'https://images.unsplash.com/photo-1589652717521-10c0d092dea9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                language: 'en',
                category: ['general'],
                published: new Date().toISOString()
            }
        ];
    }

    // ==================== SERVICE WORKER & PWA ====================
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                // Register enhanced service worker
                navigator.serviceWorker.register('/sw-enhanced.js')
                    .then(registration => {
                        console.log('Enhanced Service Worker registered with scope:', registration.scope);
                        
                        // Check for updates
                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            console.log('Service Worker update found!');
                            
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    this.showToast('New version available! Refresh to update.', 'info');
                                }
                            });
                        });
                        
                        // Check initial online status
                        this.checkOnlineStatus();
                        
                    })
                    .catch(error => {
                        console.log('Enhanced Service Worker registration failed:', error);
                        
                        // Fallback to original service worker
                        navigator.serviceWorker.register('/sw.js')
                            .then(registration => {
                                console.log('Original Service Worker registered as fallback:', registration.scope);
                            })
                            .catch(fallbackError => {
                                console.log('Fallback Service Worker registration also failed:', fallbackError);
                            });
                    });
            });
        }
    }

    checkOnlineStatus() {
        const isOnline = navigator.onLine;
        let statusElement = document.getElementById('online-status');
        
        if (!statusElement) {
            statusElement = this.createOnlineStatusIndicator();
        }
        
        if (isOnline) {
            statusElement.className = 'online-status online';
            statusElement.innerHTML = '<i class="fas fa-wifi"></i> Online';
        } else {
            statusElement.className = 'online-status offline';
            statusElement.innerHTML = '<i class="fas fa-wifi-slash"></i> Offline';
            this.showToast('You are offline. Reading cached articles.', 'warning');
        }
    }

    createOnlineStatusIndicator() {
        const statusElement = document.createElement('div');
        statusElement.id = 'online-status';
        statusElement.className = 'online-status';
        const headerControls = document.querySelector('.header-controls');
        if (headerControls) {
            headerControls.prepend(statusElement);
        }
        return statusElement;
    }

    handleOnline() {
        this.checkOnlineStatus();
        this.showToast('Back online! Syncing latest news...', 'success');
        
        // Try to refresh data when back online
        setTimeout(() => {
            if (this.currentCategory === 'latest') {
                this.loadLatestNews();
            } else {
                this.loadCategoryNews(this.currentCategory);
            }
        }, 1000);
    }

    handleOffline() {
        this.checkOnlineStatus();
        this.showToast('You are offline. Using cached articles.', 'warning');
    }

    showInstallButton() {
        const installBtn = document.getElementById('install-btn');
        if (installBtn) {
            installBtn.style.display = 'flex';
        }
    }

    hideInstallButton() {
        const installBtn = document.getElementById('install-btn');
        if (installBtn) {
            installBtn.style.display = 'none';
        }
    }

    async installPWA() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                console.log('User accepted the install prompt');
                this.showToast('Installing app...', 'success');
            } else {
                console.log('User dismissed the install prompt');
            }
            
            this.deferredPrompt = null;
            this.hideInstallButton();
        }
    }

    checkStandaloneMode() {
        if (window.matchMedia('(display-mode: standalone)').matches || 
            window.navigator.standalone === true) {
            console.log('Running in PWA mode');
            // You can add PWA-specific features here
        }
    }

    // ==================== MOCK DATA ====================
    useMockData() {
        this.showToast('Using demo data. Get an API key for real news!', 'warning');
        
        const mockArticles = [
            {
                id: 'mock-1',
                title: 'Global Climate Summit Reaches Historic Agreement',
                description: 'World leaders have reached a historic agreement at the Global Climate Summit, committing to significant reductions in carbon emissions by 2030.',
                url: 'https://example.com/climate-summit',
                author: 'Global News Team',
                image: 'https://images.unsplash.com/photo-1589652717521-10c0d092dea9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                language: 'en',
                category: ['world', 'environment'],
                published: new Date().toISOString()
            },
            {
                id: 'mock-2',
                title: 'Tech Giants Announce Breakthrough in Quantum Computing',
                description: 'Major technology companies have jointly announced a breakthrough in quantum computing that could revolutionize data processing.',
                url: 'https://example.com/quantum-computing',
                author: 'Tech Reporter',
                image: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                language: 'en',
                category: ['technology', 'science'],
                published: new Date(Date.now() - 86400000).toISOString()
            },
            {
                id: 'mock-3',
                title: 'Stock Markets Reach All-Time High Amid Economic Recovery',
                description: 'Global stock markets have reached record highs as economic indicators show strong recovery from recent challenges.',
                url: 'https://example.com/stock-markets',
                author: 'Financial Times',
                image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                language: 'en',
                category: ['business', 'finance'],
                published: new Date(Date.now() - 172800000).toISOString()
            }
        ];
        
        this.articles = mockArticles;
        this.currentPage = 1;
        this.totalPages = Math.ceil(this.articles.length / this.pageSize);
        this.renderArticles();
        this.hideLoading();
        this.updateStats();
    }

    // ==================== PAGINATION ====================
    loadArticles() {
        this.renderArticles();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.newsApp = new CurrentsNewsApp();
});

const hash = window.location.hash; // "#/latest" or "#/search"