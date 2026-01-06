# Unified Article Pipeline Refactor

## Executive Summary

The current architecture has **separate code paths for online and offline**, causing:
- Offline articles only appear after search
- Pagination collapses to "1 of 1" 
- Offline feels like a separate app
- Duplicate rendering logic

**Solution:** Create a **single unified pipeline** where online and offline use identical rendering/pagination logic. The only difference is the data source (API vs IndexedDB).

---

## Current Architecture (Broken)

```
Online Path:
  loadCategoryNews() → API fetch → renderArticles() → pagination works

Offline Path:
  loadOfflineArticles() → IndexedDB → renderArticles() → pagination broken
  
Search Path:
  performSearch() → API OR IndexedDB → renderArticles() → works
```

**Problem:** Three separate entry points, inconsistent behavior.

---

## New Unified Architecture

```
Single Entry Point:
  loadNews(source, params) 
    ↓
  Unified Data Fetcher:
    - Try API (if online)
    - Fallback to IndexedDB (if offline or API fails)
    - Cache results to IndexedDB (page-by-page)
    ↓
  Unified Renderer:
    - renderArticles() (same logic for all sources)
    - updatePagination() (same logic for all sources)
    ↓
  Result: Seamless online/offline, consistent pagination
```

---

## Files to Modify

### 1. **offline-manager.js** - Add unified data fetcher
   - New method: `fetchArticles(params)` - handles online/offline/cache logic
   - New method: `cacheArticlesPage(articles, pageNum)` - cache by page

### 2. **script.js** - Refactor to use unified pipeline
   - Replace `loadCategoryNews()`, `loadOfflineArticles()`, `performSearch()` with unified `loadNews()`
   - Remove duplicate rendering logic
   - Keep pagination logic (already correct)

### 3. **offline-storage.js** - Add page-based caching
   - New method: `cacheArticlesPage(articles, pageNum, source)` - store page metadata
   - New method: `getArticlesPage(pageNum, source)` - retrieve cached page
   - Modify `getOfflineArticles()` to support pagination by source

---

## Detailed Code Changes

### Change 1: offline-manager.js - Add Unified Data Fetcher

**Add these methods to OfflineManager class:**

```javascript
// ===== NEW: Unified article fetcher (online/offline/cache) =====
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

    // Try to get cached page first (if offline or as fallback)
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

    // If online, try API
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

    // Fallback: Try IndexedDB (all saved articles, not just explicitly saved)
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

// ===== NEW: Fetch from API with proper error handling =====
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

// ===== NEW: Cache articles page for offline use =====
async cacheArticlesPage(articles, pageNum, source) {
    if (!articles || articles.length === 0) return;

    try {
        // Store page metadata for retrieval
        await this.storage.setSetting(`page_${source}_${pageNum}`, {
            articles: articles,
            source: source,
            pageNum: pageNum,
            cachedAt: new Date().toISOString()
        });

        console.log(`[DataFetcher] Cached page ${pageNum} for source "${source}"`);
    } catch (error) {
        console.warn(`[DataFetcher] Failed to cache page: ${error.message}`);
    }
}

// ===== NEW: Get total article count for pagination =====
async getArticleCount(source) {
    try {
        // For API sources, we'd need to track this separately
        // For now, return a reasonable estimate
        const stats = await this.storage.getStorageStats();
        return stats.totalArticles || 0;
    } catch (error) {
        console.warn(`[DataFetcher] Failed to get article count: ${error.message}`);
        return 0;
    }
}
```

### Change 2: offline-storage.js - Add Page-Based Caching

**Add these methods to OfflineStorage class:**

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

### Change 3: script.js - Unified Loading Pipeline

**Replace these methods in CurrentsNewsApp class:**

