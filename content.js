// Content script for extracting data from Tella.tv pages

class TellaDataExtractor {
  constructor() {
    this.data = {};
    this.isRecordingPage = this.detectRecordingPage();
    this.storyId = this.extractStoryId();
  }

  extractStoryId() {
    // Extract story ID from URL
    const url = window.location.href;
    const patterns = [
      /\/video\/([a-zA-Z0-9]+)\/view/,
      /\/video\/([a-zA-Z0-9]+)/,
      /\/stories\/([a-zA-Z0-9]+)/,
      /\/watch\/([a-zA-Z0-9]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        console.log('✅ Story ID extracted:', match[1]);
        return match[1];
      }
    }

    console.log('❌ Could not extract story ID from URL:', url);
    return null;
  }

  async extractFromAPI() {
    if (!this.storyId) {
      console.log('❌ No story ID available for API extraction');
      return null;
    }

    try {
      console.log('🔍 Attempting API extraction for story:', this.storyId);

      // Try to extract from document endpoint
      const documentData = await this.fetchDocumentData();
      if (documentData) {
        console.log('✅ Document data retrieved, fetching transcriptions...');

        // Also fetch transcription data
        const transcriptionData = await this.fetchTranscriptionData();

        console.log('✅ API extraction successful');
        return this.parseDocumentData(documentData, transcriptionData);
      }

    } catch (error) {
      console.error('❌ API extraction failed:', error);
    }

    return null;
  }

