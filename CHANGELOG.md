# Changelog

All notable changes to the Webhooks for Tella extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2024-12-01

### Fixed
- **Webhook Save Issue** - Fixed inability to save webhook URLs by properly checking `chrome.runtime.lastError` after storage operations
- **Send Button Visibility** - Fixed "Send to Webhook" button not appearing after saving webhook configuration
- **Error Handling** - Improved error messages to show actual error details for better debugging
- **Storage Fallback** - Added localStorage fallback when chrome.storage fails

## [1.1.0] - 2024-12-01

### 🚀 Major Update: Sidebar Integration

#### Added
- **Native Sidebar Integration** - Extension now appears as a native tab in Tella.tv's sidebar alongside Chapters, Transcript, and Comments
- **SPA Navigation Support** - Seamlessly works with Tella's single-page application navigation (no page refresh needed)
- **Enhanced Payload Fields**:
  - `slug` - Video slug for URL-friendly identifiers
  - `channelIDs` - Array of channel IDs associated with the video
  - `chaptersMd` - Chapters formatted as markdown bulleted list for easy use in automation workflows
- **Auto-Extraction** - Automatically extracts and previews video data when visiting a video page
- **Data Preview** - Rich preview showing video metadata, chapters, and transcript counts
- **Make.com Integration Example** - Added screenshot and documentation for Make.com workflows

#### Changed
- **UI Location** - Moved from popup to integrated sidebar tab for better UX
- **Code Quality** - Refactored to eliminate code duplication (DRY principle)
- **Repository Name** - Updated to "webhooks-for-tella" for clarity

#### Improved
- **Performance** - Optimized sidebar detection with targeted selectors
- **Error Handling** - Added timeout protection for runtime messages
- **Memory Management** - Fixed observer cleanup to prevent memory leaks
- **Documentation** - Added project description and background story to README

#### Technical
- Consolidated interface rendering logic
- Extracted shared payload enhancement logic into reusable method
- Improved error recovery and fallback mechanisms

## [1.0.0] - 2024-11-30

### 🎉 Initial Release

#### Added
- **Universal Webhook Support** - Send data to any webhook service (Make.com, Zapier, Pipedream, etc.)
- **Rich Data Extraction** from Tella.tv videos:
  - Video metadata (title, description, URL, views)
  - Timing information (duration, creation/update dates)
  - Chapter data with timestamps and descriptions
  - Full transcription data with word-level timestamps
- **API-First Extraction** - Uses Tella's document and transcription APIs for comprehensive data
- **Organized Data Structure** - Clean JSON format with logical grouping:
  - `video` - Core video information
  - `timing` - Date and duration data
  - `content` - Chapters and transcription
  - `metadata` - Extraction details
- **Auto-Detection** - Smart handling of both milliseconds and seconds for duration
- **Local Storage** - Remembers your webhook URL between sessions
- **Error Handling** - User-friendly error messages with detailed logging
- **Clean UI** - Simple interface with data preview and raw data modal

#### Technical Features
- Manifest V3 compliance for modern Chrome extensions
- Background service worker for webhook requests
- Content script injection for data extraction
- Recursive null value cleanup for clean JSON output
- Comprehensive debugging and logging system

#### Security & Privacy
- Local-only data processing
- No external data collection
- Secure HTTPS webhook transmission
- Sensitive URL parameter hiding in logs

### Future Plans
- [ ] Bulk processing for multiple videos
- [ ] Export data to various formats (CSV, JSON)
- [ ] Advanced filtering and data transformation options
- [ ] Integration templates for popular automation platforms

---

**Need help or have feature requests?**
Open an issue on [GitHub](https://github.com/finlayconn-ai/webhooks-for-tella/issues) or reach out at connor@mvmplabs.com