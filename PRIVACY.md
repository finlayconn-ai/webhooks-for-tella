# Privacy Policy for Tella to Webhook Extension

**Last Updated**: November 30, 2024

## Overview

The Tella to Webhook extension ("the Extension") is committed to protecting your privacy. This privacy policy explains how we handle your information.

## Information We Do NOT Collect

- **Personal Information**: We do not collect any personal information such as names, email addresses, or contact details
- **Video Content**: We do not store, save, or transmit video files or content
- **Usage Analytics**: We do not track how you use the extension
- **Browsing History**: We do not monitor or record your browsing activities
- **User Profiles**: We do not create user profiles or accounts

## Information We Process Locally

The extension processes the following information **locally in your browser only**:

- **Video Metadata**: Title, description, duration, creation dates from Tella.tv pages
- **Webhook URL**: Your webhook endpoint URL (stored locally in Chrome storage)
- **Extraction Results**: Video data extracted for webhook transmission

## How We Handle Your Data

### Local Processing
- All data extraction happens locally in your browser
- No data is sent to our servers or any third-party services except your chosen webhook
- Video metadata is only processed when you actively click "Extract Data"

### Webhook Transmission
- Data is sent **only** to the webhook URL you specify
- Data transmission happens **only** when you click "Send to Webhook"
- We have no access to or control over your webhook endpoint
- Data is transmitted securely using HTTPS

### Local Storage
- Your webhook URL is saved locally in Chrome's storage for convenience
- No other data is stored persistently
- You can clear this data anytime through Chrome's extension settings

## Third-Party Services

### Tella.tv
- The extension reads publicly available video metadata from Tella.tv pages you visit
- We only access data you already have permission to view
- No data is shared with Tella.tv about your extension usage

### Your Webhook Services
- Data is sent to webhook services you configure (Make.com, Zapier, etc.)
- We are not responsible for how these services handle the data
- Please review their respective privacy policies

## Permissions Explained

The extension requests these Chrome permissions:

- **activeTab**: To read video data from the Tella.tv page you're currently viewing
- **storage**: To save your webhook URL locally for convenience
- **notifications**: To show you success/error messages
- **host_permissions**: To access Tella.tv pages and send data to your webhook URL

## Data Security

- All webhook transmissions use HTTPS encryption
- No data is stored on external servers
- Your webhook URL is stored using Chrome's secure storage API
- All processing happens within Chrome's secure extension environment

## Your Rights and Controls

You have complete control over your data:

- **View**: See what data will be extracted before sending
- **Control**: Choose when to extract and send data
- **Delete**: Clear stored webhook URLs through Chrome settings
- **Stop**: Disable or uninstall the extension at any time

## Children's Privacy

The extension does not knowingly collect or process information from children under 13 years of age.

## Changes to Privacy Policy

We may update this privacy policy to reflect changes in the extension. The "Last Updated" date will be revised accordingly. Continued use of the extension after changes constitutes acceptance of the updated policy.

## Contact Information

If you have questions about this privacy policy:

- **Email**: connor@mvmplabs.com
- **Website**: [https://mvmplabs.com](https://mvmplabs.com)
- **GitHub Issues**: [https://github.com/connorfinlayson/tella-webhook-extension/issues](https://github.com/connorfinlayson/tella-webhook-extension/issues)

## Summary

**Bottom Line**: This extension processes video metadata locally in your browser and sends it only to webhook URLs you specify. We don't collect, store, or have access to your personal information or usage data.