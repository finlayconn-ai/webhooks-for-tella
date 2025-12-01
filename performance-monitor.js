/**
 * Tella Extension Performance Monitor
 * Tracks performance metrics and optimizations
 */

class TellaPerformanceMonitor {
  constructor() {
    this.metrics = {
      initialization: {},
      sidebarInjection: {},
      webhookOperations: {},
      domOperations: {},
      memoryUsage: []
    };

    this.observers = new Map();
    this.timers = new Map();
    this.isMonitoring = true;

    console.log('📊 TellaPerformanceMonitor initialized');
    this.startMonitoring();
  }

  /**
   * Start performance monitoring
   */
  startMonitoring() {
    // Monitor page load performance
    this.trackPageLoadPerformance();

    // Monitor memory usage periodically
    this.startMemoryMonitoring();

    // Setup performance observer for long tasks
    this.setupLongTaskObserver();

    // Setup mutation observer for DOM changes
    this.setupDOMChangeObserver();
  }

  /**
   * Track page load performance
   */
  trackPageLoadPerformance() {
    try {
      const navigation = performance.getEntriesByType('navigation')[0];
      if (navigation) {
        this.metrics.initialization = {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
          loadComplete: navigation.loadEventEnd - navigation.navigationStart,
          domInteractive: navigation.domInteractive - navigation.navigationStart,
          timestamp: Date.now()
        };

        console.log('📊 Page load performance:', this.metrics.initialization);
      }
    } catch (error) {
      console.warn('⚠️ Could not track page load performance:', error);
    }
  }

