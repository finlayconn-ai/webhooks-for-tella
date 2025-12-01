/**
 * Playwright tests for Webhooks for Tella Chrome Extension
 * 
 * Run with: npx playwright test
 */

const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Webhooks for Tella Extension', () => {
  let extensionId;
  let context;
  let page;

  test.beforeAll(async () => {
    // Use Chrome with extension loaded
    const { chromium } = require('playwright');
    const extensionPath = path.join(__dirname);
    
    context = await chromium.launchPersistentContext('', {
      headless: false,
      channel: 'chrome', // Use Chrome instead of Chromium
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ],
      viewport: { width: 1280, height: 720 },
    });

    // Get the first page or create a new one
    const pages = context.pages();
    page = pages.length > 0 ? pages[0] : await context.newPage();
  });

  test('Extension loads on Tella video page with /view URL', async () => {
    // Navigate to a Tella video page (using the example URL from README)
    const testUrl = 'https://www.tella.tv/video/cmhc67oae000h04lc3xwyfxfp/view';
    
    await page.goto(testUrl, { waitUntil: 'networkidle' });

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Check that we're on a valid Tella page
    const url = page.url();
    expect(url).toContain('tella.tv');
    expect(url).toContain('/view');

    // Check for extension indicator or sidebar
    // The extension should inject a sidebar tab or indicator
    const extensionIndicator = await page.locator('#tella-webhook-indicator').isVisible().catch(() => false);
    
    // Check console for extension messages
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('Tella') || msg.text().includes('webhook')) {
        logs.push(msg.text());
      }
    });

    // Wait a bit for extension to initialize
    await page.waitForTimeout(3000);

    // Verify extension is working by checking for data extraction
    const hasExtractor = await page.evaluate(() => {
      return typeof window.TellaDataExtractor !== 'undefined' || 
             document.querySelector('[data-tella-webhook]') !== null;
    });

    expect(hasExtractor || extensionIndicator).toBeTruthy();
  });

  test('Extension extracts video data', async () => {
    const testUrl = 'https://www.tella.tv/video/cmhc67oae000h04lc3xwyfxfp/view';
    await page.goto(testUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Test data extraction by checking for story ID in URL
    const storyId = await page.evaluate(() => {
      const url = window.location.href;
      const match = url.match(/\/video\/([a-zA-Z0-9]+)\/view/);
      return match ? match[1] : null;
    });

    expect(storyId).toBeTruthy();
    expect(storyId).toBe('cmhc67oae000h04lc3xwyfxfp');

    // Check if API endpoints are being called (for data extraction)
    const apiCalls = [];
    page.on('response', response => {
      if (response.url().includes('/api/stories/') && response.url().includes(storyId)) {
        apiCalls.push(response.url());
      }
    });

    // Trigger data extraction by checking if extractor runs
    const extractionData = await page.evaluate(() => {
      return new Promise((resolve) => {
        // Check if extractor exists and can extract data
        if (window.extractor || document.querySelector('[data-tella-extractor]')) {
          // Try to get extracted data
          setTimeout(() => {
            resolve({
              hasExtractor: true,
              url: window.location.href,
              storyId: window.location.href.match(/\/video\/([a-zA-Z0-9]+)\/view/)?.[1]
            });
          }, 2000);
        } else {
          resolve({ hasExtractor: false });
        }
      });
    });

    expect(extractionData.hasExtractor || extractionData.storyId).toBeTruthy();
  });

  test('Extension sidebar/webhook panel appears', async () => {
    const testUrl = 'https://www.tella.tv/video/cmhc67oae000h04lc3xwyfxfp/view';
    await page.goto(testUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000); // Give time for sidebar injection

    // Check for webhook tab in sidebar
    const webhookTab = await page.locator('[data-tella-webhook-tab], [aria-label*="webhook" i], button:has-text("Webhook")').first().isVisible().catch(() => false);
    
    // Check for webhook panel/content
    const webhookPanel = await page.locator('[data-tella-webhook-panel], .tella-webhook-content').first().isVisible().catch(() => false);

    // At least one should be present
    expect(webhookTab || webhookPanel).toBeTruthy();
  });

  test('Extension works only on /view URLs', async () => {
    // Test that extension doesn't work on non-/view URLs
    const invalidUrl = 'https://www.tella.tv/video/cmhc67oae000h04lc3xwyfxfp';
    
    await page.goto(invalidUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Extension should not activate on non-/view URLs
    const url = page.url();
    const isValidUrl = url.includes('/view');

    // If redirected or URL doesn't have /view, extension shouldn't work
    if (!isValidUrl) {
      const extensionActive = await page.locator('#tella-webhook-indicator').isVisible().catch(() => false);
      expect(extensionActive).toBeFalsy();
    }
  });

  test.afterAll(async () => {
    await context?.close();
  });
});

