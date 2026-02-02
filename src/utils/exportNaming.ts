/**
 * Export Naming Utilities
 *
 * Utilities for determining default folder names when exporting documents.
 * Extracts titles from markdown and sanitizes for filesystem use.
 *
 * @module utils/exportNaming
 */

/**
 * Characters invalid in file/folder names across platforms.
 * - Windows: / \ : * ? " < > |
 * - macOS/Linux: / and null
 * We sanitize for all platforms to ensure portability.
 */
// eslint-disable-next-line no-control-regex
const INVALID_FILENAME_CHARS = /[/\\:*?"<>|\u0000-\u001f]/g;

/**
 * Windows reserved names that cannot be used as file/folder names.
 * Case-insensitive: CON, con, Con are all reserved.
 */
const WINDOWS_RESERVED_NAMES = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
]);

/**
 * Default maximum length for sanitized file names.
 * Most filesystems support 255 bytes, but we use a conservative limit
 * to account for multi-byte characters and path length limits.
 */
const DEFAULT_MAX_LENGTH = 80;

/**
 * When truncating at word boundary, how many characters back from the
 * max length to search for a space. Prevents awkward single-word truncation.
 */
const WORD_BOUNDARY_LOOKBACK = 20;

/**
 * Extract the first H1 heading from markdown content.
 *
 * Supports two H1 syntaxes:
 * 1. ATX style: `# Heading`
 * 2. Setext style: `Heading\n======`
 *
 * @param markdown - The markdown content
 * @returns The H1 text (trimmed) or null if no H1 found
 *
 * @example
 * extractFirstH1("# My Document\n\nContent") // "My Document"
 * extractFirstH1("Title\n===\n\nContent") // "Title"
 * extractFirstH1("## Only H2") // null
 */
export function extractFirstH1(markdown: string): string | null {
  if (!markdown || typeof markdown !== "string") {
    return null;
  }

  // ATX style: # Heading (must be at start of line)
  // Allows optional closing hashes: # Heading #
  const atxMatch = markdown.match(/^#\s+(.+?)(?:\s+#+)?$/m);
  if (atxMatch) {
    const title = atxMatch[1].trim();
    return title || null;
  }

  // Setext style: Heading\n======= (at least 1 equals sign)
  // The heading text must not be empty and must be on its own line
  const setextMatch = markdown.match(/^([^\n]+)\n=+\s*$/m);
  if (setextMatch) {
    const title = setextMatch[1].trim();
    // Ensure it's not a thematic break or other syntax
    if (title && !title.match(/^[-=_*#>]/)) {
      return title;
    }
  }

  return null;
}

/**
 * Sanitize a string for use as a file or folder name.
 *
 * Operations performed:
 * 1. Remove null bytes and control characters
 * 2. Convert tabs/newlines to spaces
 * 3. Replace invalid filesystem characters with dashes
 * 4. Remove leading/trailing dots (Windows issue)
 * 5. Remove leading/trailing whitespace
 * 6. Collapse multiple spaces/dashes
 * 7. Truncate to max length (at word boundary if possible)
 * 8. Handle Windows reserved names
 *
 * @param name - The raw name to sanitize
 * @param maxLength - Maximum length (default: 80)
 * @returns Sanitized name safe for filesystem use
 *
 * @example
 * sanitizeFileName("What/Why?") // "What-Why"
 * sanitizeFileName("  Spaces  ") // "Spaces"
 * sanitizeFileName("CON") // "CON_export"
 */
export function sanitizeFileName(
  name: string,
  maxLength: number = DEFAULT_MAX_LENGTH
): string {
  if (!name || typeof name !== "string") {
    return "";
  }

  let result = name
    // Remove null bytes completely (they're never valid)
    // eslint-disable-next-line no-control-regex
    .replace(/\u0000/g, "")
    // Convert tabs and newlines to spaces (they're whitespace, not invalid)
    .replace(/[\t\r\n]/g, " ")
    // Remove other control characters
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0001-\u001f\u007f]/g, "")
    // Replace invalid filesystem characters with dash
    .replace(INVALID_FILENAME_CHARS, "-")
    // Remove leading dots (hidden files on Unix, problematic on Windows)
    .replace(/^\.+/, "")
    // Remove trailing dots (Windows doesn't like these)
    .replace(/\.+$/, "")
    // Collapse multiple dashes
    .replace(/-+/g, "-")
    // Collapse multiple spaces
    .replace(/\s+/g, " ")
    // Remove leading/trailing dashes
    .replace(/^-+|-+$/g, "")
    // Final trim
    .trim();

  // Truncate if too long
  if (result.length > maxLength) {
    result = truncateAtWordBoundary(result, maxLength);
  }

  // Handle Windows reserved names
  if (WINDOWS_RESERVED_NAMES.has(result.toUpperCase())) {
    result = `${result}_export`;
  }

  // Handle reserved names with extensions (e.g., "CON.txt")
  const baseName = result.split(".")[0].toUpperCase();
  if (WINDOWS_RESERVED_NAMES.has(baseName) && result.includes(".")) {
    result = `${result}_export`;
  }

  return result;
}

/**
 * Truncate a string at a word boundary.
 *
 * @param text - The text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Try to find a space within the lookback window of the limit
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLength - WORD_BOUNDARY_LOOKBACK && lastSpace > 0) {
    return truncated.slice(0, lastSpace).trim();
  }

  // No good word boundary, just truncate and trim
  return truncated.trim();
}

/**
 * Get the default export folder name for a document.
 *
 * Priority:
 * 1. First H1 heading from markdown (sanitized)
 * 2. File name without extension (if file path provided)
 * 3. Fallback value (default: "Untitled")
 *
 * @param markdown - The document's markdown content
 * @param filePath - The document's file path (optional)
 * @param fallback - Fallback name if no title found (default: "Untitled")
 * @returns A filesystem-safe folder name
 *
 * @example
 * getExportFolderName("# My Doc", "/path/to/file.md") // "My Doc"
 * getExportFolderName("No heading", "/path/to/notes.md") // "notes"
 * getExportFolderName("No heading", null) // "Untitled"
 */
export function getExportFolderName(
  markdown: string,
  filePath: string | null | undefined,
  fallback: string = "Untitled"
): string {
  // Try H1 first
  const h1 = extractFirstH1(markdown);
  if (h1) {
    const sanitized = sanitizeFileName(h1);
    if (sanitized) {
      return sanitized;
    }
  }

  // Fall back to file name
  if (filePath) {
    const fileName = getFileNameWithoutExtension(filePath);
    if (fileName) {
      const sanitized = sanitizeFileName(fileName);
      if (sanitized) {
        return sanitized;
      }
    }
  }

  // Final fallback
  return fallback;
}

/**
 * Extract file name without extension from a path.
 * Handles both forward and back slashes.
 *
 * @param filePath - Full file path
 * @returns File name without extension
 */
function getFileNameWithoutExtension(filePath: string): string {
  if (!filePath) return "";

  // Get the last path component
  const parts = filePath.split(/[/\\]/);
  const fileName = parts[parts.length - 1] || "";

  // Remove extension
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex > 0) {
    return fileName.slice(0, dotIndex);
  }

  return fileName;
}