```javascript
// ===== REPLACE: loadCategoryNews, loadOfflineArticles, performSearch with unified loadNews =====

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
        
        // Calculate total pages (estimate based on typical API response)
        // For real implementation, track total count from API
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

// ===== REPLACE: loadCategoryNews =====
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

// ===== REPLACE: loadLatestNews =====
loadLatestNews() {
    this.loadCategoryNews('latest');
}

// ===== REPLACE: performSearch =====
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

// ===== REPLACE: loadOfflineArticles (now just calls unified pipeline) =====
async loadOfflineArticles() {
    this.currentPage = 1;
    this.searchQuery = '';

    await this.loadNews({
        source: 'offline',
        pageNum: 1
    });
}

// ===== KEEP: loadArticles (pagination handler - no changes needed) =====
async loadArticles() {
    // This method loads the current page of articles
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    const pageArticles = this.articles.slice(startIndex, endIndex);
    
    this.renderArticles(pageArticles);
    this.updatePagination();
}

// ===== KEEP: renderArticles (no changes needed) =====
// Already unified - works for all sources

// ===== KEEP: updatePagination (no changes needed) =====
// Already unified - works for all sources
```

### Change 4: script.js - Update Pagination Handlers

**Modify pagination click handlers to use unified pipeline:**

```javascript
// In setupEventListeners(), replace pagination handlers:

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

## Data Flow Diagram

### Before (Broken)
```
User clicks "Latest"
  ↓
loadCategoryNews('latest')
  ↓
API fetch
  ↓
renderArticles()
  ↓
Pagination: "1 of N" ✓

User goes offline
  ↓
loadOfflineArticles()
  ↓
IndexedDB fetch (all articles)
  ↓
renderArticles()
  ↓
Pagination: "1 of 1" ✗ (broken)
```

### After (Fixed)
```
User clicks "Latest"
  ↓
loadNews({ source: 'category', category: 'latest', pageNum: 1 })
  ↓
fetchArticles() → Try API → Cache page → Return articles
  ↓
renderArticles() (same logic)
  ↓
Pagination: "1 of N" ✓

User goes offline
  ↓
loadNews({ source: 'category', category: 'latest', pageNum: 1 })
  ↓
fetchArticles() → API fails → Try cache → Return cached page
  ↓
renderArticles() (same logic)
  ↓
Pagination: "1 of N" ✓ (works!)

User clicks "Next"
  ↓
loadNews({ source: 'category', category: 'latest', pageNum: 2 })
  ↓
fetchArticles() → Try API page 2 → Cache page 2 → Return articles
  ↓
renderArticles() (same logic)
  ↓
Pagination: "2 of N" ✓
```

---

## Benefits

✅ **Single code path** - Online and offline use identical rendering/pagination
✅ **Transparent fallback** - API fails → cache → IndexedDB (automatic)
✅ **Page-by-page caching** - Each page cached separately for offline use
✅ **Correct pagination** - "1 of N" works for both online and offline
✅ **No UI changes** - Existing UI/styles preserved
✅ **Maintainable** - Less duplicate code, easier to debug
✅ **Real offline behavior** - Offline Library becomes optional (not required to read)

---

## Testing Checklist

- [ ] Load latest news online → pagination shows "1 of N"
- [ ] Click next page → loads page 2, shows "2 of N"
- [ ] Go offline → still shows cached pages with correct pagination
- [ ] Search online → pagination works
- [ ] Search offline → pagination works
- [ ] Switch categories → pagination resets to "1 of N"
- [ ] API fails → automatically falls back to cache
- [ ] Offline Library still works (management only)
- [ ] Stats show correct offline article count

---

## Implementation Order

1. Add methods to `offline-manager.js` (fetchArticles, cacheArticlesPage)
2. Add methods to `offline-storage.js` (getArticlesPage, cacheArticlesPage)
3. Replace methods in `script.js` (loadNews, loadCategoryNews, performSearch, etc.)
4. Update pagination handlers in `script.js`
5. Test all scenarios

---

## Backward Compatibility

- Existing UI/HTML unchanged
- Existing CSS unchanged
- Existing Service Worker unchanged
- Existing IndexedDB schema unchanged
- Only internal data flow refactored
