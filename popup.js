// Simple Popup script - just webhook URL and send button
class TellaWebhookPopup {
  constructor() {
    this.webhookUrl = '';
    this.extractedData = {};
    this.currentTab = null;

    this.init();
  }

  async init() {
    await this.loadWebhookUrl();
    this.setupEventListeners();
    await this.checkCurrentTab();
    this.updateUI();
  }

  // Load saved webhook URL
  async loadWebhookUrl() {
    try {
      const result = await chrome.storage.local.get(['webhookUrl']);
      this.webhookUrl = result.webhookUrl || '';

      if (this.webhookUrl) {
        document.getElementById('webhook-url').value = this.webhookUrl;
      }

      console.log('✅ Webhook URL loaded:', this.webhookUrl ? 'configured' : 'not configured');

    } catch (error) {
      console.error('Error loading webhook URL:', error);
    }
  }

  // Save webhook URL
  async saveWebhookUrl() {
    const url = document.getElementById('webhook-url').value.trim();

    if (!url) {
      this.showError('Please enter a webhook URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch (e) {
      this.showError('Please enter a valid URL');
      return;
    }

    this.webhookUrl = url;

    try {
      await chrome.storage.local.set({ webhookUrl: url });
      this.showSuccess('✅ Webhook URL saved!');
      this.updateUI();

      console.log('✅ Webhook URL saved:', url);

    } catch (error) {
      console.error('Error saving webhook URL:', error);
      this.showError('Failed to save webhook URL');
    }
  }

  // Check current tab
  async checkCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;

      if (this.isTellaPage(tab.url)) {
        await this.checkPageStatus();
      } else {
        this.updateStatus('not-tella', 'Navigate to Tella.tv to extract video data');
      }
    } catch (error) {
      console.error('Error checking current tab:', error);
      this.updateStatus('error', 'Error checking page');
    }
  }

  isTellaPage(url) {
    return url && (url.includes('tella.tv') || url.includes('www.tella.tv'));
  }

  async checkPageStatus() {
    try {
      this.updateStatus('checking', 'Checking page...');

      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'checkPage'
      });

      if (response && response.isValidPage) {
        this.updateStatus('ready', 'Ready to extract video data');
      } else {
        this.updateStatus('not-tella', 'No video found on this page');
      }
    } catch (error) {
      console.error('Error checking page status:', error);
      this.updateStatus('error', 'Please refresh the page and try again');
    }
  }

  // Extract data from page
  async extractData() {
    try {
      this.updateStatus('checking', 'Extracting video data...');

      const extractButton = document.getElementById('extract-data');
      extractButton.disabled = true;
      extractButton.textContent = '🔍 Extracting...';

      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'extractData'
      });

      if (response && response.success) {
        this.extractedData = response.data;
        console.log('✅ Data extracted:', this.extractedData);

        this.updateDataPreview(this.extractedData);
        this.updateStatus('ready', 'Data extracted successfully');

        document.getElementById('send-to-webhook').style.display = 'block';
        this.showSuccess('✅ Video data extracted!');

      } else {
        throw new Error(response?.error || 'Failed to extract data');
      }

    } catch (error) {
      console.error('❌ Error extracting data:', error);
      this.showError('Failed to extract data: ' + error.message);
      this.updateStatus('error', 'Extraction failed');
    } finally {
      const extractButton = document.getElementById('extract-data');
      extractButton.disabled = false;
      extractButton.textContent = '🔍 Extract Data';
    }
  }

  // Send data to webhook
  async sendToWebhook() {
    if (!this.webhookUrl) {
      this.showError('Please configure a webhook URL first');
      return;
    }

    if (!this.extractedData || Object.keys(this.extractedData).length === 0) {
      this.showError('No data to send. Please extract data first.');
      return;
    }

    try {
      const sendButton = document.getElementById('send-to-webhook');
      sendButton.disabled = true;
      sendButton.textContent = '🚀 Sending...';

      this.updateStatus('checking', 'Sending to webhook...');

      // Prepare clean webhook payload
      const webhookPayload = {
        event: 'tella_video_extracted',
        timestamp: new Date().toISOString(),
        source: 'tella-extension',
        data: this.extractedData
      };

      console.log('📡 Sending to webhook:', this.webhookUrl);

      // Send to background script
      const response = await chrome.runtime.sendMessage({
        action: 'sendToWebhook',
        url: this.webhookUrl,
        data: webhookPayload
      });

      if (response && response.success) {
        this.showSuccess('✅ Successfully sent to webhook!');
        this.updateStatus('ready', 'Data sent successfully');

        // Store in history
        await this.storeSyncHistory();

      } else {
        throw new Error(response?.error || 'Unknown error');
      }

    } catch (error) {
      console.error('❌ Error sending to webhook:', error);
      this.showError('Failed to send to webhook: ' + error.message);
      this.updateStatus('error', 'Send failed');
    } finally {
      const sendButton = document.getElementById('send-to-webhook');
      sendButton.disabled = false;
      sendButton.textContent = '🚀 Send to Webhook';
    }
  }

  // Update data preview
  updateDataPreview(data) {
    const preview = document.getElementById('data-preview');

    document.getElementById('preview-title').textContent = data.title || 'Not found';
    document.getElementById('preview-duration').textContent = data.duration || 'Not found';
    document.getElementById('preview-date').textContent = data.createdDate ?
      new Date(data.createdDate).toLocaleDateString() : 'Not found';

    // Show transcript if available
    if (data.transcript) {
      const transcriptItem = document.querySelector('.transcript-item');
      const transcriptEl = document.getElementById('preview-transcript');

      transcriptEl.textContent = data.transcript.length > 150 ?
        data.transcript.substring(0, 150) + '...' : data.transcript;

      transcriptItem.style.display = 'block';
    }

    preview.style.display = 'block';
  }

  // Update status indicator
  updateStatus(status, message) {
    const statusElement = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');

    statusElement.className = `status ${status}`;
    statusText.textContent = message;
  }

  // Update UI based on state
  updateUI() {
    const hasWebhook = !!this.webhookUrl;
    const isTellaPage = this.currentTab && this.isTellaPage(this.currentTab.url);

    if (!hasWebhook) {
      document.getElementById('config-section').style.display = 'block';
      document.getElementById('main-section').style.display = 'none';
    } else {
      document.getElementById('config-section').style.display = 'none';
      document.getElementById('main-section').style.display = 'block';

      if (isTellaPage) {
        document.getElementById('extract-data').style.display = 'block';
      }
    }
  }

  // Show success message
  showSuccess(message) {
    const successEl = document.getElementById('success-message');
    const resultsSection = document.getElementById('results-section');

    document.getElementById('error-message').style.display = 'none';
    document.getElementById('success-text').textContent = message;
    successEl.style.display = 'block';
    resultsSection.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
      resultsSection.style.display = 'none';
    }, 5000);
  }

  // Show error message
  showError(message, details = '') {
    const errorEl = document.getElementById('error-message');
    const resultsSection = document.getElementById('results-section');

    document.getElementById('success-message').style.display = 'none';
    document.getElementById('error-text').textContent = message;

    if (details) {
      document.getElementById('error-details').textContent = details;
    }

    errorEl.style.display = 'block';
    resultsSection.style.display = 'block';
    document.getElementById('try-again').style.display = 'block';
  }

  // Store sync history
  async storeSyncHistory() {
    try {
      const result = await chrome.storage.local.get(['syncHistory']);
      const history = result.syncHistory || [];

      history.unshift({
        timestamp: new Date().toISOString(),
        title: this.extractedData.title || 'Unknown',
        url: this.extractedData.videoUrl || this.currentTab.url,
        webhookUrl: this.webhookUrl,
        success: true
      });

      // Keep only last 20 syncs
      if (history.length > 20) {
        history.splice(20);
      }

      await chrome.storage.local.set({ syncHistory: history });

    } catch (error) {
      console.error('Error storing sync history:', error);
    }
  }

  // Show raw data modal
  showRawDataModal() {
    if (!this.extractedData || Object.keys(this.extractedData).length === 0) {
      this.showError('No data extracted yet');
      return;
    }

    const modal = document.getElementById('raw-data-modal');
    const content = document.getElementById('raw-data-content');

    // Show the webhook payload that would be sent
    const webhookPayload = {
      event: 'tella_video_extracted',
      timestamp: new Date().toISOString(),
      source: 'tella-extension',
      data: this.extractedData
    };

    content.textContent = JSON.stringify(webhookPayload, null, 2);
    modal.style.display = 'flex';
  }

  hideRawDataModal() {
    document.getElementById('raw-data-modal').style.display = 'none';
  }

  // Copy data to clipboard
  async copyDataToClipboard() {
    try {
      const webhookPayload = {
        event: 'tella_video_extracted',
        timestamp: new Date().toISOString(),
        source: 'tella-extension',
        data: this.extractedData
      };

      await navigator.clipboard.writeText(JSON.stringify(webhookPayload, null, 2));
      this.showSuccess('📋 Data copied to clipboard!');

    } catch (error) {
      console.error('Error copying to clipboard:', error);
      this.showError('Failed to copy data');
    }
  }

  // Clear all settings
  clearConfig() {
    if (confirm('Clear webhook URL and all settings?')) {
      chrome.storage.local.clear();
      this.webhookUrl = '';
      document.getElementById('webhook-url').value = '';
      this.updateUI();
      this.showSuccess('✅ Settings cleared');
    }
  }

  // Setup event listeners
  setupEventListeners() {
    // Save webhook URL
    document.getElementById('save-webhook').addEventListener('click', () => {
      this.saveWebhookUrl();
    });

    // Extract data
    document.getElementById('extract-data').addEventListener('click', () => {
      this.extractData();
    });

    // Send to webhook
    document.getElementById('send-to-webhook').addEventListener('click', () => {
      this.sendToWebhook();
    });

    // Configure button (show config section)
    document.getElementById('configure').addEventListener('click', () => {
      document.getElementById('config-section').style.display = 'block';
      document.getElementById('main-section').style.display = 'none';
    });

    // Try again button
    document.getElementById('try-again').addEventListener('click', () => {
      document.getElementById('results-section').style.display = 'none';
      this.extractData();
    });

    // Footer links
    document.getElementById('view-data').addEventListener('click', (e) => {
      e.preventDefault();
      this.showRawDataModal();
    });

    document.getElementById('clear-config').addEventListener('click', (e) => {
      e.preventDefault();
      this.clearConfig();
    });

    // Modal controls
    document.getElementById('close-modal').addEventListener('click', () => {
      this.hideRawDataModal();
    });

    document.getElementById('close-modal-btn').addEventListener('click', () => {
      this.hideRawDataModal();
    });

    document.getElementById('copy-data').addEventListener('click', () => {
      this.copyDataToClipboard();
    });

    // Close modal on outside click
    document.getElementById('raw-data-modal').addEventListener('click', (e) => {
      if (e.target.id === 'raw-data-modal') {
        this.hideRawDataModal();
      }
    });

    // Save webhook URL on Enter
    document.getElementById('webhook-url').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.saveWebhookUrl();
      }
    });
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  new TellaWebhookPopup();
});