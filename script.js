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

        // Initialize the app
        this.init();
    }

    // ==================== INITIALIZATION ====================
    init() {
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
                navigator.serviceWorker.register('/sw.js')
                navigator.serviceWorker.register('./sw.js')
                    .then(registration => {
                        console.log('Service Worker registered with scope:', registration.scope);
                        
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
                        console.log('Service Worker registration failed:', error);
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