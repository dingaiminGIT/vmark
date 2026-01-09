/**
 * Drag-and-drop file path filtering utilities
 *
 * Filters dropped file paths to only include markdown-compatible files.
 *
 * @module utils/dropPaths
 */

/** Supported markdown file extensions (lowercase) */
export const MARKDOWN_EXTENSIONS = [".md", ".markdown", ".txt"] as const;

/**
 * Filter an array of file paths to only include markdown-compatible files.
 *
 * Checks file extensions against MARKDOWN_EXTENSIONS (case-insensitive).
 * Non-matching files are silently ignored.
 *
 * @param paths - Array of file paths from drag-drop event
 * @returns Array of paths with markdown-compatible extensions
 *
 * @example
 * filterMarkdownPaths(["/docs/readme.md", "/docs/image.png"])
 * // Returns: ["/docs/readme.md"]
 *
 * @example
 * filterMarkdownPaths(["/notes/TODO.TXT", "/notes/data.json"])
 * // Returns: ["/notes/TODO.TXT"] (case-insensitive matching)
 */
export function filterMarkdownPaths(paths: string[] | null | undefined): string[] {
  if (!paths || !Array.isArray(paths)) {
    return [];
  }

  return paths.filter((path) => {
    const lowerPath = path.toLowerCase();
    return MARKDOWN_EXTENSIONS.some((ext) => lowerPath.endsWith(ext));
  });
}
