
class BackgroundService {
    constructor() {
        this.init();
    }


    /**
     * Initialize the service
     */
    init() {

        // On extension install
        chrome.runtime.onInstalled.addListener(() => {
            this.initializeStorage();
        });

        // On tab updated
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url) {
                this.handleTabUpdate(tabId, tab);
            }
        });

        // Écouter les changements d'onglet actif
        chrome.tabs.onActivated.addListener((activeInfo) => {
            this.handleTabActivated(activeInfo);
        });
    }

    /**
     * Initialize the local storage
     * @returns {Promise<void>}
     */
    async initializeStorage() {
        try {
            // Initialize the default values
            const defaultValues = this.getDefaultValues();

            // Check if they already exist
            const existing = await chrome.storage.local.get(Object.keys(defaultValues));

            // Add only the values that does not exist
            const toSet = {};
            for (const [key, value] of Object.entries(defaultValues)) {
                if (!(key in existing)) {
                    toSet[key] = value;
                }
            }

            if (Object.keys(toSet).length > 0) {
                await chrome.storage.local.set(toSet);
                console.log('Storage initialized with default values');
            }
        } catch (error) {
            console.error('Error while initializing storage: ', error);
        }
    }

    /**
     * Handles the tab events, like page reload or tab reopened in order to reload the scraper in its previous state.
     * @param tabId
     * @param tab
     * @returns {Promise<void>}
     */
    async handleTabUpdate(tabId, tab) {
        try {
            const result = await chrome.storage.local.get(['scraperActive', 'lastActiveTab']);

            if (result.scraperActive && result.lastActiveTab === tabId) {
                // Reload the scraper
                setTimeout(async () => {
                    try {
                        await chrome.tabs.sendMessage(tabId, { action: 'checkStatus' });
                    } catch (error) {
                        // Silent error, the script might not be ready yet
                    }
                }, 1000);
            }
        } catch (error) {
            // Silent error, for example if the storage is not available
        }
    }

    async handleTabActivated(activeInfo) {
        try {
            // Save the active tab ID
            await chrome.storage.local.set({ lastActiveTab: activeInfo.tabId });
        } catch (error) {
            console.error('Error while saving current tab ID: ', error);
        }
    }

    /**
     * Cleans the storage
     * @returns {Promise<void>}
     */
    async cleanupStorage() {
        try {
            console.log('🧹 Starting storage cleanup...');

            // Clear all storage and set clean defaults
            const cleanData = this.getDefaultValues();
            await chrome.storage.local.clear();
            await chrome.storage.local.set(cleanData);


            // Send message to all tabs to clear their collected data
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
                try {
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'clearCollectedData'
                    });
                } catch (error) {
                    // Silent error - tab might not have scraper script
                }
            }

            console.log('📢 Sent cleanup signal to all tabs');

        } catch (error) {
            console.error('❌ Error during storage cleanup:', error);
        }
    }

    /**
     * Returns the default storage values
     * @returns {{scraperActive: boolean, dataCount: number, lastActiveTab: null}}
     */
    getDefaultValues() {
        return {
            scraperActive: false,
            dataCount: 0,
            lastActiveTab: null
        };
    }

}

// Starts the service in background
const backgroundService = new BackgroundService();

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'cleanup') {
        backgroundService.cleanupStorage();
    }
});