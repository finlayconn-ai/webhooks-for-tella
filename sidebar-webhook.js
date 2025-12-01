/**
 * Tella Sidebar Webhook Interface
 * Adapted from popup.js for inline sidebar integration
 */

class TellaSidebarWebhook {
  constructor(containerElement) {
    this.container = containerElement;
    this.webhookUrl = '';
    this.extractedData = {};
    this.currentTab = null;
    this.initialized = false;

    console.log('🔗 TellaSidebarWebhook initialized in container:', containerElement);
  }

  /**
   * Initialize the sidebar webhook interface
   */
  async init() {
    // Reset state if re-initializing (e.g., on navigation)
    if (this.initialized) {
      console.log('🔄 Re-initializing sidebar webhook interface...');
      this.extractedData = {};
      this.updateStatus('checking', 'Checking for video data...');
      // Re-run auto-extraction to get new data
      await this.autoExtractAndPreview();
      return;
    }

    try {
      console.log('🚀 Initializing sidebar webhook interface...');

      // Load saved webhook URL
      await this.loadWebhookUrl();

      // Get current tab information
      await this.getCurrentTabInfo();

      // Render the interface
      this.renderInterface();

      // Setup event listeners
      this.setupEventListeners();

      // Check current page status and auto-extract data
      await this.checkPageStatus();
      
      // Automatically try to extract data to show preview
      await this.autoExtractAndPreview();

      this.initialized = true;
      console.log('✅ Sidebar webhook interface ready');

    } catch (error) {
      console.error('❌ Failed to initialize sidebar webhook:', error);
      this.showError('Failed to initialize webhook interface: ' + error.message);
    }
  }

