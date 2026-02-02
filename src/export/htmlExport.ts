/**
 * HTML Export
 *
 * Generates HTML exports in multiple modes:
 *
 * Folder mode (default):
 *   DocumentName/
 *   ├── index.html
 *   └── assets/
 *       ├── image1.png
 *       └── ...
 *
 * Single mode:
 *   DocumentName.html (self-contained with data URIs)
 *
 * Style modes:
 * - Plain: No CSS, minimal HTML
 * - Styled: Full CSS with theme, fonts, and content styles
 */

import { writeTextFile, mkdir, exists } from "@tauri-apps/plugin-fs";
import { captureThemeCSS, isDarkTheme } from "./themeSnapshot";
import { resolveResources, getDocumentBaseDir } from "./resourceResolver";
import { generateExportFontCSS } from "./fontEmbedder";
import { getReaderCSS, getReaderJS } from "./reader";

/**
 * Sanitize HTML by removing editor-specific artifacts.
 * This cleans up ProseMirror/Tiptap internal elements and attributes
 * that shouldn't appear in exported HTML.
 */
function sanitizeExportHtml(html: string): string {
  // Create a temporary DOM to manipulate
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const container = doc.body.firstElementChild as HTMLElement;

  // Remove ProseMirror internal elements
  container.querySelectorAll(".ProseMirror-separator, .ProseMirror-trailingBreak").forEach(el => el.remove());

  // Remove hidden HTML preview blocks (render them as actual content or remove)
  container.querySelectorAll(".html-preview-block, .html-preview-inline").forEach(el => {
    // These are hidden placeholders - remove them entirely
    // The actual HTML content is escaped in data-value, but rendering raw HTML is risky
    el.remove();
  });

  // Remove editor-specific attributes from all elements
  const editorAttrs = [
    "contenteditable",
    "draggable",
    "sourceline",
    "data-render-mode",
  ];

  container.querySelectorAll("*").forEach(el => {
    editorAttrs.forEach(attr => el.removeAttribute(attr));

    // Clean up inline styles that are editor-specific
    const style = el.getAttribute("style");
    if (style) {
      // Remove display:none from non-hidden elements
      // Keep opacity for images
      const cleanStyle = style
        .replace(/display:\s*none;?/gi, "")
        .trim();
      if (cleanStyle) {
        el.setAttribute("style", cleanStyle);
      } else {
        el.removeAttribute("style");
      }
    }
  });

  // Note: asset:// URLs are handled by resolveResources after sanitization
  // Don't remove them here - they need to be resolved to file paths or data URIs

  // Remove empty paragraphs that only contain ProseMirror artifacts
  container.querySelectorAll("p").forEach(p => {
    if (p.innerHTML.trim() === "" || p.innerHTML === "<br>") {
      // Keep empty paragraphs for spacing, but clean them
      p.innerHTML = "";
    }
  });

  return container.innerHTML;
}

export interface HtmlExportOptions {
  /** Style mode: 'plain' (no CSS) or 'styled' (full CSS) */
  style: "plain" | "styled";
  /** Packaging mode: 'folder' (assets folder) or 'single' (data URIs) */
  packaging: "folder" | "single";
  /** Document title */
  title?: string;
  /** Source file path (for resource resolution) */
  sourceFilePath?: string | null;
  /** Output file path */
  outputPath: string;
  /** User font settings */
  fontSettings?: {
    fontFamily?: string;
    monoFontFamily?: string;
  };
  /** Force light theme even if editor is in dark mode */
  forceLightTheme?: boolean;
  /** Include interactive reader controls (default: true for styled mode) */
  includeReader?: boolean;
}

export interface HtmlExportResult {
  /** Whether export succeeded */
  success: boolean;
  /** Output file path (index.html in folder mode, or the .html file in single mode) */
  outputPath: string;
  /** Assets folder name relative to index.html (e.g., "assets") - only in folder mode */
  assetsPath?: string;
  /** Number of resources processed */
  resourceCount: number;
  /** Number of missing resources */
  missingCount: number;
  /** Total size of exported files */
  totalSize: number;
  /** Warning messages */
  warnings: string[];
  /** Error message (if failed) */
  error?: string;
}