  /**
   * Start memory monitoring
   */
  startMemoryMonitoring() {
    const checkMemory = () => {
      try {
        if (performance.memory) {
          const memoryInfo = {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit,
            timestamp: Date.now()
          };

          this.metrics.memoryUsage.push(memoryInfo);

          // Keep only last 20 memory samples
          if (this.metrics.memoryUsage.length > 20) {
            this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-20);
          }

          // Warn if memory usage is high (increased threshold to 100MB for production)
          const usedMB = memoryInfo.used / (1024 * 1024);
          if (usedMB > 100) {
            console.warn('⚠️ High memory usage:', usedMB.toFixed(2) + 'MB');
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not track memory usage:', error);
      }
    };

    // Check memory every 30 seconds
    checkMemory();
    setInterval(checkMemory, 30000);
  }

  /**
   * Setup long task observer
   */
  setupLongTaskObserver() {
    try {
      if ('PerformanceObserver' in window) {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 200) { // Tasks longer than 200ms (increased threshold for production)
              console.warn(`⚠️ Long task detected: ${entry.duration}ms`);

              // Track in metrics
              if (!this.metrics.longTasks) {
                this.metrics.longTasks = [];
              }

              this.metrics.longTasks.push({
                duration: entry.duration,
                startTime: entry.startTime,
                timestamp: Date.now()
              });

              // Keep only last 10 long tasks
              if (this.metrics.longTasks.length > 10) {
                this.metrics.longTasks = this.metrics.longTasks.slice(-10);
              }
            }
          }
        });

        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.set('longtask', longTaskObserver);
      }
    } catch (error) {
      console.warn('⚠️ Could not setup long task observer:', error);
    }
  }

  /**
   * Setup DOM change observer for performance impact
   */
  setupDOMChangeObserver() {
    try {
      let domChangeCount = 0;
      let lastDOMChangeTime = Date.now();

      const domObserver = new MutationObserver((mutations) => {
        domChangeCount += mutations.length;

        const now = Date.now();
        if (now - lastDOMChangeTime > 1000) { // Every second
          if (domChangeCount > 100) {
            console.warn(`⚠️ High DOM mutation rate: ${domChangeCount} changes/second`);
          }

          domChangeCount = 0;
          lastDOMChangeTime = now;
        }
      });

      domObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true
      });

      this.observers.set('dom', domObserver);
    } catch (error) {
      console.warn('⚠️ Could not setup DOM change observer:', error);
    }
  }

  /**
   * Start timing an operation
   */
  startTimer(operation, category = 'general') {
    const timerKey = `${category}_${operation}`;
    this.timers.set(timerKey, {
      start: performance.now(),
      category,
      operation
    });

    return timerKey;
  }

  /**
   * End timing an operation
   */
  endTimer(timerKey, details = {}) {
    const timer = this.timers.get(timerKey);
    if (!timer) {
      console.warn('⚠️ Timer not found:', timerKey);
      return null;
    }

    const duration = performance.now() - timer.start;
    this.timers.delete(timerKey);

    // Store in metrics
    if (!this.metrics[timer.category]) {
      this.metrics[timer.category] = {};
    }

    if (!this.metrics[timer.category][timer.operation]) {
      this.metrics[timer.category][timer.operation] = [];
    }

    const metric = {
      duration,
      timestamp: Date.now(),
      ...details
    };

    this.metrics[timer.category][timer.operation].push(metric);

    // Keep only last 10 measurements per operation
    if (this.metrics[timer.category][timer.operation].length > 10) {
      this.metrics[timer.category][timer.operation] =
        this.metrics[timer.category][timer.operation].slice(-10);
    }

    // Log slow operations
    if (duration > 100) {
      console.warn(`⚠️ Slow operation: ${timer.operation} took ${duration.toFixed(2)}ms`);
    } else if (duration > 10) {
      console.log(`📊 Operation: ${timer.operation} took ${duration.toFixed(2)}ms`);
    }

    return metric;
  }

  /**
   * Track sidebar injection performance
   */
  trackSidebarInjection(phase, details = {}) {
    const timerKey = this.startTimer(`injection_${phase}`, 'sidebarInjection');

    return {
      end: (success = true, additionalDetails = {}) => {
        return this.endTimer(timerKey, {
          success,
          phase,
          ...details,
          ...additionalDetails
        });
      }
    };
  }

  /**
   * Track webhook operation performance
   */
  trackWebhookOperation(operation, details = {}) {
    const timerKey = this.startTimer(operation, 'webhookOperations');

    return {
      end: (success = true, additionalDetails = {}) => {
        return this.endTimer(timerKey, {
          success,
          operation,
          ...details,
          ...additionalDetails
        });
      }
    };
  }

  /**
   * Track DOM operation performance
   */
  trackDOMOperation(operation, elementCount = 0) {
    const timerKey = this.startTimer(operation, 'domOperations');

    return {
      end: (success = true, additionalDetails = {}) => {
        return this.endTimer(timerKey, {
          success,
          elementCount,
          ...additionalDetails
        });
      }
    };
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const summary = {
      timestamp: new Date().toISOString(),
      initialization: this.metrics.initialization,
      averages: {},
      totals: {},
      warnings: []
    };

    // Calculate averages for each category
    Object.keys(this.metrics).forEach(category => {
      if (category === 'initialization' || category === 'memoryUsage') return;

      summary.averages[category] = {};
      summary.totals[category] = {};

      Object.keys(this.metrics[category]).forEach(operation => {
        const measurements = this.metrics[category][operation];
        if (measurements.length > 0) {
          const durations = measurements.map(m => m.duration);
          const average = durations.reduce((a, b) => a + b, 0) / durations.length;
          const total = durations.reduce((a, b) => a + b, 0);

          summary.averages[category][operation] = Math.round(average * 100) / 100;
          summary.totals[category][operation] = Math.round(total * 100) / 100;

          // Add warnings for slow operations
          if (average > 100) {
            summary.warnings.push(`Slow operation: ${category}.${operation} averages ${average.toFixed(2)}ms`);
          }
        }
      });
    });

    // Memory analysis
    if (this.metrics.memoryUsage.length > 0) {
      const latest = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
      const usedMB = latest.used / (1024 * 1024);

      summary.memory = {
        currentUsageMB: Math.round(usedMB * 100) / 100,
        totalMB: Math.round((latest.total / (1024 * 1024)) * 100) / 100,
        limitMB: Math.round((latest.limit / (1024 * 1024)) * 100) / 100
      };

      if (usedMB > 50) {
        summary.warnings.push(`High memory usage: ${usedMB.toFixed(2)}MB`);
      }
    }

    // Long tasks analysis
    if (this.metrics.longTasks && this.metrics.longTasks.length > 0) {
      const recentLongTasks = this.metrics.longTasks.filter(task =>
        Date.now() - task.timestamp < 300000 // Last 5 minutes
      );

      if (recentLongTasks.length > 0) {
        summary.warnings.push(`${recentLongTasks.length} long tasks detected in last 5 minutes`);
      }
    }

    return summary;
  }

  /**
   * Check cross-browser compatibility
   */
  checkBrowserCompatibility() {
    const compatibility = {
      timestamp: new Date().toISOString(),
      features: {},
      warnings: [],
      score: 0,
      maxScore: 0
    };

    // Essential features
    const features = [
      { name: 'chrome.runtime', check: () => !!chrome?.runtime, essential: true },
      { name: 'chrome.storage', check: () => !!chrome?.storage, essential: true },
      { name: 'chrome.tabs', check: () => !!chrome?.tabs, essential: true },
      { name: 'fetch', check: () => !!window.fetch, essential: true },
      { name: 'Promise', check: () => !!window.Promise, essential: true },
      { name: 'MutationObserver', check: () => !!window.MutationObserver, essential: true },
      { name: 'querySelector', check: () => !!document.querySelector, essential: true },
      { name: 'addEventListener', check: () => !!document.addEventListener, essential: true },
      { name: 'JSON', check: () => !!window.JSON, essential: true },
      { name: 'localStorage', check: () => !!window.localStorage, essential: false },
      { name: 'performance.now', check: () => !!performance?.now, essential: false },
      { name: 'performance.memory', check: () => !!performance?.memory, essential: false },
      { name: 'PerformanceObserver', check: () => !!window.PerformanceObserver, essential: false },
      { name: 'requestAnimationFrame', check: () => !!window.requestAnimationFrame, essential: false }
    ];

    features.forEach(feature => {
      compatibility.maxScore += feature.essential ? 2 : 1;

      try {
        const supported = feature.check();
        compatibility.features[feature.name] = supported;

        if (supported) {
          compatibility.score += feature.essential ? 2 : 1;
        } else if (feature.essential) {
          compatibility.warnings.push(`Missing essential feature: ${feature.name}`);
        } else {
          compatibility.warnings.push(`Missing optional feature: ${feature.name}`);
        }
      } catch (error) {
        compatibility.features[feature.name] = false;
        compatibility.warnings.push(`Error checking ${feature.name}: ${error.message}`);
      }
    });

    // Calculate compatibility percentage
    compatibility.compatibilityPercentage = Math.round((compatibility.score / compatibility.maxScore) * 100);

    return compatibility;
  }

  /**
   * Optimize performance
   */
  optimizePerformance() {
    console.log('🚀 Running performance optimizations...');

    // Debounce rapid DOM queries
    this.setupQueryDebouncing();

    // Optimize event listeners
    this.optimizeEventListeners();

    // Clean up unused timers
    this.cleanupTimers();

    console.log('✅ Performance optimizations applied');
  }

  /**
   * Setup query debouncing for repeated DOM operations
   */
  setupQueryDebouncing() {
    // Override querySelector for performance monitoring
    const originalQuery = document.querySelector.bind(document);
    const originalQueryAll = document.querySelectorAll.bind(document);

    let queryCount = 0;
    let lastQueryTime = Date.now();

    document.querySelector = function(selector) {
      queryCount++;

      const now = Date.now();
      if (now - lastQueryTime > 1000) {
        if (queryCount > 50) {
          console.warn(`⚠️ High DOM query rate: ${queryCount} queries/second`);
        }
        queryCount = 0;
        lastQueryTime = now;
      }

      return originalQuery(selector);
    };

    document.querySelectorAll = function(selector) {
      queryCount++;
      return originalQueryAll(selector);
    };
  }

  /**
   * Optimize event listeners
   */
  optimizeEventListeners() {
    // Use passive listeners where appropriate
    const passiveOptions = { passive: true };

    // Override addEventListener for scroll and touch events
    const originalAddEventListener = EventTarget.prototype.addEventListener;

    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (['scroll', 'touchstart', 'touchmove', 'wheel'].includes(type)) {
        if (typeof options === 'boolean') {
          options = { capture: options, passive: true };
        } else if (typeof options === 'object') {
          options = { ...options, passive: true };
        } else {
          options = passiveOptions;
        }
      }

      return originalAddEventListener.call(this, type, listener, options);
    };
  }

  /**
   * Clean up unused timers
   */
  cleanupTimers() {
    const now = Date.now();
    const staleTimers = [];

    for (const [key, timer] of this.timers) {
      // Remove timers older than 5 minutes
      if (now - (timer.start + performance.timing.navigationStart) > 300000) {
        staleTimers.push(key);
      }
    }

    staleTimers.forEach(key => this.timers.delete(key));

    if (staleTimers.length > 0) {
      console.log(`🧹 Cleaned up ${staleTimers.length} stale timers`);
    }
  }

  /**
   * Cleanup and stop monitoring
   */
  cleanup() {
    this.isMonitoring = false;

    // Disconnect observers
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (error) {
        console.warn('⚠️ Error disconnecting observer:', error);
      }
    });

    this.observers.clear();
    this.timers.clear();

    console.log('🧹 Performance monitor cleaned up');
  }

  /**
   * Destroy method (alias for cleanup) for consistency
   */
  destroy() {
    this.cleanup();
  }
}

// Export for use in other files
window.TellaPerformanceMonitor = TellaPerformanceMonitor;

// Initialize performance monitor
if (!window.tellaPerformanceMonitor) {
  window.tellaPerformanceMonitor = new TellaPerformanceMonitor();
}