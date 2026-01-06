# Quick Reference: Exact Code Changes

## File: offline-storage.js

### Change 1: getOfflineArticles() - Line ~120
**Before (Broken):**
```javascript
async getOfflineArticles(limit = 100, offset = 0) {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['articles'], 'readonly');
        const store = transaction.objectStore('articles');
        const index = store.index('savedForOffline');
        const range = IDBKeyRange.only(true);
        const articles = [];
        let count = 0;

        const request = index.openCursor(range);

        request.onsuccess = (event) => {
            const cursor = event.target.result;

            if (cursor && count < offset + limit) {
                if (count >= offset) {
                    articles.push(cursor.value);
                }
                count++;
                cursor.continue();
            } else {
                resolve(articles);
            }
        };

        request.onerror = (event) => {
            console.error('Error getting offline articles:', event.target.error);
            reject(event.target.error);
        };
    });
}
```

**After (Fixed):**
```javascript
async getOfflineArticles(limit = 100, offset = 0) {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['articles'], 'readonly');
        const store = transaction.objectStore('articles');

        // Use getAll() for reliability - avoids IDBKeyRange.only() issues
        const request = store.getAll();

        request.onsuccess = (event) => {
            const allArticles = event.target.result;
            
            // Filter for articles saved for offline (savedForOffline === true)
            const offlineArticles = allArticles.filter(article => article.savedForOffline === true);
            
            console.log(`Found ${offlineArticles.length} offline articles (total: ${allArticles.length})`);
            
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

### Change 2: searchArticles() - Line ~160
**Before (Broken):**
```javascript
async searchArticles(query, filters = {}) {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['articles'], 'readonly');
        const store = transaction.objectStore('articles');
        const articles = [];

        const request = store.openCursor();

        request.onsuccess = (event) => {
            const cursor = event.target.result;

            if (cursor) {
                const article = cursor.value;
                let matches = true;

                // Search in title and description
                if (query) {
                    const searchQuery = query.toLowerCase();
                    matches = (
                        (article.title && article.title.toLowerCase().includes(searchQuery)) ||
                        (article.description && article.description.toLowerCase().includes(searchQuery))
                    );
                }

                // Apply filters
                if (matches && filters.category) {
                    matches = article.category &&
                        article.category.some &&
                        article.category.some(cat =>
                            cat.toLowerCase() === filters.category.toLowerCase()
                        );
                }

                if (matches) {
                    articles.push(article);
                }

                cursor.continue();
            } else {
                resolve(articles);
            }
        };

        request.onerror = (event) => {
            console.error('Error searching articles:', event.target.error);
            reject(event.target.error);
        };
    });
}
```

**After (Fixed):**
```javascript
async searchArticles(query, filters = {}) {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['articles'], 'readonly');
        const store = transaction.objectStore('articles');
        const articles = [];

        const request = store.openCursor();

        request.onsuccess = (event) => {
            const cursor = event.target.result;

            if (cursor) {
                const article = cursor.value;
                let matches = true;

                // CRITICAL: Only search in offline articles (saved for offline)
                if (article.savedForOffline !== true) {
                    cursor.continue();
                    return;
                }

                // Search in title and description
                if (query) {
                    const searchQuery = query.toLowerCase();
                    matches = (
                        (article.title && article.title.toLowerCase().includes(searchQuery)) ||
                        (article.description && article.description.toLowerCase().includes(searchQuery))
                    );
                }

                // Apply filters
                if (matches && filters.category) {
                    matches = article.category &&
                        article.category.some &&
                        article.category.some(cat =>
                            cat.toLowerCase() === filters.category.toLowerCase()
                        );
                }

                if (matches) {
                    articles.push(article);
                }

                cursor.continue();
            } else {
                resolve(articles);
            }
        };

        request.onerror = (event) => {
            console.error('Error searching articles:', event.target.error);
            reject(event.target.error);
        };
    });
}
```

**Key Change:** Added filter check at the start:
```javascript
if (article.savedForOffline !== true) {
    cursor.continue();
    return;
}
```

---

### Change 3: getStorageStats() - Line ~350
**Before (Broken):**
```javascript
// Safely count offline articles using cursor instead of .only()
try {
    const offlineIndex = articlesStore.index('savedForOffline');
    let offlineCursorCount = 0;
    const offlineCursorRequest = offlineIndex.openCursor();

    offlineCursorRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            if (cursor.value === true) {  // WRONG: cursor.value is entire article
                offlineCursorCount++;
            }
            cursor.continue();
        } else {
            offlineCount = offlineCursorCount;
        }
    };
} catch (error) {
    console.warn('Could not count offline articles:', error);
    offlineCount = 0;
}

