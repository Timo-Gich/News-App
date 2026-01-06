# Unified Pipeline Refactor - Implementation Checklist

## Pre-Implementation

- [ ] Read REFACTOR_SUMMARY.md
- [ ] Review ARCHITECTURE_DIAGRAMS.md
- [ ] Understand the problem and solution
- [ ] Review IMPLEMENTATION_GUIDE.md
- [ ] Backup current code (git commit)
- [ ] Create feature branch

---

## Implementation Phase 1: offline-manager.js

### Add fetchArticles() method
- [ ] Locate: After `getCacheStats()` method
- [ ] Copy: Complete `fetchArticles()` method from IMPLEMENTATION_GUIDE.md
- [ ] Verify: Method signature matches documentation
- [ ] Test: No syntax errors (check console)

### Add _fetchFromAPI() method
- [ ] Copy: Complete `_fetchFromAPI()` method from IMPLEMENTATION_GUIDE.md
- [ ] Verify: Handles all source types (latest, category, search)
- [ ] Test: No syntax errors (check console)

### Add cacheArticlesPage() method
- [ ] Copy: Complete `cacheArticlesPage()` method from IMPLEMENTATION_GUIDE.md
- [ ] Verify: Calls storage.cacheArticlesPage()
- [ ] Test: No syntax errors (check console)

### Verification
- [ ] No console errors
- [ ] Methods are accessible from script.js
- [ ] Code formatting matches existing style

---

## Implementation Phase 2: offline-storage.js

### Add getArticlesPage() method
- [ ] Locate: After `clearOldArticles()` method
- [ ] Copy: Complete `getArticlesPage()` method from IMPLEMENTATION_GUIDE.md
- [ ] Verify: Returns array or empty array
- [ ] Test: No syntax errors (check console)

### Add cacheArticlesPage() method
- [ ] Copy: Complete `cacheArticlesPage()` method from IMPLEMENTATION_GUIDE.md
- [ ] Verify: Stores page data with metadata
- [ ] Test: No syntax errors (check console)

### Modify getOfflineArticles() method
- [ ] Locate: Existing `getOfflineArticles()` method
- [ ] Update: Add `source = null` parameter
- [ ] Update: Add source filtering logic
- [ ] Verify: Backward compatible (source is optional)
- [ ] Test: No syntax errors (check console)

### Verification
- [ ] No console errors
- [ ] Methods are accessible from offline-manager.js
- [ ] Code formatting matches existing style

---

## Implementation Phase 3: script.js

### Add loadNews() method
- [ ] Locate: In `// ==================== MODIFIED EXISTING METHODS ====================` section
- [ ] Copy: Complete `loadNews()` method from IMPLEMENTATION_GUIDE.md
- [ ] Verify: Calls offlineManager.fetchArticles()
- [ ] Verify: Handles all result sources (api, cache, offline)
- [ ] Test: No syntax errors (check console)

### Replace loadCategoryNews() method
- [ ] Locate: Existing `loadCategoryNews()` method
- [ ] Replace: With new version from IMPLEMENTATION_GUIDE.md
- [ ] Verify: Calls loadNews() with correct params
- [ ] Test: No syntax errors (check console)

### Replace performSearch() method
- [ ] Locate: Existing `performSearch()` method
- [ ] Replace: With new version from IMPLEMENTATION_GUIDE.md
- [ ] Verify: Calls loadNews() with correct params
- [ ] Verify: Removes offline search toggle logic
- [ ] Test: No syntax errors (check console)

### Replace loadOfflineArticles() method
- [ ] Locate: Existing `loadOfflineArticles()` method
- [ ] Replace: With new version from IMPLEMENTATION_GUIDE.md
- [ ] Verify: Calls loadNews() with correct params
- [ ] Test: No syntax errors (check console)

### Update pagination handlers
- [ ] Locate: In `setupEventListeners()` method
- [ ] Find: Pagination click handlers (prev-page, next-page)
- [ ] Replace: With new versions from IMPLEMENTATION_GUIDE.md
- [ ] Verify: Calls loadNews() instead of loadArticles()
- [ ] Test: No syntax errors (check console)

### Verification
- [ ] No console errors
- [ ] All methods properly indented
- [ ] Code formatting matches existing style
- [ ] No duplicate method definitions

---

## Testing Phase 1: Basic Functionality

### Online - Category Load
- [ ] Load app with API key
- [ ] Click "Latest" category
- [ ] Verify: Articles load
- [ ] Verify: Pagination shows "1 of N" (N > 1)
- [ ] Check console: No errors

### Online - Pagination
- [ ] Click "Next" button
- [ ] Verify: Page 2 loads
- [ ] Verify: Pagination shows "2 of N"
- [ ] Click "Prev" button
- [ ] Verify: Back to page 1
- [ ] Check console: No errors

### Online - Search
- [ ] Enter search term
- [ ] Click search button
- [ ] Verify: Results load
- [ ] Verify: Pagination shows "1 of N"
- [ ] Click "Next"
- [ ] Verify: Page 2 loads
- [ ] Check console: No errors

---

## Testing Phase 2: Offline Functionality

