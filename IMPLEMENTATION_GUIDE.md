# Unified Pipeline - Implementation Guide

## Overview

This guide provides exact code changes needed to implement the unified pipeline refactor. Follow the steps in order.

---

## Step 1: Add Methods to offline-manager.js

**Location:** After the `getCacheStats()` method, add these three new methods:

```javascript
// ===== UNIFIED DATA FETCHER: Online/Offline/Cache Pipeline =====
async fetchArticles(params = {}) {
    const {
        source = 'latest',      // 'latest', 'category', 'search'
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
            const articles = await this._fetchFromAPI({
                source,
                category,
                query,
                filters,
                language,
                apiKey,
                baseUrl
            });

            if (articles && articles.length > 0) {
                // Cache this page for offline use
                await this.cacheArticlesPage(articles, pageNum, source);
                
                console.log(`[DataFetcher] Fetched ${articles.length} articles from API`);
                return {
                    articles: articles,
                    source: 'api',
                    pageNum: pageNum,
                    isCached: false
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

    // No data available
    throw new Error('No articles available (offline and no cache)');
}

// ===== HELPER: Fetch from API with proper error handling =====
async _fetchFromAPI(params) {
    const { source, category, query, filters, language, apiKey, baseUrl } = params;

    let url = `${baseUrl}/latest-news?language=${language}&apiKey=${apiKey}`;

    if (source === 'category' && category) {
        url = `${baseUrl}/latest-news?language=${language}&category=${encodeURIComponent(category)}&apiKey=${apiKey}`;
    } else if (source === 'search' && query) {
        url = `${baseUrl}/search?language=${language}&keywords=${encodeURIComponent(query)}&apiKey=${apiKey}`;
        
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
    return data.news || [];
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
```

---

## Step 2: Add Methods to offline-storage.js

**Location:** After the `clearOldArticles()` method, add these two new methods:

```javascript
// ===== NEW: Get cached articles page =====
async getArticlesPage(pageNum, source) {
    if (!this.db) return [];

    try {
        const key = `page_${source}_${pageNum}`;
        const setting = await this.getSetting(key);
        
        if (setting && setting.articles) {
            console.log(`[Storage] Retrieved cached page ${pageNum} for source "${source}"`);
            return setting.articles;
        }
        
        return [];
    } catch (error) {
        console.error('Error getting articles page:', error);
        return [];
    }
}

// ===== NEW: Cache articles page with metadata =====
async cacheArticlesPage(articles, pageNum, source) {
    if (!this.db || !articles || articles.length === 0) return false;

    try {
        const key = `page_${source}_${pageNum}`;
        const pageData = {
            articles: articles,
            source: source,
            pageNum: pageNum,
            cachedAt: new Date().toISOString(),
            count: articles.length
        };

        await this.setSetting(key, pageData);
        console.log(`[Storage] Cached ${articles.length} articles for page ${pageNum} (source: ${source})`);
        return true;
    } catch (error) {
        console.error('Error caching articles page:', error);
        return false;
    }
}
```

**Also modify existing method:**

Find `getOfflineArticles()` and change the signature to accept `source` parameter:

```javascript
// ===== MODIFY: getOfflineArticles to support pagination by source =====
async getOfflineArticles(limit = 100, offset = 0, source = null) {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['articles'], 'readonly');
        const store = transaction.objectStore('articles');

        // Use getAll() for reliability
        const request = store.getAll();

        request.onsuccess = (event) => {
            const allArticles = event.target.result;
            
            // Filter for articles saved for offline (savedForOffline === true)
            let offlineArticles = allArticles.filter(article => article.savedForOffline === true);
            
            // If source specified, filter by source
            if (source) {
                offlineArticles = offlineArticles.filter(article => article.source === source);
            }
            
            console.log(`[Storage] Found ${offlineArticles.length} offline articles (total: ${allArticles.length}, source: ${source})`);
            
            // Apply offset and limit
            const paginatedArticles = offlineArticles.slice(offset, offset + limit);
            
            resolve(paginatedArticles);
        };

        request.onerror = (event) => {
            console.error('Error getting offline articles:', event.target.error);
            reject(event.target.error);
        };
    });
}
```

---

## Step 3: Replace Methods in script.js

### 3a. Add new unified loader method

**Location:** In the `// ==================== MODIFIED EXISTING METHODS ====================` section, add this new method:

```javascript
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
        
        // Calculate total pages
        this.totalPages = Math.max(1, Math.ceil(result.articles.length / this.pageSize));

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
```

### 3b. Replace loadCategoryNews

**Find this method:**
```javascript
async loadCategoryNews(category) {
    this.currentCategory = category;
    this.showLoading();
    
    try {
        // Build API URL
        const url = this.buildApiUrl(category);
        console.log('Fetching news from:', url);
        
        // Make API request
        const data = await this.makeApiRequest(url);
        
        if (data && data.news) {
            this.articles = data.news;
            this.currentPage = 1;
            this.totalPages = Math.ceil(this.articles.length / this.pageSize);
            
            this.renderArticles();
            this.hideLoading();
            this.updateStats();
            this.hideError();
            
            this.showToast(`Loaded ${this.articles.length} articles`, 'success');
        } else {
            throw new Error('No news data received');
        }
    } catch (error) {
        console.error('Failed to load category news:', error);
        this.hideLoading();
        // ===== FIX #2: Guard error UI when content exists =====
        if (this.articles && this.articles.length > 0) {
            this.showToast('Network issue. Showing existing results.', 'warning');
            return;
        }
        this.showError('Failed to load news: ' + error.message);
    }
}
```

