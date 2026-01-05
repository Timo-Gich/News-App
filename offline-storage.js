/**
 * OfflineStorage Module
 * IndexedDB wrapper for persistent article storage and offline functionality
 */

class OfflineStorage {
    constructor() {
        this.dbName = 'veritas-news-db';
        this.version = 1;
        this.db = null;
        this.isSupported = this.checkSupport();

        if (this.isSupported) {
            this.init();
        }
    }

    /**
     * Check if IndexedDB is supported
     */
    checkSupport() {
        return 'indexedDB' in window;
    }

    /**
     * Initialize IndexedDB database
     */
    async init() {
        if (!this.isSupported) {
            console.warn('IndexedDB not supported, offline features disabled');
            return;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('IndexedDB initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this.createStores(db);
            };
        });
    }

    /**
     * Create object stores and indexes
     */
    createStores(db) {
        // Articles store
        if (!db.objectStoreNames.contains('articles')) {
            const articlesStore = db.createObjectStore('articles', { keyPath: 'id' });
            articlesStore.createIndex('published', 'published', { unique: false });
            articlesStore.createIndex('category', 'category', { unique: false });
            articlesStore.createIndex('saved_at', 'saved_at', { unique: false });
            articlesStore.createIndex('read_progress', 'read_progress', { unique: false });
        }

        // Bookmarks store
        if (!db.objectStoreNames.contains('bookmarks')) {
            const bookmarksStore = db.createObjectStore('bookmarks', { keyPath: 'article_id' });
            bookmarksStore.createIndex('bookmarked_at', 'bookmarked_at', { unique: false });
            bookmarksStore.createIndex('offline_queued', 'offline_queued', { unique: false });
        }

        // Reading progress store
        if (!db.objectStoreNames.contains('reading_progress')) {
            const progressStore = db.createObjectStore('reading_progress', { keyPath: 'article_id' });
            progressStore.createIndex('last_read', 'last_read', { unique: false });
            progressStore.createIndex('read_percentage', 'read_percentage', { unique: false });
        }

        // Action queue store
        if (!db.objectStoreNames.contains('action_queue')) {
            const queueStore = db.createObjectStore('action_queue', { keyPath: 'id', autoIncrement: true });
            queueStore.createIndex('action_type', 'action_type', { unique: false });
            queueStore.createIndex('timestamp', 'timestamp', { unique: false });
            queueStore.createIndex('synced', 'synced', { unique: false });
        }

        // Search index store
        if (!db.objectStoreNames.contains('search_index')) {
            const searchStore = db.createObjectStore('search_index', { keyPath: 'article_id' });
            searchStore.createIndex('keywords', 'keywords', { unique: false });
            searchStore.createIndex('searchable_text', 'searchable_text', { unique: false });
        }

        // Storage metadata store
        if (!db.objectStoreNames.contains('storage_meta')) {
            db.createObjectStore('storage_meta', { keyPath: 'key' });
        }
    }

    /**
     * Store an article with full metadata
     */
    async storeArticle(article) {
        if (!this.db) return false;

        try {
            const transaction = this.db.transaction(['articles'], 'readwrite');
            const store = transaction.objectStore('articles');

            const articleData = {
                ...article,
                saved_at: new Date().toISOString(),
                read_progress: 0,
                offline_available: true
            };

            await new Promise((resolve, reject) => {
                const request = store.put(articleData);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            // Update search index
            await this.updateSearchIndex(articleData);

            // Update storage metadata
            await this.updateStorageMetadata();

            return true;
        } catch (error) {
            console.error('Failed to store article:', error);
            return false;
        }
    }

    /**
     * Retrieve an article by ID
     */
    async getArticle(id) {
        if (!this.db) return null;

        try {
            const transaction = this.db.transaction(['articles'], 'readonly');
            const store = transaction.objectStore('articles');

            return new Promise((resolve, reject) => {
                const request = store.get(id);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Failed to get article:', error);
            return null;
        }
    }

    /**
     * Get all stored articles
     */
    async getAllArticles() {
        if (!this.db) return [];

        try {
            const transaction = this.db.transaction(['articles'], 'readonly');
            const store = transaction.objectStore('articles');

            return new Promise((resolve, reject) => {
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

                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Failed to get all articles:', error);
            return [];
        }
    }

    /**
     * Delete an article
     */
    async deleteArticle(id) {
        if (!this.db) return false;

        try {
            const transaction = this.db.transaction(['articles', 'search_index'], 'readwrite');
            const articlesStore = transaction.objectStore('articles');
            const searchStore = transaction.objectStore('search_index');

            await Promise.all([
                new Promise((resolve, reject) => {
                    const request = articlesStore.delete(id);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                }),
                new Promise((resolve, reject) => {
                    const request = searchStore.delete(id);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                })
            ]);

            await this.updateStorageMetadata();
            return true;
        } catch (error) {
            console.error('Failed to delete article:', error);
            return false;
        }
    }

    /**
     * Update reading progress
     */
    async updateReadingProgress(articleId, scrollPosition, readPercentage) {
        if (!this.db) return false;

        try {
            const transaction = this.db.transaction(['reading_progress'], 'readwrite');
            const store = transaction.objectStore('reading_progress');

            const progressData = {
                article_id: articleId,
                scroll_position: scrollPosition,
                read_percentage: readPercentage,
                last_read: new Date().toISOString()
            };

            await new Promise((resolve, reject) => {
                const request = store.put(progressData);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            return true;
        } catch (error) {
            console.error('Failed to update reading progress:', error);
            return false;
        }
    }

    /**
     * Get reading progress for an article
     */
    async getReadingProgress(articleId) {
        if (!this.db) return null;

        try {
            const transaction = this.db.transaction(['reading_progress'], 'readonly');
            const store = transaction.objectStore('reading_progress');

            return new Promise((resolve, reject) => {
                const request = store.get(articleId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Failed to get reading progress:', error);
            return null;
        }
    }

    /**
     * Toggle bookmark status
     */
    async toggleBookmark(articleId, isBookmarked) {
        if (!this.db) return false;

        try {
            const transaction = this.db.transaction(['bookmarks'], 'readwrite');
            const store = transaction.objectStore('bookmarks');

            if (isBookmarked) {
                // Add bookmark
                const bookmarkData = {
                    article_id: articleId,
                    bookmarked_at: new Date().toISOString(),
                    offline_queued: !navigator.onLine
                };

                await new Promise((resolve, reject) => {
                    const request = store.put(bookmarkData);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            } else {
                // Remove bookmark
                await new Promise((resolve, reject) => {
                    const request = store.delete(articleId);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }

            return true;
        } catch (error) {
            console.error('Failed to toggle bookmark:', error);
            return false;
        }
    }

    /**
     * Get all bookmarks
     */
    async getBookmarks() {
        if (!this.db) return [];

        try {
            const transaction = this.db.transaction(['bookmarks'], 'readonly');
            const store = transaction.objectStore('bookmarks');

            return new Promise((resolve, reject) => {
                const bookmarks = [];
                const request = store.openCursor();

                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        bookmarks.push(cursor.value);
                        cursor.continue();
                    } else {
                        resolve(bookmarks);
                    }
                };

                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Failed to get bookmarks:', error);
            return [];
        }
    }

    /**
     * Queue an action for offline sync
     */
    async queueAction(actionType, data) {
        if (!this.db) return false;

        try {
            const transaction = this.db.transaction(['action_queue'], 'readwrite');
            const store = transaction.objectStore('action_queue');

            const actionData = {
                action_type: actionType,
                data: data,
                timestamp: new Date().toISOString(),
                synced: false
            };

            await new Promise((resolve, reject) => {
                const request = store.add(actionData);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            return true;
        } catch (error) {
            console.error('Failed to queue action:', error);
            return false;
        }
    }

    /**
     * Get pending actions for sync
     */
    async getPendingActions() {
        if (!this.db) return [];

        try {
            const transaction = this.db.transaction(['action_queue'], 'readonly');
            const store = transaction.objectStore('action_queue');
            const index = store.index('synced');

            return new Promise((resolve, reject) => {
                const actions = [];
                const request = index.getAll(false);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Failed to get pending actions:', error);
            return [];
        }
    }

    /**
     * Mark action as synced
     */
    async markActionSynced(actionId) {
        if (!this.db) return false;

        try {
            const transaction = this.db.transaction(['action_queue'], 'readwrite');
            const store = transaction.objectStore('action_queue');

            const request = store.get(actionId);
            request.onsuccess = () => {
                const action = request.result;
                if (action) {
                    action.synced = true;
                    store.put(action);
                }
            };

            return true;
        } catch (error) {
            console.error('Failed to mark action as synced:', error);
            return false;
        }
    }

    /**
     * Update search index for an article
     */
    async updateSearchIndex(article) {
        if (!this.db) return false;

        try {
            const transaction = this.db.transaction(['search_index'], 'readwrite');
            const store = transaction.objectStore('search_index');

            // Create searchable text
            const searchableText = [
                article.title,
                article.description || '',
                article.category ? article.category.join(' ') : '',
                article.author || ''
            ].join(' ').toLowerCase();

            // Extract keywords (simple implementation)
            const keywords = this.extractKeywords(searchableText);

            const searchData = {
                article_id: article.id,
                searchable_text: searchableText,
                keywords: keywords
            };

            await new Promise((resolve, reject) => {
                const request = store.put(searchData);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            return true;
        } catch (error) {
            console.error('Failed to update search index:', error);
            return false;
        }
    }

    /**
     * Search articles offline
     */
    async searchArticles(query) {
        if (!this.db) return [];

        try {
            const transaction = this.db.transaction(['search_index', 'articles'], 'readonly');
            const searchStore = transaction.objectStore('search_index');
            const articlesStore = transaction.objectStore('articles');

            const searchQuery = query.toLowerCase();
            const results = [];

            return new Promise((resolve, reject) => {
                const request = searchStore.openCursor();

                request.onsuccess = async(event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const searchData = cursor.value;

                        // Simple text matching
                        if (searchData.searchable_text.includes(searchQuery)) {
                            try {
                                const articleRequest = articlesStore.get(searchData.article_id);
                                articleRequest.onsuccess = () => {
                                    if (articleRequest.result) {
                                        results.push(articleRequest.result);
                                    }
                                    cursor.continue();
                                };
                                articleRequest.onerror = () => cursor.continue();
                            } catch (error) {
                                console.error('Error getting article:', error);
                                cursor.continue();
                            }
                        } else {
                            cursor.continue();
                        }
                    } else {
                        resolve(results);
                    }
                };

                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Failed to search articles:', error);
            return [];
        }
    }

    /**
     * Extract keywords from text (simple implementation)
     */
    extractKeywords(text) {
        const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
        const words = text.split(/\s+/);
        const keywords = words
            .map(word => word.replace(/[^a-zA-Z0-9]/g, ''))
            .filter(word => word.length > 3 && !stopWords.includes(word))
            .filter((word, index, arr) => arr.indexOf(word) === index); // Remove duplicates

        return keywords.slice(0, 10); // Limit to 10 keywords
    }

    /**
     * Clean up old articles (30-day retention)
     */
    async cleanupOldArticles() {
        if (!this.db) return false;

        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 30);

            const transaction = this.db.transaction(['articles'], 'readwrite');
            const store = transaction.objectStore('articles');
            const index = store.index('saved_at');

            const oldArticles = [];
            const request = index.openCursor(IDBKeyRange.upperBound(cutoffDate.toISOString()));

            return new Promise((resolve, reject) => {
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        oldArticles.push(cursor.value.id);
                        cursor.continue();
                    } else {
                        // Delete old articles
                        Promise.all(
                            oldArticles.map(id => this.deleteArticle(id))
                        ).then(() => resolve(true)).catch(reject);
                    }
                };

                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Failed to cleanup old articles:', error);
            return false;
        }
    }

    /**
     * Get storage usage information
     */
    async getStorageUsage() {
        if (!this.db) return { articles: 0, bookmarks: 0, queue: 0, totalSize: 0 };

        try {
            const transaction = this.db.transaction(['articles', 'bookmarks', 'action_queue'], 'readonly');
            const articlesStore = transaction.objectStore('articles');
            const bookmarksStore = transaction.objectStore('bookmarks');
            const queueStore = transaction.objectStore('action_queue');

            const counts = await Promise.all([
                this.countStore(articlesStore),
                this.countStore(bookmarksStore),
                this.countStore(queueStore)
            ]);

            return {
                articles: counts[0],
                bookmarks: counts[1],
                queue: counts[2],
                totalSize: counts.reduce((sum, count) => sum + count, 0)
            };
        } catch (error) {
            console.error('Failed to get storage usage:', error);
            return { articles: 0, bookmarks: 0, queue: 0, totalSize: 0 };
        }
    }

    /**
     * Count items in a store
     */
    async countStore(store) {
        return new Promise((resolve, reject) => {
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update storage metadata
     */
    async updateStorageMetadata() {
        if (!this.db) return false;

        try {
            const usage = await this.getStorageUsage();
            const metadata = {
                key: 'storage_stats',
                last_updated: new Date().toISOString(),
                ...usage
            };

            const transaction = this.db.transaction(['storage_meta'], 'readwrite');
            const store = transaction.objectStore('storage_meta');

            await new Promise((resolve, reject) => {
                const request = store.put(metadata);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            return true;
        } catch (error) {
            console.error('Failed to update storage metadata:', error);
            return false;
        }
    }

    /**
     * Clear all offline data
     */
    async clearAllData() {
        if (!this.db) return false;

        try {
            const stores = ['articles', 'bookmarks', 'reading_progress', 'action_queue', 'search_index'];

            const transaction = this.db.transaction(stores, 'readwrite');

            await Promise.all(
                stores.map(storeName => {
                    const store = transaction.objectStore(storeName);
                    return new Promise((resolve, reject) => {
                        const request = store.clear();
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                })
            );

            await this.updateStorageMetadata();
            return true;
        } catch (error) {
            console.error('Failed to clear all data:', error);
            return false;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineStorage;
} else {
    window.OfflineStorage = OfflineStorage;
}