### Offline - Category Load
- [ ] Go offline (DevTools → Network → Offline)
- [ ] Refresh page
- [ ] Click "Latest" category
- [ ] Verify: Cached articles load
- [ ] Verify: Pagination shows "1 of N"
- [ ] Check console: No errors

### Offline - Pagination
- [ ] Click "Next" button
- [ ] Verify: Page 2 loads (from cache)
- [ ] Verify: Pagination shows "2 of N"
- [ ] Click "Prev" button
- [ ] Verify: Back to page 1
- [ ] Check console: No errors

### Offline - Search
- [ ] Enter search term
- [ ] Click search button
- [ ] Verify: Offline articles load
- [ ] Verify: Pagination shows "1 of N"
- [ ] Click "Next"
- [ ] Verify: Page 2 loads
- [ ] Check console: No errors

---

## Testing Phase 3: Fallback Behavior

### API Failure → Cache Fallback
- [ ] Go online
- [ ] Load category
- [ ] Verify: Articles load from API
- [ ] Go offline
- [ ] Load same category
- [ ] Verify: Cached articles load
- [ ] Verify: No error shown
- [ ] Check console: Fallback message

### Cache Failure → IndexedDB Fallback
- [ ] Clear cache (DevTools → Application → Cache Storage)
- [ ] Go offline
- [ ] Load category
- [ ] Verify: IndexedDB articles load
- [ ] Verify: No error shown
- [ ] Check console: Fallback message

### All Sources Fail → Error Shown
- [ ] Clear cache and IndexedDB
- [ ] Go offline
- [ ] Load category
- [ ] Verify: Error message shown
- [ ] Verify: "Use Offline Articles" button visible
- [ ] Check console: Error message

---

## Testing Phase 4: Edge Cases

### Switch Categories
- [ ] Load "Latest"
- [ ] Click "Next"
- [ ] Switch to "World"
- [ ] Verify: Pagination resets to "1 of N"
- [ ] Verify: New category articles load
- [ ] Check console: No errors

### Switch Between Online/Offline
- [ ] Load category online
- [ ] Go offline
- [ ] Click "Next"
- [ ] Verify: Cached page loads
- [ ] Go online
- [ ] Click "Next"
- [ ] Verify: New page loads from API
- [ ] Check console: No errors

### Rapid Pagination
- [ ] Click "Next" multiple times quickly
- [ ] Verify: Pages load correctly
- [ ] Verify: No race conditions
- [ ] Check console: No errors

---

## Testing Phase 5: UI/UX

### Toast Messages
- [ ] Load online → "Loaded X articles (online)" ✓
- [ ] Load offline → "Loaded X articles (offline)" ✓
- [ ] API fails → "Network issue. Showing existing results." ✓
- [ ] All sources fail → Error message ✓

### Pagination Display
- [ ] Online: "Page 1 of N" ✓
- [ ] Offline: "Page 1 of N" ✓
- [ ] Search: "Page 1 of N" ✓
- [ ] No "1 of 1" anywhere ✓

### Offline Library
- [ ] Still accessible
- [ ] Still shows saved articles
- [ ] Still has management controls
- [ ] No changes to UI

---

## Testing Phase 6: Performance

### Load Time
- [ ] Online load: < 2 seconds
- [ ] Offline load: < 500ms (cached)
- [ ] Pagination: < 500ms

### Memory Usage
- [ ] No memory leaks
- [ ] No excessive storage usage
- [ ] IndexedDB size reasonable

### Network Usage
- [ ] Same number of API calls as before
- [ ] No duplicate requests
- [ ] Proper caching

---

## Final Verification

### Code Quality
- [ ] No console errors
- [ ] No console warnings
- [ ] Code formatting consistent
- [ ] No duplicate code
- [ ] Comments clear and helpful

### Backward Compatibility
- [ ] Existing offline articles still accessible
- [ ] Existing bookmarks still work
- [ ] Existing settings preserved
- [ ] No data loss

### Documentation
- [ ] Code comments added
- [ ] Methods documented
- [ ] Error handling clear
- [ ] Fallback logic documented

---

## Deployment Checklist

- [ ] All tests passed
- [ ] No console errors
- [ ] Code reviewed
- [ ] Backward compatibility verified
- [ ] Performance acceptable
- [ ] Documentation complete
- [ ] Rollback plan ready
- [ ] Ready to deploy

---

## Post-Deployment

- [ ] Monitor console for errors
- [ ] Monitor user feedback
- [ ] Check analytics for issues
- [ ] Verify pagination working
- [ ] Verify offline working
- [ ] Verify search working
- [ ] All systems nominal

---

## Rollback Plan (If Needed)

- [ ] Revert offline-manager.js
- [ ] Revert offline-storage.js
- [ ] Revert script.js
- [ ] Clear browser cache
- [ ] Refresh page
- [ ] Verify old behavior restored

---

## Success Criteria

- [ ] Pagination shows "1 of N" online
- [ ] Pagination shows "1 of N" offline
- [ ] Clicking next/prev loads correct page
- [ ] API failures automatically fall back to cache
- [ ] Offline Library still works
- [ ] No UI changes
- [ ] No console errors
- [ ] All tests pass

---

## Sign-Off

- [ ] Implementation complete
- [ ] Testing complete
- [ ] Code review complete
- [ ] Ready for production
- [ ] Deployed successfully
