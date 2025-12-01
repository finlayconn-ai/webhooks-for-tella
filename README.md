# Webhooks for Tella

> Extract video data from Tella.tv and send it to any webhook service (Make.com, Zapier, and more!)

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)]()
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Available-green.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 📸 Screenshot

![Webhooks for Tella Extension](screenshots/extension-screenshot.jpg)

*The extension integrates seamlessly into Tella.tv's sidebar as a native tab, allowing you to extract and send video data to any webhook service.*

## 🚀 Features

- **Universal Webhook Support** - Works with Make.com, Zapier, Pipedream, and any webhook service
- **Rich Data Extraction** - Comprehensive video metadata, chapters, and transcription data
- **Real-time Processing** - Extract data from any Tella.tv video page instantly
- **Clean Data Structure** - Organized response format for easy automation workflows
- **No API Keys Required** - Works directly through your browser session

## 📊 Extracted Data

The extension provides a complete dataset organized into logical sections:

```json
{
  "video": {
    "id": "unique_video_id",
    "title": "Video Title",
    "description": "Video description",
    "url": "https://www.tella.tv/video/.../view",
    "views": 0
  },
  "timing": {
    "duration": 2264,
    "durationMs": 2264338,
    "createdAt": "2025-10-29T15:48:59.702Z",
    "updatedAt": "2025-10-29T15:50:33.483Z",
    "lastSeen": "2025-10-29T15:58:47.205Z"
  },
  "content": {
    "chapters": [...],
    "transcription": {...}
  },
  "metadata": {
    "extractedAt": "2025-11-30T...",
    "pageUrl": "https://www.tella.tv/video/.../view",
    "extractionMethod": "api"
  }
}
```

## 🛠 Installation

### From Chrome Web Store
1. Visit the [Webhooks for Tella extension](https://chrome.google.com/webstore) on Chrome Web Store
2. Click "Add to Chrome"
3. Confirm by clicking "Add Extension"

### Manual Installation (Development)
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension will appear in your browser toolbar

## 📖 How to Use

### Basic Setup
1. **Navigate to a Tella.tv video page** - The extension automatically detects video pages with the `/view` URL structure (e.g., `https://www.tella.tv/video/your-video-id/view`)
2. **Click the "Webhook" tab** in the Tella.tv sidebar (appears alongside Chapters, Transcript, Comments)
3. **Enter your webhook URL** in the configuration section (first time only)
4. **Data is automatically extracted** - The extension automatically extracts video data when you visit a video page
5. **Click "Send to Webhook"** to deliver the data to your automation service

> **Note**: The extension works seamlessly with Tella.tv's SPA navigation - no page refresh needed when navigating between videos!

### Webhook URL Examples
- **Make.com**: `https://hook.eu1.make.com/your-webhook-id`
- **Zapier**: `https://hooks.zapier.com/hooks/catch/your-hook-id`
- **Pipedream**: `https://your-endpoint.m.pipedream.net`
- **Custom**: Any URL that accepts POST requests with JSON data

## 🔗 Automation Examples

### Make.com Integration
1. Create a new scenario in Make.com
2. Add a "Custom Webhook" trigger
3. Copy the webhook URL to the extension
4. Use the received data to trigger other actions (save to Airtable, send emails, etc.)

### Zapier Integration
1. Create a new Zap in Zapier
2. Choose "Webhooks by Zapier" as the trigger
3. Select "Catch Hook" and copy the webhook URL
4. Connect to other apps like Google Sheets, Notion, Slack, etc.

## 🎯 Use Cases

- **Content Management** - Automatically catalog your Tella videos
- **Analytics & Tracking** - Monitor video performance and engagement
- **Team Workflows** - Notify teams when new training videos are created
- **Data Backup** - Save video metadata and transcriptions externally
- **Integration Pipelines** - Connect Tella to your existing tech stack

## 🔧 Development

### Project Structure
```
tella-hook/
├── manifest.json          # Extension configuration
├── content.js            # Page content extraction and data extraction
├── background.js         # Background service worker
├── sidebar-injector.js   # Sidebar tab injection and integration
├── sidebar-webhook.js    # Webhook interface and UI
├── sidebar-styles.css    # Sidebar styling
├── error-handler.js      # Error handling and recovery
├── performance-monitor.js # Performance monitoring
├── styles.css            # Extension styling
├── icons/                # Extension icons
├── test-extension.spec.js # Playwright test suite
├── test-webhook-server.js  # Test webhook server
├── playwright.config.js   # Playwright configuration
├── package.json           # Node dependencies
└── README.md             # This file
```

### Local Development
1. Clone the repository:
   ```bash
   git clone https://github.com/finlayconn-ai/tella-hook.git
   cd tella-hook
   ```

2. Install dependencies (if needed):
   ```bash
   npm install
   ```

3. Load the extension in Chrome (see Manual Installation above)

4. Make changes to the code

5. Reload the extension in `chrome://extensions/` to test changes

### Testing
The project includes Playwright tests for automated testing:

```bash
# Run tests
npm test

# Run tests in headed mode (see browser)
npm run test:headed

# Debug tests
npm run test:debug
```

## 🛡 Privacy & Security

- **No Data Storage** - Video data is only processed and sent to your specified webhook
- **Secure Transmission** - All webhook requests use HTTPS
- **Local Processing** - Data extraction happens locally in your browser
- **No Tracking** - The extension doesn't track your usage or collect personal information

## 📝 Permissions Explained

The extension requires these permissions:
- **activeTab** - To read video data from Tella.tv pages
- **storage** - To save your webhook URL preference
- **notifications** - To show success/error messages
- **host_permissions** - To access Tella.tv and send webhook requests

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/finlayconn-ai/tella-hook/issues)
- **Website**: [Connor Finlayson](https://www.connorfinlayson.com)

## 🙏 Acknowledgments

- Built for Tella Lovers
- Created by [Connor Finlayson](https://github.com/finlayconn-ai)

---

**Made with ❤️ for the automation community**