# Personal Data Scraper - Chrome Extension

Personal Chrome extension for scraping post data from web pages.

## 📁 File Structure

```
extension/
├── manifest.json           # Extension configuration
├── ui.html                 # User interface
├── ui.js                   # Interface logic
├── scraper.js             # Scraping script
├── serviceworker.js        # Service worker
├── style.css               # Extension's UI styling
└── README.md               # This guide
```

## 🚀 Installation

### Method 1: Developer mode installation (recommended)

1. **Create the extension folder:**
   ```bash
   mkdir chrome-scraper-extension
   cd chrome-scraper-extension
   ```

2. **Copy all files** into this folder (manifest.json, ui.html, ui.js, scraper.js, serviceworker.js, style.css)

3. **Open Chrome** and go to `chrome://extensions/`

4. **Enable developer mode** (toggle in top right)

5. **Click "Load unpacked extension"**

6. **Select the folder** containing your files

7. **The extension is now installed!** 🎉

### Method 2: CRX package (optional)

If you want to create a .crx file for easier installation:

1. In `chrome://extensions/`, click "Pack extension"
2. Select your extension folder
3. Chrome will create a .crx file you can install

## 🔧 Configuration

### Customize CSS selectors

In the `scraper.js` file, modify the configuration according to the site you want to scrape:

```javascript
this.config = {
  containerSelector: '[role="article"]',  // Selector for post containers
  contentSelector: '.uQwGiLDaGJtjfoiCxQSAxVWyyqLPWlJMn', // Your specific content selector, corresponding to the post text content
  observeTarget: document.body,
  debounceDelay: 100,
  maxRetries: 3,
  retryDelay: 1000
};
```

### Key selectors to modify:

- **`containerSelector`**: CSS selector for the main post containers
- **`contentSelector`**: CSS selector for the specific content inside posts
- **`observeTarget`**: DOM element to observe for changes (usually `document.body`)

## 🎯 Usage

1. **Navigate** to the page you want to scrape
2. **Click the extension icon** in the toolbar
3. **Click "Start scraping"** to begin data collection
4. **Browse the page** - new posts will be automatically detected and processed
5. **Monitor the counter** to see how many posts have been collected
6. **Click "Stop scraping"** when finished
7. **Click "Download data"** to export your data as CSV

## 📊 Features

- **Real-time monitoring**: Automatically detects new posts as they appear
- **Duplicate prevention**: Smart tracking to avoid processing the same post twice
- **CSV export**: Clean, structured data export with timestamps
- **Error handling**: Robust retry logic for failed operations
- **State persistence**: Remembers if scraper was active between sessions
- **Visual feedback**: Clear status indicators and data count

## To do

- **collect more data**, like the images / carousels
- **Ignore republished posts**
- **Allow** csv parameters
- **Allow** CSS selectors from the widget UI
- **Create in interface** allowing the widget + scrapper custom configuration

## 📁 Data Structure

The exported CSV contains the following columns:

- **Timestamp**: When the post was processed
- **Post ID**: Unique identifier if available
- **Post Text**: Main text content of the post
- **Links Count**: Number of links in the post
- **Links URLs**: All link URLs separated by semicolons
- **Images Count**: Number of images in the post
- **Image URLs**: All image URLs separated by semicolons
- **Metadata**: Additional data attributes as JSON

## 🛠 Customization

### Adding new data fields

To extract additional data from posts, modify the `extractPostData` method in `scraper.js`:

```javascript
extractPostData(post) {
  const data = {
    // ... existing fields
    customField: post.querySelector('.custom-selector')?.innerText,
    anotherField: post.getAttribute('data-custom-attr')
  };
  
  // ... rest of the method
  return data;
}
```

### Retarget posts

1. Update the `containerSelector` and `contentSelector` in the config
2. Test the selectors in browser DevTools first
3. Reload the extension after making changes

## 🔧 Development

### Testing changes

1. Make your modifications
2. Go to `chrome://extensions/`
3. Click the refresh icon on your extension
4. Test on your target website

### Debugging

- Open DevTools on the target page to see content script logs
- Right-click the extension icon → "Inspect popup" for popup debugging
- Check `chrome://extensions/` for background script errors

## ⚠️ Important Notes

- This extension is for **personal use only**
- Always respect website terms of service
- Be mindful of rate limiting and server load
- Test thoroughly before collecting large amounts of data
- The extension requires appropriate permissions to function

## 🔄 Updates

To update the extension:

1. Modify the files as needed
2. Update the version in `manifest.json`
3. Reload the extension in `chrome://extensions/`

## 📞 Troubleshooting

**Extension not working:**
- Check if developer mode is enabled
- Verify all files are in the same folder
- Check browser console for errors

**No posts detected:**
- Verify the CSS selectors match the target post structure
- Check if the website structure has changed
- Use browser DevTools to inspect the page structure

**CSV download not working:**
- Ensure posts have been collected (counter > 0)
- Check browser's download settings
- Verify popup blockers aren't interfering