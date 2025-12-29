/**
 * Export Utilities
 *
 * Handles conversion of markdown to HTML and various export formats.
 */

import { marked } from "marked";
import DOMPurify from "dompurify";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile, writeFile } from "@tauri-apps/plugin-fs";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import html2pdf from "html2pdf.js";

// Configure marked for GFM (GitHub Flavored Markdown)
marked.setOptions({
  gfm: true,
  breaks: false,
});

/**
 * GitHub-style CSS for exported HTML
 */
const EXPORT_CSS = `
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: #1f2328;
  background-color: #ffffff;
  max-width: 900px;
  margin: 0 auto;
  padding: 32px;
}

h1, h2, h3, h4, h5, h6 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}

h1 { font-size: 2em; border-bottom: 1px solid #d1d5da; padding-bottom: 0.3em; }
h2 { font-size: 1.5em; border-bottom: 1px solid #d1d5da; padding-bottom: 0.3em; }
h3 { font-size: 1.25em; }
h4 { font-size: 1em; }
h5 { font-size: 0.875em; }
h6 { font-size: 0.85em; color: #656d76; }

p { margin-top: 0; margin-bottom: 16px; }

a { color: #0969da; text-decoration: none; }
a:hover { text-decoration: underline; }

code {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 85%;
  background-color: #f6f8fa;
  padding: 0.2em 0.4em;
  border-radius: 6px;
}

pre {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 85%;
  background-color: #f6f8fa;
  padding: 16px;
  overflow: auto;
  border-radius: 6px;
  line-height: 1.45;
}

pre code {
  background-color: transparent;
  padding: 0;
  border-radius: 0;
}

blockquote {
  margin: 0 0 16px 0;
  padding: 0 1em;
  color: #656d76;
  border-left: 0.25em solid #d1d5da;
}

ul, ol {
  margin-top: 0;
  margin-bottom: 16px;
  padding-left: 2em;
}

li { margin-top: 0.25em; }
li + li { margin-top: 0.25em; }

table {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 16px;
}

th, td {
  padding: 6px 13px;
  border: 1px solid #d1d5da;
}

th {
  font-weight: 600;
  background-color: #f6f8fa;
}

tr:nth-child(2n) { background-color: #f6f8fa; }

hr {
  height: 0.25em;
  padding: 0;
  margin: 24px 0;
  background-color: #d1d5da;
  border: 0;
}

img {
  max-width: 100%;
  height: auto;
}

/* Task lists */
.task-list-item {
  list-style-type: none;
}

.task-list-item input {
  margin-right: 0.5em;
}

/* Alert blocks (GFM) */
.markdown-alert {
  padding: 8px 16px;
  margin-bottom: 16px;
  border-left: 4px solid;
  border-radius: 6px;
}

.markdown-alert-note { border-color: #0969da; background-color: #ddf4ff; }
.markdown-alert-tip { border-color: #1a7f37; background-color: #dafbe1; }
.markdown-alert-important { border-color: #8250df; background-color: #fbefff; }
.markdown-alert-warning { border-color: #9a6700; background-color: #fff8c5; }
.markdown-alert-caution { border-color: #cf222e; background-color: #ffebe9; }

@media print {
  body { max-width: none; padding: 0; }
  pre { white-space: pre-wrap; word-wrap: break-word; }
}
`.trim();

/**
 * Convert markdown to HTML (sanitized to prevent XSS)
 */
export function markdownToHtml(markdown: string): string {
  const rawHtml = marked.parse(markdown, { async: false }) as string;
  return DOMPurify.sanitize(rawHtml);
}

/**
 * Generate complete HTML document with styles
 */
