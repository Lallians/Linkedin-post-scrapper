/**
 * Class that controls the widget interface.
 */
class WidgetController {

    constructor() {
        this.isActive = false;
        this.dataCount = 0;

        // UI elements
        this.toggleBtn = document.getElementById('toggleBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
        this.dataCountElement = document.getElementById('dataCount');
        this.loadingElement = document.getElementById('loading');

        this.init();

    }

    async init() {
        await this.loadState();
        this.setupEventListeners();
        this.updateUI();
        this.startPeriodicUpdate();
    }

    /**
     * Loads the widget state from storage
     * @returns {Promise<void>}
     */
    async loadState() {
        try {
            const result = await chrome.storage.local.get(['scraperActive', 'dataCount']);
            this.isActive = result.scraperActive || false;
            this.dataCount = result.dataCount || 0;
        } catch (error) {
            console.error('Error while loading state: ', error);
        }
    }

    /**
     * Saves the widget state into storage
     * @returns {Promise<void>}
     */
    async saveState() {
        try {
            await chrome.storage.local.set({
                scraperActive: this.isActive,
                dataCount: this.dataCount
            });
        } catch (error) {
            console.error('Error while saving state: ', error);
        }
    }

    /**
     * Creates event listeners on the widget buttons and binds to the appropriate methods
     */
    setupEventListeners() {
        this.toggleBtn.addEventListener('click', () => this.toggleScraper());
        this.downloadBtn.addEventListener('click', () => this.downloadData());
        this.resetBtn.addEventListener('click', () => this.resetData());
    }

    /**
     * Toggles the scraper by sending a chrome event to the tabs
     * @returns {Promise<void>}
     */
    async toggleScraper() {
        this.showLoading(true);

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (this.isActive) {
                // Disable the scraper
                await chrome.tabs.sendMessage(tab.id, { action: 'stopScraper' });
                this.isActive = false;
            } else {
                // Enable the scraper
                await chrome.tabs.sendMessage(tab.id, { action: 'startScraper' });
                this.isActive = true;
            }

            await this.saveState();


        } catch (error) {
            console.error('Error while toggling the scaper: ', error);
            // Réinit if error
            this.isActive = false;
        }

        this.updateUI();

        this.showLoading(false);
    }

    /**
     * Sends a chrome event to the tabs to trigger the CSV download
     * @returns {Promise<void>}
     */
    async downloadData() {
        this.showLoading(true);

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // Demander le téléchargement des données
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'downloadData' });

            if (response && response.success) {
                console.log('File was successfully downloaded!');
            } else {
                alert('Nothing to download');
            }

        } catch (error) {
            console.error('Error while downloading: ', error);
        }

        this.showLoading(false);
    }

    /**
     * Retrieve the current post count collected by the scrapper and updates the widget display accordingly
     * @returns {Promise<void>}
     */
    async updateDataCount() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getDataCount' });

            if (response && typeof response.count === 'number') {
                this.dataCount = response.count;
                await this.saveState();
                this.updateDataCountUI();
            }
        } catch (error) {
            // Silent error as the page might not have the content script
        }
    }

    /**
     * Emits a chrome event to clean the post collection of the scrapper
     * @returns {Promise<void>}
     */
    async resetData() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'cleanData' });
            if (response && typeof response.count === 'number') {
                this.dataCount = response.count;
                await this.saveState();
                this.updateUI();
            } else {
                console.log(response);
                console.error('Error while resetting data');
            }

            this.updateDataCountUI();
        } catch (error) {
            console.error('Error while cleaning the data: ', error);
        }
    }

    /**
     * Updates the widget UI.
     */
    updateUI() {

        // Update the texts and classes
        if (this.isActive) {
            this.statusDot.classList.add('active');
            this.statusText.textContent = 'Active';
            this.toggleBtn.textContent = 'Deactivate scraping';
            this.toggleBtn.className = 'btn btn-danger';
        } else {
            this.statusDot.classList.remove('active');
            this.statusText.textContent = 'Inactive';
            this.toggleBtn.textContent = 'Activate scraping';
            this.toggleBtn.className = 'btn btn-primary';
        }

        // Update buttons availability
        this.downloadBtn.disabled = this.dataCount === 0 || !this.isActive;
        this.resetBtn.disabled = this.dataCount <= 0 || this.isActive;

        this.updateDataCountUI();
    }

    updateDataCountUI() {
        this.dataCountElement.textContent = `${this.dataCount} post${this.dataCount !== 1 ? 's' : ''}`;
    }

    showLoading(show) {

        if (show) {
            this.loadingElement.classList.add('show');
            this.toggleBtn.disabled = true;
            this.downloadBtn.disabled = true;
            this.resetBtn.disabled = true;
        } else {
            this.loadingElement.classList.remove('show');
            this.toggleBtn.disabled = false;
            this.downloadBtn.disabled = this.dataCount === 0;
            this.resetBtn.disabled = this.dataCount <= 0 || this.isActive;
        }
    }

    /**
     * Updates the counter every 2 seconds
     */
    startPeriodicUpdate() {
        setInterval(async () => {
            if (this.isActive) {
                await this.updateDataCount();
            }
        }, 2000);
    }
}

// Init the controller when the widget is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WidgetController();
});