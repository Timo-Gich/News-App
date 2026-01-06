# Unified Pipeline - Visual Architecture

## Current Architecture (Broken)

```
┌─────────────────────────────────────────────────────────────────┐
│                    CurrentsNewsApp                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  loadCategoryNews()          loadOfflineArticles()              │
│         │                            │                          │
│         ├─→ API fetch                ├─→ IndexedDB fetch       │
│         │   (online only)            │   (offline only)        │
│         │                            │                          │
│         └─→ renderArticles()         └─→ renderArticles()      │
│             Pagination: "1 of N" ✓       Pagination: "1 of 1" ✗│
│                                                                 │
│  performSearch()                                                │
│         │                                                       │
│         ├─→ API fetch (if online)                              │
│         │   OR IndexedDB fetch (if offline)                    │
│         │                                                       │
│         └─→ renderArticles()                                   │
│             Pagination: Works sometimes                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

PROBLEM: 3 separate entry points, inconsistent behavior
```

---

## New Architecture (Fixed)

```
┌─────────────────────────────────────────────────────────────────┐
│                    CurrentsNewsApp                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  loadCategoryNews()  performSearch()  loadOfflineArticles()    │
│         │                   │                   │               │
│         └───────────────────┴───────────────────┘               │
│                     │                                           │
│                loadNews(params)                                │
│                     │                                           │
│                     ↓                                           │
│         ┌───────────────────────┐                              │
│         │  fetchArticles()       │                              │
│         │  (Unified Fetcher)    │                              │
│         └───────────────────────┘                              │
│                     │                                           │
│         ┌───────────┼───────────┐                              │
│         │           │           │                              ��
│         ↓           ↓           ↓                              │
│      Try API    Try Cache   Try IndexedDB                      │
│      (online)   (offline)   (fallback)                         │
│         │           │           │                              │
│         └───────────┴───────────┘                              │
│                     │                                           │
│                     ↓                                           │
│         ┌───────────────────────┐                              │
│         │  renderArticles()      │                              │
│         │  (Unified Renderer)   │                              │
│         └───────────────────────┘                              │
│                     │                                           │
│                     ↓                                           │
│         ┌───────────────────────┐                              │
│         │  updatePagination()   │                              │
│         │  (Unified Pagination) │                              │
│         └───────────────────────┘                              │
│                     │                                           │
│         Pagination: "1 of N" ✓ (always works)                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

SOLUTION: 1 entry point, unified behavior
```

---

## Data Flow Comparison

### Before: Category Load (Online)
```
User clicks "Latest"
    ↓
loadCategoryNews('latest')
    ↓
makeApiRequest(url)
    ↓
fetch(url)
    ↓
response.json()
    ↓
this.articles = data.news
    ↓
renderArticles()
    ↓
updatePagination()
    ↓
Display: "1 of N" ✓
```

### Before: Category Load (Offline)
```
User clicks "Latest" (offline)
    ↓
loadCategoryNews('latest')
    ↓
makeApiRequest(url)
    ↓
fetch(url) → FAILS
    ↓
Try IndexedDB fallback
    ↓
getOfflineArticles(50)
    ↓
this.articles = all_saved_articles
    ↓
renderArticles()
    ↓
updatePagination()
    ↓
Display: "1 of 1" ✗ (broken)
```

### After: Category Load (Online)
```
User clicks "Latest"
    ↓
loadNews({ source: 'category', category: 'latest', pageNum: 1 })
    ↓
fetchArticles(params)
    ↓
Try API → Success
    ↓
Cache page 1
    ↓
Return articles
    ↓
this.articles = articles
    ↓
renderArticles()
    ↓
updatePagination()
    ↓
Display: "1 of N" ✓
```

### After: Category Load (Offline)
```
User clicks "Latest" (offline)
    ↓
loadNews({ source: 'category', category: 'latest', pageNum: 1 })
    ↓
fetchArticles(params)
    ↓
Try API → FAILS
    ↓
Try Cache → Found page 1
    ↓
Return cached articles
    ↓
this.articles = articles
    ↓
renderArticles()
    ↓
updatePagination()
    ↓
Display: "1 of N" ✓
```

