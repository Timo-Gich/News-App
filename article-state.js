// article-state.js - Centralized Article State Management

const ArticleState = {
    // Fetch control
    isFetching: false,
    lastFetchKey: null,

    // Pagination state
    currentPage: 1,
    totalPages: null,

    // Content filters
    category: 'latest',
    language: 'en',
    searchQuery: '',

    // Filters object
    filters: {
        start_date: '',
        end_date: '',
        category: '',
        domain: '',
        keywords: ''
    }
};

/**
 * Generate a unique key for request deduplication
 * @param {Object} params - Request parameters
 * @returns {string} - Unique key for this request
 */
function getFetchKey(params) {
    const {
        page = ArticleState.currentPage,
        category = ArticleState.category,
        query = ArticleState.searchQuery,
        filters = ArticleState.filters
    } = params;

    // Create a normalized key that ignores order of filters
    const keyParts = [
        `page:${page}`,
        `category:${category}`,
        `language:${ArticleState.language}`,
        `query:${query || ''}`
    ];

    // Add sorted filter parts to ensure consistent keys
    const filterKeys = Object.keys(filters).sort();
    for (const key of filterKeys) {
        if (filters[key]) {
            keyParts.push(`${key}:${filters[key]}`);
        }
    }

    return keyParts.join('|');
}

/**
 * Check if we should skip this fetch request
 * @param {Object} params - Request parameters
 * @returns {boolean} - True if request should be skipped
 */
function shouldSkipFetch(params) {
    if (ArticleState.isFetching) {
        console.log('[ArticleState] Skipping fetch: already fetching');
        return true;
    }

    const key = getFetchKey(params);
    if (ArticleState.lastFetchKey === key) {
        console.log('[ArticleState] Skipping fetch: identical request', key);
        return true;
    }

    return false;
}

/**
 * Mark fetch as started
 * @param {Object} params - Request parameters
 */
function startFetch(params) {
    ArticleState.isFetching = true;
    ArticleState.lastFetchKey = getFetchKey(params);
    console.log('[ArticleState] Fetch started:', ArticleState.lastFetchKey);
}

/**
 * Mark fetch as completed
 */
function endFetch() {
    ArticleState.isFetching = false;
    console.log('[ArticleState] Fetch completed');
}

/**
 * Reset pagination to page 1
 * Only call this when context changes (category, language, search, filters)
 */
function resetPagination() {
    ArticleState.currentPage = 1;
    ArticleState.totalPages = null;
    console.log('[ArticleState] Pagination reset to page 1');
}

/**
 * Update pagination state after successful fetch
 * @param {Object} paginationData - {currentPage, totalPages, hasMore}
 */
function updatePagination(paginationData) {
    if (paginationData.currentPage !== undefined) {
        ArticleState.currentPage = paginationData.currentPage;
    }
    if (paginationData.totalPages !== undefined) {
        ArticleState.totalPages = paginationData.totalPages;
    }
    console.log('[ArticleState] Pagination updated:', {
        currentPage: ArticleState.currentPage,
        totalPages: ArticleState.totalPages
    });
}

/**
 * Update category and reset pagination if category changed
 * @param {string} newCategory - New category
 */
function setCategory(newCategory) {
    if (ArticleState.category !== newCategory) {
        ArticleState.category = newCategory;
        resetPagination();
    }
}

/**
 * Update language
 * @param {string} newLanguage - New language
 */
function setLanguage(newLanguage) {
    ArticleState.language = newLanguage;
}

/**
 * Update search query and reset pagination
 * @param {string} query - New search query
 */
function setSearchQuery(query) {
    if (ArticleState.searchQuery !== query) {
        ArticleState.searchQuery = query;
        resetPagination();
    }
}

/**
 * Update filters and reset pagination if filters changed
 * @param {Object} newFilters - New filters object
 */
function setFilters(newFilters) {
    const oldFiltersKey = JSON.stringify(ArticleState.filters);
    const newFiltersKey = JSON.stringify(newFilters);

    ArticleState.filters = { ...newFilters };

    if (oldFiltersKey !== newFiltersKey) {
        resetPagination();
    }
}

// Export for use in other modules
window.ArticleState = ArticleState;
window.getFetchKey = getFetchKey;
window.shouldSkipFetch = shouldSkipFetch;
window.startFetch = startFetch;
window.endFetch = endFetch;
window.resetPagination = resetPagination;
window.updatePagination = updatePagination;
window.setCategory = setCategory;
window.setLanguage = setLanguage;
window.setSearchQuery = setSearchQuery;
window.setFilters = setFilters;