  async fetchDocumentData() {
    const documentUrl = `/api/stories/${this.storyId}/document`;

    try {
      console.log('📡 Fetching document data:', documentUrl);
      const response = await fetch(documentUrl);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Document data retrieved');
        return data;
      } else {
        console.error('❌ Document API failed:', response.status);
        return null;
      }
    } catch (error) {
      console.error('❌ Document fetch error:', error);
      return null;
    }
  }

  async fetchTranscriptionData() {
    const transcriptionUrl = `/api/stories/${this.storyId}/transcriptions`;

    try {
      console.log('📡 Fetching transcription data:', transcriptionUrl);
      const response = await fetch(transcriptionUrl);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Transcription data retrieved');
        return data;
      } else {
        console.log('⚠️ Transcription API failed (may not be available):', response.status);
        return null;
      }
    } catch (error) {
      console.log('⚠️ Transcription fetch error (may not be available):', error);
      return null;
    }
  }

  parseDocumentData(data, transcriptionData = null) {
    console.log('🔍 Parsing comprehensive document data');
    console.log('📊 Raw document data:', JSON.stringify(data, null, 2));
    console.log('📊 Raw transcription data:', JSON.stringify(transcriptionData, null, 2));

    // Parse transcription data if available
    const transcriptionInfo = this.parseTranscriptionData(transcriptionData);

    // Extract story data from nested structure
    const story = data.story || data;

    console.log('🔍 Available story fields:', Object.keys(story));
    console.log('📖 Looking for chapters in:', {
      chapters: story.chapters,
      scenes: story.scenes,
      sceneIDs: story.sceneIDs,
      segments: story.segments,
      timeline: story.timeline
    });

    const extractedData = {
      // Core video information
      video: {
        id: story.id || this.storyId,
        title: story.name || null,
        description: story.description || '',
        url: story.url || window.location.href,
        dimensions: story.dimensions || null,
        views: story.views || 0
      },

      // Timing and date information
      timing: {
        duration: (() => {
          console.log('🕒 About to format duration. Raw value:', story.duration, 'Type:', typeof story.duration);
          const formatted = this.formatDuration(story.duration);
          console.log('🕒 Duration formatted result:', formatted);
          return formatted;
        })(), // Duration in seconds
        durationMs: story.duration || null, // Keep original milliseconds
        createdAt: story.createdAt || null,
        updatedAt: story.updatedAt || null,
        lastSeen: story.lastSeen || null
      },

      // Content structure
      content: {
        chapters: this.parseChapters(story.chapters),
        transcription: transcriptionInfo
      },

      // Extraction metadata
      metadata: {
        extractedAt: new Date().toISOString(),
        pageUrl: window.location.href,
        extractionMethod: 'api',
        extensionVersion: chrome?.runtime?.getManifest?.()?.version || 'unknown'
      }
    };

    // Remove null/undefined values but keep empty strings and 0 values (recursive cleanup)
    function cleanObject(obj) {
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (value === null || value === undefined) {
          delete obj[key];
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          cleanObject(value);
          // Remove empty objects after cleaning
          if (Object.keys(value).length === 0) {
            delete obj[key];
          }
        }
      });
      return obj;
    }

    cleanObject(extractedData);

    console.log('✅ Comprehensive data parsed:', extractedData);
    return extractedData;
  }

  parseTranscriptionData(transcriptionData) {
    if (!transcriptionData) {
      console.log('📝 No transcription data available');
      return {};
    }

    console.log('📝 Parsing transcription data');

    const result = {};

    // Parse transcription metadata
    if (transcriptionData.transcriptions) {
      result.transcriptionMetadata = transcriptionData.transcriptions;

      // Extract transcription status and details
      if (Array.isArray(transcriptionData.transcriptions) && transcriptionData.transcriptions.length > 1) {
        result.transcriptionStatus = transcriptionData.transcriptions[0] || 'Unknown';
        result.transcriptionDetails = transcriptionData.transcriptions[1] || [];
      }
    }

    // Parse word-level transcript data - handle nested structure
    let words = null;

    // Try different nested structures for words
    if (transcriptionData.words && Array.isArray(transcriptionData.words)) {
      words = transcriptionData.words;
    } else if (transcriptionData.transcriptions && Array.isArray(transcriptionData.transcriptions) && transcriptionData.transcriptions.length > 1) {
      // Structure: transcriptions[1][0].words
      const transcriptionDetails = transcriptionData.transcriptions[1];
      if (Array.isArray(transcriptionDetails) && transcriptionDetails.length > 0) {
        words = transcriptionDetails[0].words;
      }
    }

    if (words && Array.isArray(words)) {
      console.log(`📝 Found ${words.length} transcript words`);
      result.transcriptionWords = words;
      result.transcript = this.formatTranscriptFromWords(words);
      result.transcriptWordCount = words.length;
      result.transcriptDurationMs = this.calculateTranscriptDuration(words);
    } else {
      console.log('❌ No transcript words found in expected structure');
    }

    return result;
  }

  formatTranscriptFromWords(words) {
    if (!words || !Array.isArray(words)) {
      return '';
    }

    // Filter out hidden words and join text
    const visibleWords = words
      .filter(word => !word.hidden && word.text)
      .map(word => word.text.trim())
      .filter(text => text.length > 0);

    return visibleWords.join(' ');
  }

  calculateTranscriptDuration(words) {
    if (!words || words.length === 0) {
      return 0;
    }

    // Find the last word's end time
    const lastWord = words[words.length - 1];
    return lastWord.end_ || 0;
  }

  getTranscriptSegmentsByTimestamp(words, segmentDurationMs = 30000) {
    if (!words || !Array.isArray(words)) {
      return [];
    }

    const segments = [];
    let currentSegment = {
      startMs: 0,
      endMs: 0,
      text: '',
      words: []
    };

    for (const word of words) {
      if (word.hidden) continue;

      // Start new segment if duration exceeded
      if (word.start - currentSegment.startMs > segmentDurationMs && currentSegment.words.length > 0) {
        currentSegment.endMs = currentSegment.words[currentSegment.words.length - 1].end_;
        currentSegment.text = currentSegment.words.map(w => w.text).join(' ');
        segments.push(currentSegment);

        currentSegment = {
          startMs: word.start,
          endMs: word.end_,
          text: '',
          words: []
        };
      }

      if (currentSegment.words.length === 0) {
        currentSegment.startMs = word.start;
      }

      currentSegment.words.push(word);
    }

    // Add final segment
    if (currentSegment.words.length > 0) {
      currentSegment.endMs = currentSegment.words[currentSegment.words.length - 1].end_;
      currentSegment.text = currentSegment.words.map(w => w.text).join(' ');
      segments.push(currentSegment);
    }

    return segments;
  }

  parseChapters(chapters) {
    console.log('📖 Parsing chapters:', chapters, 'Type:', typeof chapters, 'IsArray:', Array.isArray(chapters));

    if (!chapters) {
      console.log('❌ No chapters data provided');
      return [];
    }

    if (!Array.isArray(chapters)) {
      console.log('❌ Chapters is not an array:', chapters);
      return [];
    }

    if (chapters.length === 0) {
      console.log('❌ Chapters array is empty');
      return [];
    }

    console.log(`📖 Processing ${chapters.length} chapters`);
    return chapters.map((chapter, index) => {
      console.log(`📖 Chapter ${index}:`, chapter);
      return {
        id: chapter.id || null,
        timestamp: chapter.timestamp || 0,
        timestampFormatted: this.formatTimestamp(chapter.timestamp || 0),
        title: chapter.title || '',
        description: chapter.description || ''
      };
    });
  }

  formatDuration(input) {
    console.log('⏱️ [START] Formatting duration:', input, 'Type:', typeof input);

    try {
      // Handle different input types and convert to number
      let value = null;

      if (typeof input === 'number' && !isNaN(input)) {
        value = input;
      } else if (typeof input === 'string' && !isNaN(parseFloat(input))) {
        value = parseFloat(input);
      } else if (input && input.duration) {
        return this.formatDuration(input.duration);
      }

      if (!value || value <= 0) {
        console.log('❌ Invalid duration value:', input);
        return null;
      }

      // Auto-detect if input is seconds or milliseconds
      // Values > 10000 are likely milliseconds, smaller values are likely seconds
      let totalSeconds;
      if (value > 10000) {
        console.log('⏱️ Detected milliseconds, converting to seconds...');
        totalSeconds = Math.floor(value / 1000);
      } else {
        console.log('⏱️ Detected seconds, using directly...');
        totalSeconds = Math.floor(value);
      }

      console.log('⏱️ [END] Returning total seconds:', totalSeconds);
      return totalSeconds;

    } catch (error) {
      console.error('❌ [ERROR] Duration formatting failed:', error);
      return null;
    }
  }

  formatTimestamp(seconds) {
    if (typeof seconds !== 'number') {
      return '0:00';
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  detectRecordingPage() {
    // Check if we're on a Tella recording page
    const url = window.location.href;
    return url.includes('/watch/') || url.includes('/recordings/') ||
           document.querySelector('[data-testid="video-player"]') !== null ||
           document.querySelector('.video-container') !== null;
  }

  extractTitle() {
    // Get title from document.title (most reliable for Tella)
    const pageTitle = document.title;
    if (pageTitle && pageTitle !== 'Tella') {
      let title = pageTitle.replace(' — Tella', '').trim();
      if (title.length > 0) {
        return title;
      }
    }

    // Fallback to input/textbox elements
    const inputs = document.querySelectorAll('input[type="text"], textbox');
    for (const input of inputs) {
      const value = input.value || input.textContent;
      if (value && value.trim().length > 10) {
        return value.trim();
      }
    }

    // Final fallback to h1 elements
    const h1s = document.querySelectorAll('h1');
    for (const h1 of h1s) {
      if (h1.textContent && h1.textContent.trim().length > 5) {
        return h1.textContent.trim();
      }
    }

    return null;
  }

  extractTranscript() {
    // Try to find clean transcript text first
    let transcript = this.extractCleanTranscript();

    if (!transcript) {
      // Try to expand transcript if collapsed
      this.expandTranscriptIfNeeded();
      // Try again after expanding
      transcript = this.extractCleanTranscript();
    }

    if (!transcript) {
      // Look for raw transcript data and parse it
      transcript = this.parseRawTranscriptData();
    }

    return transcript ? this.cleanTranscript(transcript) : null;
  }

  extractCleanTranscript() {
    // Try to find display transcript content (not raw JSON)
    const transcriptSelectors = [
      '[data-testid="transcript-display"]',
      '[data-testid="transcript-content"]',
      '.transcript-display',
      '.transcript-content',
      '.transcript-text',
      '.video-transcript',
      '[class*="transcript"][class*="text"]',
      '[class*="transcript"][class*="display"]',
      '.transcript p',
      '.transcript div p',
      '[data-cy="transcript"] p'
    ];

    for (const selector of transcriptSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim();
        // Make sure it's actual transcript text, not JSON or metadata
        if (text && text.length > 50 && !text.includes('transcriptionWords') && !text.includes('"text"')) {
          return text;
        }
      }
    }

    // Try to find multiple transcript paragraphs/segments
    const transcriptContainer = document.querySelector('.transcript, [data-testid*="transcript"], [class*="transcript"]');
    if (transcriptContainer) {
      const paragraphs = transcriptContainer.querySelectorAll('p, div, span');
      const transcriptParts = [];

      for (const p of paragraphs) {
        const text = p.textContent?.trim();
        if (text && text.length > 10 && !text.includes('{') && !text.includes('transcriptionWords')) {
          transcriptParts.push(text);
        }
      }

      if (transcriptParts.length > 0) {
        return transcriptParts.join(' ');
      }
    }

    return null;
  }

  expandTranscriptIfNeeded() {
    // Look for transcript toggle/expand buttons
    const toggleSelectors = [
      '[data-testid="transcript-toggle"]',
      '[data-testid*="show-transcript"]',
      '.transcript-toggle',
      '.show-transcript',
      '[aria-label*="transcript"]',
      'button[class*="transcript"]',
      '[class*="transcript"][class*="button"]'
    ];

    for (const selector of toggleSelectors) {
      const toggle = document.querySelector(selector);
      if (toggle && (
        toggle.textContent.toLowerCase().includes('show') ||
        toggle.textContent.toLowerCase().includes('expand') ||
        !toggle.classList.contains('expanded')
      )) {
        try {
          toggle.click();
          // Give time for content to load
          return true;
        } catch (e) {
          console.warn('Could not click transcript toggle:', e);
        }
      }
    }
    return false;
  }

  parseRawTranscriptData() {
    // Look for script tags or data attributes that might contain transcript JSON
    const scripts = document.querySelectorAll('script[type="application/json"], script:not([src])');

    for (const script of scripts) {
      const content = script.textContent || script.innerHTML;
      if (content && content.includes('transcriptionWords')) {
        try {
          // Try to extract and parse the transcript JSON
          const transcript = this.extractTextFromTranscriptionJson(content);
          if (transcript) {
            return transcript;
          }
        } catch (e) {
          console.warn('Could not parse transcript JSON:', e);
        }
      }
    }

    // Look for data attributes or hidden elements with transcript data
    const dataElements = document.querySelectorAll('[data-transcript], [data-transcription]');
    for (const element of dataElements) {
      const data = element.dataset.transcript || element.dataset.transcription;
      if (data) {
        try {
          const transcript = this.extractTextFromTranscriptionJson(data);
          if (transcript) {
            return transcript;
          }
        } catch (e) {
          console.warn('Could not parse transcript data attribute:', e);
        }
      }
    }

    return null;
  }

  extractTextFromTranscriptionJson(jsonString) {
    try {
      // Clean up the JSON string
      let cleanJson = jsonString;

      // Remove escape characters and fix common JSON issues
      cleanJson = cleanJson.replace(/\\\"/g, '"').replace(/\\\\/g, '\\');

      // Try to find the transcriptionWords array
      const transcriptionWordsMatch = cleanJson.match(/\"transcriptionWords\"\s*:\s*\[(.*?)\]/s);
      if (!transcriptionWordsMatch) {
        return null;
      }

      // Extract words from the JSON structure
      const wordsText = transcriptionWordsMatch[1];
      const words = [];

      // Use regex to find all text values
      const textMatches = wordsText.matchAll(/\"text\"\s*:\s*\"([^"]+)\"/g);
      for (const match of textMatches) {
        words.push(match[1]);
      }

      if (words.length > 0) {
        return words.join(' ');
      }

      // Fallback: try to parse as full JSON
      const parsed = JSON.parse(cleanJson);
      if (parsed.transcriptionWords && Array.isArray(parsed.transcriptionWords)) {
        return parsed.transcriptionWords
          .filter(word => word.text && !word.hidden)
          .map(word => word.text)
          .join(' ');
      }

    } catch (e) {
      // If JSON parsing fails, try simple text extraction
      const textPattern = /\"text\"\s*:\s*\"([^"]+)\"/g;
      const matches = Array.from(jsonString.matchAll(textPattern));
      if (matches.length > 0) {
        return matches.map(match => match[1]).join(' ');
      }
    }

    return null;
  }

  cleanTranscript(transcript) {
    if (!transcript || typeof transcript !== 'string') {
      return null;
    }

    // Clean up the transcript text
    let cleaned = transcript
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .replace(/[""]/g, '"') // Normalize quotes
      .replace(/['']/g, "'") // Normalize apostrophes
      .replace(/…/g, '...') // Normalize ellipsis
      .replace(/\s+([,.!?;:])/g, '$1') // Remove spaces before punctuation
      .replace(/([.!?])\s*([a-z])/g, '$1 $2') // Ensure proper sentence spacing
      .trim();

    // Only return if it's substantial content
    return cleaned.length > 20 ? cleaned : null;
  }

  extractChapters() {
    const chapters = [];

    // Try specific chapter selectors first (Tella might have structured chapter elements)
    const chapterSelectors = [
      '[data-testid*="chapter"]',
      '.chapter',
      '.chapters',
      '.chapter-item',
      '[class*="chapter"]',
      '.timeline-item',
      '[data-cy*="chapter"]'
    ];

    // Check for structured chapter elements
    for (const selector of chapterSelectors) {
      const chapterElements = document.querySelectorAll(selector);
      if (chapterElements.length > 0) {
        for (const element of chapterElements) {
          const chapterData = this.extractChapterFromElement(element);
          if (chapterData) {
            chapters.push(chapterData);
          }
        }
        if (chapters.length > 0) break; // If we found structured chapters, use those
      }
    }

    // Fallback to timestamp pattern matching if no structured chapters found
    if (chapters.length === 0) {
      chapters.push(...this.extractChaptersFromTimestamps());
    }

    // Format as bulleted list: "• 00:00 - Title:Description"
    if (chapters.length > 0) {
      return chapters
        .slice(0, 15) // Limit to 15 chapters max
        .map(chapter => `• ${chapter.time} - ${chapter.title}${chapter.description ? ':' + chapter.description : ''}`)
        .join('\n');
    }

    return null;
  }

  extractChapterFromElement(element) {
    const text = element.textContent?.trim();
    if (!text) return null;

    // Look for timestamp in this element or its children
    const timeMatch = text.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
    if (!timeMatch) return null;

    const time = timeMatch[1];

    // Skip if this is likely the video duration (appears at the end)
    if (this.isVideoDuration(time, text)) {
      return null;
    }

    // Extract title and description, removing metadata
    const remainingText = this.cleanChapterText(text.replace(timeMatch[0], '').trim());

    // Try to split title and description intelligently
    const { title, description } = this.parseChapterTitleAndDescription(remainingText);

    return title && title.length > 2 ? { time, title, description } : null;
  }

  isVideoDuration(timestamp, fullText) {
    // Check if this timestamp matches the video duration
    const duration = this.extractDuration();
    if (duration === timestamp) {
      return true;
    }

    // Check if timestamp appears in a context that suggests it's the video duration
    const durationContext = [
      'duration', 'length', 'total time', 'video time',
      'ago', 'uploaded', 'created', 'published'
    ];

    const lowerText = fullText.toLowerCase();
    return durationContext.some(context => lowerText.includes(context));
  }

  cleanChapterText(text) {
    // Remove common metadata patterns
    return text
      // Remove author names and dates
      .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\d+ (day|week|month|year)s? ago/gi, '')
      .replace(/\b(Connor|Finlayson|Add a description|Made|Edit|Share|Download)\b/gi, '')
      // Remove common UI elements
      .replace(/\b(Add a description|Made with|Download|Share|Edit)\b/gi, '')
      // Remove extra whitespace and dots
      .replace(/\.{3,}/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  parseChapterTitleAndDescription(text) {
    if (!text || text.length < 3) {
      return { title: null, description: null };
    }

    let title = '';
    let description = '';

    // Look for clear title patterns (often in title case or starting with capital)
    const titlePatterns = [
      // Pattern: "Title Word Another Word" followed by description
      /^([A-Z][a-zA-Z\s]{10,50}?)([a-z].*)/,
      // Pattern: "Multiple Words" followed by lowercase description
      /^([A-Z][A-Za-z\s]{5,40}?)([a-z][a-z\s].*)/
    ];

    for (const pattern of titlePatterns) {
      const match = text.match(pattern);
      if (match) {
        title = match[1].trim();
        description = match[2].trim();
        break;
      }
    }

    // Fallback: Look for common separators
    if (!title) {
      const separators = [' - ', ': ', ' – ', ' | ', '. '];

      for (const sep of separators) {
        if (text.includes(sep)) {
          const parts = text.split(sep);
          title = parts[0].trim();
          description = parts.slice(1).join(sep).trim();
          break;
        }
      }
    }

    // If still no clear separation, use intelligent splitting
    if (!title || title.length < 3) {
      const words = text.split(' ');

      // Find the best split point (usually around uppercase words)
      let splitPoint = 0;
      for (let i = 2; i < Math.min(words.length, 8); i++) {
        if (words[i] && (
          words[i][0] === words[i][0].toLowerCase() || // lowercase word suggests description start
          words[i].length < 3 || // short words like "a", "the", "and"
          ['and', 'the', 'of', 'for', 'in', 'on', 'with', 'to'].includes(words[i].toLowerCase())
        )) {
          splitPoint = i;
          break;
        }
      }

      if (splitPoint > 0) {
        title = words.slice(0, splitPoint).join(' ');
        description = words.slice(splitPoint).join(' ');
      } else {
        // Use first 4-6 words as title
        title = words.slice(0, Math.min(6, words.length)).join(' ');
        description = words.slice(Math.min(6, words.length)).join(' ');
      }
    }

    // Clean up and validate
    title = title.replace(/[^\w\s\-']/g, '').trim();
    description = description.replace(/^[^\w]*/, '').trim(); // Remove leading non-word chars

    // Limit lengths
    title = title.substring(0, 50).trim();
    description = description.substring(0, 120).trim();

    // Don't return if title is just one short word or empty
    if (!title || title.length < 3 || title.split(' ').length === 1 && title.length < 5) {
      return { title: null, description: null };
    }

    return { title, description: description || null };
  }

  extractChaptersFromTimestamps() {
    const chapters = [];
    const allElements = document.querySelectorAll('*');
    const processedElements = new Set();
    const videoDuration = this.extractDuration();

    for (const element of allElements) {
      if (processedElements.has(element)) continue;

      const text = element.textContent?.trim();
      // Look for timestamp pattern like "00:00", "15:23", etc.
      if (text && text.match(/^\d{1,2}:\d{2}(?::\d{2})?$/)) {
        const time = text;

        // Skip if this is the video duration or appears in duration context
        if (time === videoDuration || this.isVideoDuration(time, element.parentElement?.textContent || '')) {
          continue;
        }

        // Look for chapter content in nearby elements
        const chapterInfo = this.findChapterContentNear(element);
        if (chapterInfo) {
          chapters.push({
            time: time,
            title: chapterInfo.title,
            description: chapterInfo.description
          });

          // Mark related elements as processed to avoid duplicates
          if (chapterInfo.element) {
            processedElements.add(chapterInfo.element);
          }
        }
      }
    }

    // Remove duplicates by time and sort by timestamp
    const uniqueChapters = [];
    const seenTimes = new Set();

    for (const chapter of chapters) {
      if (!seenTimes.has(chapter.time)) {
        seenTimes.add(chapter.time);
        uniqueChapters.push(chapter);
      }
    }

    // Sort chapters by time
    uniqueChapters.sort((a, b) => {
      const timeA = this.convertTimeToSeconds(a.time);
      const timeB = this.convertTimeToSeconds(b.time);
      return timeA - timeB;
    });

    return uniqueChapters;
  }

  convertTimeToSeconds(timeString) {
    const parts = timeString.split(':').map(part => parseInt(part, 10));
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1]; // MM:SS
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
    }
    return 0;
  }

  findChapterContentNear(timestampElement) {
    // Search in parent containers for chapter title/description
    let current = timestampElement.parentElement;

    for (let i = 0; i < 3 && current; i++) { // Check up to 3 parent levels
      const siblings = current.children;

      for (const sibling of siblings) {
        if (sibling === timestampElement || sibling.contains(timestampElement)) continue;

        const siblingText = sibling.textContent?.trim();
        if (siblingText && siblingText.length > 5 && siblingText.length < 300) {
          // Clean the text using our improved cleaning method
          const cleanedText = this.cleanChapterText(siblingText);

          if (cleanedText && cleanedText.length > 5) {
            // Use our improved title/description parsing
            const { title, description } = this.parseChapterTitleAndDescription(cleanedText);

            if (title && title.length > 2) {
              return { title, description, element: sibling };
            }
          }
        }
      }

      current = current.parentElement;
    }

    return null;
  }

  extractCreatedDate() {
    // Search for relative dates like "1 day ago", "2 weeks ago", etc.
    const allElements = document.querySelectorAll('*');
    for (const element of allElements) {
      const text = element.textContent?.trim();
      if (text) {
        // Look for relative date patterns
        const relativeMatch = text.match(/(\d+)\s+(day|days|week|weeks|month|months|hour|hours|minute|minutes)\s+ago/i);
        if (relativeMatch) {
          const amount = parseInt(relativeMatch[1]);
          const unit = relativeMatch[2].toLowerCase();

          // Convert relative date to actual date
          const now = new Date();
          if (unit.startsWith('minute')) {
            now.setMinutes(now.getMinutes() - amount);
          } else if (unit.startsWith('hour')) {
            now.setHours(now.getHours() - amount);
          } else if (unit.startsWith('day')) {
            now.setDate(now.getDate() - amount);
          } else if (unit.startsWith('week')) {
            now.setDate(now.getDate() - (amount * 7));
          } else if (unit.startsWith('month')) {
            now.setMonth(now.getMonth() - amount);
          }

          return now.toISOString();
        }
      }
    }

    // Look for absolute dates with traditional selectors
    const dateSelectors = [
      '[data-testid="created-date"]',
      '.created-date',
      '.recording-date',
      '.upload-date',
      '[data-cy="created-date"]',
      'time[datetime]'
    ];

    for (const selector of dateSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        // Check for datetime attribute first
        if (element.hasAttribute('datetime')) {
          return new Date(element.getAttribute('datetime')).toISOString();
        }
        // Parse text content
        const dateText = element.textContent.trim();
        if (dateText) {
          const parsed = new Date(dateText);
          if (!isNaN(parsed.getTime())) {
            return parsed.toISOString();
          }
        }
      }
    }

    // Fallback to meta tags
    const metaDate = document.querySelector('meta[property="article:published_time"]') ||
                     document.querySelector('meta[property="video:release_date"]');
    if (metaDate && metaDate.content) {
      return new Date(metaDate.content).toISOString();
    }

    return null;
  }

  extractViews() {
    // Look for embedded JSON data containing view count
    const scripts = document.querySelectorAll('script[type="application/json"], script:not([src])');

    for (const script of scripts) {
      const content = script.textContent || script.innerHTML;
      if (content && content.includes('"views"')) {
        try {
          // Try to extract views from JSON structure
          const viewsMatch = content.match(/"views"\s*:\s*(\d+)/);
          if (viewsMatch) {
            const views = parseInt(viewsMatch[1], 10);
            return views;
          }

          // Try to parse as full JSON to get views value
          const parsed = JSON.parse(content);
          if (parsed && typeof parsed.views === 'number') {
            return parsed.views;
          }

          // Check if it's nested in the JSON structure
          if (parsed && parsed.props && parsed.props.pageProps &&
              typeof parsed.props.pageProps.views === 'number') {
            return parsed.props.pageProps.views;
          }

          // Check for other common nested patterns
          if (parsed && parsed.video && typeof parsed.video.views === 'number') {
            return parsed.video.views;
          }

        } catch (e) {
          // JSON parsing failed, continue to next script
          continue;
        }
      }
    }

    // Fallback: Look for view count in page elements
    const viewSelectors = [
      '[data-testid*="view"]',
      '.view-count',
      '.views',
      '[class*="view"]',
      '[aria-label*="view"]'
    ];

    for (const selector of viewSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        const text = element.textContent.trim();
        // Look for patterns like "123 views", "1.2K views", etc.
        const viewMatch = text.match(/(\d+(?:\.\d+)?[KM]?)\s*views?/i);
        if (viewMatch) {
          const viewStr = viewMatch[1];
          let views = parseFloat(viewStr);
          if (viewStr.includes('K')) {
            views *= 1000;
          } else if (viewStr.includes('M')) {
            views *= 1000000;
          }
          return Math.floor(views);
        }
      }
    }

    // Default to 0 if no views found (new videos typically have 0 views)
    return 0;
  }

  extractPlaylist() {
    // Look for playlist information
    const playlistSelectors = [
      '[data-testid="playlist-name"]',
      '.playlist-name',
      '.collection-name',
      '[data-cy="playlist"]',
      '.breadcrumb .playlist',
      '.video-collection'
    ];

    for (const selector of playlistSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    // Check breadcrumbs or navigation
    const breadcrumbs = document.querySelectorAll('.breadcrumb a, nav a');
    for (const breadcrumb of breadcrumbs) {
      if (breadcrumb.textContent.includes('Playlist') ||
          breadcrumb.textContent.includes('Collection')) {
        return breadcrumb.textContent.trim();
      }
    }

    return null;
  }

  extractDuration() {
    // First priority: Look for aria-label="duration" elements
    const durationLabel = document.querySelector('[aria-label="duration"]');
    if (durationLabel) {
      const durationText = durationLabel.textContent?.trim();
      if (durationText && durationText.match(/\d{1,2}:\d{2}(:\d{2})?/)) {
        return durationText;
      }
    }

    // Second priority: Look for duration in player areas
    const playerElements = document.querySelectorAll('[class*="player"], [id*="player"], [data-testid*="player"]');
    for (const playerEl of playerElements) {
      const timeElements = playerEl.querySelectorAll('*');
      for (const timeEl of timeElements) {
        const text = timeEl.textContent?.trim();
        if (text && text.match(/^\d{1,2}:\d{2}(:\d{2})?$/) &&
            !timeEl.closest('[class*="chapter"]') &&
            !timeEl.closest('[class*="timestamp"]')) {
          // Check if this is in a player context
          const isInPlayer = timeEl.closest('[class*="player"]') ||
                           timeEl.closest('[id*="player"]') ||
                           timeEl.closest('[data-testid*="player"]');
          if (isInPlayer) {
            return text;
          }
        }
      }
    }

    // Third priority: Look for specific duration display selectors
    const durationSelectors = [
      '[data-testid="video-duration"]',
      '[data-testid="duration"]',
      '.video-duration',
      '.duration',
      '.total-duration',
      '.time-display .total',
      '[class*="duration"]'
    ];

    for (const selector of durationSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const durationText = element.textContent?.trim();
        if (durationText && durationText.match(/\d+:\d+/)) {
          return durationText;
        }
      }
    }

    // Fourth priority: Video element duration
    const videoElement = document.querySelector('video');
    if (videoElement && videoElement.duration && !isNaN(videoElement.duration)) {
      return this.formatDuration(videoElement.duration);
    }

    // Last resort: Find longest duration that's not in chapter area
    const allElements = document.querySelectorAll('*');
    const timeElements = [];

    for (const element of allElements) {
      const text = element.textContent?.trim();
      if (text && text.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
        // Skip if clearly in chapter area
        const isInChapterArea = element.closest('[class*="chapter"]') ||
                               element.closest('[class*="timestamp"]') ||
                               element.closest('[data-testid*="chapter"]');

        // Skip if context suggests it's a timestamp
        const elementContext = element.parentElement?.textContent || '';
        const isTimestamp = elementContext.includes('ago') ||
                          this.isVideoDuration(text, elementContext);

        if (!isInChapterArea && !isTimestamp) {
          timeElements.push({
            text: text,
            seconds: this.convertTimeToSeconds(text)
          });
        }
      }
    }

    // Return the longest duration found
    if (timeElements.length > 0) {
      timeElements.sort((a, b) => b.seconds - a.seconds);
      return timeElements[0].text;
    }

    return null;
  }


  extractVideoUrl() {
    return window.location.href;
  }

  extractDescription() {
    const descSelectors = [
      '[data-testid="video-description"]',
      '.video-description',
      '.description',
      '[data-cy="description"]',
      'meta[property="og:description"]',
      'meta[name="description"]'
    ];

    for (const selector of descSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        if (element.tagName === 'META') {
          return element.content;
        }
        if (element.textContent?.trim()) {
          return element.textContent.trim();
        }
      }
    }

    return null;
  }

  async extractAllData() {
    // Try API extraction first for comprehensive data
    const apiData = await this.extractFromAPI();
    if (apiData) {
      console.log('✅ Using API data with comprehensive video metadata and chapters');
      this.data = apiData;

      // Add transcript from API or fallback to DOM
      if (!this.data.transcript) {
        const transcript = this.extractTranscript();
        if (transcript) {
          this.data.transcript = transcript;
          this.data.extractionMethod = 'api+dom';
        }
      }

      return this.data;
    }

    console.log('📋 Falling back to DOM extraction');
    // Fallback to DOM extraction if API fails
    this.data = {
      title: this.extractTitle(),
      transcript: this.extractTranscript(),
      chapters: this.extractChapters(),
      createdDate: this.extractCreatedDate(),
      playlist: this.extractPlaylist(),
      duration: this.extractDuration(),
      views: this.extractViews(),
      videoUrl: this.extractVideoUrl(),
      description: this.extractDescription(),
      extractedAt: new Date().toISOString(),
      pageUrl: window.location.href,
      extractionMethod: 'dom'
    };

    // Remove null values
    Object.keys(this.data).forEach(key => {
      if (this.data[key] === null || this.data[key] === undefined) {
        delete this.data[key];
      }
    });

    return this.data;
  }
}

