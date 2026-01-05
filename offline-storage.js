// offline-storage.js - IndexedDB wrapper for offline article storage
class OfflineStorage {
    constructor() {
        this.dbName = 'CurrentsNewsDB';
        this.version = 2;
        this.db = null;
        this.isAvailable = 'indexedDB' in window;
        this.maxStorageDays = 30;
        this.maxArticles = 1000;
    }

    async init() {
        if (!this.isAvailable) {
            console.warn('IndexedDB not available, offline features disabled');
            return false;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = function(event) {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('IndexedDB initialized successfully');

                // Setup auto-cleanup on open
                this.cleanupOldArticles();

                resolve(true);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion || 0;

                // Create articles store
                if (!db.objectStoreNames.contains('articles')) {
                    const articlesStore = db.createObjectStore('articles', { keyPath: 'id' });
                    articlesStore.createIndex('category', 'category', { multiEntry: true });
                    articlesStore.createIndex('published', 'published');
                    articlesStore.createIndex('savedDate', 'savedDate');
                    articlesStore.createIndex('savedForOffline', 'savedForOffline');
                    articlesStore.createIndex('read', 'read');
                }

                // Create bookmarks store
                if (!db.objectStoreNames.contains('bookmarks')) {
                    const bookmarksStore = db.createObjectStore('bookmarks', { keyPath: 'id' });
                    bookmarksStore.createIndex('dateAdded', 'dateAdded');
                }

                // Create reading progress store
                if (!db.objectStoreNames.contains('progress')) {
                    const progressStore = db.createObjectStore('progress', { keyPath: 'articleId' });
                    progressStore.createIndex('lastRead', 'lastRead');
                    progressStore.createIndex('progress', 'progress');
                }

                // Create offline actions queue
                if (!db.objectStoreNames.contains('actions')) {
                    const actionsStore = db.createObjectStore('actions', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    actionsStore.createIndex('type', 'type');
                    actionsStore.createIndex('status', 'status');
                    actionsStore.createIndex('timestamp', 'timestamp');
                }

                // Create settings store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                // Migrate from version 1 to 2
                if (oldVersion < 2) {
                    // Add new indexes or modify existing ones
                }
            };
        });
    }