// Safely count read articles using cursor instead of .only()
try {
    const readIndex = articlesStore.index('read');
    let readCursorCount = 0;
    const readCursorRequest = readIndex.openCursor();

    readCursorRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            if (cursor.value === true) {  // WRONG: cursor.value is entire article
                readCursorCount++;
            }
            cursor.continue();
        } else {
            readCount = readCursorCount;
        }
    };
} catch (error) {
    console.warn('Could not count read articles:', error);
    readCount = 0;
}
```

**After (Fixed):**
```javascript
// Count offline articles using getAll() + filter for reliability
const offlineRequest = articlesStore.getAll();
offlineRequest.onsuccess = (event) => {
    const allArticles = event.target.result;
    offlineCount = allArticles.filter(article => article.savedForOffline === true).length;
    checkComplete();
};
offlineRequest.onerror = () => checkComplete();

// Count read articles using getAll() + filter for reliability
const readRequest = articlesStore.getAll();
readRequest.onsuccess = (event) => {
    const allArticles = event.target.result;
    readCount = allArticles.filter(article => article.read === true).length;
    checkComplete();
};
readRequest.onerror = () => checkComplete();
```

---

### Change 4: getPendingActions() - Line ~520
**Before (Broken):**
```javascript
async getPendingActions() {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['actions'], 'readonly');
        const store = transaction.objectStore('actions');
        const index = store.index('status');
        const range = IDBKeyRange.only('pending');
        const actions = [];

        const request = index.openCursor(range);

        request.onsuccess = (event) => {
            const cursor = event.target.result;

            if (cursor) {
                actions.push(cursor.value);
                cursor.continue();
            } else {
                resolve(actions);
            }
        };

        request.onerror = (event) => {
            console.error('Error getting pending actions:', event.target.error);
            reject(event.target.error);
        };
    });
}
```

**After (Fixed):**
```javascript
async getPendingActions() {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['actions'], 'readonly');
        const store = transaction.objectStore('actions');

        // Use getAll() for reliability - avoids IDBKeyRange.only() issues
        const request = store.getAll();

        request.onsuccess = (event) => {
            const allActions = event.target.result;
            // Filter for pending actions
            const pendingActions = allActions.filter(action => action.status === 'pending');
            resolve(pendingActions);
        };

        request.onerror = (event) => {
            console.error('Error getting pending actions:', event.target.error);
            reject(event.target.error);
        };
    });
}
```

---

## Summary of Changes

| Method | Issue | Fix |
|--------|-------|-----|
| `getOfflineArticles()` | Unreliable `IDBKeyRange.only(true)` query | Use `getAll()` + filter |
| `searchArticles()` | Searches all articles, not just offline | Add `savedForOffline === true` check |
| `getStorageStats()` | Wrong cursor value check | Use `getAll()` + filter |
| `getPendingActions()` | Unreliable `IDBKeyRange.only('pending')` | Use `getAll()` + filter |

## Pattern Applied

**Old Pattern (Unreliable):**
```javascript
const index = store.index('fieldName');
const range = IDBKeyRange.only(value);
const request = index.openCursor(range);
```

**New Pattern (Reliable):**
```javascript
const request = store.getAll();
request.onsuccess = (event) => {
    const allItems = event.target.result;
    const filtered = allItems.filter(item => item.fieldName === value);
    resolve(filtered);
};
```

This pattern is:
- ✅ Browser-independent
- ✅ Predictable and testable
- ✅ Production-safe
- ✅ Easier to debug