// Initialize extractor when page loads
let extractor;

function initializeExtractor() {
  extractor = new TellaDataExtractor();

  // Add visual indicator when extension is active
  if (extractor.isRecordingPage) {
    addExtensionIndicator();
  }
}

function addExtensionIndicator() {
  // Add a small indicator that the extension is active
  const indicator = document.createElement('div');
  indicator.id = 'tella-webhook-indicator';
  indicator.innerHTML = '🔗 Webhook Ready';
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    transition: opacity 0.3s;
  `;

  document.body.appendChild(indicator);

  // Fade out after 3 seconds
  setTimeout(() => {
    indicator.style.opacity = '0';
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }, 300);
  }, 3000);
}

// Message listener for popup requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    // Check if extension context is still valid
    if (!chrome.runtime.id) {
      console.warn('Extension context invalidated');
      sendResponse({ success: false, error: 'Extension context invalidated. Please refresh the page.' });
      return true;
    }

    if (request.action === 'extractData') {
      if (!extractor) {
        initializeExtractor();
      }

      // Handle async extraction
      extractor.extractAllData()
        .then(data => {
          sendResponse({ success: true, data });
        })
        .catch(error => {
          console.error('Data extraction error:', error);
          sendResponse({ success: false, error: error.message });
        });

      return true; // Keep message channel open for async response
    }

    if (request.action === 'checkPage') {
      const isValidPage = extractor ? extractor.isRecordingPage : new TellaDataExtractor().isRecordingPage;
      sendResponse({ isValidPage });
      return true;
    }
  } catch (error) {
    console.error('Content script error:', error);
    sendResponse({ success: false, error: error.message });
  }

  return true;
});

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtractor);
} else {
  initializeExtractor();
}

// Re-initialize on navigation (for SPAs)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(initializeExtractor, 1000); // Wait for page to load
  }
}).observe(document, { subtree: true, childList: true });