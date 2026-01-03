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
        this.bookmarks = JSON.parse(localStorage.getItem('currents_bookmarks') || '[]');
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';

        // Initialize the app
        this.init();
    }

    // Initialize the application
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
    }

    // Set up all event listeners
    setupEventListeners() {
        // Theme toggle
        document.querySelector('.theme-toggle').addEventListener('click', () => {
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
        document.getElementById('language-select').addEventListener('change', (e) => {
            this.currentLanguage = e.target.value;
            this.updateStats();
            this.loadCategoryNews(this.currentCategory);
        });

        // Search
        document.getElementById('search-btn').addEventListener('click', () => {
            this.performSearch();
        });

        document.getElementById('search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        // Advanced filters toggle
        document.getElementById('advanced-toggle').addEventListener('click', () => {
            const filters = document.getElementById('advanced-filters');
            filters.classList.toggle('show');
        });

        // Apply filters
        document.getElementById('apply-filters').addEventListener('click', () => {
            this.applyFilters();
        });

        // Clear filters
        document.getElementById('clear-filters').addEventListener('click', () => {
            this.clearFilters();
        });

        // Pagination
        document.getElementById('prev-page').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.loadArticles();
            }
        });

        document.getElementById('next-page').addEventListener('click', () => {
            if (this.currentPage < this.totalPages) {
                this.currentPage++;
                this.loadArticles();
            }
        });

        // Historical search
        document.getElementById('historical-search-btn').addEventListener('click', () => {
            this.performHistoricalSearch();
        });

        document.getElementById('historical-search').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performHistoricalSearch();
            }
        });

        // Refresh news
        document.getElementById('refresh-news').addEventListener('click', (e) => {
            e.preventDefault();
            this.loadCategoryNews(this.currentCategory);
        });

        // Retry button
        document.getElementById('retry-btn').addEventListener('click', () => {
            this.loadCategoryNews(this.currentCategory);
        });

        // API Key modal
        document.getElementById('save-api-key').addEventListener('click', () => {
            this.saveApiKey();
        });

        document.getElementById('use-demo').addEventListener('click', () => {
            this.useDemoMode();
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('article-modal');
            if (e.target === modal) {
                this.hideArticleModal();
            }
        });

        // Modal close buttons
        document.getElementById('modal-close').addEventListener('click', () => {
            this.hideArticleModal();
        });

        // Mobile menu toggle
        document.querySelector('.nav-toggle').addEventListener('click', () => {
            document.querySelector('.nav-menu').classList.toggle('show');
        });

        // Close mobile menu when clicking a link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                document.querySelector('.nav-menu').classList.remove('show');
            });
        });
    }

    // Theme management
    setTheme(isDark) {
        this.isDarkMode = isDark;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        localStorage.setItem('darkMode', isDark);

        const themeIcon = document.querySelector('.theme-toggle i');
        themeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }

    toggleTheme() {
        this.setTheme(!this.isDarkMode);
    }

    // API Key management
    showApiKeyModal() {
        document.getElementById('api-key-modal').classList.add('show');
    }

    hideApiKeyModal() {
        document.getElementById('api-key-modal').classList.remove('show');
    }

    saveApiKey() {
        const keyInput = document.getElementById('api-key-input');
        const saveCheckbox = document.getElementById('save-key');

        if (!keyInput.value.trim()) {
            this.showToast('Please enter a valid API key', 'error');
            return;
        }

        this.apiKey = keyInput.value.trim();

        if (saveCheckbox.checked) {
            localStorage.setItem('currents_api_key', this.apiKey);
        }

        this.hideApiKeyModal();
        this.showToast('API key saved successfully!', 'success');
        this.loadLatestNews();
    }

    useDemoMode() {
        // For demo purposes, we'll use a placeholder key
        // In production, users should get their own key from currentsapi.services
        this.showToast('Using demo mode. For full features, please add your own API key.', 'warning');
        this.apiKey = 'demo_key_placeholder'; // This will fail, but we'll handle it with mock data
        this.hideApiKeyModal();
        this.loadLatestNews();
    }

    // API calls
    async fetchLatestNews() {
        this.showLoading();

        try {
            const url = new URL(`${this.baseUrl}/latest-news`);
            url.searchParams.append('language', this.currentLanguage);
            url.searchParams.append('apiKey', this.apiKey);

            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Invalid API key. Please check your API key in settings.');
                }
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();

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

            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Invalid API key. Please check your API key in settings.');
                }
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();

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

    // Data loading
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
        const query = document.getElementById('search-input').value.trim();

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
        const query = document.getElementById('historical-search').value.trim();

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

    // UI rendering
    renderArticles() {
        const grid = document.getElementById('news-grid');
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
            const domain = article.url ? new URL(article.url).hostname.replace('www.', '') : 'Unknown Source';

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
        const domain = article.url ? new URL(article.url).hostname.replace('www.', '') : 'Unknown Source';
        
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
        const isBookmarked = this.bookmarks.some(b => b.id === article.id);
        bookmarkBtn.innerHTML = isBookmarked ? 
            `<i class="fas fa-bookmark"></i> Remove Bookmark` : 
            `<i class="far fa-bookmark"></i> Bookmark`;
        
        bookmarkBtn.onclick = () => this.toggleBookmark(article);
        
        // Update share button
        const shareBtn = document.getElementById('modal-share');
        shareBtn.onclick = () => this.shareArticle(article);
        
        // Show modal
        document.getElementById('article-modal').classList.add('show');
    }

    hideArticleModal() {
        document.getElementById('article-modal').classList.remove('show');
    }

    // Utility methods
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
            start_date: document.getElementById('start-date').value,
            end_date: document.getElementById('end-date').value,
            category: document.getElementById('category-filter').value,
            domain: document.getElementById('domain-filter').value.trim(),
            keywords: document.getElementById('search-input').value.trim()
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
        
        document.getElementById('start-date').max = today;
        document.getElementById('end-date').max = today;
        document.getElementById('end-date').min = lastWeekFormatted;
    }

    updatePagination() {
        document.getElementById('current-page').textContent = this.currentPage;
        document.getElementById('total-pages').textContent = this.totalPages;
        
        document.getElementById('prev-page').disabled = this.currentPage === 1;
        document.getElementById('next-page').disabled = this.currentPage === this.totalPages || this.totalPages === 0;
    }

    updateStats() {
        document.getElementById('article-count').textContent = this.articles.length;
        document.getElementById('last-updated').textContent = new Date().toLocaleTimeString([], { 
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
        
        document.getElementById('current-language').textContent = 
            languageNames[this.currentLanguage] || this.currentLanguage;
    }

    // UI state management
    showLoading() {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('error-container').style.display = 'none';
        document.getElementById('news-grid').style.display = 'none';
        document.getElementById('pagination').style.display = 'none';
        document.getElementById('stats-bar').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('news-grid').style.display = 'grid';
        document.getElementById('pagination').style.display = 'flex';
        document.getElementById('stats-bar').style.display = 'flex';
    }

    showError(message) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error-container').style.display = 'block';
        document.getElementById('news-grid').style.display = 'none';
        document.getElementById('pagination').style.display = 'none';
        document.getElementById('stats-bar').style.display = 'none';
        
        document.getElementById('error-message').textContent = message;
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
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

    // Bookmark functionality
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
        localStorage.setItem('currents_bookmarks', JSON.stringify(this.bookmarks));
        
        // Update modal button
        const bookmarkBtn = document.getElementById('modal-bookmark');
        const isBookmarked = index === -1; // Just toggled, so opposite of before
        bookmarkBtn.innerHTML = isBookmarked ? 
            `<i class="fas fa-bookmark"></i> Remove Bookmark` : 
            `<i class="far fa-bookmark"></i> Bookmark`;
    }

    // Share functionality
    shareArticle(article) {
        if (navigator.share) {
            navigator.share({
                title: article.title,
                text: article.description,
                url: article.url,
            })
            .then(() => this.showToast('Article shared successfully!', 'success'))
            .catch(error => this.showToast('Sharing failed: ' + error.message, 'error'));
        } else {
            // Fallback: Copy to clipboard
            navigator.clipboard.writeText(`${article.title} - ${article.url}`)
                .then(() => this.showToast('Link copied to clipboard!', 'success'))
                .catch(() => this.showToast('Failed to copy link', 'error'));
        }
    }

    // Mock data for demo mode
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
                published: new Date(Date.now() - 86400000).toISOString() // Yesterday
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
                published: new Date(Date.now() - 172800000).toISOString() // 2 days ago
            },
            {
                id: 'mock-4',
                title: 'New Medical Discovery Offers Hope for Rare Diseases',
                description: 'Researchers have made a groundbreaking discovery that could lead to effective treatments for several rare genetic disorders.',
                url: 'https://example.com/medical-discovery',
                author: 'Science Daily',
                image: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                language: 'en',
                category: ['health', 'science'],
                published: new Date(Date.now() - 259200000).toISOString() // 3 days ago
            },
            {
                id: 'mock-5',
                title: 'International Sports Championship Breaks Viewership Records',
                description: 'The recent international sports championship has broken all previous viewership records, with billions tuning in worldwide.',
                url: 'https://example.com/sports-championship',
                author: 'Sports Network',
                image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                language: 'en',
                category: ['sports'],
                published: new Date(Date.now() - 345600000).toISOString() // 4 days ago
            },
            {
                id: 'mock-6',
                title: 'Film Festival Showcases Groundbreaking Independent Cinema',
                description: 'This year\'s international film festival has highlighted innovative independent films from emerging directors around the world.',
                url: 'https://example.com/film-festival',
                author: 'Entertainment Weekly',
                image: 'https://images.unsplash.com/photo-1489599809516-9827b6d1cf13?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                language: 'en',
                category: ['entertainment'],
                published: new Date(Date.now() - 432000000).toISOString() // 5 days ago
            }
        ];
        
        this.articles = mockArticles;
        this.currentPage = 1;
        this.totalPages = Math.ceil(this.articles.length / this.pageSize);
        this.renderArticles();
        this.hideLoading();
        this.updateStats();
    }

    // Load articles with current pagination
    loadArticles() {
        this.renderArticles();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.newsApp = new CurrentsNewsApp();
});

