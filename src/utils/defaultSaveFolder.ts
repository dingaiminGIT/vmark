/**
 * Default save folder resolution
 *
 * Determines the default folder for Save dialogs with a three-tier precedence:
 * 1. Workspace root (if in workspace mode)
 * 2. First saved tab's folder in the window
 * 3. Home directory
 *
 * @module utils/defaultSaveFolder
 */
import { homeDir } from "@tauri-apps/api/path";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useTabStore } from "@/stores/tabStore";
import { useDocumentStore } from "@/stores/documentStore";
import { getDirectory } from "@/utils/pathUtils";

/**
 * Get the default save folder with fallback logic.
 *
 * Precedence:
 * 1. Workspace root - if the window is in workspace mode
 * 2. Saved tab folder - folder of any saved file in the window
 * 3. Home directory - user's home folder
 *
 * @param windowLabel - The window label to check for saved tabs
 * @returns The resolved default folder path
 *
 * @example
 * // In workspace mode - returns workspace root
 * const folder = await getDefaultSaveFolderWithFallback("main");
 * // Returns "/workspace/project"
 *
 * @example
 * // No workspace but has saved tab
 * const folder = await getDefaultSaveFolderWithFallback("main");
 * // Returns "/docs/notes" (from saved file "/docs/notes/file.md")
 *
 * @example
 * // New window with no saved tabs
 * const folder = await getDefaultSaveFolderWithFallback("doc-1");
 * // Returns "/Users/username"
 */
export async function getDefaultSaveFolderWithFallback(
  windowLabel: string
): Promise<string> {
  // 1. Check workspace root first
  const { isWorkspaceMode, rootPath } = useWorkspaceStore.getState();
  if (isWorkspaceMode && rootPath) {
    return rootPath;
  }

  // 2. Check for any saved tab in this window
  const tabs = useTabStore.getState().tabs[windowLabel] ?? [];
  for (const tab of tabs) {
    const doc = useDocumentStore.getState().getDocument(tab.id);
    if (doc?.filePath) {
      const dir = getDirectory(doc.filePath);
      if (dir) return dir;
    }
  }

  // 3. Fall back to home directory
  return await homeDir();
}
