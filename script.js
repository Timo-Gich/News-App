// script.js - Updated Main Application with Offline Integration
// Production-ready error handling and UI state management

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

        // Initialize offline manager
        this.offlineManager = new OfflineManager();

        // ===== FIX #1: Delegate showToast to OfflineManager =====
        // This prevents "this.showToast is not a function" errors
        // Arrow function preserves lexical this, and bind ensures OfflineManager's this is correct
        this.showToast = this.offlineManager.showToast.bind(this.offlineManager);

        // Load existing bookmarks from localStorage for backward compatibility
        this.bookmarks = JSON.parse(localStorage.getItem('currents_bookmarks') || '[]');
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';
        this.deferredPrompt = null;

        // Initialize the app
        this.init();
    }

    // ==================== INITIALIZATION ====================
    async init() {
        // Set up theme first
        this.setTheme(this.isDarkMode);

        // Initialize offline manager with proper error handling
        try {
            await this.offlineManager.init();
            console.log('Offline Manager initialized');

            // Start auto-download for latest news (background, small)
            this.offlineManager.autoDownloadLatestPages();
        } catch (error) {
            console.warn('Offline Manager initialization failed:', error);
        }

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

        // Update stats
        try {
            await this.offlineManager.updateStats();
        } catch (error) {
            console.warn('Failed to update stats:', error);
        }

        // Enhanced error handling for GitHub Pages
        this.setupGitHubPagesErrorHandling();
    }

    // ==================== GITHUB PAGES ERROR HANDLING ====================
    setupGitHubPagesErrorHandling() {
        // Handle 404 errors gracefully
        window.addEventListener('error', (event) => {
            console.warn('Resource loading error:', event.error);

            // If it's a 404 error, try to reload the page
            if (event.error && event.error.message &&
                (event.error.message.includes('404') || event.error.message.includes('Not Found'))) {
                this.showToast('Resource not found. Retrying...', 'warning');
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        });

        // Handle fetch errors
        const originalFetch = window.fetch;
        window.fetch = async(...args) => {
            try {
                const response = await originalFetch(...args);
                if (!response.ok && response.status === 404) {
                    console.warn('404 error in fetch:', args[0]);
                    this.showToast('Resource not found. Using cached data.', 'warning');
                }
                return response;
            } catch (error) {
                console.error('Fetch error:', error);
                throw error;
            }
        };

        // Handle service worker registration errors
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.catch((error) => {
                console.warn('Service Worker registration failed:', error);
                this.showToast('Service Worker failed to register. Some features may not work.', 'warning');
            });
        }

        // Handle manifest.json loading errors
        const manifestLink = document.querySelector('link[rel="manifest"]');
        if (manifestLink) {
            manifestLink.addEventListener('error', () => {
                console.warn('Manifest.json failed to load');
                this.showToast('PWA manifest failed to load. App may not install properly.', 'warning');
            });
        }
    }

    // ==================== THEME MANAGEMENT ====================
    setTheme(isDarkMode) {
        this.isDarkMode = isDarkMode;

        // Update body class
        if (isDarkMode) {
            document.body.setAttribute('data-theme', 'dark');
        } else {
            document.body.removeAttribute('data-theme');
        }

        // Save preference
        localStorage.setItem('darkMode', isDarkMode.toString());

        // Update theme toggle button icon
        const themeToggle = document.querySelector('.theme-toggle i');
        if (themeToggle) {
            themeToggle.className = isDarkMode ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    toggleTheme() {
        this.setTheme(!this.isDarkMode);
        this.showToast(this.isDarkMode ? 'Dark mode enabled' : 'Light mode enabled', 'info');
    }

    // ==================== MODAL METHODS ====================
    showApiKeyModal() {
        document.getElementById('api-key-modal').classList.add('show');
    }

    hideApiKeyModal() {
        document.getElementById('api-key-modal').classList.remove('show');
    }

    hideArticleModal() {
        document.getElementById('article-modal').classList.remove('show');
    }

    showArticleModal(article) {
        // Set current article ID on modal for offline saving
        const modal = document.getElementById('article-modal');
        modal.dataset.currentArticleId = article.id;

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
        const categories = article.category && article.category.length > 0 ?
            article.category.join(', ') :
            'General';

        // Update modal content
        document.getElementById('modal-title').textContent = article.title;
        document.getElementById('modal-source').innerHTML = `<i class="fas fa-globe"></i> ${domain}`;
        document.getElementById('modal-date').innerHTML = `<i class="far fa-clock"></i> ${formattedDate}`;
        document.getElementById('modal-author').innerHTML = article.author ?
            `<i class="fas fa-user"></i> ${article.author}` :
            `<i class="fas fa-user"></i> Unknown Author`;
        document.getElementById('modal-category').innerHTML = `<i class="fas fa-tag"></i> ${categories}`;

        // Update modal image
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

        // Show modal
        document.getElementById('article-modal').classList.add('show');
    }

    showInstallButton() {
        document.getElementById('install-btn').style.display = 'flex';
    }

    hideInstallButton() {
        document.getElementById('install-btn').style.display = 'none';
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

        // Offline search toggle
        addIdListener('offline-search-toggle', 'click', () => {
            this.toggleOfflineSearch();
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

        // Use offline articles button
        addIdListener('use-offline-btn', 'click', () => {
            this.loadOfflineArticles();
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

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            const articleModal = document.getElementById('article-modal');
            const libraryModal = document.getElementById('offline-library-modal');
            const apiModal = document.getElementById('api-key-modal');

            if (e.target === articleModal) {
                this.hideArticleModal();
            }
            if (e.target === libraryModal) {
                this.hideOfflineLibraryModal();
            }
            if (e.target === apiModal) {
                this.hideApiKeyModal();
            }
        });

        // Modal close buttons
        addIdListener('modal-close', 'click', () => {
            this.hideArticleModal();
        });

        addIdListener('library-modal-close', 'click', () => {
            this.hideOfflineLibraryModal();
        });

        // Offline library button
        addIdListener('offline-library-btn', 'click', (e) => {
            e.preventDefault();
            this.showOfflineLibrary();
        });

        // Save for offline button in modal
        addIdListener('modal-save-offline', 'click', () => {
            this.saveCurrentArticleForOffline();
        });

        // Offline library controls
        addIdListener('sync-offline', 'click', () => {
            this.syncOfflineData();
        });

        addIdListener('clear-old-articles', 'click', () => {
            this.clearOldOfflineArticles();
        });

        addIdListener('export-library', 'click', () => {
            this.exportOfflineLibrary();
        });

        addIdListener('library-search-btn', 'click', () => {
            this.searchOfflineLibrary();
        });

        addIdListener('library-search', 'keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchOfflineLibrary();
            }
        });

        // Storage manager
        addIdListener('storage-manager', 'click', (e) => {
            e.preventDefault();
            this.showOfflineLibrary();
        });

        // Download offline button
        addIdListener('download-offline-btn', 'click', () => {
            this.downloadOfflineArticles();
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
    }

    // ==================== OFFLINE FEATURES ====================
    async toggleOfflineSearch() {
        const offlineSearchBtn = document.getElementById('offline-search-toggle');
        const searchInput = document.getElementById('search-input');

        if (offlineSearchBtn.classList.contains('active')) {
            // Switch to online search
            offlineSearchBtn.classList.remove('active');
            offlineSearchBtn.innerHTML = '<i class="fas fa-database"></i> Offline Search';
            searchInput.placeholder = 'Search for news, topics, or keywords...';
            this.showToast('Switched to online search', 'info');
        } else {
            // Switch to offline search
            offlineSearchBtn.classList.add('active');
            offlineSearchBtn.innerHTML = '<i class="fas fa-wifi"></i> Online Search';
            searchInput.placeholder = 'Search offline articles...';
            this.showToast('Switched to offline search', 'info');
        }
    }

    async saveCurrentArticleForOffline() {
        const modal = document.getElementById('article-modal');
        const articleId = modal.dataset.currentArticleId;

        if (!articleId) {
            this.showToast('No article selected', 'error');
            return;
        }

        // Find the article in current articles
        const article = this.articles.find(a => a.id === articleId);
        if (!article) {
            this.showToast('Article not found', 'error');
            return;
        }

        try {
            const saved = await this.offlineManager.saveArticleForOffline(article);
            if (saved) {
                // Update modal button
                const saveBtn = document.getElementById('modal-save-offline');
                if (saveBtn) {
                    saveBtn.innerHTML = '<i class="fas fa-check"></i> Saved Offline';
                    saveBtn.disabled = true;
                }

                // Show offline badge
                const offlineBadge = document.getElementById('modal-offline-badge');
                if (offlineBadge) {
                    offlineBadge.style.display = 'inline-flex';
                }
            }
        } catch (error) {
            console.error('Failed to save article for offline:', error);
        }
    }

    async showOfflineLibrary() {
        this.showOfflineLibraryModal();
        await this.loadOfflineLibrary();
    }

    async loadOfflineLibrary() {
        try {
            const articles = await this.offlineManager.getOfflineArticles(50);
            const stats = await this.offlineManager.updateStats();

            // Update library stats
            document.getElementById('library-total').textContent = stats.totalArticles || 0;
            document.getElementById('library-size').textContent =
                Math.round((stats.storageUsage || 0) / (1024 * 1024) * 100) / 100 + ' MB';
            document.getElementById('library-read').textContent = stats.readArticles || 0;
            document.getElementById('library-bookmarked').textContent = stats.bookmarkedArticles || 0;

            // Render articles
            this.renderOfflineLibraryArticles(articles);
        } catch (error) {
            console.error('Failed to load offline library:', error);
            this.showToast('Failed to load offline library', 'error');
        }
    }

    renderOfflineLibraryArticles(articles) {
        const container = document.getElementById('library-articles');
        if (!container) return;

        container.innerHTML = '';

        if (articles.length === 0) {
            container.innerHTML = `
                <div class="no-articles" style="text-align: center; padding: 40px 20px;">
                    <i class="fas fa-inbox" style="font-size: 48px; color: var(--text-secondary); margin-bottom: 15px;"></i>
                    <h3>No offline articles</h3>
                    <p>Save articles for offline reading to see them here.</p>
                </div>
            `;
            return;
        }

        articles.forEach(article => {
            const card = this.createOfflineLibraryCard(article);
            container.appendChild(card);
        });
    }

    createOfflineLibraryCard(article) {
            const card = document.createElement('div');
            card.className = 'offline-library-card';

            // Format date
            const date = new Date(article.published || article.savedDate);
            const formattedDate = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            card.innerHTML = `
            <div class="offline-library-card-header">
                <h4 class="offline-library-card-title">${this.truncateText(article.title, 80)}</h4>
                <div class="offline-library-card-actions">
                    <button class="btn-icon" data-action="read" title="Read">
                        <i class="fas fa-book-open"></i>
                    </button>
                    <button class="btn-icon" data-action="delete" title="Remove">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="offline-library-card-body">
                <p class="offline-library-card-description">${this.truncateText(article.description || 'No description', 120)}</p>
                <div class="offline-library-card-meta">
                    <span class="offline-library-card-date">
                        <i class="far fa-clock"></i> ${formattedDate}
                    </span>
                    ${article.read ? '<span class="offline-library-card-read"><i class="fas fa-check"></i> Read</span>' : ''}
                    ${article.category && article.category[0] ? 
                        `<span class="offline-library-card-category">${article.category[0]}</span>` : ''}
                </div>
            </div>
        `;

        // Add event listeners
        card.querySelector('[data-action="read"]').addEventListener('click', () => {
            this.showArticleModal(article);
        });

        card.querySelector('[data-action="delete"]').addEventListener('click', () => {
            this.removeArticleFromOfflineLibrary(article.id);
        });

        return card;
    }

    async removeArticleFromOfflineLibrary(articleId) {
        if (!confirm('Remove this article from your offline library?')) {
            return;
        }

        try {
            // Note: We would need to add a delete method to OfflineStorage
            // For now, we'll just show a message
            this.showToast('Article removal not implemented yet', 'warning');
        } catch (error) {
            console.error('Failed to remove article:', error);
            this.showToast('Failed to remove article', 'error');
        }
    }

    async searchOfflineLibrary() {
        const searchInput = document.getElementById('library-search');
        const query = searchInput ? searchInput.value.trim() : '';

        if (!query) {
            this.showToast('Please enter a search term', 'warning');
            return;
        }

        try {
            const articles = await this.offlineManager.searchOfflineArticles(query);
            this.renderOfflineLibraryArticles(articles);
            
            if (articles.length === 0) {
                this.showToast('No offline articles found', 'info');
            }
        } catch (error) {
            console.error('Failed to search offline library:', error);
            this.showToast('Failed to search offline library', 'error');
        }
    }

    async syncOfflineData() {
        this.showToast('Syncing offline data...', 'info');
        
        try {
            await this.offlineManager.syncPendingActions();
            await this.loadOfflineLibrary();
        } catch (error) {
            console.error('Sync failed:', error);
            this.showToast('Sync failed', 'error');
        }
    }

    async clearOldOfflineArticles() {
        const days = prompt('Clear articles older than how many days?', '30');
        if (!days || isNaN(days)) return;

        try {
            const deleted = await this.offlineManager.clearOldArticles(parseInt(days));
            await this.loadOfflineLibrary();
            
            if (deleted > 0) {
                this.showToast(`Cleared ${deleted} old articles`, 'success');
            } else {
                this.showToast('No old articles found', 'info');
            }
        } catch (error) {
            console.error('Failed to clear old articles:', error);
            this.showToast('Failed to clear old articles', 'error');
        }
    }

    async exportOfflineLibrary() {
        try {
            await this.offlineManager.exportLibrary();
        } catch (error) {
            console.error('Export failed:', error);
        }
    }

    async loadOfflineArticles() {
        this.currentPage = 1;
        this.searchQuery = '';

        await this.loadNews({
            source: 'offline',
            pageNum: 1
        });
    }

    showOfflineLibraryModal() {
        document.getElementById('offline-library-modal').classList.add('show');
    }

    hideOfflineLibraryModal() {
        document.getElementById('offline-library-modal').classList.remove('show');
    }

    // ==================== MODIFIED EXISTING METHODS ====================
    createArticleCard(article) {
        const card = document.createElement('div');
        card.className = 'news-card';
        card.dataset.articleId = article.id;

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

        // Check if article is available offline
        const isAvailableOffline = article.availableOffline || false;

        card.innerHTML = `
            <div class="news-image">
                ${hasImage ? 
                    `<img src="${article.image}" alt="${article.title}" loading="lazy">` : 
                    `<div class="no-image"><i class="fas fa-newspaper"></i></div>`
                }
                ${isAvailableOffline ? 
                    `<div class="offline-badge"><i class="fas fa-download"></i> Offline</div>` : ''
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

    async showArticleModal(article) {
        // Set current article ID on modal for offline saving
        const modal = document.getElementById('article-modal');
        modal.dataset.currentArticleId = article.id;
        
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
        
        // Check if article is available offline
        const offlineArticle = await this.offlineManager.getArticleWithOfflineStatus(article.id);
        const isAvailableOffline = offlineArticle ? offlineArticle.availableOffline : false;
        const isBookmarked = offlineArticle ? 
            await this.offlineManager.isArticleBookmarked(article.id) : false;
        const readingProgress = offlineArticle ? offlineArticle.progress : 0;
        
        // Update modal content
        document.getElementById('modal-title').textContent = article.title;
        document.getElementById('modal-source').innerHTML = `<i class="fas fa-globe"></i> ${domain}`;
        document.getElementById('modal-date').innerHTML = `<i class="far fa-clock"></i> ${formattedDate}`;
        document.getElementById('modal-author').innerHTML = article.author ? 
            `<i class="fas fa-user"></i> ${article.author}` : 
            `<i class="fas fa-user"></i> Unknown Author`;
        document.getElementById('modal-category').innerHTML = `<i class="fas fa-tag"></i> ${categories}`;
        
        // Update offline badge
        const offlineBadge = document.getElementById('modal-offline-badge');
        if (offlineBadge) {
            offlineBadge.style.display = isAvailableOffline ? 'inline-flex' : 'none';
        }
        
        // Update modal image
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
            bookmarkBtn.innerHTML = isBookmarked ? 
                `<i class="fas fa-bookmark"></i> Remove Bookmark` : 
                `<i class="far fa-bookmark"></i> Bookmark`;
            
            bookmarkBtn.onclick = () => this.toggleBookmark(article);
        }
        
        // Update save for offline button
        const saveOfflineBtn = document.getElementById('modal-save-offline');
        if (saveOfflineBtn) {
            if (isAvailableOffline) {
                saveOfflineBtn.innerHTML = '<i class="fas fa-check"></i> Saved Offline';
                saveOfflineBtn.disabled = true;
            } else {
                saveOfflineBtn.innerHTML = '<i class="far fa-save"></i> Save for Offline';
                saveOfflineBtn.disabled = false;
                saveOfflineBtn.onclick = () => this.saveCurrentArticleForOffline();
            }
        }
        
        // Update share button
        const shareBtn = document.getElementById('modal-share');
        if (shareBtn) {
            shareBtn.onclick = () => this.shareArticle(article);
        }
        
        // Update reading progress
        const progressContainer = document.getElementById('reading-progress');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        if (readingProgress > 0) {
            progressContainer.style.display = 'block';
            progressFill.style.width = readingProgress + '%';
            progressText.textContent = readingProgress + '% read';
        } else {
            progressContainer.style.display = 'none';
        }
        
        // Show modal
        document.getElementById('article-modal')?.classList.add('show');
        
        // Prefetch related articles in background
        this.offlineManager.prefetchRelatedArticles(article);
    }

    async toggleBookmark(article) {
        const result = await this.offlineManager.toggleBookmark(article);
        
        // Update modal button
        const bookmarkBtn = document.getElementById('modal-bookmark');
        if (bookmarkBtn) {
            bookmarkBtn.innerHTML = result.bookmarked ? 
                `<i class="fas fa-bookmark"></i> Remove Bookmark` : 
                `<i class="far fa-bookmark"></i> Bookmark`;
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
        this.currentPage = 1;

        await this.loadNews({
            source: 'search',
            query: query,
            filters: this.filters,
            pageNum: 1
        });
    }

    // Update the updateStats method to include offline stats
    async updateStats() {
        // Update offline stats via offline manager
        await this.offlineManager.updateStats();
        
        // Update existing stats
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

    // Keep all your existing API methods, but add offline fallback
    async makeApiRequest(url) {
        if (!this.apiKey) {
            this.showApiKeyModal();
            throw new Error('API key required');
        }

        // Check if offline
        if (!navigator.onLine) {
            console.log('Offline mode: using cached data');
            
            // Try to get cached data
            const cachedData = await this.getCachedNews();
            if (cachedData.length > 0) {
                return { status: 'ok', news: cachedData };
            }
            
            // Try to get offline articles from IndexedDB
            const offlineArticles = await this.offlineManager.getOfflineArticles(20);
            if (offlineArticles.length > 0) {
                return { status: 'ok', news: offlineArticles };
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

    // Add this method to check for cached news
    async getCachedNews() {
        // This would check the cache controller for cached API responses
        // For now, return empty array
        return [];
    }

    // Additional missing methods that are referenced elsewhere
    loadLatestNews() {
        this.loadCategoryNews('latest');
    }

    setActiveCategory(category) {
        this.currentCategory = category;
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
    }

    async loadCategoryNews(category) {
        this.currentCategory = category;
        this.currentPage = 1;
        this.searchQuery = '';

        await this.loadNews({
            source: 'category',
            category: category,
            pageNum: 1
        });
    }

    // ===== NEW: Unified article loader (online/offline/cache) =====
    async loadNews(params = {}) {
        const {
            source = 'latest',
            category = null,
            query = null,
            filters = {},
            pageNum = 1
        } = params;

        this.showLoading();

        try {
            // Use unified data fetcher
            const result = await this.offlineManager.fetchArticles({
                source: source,
                category: category,
                query: query,
                filters: filters,
                pageNum: pageNum,
                pageSize: this.pageSize,
                language: this.currentLanguage,
                apiKey: this.apiKey,
                baseUrl: this.baseUrl
            });

            // Store articles and pagination state
            this.articles = result.articles;
            this.currentPage = pageNum;

            // Calculate total pages using API metadata if available
            if (result.totalResults && result.totalResults > 0) {
                this.totalPages = Math.max(1, Math.ceil(result.totalResults / this.pageSize));
            } else {
                // Fallback to local calculation
                this.totalPages = Math.max(1, Math.ceil(result.articles.length / this.pageSize));
            }

            // Render using unified logic
            this.renderArticles();
            this.hideLoading();
            this.updateStats();
            this.hideError();

            // Show appropriate toast
            const sourceLabel = result.source === 'api' ? 'online' : 
                               result.source === 'cache' ? 'cached' : 'offline';
            const message = `Loaded ${result.articles.length} articles (${sourceLabel})`;
            this.showToast(message, result.isCached ? 'warning' : 'success');

        } catch (error) {
            console.error('Failed to load news:', error);
            this.hideLoading();

            // Guard: only show error if no existing content
            if (this.articles && this.articles.length > 0) {
                this.showToast(`Network issue. Showing existing results.`, 'warning');
                return;
            }

            this.showError(`Failed to load news: ${error.message}`);
        }
    }

    buildApiUrl(category) {
        let url = `${this.baseUrl}/latest-news?language=${this.currentLanguage}`;
        
        // Add API key
        if (this.apiKey) {
            url += `&apiKey=${this.apiKey}`;
        }
        
        // Add category if not 'latest'
        if (category && category !== 'latest') {
            url += `&category=${encodeURIComponent(category)}`;
        }
        
        // Add date range for historical news
        if (this.filters.start_date && this.filters.end_date) {
            url += `&start_date=${this.filters.start_date}&end_date=${this.filters.end_date}`;
        }
        
        // Add other filters
        if (this.filters.domain) {
            url += `&domain=${encodeURIComponent(this.filters.domain)}`;
        }
        
        if (this.filters.keywords) {
            url += `&keywords=${encodeURIComponent(this.filters.keywords)}`;
        }
        
        return url;
    }

    async loadArticles() {
        // This method loads the current page of articles
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const pageArticles = this.articles.slice(startIndex, endIndex);

        this.renderArticles(pageArticles);

        // Update pagination with context about data source
        this.updatePagination();
    }

    renderArticles(articles = null) {
        const container = document.getElementById('news-grid');
        if (!container) return;

        // Use current articles if not provided
        const articlesToRender = articles || this.articles;
        
        // Calculate pagination for current articles
        this.totalPages = Math.ceil(articlesToRender.length / this.pageSize);
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const pageArticles = articlesToRender.slice(startIndex, endIndex);

        container.innerHTML = '';

        if (pageArticles.length === 0) {
            container.innerHTML = `
                <div class="no-articles" style="text-align: center; padding: 40px 20px;">
                    <i class="fas fa-newspaper" style="font-size: 48px; color: var(--text-secondary); margin-bottom: 15px;"></i>
                    <h3>No articles found</h3>
                    <p>Try adjusting your search or filters.</p>
                </div>
            `;
            return;
        }

        pageArticles.forEach(article => {
            const card = this.createArticleCard(article);
            container.appendChild(card);
        });

        this.updatePagination();
    }

    updatePagination() {
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        const pageInfo = document.getElementById('page-info');
        const currentPageEl = document.getElementById('current-page');
        const totalPagesEl = document.getElementById('total-pages');

        if (!prevBtn || !nextBtn || !pageInfo) return;

        prevBtn.disabled = this.currentPage === 1;

        // Determine pagination display based on data source
        if (this.offlineMode || !navigator.onLine) {
            // Offline mode - show article count instead of total pages
            const articleCount = this.articles.length;
            const startItem = (this.currentPage - 1) * this.pageSize + 1;
            const endItem = Math.min(this.currentPage * this.pageSize, articleCount);

            pageInfo.innerHTML = `Offline • Page ${this.currentPage} • ${articleCount} articles`;

            // Disable next button if no more articles
            nextBtn.disabled = endItem >= articleCount;
        } else {
            // Online mode - show traditional pagination
            nextBtn.disabled = this.currentPage >= this.totalPages;

            if (this.totalPages === 1) {
                pageInfo.innerHTML = `Page ${this.currentPage} • ${this.articles.length} articles`;
            } else {
                pageInfo.innerHTML = `Page ${this.currentPage} of ${this.totalPages}`;
            }
        }

        // Update individual elements for screen readers
        if (currentPageEl) currentPageEl.textContent = this.currentPage;
        if (totalPagesEl) totalPagesEl.textContent = this.totalPages;
    }

    updateDateFilters() {
        // This method needs to be implemented
        // Set up date filters UI
    }

    applyFilters() {
        // This method needs to be implemented
        console.log('Applying filters...');
    }

    clearFilters() {
        // This function needs to be implemented
        console.log('Clearing filters...');
    }

    showLoading() {
        document.getElementById('loading').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }

    // ===== FIX #3: Proper error UI management =====
    showError(message) {
        document.getElementById('error-message').textContent = message;
        document.getElementById('error-container').style.display = 'block';
    }

    hideError() {
        const el = document.getElementById('error-container');
        if (el) el.style.display = 'none';
    }

    shareArticle(article) {
        // This method needs to be implemented
        console.log('Sharing article:', article.title);
    }

    installPWA() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            this.deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    this.showToast('PWA installed successfully!', 'success');
                }
                this.deferredPrompt = null;
                this.hideInstallButton();
            });
        }
    }

    saveApiKey() {
        const apiKey = document.getElementById('api-key-input').value;
        const saveChecked = document.getElementById('save-api-key').checked;
        
        if (!apiKey) {
            this.showToast('Please enter an API key', 'error');
            return;
        }
        
        if (saveChecked) {
            localStorage.setItem('currents_api_key', apiKey);
        }
        this.apiKey = apiKey;
        this.hideApiKeyModal();
        this.loadLatestNews();
        this.showToast('API key saved successfully', 'success');
    }

    useDemoMode() {
        // This method needs to be implemented
        console.log('Using demo mode');
        this.hideApiKeyModal();
    }

    resetApiKey() {
        localStorage.removeItem('currents_api_key');
        this.apiKey = null;
        this.showToast('API key reset', 'info');
    }

    performHistoricalSearch() {
        // This method needs to be implemented
        console.log('Performing historical search...');
    }

    async fetchHistoricalNews(query, filters) {
        try {
            // Build historical search URL
            let url = `${this.baseUrl}/search?language=${this.currentLanguage}&keywords=${encodeURIComponent(query)}`;
            
            // Add API key
            if (this.apiKey) {
                url += `&apiKey=${this.apiKey}`;
            }
            
            // Add date range
            if (filters.start_date && filters.end_date) {
                url += `&start_date=${filters.start_date}&end_date=${filters.end_date}`;
            }
            
            // Add other filters
            if (filters.domain) {
                url += `&domain=${encodeURIComponent(filters.domain)}`;
            }
            
            if (filters.category) {
                url += `&category=${encodeURIComponent(filters.category)}`;
            }
            
            console.log('Fetching historical news from:', url);
            
            // Make API request
            const data = await this.makeApiRequest(url);
            
            if (data && data.news) {
                return data.news;
            } else {
                throw new Error('No historical news data received');
            }
        } catch (error) {
            console.error('Failed to fetch historical news:', error);
            throw error;
        }
    }

    truncateText(text, limit) {
        if (text.length <= limit) return text;
        return text.slice(0, limit) + '...';
    }

    // ==================== DOWNLOAD OFFLINE ARTICLES ====================
    async downloadOfflineArticles() {
        try {
            // Prompt user for number of pages to download
            const pageCount = prompt(
                'How many pages would you like to download for offline reading?\n\n' +
                'Each page contains ~12 articles.\n' +
                'Recommended: 15 pages (~70-80 MB)\n' +
                'Maximum: 20 pages (~100 MB)',
                '15'
            );

            if (!pageCount || isNaN(pageCount)) {
                return;
            }

            const count = parseInt(pageCount);
            if (count < 1 || count > 20) {
                this.showToast('Please enter a number between 1 and 20', 'warning');
                return;
            }

            // Start manual download
            const success = await this.offlineManager.manualDownloadLatestPages(count);
            
            if (success) {
                // Refresh the current view to show downloaded articles
                await this.loadLatestNews();
            }

        } catch (error) {
            console.error('Download failed:', error);
            this.showToast('Download failed', 'error');
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.newsApp = new CurrentsNewsApp();
});