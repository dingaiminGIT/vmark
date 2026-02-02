/**
 * VMark Reader - Interactive controls for exported HTML
 *
 * Features:
 * - Font size adjustment
 * - Line height adjustment
 * - Content width adjustment
 * - Light/Dark theme toggle
 * - CJK letter spacing toggle
 * - Expand all details toggle
 * - Settings persistence via localStorage
 */

(function() {
  'use strict';

  // Default settings
  const DEFAULTS = {
    fontSize: 18,
    lineHeight: 1.6,
    contentWidth: 50,
    cjkLetterSpacing: 0.05,
    theme: 'light',
    cjkLatinSpacing: true,
    expandDetails: false
  };

  // Settings bounds
  const BOUNDS = {
    fontSize: { min: 12, max: 28, step: 1 },
    lineHeight: { min: 1.2, max: 2.4, step: 0.1 },
    contentWidth: { min: 30, max: 80, step: 5 },
    cjkLetterSpacing: { min: 0.02, max: 0.12, step: 0.01 }
  };

  // Storage key
  const STORAGE_KEY = 'vmark-reader-settings';

  // State
  let settings = { ...DEFAULTS };
  let panel = null;
  let isOpen = false;

  /**
   * Load settings from localStorage
   */
  function loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        settings = { ...DEFAULTS, ...parsed };
      }
    } catch (e) {
      console.warn('[VMark Reader] Failed to load settings:', e);
    }
  }

  /**
   * Save settings to localStorage
   */
  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('[VMark Reader] Failed to save settings:', e);
    }
  }

  /**
   * Apply current settings to the document
   */
  function applySettings() {
    const root = document.documentElement;
    const surface = document.querySelector('.export-surface');
    const editor = document.querySelector('.export-surface-editor');

    // Font size
    root.style.setProperty('--editor-font-size', `${settings.fontSize}px`);
    root.style.setProperty('--editor-font-size-sm', `${settings.fontSize * 0.9}px`);
    root.style.setProperty('--editor-font-size-mono', `${settings.fontSize * 0.85}px`);

    // Line height
    root.style.setProperty('--editor-line-height', settings.lineHeight);
    root.style.setProperty('--editor-line-height-px', `${settings.fontSize * settings.lineHeight}px`);

    // Content width
    if (surface) {
      surface.style.maxWidth = `${settings.contentWidth}em`;
    }

    // CJK letter spacing (applied dynamically to text)
    applyCjkLetterSpacing();

    // Theme
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark-theme');
    }

    // CJK spacing (handles both apply and remove based on setting)
    applyCjkSpacing();

    // Expand details
    applyExpandDetails();

    // Update UI if panel exists
    updatePanelUI();
  }

  // Store original text for CJK spacing toggle
  const originalTexts = new WeakMap();
  const THIN_SPACE = '\u2009';

  /**
   * Apply or remove CJK-Latin spacing
   */
  function applyCjkSpacing() {
    const editor = document.querySelector('.export-surface-editor');
    if (!editor) return;

    const isApplied = editor.dataset.cjkApplied === 'true';

    if (settings.cjkLatinSpacing && !isApplied) {
      // Apply spacing
      addCjkSpacing(editor);
      editor.dataset.cjkApplied = 'true';
    } else if (!settings.cjkLatinSpacing && isApplied) {
      // Remove spacing
      removeCjkSpacing(editor);
      editor.dataset.cjkApplied = 'false';
    }
  }

  function addCjkSpacing(editor) {
    const CJK_RANGE = /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/;
    const LATIN_RANGE = /[a-zA-Z0-9]/;

    const walker = document.createTreeWalker(
      editor,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          if (['script', 'style', 'code', 'pre', 'kbd', 'samp'].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    textNodes.forEach(textNode => {
      const text = textNode.textContent;
      if (!text || text.length < 2) return;

      // Store original
      if (!originalTexts.has(textNode)) {
        originalTexts.set(textNode, text);
      }

      let result = '';
      for (let i = 0; i < text.length; i++) {
        result += text[i];
        if (i < text.length - 1) {
          const curr = text[i];
          const next = text[i + 1];
          const currIsCjk = CJK_RANGE.test(curr);
          const nextIsCjk = CJK_RANGE.test(next);
          const currIsLatin = LATIN_RANGE.test(curr);
          const nextIsLatin = LATIN_RANGE.test(next);

          if ((currIsCjk && nextIsLatin) || (currIsLatin && nextIsCjk)) {
            if (curr !== ' ' && curr !== THIN_SPACE && next !== ' ' && next !== THIN_SPACE) {
              result += THIN_SPACE;
            }
          }
        }
      }

      if (result !== text) {
        textNode.textContent = result;
      }
    });
  }

  function removeCjkSpacing(editor) {
    const walker = document.createTreeWalker(
      editor,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          if (['script', 'style', 'code', 'pre', 'kbd', 'samp'].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    textNodes.forEach(textNode => {
      // Restore original or remove thin spaces
      const original = originalTexts.get(textNode);
      if (original) {
        textNode.textContent = original;
      } else {
        // Fallback: remove all thin spaces
        textNode.textContent = textNode.textContent.replace(/\u2009/g, '');
      }
    });
  }

  /**
   * Apply CJK letter spacing by wrapping CJK text in spans
   */
  function applyCjkLetterSpacing() {
    const editor = document.querySelector('.export-surface-editor');
    if (!editor) return;

    const spacing = settings.cjkLetterSpacing;
    const spacingValue = spacing === 0 ? '0' : `${spacing}em`;

    // Update existing cjk-spacing spans
    editor.querySelectorAll('.cjk-letter-spacing').forEach(span => {
      span.style.letterSpacing = spacingValue;
    });

    // If already processed, just update values
    if (editor.dataset.cjkLetterSpacingApplied === 'true') {
      return;
    }

    // CJK Unicode ranges
    const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u3100-\u312f]+/g;

    const walker = document.createTreeWalker(
      editor,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          // Skip code, pre, and already-processed spans
          if (['script', 'style', 'code', 'pre', 'kbd', 'samp'].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.classList.contains('cjk-letter-spacing')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    textNodes.forEach(textNode => {
      const text = textNode.textContent;
      if (!text) return;

      CJK_REGEX.lastIndex = 0;
      const matches = [];
      let match;
      while ((match = CJK_REGEX.exec(text)) !== null) {
        matches.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
      }

      if (matches.length === 0) return;

      // Create document fragment with wrapped CJK runs
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

      matches.forEach(m => {
        // Add text before match
        if (m.start > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, m.start)));
        }
        // Add wrapped CJK text
        const span = document.createElement('span');
        span.className = 'cjk-letter-spacing';
        span.style.letterSpacing = spacingValue;
        span.textContent = m.text;
        fragment.appendChild(span);
        lastIndex = m.end;
      });

      // Add remaining text
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      // Replace text node with fragment
      textNode.parentNode.replaceChild(fragment, textNode);
    });

    editor.dataset.cjkLetterSpacingApplied = 'true';
  }

  /**
   * Apply expand/collapse all details
   */
  function applyExpandDetails() {
    const details = document.querySelectorAll('details');
    details.forEach(el => {
      if (settings.expandDetails) {
        el.setAttribute('open', '');
      } else {
        el.removeAttribute('open');
      }
    });
  }

  /**
   * Create the settings panel
   */
  function createPanel() {
    // Create toggle button
    const toggle = document.createElement('button');
    toggle.className = 'vmark-reader-toggle';
    toggle.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>`;
    toggle.title = 'Reader Settings';
    toggle.addEventListener('click', togglePanel);

    // Create panel
    panel = document.createElement('div');
    panel.className = 'vmark-reader-panel';
    panel.innerHTML = `
      <div class="vmark-reader-header">
        <span>Reader Settings</span>
        <button class="vmark-reader-close" title="Close">&times;</button>
      </div>
      <div class="vmark-reader-content">
        <div class="vmark-reader-group">
          <label>Font Size</label>
          <div class="vmark-reader-range-row">
            <button class="vmark-reader-btn" data-action="fontSize" data-dir="-1">−</button>
            <span class="vmark-reader-value" data-value="fontSize">${settings.fontSize}px</span>
            <button class="vmark-reader-btn" data-action="fontSize" data-dir="1">+</button>
          </div>
        </div>
        <div class="vmark-reader-group">
          <label>Line Height</label>
          <div class="vmark-reader-range-row">
            <button class="vmark-reader-btn" data-action="lineHeight" data-dir="-1">−</button>
            <span class="vmark-reader-value" data-value="lineHeight">${settings.lineHeight}</span>
            <button class="vmark-reader-btn" data-action="lineHeight" data-dir="1">+</button>
          </div>
        </div>
        <div class="vmark-reader-group">
          <label>Content Width</label>
          <div class="vmark-reader-range-row">
            <button class="vmark-reader-btn" data-action="contentWidth" data-dir="-1">−</button>
            <span class="vmark-reader-value" data-value="contentWidth">${settings.contentWidth}em</span>
            <button class="vmark-reader-btn" data-action="contentWidth" data-dir="1">+</button>
          </div>
        </div>
        <div class="vmark-reader-group">
          <label>Theme</label>
          <div class="vmark-reader-toggle-row">
            <button class="vmark-reader-theme-btn ${settings.theme === 'light' ? 'active' : ''}" data-theme="light">Light</button>
            <button class="vmark-reader-theme-btn ${settings.theme === 'dark' ? 'active' : ''}" data-theme="dark">Dark</button>
          </div>
        </div>
        <div class="vmark-reader-group">
          <label>CJK Letter Spacing</label>
          <div class="vmark-reader-range-row">
            <button class="vmark-reader-btn" data-action="cjkLetterSpacing" data-dir="-1">−</button>
            <span class="vmark-reader-value" data-value="cjkLetterSpacing">${settings.cjkLetterSpacing}em</span>
            <button class="vmark-reader-btn" data-action="cjkLetterSpacing" data-dir="1">+</button>
          </div>
        </div>
        <div class="vmark-reader-group">
          <label class="vmark-reader-checkbox-label">
            <input type="checkbox" ${settings.cjkLatinSpacing ? 'checked' : ''} data-setting="cjkLatinSpacing">
            <span>CJK-Latin Spacing</span>
          </label>
        </div>
        <div class="vmark-reader-group">
          <label class="vmark-reader-checkbox-label">
            <input type="checkbox" ${settings.expandDetails ? 'checked' : ''} data-setting="expandDetails">
            <span>Expand All Sections</span>
          </label>
        </div>
        <div class="vmark-reader-group vmark-reader-reset">
          <button class="vmark-reader-reset-btn" data-action="reset">Reset to Defaults</button>
        </div>
      </div>
    `;

    // Event listeners
    panel.querySelector('.vmark-reader-close').addEventListener('click', togglePanel);

    panel.querySelectorAll('.vmark-reader-btn').forEach(btn => {
      btn.addEventListener('click', handleRangeClick);
    });

    panel.querySelectorAll('.vmark-reader-theme-btn').forEach(btn => {
      btn.addEventListener('click', handleThemeClick);
    });

    panel.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', handleCheckboxChange);
    });

    panel.querySelector('.vmark-reader-reset-btn').addEventListener('click', handleReset);

    // Append to document
    document.body.appendChild(toggle);
    document.body.appendChild(panel);
  }

  /**
   * Toggle panel visibility
   */
  function togglePanel() {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
  }

  /**
   * Handle range button clicks (+/-)
   */
  function handleRangeClick(e) {
    const btn = e.currentTarget;
    const action = btn.dataset.action;
    const dir = parseInt(btn.dataset.dir, 10);
    const bounds = BOUNDS[action];

    if (!bounds) return;

    let value = settings[action] + (dir * bounds.step);
    value = Math.max(bounds.min, Math.min(bounds.max, value));
    // Round to appropriate precision based on step
    const precision = bounds.step < 0.1 ? 100 : 10;
    value = Math.round(value * precision) / precision;

    settings[action] = value;
    saveSettings();
    applySettings();
  }

  /**
   * Handle theme button clicks
   */
  function handleThemeClick(e) {
    const theme = e.target.dataset.theme;
    settings.theme = theme;
    saveSettings();
    applySettings();
  }

  /**
   * Handle checkbox changes
   */
  function handleCheckboxChange(e) {
    const setting = e.target.dataset.setting;
    settings[setting] = e.target.checked;
    saveSettings();
    applySettings();
  }

  /**
   * Handle reset button
   */
  function handleReset() {
    // First remove CJK spacing if applied
    const editor = document.querySelector('.export-surface-editor');
    if (editor && editor.dataset.cjkApplied === 'true') {
      removeCjkSpacing(editor);
      editor.dataset.cjkApplied = 'false';
    }

    settings = { ...DEFAULTS };
    saveSettings();
    applySettings();
  }

  /**
   * Update panel UI to reflect current settings
   */
  function updatePanelUI() {
    if (!panel) return;

    // Update value displays
    panel.querySelector('[data-value="fontSize"]').textContent = `${settings.fontSize}px`;
    panel.querySelector('[data-value="lineHeight"]').textContent = settings.lineHeight;
    panel.querySelector('[data-value="contentWidth"]').textContent = `${settings.contentWidth}em`;
    panel.querySelector('[data-value="cjkLetterSpacing"]').textContent = `${settings.cjkLetterSpacing}em`;

    // Update theme buttons
    panel.querySelectorAll('.vmark-reader-theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === settings.theme);
    });

    // Update checkboxes
    panel.querySelector('[data-setting="cjkLatinSpacing"]').checked = settings.cjkLatinSpacing;
    panel.querySelector('[data-setting="expandDetails"]').checked = settings.expandDetails;
  }

  /**
   * Initialize reader
   */
  function init() {
    // Wait for DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    loadSettings();
    createPanel();
    applySettings();
  }

  // Start
  init();
})();
