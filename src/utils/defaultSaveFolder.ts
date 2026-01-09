/**
 * Default save folder resolution
 *
 * Pure helpers for determining the default folder for Save dialogs.
 * The async wrapper that gathers data from stores/Tauri lives in hooks layer.
 *
 * Precedence:
 * 1. Workspace root (if in workspace mode)
 * 2. Home directory (when not in workspace mode)
 * 3. Saved tab's folder (edge case: workspace mode but no root)
 *
 * @module utils/defaultSaveFolder
 */
import { getDirectory } from "@/utils/pathUtils";

/**
 * Input for default save folder resolution.
 * All data is pre-gathered by the caller (hook layer).
 */
export interface DefaultSaveFolderInput {
  /** Whether the window is in workspace mode */
  isWorkspaceMode: boolean;
  /** Workspace root path (if in workspace mode) */
  workspaceRoot: string | null;
  /** File paths of saved tabs in this window (in order) */
  savedFilePaths: string[];
  /** User's home directory */
  homeDirectory: string;
}

/**
 * Resolve the default save folder.
 *
 * Pure function - takes all data as input, no side effects.
 *
 * Precedence:
 * 1. Workspace root - if in workspace mode with valid root
 * 2. Home directory - when not in workspace mode (prevents unexpected folders)
 * 3. Saved tab folder - edge case fallback when in workspace mode but no root
 *
 * @param input - Pre-gathered workspace and tab data
 * @returns The resolved default folder path
 *
 * @example
 * // In workspace mode - returns workspace root
 * resolveDefaultSaveFolder({
 *   isWorkspaceMode: true,
 *   workspaceRoot: "/workspace/project",
 *   savedFilePaths: [],
 *   homeDirectory: "/Users/test"
 * }); // Returns "/workspace/project"
 *
 * @example
 * // Not in workspace mode - returns home (ignores saved tabs)
 * resolveDefaultSaveFolder({
 *   isWorkspaceMode: false,
 *   workspaceRoot: null,
 *   savedFilePaths: ["/other/path/file.md"],
 *   homeDirectory: "/Users/test"
 * }); // Returns "/Users/test"
 */
export function resolveDefaultSaveFolder(input: DefaultSaveFolderInput): string {
  const { isWorkspaceMode, workspaceRoot, savedFilePaths, homeDirectory } = input;

  // 1. Workspace root first (if in workspace mode)
  if (isWorkspaceMode && workspaceRoot) {
    return workspaceRoot;
  }

  // 2. Not in workspace mode → use home directly
  //    This prevents save dialogs opening in unexpected folders
  if (!isWorkspaceMode) {
    return homeDirectory;
  }

  // 3. In workspace mode but no root (edge case) → try saved tabs
  for (const filePath of savedFilePaths) {
    const dir = getDirectory(filePath);
    if (dir) return dir;
  }

  // 4. Final fallback: Home directory
  return homeDirectory;
}

// Note: The async wrapper getDefaultSaveFolderWithFallback is now in
// @/hooks/useDefaultSaveFolder. Import from there for Tauri/store integration.