/**
 * Get the base editor CSS for styled exports.
 * This includes all styles needed for content rendering.
 */
function getEditorContentCSS(): string {
  return `
/* Container layout */
.export-surface {
  max-width: var(--editor-width, 50em);
  margin: 0 auto;
  padding: 2em;
}

/* Base content styles */
.export-surface-editor {
  font-family: var(--font-sans);
  font-size: var(--editor-font-size, 16px);
  line-height: var(--editor-line-height, 1.6);
  color: var(--text-color);
  background: var(--bg-color);
}

/* Typography */
.export-surface-editor h1,
.export-surface-editor h2,
.export-surface-editor h3,
.export-surface-editor h4,
.export-surface-editor h5,
.export-surface-editor h6 {
  font-weight: 600;
  line-height: 1.3;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}

.export-surface-editor h1 {
  font-size: 1.8em;
  margin-top: 1.75em;
  padding-bottom: 0.25em;
  border-bottom: 1px solid var(--border-color);
}
.export-surface-editor h2 { font-size: 1.5em; }
.export-surface-editor h3 { font-size: 1.25em; }
.export-surface-editor h4 { font-size: 1em; }
.export-surface-editor h5 { font-size: 0.875em; }
.export-surface-editor h6 {
  font-size: 0.85em;
  color: var(--text-tertiary);
}

.export-surface-editor p {
  margin: 0 0 1em 0;
}

/* Links */
.export-surface-editor a {
  color: var(--primary-color);
  text-decoration: none;
}

.export-surface-editor a:hover {
  text-decoration: underline;
}

/* Inline code */
.export-surface-editor code {
  font-family: var(--font-mono);
  font-size: var(--editor-font-size-mono, 0.85em);
  background: var(--code-bg-color);
  color: var(--code-text-color);
  padding: 0.2em 0.4em;
  border-radius: var(--radius-sm, 3px);
}

/* Code blocks */
.export-surface-editor pre {
  font-family: var(--font-mono);
  font-size: var(--editor-font-size-mono, 0.85em);
  background: var(--code-bg-color);
  padding: var(--code-padding, 18px);
  border-radius: var(--radius-md, 6px);
  overflow-x: auto;
  margin: 0 0 var(--editor-block-spacing, 1em) 0;
  line-height: var(--code-line-height, 1.45);
}

.export-surface-editor pre code {
  background: none;
  padding: 0;
  font-size: inherit;
}

/* Code block wrapper with line numbers - uses flexbox like editor */
.export-surface-editor .code-block-wrapper {
  display: flex;
  position: relative;
  margin: 0 0 var(--editor-block-spacing, 1em) 0;
  background: var(--code-bg-color);
  border-radius: var(--radius-md, 6px);
}

.export-surface-editor .code-block-wrapper pre {
  margin: 0;
  padding: var(--code-padding, 18px);
  flex: 1;
  min-width: 0;
  border-radius: 0;
  background: transparent;
  line-height: var(--code-line-height, 1.45);
}

.export-surface-editor .code-line-numbers {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-width: 2em;
  padding: var(--code-padding, 18px) 0.5em;
  text-align: right;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-size: var(--editor-font-size-mono, 0.85em);
  line-height: var(--code-line-height, 1.45);
  user-select: none;
  border-right: 1px solid var(--border-color);
  background: var(--code-bg-color);
}

.export-surface-editor .code-line-numbers .line-num {
  line-height: inherit;
}

.export-surface-editor .code-lang-selector {
  position: absolute;
  top: 0.5em;
  right: 0.5em;
  font-size: 0.75em;
  color: var(--text-tertiary);
  background: var(--bg-secondary);
  padding: 0.2em 0.5em;
  border-radius: 3px;
}

/* Code block with preview only (math/mermaid) */
.export-surface-editor .code-block-preview-only {
  background: transparent;
}

.export-surface-editor .code-block-preview-only pre {
  display: none;
}

.export-surface-editor .code-block-preview-only .code-line-numbers,
.export-surface-editor .code-block-preview-only .code-lang-selector {
  display: none;
}

/* Lists */
.export-surface-editor ul,
.export-surface-editor ol {
  --list-indent: 1em;
  margin: 0 0 var(--editor-block-spacing, 1em) 0;
  padding-left: var(--list-indent);
}

.export-surface-editor li {
  margin: 0.25em 0;
}

.export-surface-editor li > ul,
.export-surface-editor li > ol {
  margin: 0.25em 0;
}

.export-surface-editor li > p {
  margin: 0;
}

.export-surface-editor li > p + p {
  margin-top: 0.5em;
}

/* Task lists - checkbox aligned to line height like editor */
.export-surface-editor .task-list-item {
  --checkbox-size: 0.85em;
  --checkbox-gap: calc(var(--checkbox-size) * 0.4);
  list-style-type: none;
  display: flex;
  align-items: flex-start;
  gap: var(--checkbox-gap);
  margin-left: calc(-1 * var(--list-indent, 1em));
}

.export-surface-editor .task-list-checkbox {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  height: var(--editor-line-height-px, 28.8px);
}

.export-surface-editor .task-list-checkbox input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  box-sizing: border-box;
  width: var(--checkbox-size);
  height: var(--checkbox-size);
  border: 1px solid var(--border-color);
  border-radius: calc(var(--checkbox-size) * 0.2);
  background: var(--bg-color);
  cursor: default;
  position: relative;
}

.export-surface-editor .task-list-checkbox input[type="checkbox"]:checked {
  background: var(--primary-color);
  border-color: var(--primary-color);
}

.export-surface-editor .task-list-checkbox input[type="checkbox"]:checked::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 45%;
  width: calc(var(--checkbox-size) * 0.25);
  height: calc(var(--checkbox-size) * 0.5);
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: translate(-50%, -50%) rotate(45deg);
}

.export-surface-editor .task-list-content {
  flex: 1;
  min-width: 0;
  line-height: var(--editor-line-height-px, 28.8px);
}

.export-surface-editor .task-list-content > p {
  margin: 0;
  line-height: inherit;
}

/* Blockquotes */
.export-surface-editor blockquote {
  border-left: 4px solid var(--border-color);
  border-radius: var(--radius-md, 6px);
  margin: 0 0 var(--editor-block-spacing, 1em) 0;
  padding: 0 1em;
  color: var(--meta-content-color, var(--text-secondary));
  line-height: var(--editor-line-height-px);
}

.export-surface-editor blockquote blockquote {
  padding-right: 0;
}

.export-surface-editor blockquote > p {
  margin-bottom: 0.5em;
}

.export-surface-editor blockquote > p:last-child {
  margin-bottom: 0;
}

/* Tables */
.export-surface-editor .table-scroll-wrapper {
  overflow-x: auto;
  margin: 1em 0;
}

.export-surface-editor table {
  border-collapse: collapse;
  width: 100%;
  min-width: 100%;
}

.export-surface-editor th,
.export-surface-editor td {
  border: 1px solid var(--border-color);
  padding: 0.5em 1em;
  text-align: left;
  vertical-align: top;
}

.export-surface-editor th {
  background: var(--bg-secondary);
  font-weight: 600;
}

/* Table alignment */
.export-surface-editor td[style*="text-align: center"],
.export-surface-editor th[style*="text-align: center"] {
  text-align: center;
}

.export-surface-editor td[style*="text-align: right"],
.export-surface-editor th[style*="text-align: right"] {
  text-align: right;
}

/* Images */
.export-surface-editor img {
  max-width: 100%;
  height: auto;
}

.export-surface-editor .block-image {
  margin: 1em 0;
  text-align: center;
}

.export-surface-editor .block-image img {
  display: block;
  margin: 0 auto;
}

.export-surface-editor .inline-image {
  display: inline;
  vertical-align: middle;
}

.export-surface-editor .broken-image {
  display: inline-block;
  padding: 1em 2em;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-color);
  border-radius: 4px;
  color: var(--text-tertiary);
  font-style: italic;
}

.export-surface-editor .image-error {
  opacity: 0.5;
  filter: grayscale(100%);
}

/* Horizontal rule */
.export-surface-editor hr {
  border: none;
  height: 2px;
  background-color: var(--border-color);
  margin: var(--editor-block-spacing, 1em) 0;
}

/* Marks */
.export-surface-editor strong {
  font-weight: 600;
  color: var(--strong-color);
}

.export-surface-editor em {
  font-style: italic;
  color: var(--emphasis-color);
}

.export-surface-editor mark,
.export-surface-editor .md-highlight {
  background: var(--highlight-bg);
  color: var(--highlight-text, inherit);
  padding: 0.1em 0.2em;
  border-radius: 2px;
}

.export-surface-editor s,
.export-surface-editor del,
.export-surface-editor .md-strikethrough {
  text-decoration: line-through;
  color: var(--meta-content-color, var(--text-secondary));
}

.export-surface-editor sub,
.export-surface-editor .md-subscript {
  font-size: 0.75em;
  vertical-align: sub;
}

.export-surface-editor sup,
.export-surface-editor .md-superscript {
  font-size: 0.75em;
  vertical-align: super;
}

.export-surface-editor u,
.export-surface-editor .md-underline {
  text-decoration: underline;
}

/* Alert blocks */
.export-surface-editor .alert-block {
  border-left: 4px solid var(--alert-border);
  background-color: var(--alert-bg);
  padding: 0.75em 1em;
  margin: 0 0 var(--editor-block-spacing, 1em) 0;
  border-radius: var(--radius-md, 6px);
}

.export-surface-editor .alert-block .alert-title {
  font-weight: 600;
  line-height: var(--editor-line-height-px);
  color: var(--alert-title);
  margin-bottom: 0.5em;
  display: flex;
  align-items: center;
  gap: 0.5em;
}

.export-surface-editor .alert-block .alert-title::before {
  content: "";
  width: 16px;
  height: 16px;
  background-color: var(--alert-title);
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}

.export-surface-editor .alert-block .alert-content > *:first-child {
  margin-top: 0;
}

.export-surface-editor .alert-block .alert-content > *:last-child {
  margin-bottom: 0;
}

.export-surface-editor .alert-block .alert-content > p {
  margin-bottom: 0.5em;
}

/* Alert types with colors and icons */
.export-surface-editor .alert-note {
  --alert-border: var(--alert-note);
  --alert-bg: color-mix(in srgb, var(--alert-note) 10%, transparent);
  --alert-title: var(--alert-note);
}

.export-surface-editor .alert-note .alert-title::before {
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z'/%3E%3C/svg%3E");
}

.export-surface-editor .alert-tip {
  --alert-border: var(--alert-tip);
  --alert-bg: color-mix(in srgb, var(--alert-tip) 10%, transparent);
  --alert-title: var(--alert-tip);
}

.export-surface-editor .alert-tip .alert-title::before {
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z'/%3E%3C/svg%3E");
}

.export-surface-editor .alert-important {
  --alert-border: var(--alert-important);
  --alert-bg: color-mix(in srgb, var(--alert-important) 10%, transparent);
  --alert-title: var(--alert-important);
}

.export-surface-editor .alert-important .alert-title::before {
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z'/%3E%3C/svg%3E");
}

.export-surface-editor .alert-warning {
  --alert-border: var(--alert-warning);
  --alert-bg: color-mix(in srgb, var(--alert-warning) 10%, transparent);
  --alert-title: var(--alert-warning);
}

.export-surface-editor .alert-warning .alert-title::before {
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z'/%3E%3C/svg%3E");
}

.export-surface-editor .alert-caution {
  --alert-border: var(--alert-caution);
  --alert-bg: color-mix(in srgb, var(--alert-caution) 10%, transparent);
  --alert-title: var(--alert-caution);
}

.export-surface-editor .alert-caution .alert-title::before {
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z'/%3E%3C/svg%3E");
}

/* Details blocks */
.export-surface-editor .details-block {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 6px);
  margin: 0 0 var(--editor-block-spacing, 1em) 0;
  overflow: hidden;
  line-height: var(--editor-line-height-px);
}

.export-surface-editor .details-block > summary,
.export-surface-editor .details-summary {
  padding: 0.625em 0.75em;
  cursor: pointer;
  font-weight: 600;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid transparent;
  display: flex;
  align-items: center;
  gap: 0.5em;
  list-style: none;
}

.export-surface-editor .details-block > summary::-webkit-details-marker,
.export-surface-editor .details-summary::-webkit-details-marker {
  display: none;
}

.export-surface-editor .details-block > summary::before,
.export-surface-editor .details-summary::before {
  content: "";
  width: 16px;
  height: 16px;
  background-color: currentColor;
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z'/%3E%3C/svg%3E");
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  flex-shrink: 0;
  transition: transform 0.15s ease-out;
}

.export-surface-editor .details-block > summary:hover,
.export-surface-editor .details-summary:hover {
  background-color: var(--bg-tertiary, var(--bg-secondary));
}

.export-surface-editor .details-block[open] > summary::before {
  transform: rotate(90deg);
}

.export-surface-editor .details-block[open] > summary {
  border-bottom-color: var(--border-color);
}

.export-surface-editor .details-block > *:not(summary):not(.details-summary) {
  padding: 0.75em 1em;
}

.export-surface-editor .details-block > *:not(summary):not(.details-summary):not(:last-child) {
  padding-bottom: 0;
}

.export-surface-editor .details-block > p:not(.details-summary) {
  margin-bottom: 0.5em;
}

.export-surface-editor .details-block > p:not(.details-summary):last-child {
  margin-bottom: 0;
}

/* Math - inline and block */
.export-surface-editor .math-inline {
  display: inline;
}

.export-surface-editor .math-inline-preview {
  display: inline;
}

.export-surface-editor .math-block {
  display: block;
  margin: 1em 0;
  text-align: center;
  overflow-x: auto;
}

/* Code preview (rendered math/mermaid) */
.export-surface-editor .code-block-preview {
  margin: 1em 0;
  text-align: center;
}

.export-surface-editor .mermaid-preview {
  margin: 1em 0;
}

.export-surface-editor .mermaid-preview svg {
  max-width: 100%;
  height: auto;
}

/* Footnotes */
.export-surface-editor [data-type="footnote_reference"],
.export-surface-editor .footnote-ref {
  font-size: 0.75em;
  vertical-align: super;
  color: var(--primary-color);
  cursor: default;
}

.export-surface-editor .footnote-ref::before {
  content: "[";
}

.export-surface-editor .footnote-ref::after {
  content: "]";
}

.export-surface-editor [data-type="footnote_definition"],
.export-surface-editor .footnote-def {
  font-size: 0.9em;
  margin: 0.5em 0;
  padding: 0.5em 0;
  border-bottom: 1px solid var(--border-color);
}

.export-surface-editor [data-type="footnote_definition"] dt,
.export-surface-editor .footnote-def-label {
  display: inline;
  font-weight: 600;
  color: var(--primary-color);
  margin-right: 0.5em;
}

.export-surface-editor .footnote-def-label::before {
  content: "[";
}

.export-surface-editor .footnote-def-label::after {
  content: "]:";
}

.export-surface-editor [data-type="footnote_definition"] dd,
.export-surface-editor .footnote-def-content {
  display: inline;
  margin: 0;
}

.export-surface-editor .footnote-backref {
  color: var(--primary-color);
  text-decoration: none;
  margin-left: 0.25em;
}

.export-surface-editor .footnote-backref::after {
  content: "↩";
}

.export-surface-editor [data-type="footnote_definition"]:first-of-type,
.export-surface-editor .footnote-def:first-of-type {
  margin-top: 2em;
  padding-top: 1em;
  border-top: 1px solid var(--border-color);
}

/* Wiki links */
.export-surface-editor .wiki-link {
  color: var(--primary-color);
  background: var(--accent-bg);
  padding: 0.1em 0.3em;
  border-radius: 3px;
  text-decoration: none;
}

/* CJK letter spacing */
.export-surface-editor .cjk-spacing {
  letter-spacing: var(--cjk-letter-spacing, 0.05em);
}

.export-surface-editor pre .cjk-spacing,
.export-surface-editor code .cjk-spacing {
  letter-spacing: 0;
}

/* Syntax highlighting (Highlight.js) - Light theme */
.export-surface-editor .hljs-keyword { color: #d73a49; }
.export-surface-editor .hljs-string { color: #032f62; }
.export-surface-editor .hljs-number { color: #005cc5; }
.export-surface-editor .hljs-comment { color: #6a737d; font-style: italic; }
.export-surface-editor .hljs-function { color: #6f42c1; }
.export-surface-editor .hljs-title { color: #6f42c1; }
.export-surface-editor .hljs-params { color: #24292e; }
.export-surface-editor .hljs-built_in { color: #005cc5; }
.export-surface-editor .hljs-literal { color: #005cc5; }
.export-surface-editor .hljs-type { color: #d73a49; }
.export-surface-editor .hljs-meta { color: #6a737d; }
.export-surface-editor .hljs-attr { color: #005cc5; }
.export-surface-editor .hljs-attribute { color: #005cc5; }
.export-surface-editor .hljs-selector-tag { color: #22863a; }
.export-surface-editor .hljs-selector-class { color: #6f42c1; }
.export-surface-editor .hljs-selector-id { color: #005cc5; }
.export-surface-editor .hljs-variable { color: #e36209; }
.export-surface-editor .hljs-template-variable { color: #e36209; }
.export-surface-editor .hljs-tag { color: #22863a; }
.export-surface-editor .hljs-name { color: #22863a; }
.export-surface-editor .hljs-punctuation { color: #24292e; }
.export-surface-editor .hljs-subst { color: #24292e; }

/* Syntax highlighting - Dark theme */
.dark-theme .export-surface-editor .hljs-keyword { color: #ff7b72; }
.dark-theme .export-surface-editor .hljs-string { color: #a5d6ff; }
.dark-theme .export-surface-editor .hljs-number { color: #79c0ff; }
.dark-theme .export-surface-editor .hljs-comment { color: #8b949e; font-style: italic; }
.dark-theme .export-surface-editor .hljs-function { color: #d2a8ff; }
.dark-theme .export-surface-editor .hljs-title { color: #d2a8ff; }
.dark-theme .export-surface-editor .hljs-params { color: #c9d1d9; }
.dark-theme .export-surface-editor .hljs-built_in { color: #79c0ff; }
.dark-theme .export-surface-editor .hljs-literal { color: #79c0ff; }
.dark-theme .export-surface-editor .hljs-type { color: #ff7b72; }
.dark-theme .export-surface-editor .hljs-meta { color: #8b949e; }
.dark-theme .export-surface-editor .hljs-attr { color: #79c0ff; }
.dark-theme .export-surface-editor .hljs-attribute { color: #79c0ff; }
.dark-theme .export-surface-editor .hljs-selector-tag { color: #7ee787; }
.dark-theme .export-surface-editor .hljs-selector-class { color: #d2a8ff; }
.dark-theme .export-surface-editor .hljs-selector-id { color: #79c0ff; }
.dark-theme .export-surface-editor .hljs-variable { color: #ffa657; }
.dark-theme .export-surface-editor .hljs-template-variable { color: #ffa657; }
.dark-theme .export-surface-editor .hljs-tag { color: #7ee787; }
.dark-theme .export-surface-editor .hljs-name { color: #7ee787; }
.dark-theme .export-surface-editor .hljs-punctuation { color: #c9d1d9; }
.dark-theme .export-surface-editor .hljs-subst { color: #c9d1d9; }

/* Dark theme alert backgrounds */
.dark-theme .export-surface-editor .alert-note {
  --alert-border: var(--alert-note-dark, #58a6ff);
  --alert-bg: color-mix(in srgb, var(--alert-note-dark, #58a6ff) 8%, transparent);
  --alert-title: var(--alert-note-dark, #58a6ff);
}

.dark-theme .export-surface-editor .alert-tip {
  --alert-border: var(--alert-tip-dark, #3fb950);
  --alert-bg: color-mix(in srgb, var(--alert-tip-dark, #3fb950) 8%, transparent);
  --alert-title: var(--alert-tip-dark, #3fb950);
}

.dark-theme .export-surface-editor .alert-important {
  --alert-border: var(--alert-important-dark, #a371f7);
  --alert-bg: color-mix(in srgb, var(--alert-important-dark, #a371f7) 8%, transparent);
  --alert-title: var(--alert-important-dark, #a371f7);
}

.dark-theme .export-surface-editor .alert-warning {
  --alert-border: var(--alert-warning-dark, #d29922);
  --alert-bg: color-mix(in srgb, var(--alert-warning-dark, #d29922) 8%, transparent);
  --alert-title: var(--alert-warning-dark, #d29922);
}

.dark-theme .export-surface-editor .alert-caution {
  --alert-border: var(--alert-caution-dark, #f85149);
  --alert-bg: color-mix(in srgb, var(--alert-caution-dark, #f85149) 8%, transparent);
  --alert-title: var(--alert-caution-dark, #f85149);
}
`.trim();
}