    async saveArticle(article, saveForOffline = false) {
        if (!this.db || !article || !article.id) {
            return false;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['articles'], 'readwrite');
            const store = transaction.objectStore('articles');

            const articleToSave = {
                ...article,
                savedDate: new Date().toISOString(),
                savedForOffline: saveForOffline,
                read: article.read || false
            };

            const request = store.put(articleToSave);

            request.onsuccess = () => {
                console.log('Article saved to IndexedDB:', article.id);
                resolve(true);
            };

            request.onerror = (event) => {
                console.error('Error saving article:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async getArticle(id) {
        if (!this.db) return null;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['articles'], 'readonly');
            const store = transaction.objectStore('articles');
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                console.error('Error getting article:', event.target.error);
                reject(event.target.error);
            };
        });
    }

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

    async updateReadingProgress(articleId, progress) {
        if (!this.db) return false;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['progress'], 'readwrite');
            const store = transaction.objectStore('progress');

            const progressData = {
                articleId: articleId,
                progress: progress,
                lastRead: new Date().toISOString()
            };

            const request = store.put(progressData);

            request.onsuccess = () => {
                // Also mark article as read if progress > 90%
                if (progress > 90) {
                    this.markArticleAsRead(articleId);
                }
                resolve(true);
            };

            request.onerror = (event) => {
                console.error('Error updating progress:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async markArticleAsRead(articleId) {
        if (!this.db) return false;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['articles'], 'readwrite');
            const store = transaction.objectStore('articles');

            const getRequest = store.get(articleId);

            getRequest.onsuccess = () => {
                const article = getRequest.result;
                if (article) {
                    article.read = true;
                    article.lastRead = new Date().toISOString();

                    const updateRequest = store.put(article);

                    updateRequest.onsuccess = () => {
                        resolve(true);
                    };

                    updateRequest.onerror = (event) => {
                        console.error('Error marking article as read:', event.target.error);
                        reject(event.target.error);
                    };
                } else {
                    resolve(false);
                }
            };

            getRequest.onerror = (event) => {
                console.error('Error getting article:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async toggleBookmark(article) {
        if (!this.db) return false;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['bookmarks'], 'readwrite');
            const store = transaction.objectStore('bookmarks');

            const getRequest = store.get(article.id);

            getRequest.onsuccess = () => {
                if (getRequest.result) {
                    // Remove bookmark
                    const deleteRequest = store.delete(article.id);

                    deleteRequest.onsuccess = () => {
                        resolve({ bookmarked: false });
                    };

                    deleteRequest.onerror = (event) => {
                        console.error('Error removing bookmark:', event.target.error);
                        reject(event.target.error);
                    };
                } else {
                    // Add bookmark
                    const bookmark = {
                        ...article,
                        dateAdded: new Date().toISOString()
                    };

                    const addRequest = store.put(bookmark);

                    addRequest.onsuccess = () => {
                        resolve({ bookmarked: true });
                    };

                    addRequest.onerror = (event) => {
                        console.error('Error adding bookmark:', event.target.error);
                        reject(event.target.error);
                    };
                }
            };

            getRequest.onerror = (event) => {
                console.error('Error checking bookmark:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async isArticleBookmarked(articleId) {
        if (!this.db) return false;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['bookmarks'], 'readonly');
            const store = transaction.objectStore('bookmarks');
            const request = store.get(articleId);

            request.onsuccess = () => {
                resolve(!!request.result);
            };

            request.onerror = (event) => {
                console.error('Error checking bookmark:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async getBookmarkedArticles() {
        if (!this.db) return [];

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['bookmarks'], 'readonly');
            const store = transaction.objectStore('bookmarks');
            const articles = [];

            const request = store.openCursor();

            request.onsuccess = (event) => {
                const cursor = event.target.result;

                if (cursor) {
                    articles.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(articles);
                }
            };

            request.onerror = (event) => {
                console.error('Error getting bookmarks:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async cleanupOldArticles() {
        if (!this.db) return;

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.maxStorageDays);

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['articles'], 'readwrite');
            const store = transaction.objectStore('articles');
            const index = store.index('savedDate');
            const range = IDBKeyRange.upperBound(cutoffDate.toISOString());
            const articlesToDelete = [];

            const request = index.openCursor(range);

            request.onsuccess = (event) => {
                const cursor = event.target.result;

                if (cursor) {
                    // Don't delete bookmarked articles
                    if (!cursor.value.savedForOffline) {
                        articlesToDelete.push(cursor.value.id);
                    }
                    cursor.continue();
                } else {
                    // Delete old articles
                    articlesToDelete.forEach(id => {
                        store.delete(id);
                    });

                    console.log(`Cleaned up ${articlesToDelete.length} old articles`);
                    resolve(articlesToDelete.length);
                }
            };

            request.onerror = (event) => {
                console.error('Error cleaning up articles:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async getStorageStats() {
        if (!this.db) return null;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['articles', 'bookmarks', 'progress'], 'readonly');
            const articlesStore = transaction.objectStore('articles');
            const bookmarksStore = transaction.objectStore('bookmarks');
            const progressStore = transaction.objectStore('progress');

            let articlesCount = 0;
            let bookmarksCount = 0;
            let progressCount = 0;
            let offlineCount = 0;
            let readCount = 0;

            try {
                const articlesRequest = articlesStore.count();
                articlesRequest.onsuccess = () => {
                    articlesCount = articlesRequest.result;
                };

                const bookmarksRequest = bookmarksStore.count();
                bookmarksRequest.onsuccess = () => {
                    bookmarksCount = bookmarksRequest.result;
                };

                const progressRequest = progressStore.count();
                progressRequest.onsuccess = () => {
                    progressCount = progressRequest.result;
                };

                // Safely count offline articles
                try {
                    const offlineRequest = articlesStore.index('savedForOffline').count(IDBKeyRange.only(true));
                    offlineRequest.onsuccess = () => {
                        offlineCount = offlineRequest.result;
                    };
                } catch (error) {
                    console.warn('Could not count offline articles:', error);
                    offlineCount = 0;
                }

                // Safely count read articles
                try {
                    const readRequest = articlesStore.index('read').count(IDBKeyRange.only(true));
                    readRequest.onsuccess = () => {
                        readCount = readRequest.result;
                    };
                } catch (error) {
                    console.warn('Could not count read articles:', error);
                    readCount = 0;
                }

                transaction.oncomplete = () => {
                    resolve({
                        totalArticles: articlesCount,
                        bookmarkedArticles: bookmarksCount,
                        offlineArticles: offlineCount,
                        readArticles: readCount,
                        articlesWithProgress: progressCount
                    });
                };

                transaction.onerror = (event) => {
                    console.error('Transaction error in getStorageStats:', event.target.error);
                    reject(event.target.error);
                };
            } catch (error) {
                console.error('Error in getStorageStats:', error);
                reject(error);
            }
        });
    }

    async queueOfflineAction(action) {
        if (!this.db) return false;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['actions'], 'readwrite');
            const store = transaction.objectStore('actions');

            const actionData = {
                ...action,
                timestamp: new Date().toISOString(),
                status: 'pending'
            };

            const request = store.add(actionData);

            request.onsuccess = () => {
                console.log('Action queued:', action.type);
                resolve(request.result);
            };

            request.onerror = (event) => {
                console.error('Error queuing action:', event.target.error);
                reject(event.target.error);
            };
        });
    }

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

    async updateActionStatus(actionId, status) {
        if (!this.db) return false;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['actions'], 'readwrite');
            const store = transaction.objectStore('actions');

            const getRequest = store.get(actionId);

            getRequest.onsuccess = () => {
                const action = getRequest.result;
                if (action) {
                    action.status = status;

                    const updateRequest = store.put(action);

                    updateRequest.onsuccess = () => {
                        resolve(true);
                    };

                    updateRequest.onerror = (event) => {
                        console.error('Error updating action:', event.target.error);
                        reject(event.target.error);
                    };
                } else {
                    resolve(false);
                }
            };

            getRequest.onerror = (event) => {
                console.error('Error getting action:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async getSetting(key, defaultValue = null) {
        if (!this.db) return defaultValue;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result ? request.result.value : defaultValue);
            };

            request.onerror = (event) => {
                console.error('Error getting setting:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async setSetting(key, value) {
        if (!this.db) return false;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');

            const setting = {
                key: key,
                value: value,
                updated: new Date().toISOString()
            };

            const request = store.put(setting);

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = (event) => {
                console.error('Error saving setting:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async estimateStorageUsage() {
        if (!this.db) return { usage: 0, quota: 0, percentage: 0 };

        return new Promise((resolve) => {
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                navigator.storage.estimate().then((estimate) => {
                    resolve({
                        usage: estimate.usage || 0,
                        quota: estimate.quota || 0,
                        percentage: estimate.quota ? (estimate.usage / estimate.quota) * 100 : 0
                    });
                }).catch(() => {
                    resolve({ usage: 0, quota: 0, percentage: 0 });
                });
            } else {
                resolve({ usage: 0, quota: 0, percentage: 0 });
            }
        });
    }

    async clearAllData() {
        if (!this.db) return false;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(
                ['articles', 'bookmarks', 'progress', 'actions', 'settings'],
                'readwrite'
            );

            transaction.objectStore('articles').clear();
            transaction.objectStore('bookmarks').clear();
            transaction.objectStore('progress').clear();
            transaction.objectStore('actions').clear();
            transaction.objectStore('settings').clear();

            transaction.oncomplete = () => {
                console.log('All IndexedDB data cleared');
                resolve(true);
            };

            transaction.onerror = (event) => {
                console.error('Error clearing data:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async clearOldArticles(olderThanDays = 7) {
        if (!this.db) return 0;

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
        let deletedCount = 0;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['articles'], 'readwrite');
            const store = transaction.objectStore('articles');
            const index = store.index('savedDate');
            const range = IDBKeyRange.upperBound(cutoffDate.toISOString());

            const request = index.openCursor(range);

            request.onsuccess = (event) => {
                const cursor = event.target.result;

                if (cursor) {
                    // Don't delete bookmarked or saved for offline articles
                    if (!cursor.value.savedForOffline) {
                        const bookmarkCheck = this.isArticleBookmarked(cursor.value.id);
                        bookmarkCheck.then((bookmarked) => {
                            if (!bookmarked) {
                                cursor.delete();
                                deletedCount++;
                            }
                        });
                    }
                    cursor.continue();
                } else {
                    resolve(deletedCount);
                }
            };

            request.onerror = (event) => {
                console.error('Error clearing old articles:', event.target.error);
                reject(event.target.error);
            };
        });
    }
}