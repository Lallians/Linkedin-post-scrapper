/**
 * The actual scraper class
 */
class PostScraper {

    /**
     * Inits the widget
     */
    constructor() {
        // Configuration
        this.config = {
            containerSelector: '[role="article"]',
            contentSelector: '',
            observeTarget: document.body,
            debounceDelay: 100,
            maxRetries: 3,
            retryDelay: 1000
        };

        // state variables
        this.processed = new WeakSet();
        this.processedIds = new Set();
        this.collectedData = [];
        this.debounceTimer = null;
        this.retryCount = 0;
        this.observer = null;
        this.isActive = false;

        this.init();
    }


    /**
     * Creates a listener on the chrome tab events sent by the widget UI
     */
    init() {
        // Listen to the widget events
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // For asynchronous responses
        });

        // Restore state if needed
        this.loadState();
    }

    async loadState() {
        try {
            const result = await chrome.storage.local.get(['scraperActive']);
            if (result.scraperActive) {
                this.startScraper();
            }
        } catch (error) {
            console.error('Error loading state: ', error);
        }
    }

    /**
     * Handles the extension interface action events
     * @param request
     * @param sender
     * @param sendResponse
     */
    handleMessage(request, sender, sendResponse) {
        switch (request.action) {
            case 'startScraper':

                // pre format selector
                if(request.selector.indexOf('.') == -1) {
                    this.config.contentSelector = '.'+request.selector;
                } else if(request.selector.indexOf('.') == 0) {
                    this.config.contentSelector = request.selector;
                } else {
                    sendResponse({ success: false, message: 'Invalid selector' });
                    return;
                }

                this.startScraper();
                sendResponse({ success: true, message: 'Scraper started' });

                break;

            case 'stopScraper':
                this.stopScraper();
                sendResponse({ success: true, message: 'Scraper stopped' });
                break;

            case 'downloadData':
                const downloaded = this.downloadData();
                sendResponse({ success: downloaded, count: this.collectedData.length });
                break;

            case 'getDataCount':
                sendResponse({ success: true, count: this.collectedData.length });
                break;

            case 'cleanData':
                const success = this.cleanData();
                sendResponse({ success: success, count: this.collectedData.length });
                break;

            default:
                sendResponse({ success: false, message: 'Undefined action' });
        }
    }

    /**
     * Begin watching for posts
     */
    startScraper() {
        if (this.isActive) return;

        this.isActive = true;
        console.log('✅ Post watcher started successfully');

        // Process all the existing loaded posts
        this.processExistingPosts();

        // And watch for DOM changes for dynamically loaded posts
        this.observer = new MutationObserver(mutations => {
            this.debouncedMutationHandler(mutations);
        });

        this.observer.observe(this.config.observeTarget, {
            childList: true,
            subtree: true,
            attributes: false,
            attributeOldValue: false,
            characterData: false
        });

        console.log(`👀 Watching for: ${this.config.containerSelector}`);
    }

    /**
     * Stops watching
     */
    stopScraper() {
        if (!this.isActive) return;

        this.isActive = false;

        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        console.log('🛑 Post watcher stopped');
    }

    /**
     * Process all posts in the current DOM
     */
    processExistingPosts() {
        try {
            const existingPosts = document.querySelectorAll(this.config.containerSelector);
            console.log(`🔍 Found ${existingPosts.length} existing post(s)`);
            existingPosts.forEach(post => this.processPost(post));
        } catch (error) {
            console.error('❌ Error processing existing posts:', error);
        }
    }

    /**
     * Process a given post
     * @param post
     */
    processPost(post) {
        try {
            // Double-check to prevent processing duplicate post
            if (this.processed.has(post)) return;

            const postId = post.id /*|| post.getAttribute('data-id') || post.getAttribute('data-post-id')*/;
            if (postId && this.processedIds.has(postId)) return;

            // Mark as processed
            this.processed.add(post);
            if (postId) this.processedIds.add(postId);

            // check if this is a repost
            if(post.querySelector('.update-components-header__image')) {
                post.style.border = '5px solid red'; // easily track ignored posts
                return;
            }

            // easily track scrapped posts
            post.style.border = '5px solid green';

            // Extract post data
            const postData = this.extractPostData(post);
            console.log('🆕 New post found! Extracted data:', postData.id);

            // Save the data
            this.collectedData.push(postData);

            // Reset retry counter
            this.retryCount = 0;

        } catch (error) {
            console.error('❌ Error processing post:', error);

            // Retry logic
            if (this.retryCount < this.config.maxRetries) {
                this.retryCount++;
                console.log(`🔄 Retrying in ${this.config.retryDelay}ms (attempt ${this.retryCount}/${this.config.maxRetries})`);
                setTimeout(() => this.processPost(post), this.config.retryDelay);
            }
        }
    }

    /**
     * Extract the data we want from the post HTML
     * @param {HTMLElement} post the post to process as an HTMLElement object
     * @returns {{timestamp: string, id: (string|null), text: string, links: *[], images: *[], metadata: {}}}
     */
    extractPostData(post) {
        // Extract the post main contents
        const contentElement = post.querySelector(this.config.contentSelector);
        const postText = contentElement ? contentElement.innerText.trim() : post.innerText.trim();

        const data = {
            timestamp: new Date().toISOString(),
            id: post.id || post.getAttribute('data-id') || null,
            text: postText,
            links: [],
            images: [],
            metadata: {}
        };

        // links
        post.querySelectorAll('a').forEach(link => {
            data.links.push({
                url: link.href,
                text: link.innerText.trim()
            });
        });

        // images
        post.querySelectorAll('img').forEach(img => {
            data.images.push({
                src: img.src,
                alt: img.alt || ''
            });
        });

        // metadata
        // todo: as needed...

        return data;
    }

    /**
     * Prevent performance issues by pausing the process while the page is loading too much content in a short period of time
     * @param mutations
     */
    debouncedMutationHandler(mutations) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.handleMutations(mutations);
        }, this.config.debounceDelay);
    }

    /**
     * The actual watching logic. When the DOM is changed, we check if the new element is a post and if so, we process it.
     * @param mutations
     */
    handleMutations(mutations) {
        const newPosts = new Set();

        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Check if the node is a post
                    if (node.matches && node.matches(this.config.containerSelector)) {
                        newPosts.add(node);
                    }

                    // Also check for nested elements
                    if (node.querySelectorAll) {
                        node.querySelectorAll(this.config.containerSelector).forEach(post => {
                            newPosts.add(post);
                        });
                    }
                }
            });
        });

        // Process the posts we found
        newPosts.forEach(post => this.processPost(post));

        if (newPosts.size > 0) {
            console.log(`📈 Processed ${newPosts.size} new post(s)`);
        }
    }

    /**
     * Exports the collected data into a CSV file.
     * @returns {boolean}
     */
    downloadData() {
        try {
            if (this.collectedData.length === 0) {
                console.warn('⚠️ No posts have been collected yet.');
                return false;
            }

            const csvContent = this.convertToCSV(this.collectedData);
            this.downloadCSV(csvContent);

            console.log(`📥 Exported ${this.collectedData.length} posts to CSV file`);
            console.log('📋 Export summary:', {
                totalPosts: this.collectedData.length,
                dateRange: {
                    first: this.collectedData[0]?.timestamp,
                    last: this.collectedData[this.collectedData.length - 1]?.timestamp
                }
            });

            return true;
        } catch (error) {
            console.error('❌ Error exporting CSV:', error);
            return false;
        }
    }

    /**
     * Function that formats value into a string for use in a CSV file
     * TODO: be able to configure the CSV params
     * @param {string} value
     * @returns {string}
     */
    escapeCSV(value) {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }

    /**
     * Returns the data we pass as a complete CSV string, formatting as needed. Can take multiple rows.
     * @param {Array} data
     * @returns {string}
     */
    convertToCSV(data) {
        if (data.length === 0) return 'No data to export';

        const headers = [
            'Timestamp',
            'Post ID',
            'Post Text',
            'Links Count',
            'Links URLs',
            'Images Count',
            'Image URLs',
            //'Metadata' todo: implement as needed
        ];

        let csv = headers.join('\t') + '\n';

        data.forEach(post => {
            const row = [
                this.escapeCSV(post.timestamp),
                this.escapeCSV(post.id),
                this.escapeCSV(post.text),
                this.escapeCSV(post.links.length),
                this.escapeCSV(post.links.map(link => link.url).join('; ')),
                this.escapeCSV(post.images.length),
                this.escapeCSV(post.images.map(img => img.src).join('; ')),
                //this.escapeCSV(JSON.stringify(post.metadata))
            ];
            csv += row.join('\t') + '\n'; // We use a tabulation since a post can contain commas.
        });

        return csv;
    }

    /**
     * Creates a CSV file from the csvContent string provided using the filename as name and makes the user download it
     * @param csvContent
     * @param filename
     */
    downloadCSV(csvContent, filename = null) {
        if (!filename) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            filename = `posts_export_${timestamp}.csv`;
        }

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');

        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } else {
            // Fallback for older versions
            window.open('data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent));
        }
    }

    /**
     * Cleans all the saved data.
     * @returns {boolean}
     */
    cleanData() {
        this.collectedData = [];
        return true;
    }
}

// Instanciate the scraper
const postScraper = new PostScraper();