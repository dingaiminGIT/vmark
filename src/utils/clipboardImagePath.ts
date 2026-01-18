/**
 * Clipboard Image Path Helper
 *
 * Provides async clipboard reading with image path detection.
 * Validates local paths with filesystem existence check.
 */

import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { exists } from "@tauri-apps/plugin-fs";
import { homeDir, join } from "@tauri-apps/api/path";
import { detectImagePath, type ImagePathResult } from "./imagePathDetection";

/**
 * Extended result with validation status.
 */
export interface ClipboardImagePathResult extends ImagePathResult {
  /** Whether the path was validated (for local paths) */
  validated: boolean;
  /** Resolved absolute path (for home paths) */
  resolvedPath: string | null;
}

/**
 * Expand home path (~/) to absolute path.
 */
async function expandHomePath(path: string): Promise<string | null> {
  if (!path.startsWith("~/")) return path;

  try {
    const home = await homeDir();
    return join(home, path.slice(2));
  } catch {
    return null;
  }
}

/**
 * Validate that a local file path exists.
 */
async function validateLocalPath(path: string): Promise<boolean> {
  try {
    return await exists(path);
  } catch {
    return false;
  }
}

/**
 * Read clipboard and detect image path.
 * For local paths, validates existence with filesystem check.
 *
 * @returns Detection result with validation, or null if clipboard is empty/inaccessible
 *
 * @example
 * const result = await readClipboardImagePath();
 * if (result?.isImage) {
 *   if (result.needsCopy) {
 *     // Copy to assets folder first
 *     const relativePath = await copyImageToAssets(result.resolvedPath ?? result.path, docPath);
 *     insertImage(relativePath);
 *   } else {
 *     // Insert directly (URL or already relative)
 *     insertImage(result.path);
 *   }
 * }
 */
export async function readClipboardImagePath(): Promise<ClipboardImagePathResult | null> {
  try {
    // Try Tauri clipboard first
    let text = await readText();

    // Fallback to web clipboard API if Tauri returns empty
    if (!text && typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        text = await navigator.clipboard.readText();
      } catch {
        // Web clipboard may fail due to permissions
        return null;
      }
    }

    if (!text) {
      return null;
    }

    // Detect image path
    const detection = detectImagePath(text);

    if (!detection.isImage) {
      return {
        ...detection,
        validated: false,
        resolvedPath: null,
      };
    }

    // For URLs and data URLs, no validation needed
    if (detection.type === "url" || detection.type === "dataUrl") {
      return {
        ...detection,
        validated: true,
        resolvedPath: null,
      };
    }

    // For home paths, expand and validate
    if (detection.type === "homePath") {
      const expanded = await expandHomePath(detection.path);
      if (!expanded) {
        return {
          ...detection,
          validated: false,
          resolvedPath: null,
        };
      }

      const fileExists = await validateLocalPath(expanded);
      return {
        ...detection,
        validated: fileExists,
        resolvedPath: fileExists ? expanded : null,
      };
    }

    // For absolute paths, validate directly
    if (detection.type === "absolutePath") {
      const fileExists = await validateLocalPath(detection.path);
      return {
        ...detection,
        validated: fileExists,
        resolvedPath: fileExists ? detection.path : null,
      };
    }

    // For relative paths, we can't validate without document path
    // Validation will happen at insert time
    if (detection.type === "relativePath") {
      return {
        ...detection,
        validated: true, // Assume valid, will fail gracefully at render
        resolvedPath: null,
      };
    }

    return {
      ...detection,
      validated: false,
      resolvedPath: null,
    };
  } catch {
    // Clipboard access failed
    return null;
  }
}

/**
 * Check if clipboard contains a valid image path.
 * Quick check without full validation.
 */
export async function hasClipboardImagePath(): Promise<boolean> {
  const result = await readClipboardImagePath();
  return result?.isImage === true && result.validated;
}