// Service worker registration for PWA capabilities
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(error => {
            console.log('ServiceWorker registration failed:', error);
        });
    });
}

// Replace the entire CurrentsNewsApp class with this updated version
class CurrentsNewsApp {
    constructor() {
        this.apiKey = localStorage.getItem('currents_api_key');
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
        
        this.init();
    }

    init() {
        this.setTheme(this.isDarkMode);
        this.setupEventListeners();
        this.updateDateFilters();
        
        // Check for API key on startup
        if (!this.apiKey) {
            this.showApiKeyModal();
        } else {
            this.loadLatestNews();
        }
    }

    // New API key management methods
    showApiKeyModal() {
        document.getElementById('api-key-modal').classList.add('show');
    }

    hideApiKeyModal() {
        document.getElementById('api-key-modal').classList.remove('show');
    }

    saveApiKey() {
        const keyInput = document.getElementById('api-key-input');
        const saveCheckbox = document.getElementById('save-api-key');
        
        const key = keyInput.value.trim();
        
        if (!key) {
            this.showToast('Please enter an API key', 'error');
            return;
        }
        
        // Test the API key first
        this.testApiKey(key).then(isValid => {
            if (isValid) {
                this.apiKey = key;
                
                if (saveCheckbox.checked) {
                    localStorage.setItem('currents_api_key', key);
                }
                
                this.hideApiKeyModal();
                this.showToast('API key saved successfully!', 'success');
                this.loadLatestNews();
            } else {
                this.showToast('Invalid API key. Please check and try again.', 'error');
            }
        }).catch(() => {
            this.showToast('Could not verify API key. Check your connection.', 'error');
        });
    }

