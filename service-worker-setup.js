// Service Worker Management for Automatic Updates
// This file handles service worker updates and notifications

class ServiceWorkerManager {
    constructor() {
        this.registration = null;
        this.controller = null;
        this.isRefreshing = false;
    }

    async init() {
        if (!('serviceWorker' in navigator)) {
            console.warn('Service Worker not supported');
            return false;
        }

        try {
            // Get existing registration (no need to register again)
            this.registration = await navigator.serviceWorker.getRegistration();

            if (!this.registration) {
                console.warn('No service worker registration found');
                return false;
            }

            console.log('Service Worker found:', this.registration.scope);

            // Set up event listeners
            this.setupEventListeners();

            // Check for updates
            this.checkForUpdates();

            return true;
        } catch (error) {
            console.error('Service Worker management failed:', error);
            return false;
        }
    }

    setupEventListeners() {
        // Listen for service worker updates
        if (this.registration) {
            this.registration.addEventListener('updatefound', () => {
                console.log('Service Worker update found');
                const newWorker = this.registration.installing;

                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('New Service Worker available');
                            this.showUpdateNotification();
                        }
                    });
                }
            });
        }

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
            this.handleServiceWorkerMessage(event.data);
        });
    }

    async checkForUpdates() {
        if (!this.registration) return;

        try {
            // Force check for updates
            await this.registration.update();
            console.log('Service Worker update check completed');
        } catch (error) {
            console.error('Service Worker update check failed:', error);
        }
    }

    handleServiceWorkerMessage(data) {
        console.log('Received message from Service Worker:', data);

        switch (data.type) {
            case 'SW_UPDATED':
                console.log('Service Worker updated to version:', data.version);
                break;
            case 'UPDATE_AVAILABLE':
                console.log('Update available:', data);
                this.showUpdateNotification(data);
                break;
            case 'UPDATE_INSTALLED':
                console.log('Update installed:', data);
                break;
        }
    }

    showUpdateNotification(data = {}) {
        // Create update notification
        const notification = document.createElement('div');
        notification.className = 'sw-update-notification';
        notification.innerHTML = `
            <div class="sw-update-content">
                <i class="fas fa-download"></i>
                <div>
                    <strong>Update Available</strong>
                    <p>A new version of Currents News is ready</p>
                </div>
                <div class="sw-update-actions">
                    <button onclick="serviceWorkerManager.refreshPage()">Update Now</button>
                    <button onclick="this.closest('.sw-update-notification').remove()">Later</button>
                </div>
            </div>
        `;

        // Add styles
        this.addUpdateNotificationStyles();

        // Show notification
        document.body.appendChild(notification);

        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 10000);
    }

    addUpdateNotificationStyles() {
        if (document.getElementById('sw-update-styles')) return;

        const style = document.createElement('style');
        style.id = 'sw-update-styles';
        style.textContent = `
            .sw-update-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 10000;
                animation: slideInRight 0.3s ease-out;
            }
            
            .sw-update-content {
                display: flex;
                align-items: center;
                gap: 15px;
                padding: 15px;
            }
            
            .sw-update-content i {
                font-size: 24px;
                color: #2563eb;
            }
            
            .sw-update-content div:last-child {
                flex: 1;
            }
            
            .sw-update-content strong {
                display: block;
                margin-bottom: 4px;
            }
            
            .sw-update-content p {
                margin: 0;
                color: #6b7280;
                font-size: 14px;
            }
            
            .sw-update-actions {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .sw-update-actions button {
                background: #2563eb;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
            }
            
            .sw-update-actions button:last-child {
                background: #6b7280;
            }
            
            .sw-update-actions button:hover {
                opacity: 0.9;
            }
            
            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            @media (max-width: 768px) {
                .sw-update-notification {
                    left: 20px;
                    right: 20px;
                    top: 10px;
                }
                
                .sw-update-content {
                    flex-direction: column;
                    align-items: flex-start;
                    text-align: left;
                }
                
                .sw-update-actions {
                    width: 100%;
                    flex-direction: row;
                    justify-content: space-between;
                }
            }
        `;

        document.head.appendChild(style);
    }

    async refreshPage() {
        if (this.isRefreshing) return;

        this.isRefreshing = true;

        try {
            // Skip waiting and activate new service worker
            if (this.registration && this.registration.waiting) {
                this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }

            // Reload the page
            window.location.reload();
        } catch (error) {
            console.error('Failed to refresh page:', error);
            this.isRefreshing = false;
        }
    }

    // Test methods
    async testServiceWorker() {
        const results = [];

        try {
            // Check if service worker is supported
            if (!('serviceWorker' in navigator)) {
                results.push('❌ Service Worker not supported');
                return results;
            }

            results.push('✅ Service Worker supported');

            // Get registration
            this.registration = await navigator.serviceWorker.getRegistration();

            if (!this.registration) {
                results.push('❌ No service worker registration found');
                return results;
            }

            results.push(`✅ Service Worker found: ${this.registration.scope}`);

            // Check controller
            this.controller = navigator.serviceWorker.controller;

            if (!this.controller) {
                results.push('⚠️ No active service worker controller');
            } else {
                results.push('✅ Service Worker controller active');
            }

            // Test version info
            const versionResult = await this.testVersionInfo();
            results.push(versionResult);

            // Test cache info
            const cacheResult = await this.testCacheInfo();
            results.push(cacheResult);

            return results;

        } catch (error) {
            results.push(`❌ Test failed: ${error.message}`);
            return results;
        }
    }

    async testVersionInfo() {
        if (!this.controller) {
            return '⚠️ No controller available for version test';
        }

        try {
            this.controller.postMessage({ type: 'GET_VERSION_INFO' });

            const response = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout'));
                }, 3000);

                const messageHandler = (event) => {
                    if (event.data.type === 'GET_VERSION_INFO') {
                        clearTimeout(timeout);
                        navigator.serviceWorker.removeEventListener('message', messageHandler);
                        resolve(event.data);
                    }
                };

                navigator.serviceWorker.addEventListener('message', messageHandler);
            });

            if (response.success) {
                const info = response.versionInfo;
                return `✅ Version: ${info.version}, Features: ${info.features.join(', ')}`;
            } else {
                return `❌ Version test failed: ${response.error}`;
            }

        } catch (error) {
            return `❌ Version test error: ${error.message}`;
        }
    }

    async testCacheInfo() {
        if (!this.controller) {
            return '⚠️ No controller available for cache test';
        }

        try {
            this.controller.postMessage({ type: 'GET_CACHE_INFO' });

            const response = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout'));
                }, 3000);

                const messageHandler = (event) => {
                    if (event.data.type === 'GET_CACHE_INFO') {
                        clearTimeout(timeout);
                        navigator.serviceWorker.removeEventListener('message', messageHandler);
                        resolve(event.data);
                    }
                };

                navigator.serviceWorker.addEventListener('message', messageHandler);
            });

            if (response.success) {
                return `✅ Cache: ${response.itemCount} items, Cache Name: ${response.cacheName}`;
            } else {
                return `❌ Cache test failed: ${response.error}`;
            }

        } catch (error) {
            return `❌ Cache test error: ${error.message}`;
        }
    }

    async testUpdateDetection() {
        if (!this.controller) {
            return '⚠️ No controller available for update test';
        }

        try {
            this.controller.postMessage({ type: 'CHECK_FOR_UPDATES' });

            const response = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout'));
                }, 5000);

                const messageHandler = (event) => {
                    if (event.data.type === 'CHECK_FOR_UPDATES') {
                        clearTimeout(timeout);
                        navigator.serviceWorker.removeEventListener('message', messageHandler);
                        resolve(event.data);
                    }
                };

                navigator.serviceWorker.addEventListener('message', messageHandler);
            });

            if (response.success) {
                const status = response.hasUpdate ? 'Update Available' : 'No Update';
                return `✅ Update Check: ${status}, Version: ${response.version}`;
            } else {
                return `❌ Update test failed: ${response.error}`;
            }

        } catch (error) {
            return `❌ Update test error: ${error.message}`;
        }
    }
}

// Initialize global instance
window.serviceWorkerManager = new ServiceWorkerManager();

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async() => {
    const success = await window.serviceWorkerManager.init();

    if (success) {
        console.log('Service Worker Manager initialized successfully');
    } else {
        console.log('Service Worker Manager initialization failed');
    }
});

// Export for testing
export default ServiceWorkerManager;