export function generateHtmlDocument(
  markdown: string,
  title: string = "Document",
  includeStyles: boolean = true
): string {
  const htmlContent = markdownToHtml(markdown);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${includeStyles ? `<style>${EXPORT_CSS}</style>` : ""}
</head>
<body>
${htmlContent}
</body>
</html>`;
}

/**
 * Escape HTML special characters
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
 * Export markdown to HTML file
 */
export async function exportToHtml(
  markdown: string,
  defaultName: string = "document"
): Promise<boolean> {
  try {
    const path = await save({
      defaultPath: `${defaultName}.html`,
      filters: [{ name: "HTML", extensions: ["html", "htm"] }],
    });

    if (!path) return false;

    const title = defaultName.replace(/\.[^.]+$/, "");
    const html = generateHtmlDocument(markdown, title);

    await writeTextFile(path, html);
    return true;
  } catch (error) {
    console.error("Failed to export HTML:", error);
    return false;
  }
}

/**
 * Export markdown to PDF via print dialog
 * Opens a preview window that the user can print to PDF
 */
export async function exportToPdf(
  markdown: string,
  title: string = "Document"
): Promise<void> {
  try {
    // Check if preview window already exists
    const existing = await WebviewWindow.getByLabel("print-preview");
    if (existing) {
      await existing.close();
    }

    // Store content in localStorage for print preview window to read
    localStorage.setItem("vmark-print-content", markdown);

    // Create new print preview window
    new WebviewWindow("print-preview", {
      url: "/print-preview",
      title: `Print - ${title}`,
      width: 800,
      height: 900,
      center: true,
      resizable: true,
    });
  } catch (error) {
    console.error("Failed to export PDF:", error);
  }
}

/**
 * Copy HTML to clipboard
 */
export async function copyAsHtml(markdown: string): Promise<boolean> {
  try {
    const html = markdownToHtml(markdown);
    await writeText(html);
    return true;
  } catch (error) {
    console.error("Failed to copy HTML:", error);
    return false;
  }
}

/**
 * Export markdown to PDF file directly (using html2pdf.js)
 */
export async function savePdf(
  markdown: string,
  defaultName: string = "document"
): Promise<boolean> {
  try {
    const path = await save({
      defaultPath: `${defaultName}.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });

    if (!path) return false;

    // Create a temporary container for rendering
    const container = document.createElement("div");
    container.innerHTML = markdownToHtml(markdown);
    container.style.cssText = `
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #1f2328;
      padding: 20px;
      max-width: 100%;
    `;

    // Apply inline styles to elements for PDF rendering
    applyPdfStyles(container);

    // Generate PDF blob
    const pdfBlob = await html2pdf()
      .set({
        margin: [15, 15, 15, 15],
        filename: defaultName,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(container)
      .outputPdf("blob");

    // Convert blob to Uint8Array and save via Tauri
    const arrayBuffer = await pdfBlob.arrayBuffer();
    await writeFile(path, new Uint8Array(arrayBuffer));

    return true;
  } catch (error) {
    console.error("Failed to save PDF:", error);
    return false;
  }
}

/**
 * Apply inline styles for PDF rendering
 */
function applyPdfStyles(container: HTMLElement): void {
  // Headings
  container.querySelectorAll("h1").forEach((el) => {
    (el as HTMLElement).style.cssText =
      "font-size: 24px; font-weight: 600; margin: 20px 0 12px; border-bottom: 1px solid #d1d5da; padding-bottom: 8px;";
  });
  container.querySelectorAll("h2").forEach((el) => {
    (el as HTMLElement).style.cssText =
      "font-size: 20px; font-weight: 600; margin: 18px 0 10px; border-bottom: 1px solid #d1d5da; padding-bottom: 6px;";
  });
  container.querySelectorAll("h3").forEach((el) => {
    (el as HTMLElement).style.cssText =
      "font-size: 16px; font-weight: 600; margin: 16px 0 8px;";
  });
  container.querySelectorAll("h4, h5, h6").forEach((el) => {
    (el as HTMLElement).style.cssText =
      "font-size: 14px; font-weight: 600; margin: 14px 0 6px;";
  });

  // Code blocks
  container.querySelectorAll("pre").forEach((el) => {
    (el as HTMLElement).style.cssText =
      "background-color: #f6f8fa; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 12px; overflow: auto; white-space: pre-wrap; word-wrap: break-word;";
  });
  container.querySelectorAll("code").forEach((el) => {
    if ((el as HTMLElement).parentElement?.tagName !== "PRE") {
      (el as HTMLElement).style.cssText =
        "background-color: #f6f8fa; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px;";
    }
  });

  // Blockquotes
  container.querySelectorAll("blockquote").forEach((el) => {
    (el as HTMLElement).style.cssText =
      "margin: 0 0 12px 0; padding: 0 12px; color: #656d76; border-left: 4px solid #d1d5da;";
  });

  // Tables
  container.querySelectorAll("table").forEach((el) => {
    (el as HTMLElement).style.cssText =
      "border-collapse: collapse; width: 100%; margin-bottom: 12px;";
  });
  container.querySelectorAll("th, td").forEach((el) => {
    (el as HTMLElement).style.cssText =
      "padding: 6px 12px; border: 1px solid #d1d5da;";
  });
  container.querySelectorAll("th").forEach((el) => {
    (el as HTMLElement).style.cssText +=
      "font-weight: 600; background-color: #f6f8fa;";
  });

  // Links
  container.querySelectorAll("a").forEach((el) => {
    (el as HTMLElement).style.cssText = "color: #0969da; text-decoration: none;";
  });

  // Horizontal rules
  container.querySelectorAll("hr").forEach((el) => {
    (el as HTMLElement).style.cssText =
      "height: 2px; margin: 20px 0; background-color: #d1d5da; border: 0;";
  });

  // Images
  container.querySelectorAll("img").forEach((el) => {
    (el as HTMLElement).style.cssText = "max-width: 100%; height: auto;";
  });
}