  /**
   * Load saved webhook URL from storage
   */
  async loadWebhookUrl() {
    try {
      const result = await chrome.storage.local.get(['webhookUrl', 'webhookConfig']);

      // Check for Chrome runtime errors
      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }

      // Use webhookUrl if available, or migrate from old webhookConfig structure
      if (result.webhookUrl) {
        this.webhookUrl = result.webhookUrl;
      } else if (result.webhookConfig && result.webhookConfig.baseUrl) {
        // Migration: convert old config structure to simple URL
        this.webhookUrl = result.webhookConfig.baseUrl;
        // Save as simple URL and clean up old config
        await chrome.storage.local.set({ webhookUrl: this.webhookUrl });
        if (chrome.runtime.lastError) {
          throw new Error(chrome.runtime.lastError.message);
        }
        await chrome.storage.local.remove(['webhookConfig']);
        if (chrome.runtime.lastError) {
          throw new Error(chrome.runtime.lastError.message);
        }
      }

      console.log('✅ Webhook URL loaded:', this.webhookUrl ? 'configured' : 'not configured');

    } catch (error) {
      console.error('❌ Error loading webhook URL:', error);

      // Report to error handler and try fallback
      if (window.tellaErrorHandler) {
        const fallbackValue = window.tellaErrorHandler.tryLocalStorageFallback('read', 'webhookUrl');
        if (fallbackValue) {
          // Fallback returns the stored value directly (string)
          this.webhookUrl = fallbackValue;
          console.log('✅ Webhook URL loaded from fallback storage');
        } else {
          window.tellaErrorHandler.handleError('storage_access', error, {
            operation: 'read',
            key: 'webhookUrl'
          });
        }
      }
    }
  }

  /**
   * Get current tab information
   */
  async getCurrentTabInfo() {
    try {
      // Try to get current tab via chrome.tabs API
      if (chrome && chrome.tabs && chrome.tabs.query) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        this.currentTab = tab;
        console.log('📄 Current tab loaded:', tab?.url);
      } else {
        // Fallback: use window.location for content script context
        this.currentTab = { 
          id: null, 
          url: window.location.href 
        };
        console.log('📄 Using window.location as fallback:', this.currentTab.url);
      }
    } catch (error) {
      console.error('❌ Error getting current tab:', error);
      // In sidebar context, we can fallback to window.location
      this.currentTab = { 
        id: null, 
        url: window.location.href 
      };
    }
  }

  /**
   * Send a message to the background script with timeout protection
   * @param {Object} message - The message to send
   * @param {number} timeoutMs - Timeout in milliseconds (default: 10000)
   * @returns {Promise<Object>} The response from the background script
   */
  async sendRuntimeMessage(message, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
        reject(new Error('Chrome runtime API not available'));
        return;
      }

      let timeoutId;
      let resolved = false;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };

      // Set up timeout
      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(new Error(`Message timeout after ${timeoutMs}ms: ${message.action || 'unknown action'}`));
        }
      }, timeoutMs);

      // Send message
      chrome.runtime.sendMessage(message, (response) => {
        if (resolved) return;

        resolved = true;
        cleanup();

        // Check for Chrome runtime errors
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response) {
          reject(new Error('No response from background script'));
          return;
        }

        resolve(response);
      });
    });
  }

  /**
   * Render the sidebar webhook interface
   */
  renderInterface() {
    const hasWebhook = !!this.webhookUrl;

    this.container.innerHTML = `
      <div class="flex flex-col w-full group">

        <!-- Header -->
        <div class="tella-webhook-header">
          <h2 class="text-sm font-semibold text-slate-900 dark:text-gray-100">Send to Webhook</h2>
          <p class="subtitle">Extract data from Tella.tv and send to your webhook service</p>
        </div>

        <!-- Configuration Section -->
        <div id="sidebar-config" class="tella-config-section" style="display: ${hasWebhook ? 'none' : 'block'};">
          <div class="form-group">
            <label for="sidebar-webhook-url">Webhook URL</label>
            <input
              type="url"
              id="sidebar-webhook-url"
              placeholder="https://hooks.make.com/webhook-id"
              value="${this.webhookUrl}"
            />
            <small>
              Paste your webhook URL from
              <a href="https://make.com" target="_blank">Make.com</a>,
              <a href="https://zapier.com" target="_blank">Zapier</a>,
              <a href="https://pipedream.com" target="_blank">Pipedream</a>,
              or any webhook service
            </small>
          </div>

          <div class="flex pointer-events-auto gap-2" style="margin-top: 12px;">
            <span class="inline-flex">
              <button id="sidebar-save-webhook" aria-label="Save Webhook Configuration" class="inline-flex items-center text-sm font-medium transition ease-in-out duration-150 active:scale-97 will-change-transform group whitespace-nowrap border text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-white/[.10] dark:bg-night-900/[.06] hover:text-slate-900 dark:text-gray-100 dark:hover:text-white focus:outline-none focus-visible:shadow-outline-indigo px-3 py-1 rounded-lg pl-2.5" tabindex="0" type="button">
                <div class="relative flex items-center justify-center gap-1">
                  <span class="">
                    <svg aria-hidden="false" aria-label="" class="stroke-current w-5 h-5" height="24" width="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                      <polyline points="17,21 17,13 7,13 7,21"/>
                      <polyline points="7,3 7,8 15,8"/>
                    </svg>
                  </span>
                  <span>Save Configuration</span>
                </div>
              </button>
            </span>
          </div>
        </div>

        <!-- Main Actions Section -->
        <div id="sidebar-main" class="tella-main-section" style="display: ${hasWebhook ? 'block' : 'none'};">

          <!-- Primary Extract Button (shows when page is ready for data extraction) -->
          <div id="sidebar-primary-extract" class="flex pointer-events-auto gap-2" style="margin-bottom: 16px; display: none;">
            <span class="inline-flex w-full md:w-auto whitespace-nowrap">
              <button id="sidebar-extract-video-data" aria-label="Extract Video Data" class="inline-flex items-center text-sm font-medium transition ease-in-out duration-150 active:scale-97 will-change-transform group whitespace-nowrap border text-white bg-gradient-to-b from-[#6D60FF] to-[#5E51F8] border-[#5E51F8] focus-visible:border-[#5E51F8] focus:outline-none focus-visible:shadow-outline-indigo dark:focus-visible:shadow-outline-indigo-dark shadow-purple-primary hover:shadow-purple-primary-lg py-2 px-3 rounded-lg pl-2.5 w-full md:w-auto" tabindex="0" type="button">
                <div class="relative flex items-center justify-center gap-1">
                  <span class="text-indigo-400">
                    <svg aria-hidden="false" aria-label="Extract Video Data" class="stroke-current w-5 h-5" height="24" width="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="11" cy="11" r="8"/>
                      <path d="M21 21l-4.35-4.35"/>
                    </svg>
                  </span>
                  <span>Extract Video Data</span>
                </div>
              </button>
            </span>
          </div>

          <!-- Primary Send Button (shows when webhook URL is configured) -->
          <div id="sidebar-primary-send" class="flex pointer-events-auto gap-2" style="margin-bottom: 16px; display: ${hasWebhook ? 'block' : 'none'};">
            <span class="inline-flex w-full md:w-auto whitespace-nowrap">
              <button id="sidebar-send-to-webhook" aria-label="Send to Webhook" class="inline-flex items-center text-sm font-medium transition ease-in-out duration-150 active:scale-97 will-change-transform group whitespace-nowrap border text-white bg-gradient-to-b from-[#6D60FF] to-[#5E51F8] border-[#5E51F8] focus-visible:border-[#5E51F8] focus:outline-none focus-visible:shadow-outline-indigo dark:focus-visible:shadow-outline-indigo-dark shadow-purple-primary hover:shadow-purple-primary-lg py-2 px-3 rounded-lg pl-2.5 w-full md:w-auto" tabindex="0" type="button">
                <div class="relative flex items-center justify-center gap-1">
                  <span class="text-indigo-400">
                    <svg aria-hidden="false" aria-label="Send to Webhook" class="stroke-current w-5 h-5" height="24" width="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22,2 15,22 11,13 2,9"/>
                    </svg>
                  </span>
                  <span>Send to Webhook</span>
                </div>
              </button>
            </span>
          </div>

          <!-- Data Preview -->
          <div id="sidebar-data-preview" class="tella-data-preview" style="display: none; margin-top: 16px; padding: 12px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
            <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #212529;">📊 Extracted Data Preview</h4>
            
            <!-- Metadata Section -->
            <div class="data-section" style="margin-bottom: 12px;">
              <h5 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #495057;">Metadata</h5>
              <div class="data-summary" style="font-size: 12px; line-height: 1.6;">
                <div class="data-item" style="margin-bottom: 4px;">
                  <strong>Title:</strong>
                  <span id="sidebar-preview-title">Not extracted</span>
                </div>
                <div class="data-item" style="margin-bottom: 4px;">
                  <strong>Video ID:</strong>
                  <span id="sidebar-preview-video-id">Not extracted</span>
                </div>
                <div class="data-item" style="margin-bottom: 4px;">
                  <strong>Duration:</strong>
                  <span id="sidebar-preview-duration">Not extracted</span>
                </div>
                <div class="data-item" style="margin-bottom: 4px;">
                  <strong>Views:</strong>
                  <span id="sidebar-preview-views">Not extracted</span>
                </div>
                <div class="data-item" style="margin-bottom: 4px;">
                  <strong>Created:</strong>
                  <span id="sidebar-preview-date">Not extracted</span>
                </div>
              </div>
            </div>

            <!-- Chapters Section -->
            <div class="chapters-section" id="sidebar-chapters-section" style="display: none; margin-bottom: 12px;">
              <h5 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #495057;">
                📖 Chapters (<span id="sidebar-chapters-count">0</span>)
              </h5>
              <div id="sidebar-preview-chapters" class="chapters-preview" style="max-height: 200px; overflow-y: auto; font-size: 11px; line-height: 1.5;">
                <!-- Chapters will be inserted here -->
              </div>
            </div>

            <!-- Transcript Section -->
            <div class="transcript-section" id="sidebar-transcript-section" style="display: none; margin-bottom: 12px;">
              <h5 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #495057;">
                📝 Transcript (<span id="sidebar-transcript-word-count">0</span> words)
              </h5>
              <div id="sidebar-preview-transcript" class="transcript-preview" style="max-height: 150px; overflow-y: auto; padding: 8px; background: white; border-radius: 4px; font-size: 11px; line-height: 1.6; color: #495057;">
                <!-- Transcript will be inserted here -->
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="tella-actions">
            <div class="flex pointer-events-auto gap-2" style="margin-bottom: 8px;">
              <span class="inline-flex" id="sidebar-extract-data-container" style="display: none;">
                <button id="sidebar-extract-data" aria-label="Extract Video Data" class="inline-flex items-center text-sm font-medium transition ease-in-out duration-150 active:scale-97 will-change-transform group whitespace-nowrap border text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-white/[.10] dark:bg-night-900/[.06] hover:text-slate-900 dark:text-gray-100 dark:hover:text-white focus:outline-none focus-visible:shadow-outline-indigo px-3 py-1 rounded-lg pl-2.5" tabindex="0" type="button">
                  <div class="relative flex items-center justify-center gap-1">
                    <span class="">
                      <svg aria-hidden="false" aria-label="" class="stroke-current w-5 h-5" height="24" width="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="11" cy="11" r="8"/>
                        <path d="M21 21l-4.35-4.35"/>
                      </svg>
                    </span>
                    <span>Extract Video Data</span>
                  </div>
                </button>
              </span>
            </div>


            <div class="flex pointer-events-auto gap-2">
              <span class="inline-flex">
                <button id="sidebar-configure" aria-label="Configure Webhook" class="inline-flex items-center text-sm font-medium transition ease-in-out duration-150 active:scale-97 will-change-transform group whitespace-nowrap border text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-white/[.10] dark:bg-night-900/[.06] hover:text-slate-900 dark:text-gray-100 dark:hover:text-white focus:outline-none focus-visible:shadow-outline-indigo px-3 py-1 rounded-lg pl-2.5" tabindex="0" type="button">
                  <div class="relative flex items-center justify-center gap-1">
                    <span class="">
                      <svg aria-hidden="false" aria-label="" class="stroke-current w-5 h-5" height="24" width="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    </span>
                    <span>Configure Webhook</span>
                  </div>
                </button>
              </span>
            </div>
          </div>


        </div>

        <!-- Results Section -->
        <div id="sidebar-results" class="tella-results-section" style="display: none;">
          <!-- Success Message -->
          <div id="sidebar-success" class="tella-alert tella-alert-success" style="display: none;">
            <span id="sidebar-success-text"></span>
          </div>

          <!-- Error Message -->
          <div id="sidebar-error" class="tella-alert tella-alert-error" style="display: none;">
            <span id="sidebar-error-text"></span>
            <div id="sidebar-error-details" class="error-details"></div>
            <button id="sidebar-try-again" class="tella-btn tella-btn-secondary" style="display: none; margin-top: 8px;">
              🔄 Try Again
            </button>
          </div>
        </div>

      </div>
    `;

    console.log('✅ Sidebar interface rendered');
  }


  /**
   * Setup event listeners for the interface
   */
  setupEventListeners() {
    // Save webhook URL
    const saveBtn = this.container.querySelector('#sidebar-save-webhook');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveWebhookUrl());
    }

    // Webhook URL input
    const webhookUrlInput = this.container.querySelector('#sidebar-webhook-url');
    if (webhookUrlInput) {
      webhookUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.saveWebhookUrl();
        }
      });
    }

    // Extract data (primary button)
    const primaryExtractBtn = this.container.querySelector('#sidebar-extract-video-data');
    if (primaryExtractBtn) {
      primaryExtractBtn.addEventListener('click', () => this.extractData());
    }

    // Extract data (secondary button in actions)
    const extractBtn = this.container.querySelector('#sidebar-extract-data');
    if (extractBtn) {
      extractBtn.addEventListener('click', () => this.extractData());
    }

    // Send to webhook (primary button)
    const primarySendBtn = this.container.querySelector('#sidebar-send-to-webhook');
    if (primarySendBtn) {
      primarySendBtn.addEventListener('click', async () => {
        // Ensure webhook URL is loaded before sending
        if (!this.webhookUrl) {
          await this.loadWebhookUrl();
        }
        this.sendToWebhook();
      });
    }


    // Configure webhook
    const configBtn = this.container.querySelector('#sidebar-configure');
    if (configBtn) {
      configBtn.addEventListener('click', () => this.showConfigSection());
    }

    // Try again
    const tryAgainBtn = this.container.querySelector('#sidebar-try-again');
    if (tryAgainBtn) {
      tryAgainBtn.addEventListener('click', () => this.extractData());
    }



    console.log('✅ Event listeners setup complete');
  }

  /**
   * Check current page status
   */
  async checkPageStatus() {
    try {
      this.updateStatus('checking', 'Checking page...');

      // Check if we're on a valid Tella page
      const isTellaPage = this.currentTab?.url &&
                         (this.currentTab.url.includes('tella.tv') ||
                          this.currentTab.url.includes('www.tella.tv'));

      if (isTellaPage) {
        // Check page validity through content script
        try {
          const response = await chrome.tabs.sendMessage(this.currentTab.id, {
            action: 'checkPage'
          });

          if (response && response.isValidPage) {
            this.updateStatus('ready', 'Ready to extract video data');
            this.showExtractButton();
          } else {
            this.updateStatus('not-tella', 'No video found on this page');
          }
        } catch (error) {
          // Don't show error, just mark as checking - we'll try to extract anyway
          this.updateStatus('checking', 'Checking for video data...');
        }
      } else {
        this.updateStatus('not-tella', 'Navigate to Tella.tv to extract video data');
      }

    } catch (error) {
      console.error('❌ Error checking page status:', error);
      this.updateStatus('checking', 'Checking for video data...');
    }
  }

  /**
   * Automatically extract data and show preview
   */
  async autoExtractAndPreview() {
    try {
      // Only auto-extract on Tella pages
      const isTellaPage = this.currentTab?.url &&
                         (this.currentTab.url.includes('tella.tv') ||
                          this.currentTab.url.includes('www.tella.tv'));

      if (!isTellaPage) {
        return;
      }

      // Listen for data extraction events
      window.addEventListener('tella-data-extracted', (event) => {
        if (event.detail) {
          this.extractedData = event.detail;
          this.showDataPreview();
          this.showSendButton();
          console.log('✅ Data preview updated from extraction event');
        }
      });

      // Try to get data with retries (data might still be extracting)
      const maxRetries = 10;
      let retryCount = 0;
      
      const tryGetData = async () => {
        let response;
        let data = null;
        
        // Method 1: Check if data is already stored on window
        if (window.tellaExtractedData) {
          data = window.tellaExtractedData;
          response = { success: true, data };
        }
        
        // Method 2: Try chrome.tabs.sendMessage if we have a tab ID
        if (!response && this.currentTab?.id && chrome && chrome.tabs && chrome.tabs.sendMessage) {
          try {
            response = await chrome.tabs.sendMessage(this.currentTab.id, {
              action: 'extractData'
            });
          } catch (e) {
            // Silent fail, try next method
          }
        }
        
        // Method 3: Try to access extractor directly (same page context)
        if (!response || !response.success) {
          try {
            if (window.tellaExtractor && typeof window.tellaExtractor.extractAllData === 'function') {
              data = await window.tellaExtractor.extractAllData();
              if (data) {
                response = { success: true, data };
              }
            }
          } catch (e) {
            // Silent fail
          }
        }

        // If we got data, show preview
        if (response && response.success && response.data) {
          this.extractedData = response.data;
          this.showDataPreview();
          this.showSendButton();
          console.log('✅ Auto-extracted data preview shown');
        } else if (retryCount < maxRetries) {
          // Retry after a delay if data not ready yet
          retryCount++;
          console.log(`⏳ Data not ready yet, retrying... (${retryCount}/${maxRetries})`);
          setTimeout(tryGetData, 500);
        } else {
          // Show ready state if no data after max retries
          this.updateStatus('ready', 'Ready to extract video data');
        }
      };

      // Start trying to get data
      tryGetData();

    } catch (error) {
      // Silent fail - don't show errors for auto-extraction
      console.log('ℹ️ Auto-extraction not available:', error.message);
      this.updateStatus('ready', 'Ready to extract video data');
    }
  }

  /**
   * Show preview of extracted data in status area
   */
  showDataPreview() {
    if (!this.extractedData || Object.keys(this.extractedData).length === 0) {
      return;
    }

    const videoData = this.extractedData.video || {};
    const timingData = this.extractedData.timing || {};
    const contentData = this.extractedData.content || {};
    
    // Build preview message
    const parts = [];
    
    if (videoData.title) {
      parts.push(`📹 ${videoData.title.substring(0, 40)}${videoData.title.length > 40 ? '...' : ''}`);
    }
    
    if (timingData.duration) {
      const minutes = Math.floor(timingData.duration / 60);
      const seconds = timingData.duration % 60;
      parts.push(`⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}`);
    }
    
    if (contentData.chapters && contentData.chapters.length > 0) {
      parts.push(`📖 ${contentData.chapters.length} chapters`);
    }
    
    if (contentData.transcription && contentData.transcription.transcript) {
      const wordCount = contentData.transcription.transcriptWordCount || 
                       contentData.transcription.transcript.split(' ').length;
      parts.push(`📝 ${wordCount} words`);
    }

    // Update the data preview section if it exists
    this.updateDataPreview(this.extractedData);
  }

  /**
   * Save webhook URL to storage
   */
  async saveWebhookUrl() {
    const webhookUrlInput = this.container.querySelector('#sidebar-webhook-url');
    const webhookUrl = webhookUrlInput?.value?.trim();

    if (!webhookUrl) {
      this.showError('Please enter a webhook URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(webhookUrl);
    } catch (e) {
      this.showError('Please enter a valid webhook URL');
      return;
    }

    try {
      this.webhookUrl = webhookUrl;
      await chrome.storage.local.set({ webhookUrl: this.webhookUrl });
      
      // Check for Chrome runtime errors (storage API doesn't throw, it sets lastError)
      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }
      
      this.showSuccess('✅ Webhook URL saved!');
      this.updateInterface();

      console.log('✅ Webhook URL saved:', this.webhookUrl);

    } catch (error) {
      console.error('❌ Error saving webhook URL:', error);
      const errorMessage = error?.message || 'Unknown error';
      this.showError(`Failed to save webhook URL: ${errorMessage}`);
      
      // Try localStorage fallback if available
      if (window.tellaErrorHandler) {
        const fallbackResult = window.tellaErrorHandler.tryLocalStorageFallback('write', 'webhookUrl', this.webhookUrl);
        if (fallbackResult) {
          console.log('✅ Saved to localStorage fallback');
          this.showSuccess('✅ Webhook URL saved (using fallback storage)!');
          this.updateInterface();
        }
      }
    }
  }

  /**
   * Extract data from current page
   */
  async extractData() {
    try {
      this.updateStatus('checking', 'Extracting video data...');

      const primaryExtractBtn = this.container.querySelector('#sidebar-extract-video-data');
      const extractBtn = this.container.querySelector('#sidebar-extract-data');

      // Disable both buttons during extraction
      if (primaryExtractBtn) {
        primaryExtractBtn.disabled = true;
        const spanElement = primaryExtractBtn.querySelector('span:last-child');
        if (spanElement) spanElement.textContent = 'Extracting...';
      }
      if (extractBtn) {
        extractBtn.disabled = true;
        const spanElement = extractBtn.querySelector('span:last-child');
        if (spanElement) spanElement.textContent = 'Extracting...';
      }

      // Try multiple methods to extract data
      let response;
      
      // Method 1: Try chrome.tabs.sendMessage if we have a tab ID
      if (this.currentTab?.id && chrome && chrome.tabs && chrome.tabs.sendMessage) {
        try {
          response = await chrome.tabs.sendMessage(this.currentTab.id, {
            action: 'extractData'
          });
        } catch (e) {
          console.warn('⚠️ chrome.tabs.sendMessage failed, trying fallback:', e);
        }
      }
      
      // Method 2: Try to access extractor directly (same page context)
      if (!response || !response.success) {
        try {
          // The extractor is created in content.js and exposed on window
          if (window.tellaExtractor && typeof window.tellaExtractor.extractAllData === 'function') {
            const data = await window.tellaExtractor.extractAllData();
            if (data) {
              response = { success: true, data };
              console.log('✅ Data extracted via direct extractor access');
            }
          }
        } catch (e) {
          console.warn('⚠️ Direct extractor access failed:', e);
        }
      }
      
      // Method 3: Try runtime message (content script listens for this)
      if (!response || !response.success) {
        try {
          response = await this.sendRuntimeMessage({
            action: 'extractData',
            source: 'sidebar'
          });
        } catch (e) {
          console.warn('⚠️ Runtime message failed:', e);
        }
      }

      if (response && response.success) {
        this.extractedData = response.data;
        console.log('✅ Data extracted:', this.extractedData);

        this.updateDataPreview(this.extractedData);
        this.updateStatus('ready', 'Data extracted successfully');

        this.showSendButton();
        this.showSuccess('✅ Video data extracted!');

      } else {
        throw new Error(response?.error || 'Failed to extract data');
      }

    } catch (error) {
      console.error('❌ Error extracting data:', error);
      this.showError('Failed to extract data: ' + error.message);
      this.updateStatus('error', 'Extraction failed');
    } finally {
      const primaryExtractBtn = this.container.querySelector('#sidebar-extract-video-data');
      const extractBtn = this.container.querySelector('#sidebar-extract-data');

      // Re-enable both buttons
      if (primaryExtractBtn) {
        primaryExtractBtn.disabled = false;
        const spanElement = primaryExtractBtn.querySelector('span:last-child');
        if (spanElement) spanElement.textContent = 'Extract Video Data';
      }
      if (extractBtn) {
        extractBtn.disabled = false;
        const spanElement = extractBtn.querySelector('span:last-child');
        if (spanElement) spanElement.textContent = 'Extract Video Data';
      }
    }
  }

  /**
   * Send extracted data to webhook
   */
  async sendToWebhook() {
    console.log('🚀 sendToWebhook called');
    console.log('🔗 Webhook URL:', this.webhookUrl);
    console.log('📊 Extracted data:', this.extractedData);

    if (!this.webhookUrl) {
      console.error('❌ No webhook URL configured');
      this.showError('Please configure a webhook URL first');
      return;
    }

    // Validate webhook URL format
    try {
      const url = new URL(this.webhookUrl);
      if (!url.protocol.startsWith('http')) {
        throw new Error('Webhook URL must use http or https');
      }
    } catch (e) {
      console.error('❌ Invalid webhook URL:', e);
      this.showError('Invalid webhook URL. Please check the URL format.');
      return;
    }

    if (!this.extractedData || Object.keys(this.extractedData).length === 0) {
      console.error('❌ No extracted data available');
      this.showError('No data to send. Please extract data first.');
      return;
    }

    try {
      const primarySendBtn = this.container.querySelector('#sidebar-send-to-webhook');

      // Disable button during sending
      if (primarySendBtn) {
        primarySendBtn.disabled = true;
        const spanElement = primarySendBtn.querySelector('span:last-child');
        if (spanElement) spanElement.textContent = 'Sending...';
      }

      this.updateStatus('checking', 'Sending to webhook...');

      // Prepare payload with all extracted data
      const enhancedData = this._buildEnhancedPayload();
      
      const payload = {
        event: 'tella_data_extracted',
        timestamp: new Date().toISOString(),
        source: 'tella-extension-sidebar',
        data: enhancedData
      };

      console.log('📡 Sending to webhook:', this.webhookUrl);
      console.log('📦 Payload:', payload);

      // Send to webhook using proper promise handling with timeout
      const response = await this.sendRuntimeMessage({
        action: 'sendToWebhook',
        url: this.webhookUrl,
        data: payload
      });

      console.log('📨 Webhook response:', response);

      if (response && response.success) {
        this.showSuccess('✅ Successfully sent to webhook!');
        this.updateStatus('ready', 'Data sent successfully');

        // Store in history
        await this.storeSyncHistory();

      } else {
        const errorMsg = response?.error || response?.message || 'Unknown error';
        console.error('❌ Webhook send failed:', errorMsg);
        throw new Error(errorMsg);
      }

    } catch (error) {
      console.error('❌ Error sending to webhook:', error);

      this.showError('Failed to send to webhook: ' + error.message);
      this.updateStatus('error', 'Send failed');
    } finally {
      const primarySendBtn = this.container.querySelector('#sidebar-send-to-webhook');

      // Re-enable button
      if (primarySendBtn) {
        primarySendBtn.disabled = false;
        const spanElement = primarySendBtn.querySelector('span:last-child');
        if (spanElement) spanElement.textContent = 'Send to Webhook';
      }
    }
  }

  /**
   * Update data preview display
   */
  updateDataPreview(data) {
    const preview = this.container.querySelector('#sidebar-data-preview');
    if (!preview) return;

    // Metadata fields
    const titleEl = this.container.querySelector('#sidebar-preview-title');
    const videoIdEl = this.container.querySelector('#sidebar-preview-video-id');
    const durationEl = this.container.querySelector('#sidebar-preview-duration');
    const viewsEl = this.container.querySelector('#sidebar-preview-views');
    const dateEl = this.container.querySelector('#sidebar-preview-date');

    // Get data from nested structure (new API format) or flat structure (old format)
    const videoData = data.video || {};
    const timingData = data.timing || {};
    const contentData = data.content || {};
    const transcriptionData = contentData.transcription || {};

    // Update metadata
    if (titleEl) {
      titleEl.textContent = videoData.title || data.title || 'Not found';
    }
    if (videoIdEl) {
      videoIdEl.textContent = videoData.id || data.videoId || 'Not found';
    }
    if (durationEl) {
      const duration = timingData.duration || data.duration;
      if (duration) {
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        durationEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      } else {
        durationEl.textContent = 'Not found';
      }
    }
    if (viewsEl) {
      viewsEl.textContent = videoData.views !== undefined ? videoData.views : (data.views !== undefined ? data.views : 'Not found');
    }
    if (dateEl) {
      const date = timingData.createdAt || data.createdDate;
      if (date) {
        dateEl.textContent = new Date(date).toLocaleDateString();
      } else {
        dateEl.textContent = 'Not found';
      }
    }

    // Update chapters
    const chaptersSection = this.container.querySelector('#sidebar-chapters-section');
    const chaptersContainer = this.container.querySelector('#sidebar-preview-chapters');
    const chaptersCountEl = this.container.querySelector('#sidebar-chapters-count');
    
    const chapters = contentData.chapters || [];
    if (chapters.length > 0 && chaptersSection && chaptersContainer) {
      chaptersCountEl.textContent = chapters.length;
      
      // Clear and populate chapters
      chaptersContainer.innerHTML = '';
      chapters.slice(0, 10).forEach((chapter, index) => {
        const chapterEl = document.createElement('div');
        chapterEl.style.cssText = 'padding: 6px 8px; margin-bottom: 4px; background: white; border-radius: 4px; border-left: 3px solid #6D60FF;';
        
        const timestamp = chapter.timestampFormatted || this.formatTimestamp(chapter.timestamp || 0);
        const title = chapter.title || 'Untitled';
        const description = chapter.description ? ` - ${chapter.description}` : '';
        
        chapterEl.innerHTML = `
          <div style="font-weight: 600; color: #212529;">${timestamp} - ${title}</div>
          ${description ? `<div style="color: #6c757d; font-size: 10px; margin-top: 2px;">${description}</div>` : ''}
        `;
        
        chaptersContainer.appendChild(chapterEl);
      });
      
      if (chapters.length > 10) {
        const moreEl = document.createElement('div');
        moreEl.style.cssText = 'padding: 4px; text-align: center; color: #6c757d; font-size: 10px; font-style: italic;';
        moreEl.textContent = `... and ${chapters.length - 10} more chapters`;
        chaptersContainer.appendChild(moreEl);
      }
      
      chaptersSection.style.display = 'block';
    } else if (chaptersSection) {
      chaptersSection.style.display = 'none';
    }

    // Update transcript
    const transcriptSection = this.container.querySelector('#sidebar-transcript-section');
    const transcriptEl = this.container.querySelector('#sidebar-preview-transcript');
    const transcriptWordCountEl = this.container.querySelector('#sidebar-transcript-word-count');
    
    // Try multiple sources for transcript
    const transcript = transcriptionData.transcript || 
                      transcriptionData.transcriptionWords?.map(w => w.text).join(' ') ||
                      data.transcript ||
                      '';
    
    const wordCount = transcriptionData.transcriptWordCount || 
                     (transcriptionData.transcriptionWords ? transcriptionData.transcriptionWords.length : 0) ||
                     (transcript ? transcript.split(' ').length : 0);
    
    if (transcript && transcript.length > 0 && transcriptSection && transcriptEl) {
      // Show first 300 characters with option to expand
      const previewText = transcript.length > 300 ? transcript.substring(0, 300) + '...' : transcript;
      transcriptEl.textContent = previewText;
      
      if (transcriptWordCountEl) {
        transcriptWordCountEl.textContent = wordCount || transcript.split(' ').length;
      }
      
      transcriptSection.style.display = 'block';
    } else if (transcriptSection) {
      transcriptSection.style.display = 'none';
    }

    // Show preview
    preview.style.display = 'block';

    // Show quick action buttons
    this.showQuickActionButtons();
  }

  /**
   * Format timestamp from seconds to MM:SS
   */
  formatTimestamp(seconds) {
    if (typeof seconds !== 'number') return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Format timestamp from seconds to HH:MM:SS or MM:SS with leading zeros
   */
  formatTimestampWithLeadingZeros(seconds) {
    if (typeof seconds !== 'number') return '00:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Format chapters as markdown bulleted list
   * Format: - 00:00 {ChapterName} - {description}
   */
  formatChaptersAsMarkdown(chapters) {
    if (!chapters || !Array.isArray(chapters) || chapters.length === 0) {
      return '';
    }

    return chapters
      .map(chapter => {
        // Get timestamp - prefer formatted version, or format from timestamp
        let timestamp;
        if (chapter.timestampFormatted) {
          // Ensure leading zeros for consistency
          timestamp = chapter.timestampFormatted;
        } else if (chapter.timestamp !== undefined) {
          timestamp = this.formatTimestampWithLeadingZeros(chapter.timestamp);
        } else {
          timestamp = '00:00';
        }
        
        // Get title and description
        const title = chapter.title || 'Untitled';
        const description = chapter.description || '';
        
        // Format as: - 00:00 {ChapterName} - {description}
        if (description) {
          return `- ${timestamp} ${title} - ${description}`;
        } else {
          return `- ${timestamp} ${title}`;
        }
      })
      .join('\n');
  }

  /**
   * Build enhanced payload with chaptersMd added to content
   * @private
   */
  _buildEnhancedPayload() {
    const contentData = this.extractedData?.content || {};
    const chapters = contentData.chapters || [];
    const chaptersMd = this.formatChaptersAsMarkdown(chapters);
    
    return {
      ...this.extractedData,
      content: {
        ...contentData,
        chaptersMd: chaptersMd
      }
    };
  }

  /**
   * Update status indicator (removed - status indicator no longer displayed)
   */
  updateStatus(status, message) {
    // Status indicator removed - function kept for compatibility but does nothing
  }

  /**
   * Update interface based on current state
   */
  updateInterface() {
    const hasWebhook = !!this.webhookUrl;

    const configSection = this.container.querySelector('#sidebar-config');
    const mainSection = this.container.querySelector('#sidebar-main');
    const sendButtonContainer = this.container.querySelector('#sidebar-primary-send');

    if (configSection && mainSection) {
      if (hasWebhook) {
        configSection.style.display = 'none';
        mainSection.style.display = 'block';
        // Show send button when webhook is configured
        if (sendButtonContainer) {
          sendButtonContainer.style.display = 'block';
        }
        this.checkPageStatus(); // Re-check page when webhook is configured
      } else {
        configSection.style.display = 'block';
        mainSection.style.display = 'none';
        // Hide send button when no webhook
        if (sendButtonContainer) {
          sendButtonContainer.style.display = 'none';
        }
      }
    }
  }

  /**
   * Show configuration section
   */
  showConfigSection() {
    const configSection = this.container.querySelector('#sidebar-config');
    const mainSection = this.container.querySelector('#sidebar-main');

    if (configSection && mainSection) {
      configSection.style.display = 'block';
      mainSection.style.display = 'none';
    }
  }

  /**
   * Show extract button (primary)
   */
  showExtractButton() {
    const primaryExtractContainer = this.container.querySelector('#sidebar-primary-extract');
    if (primaryExtractContainer) {
      primaryExtractContainer.style.display = 'block';
    }

    // Also show secondary extract button in actions section
    const extractContainer = this.container.querySelector('#sidebar-extract-data-container');
    if (extractContainer) {
      extractContainer.style.display = 'inline-flex';
    }
  }

  /**
   * Show send button
   */
  showSendButton() {
    const sendButtonContainer = this.container.querySelector('#sidebar-primary-send');
    if (sendButtonContainer && this.webhookUrl) {
      sendButtonContainer.style.display = 'block';
    }
  }

  /**
   * Show quick action buttons (removed - buttons no longer displayed)
   */
  showQuickActionButtons() {
    // Quick action buttons removed - function kept for compatibility but does nothing
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    const successEl = this.container.querySelector('#sidebar-success');
    const successText = this.container.querySelector('#sidebar-success-text');
    const resultsSection = this.container.querySelector('#sidebar-results');
    const errorEl = this.container.querySelector('#sidebar-error');

    if (errorEl) errorEl.style.display = 'none';
    if (successText) successText.textContent = message;
    if (successEl) successEl.style.display = 'block';
    if (resultsSection) resultsSection.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (resultsSection) resultsSection.style.display = 'none';
    }, 5000);
  }

  /**
   * Show error message
   */
  showError(message, details = '') {
    const errorEl = this.container.querySelector('#sidebar-error');
    const errorText = this.container.querySelector('#sidebar-error-text');
    const errorDetails = this.container.querySelector('#sidebar-error-details');
    const resultsSection = this.container.querySelector('#sidebar-results');
    const successEl = this.container.querySelector('#sidebar-success');
    const tryAgainBtn = this.container.querySelector('#sidebar-try-again');

    if (successEl) successEl.style.display = 'none';
    if (errorText) errorText.textContent = message;

    if (details && errorDetails) {
      errorDetails.textContent = details;
    }

    if (errorEl) errorEl.style.display = 'block';
    if (resultsSection) resultsSection.style.display = 'block';
    if (tryAgainBtn) tryAgainBtn.style.display = 'block';
  }

  /**
   * Show raw data
   */
  showRawData() {
    if (!this.extractedData || Object.keys(this.extractedData).length === 0) {
      this.showError('No data extracted yet');
      return;
    }

    const payload = this.getWebhookPayload();

    // For now, log to console (in Phase 3 we'll add a proper modal)
    console.log('📊 Webhook payload:', payload);
    this.showSuccess('📊 Raw data logged to browser console (F12)');
  }

  /**
   * Copy data to clipboard
   */
  async copyDataToClipboard() {
    try {
      const payload = this.getWebhookPayload();

      const dataToCopy = {
        webhookUrl: this.webhookUrl,
        payload: payload
      };

      await navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
      this.showSuccess('📋 Webhook data copied to clipboard!');

    } catch (error) {
      console.error('❌ Error copying to clipboard:', error);
      this.showError('Failed to copy data');
    }
  }

  /**
   * Store sync history
   */
  async storeSyncHistory() {
    try {
      const result = await chrome.storage.local.get(['syncHistory']);
      const history = result.syncHistory || [];

      const title = this.extractedData.video?.title ||
                   this.extractedData.title ||
                   'Unknown';
      const url = this.extractedData.video?.url ||
                  this.extractedData.videoUrl ||
                  this.currentTab?.url;

      history.unshift({
        timestamp: new Date().toISOString(),
        title: title,
        url: url,
        webhookUrl: this.webhookUrl,
        success: true,
        source: 'sidebar'
      });

      // Keep only last 20 syncs
      if (history.length > 20) {
        history.splice(20);
      }

      await chrome.storage.local.set({ syncHistory: history });

    } catch (error) {
      console.error('❌ Error storing sync history:', error);
    }
  }

  /**
   * Get webhook payload for external use
   */
  getWebhookPayload() {
    if (!this.extractedData) return null;

    // Add chaptersMd to the payload
    const enhancedData = this._buildEnhancedPayload();

    return {
      event: 'tella_data_extracted',
      timestamp: new Date().toISOString(),
      source: 'tella-extension-sidebar',
      data: enhancedData
    };
  }

  /**
   * Check if interface is ready
   */
  isReady() {
    return this.initialized && !!this.webhookUrl;
  }

  /**
   * Cleanup method
   */
  destroy() {
    this.initialized = false;
    if (this.container) {
      this.container.innerHTML = '';
    }
    console.log('🧹 Sidebar webhook interface cleaned up');
  }
}

// Export for use in other files
window.TellaSidebarWebhook = TellaSidebarWebhook;