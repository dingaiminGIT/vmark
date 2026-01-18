/**
 * Image Path Detection Utility
 *
 * Detects image URLs and local file paths in text.
 * Used for smart image insertion from clipboard.
 */

/**
 * Supported image file extensions.
 */
export const IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".bmp",
  ".ico",
];

/**
 * Result of image path detection.
 */
export interface ImagePathResult {
  /** Whether a valid image path was detected */
  isImage: boolean;
  /** Type of path detected */
  type: "url" | "dataUrl" | "absolutePath" | "relativePath" | "homePath" | "none";
  /** The detected path (first line, trimmed) */
  path: string;
  /** Whether the path needs to be copied to assets folder */
  needsCopy: boolean;
  /** Original input text */
  originalText: string;
}

/**
 * Check if a path has an image file extension.
 * Handles URLs with query params and fragments.
 */
export function hasImageExtension(path: string): boolean {
  // Remove query params and fragments for extension check
  const cleanPath = path.toLowerCase().split("?")[0].split("#")[0];
  return IMAGE_EXTENSIONS.some((ext) => cleanPath.endsWith(ext));
}

/**
 * Check if text is a data: URL for images.
 */
function isDataImageUrl(text: string): boolean {
  return text.startsWith("data:image/");
}

/**
 * Check if text is an HTTP/HTTPS URL.
 */
function isHttpUrl(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.startsWith("http://") || lower.startsWith("https://");
}

/**
 * Check if text is a file:// URL.
 * Handles both file:// and file:/// formats.
 */
function isFileUrl(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.startsWith("file://");
}

/**
 * Check if text is an absolute Unix path.
 * e.g., /Users/name/photo.png
 */
function isUnixAbsolutePath(text: string): boolean {
  return text.startsWith("/") && !text.startsWith("//");
}

/**
 * Check if text is an absolute Windows path.
 * e.g., C:\Users\name\photo.png or C:/Users/name/photo.png
 */
function isWindowsAbsolutePath(text: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(text);
}

/**
 * Check if text is a home directory path.
 * e.g., ~/Pictures/photo.png
 */
function isHomePath(text: string): boolean {
  return text.startsWith("~/");
}

/**
 * Check if text is a relative path.
 * e.g., ./assets/image.png or ../images/photo.jpg
 */
function isRelativePath(text: string): boolean {
  return text.startsWith("./") || text.startsWith("../");
}

/**
 * Detect and classify an image path from text.
 *
 * @param text - The text to check for image path patterns
 * @returns Detection result with path type and metadata
 *
 * @example
 * detectImagePath("https://example.com/photo.png")
 * // { isImage: true, type: "url", path: "https://...", needsCopy: false }
 *
 * detectImagePath("/Users/name/photo.jpg")
 * // { isImage: true, type: "absolutePath", path: "/Users/...", needsCopy: true }
 *
 * detectImagePath("./assets/image.png")
 * // { isImage: true, type: "relativePath", path: "./assets/...", needsCopy: false }
 */
export function detectImagePath(text: string): ImagePathResult {
  const trimmed = text.trim();

  // Empty text
  if (!trimmed) {
    return { isImage: false, type: "none", path: "", needsCopy: false, originalText: text };
  }

  // Only use first line (for multi-line clipboard content)
  const firstLine = trimmed.split("\n")[0].trim();
  if (!firstLine) {
    return { isImage: false, type: "none", path: "", needsCopy: false, originalText: text };
  }

  // Check for data: image URL (always valid, no extension check needed)
  if (isDataImageUrl(firstLine)) {
    return {
      isImage: true,
      type: "dataUrl",
      path: firstLine,
      needsCopy: false,
      originalText: text,
    };
  }

  // For all other types, require image extension
  if (!hasImageExtension(firstLine)) {
    return { isImage: false, type: "none", path: "", needsCopy: false, originalText: text };
  }

  // HTTP/HTTPS URL
  if (isHttpUrl(firstLine)) {
    return {
      isImage: true,
      type: "url",
      path: firstLine,
      needsCopy: false,
      originalText: text,
    };
  }

  // file:// URL - treat as absolute path, needs copy
  // Handle both file:// and file:/// (triple slash for absolute paths)
  if (isFileUrl(firstLine)) {
    // Remove file:// or file:/// prefix, handling both formats
    const path = firstLine.replace(/^file:\/\/\/?/, "");
    return {
      isImage: true,
      type: "absolutePath",
      path,
      needsCopy: true,
      originalText: text,
    };
  }

  // Absolute Unix path
  if (isUnixAbsolutePath(firstLine)) {
    return {
      isImage: true,
      type: "absolutePath",
      path: firstLine,
      needsCopy: true,
      originalText: text,
    };
  }

  // Absolute Windows path
  if (isWindowsAbsolutePath(firstLine)) {
    return {
      isImage: true,
      type: "absolutePath",
      path: firstLine,
      needsCopy: true,
      originalText: text,
    };
  }

  // Home path
  if (isHomePath(firstLine)) {
    return {
      isImage: true,
      type: "homePath",
      path: firstLine,
      needsCopy: true,
      originalText: text,
    };
  }

  // Relative path
  if (isRelativePath(firstLine)) {
    return {
      isImage: true,
      type: "relativePath",
      path: firstLine,
      needsCopy: false, // Already relative, just verify and insert
      originalText: text,
    };
  }

  // Not a recognized image path
  return { isImage: false, type: "none", path: "", needsCopy: false, originalText: text };
}

/**
 * Quick check if text might be an image path (without full classification).
 * Useful for fast filtering before detailed detection.
 */
export function looksLikeImagePath(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const firstLine = trimmed.split("\n")[0].trim();
  if (!firstLine) return false;

  // Data URL
  if (firstLine.startsWith("data:image/")) return true;

  // Check for image extension
  return hasImageExtension(firstLine);
}