### After: Pagination (Online)
```
User clicks "Next"
    ↓
loadNews({ source: 'category', category: 'latest', pageNum: 2 })
    ↓
fetchArticles(params)
    ↓
Try API → Success
    ↓
Cache page 2
    ↓
Return articles
    ↓
this.articles = articles
    ↓
renderArticles()
    ↓
updatePagination()
    ↓
Display: "2 of N" ✓
```

### After: Pagination (Offline)
```
User clicks "Next" (offline)
    ↓
loadNews({ source: 'category', category: 'latest', pageNum: 2 })
    ↓
fetchArticles(params)
    ↓
Try API → FAILS
    ↓
Try Cache → Found page 2
    ↓
Return cached articles
    ↓
this.articles = articles
    ↓
renderArticles()
    ↓
updatePagination()
    ↓
Display: "2 of N" ✓
```

---

## Caching Strategy

### Before: No Page-Based Caching
```
API Response (100 articles)
    ↓
Store all in memory
    ↓
Render page 1 (12 articles)
    ↓
Go offline
    ↓
Can't load page 2 (not cached)
```

### After: Page-Based Caching
```
API Response (page 1: 12 articles)
    ↓
Store in IndexedDB with metadata:
  - page_category_latest_1: [12 articles]
    ↓
Render page 1 (12 articles)
    ↓
Go offline
    ↓
Click "Next"
    ↓
Retrieve page_category_latest_2 from cache
    ↓
Display page 2 ✓
```

---

## Method Call Hierarchy

### Before
```
CurrentsNewsApp
├── loadCategoryNews()
│   ├── makeApiRequest()
│   ├── renderArticles()
│   └── updatePagination()
├── loadOfflineArticles()
│   ├── offlineManager.getOfflineArticles()
│   ├── renderArticles()
│   └── updatePagination()
└── performSearch()
    ├── offlineManager.searchOfflineArticles() OR makeApiRequest()
    ├── renderArticles()
    └── updatePagination()
```

### After
```
CurrentsNewsApp
├── loadNews(params)
│   ├── offlineManager.fetchArticles()
│   │   ├── _fetchFromAPI()
│   │   ├── offlineStorage.getArticlesPage()
│   │   ├── offlineStorage.getOfflineArticles()
│   │   └── cacheArticlesPage()
│   ├── renderArticles()
│   └── updatePagination()
├── loadCategoryNews()
│   └── loadNews({ source: 'category', ... })
├── performSearch()
│   └── loadNews({ source: 'search', ... })
└── loadOfflineArticles()
    └── loadNews({ source: 'offline', ... })
```

---

## State Management

### Before
```
this.articles = []              // Current articles
this.currentPage = 1            // Current page
this.totalPages = 1             // Total pages
this.currentCategory = 'latest' // Current category
this.searchQuery = ''           // Current search
```

### After (Same)
```
this.articles = []              // Current articles (same)
this.currentPage = 1            // Current page (same)
this.totalPages = 1             // Total pages (same)
this.currentCategory = 'latest' // Current category (same)
this.searchQuery = ''           // Current search (same)

// Plus: Page cache in IndexedDB
offlineStorage.settings:
  page_category_latest_1: { articles: [...], ... }
  page_category_latest_2: { articles: [...], ... }
  page_search_query_1: { articles: [...], ... }
```

---

## Error Handling

### Before
```
loadCategoryNews()
    ↓
API fails
    ↓
Try cache
    ↓
If cache empty: Show error
If cache has data: Show error anyway (inconsistent)
```

### After
```
loadNews()
    ↓
fetchArticles()
    ↓
Try API → Fail
    ↓
Try Cache → Success
    ↓
Return articles (no error)
    ↓
Try Cache → Fail
    ↓
Try IndexedDB → Success
    ↓
Return articles (no error)
    ↓
Try IndexedDB → Fail
    ↓
Throw error (only if all sources fail)
    ↓
Show error only if no existing content
```

---

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| Entry points | 3 | 1 |
| Code paths | Separate | Unified |
| Pagination online | "1 of N" ✓ | "1 of N" ✓ |
| Pagination offline | "1 of 1" ✗ | "1 of N" ✓ |
| Caching | None | Page-based |
| Fallback | Manual | Automatic |
| Maintainability | Low | High |
| Duplicate code | High | Low |
