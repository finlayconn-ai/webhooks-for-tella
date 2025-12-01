/**
 * Tella Sidebar Injector
 * Handles detection and injection of webhook tab into Tella's sidebar
 */

class TellaSidebarInjector {
  constructor() {
    this.sidebarSelectors = [
      // Primary targets - Tella specific tab areas
      '[role="tablist"]',
      '.flex.space-x-1',  // Common Tailwind tab container pattern
      '.tabs',
      '.tab-list',

      // Secondary targets - Look for containers with Chapters
      '[aria-label*="tab"]',
      'nav[role="navigation"]',
      '.flex.gap-',  // Tailwind flex containers with gaps

      // Tertiary targets - Button groups that might contain tabs
      '.flex.items-center.space-x-',
      '.flex.rounded-lg',
      'div[class*="flex"][class*="space"]',

      // Fallback targets - General sidebar areas
      '[data-testid="video-sidebar"]',
      '[data-testid="sidebar-tabs"]',
      '[class*="sidebar"]'
    ];

    this.sidebarContainer = null;
    this.webhookTab = null;
    this.webhookPanel = null;
    this.injectionAttempts = 0;
    this.maxAttempts = 10;
    this.retryDelay = 1000; // 1 second
    this.isInjecting = false; // Prevent concurrent injections
    this.lastObservedUrl = null; // Track URL for navigation detection

    console.log('🔍 TellaSidebarInjector initialized');
  }

  /**
   * Initialize sidebar injection process
   */
  async init() {
    try {
      console.log('🚀 Starting sidebar injection...');

      // Verify we're on a valid video page before proceeding
      const url = window.location.href;
      const isVideoPage = url.includes('/video/') && url.includes('/view') ||
                         url.includes('/watch/') ||
                         url.includes('/recordings/');
      
      if (!isVideoPage) {
        console.log('ℹ️ Not a video page, skipping sidebar injection:', url);
        return false;
      }

      // Wait for page to be ready
      if (document.readyState !== 'complete') {
        await this.waitForPageLoad();
      }

      // Try to find and inject into sidebar
      const success = await this.findAndInjectSidebar();

      if (success) {
        console.log('✅ Sidebar injection successful');
        this.setupNavigationObserver();
        return true;
      } else {
        console.warn('⚠️ Sidebar injection failed after all attempts');

        // Report failure to error handler
        if (window.tellaErrorHandler) {
          window.tellaErrorHandler.handleError('sidebar_injection', new Error('Failed to inject sidebar after all attempts'), {
            attempts: this.maxAttempts,
            selectors: this.sidebarSelectors.length,
            url: window.location.href
          });
        }

        return false;
      }

    } catch (error) {
      console.error('❌ Sidebar injection error:', error);

      // Report error to error handler
      if (window.tellaErrorHandler) {
        window.tellaErrorHandler.handleError('sidebar_injection', error, {
          phase: 'initialization',
          url: window.location.href,
          retryCount: this.injectionAttempts
        });
      }

      return false;
    }
  }