**Replace with:**
```javascript
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
```

### 3c. Replace loadLatestNews

**Find this method:**
```javascript
loadLatestNews() {
    this.loadCategoryNews('latest');
}
```

**It's already correct - no changes needed!**

### 3d. Replace performSearch

**Find this method:**
```javascript
async performSearch() {
    const searchInput = document.getElementById('search-input');
    const query = searchInput ? searchInput.value.trim() : '';

    if (!query) {
        this.showToast('Please enter a search term', 'warning');
        return;
    }

    const offlineSearchBtn = document.getElementById('offline-search-toggle');
    const isOfflineSearch = offlineSearchBtn && offlineSearchBtn.classList.contains('active');

    if (isOfflineSearch) {
        // Search offline articles
        this.searchQuery = query;
        this.showLoading();
        
        try {
            const articles = await this.offlineManager.searchOfflineArticles(query, this.filters);
            this.articles = articles;
            this.currentPage = 1;
            this.totalPages = Math.ceil(this.articles.length / this.pageSize);
            this.renderArticles();
            this.hideLoading();
            this.updateStats();
            this.hideError();
            this.showToast(`Found ${articles.length} offline articles for "${query}"`, 'success');
        } catch (error) {
            this.hideLoading();
            // ===== FIX #2: Guard error UI when content exists =====
            if (this.articles && this.articles.length > 0) {
                this.showToast('Offline search failed. Showing existing results.', 'warning');
                return;
            }
            this.showError(error.message);
        }
    } else {
        // Search online (existing functionality)
        this.searchQuery = query;
        this.showLoading();

        try {
            this.articles = await this.fetchHistoricalNews(query, this.filters);
            this.currentPage = 1;
            this.totalPages = Math.ceil(this.articles.length / this.pageSize);
            this.renderArticles();
            this.hideLoading();
            this.updateStats();
            this.hideError();
            this.showToast(`Found ${this.articles.length} articles for "${query}"`, 'success');
        } catch (error) {
            this.hideLoading();
            // ===== FIX #2: Guard error UI when content exists =====
            if (this.articles && this.articles.length > 0) {
                this.showToast('Search failed. Showing existing results.', 'warning');
                return;
            }
            this.showError(error.message);
        }
    }
}
```

**Replace with:**
```javascript
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
```

### 3e. Replace loadOfflineArticles

**Find this method:**
```javascript
async loadOfflineArticles() {
    this.showLoading();
    
    try {
        const articles = await this.offlineManager.getOfflineArticles(50);
        this.articles = articles;
        this.currentPage = 1;
        this.totalPages = Math.ceil(this.articles.length / this.pageSize);
        
        this.renderArticles();
        this.hideLoading();
        this.updateStats();
        this.hideError();
        
        this.showToast(`Loaded ${articles.length} offline articles`, 'success');
    } catch (error) {
        console.error('Failed to load offline articles:', error);
        this.hideLoading();
        // ===== FIX #2: Guard error UI when content exists =====
        if (this.articles && this.articles.length > 0) {
            this.showToast('Failed to load more offline content. Showing existing results.', 'warning');
            return;
        }
        this.showError('Failed to load offline articles: ' + error.message);
    }
}
```

**Replace with:**
```javascript
async loadOfflineArticles() {
    this.currentPage = 1;
    this.searchQuery = '';

    await this.loadNews({
        source: 'offline',
        pageNum: 1
    });
}
```

### 3f. Update pagination handlers

**Find in setupEventListeners():**
```javascript
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
```

**Replace with:**
```javascript
// Pagination
addIdListener('prev-page', 'click', () => {
    if (this.currentPage > 1) {
        this.currentPage--;
        this.loadNews({
            source: this.searchQuery ? 'search' : this.currentCategory,
            category: this.currentCategory,
            query: this.searchQuery,
            filters: this.filters,
            pageNum: this.currentPage
        });
    }
});

addIdListener('next-page', 'click', () => {
    if (this.currentPage < this.totalPages) {
        this.currentPage++;
        this.loadNews({
            source: this.searchQuery ? 'search' : this.currentCategory,
            category: this.currentCategory,
            query: this.searchQuery,
            filters: this.filters,
            pageNum: this.currentPage
        });
    }
});
```

---

## Step 4: Verify No Breaking Changes

These methods should remain **unchanged**:
- ✅ `renderArticles()` - Already unified
- ✅ `updatePagination()` - Already unified
- ✅ `createArticleCard()` - No changes
- ✅ `showArticleModal()` - No changes
- ✅ All UI/HTML - No changes
- ✅ All CSS - No changes

---

## Step 5: Test

### Quick Test
1. Load latest news
2. Click next page → should show page 2
3. Go offline (DevTools)
4. Click next page → should still work
5. Go back online
6. Search for something → pagination should work

### Full Test
- [ ] Load category → pagination works
- [ ] Click next/prev → loads correct page
- [ ] Go offline → pagination still works
- [ ] Search online → pagination works
- [ ] Search offline → pagination works
- [ ] API fails → automatic fallback
- [ ] Offline Library still works

---

## Rollback

If issues arise, revert the three files to their previous versions. The changes are isolated and don't affect other parts of the app.

---

## Summary

**Total changes:**
- offline-manager.js: +3 methods (~80 lines)
- offline-storage.js: +2 methods, modify 1 (~50 lines)
- script.js: +1 method, replace 4 methods, modify 2 handlers (~100 lines)

**Total new code:** ~230 lines
**Removed code:** ~150 lines
**Net change:** +80 lines

**Result:** Unified pipeline, correct pagination, transparent offline fallback
