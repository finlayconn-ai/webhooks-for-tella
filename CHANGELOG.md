# Changelog

All notable changes to the Webhooks for Tella extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
Open an issue on [GitHub](https://github.com/connorfinlayson/tella-webhook-extension/issues) or reach out at connor@mvmplabs.com