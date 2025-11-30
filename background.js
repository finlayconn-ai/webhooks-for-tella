// Simple Background script - just POST to webhook URL

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Background received:', request.action);

  if (request.action === 'sendToWebhook') {
    handleSendToWebhook(request.url, request.data)
      .then(result => sendResponse(result))
      .catch(error => {
        console.error('❌ Webhook error:', error);
        sendResponse({
          success: false,
          error: error.message || 'Unknown error occurred'
        });
      });

    return true; // Keep message channel open for async response
  }
});

// Send data to webhook URL
async function handleSendToWebhook(webhookUrl, data) {
  try {
    console.log('🚀 Sending to webhook:', {
      url: sanitizeUrl(webhookUrl),
      dataSize: JSON.stringify(data).length + ' bytes'
    });

    // Make HTTP POST request
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `Tella-Extension/${chrome.runtime.getManifest().version}`
      },
      body: JSON.stringify(data)
    });

    // Check if request was successful
    if (response.ok) {
      console.log('✅ Webhook delivered successfully:', {
        status: response.status,
        statusText: response.statusText
      });

      return {
        success: true,
        status: response.status,
        message: `Webhook delivered successfully (${response.status})`
      };

    } else {
      // Get error details if available
      let errorDetail = '';
      try {
        const errorText = await response.text();
        errorDetail = errorText ? ` - ${errorText.substring(0, 200)}` : '';
      } catch (e) {
        // Ignore error text parsing failures
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}${errorDetail}`);
    }

  } catch (error) {
    console.error('❌ Webhook delivery failed:', error);

    // Convert technical errors to user-friendly messages
    let friendlyError = error.message;

    if (error.message.includes('Failed to fetch')) {
      friendlyError = 'Network error - could not reach webhook URL. Check the URL and your internet connection.';
    } else if (error.message.includes('ERR_CERT_')) {
      friendlyError = 'SSL certificate error - the webhook URL may be invalid.';
    } else if (error.message.includes('CORS')) {
      friendlyError = 'CORS error - the webhook service may need to allow browser requests.';
    } else if (error.message.includes('400')) {
      friendlyError = 'Bad Request - the webhook service rejected the data format.';
    } else if (error.message.includes('404')) {
      friendlyError = 'Webhook URL not found. Please check the URL is correct.';
    } else if (error.message.includes('500')) {
      friendlyError = 'Webhook service error. Please try again later.';
    }

    return {
      success: false,
      error: friendlyError,
      originalError: error.message
    };
  }
}

// Helper function to sanitize URL for logging (remove sensitive params)
function sanitizeUrl(url) {
  try {
    const urlObj = new URL(url);

    // Hide common sensitive parameters in logs
    const sensitiveParams = ['token', 'key', 'secret', 'auth', 'password'];

    sensitiveParams.forEach(param => {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, '[HIDDEN]');
      }
    });

    return urlObj.toString();
  } catch (e) {
    return '[INVALID_URL]';
  }
}

// Extension installation
chrome.runtime.onInstalled.addListener((details) => {
  const version = chrome.runtime.getManifest().version;

  if (details.reason === 'install') {
    console.log('🎉 Tella Webhook Extension installed, version:', version);

    // Show welcome notification
    chrome.notifications?.create({
      type: 'basic',
      title: 'Tella Extension Installed',
      message: 'Connect to Make.com, Zapier, or any webhook service!'
    });

  } else if (details.reason === 'update') {
    console.log('🔄 Extension updated to version:', version);

    chrome.notifications?.create({
      type: 'basic',
      title: 'Tella Extension Updated',
      message: `Updated to v${version} with improved webhook support!`
    });
  }
});

chrome.runtime.onStartup.addListener(() => {
  console.log('🚀 Tella Webhook Extension started');
});