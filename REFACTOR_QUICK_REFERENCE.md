# Unified Pipeline Refactor - Quick Reference

## Files to Modify

### 1. offline-manager.js
**Add 3 new methods:**
- `fetchArticles(params)` - Main unified data fetcher (online/offline/cache)
- `_fetchFromAPI(params)` - Helper for API calls
- `cacheArticlesPage(articles, pageNum, source)` - Cache page for offline

### 2. offline-storage.js
**Add 2 new methods, modify 1:**
- `getArticlesPage(pageNum, source)` - Retrieve cached page
- `cacheArticlesPage(articles, pageNum, source)` - Store page with metadata
- `getOfflineArticles()` - MODIFY to accept `source` parameter

### 3. script.js
**Replace 5 methods, modify 2:**
- `loadNews(params)` - NEW unified loader (replaces 3 separate methods)
- `loadCategoryNews(category)` - REPLACE (now calls loadNews)
- `loadLatestNews()` - REPLACE (now calls loadCategoryNews)
- `performSearch()` - REPLACE (now calls loadNews)
- `loadOfflineArticles()` - REPLACE (now calls loadNews)
- Pagination handlers - MODIFY to call loadNews instead of loadArticles

---

## What Stays the Same

✅ `renderArticles()` - No changes (already unified)
✅ `updatePagination()` - No changes (already unified)
✅ `createArticleCard()` - No changes
✅ `showArticleModal()` - No changes
✅ All UI/HTML - No changes
✅ All CSS - No changes
✅ Service Worker - No changes
✅ IndexedDB schema - No changes
✅ Offline Library modal - No changes (management only)

---

## Key Architectural Changes

### Before
```
3 separate entry points:
  - loadCategoryNews() → API only
  - loadOfflineArticles() → IndexedDB only
  - performSearch() → API or IndexedDB (manual toggle)

Result: Inconsistent behavior, broken pagination offline
```

### After
```
1 unified entry point:
  - loadNews(params) → Tries API → Falls back to cache → Falls back to IndexedDB

Result: Consistent behavior, pagination works everywhere
```

---

## Data Flow

```
User Action (click category, search, pagination)
    ↓
loadNews({ source, category, query, pageNum })
    ↓
offlineManager.fetchArticles(params)
    ↓
    ├─ If online: Try API
    │   ├─ Success: Cache page → Return articles
    │   └─ Fail: Fall through
    │
    ├─ If offline OR API failed: Try cache
    │   ├─ Found: Return cached page
    │   └─ Not found: Fall through
    │
    └─ Last resort: Try IndexedDB (all saved articles)
        ├─ Found: Return articles
        └─ Not found: Throw error
    ↓
renderArticles() (same logic for all sources)
    ↓
updatePagination() (same logic for all sources)
    ↓
UI displays articles with correct pagination
```

---

## Why This Works

1. **Single code path** - No duplicate rendering logic
2. **Transparent fallback** - User doesn't need to manually switch modes
3. **Page-by-page caching** - Each page cached separately, so pagination works offline
4. **Consistent UX** - Same pagination behavior online and offline
5. **Automatic offline** - When API fails, automatically uses cache/IndexedDB
6. **No UI changes** - Existing UI/styles/HTML preserved

---

## Implementation Complexity

- **Low risk** - Only internal data flow changes
- **No breaking changes** - UI/HTML/CSS unchanged
- **Backward compatible** - Existing IndexedDB data reused
- **Testable** - Each method can be tested independently
- **Maintainable** - Less code duplication

---

## Testing Strategy

### Unit Tests
- `fetchArticles()` with online/offline/cache scenarios
- `cacheArticlesPage()` storage operations
- `loadNews()` parameter handling

### Integration Tests
- Load category → pagination works
- Go offline → pagination still works
- API fails → automatic fallback
- Search online → pagination works
- Search offline → pagination works
- Pagination click → loads correct page

### Manual Tests
- Load latest news
- Click next/prev pages
- Go offline (DevTools)
- Refresh page
- Verify pagination still works
- Go back online
- Verify new data loads

---

## Rollback Plan

If issues arise:
1. Keep old methods as fallback
2. Add feature flag to switch between old/new
3. Gradually migrate users
4. Monitor error logs

---

## Performance Impact

- **Minimal** - Same number of API calls
- **Better** - Page-by-page caching reduces storage
- **Faster** - Cached pages load instantly offline
- **No regression** - Same rendering performance

---

## Security Considerations

- ✅ No new security risks
- ✅ Same API key handling
- ✅ Same IndexedDB access control
- ✅ Same Service Worker scope

---

## Browser Compatibility

- ✅ Works on all modern browsers
- ✅ No new APIs required
- ✅ Graceful degradation if IndexedDB unavailable

---

## Next Steps

1. Read `UNIFIED_PIPELINE_REFACTOR.md` for detailed code
2. Implement changes in order:
   - offline-manager.js (add methods)
   - offline-storage.js (add/modify methods)
   - script.js (replace methods)
3. Test each scenario
4. Deploy with confidence