    async testApiKey(key) {
        try {
            const testUrl = `${this.baseUrl}/latest-news?language=en&apiKey=${key}&limit=1`;
            const response = await fetch(testUrl);
            
            if (response.status === 401) {
                return false; // Invalid key
            }
            
            const data = await response.json();
            return data.status === 'ok';
        } catch {
            return false;
        }
    }

    useDemoMode() {
        this.showToast('Using demo mode with sample articles. Get a free API key for real news!', 'warning');
        this.hideApiKeyModal();
        this.useMockData();
    }

    // Update API calls to check for key
    async makeApiRequest(url) {
        if (!this.apiKey) {
            this.showApiKeyModal();
            throw new Error('API key required');
        }
        
        const response = await fetch(url);
        
        if (response.status === 401) {
            // Invalid API key - clear it and show modal
            localStorage.removeItem('currents_api_key');
            this.apiKey = null;
            this.showApiKeyModal();
            this.showToast('Your API key has expired or is invalid. Please enter a new one.', 'error');
            throw new Error('Invalid API key');
        }
        
        return response;
    }

    // Update your fetch methods to use makeApiRequest
    async fetchLatestNews() {
        this.showLoading();
        
        try {
            const url = new URL(`${this.baseUrl}/latest-news`);
            url.searchParams.append('language', this.currentLanguage);
            url.searchParams.append('apiKey', this.apiKey);
            
            const response = await this.makeApiRequest(url);
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }
            
            const data = await response.json();
            
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

    // Update setupEventListeners
    setupEventListeners() {
        // Existing listeners...
        
        // Add API key modal listeners
        document.getElementById('save-key-btn').addEventListener('click', () => {
            this.saveApiKey();
        });

        document.getElementById('try-demo-btn').addEventListener('click', () => {
            this.useDemoMode();
        });

        document.getElementById('api-key-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveApiKey();
            }
        });
        