  /**
   * Wait for page to fully load
   */
  waitForPageLoad() {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', resolve, { once: true });
      }
    });
  }

  /**
   * Attempt to find sidebar and inject webhook tab
   */
  async findAndInjectSidebar() {
    // Prevent concurrent injection attempts
    if (this.isInjecting) {
      console.log('ℹ️ Injection already in progress, skipping...');
      return false;
    }

    // Check if tab already exists before starting
    const existingTab = document.getElementById('tella-webhook-tab');
    if (existingTab && existingTab.isConnected) {
      console.log('ℹ️ Webhook tab already exists, skipping injection');
      this.webhookTab = existingTab;
      const existingPanel = document.getElementById('tella-webhook-panel');
      if (existingPanel && existingPanel.isConnected) {
        this.webhookPanel = existingPanel;
      }
      return true;
    }

    this.isInjecting = true;

    try {
      while (this.injectionAttempts < this.maxAttempts) {
        this.injectionAttempts++;

        console.log(`🔍 Sidebar detection attempt ${this.injectionAttempts}/${this.maxAttempts}`);

        const sidebar = await this.detectSidebar();

        if (sidebar) {
          console.log('✅ Sidebar detected:', sidebar);

          const injected = await this.injectWebhookTab(sidebar);

          if (injected) {
            this.sidebarContainer = sidebar;
            this.isInjecting = false;
            return true;
          }
        }

        // Wait before next attempt
        if (this.injectionAttempts < this.maxAttempts) {
          await this.delay(this.retryDelay);
        }
      }

      this.isInjecting = false;
      return false;
    } catch (error) {
      this.isInjecting = false;
      throw error;
    }
  }

  /**
   * Detect Tella's sidebar using multiple selector strategies
   */
  async detectSidebar() {
    // First, try efficient selector-based approach
    console.log('🔍 Trying selector-based search...');
    for (const selector of this.sidebarSelectors) {
      try {
        const elements = document.querySelectorAll(selector);

        for (const element of elements) {
          if (this.validateSidebarStructure(element)) {
            console.log(`✅ Valid sidebar found with selector: ${selector}`);
            return element;
          }
        }

      } catch (error) {
        console.warn(`⚠️ Error with selector ${selector}:`, error);
        continue;
      }
    }

    // Fallback: Search for "Chapters" text within targeted containers only
    console.log('🔍 Falling back to targeted "Chapters" text search...');
    const sidebarCandidates = document.querySelectorAll('[role="tablist"], nav, aside, [class*="sidebar"], [class*="tab"], [aria-label*="tab"]');

    for (const candidate of sidebarCandidates) {
      const text = candidate.textContent?.toLowerCase() || '';
      if (text.includes('chapters')) {
        console.log('🔍 Found candidate with Chapters text:', candidate);

        // Check if this element or its parent is a valid sidebar container
        let currentElement = candidate;
        for (let i = 0; i < 5; i++) { // Check up to 5 parent levels
          if (this.validateSidebarStructure(currentElement)) {
            console.log(`✅ Valid sidebar found via Chapters text search (level ${i})`);
            return currentElement;
          }
          currentElement = currentElement.parentElement;
          if (!currentElement) break;
        }
      }
    }

    return null;
  }

  /**
   * Validate sidebar structure with progressive enhancement (updated for robustness)
   */
  validateSidebarStructure(element) {
    if (!element || !element.isConnected) {
      return false;
    }

    console.log('🔍 Validating sidebar structure with progressive enhancement...');

    // Progressive enhancement: Try h2-based validation first
    const h2Validation = this.validateH2BasedStructure(element);
    if (h2Validation.isValid) {
      console.log('✅ H2-based structure validation passed');
      return true;
    }

    // Fallback: Try button-based validation for older Tella versions
    const buttonValidation = this.validateButtonBasedStructure(element);
    if (buttonValidation.isValid) {
      console.log('✅ Button-based structure validation passed (fallback)');
      return true;
    }

    // Final fallback: Content-based validation
    const contentValidation = this.validateContentBasedStructure(element);
    if (contentValidation.isValid) {
      console.log('✅ Content-based structure validation passed (final fallback)');
      return true;
    }

    console.warn('⚠️ All validation methods failed');
    return false;
  }

  /**
   * Validate h2-based structure (Tella's current implementation)
   */
  validateH2BasedStructure(element) {
    const h2Elements = element.querySelectorAll('h2');
    const textContent = element.textContent?.toLowerCase() || '';

    // Check for h2 elements with expected tab text
    const hasChaptersH2 = Array.from(h2Elements).some(h2 =>
      h2.textContent?.trim() === 'Chapters'
    );
    const hasTranscriptH2 = Array.from(h2Elements).some(h2 =>
      h2.textContent?.trim() === 'Transcript'
    );
    const hasCommentsH2 = Array.from(h2Elements).some(h2 =>
      h2.textContent?.trim() === 'Comments'
    );

    const h2TabCount = [hasChaptersH2, hasTranscriptH2, hasCommentsH2].filter(Boolean).length;

    // Check for Tella animation classes
    const hasAnimationSupport = element.querySelector('.animate-slideDownAndFade') ||
                               element.querySelector('.slideDownAndFade') ||
                               element.querySelector('[class*="animate-"]');

    // Check element properties
    const rect = element.getBoundingClientRect();
    const isVisible = rect.width > 0 && rect.height > 0;
    const reasonableSize = rect.width > 100 && rect.height > 50;

    const isValid = h2TabCount >= 1 && hasChaptersH2 && isVisible && reasonableSize;

    console.log('🔍 H2-based validation:', {
      hasChaptersH2, hasTranscriptH2, hasCommentsH2, h2TabCount,
      hasAnimationSupport, isVisible, reasonableSize, isValid
    });

    return { isValid, type: 'h2-based', confidence: isValid ? 0.9 : 0.1 };
  }

  /**
   * Validate button-based structure (Tella fallback compatibility)
   */
  validateButtonBasedStructure(element) {
    const buttons = element.querySelectorAll('button');
    const textContent = element.textContent?.toLowerCase() || '';

    // Check for buttons with expected tab text
    const hasChaptersBtn = Array.from(buttons).some(btn =>
      btn.textContent?.trim() === 'Chapters'
    );
    const hasTranscriptBtn = Array.from(buttons).some(btn =>
      btn.textContent?.trim() === 'Transcript'
    );
    const hasCommentsBtn = Array.from(buttons).some(btn =>
      btn.textContent?.trim() === 'Comments'
    );

    const buttonTabCount = [hasChaptersBtn, hasTranscriptBtn, hasCommentsBtn].filter(Boolean).length;

    // Check tab structure indicators
    const hasTabStructure = element.querySelector('[role="tab"]') ||
                           element.querySelector('[class*="tab"]');

    const rect = element.getBoundingClientRect();
    const isVisible = rect.width > 0 && rect.height > 0;
    const reasonableSize = rect.width > 50 && rect.height > 20;

    const isValid = buttonTabCount >= 1 && hasChaptersBtn && isVisible && reasonableSize;

    console.log('🔍 Button-based validation:', {
      hasChaptersBtn, hasTranscriptBtn, hasCommentsBtn, buttonTabCount,
      hasTabStructure, isVisible, reasonableSize, isValid
    });

    return { isValid, type: 'button-based', confidence: isValid ? 0.7 : 0.1 };
  }

  /**
   * Validate content-based structure (broadest compatibility)
   */
  validateContentBasedStructure(element) {
    const textContent = element.textContent?.toLowerCase() || '';

    // Check for expected content keywords
    const hasChapters = textContent.includes('chapters');
    const hasTranscript = textContent.includes('transcript');
    const hasComments = textContent.includes('comments');
    const contentTabCount = [hasChapters, hasTranscript, hasComments].filter(Boolean).length;

    // Check for flex layout (common in Tella)
    const hasFlexLayout = element.className?.includes('flex') ||
                         getComputedStyle(element).display === 'flex';

    // Check for reasonable sidebar dimensions
    const rect = element.getBoundingClientRect();
    const isVisible = rect.width > 0 && rect.height > 0;
    const reasonableSize = rect.width > 200 && rect.height > 100; // Bigger threshold for content-based

    const isValid = contentTabCount >= 2 && hasChapters && isVisible && reasonableSize && hasFlexLayout;

    console.log('🔍 Content-based validation:', {
      hasChapters, hasTranscript, hasComments, contentTabCount,
      hasFlexLayout, isVisible, reasonableSize, isValid
    });

    return { isValid, type: 'content-based', confidence: isValid ? 0.5 : 0.1 };
  }

  /**
   * Inject webhook tab into detected sidebar
   */
  async injectWebhookTab(sidebarElement) {
    try {
      console.log('🔧 Injecting webhook tab...');

      // Find the tab container within sidebar
      const tabContainer = this.findTabContainer(sidebarElement);

      if (!tabContainer) {
        console.warn('⚠️ Could not find tab container in sidebar');
        return false;
      }

      // Check if webhook tab already exists (by ID in DOM, not just our reference)
      const existingTab = document.getElementById('tella-webhook-tab');
      if (existingTab && existingTab.isConnected) {
        console.log('ℹ️ Webhook tab already exists in DOM');
        this.webhookTab = existingTab;
        // Also check for existing panel
        const existingPanel = document.getElementById('tella-webhook-panel');
        if (existingPanel && existingPanel.isConnected) {
          this.webhookPanel = existingPanel;
        }
        return true;
      }

      // Also check our reference
      if (this.webhookTab && this.webhookTab.isConnected) {
        console.log('ℹ️ Webhook tab already exists (reference)');
        return true;
      }

      // Create webhook tab
      this.webhookTab = this.createWebhookTab();

      // Create webhook panel
      this.webhookPanel = this.createWebhookPanel();

      // Find content container for panel - where the original content divs are located
      const contentContainer = this.findContentContainer(sidebarElement);

      // Inject tab into tab container
      tabContainer.appendChild(this.webhookTab);

      // Inject our webhook panel in the same area as original content
      if (contentContainer) {
        contentContainer.appendChild(this.webhookPanel);
        console.log('✅ Webhook panel added to existing content container');
      } else {
        // Fallback - try to find where content should go
        const contentArea = this.findContentArea(sidebarElement);
        if (contentArea) {
          contentArea.appendChild(this.webhookPanel);
          console.log('✅ Webhook panel added to content area');
        } else {
          // Final fallback - add after sidebar
          sidebarElement.parentNode.insertBefore(this.webhookPanel, sidebarElement.nextSibling);
          console.log('⚠️ Webhook panel added as fallback after sidebar');
        }
      }

      // Setup tab click handler
      this.setupTabClickHandler();

      // Debug logging
      console.log('✅ Webhook tab injected successfully');
      console.log('📍 Tab container details:', {
        className: tabContainer.className,
        innerHTML: tabContainer.innerHTML.slice(0, 200),
        childCount: tabContainer.children.length,
        parentElement: tabContainer.parentElement
      });
      console.log('📍 Webhook tab position:', {
        element: this.webhookTab,
        parentElement: this.webhookTab.parentElement,
        nextSibling: this.webhookTab.nextSibling,
        previousSibling: this.webhookTab.previousSibling
      });

      return true;

    } catch (error) {
      console.error('❌ Error injecting webhook tab:', error);
      return false;
    }
  }

  /**
   * Find tab container within sidebar (updated for button-based detection)
   */
  findTabContainer(sidebarElement) {
    console.log('🔍 Searching for tab container using button detection...');

    // Look for button with "Chapters" text (Tella's actual structure)
    const chaptersButton = Array.from(document.querySelectorAll('button')).find(button => {
      const spanText = button.querySelector('span:last-child')?.textContent?.trim();
      return spanText === 'Chapters';
    });

    if (chaptersButton) {
      console.log('✅ Found Chapters button:', chaptersButton);

      // The tab container should be the direct parent of the button
      // Structure: <div class="flex"> containing all tab buttons
      const tabContainer = chaptersButton.parentElement;

      if (tabContainer && tabContainer.classList.contains('flex')) {
        console.log('✅ Found tab container (flex div containing buttons):', tabContainer);
        console.log('📍 Container details:', {
          className: tabContainer.className,
          buttonCount: tabContainer.querySelectorAll('button').length,
          hasChapters: !!tabContainer.textContent?.includes('Chapters'),
          hasTranscript: !!tabContainer.textContent?.includes('Transcript'),
          hasComments: !!tabContainer.textContent?.includes('Comments')
        });
        return tabContainer;
      }
    }

    // Fallback: Look for div.flex that contains multiple buttons with expected tab text
    console.log('🔄 Trying fallback approach...');
    const flexContainers = document.querySelectorAll('div.flex');

    for (const container of flexContainers) {
      const buttons = container.querySelectorAll('button');

      if (buttons.length >= 2) {
        const text = container.textContent || '';
        const hasChapters = text.includes('Chapters');
        const hasTranscript = text.includes('Transcript');
        const hasComments = text.includes('Comments');
        const tabCount = [hasChapters, hasTranscript, hasComments].filter(Boolean).length;

        // Must have at least 2 of the 3 expected tabs
        if (tabCount >= 2) {
          console.log('✅ Found fallback tab container:', container);
          console.log('📍 Fallback details:', {
            className: container.className,
            buttonCount: buttons.length,
            tabCount,
            hasChapters, hasTranscript, hasComments
          });
          return container;
        }
      }
    }

    console.warn('⚠️ Could not find tab container with button-based detection');
    return null;
  }

  /**
   * Validate that element could be a tab container
   */
  validateTabContainer(element) {
    if (!element || !element.isConnected) return false;

    // Check for expected tab text content
    const text = element.textContent || '';
    const hasChapters = text.includes('Chapters');
    const hasTranscript = text.includes('Transcript');
    const hasComments = text.includes('Comments');
    const tabCount = [hasChapters, hasTranscript, hasComments].filter(Boolean).length;

    // Check element structure indicators
    const hasFlexLayout = element.className?.includes('flex') ||
                         getComputedStyle(element).display === 'flex';
    const hasReasonableSize = (() => {
      const rect = element.getBoundingClientRect();
      return rect.width > 50 && rect.height > 20;
    })();

    // Must have at least 2 tabs and reasonable structure
    const isValid = tabCount >= 2 && hasReasonableSize;

    console.log('🔍 Tab container validation:', {
      hasChapters, hasTranscript, hasComments, tabCount,
      hasFlexLayout, hasReasonableSize, isValid,
      className: element.className
    });

    return isValid;
  }

  /**
   * Find content container for webhook panel with correct animation classes
   */
  findContentContainer(sidebarElement) {
    console.log('🔍 Looking for content container with correct Tella animation classes...');

    // Progressive approach: try multiple detection methods

    // Method 1: Look for containers with slideDownAndFade (correct Tella class)
    const slideDownContainer = this.findSlideDownContainer();
    if (slideDownContainer) {
      console.log('✅ Found content container via slideDownAndFade detection');
      return slideDownContainer;
    }

    // Method 2: Look for containers with multiple content panels
    const multiPanelContainer = this.findMultiPanelContainer();
    if (multiPanelContainer) {
      console.log('✅ Found content container via multi-panel detection');
      return multiPanelContainer;
    }

    // Method 3: Look relative to sidebar element
    const relativeContainer = this.findRelativeContentContainer(sidebarElement);
    if (relativeContainer) {
      console.log('✅ Found content container via sidebar relative search');
      return relativeContainer;
    }

    console.log('⚠️ No content container found with any method');
    return null;
  }

  /**
   * Find container with slideDownAndFade animation class (Tella's actual implementation)
   */
  findSlideDownContainer() {
    // Look for divs with correct Tella animation classes
    const animatedDivs = document.querySelectorAll('.slideDownAndFade, .animate-slideDownAndFade');

    for (const div of animatedDivs) {
      const parent = div.parentElement;
      if (parent) {
        // Check if parent contains multiple content panels
        const contentPanels = parent.querySelectorAll('div.hidden, div[class*="slideDown"], div[class*="animate-"]');
        if (contentPanels.length > 0) {
          console.log('📍 Found slideDown-based container:', {
            parent: parent,
            animatedDiv: div,
            contentPanels: contentPanels.length
          });
          return parent;
        }
      }
    }

    return null;
  }

  /**
   * Find container with multiple content panels
   */
  findMultiPanelContainer() {
    const containers = document.querySelectorAll('div');

    for (const container of containers) {
      // Look for direct child content panels
      const hiddenDivs = container.querySelectorAll(':scope > div.hidden');
      const animatedDivs = container.querySelectorAll(':scope > div[class*="slideDown"], :scope > div[class*="animate-"]');

      const totalContentPanels = hiddenDivs.length + animatedDivs.length;

      // Must have at least 2 content panels and reasonable size
      const rect = container.getBoundingClientRect();
      if (totalContentPanels >= 1 && rect.width > 200 && rect.height > 100) {
        console.log('📍 Found multi-panel container:', {
          container: container,
          hiddenDivs: hiddenDivs.length,
          animatedDivs: animatedDivs.length,
          totalPanels: totalContentPanels,
          size: { width: rect.width, height: rect.height }
        });
        return container;
      }
    }

    return null;
  }

  /**
   * Find content container relative to sidebar element
   */
  findRelativeContentContainer(sidebarElement) {
    if (!sidebarElement) return null;

    // Look in parent and sibling elements
    let currentElement = sidebarElement;
    for (let level = 0; level < 5; level++) {
      if (!currentElement.parentElement) break;
      currentElement = currentElement.parentElement;

      // Check if this level contains content-like structures
      const hasContentIndicators = currentElement.querySelector('.hidden') ||
                                  currentElement.querySelector('[class*="slideDown"]') ||
                                  currentElement.querySelector('[class*="animate-"]') ||
                                  currentElement.querySelector('[role="tabpanel"]');

      if (hasContentIndicators) {
        const rect = currentElement.getBoundingClientRect();
        if (rect.width > 200 && rect.height > 100) {
          console.log(`📍 Found relative container at level ${level}:`, {
            element: currentElement,
            hasContentIndicators: true,
            size: { width: rect.width, height: rect.height }
          });
          return currentElement;
        }
      }
    }

    return null;
  }

  /**
   * Find content area where content divs should be placed
   */
  findContentArea(sidebarElement) {
    // Look for the flex container that seems to hold the content area
    const flexContainers = document.querySelectorAll('div[class*="flex"]');

    for (const container of flexContainers) {
      // Look for containers that have the pattern we saw: flex with overflow settings
      if (container.classList.contains('flex-col') ||
          container.classList.contains('overflow-hidden') ||
          container.classList.contains('lg:overflow-y-scroll')) {

        // Check if this contains content-like divs
        const contentDivs = container.querySelectorAll('div.hidden, div[class*="slideOver"]');
        if (contentDivs.length > 0) {
          console.log('✅ Found flex content area with content divs');
          return container;
        }
      }
    }

    // Fallback: look for any container with multiple divs near the sidebar
    let current = sidebarElement;
    for (let i = 0; i < 5; i++) {
      if (!current.parentElement) break;
      current = current.parentElement;

      const contentDivs = current.querySelectorAll('div.hidden, div[class*="slideOver"]');
      if (contentDivs.length > 0) {
        console.log('✅ Found content area via parent traversal');
        return current;
      }
    }

    console.log('⚠️ No specific content area found');
    return null;
  }

  /**
   * Create webhook tab element (updated for button-based native integration)
   */
  createWebhookTab() {
    // Create button element to match Tella's actual tab structure
    const tab = document.createElement('button');

    // Copy exact classes from Tella's native tab buttons
    tab.className = 'px-4 py-3 text-sm font-medium transition-colors focus:outline-none group';

    // Add attributes for accessibility and identification
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', 'false');
    tab.setAttribute('aria-controls', 'tella-webhook-panel');
    tab.setAttribute('data-state', 'inactive');
    tab.id = 'tella-webhook-tab';
    tab.setAttribute('type', 'button');

    // Create content with exact structure from Tella's native buttons
    tab.innerHTML = `
      <div class="flex items-center justify-center gap-1">
        <span class="text-slate-400 dark:text-gray-400 group-hover:text-slate-900 dark:text-gray-100 dark:text-gray-400 dark:group-hover:text-gray-100">
          <svg aria-hidden="false" aria-label="" class="stroke-current w-5 h-5" height="20" width="20" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.785 6L18 14.215l-2.054 2.054a5.81 5.81 0 1 1-8.215-8.215zM4 20l3.5-3.5M15 4l-3.5 3.5M20 9l-3.5 3.5"></path>
          </svg>
        </span>
        <span class="hidden sm:hidden lg:hidden group-hover:text-slate-900 dark:group-hover:text-gray-100 text-slate-400 dark:text-gray-400">Webhook</span>
      </div>
    `;

    console.log('✅ Webhook button tab created with native Tella styling');
    return tab;
  }

  /**
   * Create webhook panel element (updated to match exact Tella content structure)
   */
  createWebhookPanel() {
    // Create main panel container with Tella's exact structure
    const panel = document.createElement('div');

    // Start hidden and match exactly the structure from the content switcher
    panel.className = 'hidden';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', 'tella-webhook-tab');
    panel.id = 'tella-webhook-panel';

    // Match the exact content structure shown: <div class="hidden"> or <div class="animate-slideDownAndFade">
    panel.innerHTML = `
      <div class="flex flex-col w-full group">
        <div class="sticky top-0 left-0 right-0 flex flex-col h-17 z-10 flex-shrink-0 pointer-events-none">
          <div class="flex items-center justify-between h-8 bg-white dark:bg-night-900 pr-1 pt-1">
            <h2 class="text-sm font-semibold text-slate-900 dark:text-gray-100" aria-selected="false" data-state="inactive">Send to Webhook</h2>
            <div class="flex pointer-events-auto gap-2">
              <div class="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <span class="inline-flex">
                  <button aria-label="" class="inline-flex items-center text-sm font-medium transition ease-in-out duration-150 active:scale-97 will-change-transform group whitespace-nowrap border text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-white/[.10] dark:bg-night-900/[.06] hover:text-slate-900 dark:text-gray-100 dark:hover:text-white focus:outline-none focus-visible:shadow-outline-indigo px-3 py-1 rounded-lg pl-2.5" tabindex="0" type="button" data-state="closed">
                    <div class="relative flex items-center justify-center gap-1">
                      <span class="">
                        <svg aria-hidden="false" aria-label="" class="stroke-current w-5 h-5 text-slate-400 dark:text-gray-400" height="24" width="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path d="M6.5 15.25V15.25C5.5335 15.25 4.75 14.4665 4.75 13.5V6.75C4.75 5.64543 5.64543 4.75 6.75 4.75H13.5C14.4665 4.75 15.25 5.5335 15.25 6.5V6.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path>
                          <rect height="10.5" width="10.5" rx="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" x="8.75" y="8.75"></rect>
                        </svg>
                      </span>
                      <span>Copy</span>
                    </div>
                  </button>
                </span>
                <span class="inline-flex">
                  <button aria-label="" class="inline-flex items-center text-sm font-medium transition ease-in-out duration-150 active:scale-97 will-change-transform group whitespace-nowrap border text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-white/[.10] dark:bg-night-900/[.06] hover:text-slate-900 dark:text-gray-100 dark:hover:text-white focus:outline-none focus-visible:shadow-outline-indigo px-3 py-1 rounded-lg pl-2.5" tabindex="0" type="button">
                    <div class="relative flex items-center justify-center gap-1">
                      <span class="group-hover:text-slate-400 dark:text-gray-400">
                        <svg aria-hidden="false" aria-label="" class="stroke-current w-5 h-5" height="24" width="24" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      </span>
                      <span>Settings</span>
                    </div>
                  </button>
                </span>
              </div>
            </div>
          </div>
          <div class="w-full h-8 transition-opacity duration-200 opacity-0"></div>
        </div>
        <div class="flex flex-col gap-1 -mt-5 pb-6 text-pretty">
          <div class="flex flex-col w-full group">

            <!-- Header -->
            <div class="tella-webhook-header">
              <h3>🔗 Webhook Integration</h3>
              <p class="subtitle">Send video data to any webhook service</p>
            </div>


            <!-- Configuration Section -->
            <div id="sidebar-config" class="tella-config-section" style="display: none;">
              <div class="form-group">
                <label for="sidebar-webhook-url">Webhook URL</label>
                <input type="url" id="sidebar-webhook-url" placeholder="https://hooks.make.com/webhook-id">
                <small>
                  Paste your webhook URL from
                  <a href="https://make.com" target="_blank">Make.com</a>,
                  <a href="https://zapier.com" target="_blank">Zapier</a>,
                  or any service
                </small>
              </div>
              <button id="sidebar-save-webhook" class="tella-btn tella-btn-primary">
                💾 Save Webhook URL
              </button>
            </div>

            <!-- Main Actions Section -->
            <div id="sidebar-main" class="tella-main-section" style="display: block;">

              <!-- Data Preview -->
              <div id="sidebar-data-preview" class="tella-data-preview" style="display: none;">
                <h4>📊 Extracted Data</h4>
                <div class="data-summary">
                  <div class="data-item">
                    <strong>Title:</strong>
                    <span id="sidebar-preview-title">Not extracted</span>
                  </div>
                  <div class="data-item">
                    <strong>Duration:</strong>
                    <span id="sidebar-preview-duration">Not extracted</span>
                  </div>
                  <div class="data-item">
                    <strong>Date:</strong>
                    <span id="sidebar-preview-date">Not extracted</span>
                  </div>
                  <div class="transcript-item" style="display: none;">
                    <strong>Transcript:</strong>
                    <div id="sidebar-preview-transcript" class="transcript-preview"></div>
                  </div>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="tella-actions">
                <button id="sidebar-extract-data" class="tella-btn tella-btn-primary" style="display: none;">
                  🔍 Extract Video Data
                </button>

                <button id="sidebar-send-webhook" class="tella-btn tella-btn-primary" style="display: none;">
                  🚀 Send to Webhook
                </button>

                <button id="sidebar-configure" class="tella-btn tella-btn-secondary">
                  ⚙️ Configure Webhook
                </button>
              </div>

              <!-- Quick Actions -->
              <div class="tella-quick-actions">
                <button id="sidebar-view-data" class="tella-btn tella-btn-link" style="display: none;">
                  👁️ View Raw Data
                </button>
                <button id="sidebar-copy-data" class="tella-btn tella-btn-link" style="display: none;">
                  📋 Copy Data
                </button>
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
        </div>
      </div>
    `;

    console.log('✅ Webhook panel created with exact Tella content structure');
    return panel;
  }

  /**
   * Setup React-aware tab integration using MutationObserver
   */
  setupTabClickHandler() {
    if (!this.webhookTab) return;

    // Find existing Tella tabs
    this.findExistingTabs();

    // Setup webhook tab click handler (hybrid approach)
    this.webhookTab.addEventListener('click', (e) => {
      console.log('🖱️ Webhook tab clicked - manually triggering state change');

      // Since our tab isn't part of React's component tree, we need to manually
      // set the state attributes that will trigger our MutationObserver
      this.manuallyActivateWebhookTab();

      // Also manually deactivate other tabs
      this.manuallyDeactivateOtherTabs();
    });

    // Setup click handlers for native tabs to hide webhook content
    this.setupNativeTabHandlers();

    // Setup MutationObserver instead of invasive click handlers
    this.setupReactStateObserver();

    // Setup observer for our own webhook tab
    this.setupWebhookTabObserver();

    console.log('✅ React-aware tab integration setup complete');
  }

  /**
   * Find existing Tella tabs using button elements (updated for correct structure)
   */
  findExistingTabs() {
    // Find existing tab button elements (Tella's actual structure)
    this.chaptersButton = Array.from(document.querySelectorAll('button')).find(button => {
      const spanText = button.querySelector('span:last-child')?.textContent?.trim();
      return spanText === 'Chapters';
    });
    this.transcriptButton = Array.from(document.querySelectorAll('button')).find(button => {
      const spanText = button.querySelector('span:last-child')?.textContent?.trim();
      return spanText === 'Transcript';
    });
    this.commentsButton = Array.from(document.querySelectorAll('button')).find(button => {
      const spanText = button.querySelector('span:last-child')?.textContent?.trim();
      return spanText === 'Comments';
    });

    // Store all native tabs for easy reference
    this.nativeTabs = [this.chaptersButton, this.transcriptButton, this.commentsButton].filter(Boolean);

    console.log('🔍 Found existing button tabs:', {
      chapters: !!this.chaptersButton,
      transcript: !!this.transcriptButton,
      comments: !!this.commentsButton,
      totalFound: this.nativeTabs.length
    });

    // Log details for debugging
    if (this.chaptersButton) {
      console.log('📍 Chapters button:', {
        element: this.chaptersButton,
        classes: this.chaptersButton.className,
        ariaSelected: this.chaptersButton.getAttribute('aria-selected'),
        dataState: this.chaptersButton.getAttribute('data-state'),
        textContent: this.chaptersButton.textContent?.trim()
      });
    }

    return this.nativeTabs.length > 0;
  }

  /**
   * Setup click handlers for native tabs to hide webhook content when they're clicked
   */
  setupNativeTabHandlers() {
    const nativeTabButtons = [this.chaptersButton, this.transcriptButton, this.commentsButton].filter(Boolean);

    nativeTabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        console.log('🖱️ Native tab clicked, deactivating webhook tab');
        // Immediately hide webhook content when native tab is clicked
        // Don't prevent default - let React handle the native tab state
        if (this.webhookPanel && !this.webhookPanel.classList.contains('hidden')) {
          this.webhookPanel.classList.remove('animate-slideDownAndFade');
          this.webhookPanel.classList.add('hidden');
        }
        // Manually deactivate webhook tab when native tab is clicked
        this.manuallyDeactivateWebhookTab();
      }, { capture: true }); // Use capture phase to run before React's handlers
    });

    console.log('✅ Native tab handlers setup for', nativeTabButtons.length, 'tabs');

    // Add debugging to observe native tab state changes
    this.observeNativeTabStates();
  }

  /**
   * Observe native tab states to understand how they change when active
   */
  observeNativeTabStates() {
    const nativeTabButtons = [this.chaptersButton, this.transcriptButton, this.commentsButton].filter(Boolean);

    nativeTabButtons.forEach((button, index) => {
      const tabName = ['Chapters', 'Transcript', 'Comments'][index];

      // Create observer for each native tab
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && (
              mutation.attributeName === 'class' ||
              mutation.attributeName === 'aria-selected' ||
              mutation.attributeName === 'data-state'
          )) {
            console.log(`🔍 ${tabName} tab state changed:`, {
              classes: button.className,
              ariaSelected: button.getAttribute('aria-selected'),
              dataState: button.getAttribute('data-state'),
              textContent: button.textContent?.trim()
            });

            // Check if this tab became active
            const isActive = this.checkIfTabIsActive(button);
            if (isActive) {
              console.log(`✅ ${tabName} tab is now ACTIVE - analyzing underline indicator`);
              this.analyzeActiveTabStructure(button);
              // Reset shared indicator position for this native tab
              this.resetIndicatorForNativeTab(button, index);
            }
          }
        });
      });

      // Observe the button and its children for changes
      observer.observe(button, {
        attributes: true,
        subtree: true,
        attributeFilter: ['class', 'aria-selected', 'data-state']
      });
    });

    console.log('✅ Native tab state observers setup');
  }

  /**
   * Setup observer for our webhook tab to detect when React changes its state
   */
  setupWebhookTabObserver() {
    if (!this.webhookTab) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && (
            mutation.attributeName === 'aria-selected' ||
            mutation.attributeName === 'data-state'
        )) {
          const isActive = this.checkIfTabIsActive(this.webhookTab);

          console.log('🔍 Webhook tab state changed:', {
            ariaSelected: this.webhookTab.getAttribute('aria-selected'),
            dataState: this.webhookTab.getAttribute('data-state'),
            isActive
          });

          if (isActive) {
            console.log('✅ Webhook tab activated by React - showing content and applying styling');
            this.handleWebhookTabActivated();
          } else {
            console.log('❌ Webhook tab deactivated by React - hiding content and resetting styling');
            this.handleWebhookTabDeactivated();
          }
        }
      });
    });

    // Observe our webhook tab for state changes
    observer.observe(this.webhookTab, {
      attributes: true,
      attributeFilter: ['aria-selected', 'data-state']
    });

    console.log('✅ Webhook tab observer setup');
  }

  /**
   * Handle when React activates our webhook tab
   */
  handleWebhookTabActivated() {
    // Hide all other content panels
    this.hideAllContentPanels();

    // Show webhook content
    if (this.webhookPanel) {
      this.webhookPanel.classList.remove('hidden');
      this.webhookPanel.classList.add('animate-slideDownAndFade');
    }

    // Apply active styling to webhook tab
    this.applyWebhookActiveState();

    // Trigger webhook interface initialization
    this.triggerWebhookActivation();
  }

  /**
   * Handle when React deactivates our webhook tab
   */
  handleWebhookTabDeactivated() {
    // Hide webhook content
    if (this.webhookPanel) {
      this.webhookPanel.classList.remove('animate-slideDownAndFade');
      setTimeout(() => {
        this.webhookPanel.classList.add('hidden');
      }, 150);
    }

    // Reset webhook tab styling to inactive
    this.applyWebhookInactiveState();
  }

  /**
   * Apply active visual state to webhook tab icon and text
   */
  applyWebhookActiveState() {
    const webhookIconSpan = this.webhookTab.querySelector('span:first-child');
    const webhookTextSpan = this.webhookTab.querySelector('span:last-child');

    if (webhookIconSpan) {
      webhookIconSpan.className = 'text-brand-800 dark:text-brand-400';
    }

    if (webhookTextSpan) {
      webhookTextSpan.className = 'hidden sm:hidden lg:hidden group-hover:text-slate-900 dark:group-hover:text-gray-100 text-slate-800 dark:text-gray-100';
    }

    // Position the shared underline indicator under our webhook tab
    this.positionIndicatorForWebhookTab();

    console.log('✅ Applied active styling and positioned shared indicator for webhook tab');
  }

  /**
   * Apply inactive visual state to webhook tab icon and text
   */
  applyWebhookInactiveState() {
    const webhookIconSpan = this.webhookTab.querySelector('span:first-child');
    const webhookTextSpan = this.webhookTab.querySelector('span:last-child');

    if (webhookIconSpan) {
      webhookIconSpan.className = 'text-slate-400 dark:text-gray-400 group-hover:text-slate-900 dark:text-gray-100 dark:text-gray-400 dark:group-hover:text-gray-100';
    }

    if (webhookTextSpan) {
      webhookTextSpan.className = 'hidden sm:hidden lg:hidden group-hover:text-slate-900 dark:group-hover:text-gray-100 text-slate-400 dark:text-gray-400';
    }

    console.log('✅ Applied inactive styling to webhook tab');
  }

  /**
   * Position the shared underline indicator under our webhook tab
   */
  positionIndicatorForWebhookTab() {
    if (!this.webhookTab) return;

    // Find the existing shared indicator element
    const indicators = document.querySelectorAll('.absolute.bottom-0.h-0\\.5.rounded-full.transition-all.duration-100.ease-out');
    let indicator = null;

    // Look for indicator with brand background classes
    for (const el of indicators) {
      if (el.className.includes('bg-brand-7') || el.className.includes('bg-brand-4')) {
        indicator = el;
        break;
      }
    }

    if (!indicator) {
      // Try broader search for the shared indicator
      const allIndicators = document.querySelectorAll('div[style*="left:"]');
      for (const el of allIndicators) {
        if (el.className.includes('absolute') && el.className.includes('bottom-0') &&
            el.className.includes('h-0.5') && el.className.includes('bg-brand-7')) {
          indicator = el;
          break;
        }
      }
    }

    if (!indicator) {
      console.log('⚠️ Could not find existing shared indicator');
      return;
    }

    // Calculate position dynamically based on actual tab position
    // Get the tab container (parent of webhook tab)
    const tabContainer = this.webhookTab.parentElement;
    if (!tabContainer) {
      console.log('⚠️ Could not find tab container');
      return;
    }

    // Get all tab buttons in the container (including webhook tab)
    const allTabs = Array.from(tabContainer.children).filter(child => 
      child.tagName === 'BUTTON' || child.id === 'tella-webhook-tab'
    );

    // Find the webhook tab's index in the container
    const webhookTabIndex = allTabs.indexOf(this.webhookTab);
    
    if (webhookTabIndex === -1) {
      console.log('⚠️ Could not find webhook tab in container');
      return;
    }

    // Get the webhook tab's actual position using getBoundingClientRect
    const webhookTabRect = this.webhookTab.getBoundingClientRect();
    const containerRect = tabContainer.getBoundingClientRect();
    
    // Calculate left position relative to container
    const leftPosition = webhookTabRect.left - containerRect.left;
    const width = webhookTabRect.width;

    // Update the shared indicator position
    indicator.style.left = `${leftPosition}px`;
    indicator.style.width = `${width}px`;

    console.log('✅ Positioned shared indicator for webhook tab:', {
      left: leftPosition,
      width: width,
      tabIndex: webhookTabIndex,
      totalTabs: allTabs.length,
      element: indicator
    });
  }



  /**
   * Manually activate webhook tab by setting proper attributes
   */
  manuallyActivateWebhookTab() {
    if (!this.webhookTab) return;

    // Set the attributes that React would set
    this.webhookTab.setAttribute('aria-selected', 'true');
    this.webhookTab.setAttribute('data-state', 'active');

    console.log('🔧 Manually activated webhook tab attributes');
  }

  /**
   * Manually deactivate other tabs when webhook tab is clicked
   */
  manuallyDeactivateOtherTabs() {
    const nativeTabButtons = [this.chaptersButton, this.transcriptButton, this.commentsButton].filter(Boolean);

    nativeTabButtons.forEach(button => {
      button.setAttribute('aria-selected', 'false');
      button.setAttribute('data-state', 'inactive');

      // Also reset their visual styling
      const iconSpan = button.querySelector('span:first-child');
      const textSpan = button.querySelector('span:last-child');

      if (iconSpan) {
        iconSpan.className = 'text-slate-400 dark:text-gray-400 group-hover:text-slate-900 dark:text-gray-100 dark:text-gray-400 dark:group-hover:text-gray-100';
      }

      if (textSpan) {
        textSpan.className = 'hidden sm:hidden lg:hidden group-hover:text-slate-900 dark:group-hover:text-gray-100 text-slate-400 dark:text-gray-400';
      }
    });

    console.log('🔧 Manually deactivated other tabs');
  }

  /**
   * Manually deactivate webhook tab when native tabs are clicked
   */
  manuallyDeactivateWebhookTab() {
    if (!this.webhookTab) return;

    // Hide the webhook panel content (this also sets tab to inactive)
    this.hideWebhookContent();

    console.log('🔧 Manually deactivated webhook tab and hid content');
  }

  /**
   * Check if a tab button is currently active
   */
  checkIfTabIsActive(button) {
    return (
      button.getAttribute('aria-selected') === 'true' ||
      button.getAttribute('data-state') === 'active' ||
      button.classList.contains('active')
    );
  }

  /**
   * Reset shared indicator position for native tabs
   */
  resetIndicatorForNativeTab(activeTab, tabIndex) {
    // Find the shared indicator element
    const indicators = document.querySelectorAll('.absolute.bottom-0.h-0\\.5.rounded-full.transition-all.duration-100.ease-out');
    let indicator = null;

    // Look for indicator with brand background classes
    for (const el of indicators) {
      if (el.className.includes('bg-brand-7') || el.className.includes('bg-brand-4')) {
        indicator = el;
        break;
      }
    }

    if (!indicator) {
      // Try broader search for the shared indicator
      const allIndicators = document.querySelectorAll('div[style*="left:"]');
      for (const el of allIndicators) {
        if (el.className.includes('absolute') && el.className.includes('bottom-0') &&
            el.className.includes('h-0.5') && el.className.includes('bg-brand-7')) {
          indicator = el;
          break;
        }
      }
    }

    if (!indicator) {
      console.log('⚠️ Could not find shared indicator to reset for native tab');
      return;
    }

    // Calculate position based on tab index:
    // 0 = Chapters: left: 0px
    // 1 = Transcript: left: 52px
    // 2 = Comments: left: 104px
    const leftPosition = tabIndex * 52;
    const width = 52;

    // Update the shared indicator position
    indicator.style.left = `${leftPosition}px`;
    indicator.style.width = `${width}px`;

    console.log(`✅ Reset shared indicator for native tab ${tabIndex}:`, {
      left: leftPosition,
      width: width,
      tabName: ['Chapters', 'Transcript', 'Comments'][tabIndex]
    });
  }

  /**
   * Analyze active tab structure to understand underline indicators
   */
  analyzeActiveTabStructure(activeTab) {
    console.log('🔍 Analyzing active tab structure for underline indicator...');

    // Look for the specific indicator element based on dev tools discovery
    const parent = activeTab.parentElement;
    const grandParent = parent.parentElement;

    // Search for the indicator element with the classes we saw in dev tools
    const indicators = document.querySelectorAll('.absolute.bottom-0, [class*="bg-brand-7"], [class*="h-0.5"], [class*="transition-all"]');

    console.log('📍 Found potential indicators:', Array.from(indicators).map(indicator => ({
      element: indicator,
      classes: indicator.className,
      position: indicator.getBoundingClientRect(),
      parent: indicator.parentElement?.className
    })));

    // Find the exact indicator for this tab by checking position
    const activeTabRect = activeTab.getBoundingClientRect();
    const matchingIndicator = Array.from(indicators).find(indicator => {
      const indicatorRect = indicator.getBoundingClientRect();
      // Check if indicator is positioned under this tab
      return Math.abs(indicatorRect.left - activeTabRect.left) < 10 &&
             indicatorRect.top > activeTabRect.bottom - 5;
    });

    if (matchingIndicator) {
      console.log('✅ Found matching indicator:', {
        element: matchingIndicator,
        classes: matchingIndicator.className,
        styles: {
          left: matchingIndicator.style.left,
          width: matchingIndicator.style.width,
          transform: matchingIndicator.style.transform
        },
        computedStyles: {
          left: getComputedStyle(matchingIndicator).left,
          width: getComputedStyle(matchingIndicator).width,
          transform: getComputedStyle(matchingIndicator).transform
        }
      });

      // Store reference to the indicator for our webhook tab
      this.nativeIndicator = matchingIndicator;
      this.nativeIndicatorParent = matchingIndicator.parentElement;
    }

    // Also check the parent structure to understand the container
    console.log('📍 Container structure:', {
      parent: parent.className,
      grandParent: grandParent?.className,
      containerPosition: getComputedStyle(parent.parentElement || parent).position
    });
  }

  /**
   * Copy active tab styling from native tab to webhook tab
   */
  copyActiveTabStyling(activeNativeTab) {
    if (!this.webhookTab) return;

    // Get the icon span from the active native tab
    const activeIconSpan = activeNativeTab.querySelector('span:first-child');
    const activeTextSpan = activeNativeTab.querySelector('span:last-child');

    // Get our webhook tab spans
    const webhookIconSpan = this.webhookTab.querySelector('span:first-child');
    const webhookTextSpan = this.webhookTab.querySelector('span:last-child');

    if (activeIconSpan && webhookIconSpan) {
      // Copy the exact classes from active native tab icon
      webhookIconSpan.className = activeIconSpan.className;
      console.log('✅ Copied icon styling:', activeIconSpan.className);
    }

    if (activeTextSpan && webhookTextSpan) {
      // Copy the exact classes from active native tab text
      webhookTextSpan.className = activeTextSpan.className;
      console.log('✅ Copied text styling:', activeTextSpan.className);
    }

    // Copy button-level attributes and classes
    const buttonClasses = activeNativeTab.className;
    const ariaSelected = activeNativeTab.getAttribute('aria-selected');
    const dataState = activeNativeTab.getAttribute('data-state');

    console.log('🔍 Active native tab details:', {
      buttonClasses,
      ariaSelected,
      dataState,
      iconClasses: activeIconSpan?.className,
      textClasses: activeTextSpan?.className
    });
  }

  /**
   * Setup MutationObserver to detect React state changes (replaces invasive click handlers)
   */
  setupReactStateObserver() {
    // Create observer to monitor tab state changes
    this.tabStateObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Only process attribute changes
        if (mutation.type !== 'attributes') return;

        const target = mutation.target;

        // Check if this is an h2 element that could be a tab
        if (target.tagName === 'H2') {
          const text = target.textContent?.trim();
          const isTabElement = text === 'Chapters' || text === 'Transcript' || text === 'Comments';

          if (isTabElement) {
            console.log('🔍 Tab state change detected:', text, mutation.attributeName);

            // Check if this tab became active (React changed aria-selected or other attributes)
            this.handleTabStateChange(target);
          }
        }

        // Also monitor class changes on content divs for animation states
        if (target.classList && (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
          this.handleContentAnimationChange(target);
        }
      });
    });

    // Start observing the document for attribute changes
    const observeTarget = document.body;

    this.tabStateObserver.observe(observeTarget, {
      attributes: true,
      attributeFilter: ['aria-selected', 'data-state', 'class', 'style'],
      subtree: true
    });

    // Also monitor for DOM structure changes (SPA navigation)
    this.structureObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if tab structure changed (SPA navigation)
          this.handleStructureChange();
        }
      });
    });

    this.structureObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('✅ React state observer setup complete');
  }

  /**
   * Handle tab state changes detected by MutationObserver
   */
  handleTabStateChange(tabElement) {
    const text = tabElement.textContent?.trim();
    const isActive = tabElement.getAttribute('aria-selected') === 'true' ||
                    tabElement.getAttribute('data-state') === 'active' ||
                    tabElement.classList.contains('active');

    if (isActive && text !== 'Webhook') {
      // Another tab became active - hide webhook content
      console.log(`🔄 ${text} tab activated by React - hiding webhook content`);
      this.hideWebhookContent();
    }
  }

  /**
   * Handle content animation changes
   */
  handleContentAnimationChange(element) {
    // Monitor for animation classes that indicate content switching
    if (element.classList.contains('animate-slideDownAndFade') ||
        element.classList.contains('slideDownAndFade')) {

      // Check if this is not our webhook content
      if (!element.closest('#tella-webhook-panel')) {
        // Tella content is animating in - ensure webhook content is hidden
        this.manageContentVisibility();
      }
    }
  }

  /**
   * Handle structure changes (SPA navigation)
   */
  handleStructureChange() {
    // Debounce structure changes to avoid excessive processing
    clearTimeout(this.structureChangeTimeout);
    this.structureChangeTimeout = setTimeout(() => {
      // Check if our webhook tab is still in the DOM by ID (more reliable)
      const existingTab = document.getElementById('tella-webhook-tab');
      
      // Only trigger re-injection if:
      // 1. We had a tab reference AND
      // 2. It's no longer in the DOM AND
      // 3. There's no existing tab with that ID
      if (this.webhookTab && !existingTab) {
        console.log('🔄 Structure change detected - webhook tab disconnected');
        // Tab was removed, trigger re-injection
        this.injectionAttempts = 0;
        this.webhookTab = null;
        this.webhookPanel = null;
        setTimeout(() => this.findAndInjectSidebar(), 1000);
      } else if (existingTab && existingTab !== this.webhookTab) {
        // Tab exists but our reference is stale - update it
        console.log('🔄 Updating stale webhook tab reference');
        this.webhookTab = existingTab;
      }
    }, 1000); // Increased debounce to 1 second
  }

  /**
   * Switch to webhook tab using React-aware integration
   */
  switchToWebhookTab() {
    console.log('🔄 Switching to webhook tab using React integration');

    // Hide all other content panels first
    this.hideAllContentPanels();

    // Show our webhook content with proper Tella animations
    if (this.webhookPanel) {
      this.webhookPanel.classList.remove('hidden');
      this.webhookPanel.classList.add('animate-slideDownAndFade');

      console.log('✅ Webhook content shown with Tella animations');
    }

    // Set webhook tab as active with proper styling
    this.setWebhookTabActive();

    // Mark all other button tabs as inactive
    this.setOtherTabsInactive();

    // Trigger webhook interface initialization
    this.triggerWebhookActivation();
  }

  /**
   * Hide webhook content with React-aware approach
   */
  hideWebhookContent() {
    if (this.webhookPanel) {
      // Add Tella's fade-out animation before hiding
      this.webhookPanel.classList.remove('animate-slideDownAndFade');

      // Use a small delay to allow animation to complete
      setTimeout(() => {
        this.webhookPanel.classList.add('hidden');
        console.log('✅ Webhook content hidden with smooth transition');
      }, 150);
    }

    // Reset webhook tab to inactive styling
    if (this.webhookTab) {
      this.setWebhookTabInactive();
    }
  }

  /**
   * Set webhook tab to active styling by copying from any currently active native tab
   */
  setWebhookTabActive() {
    if (!this.webhookTab) return;

    // Find the currently active native tab to copy its styling
    const activeNativeTab = [this.chaptersButton, this.transcriptButton, this.commentsButton]
      .filter(Boolean)
      .find(button => this.checkIfTabIsActive(button));

    if (activeNativeTab) {
      // Copy styling from the currently active native tab
      this.copyActiveTabStyling(activeNativeTab);
    } else {
      // Fallback: apply generic active styling
      this.applyGenericActiveTabStyling();
    }

    // Set basic active attributes
    this.webhookTab.setAttribute('aria-selected', 'true');
    this.webhookTab.setAttribute('data-state', 'active');

    console.log('✅ Webhook tab set to active styling');
  }

  /**
   * Set webhook tab to inactive styling
   */
  setWebhookTabInactive() {
    if (!this.webhookTab) return;

    // Reset to original inactive styling
    const webhookIconSpan = this.webhookTab.querySelector('span:first-child');
    const webhookTextSpan = this.webhookTab.querySelector('span:last-child');

    if (webhookIconSpan) {
      webhookIconSpan.className = 'text-slate-400 dark:text-gray-400 group-hover:text-slate-900 dark:text-gray-100 dark:text-gray-400 dark:group-hover:text-gray-100';
    }

    if (webhookTextSpan) {
      webhookTextSpan.className = 'hidden sm:hidden lg:hidden group-hover:text-slate-900 dark:group-hover:text-gray-100 text-slate-400 dark:text-gray-400';
    }

    // Reset basic attributes
    this.webhookTab.setAttribute('aria-selected', 'false');
    this.webhookTab.setAttribute('data-state', 'inactive');
    this.webhookTab.classList.remove('active');

    console.log('✅ Webhook tab reset to inactive styling');
  }

  /**
   * Apply generic active tab styling if no active native tab is found
   */
  applyGenericActiveTabStyling() {
    if (!this.webhookTab) return;

    const webhookIconSpan = this.webhookTab.querySelector('span:first-child');
    const webhookTextSpan = this.webhookTab.querySelector('span:last-child');

    if (webhookIconSpan) {
      // Apply active icon styling (similar to Comments active state)
      webhookIconSpan.className = 'text-brand-800 dark:text-brand-400';
    }

    if (webhookTextSpan) {
      // Apply active text styling
      webhookTextSpan.className = 'hidden sm:hidden lg:hidden group-hover:text-slate-900 dark:group-hover:text-gray-100 text-slate-800 dark:text-gray-100';
    }

    console.log('✅ Applied generic active styling to webhook tab');
  }

  /**
   * Set other button tabs as inactive without interfering with their content
   */
  setOtherTabsInactive() {
    // Set other tabs (buttons) to inactive
    if (this.chaptersButton) this.removeTabActiveState(this.chaptersButton);
    if (this.transcriptButton) this.removeTabActiveState(this.transcriptButton);
    if (this.commentsButton) this.removeTabActiveState(this.commentsButton);

    console.log('✅ Other button tabs set to inactive state');
  }

  /**
   * Hide all content panels (Chapters, Transcript, Comments) when switching to webhook
   */
  hideAllContentPanels() {
    // Find content panels by looking for elements with animate-slideDownAndFade or hidden classes
    // These will be siblings of our webhook panel
    if (this.webhookPanel && this.webhookPanel.parentElement) {
      const contentContainer = this.webhookPanel.parentElement;
      const allContentPanels = contentContainer.children;

      for (let panel of allContentPanels) {
        // Skip our webhook panel
        if (panel === this.webhookPanel) continue;

        // Hide any panel that has animation class or is visible
        if (panel.classList.contains('animate-slideDownAndFade') ||
            !panel.classList.contains('hidden')) {
          panel.classList.remove('animate-slideDownAndFade');
          panel.classList.add('hidden');
        }
      }
    }

    console.log('✅ All content panels hidden');
  }

  /**
   * React-aware content visibility management
   * This respects Tella's state management instead of overriding it
   */
  manageContentVisibility() {
    // This method is called when we need to ensure proper content display
    // Instead of hiding all content invasively, we work with React's state

    // Check if webhook tab is active
    const webhookIsActive = this.webhookTab &&
                           this.webhookTab.getAttribute('aria-selected') === 'true';

    if (webhookIsActive) {
      // Show webhook content if it's hidden
      if (this.webhookPanel && this.webhookPanel.classList.contains('hidden')) {
        this.webhookPanel.classList.remove('hidden');
        this.webhookPanel.classList.add('animate-slideDownAndFade');
      }
    } else {
      // Hide webhook content if it's shown
      if (this.webhookPanel && !this.webhookPanel.classList.contains('hidden')) {
        this.hideWebhookContent();
      }
    }
  }

  /**
   * Set tab as active and remove active from others
   */
  setTabActive(activeTab) {
    // Remove active state from all tabs (using correct button references)
    [this.chaptersButton, this.transcriptButton, this.commentsButton, this.webhookTab].forEach(btn => {
      if (btn) {
        this.removeTabActiveState(btn);
      }
    });

    // Set active tab
    if (activeTab) {
      activeTab.classList.add('active');
      activeTab.setAttribute('active', '');
      activeTab.setAttribute('aria-selected', 'true');
      activeTab.setAttribute('data-state', 'active');
      console.log('✅ Tab set as active:', activeTab);
    }
  }

  /**
   * Remove active state from a tab
   */
  removeTabActiveState(tab) {
    tab.classList.remove('active');
    tab.removeAttribute('active');
    tab.setAttribute('aria-selected', 'false');
    tab.setAttribute('data-state', 'inactive');
  }

  /**
   * Trigger webhook activation event
   */
  triggerWebhookActivation() {
    const event = new CustomEvent('webhookTabActivated', {
      detail: {
        tab: this.webhookTab,
        panel: this.webhookPanel
      }
    });
    document.dispatchEvent(event);
    console.log('📡 Webhook activation event triggered');
  }

  /**
   * Setup mutation observer for SPA navigation
   */
  setupNavigationObserver() {
    // Track URL separately to avoid false positives
    this.lastObservedUrl = window.location.href;
    this.reinjectTimeout = null;

    const observer = new MutationObserver((mutations) => {
      // Debounce checks
      clearTimeout(this.reinjectTimeout);
      this.reinjectTimeout = setTimeout(() => {
        // Only process if we're on a video page
        const currentUrl = window.location.href;
        const isVideoPage = currentUrl.includes('/video/') && currentUrl.includes('/view') ||
                           currentUrl.includes('/watch/') ||
                           currentUrl.includes('/recordings/');
        
        if (!isVideoPage) {
          // Not on a video page, don't do anything
          return;
        }

        let needsReinject = false;

        // Check if webhook tab was actually removed (not just React updating)
        const existingTab = document.getElementById('tella-webhook-tab');
        if (!existingTab || !existingTab.isConnected) {
          // Only reinject if we previously had a tab
          if (this.webhookTab) {
            console.log('🔄 Webhook tab was removed from DOM');
            needsReinject = true;
          }
        }

        // Check if URL actually changed (SPA navigation) and we're moving between video pages
        if (this.lastObservedUrl && this.lastObservedUrl !== currentUrl) {
          const wasVideoPage = this.lastObservedUrl.includes('/video/') && this.lastObservedUrl.includes('/view');
          if (wasVideoPage && isVideoPage) {
            console.log('🔄 URL changed between video pages:', this.lastObservedUrl, '→', currentUrl);
            this.lastObservedUrl = currentUrl;
            needsReinject = true;
          } else {
            // Just update the URL, don't reinject
            this.lastObservedUrl = currentUrl;
          }
        }

        if (needsReinject && !this.isInjecting) {
          console.log('🔄 Re-injection needed due to page changes');
          this.injectionAttempts = 0; // Reset attempts
          this.webhookTab = null; // Clear reference
          this.webhookPanel = null; // Clear reference
          setTimeout(() => this.findAndInjectSidebar(), 2000);
        }
      }, 1000); // Debounce for 1 second
    });

    // Only observe body-level changes, not all subtree changes
    observer.observe(document.body, {
      childList: true,
      subtree: false // Don't watch all subtree changes
    });

    // Also watch for URL changes via popstate (back/forward) and pushstate
    window.addEventListener('popstate', () => {
      const currentUrl = window.location.href;
      if (this.lastObservedUrl !== currentUrl) {
        console.log('🔄 URL changed via popstate');
        this.lastObservedUrl = currentUrl;
        this.injectionAttempts = 0;
        this.webhookTab = null;
        this.webhookPanel = null;
        setTimeout(() => this.findAndInjectSidebar(), 2000);
      }
    });

    console.log('🔍 Navigation observer setup complete');
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if webhook tab is currently active
   */
  isActive() {
    return this.webhookTab &&
           this.webhookTab.isConnected &&
           this.webhookTab.getAttribute('aria-selected') === 'true';
  }

  /**
   * Get reference to webhook panel
   */
  getWebhookPanel() {
    return this.webhookPanel;
  }

  /**
   * Cleanup method with observer disposal
   */
  destroy() {
    // Clean up DOM elements
    if (this.webhookTab && this.webhookTab.isConnected) {
      this.webhookTab.remove();
    }

    if (this.webhookPanel && this.webhookPanel.isConnected) {
      this.webhookPanel.remove();
    }

    // Clean up MutationObservers
    if (this.tabStateObserver) {
      this.tabStateObserver.disconnect();
      this.tabStateObserver = null;
      console.log('🧹 Tab state observer disconnected');
    }

    if (this.structureObserver) {
      this.structureObserver.disconnect();
      this.structureObserver = null;
      console.log('🧹 Structure observer disconnected');
    }

    // Clear timeouts
    if (this.structureChangeTimeout) {
      clearTimeout(this.structureChangeTimeout);
      this.structureChangeTimeout = null;
    }

    // Remove custom styles
    const customStyles = document.querySelector('#tella-webhook-tab-styles');
    if (customStyles) {
      customStyles.remove();
    }

    // Clear references
    this.sidebarContainer = null;
    this.webhookTab = null;
    this.webhookPanel = null;
    this.chaptersH2 = null;
    this.transcriptH2 = null;
    this.commentsH2 = null;
    this.nativeTabs = null;

    console.log('🧹 Sidebar injector fully cleaned up');
  }
}

// Export for use in other files
window.TellaSidebarInjector = TellaSidebarInjector;