/**
 * Generate the complete HTML document.
 */
function generateHtmlDocument(
  content: string,
  options: {
    title: string;
    themeCSS?: string;
    fontCSS?: string;
    contentCSS?: string;
    isDark?: boolean;
    includeKaTeX?: boolean;
    includeReader?: boolean;
  }
): string {
  const { title, themeCSS, fontCSS, contentCSS, isDark, includeKaTeX = true, includeReader = true } = options;

  const styleBlocks: string[] = [];

  if (themeCSS) {
    styleBlocks.push(`/* Theme Variables */\n${themeCSS}`);
  }

  if (fontCSS) {
    styleBlocks.push(`/* Fonts */\n${fontCSS}`);
  }

  if (contentCSS) {
    styleBlocks.push(`/* Content Styles */\n${contentCSS}`);
  }

  // Add reader CSS if enabled
  if (includeReader) {
    styleBlocks.push(`/* VMark Reader */\n${getReaderCSS()}`);
  }

  const styleTag = styleBlocks.length > 0
    ? `<style>\n${styleBlocks.join("\n\n")}\n</style>`
    : "";

  const themeClass = isDark ? "dark-theme" : "";

  // KaTeX CSS for math rendering
  const katexLink = includeKaTeX
    ? `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" crossorigin="anonymous">`
    : "";

  // Reader JavaScript
  const readerScript = includeReader
    ? `<script>\n${getReaderJS()}\n</script>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" class="${themeClass}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${katexLink}
  ${styleTag}
</head>
<body>
  <div class="export-surface">
    <div class="export-surface-editor">
${content}
    </div>
  </div>
  ${readerScript}
</body>
</html>`;
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Export HTML document.
 *
 * @param html - The rendered HTML content from ExportSurface
 * @param options - Export options
 * @returns Export result
 *
 * @example
 * ```ts
 * const result = await exportHtml(renderedHtml, {
 *   style: 'styled',
 *   packaging: 'folder',
 *   title: 'My Document',
 *   outputPath: '/path/to/output.html',
 * });
 * ```
 */
export async function exportHtml(
  html: string,
  options: HtmlExportOptions
): Promise<HtmlExportResult> {
  const {
    style,
    packaging,
    title = "Document",
    sourceFilePath,
    outputPath,
    fontSettings,
    forceLightTheme = true,
    includeReader,
  } = options;

  // Include reader by default for styled exports
  const shouldIncludeReader = includeReader ?? (style === "styled");

  const warnings: string[] = [];
  let totalSize = 0;
  let resourceCount = 0;
  let missingCount = 0;
  let assetsPath: string | undefined;

  try {
    // Sanitize HTML - remove editor artifacts
    const sanitizedHtml = sanitizeExportHtml(html);

    // For folder mode, outputPath is DocumentFolder/index.html
    // We need to create the document folder first
    const documentFolder = packaging === "folder" ? getOutputDir(outputPath) : undefined;

    if (documentFolder) {
      const folderExists = await exists(documentFolder);
      if (!folderExists) {
        await mkdir(documentFolder, { recursive: true });
      }
    }

    // Resolve resources
    // For folder mode, outputDir is the document folder (contains index.html and assets/)
    const baseDir = await getDocumentBaseDir(sourceFilePath ?? null);
    const { html: processedHtml, report } = await resolveResources(sanitizedHtml, {
      baseDir,
      mode: packaging,
      outputDir: documentFolder,
    });

    resourceCount = report.resources.length;
    missingCount = report.missing.length;
    totalSize += report.totalSize;

    if (report.missing.length > 0) {
      warnings.push(`${report.missing.length} resource(s) not found`);
    }

    if (packaging === "folder") {
      assetsPath = "assets";
    }

    // Generate CSS based on style mode
    let themeCSS: string | undefined;
    let fontCSS: string | undefined;
    let contentCSS: string | undefined;

    if (style === "styled") {
      // Capture current theme
      themeCSS = captureThemeCSS();

      // Generate font CSS
      const fontResult = await generateExportFontCSS(
        processedHtml,
        fontSettings ?? {},
        packaging === "single"
      );
      fontCSS = fontResult.css;
      totalSize += fontResult.totalSize;

      // Add content CSS
      contentCSS = getEditorContentCSS();
    }

    // Determine theme
    const useDarkTheme = !forceLightTheme && isDarkTheme();

    // Generate final HTML document
    const finalHtml = generateHtmlDocument(processedHtml, {
      title,
      themeCSS,
      fontCSS,
      contentCSS,
      isDark: useDarkTheme,
      includeReader: shouldIncludeReader,
    });

    // Write to file
    await writeTextFile(outputPath, finalHtml);
    totalSize += new TextEncoder().encode(finalHtml).length;

    return {
      success: true,
      outputPath,
      assetsPath,
      resourceCount,
      missingCount,
      totalSize,
      warnings,
    };
  } catch (error) {
    return {
      success: false,
      outputPath,
      resourceCount,
      missingCount,
      totalSize,
      warnings,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get the output directory from a file path.
 * For folder mode with index.html, this returns the document folder.
 */
function getOutputDir(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  parts.pop(); // Remove filename (e.g., index.html)
  return parts.join("/") || "/";
}

/**
 * Copy HTML to clipboard.
 *
 * @param html - The rendered HTML content
 * @param includeStyles - Whether to include styles
 */
export async function copyHtmlToClipboard(
  html: string,
  includeStyles: boolean = false
): Promise<void> {
  const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");

  // Sanitize HTML first
  const sanitizedHtml = sanitizeExportHtml(html);

  if (includeStyles) {
    const themeCSS = captureThemeCSS();
    const contentCSS = getEditorContentCSS();
    const styledHtml = `<style>${themeCSS}\n${contentCSS}</style>\n${sanitizedHtml}`;
    await writeText(styledHtml);
  } else {
    await writeText(sanitizedHtml);
  }
}
