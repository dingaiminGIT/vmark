/**
 * HTML Export
 *
 * Generates HTML exports in multiple modes:
 * - Plain + Folder: No CSS, resources in assets folder
 * - Plain + Single: No CSS, resources as data URIs
 * - Styled + Folder: Full CSS, resources in assets folder
 * - Styled + Single: Full CSS, resources as data URIs
 */

import { writeTextFile } from "@tauri-apps/plugin-fs";
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

  // Fix broken asset:// URLs - replace with placeholder or remove
  container.querySelectorAll("img").forEach(img => {
    const src = img.getAttribute("src") || "";
    if (src.startsWith("asset://")) {
      // This is a Tauri-specific URL that won't work in browser
      // Mark as broken image
      img.classList.add("broken-image");
      img.setAttribute("alt", img.getAttribute("alt") || "Image not found");
      img.removeAttribute("src");
      img.setAttribute("data-original-src", src);
    }
  });

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
  /** Output file path */
  outputPath: string;
  /** Assets folder path (if folder mode) */
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

.export-surface-editor h1 { font-size: 2em; }
.export-surface-editor h2 { font-size: 1.5em; }
.export-surface-editor h3 { font-size: 1.25em; }
.export-surface-editor h4 { font-size: 1em; }
.export-surface-editor h5 { font-size: 0.875em; }
.export-surface-editor h6 { font-size: 0.85em; }

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
  font-size: 0.9em;
  background: var(--code-bg-color);
  padding: 0.2em 0.4em;
  border-radius: 3px;
}

/* Code blocks */
.export-surface-editor pre {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--code-bg-color);
  padding: 1em;
  border-radius: 6px;
  overflow-x: auto;
  margin: 1em 0;
}

.export-surface-editor pre code {
  background: none;
  padding: 0;
  font-size: inherit;
}

/* Code block wrapper with line numbers */
.export-surface-editor .code-block-wrapper {
  position: relative;
  margin: 1em 0;
  background: var(--code-bg-color);
  border-radius: 6px;
  overflow: hidden;
}

.export-surface-editor .code-block-wrapper pre {
  margin: 0;
  padding: 1em;
  padding-left: 3.5em;
  border-radius: 0;
}

.export-surface-editor .code-line-numbers {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3em;
  padding: 1em 0.5em;
  text-align: right;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-size: 0.9em;
  line-height: 1.5;
  user-select: none;
  border-right: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.export-surface-editor .code-line-numbers .line-num {
  display: block;
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
  margin: 0 0 1em 0;
  padding-left: 2em;
}

.export-surface-editor li {
  margin: 0.25em 0;
}

.export-surface-editor li > p {
  margin: 0;
}

.export-surface-editor li > p + p {
  margin-top: 0.5em;
}

/* Task lists */
.export-surface-editor .task-list-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5em;
  list-style: none;
  margin-left: -1.5em;
}

.export-surface-editor .task-list-checkbox {
  flex-shrink: 0;
  margin-top: 0.3em;
}

.export-surface-editor .task-list-checkbox input[type="checkbox"] {
  width: 1em;
  height: 1em;
  cursor: default;
  accent-color: var(--primary-color);
}

.export-surface-editor .task-list-content {
  flex: 1;
  min-width: 0;
}

.export-surface-editor .task-list-content > p {
  margin: 0;
}

/* Blockquotes */
.export-surface-editor blockquote {
  margin: 1em 0;
  padding: 0.5em 1em;
  border-left: 4px solid var(--border-color);
  color: var(--text-secondary);
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
  border-top: 1px solid var(--border-color);
  margin: 2em 0;
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

.export-surface-editor s {
  text-decoration: line-through;
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
  margin: 1em 0;
  padding: 1em;
  border-left: 4px solid;
  border-radius: 0 6px 6px 0;
  background: var(--bg-secondary);
}

.export-surface-editor .alert-block > p:last-child {
  margin-bottom: 0;
}

.export-surface-editor .alert-block[data-type="note"] {
  border-color: var(--alert-note);
}

.export-surface-editor .alert-block[data-type="tip"] {
  border-color: var(--alert-tip);
}

.export-surface-editor .alert-block[data-type="important"] {
  border-color: var(--alert-important);
}

.export-surface-editor .alert-block[data-type="warning"] {
  border-color: var(--alert-warning);
}

.export-surface-editor .alert-block[data-type="caution"] {
  border-color: var(--alert-caution);
}

/* Details blocks */
.export-surface-editor details,
.export-surface-editor .details-block {
  margin: 1em 0;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.5em 1em;
}

.export-surface-editor summary,
.export-surface-editor .details-summary {
  font-weight: 600;
  cursor: pointer;
  padding: 0.25em 0;
}

.export-surface-editor details[open] > summary {
  margin-bottom: 0.5em;
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
.export-surface-editor [data-type="footnote_reference"] {
  font-size: 0.75em;
  vertical-align: super;
  color: var(--primary-color);
  cursor: default;
}

.export-surface-editor [data-type="footnote_definition"] {
  font-size: 0.9em;
  margin: 0.5em 0;
  padding: 0.5em 0;
  border-bottom: 1px solid var(--border-color);
}

.export-surface-editor [data-type="footnote_definition"] dt {
  display: inline;
  font-weight: 600;
  color: var(--primary-color);
  margin-right: 0.5em;
}

.export-surface-editor [data-type="footnote_definition"] dd {
  display: inline;
  margin: 0;
}

.export-surface-editor [data-type="footnote_definition"]:first-of-type {
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

/* Syntax highlighting (Highlight.js) */
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

    // Resolve resources
    const baseDir = await getDocumentBaseDir(sourceFilePath ?? null);
    const { html: processedHtml, report } = await resolveResources(sanitizedHtml, {
      baseDir,
      mode: packaging,
      outputDir: packaging === "folder" ? await getOutputDir(outputPath) : undefined,
      documentName: getDocumentName(outputPath),
    });

    resourceCount = report.resources.length;
    missingCount = report.missing.length;
    totalSize += report.totalSize;

    if (report.missing.length > 0) {
      warnings.push(`${report.missing.length} resource(s) not found`);
    }

    if (packaging === "folder") {
      assetsPath = `${getDocumentName(outputPath)}.assets`;
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
 */
async function getOutputDir(filePath: string): Promise<string> {
  const parts = filePath.split(/[/\\]/);
  parts.pop(); // Remove filename
  return parts.join("/") || "/";
}

/**
 * Get the document name (without extension) from a file path.
 */
function getDocumentName(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  const filename = parts.pop() ?? "document";
  return filename.replace(/\.[^.]+$/, "");
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