        // Add "Reset API Key" button to footer
        document.getElementById('reset-api-key')?.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('currents_api_key');
            this.apiKey = null;
            this.showApiKeyModal();
            this.showToast('API key cleared. Please enter a new one.', 'info');
        });
    }
    
    // ... rest of your existing methods
}

// Add this method to your CurrentsNewsApp class
registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
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
                    
                    // Check if user is online/offline
                    this.checkOnlineStatus();
                    
                    // Listen for online/offline events
                    window.addEventListener('online', () => this.handleOnline());
                    window.addEventListener('offline', () => this.handleOffline());
                    
                })
                .catch(error => {
                    console.log('Service Worker registration failed:', error);
                });
        });
    }
}

// Add these helper methods
checkOnlineStatus() {
    const isOnline = navigator.onLine;
    const statusElement = document.getElementById('online-status') || this.createOnlineStatusIndicator();
    
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
    document.querySelector('.header-controls').prepend(statusElement);
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

// Update your init() method to include service worker registration
init() {
    this.setTheme(this.isDarkMode);
    this.setupEventListeners();
    this.updateDateFilters();
    this.registerServiceWorker(); // ADD THIS LINE
    
    if (!this.apiKey) {
        this.showApiKeyModal();
    } else {
        this.loadLatestNews();
    }
}

// Update your API methods to handle offline mode
async fetchLatestNews() {
    this.showLoading();
    
    // Check if offline
    if (!navigator.onLine) {
        this.showToast('Offline mode: Showing cached articles', 'warning');
        return this.getCachedNews();
    }
    
    try {
        // ... existing fetch code ...
    } catch (error) {
        // If online but API fails, try cached data
        if (navigator.onLine) {
            console.log('API failed, trying cached data...');
            return this.getCachedNews();
        }
        throw error;
    }
}

// Add method to get cached news
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

// Enhanced mock data for offline
getMockNews() {
    return [
        {
            id: 'offline-1',
            title: 'Offline Mode Active',
            description: 'You are currently offline. Previously viewed articles are shown here. Connect to the internet for latest news.',
            url: '#',
            author: 'Currents News',
            image: 'https://images.unsplash.com/photo-1589652717521-10c0d092dea9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            language: 'en',
            category: ['general'],
            published: new Date().toISOString()
        },
        // Add more offline placeholder articles...
    ];
}

// Add to setupEventListeners()
setupEventListeners() {
    // ... existing listeners ...
    
    // Install button
    document.getElementById('install-btn')?.addEventListener('click', () => {
        this.installPWA();
    });
    
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
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

// Install PWA methods
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

// Check if app is running in standalone mode
checkStandaloneMode() {
    if (window.matchMedia('(display-mode: standalone)').matches || 
        window.navigator.standalone === true) {
        console.log('Running in PWA mode');
        // You can add PWA-specific features here
    }
}