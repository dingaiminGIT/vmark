/**
 * Tab Utility Functions
 *
 * Shared functions for tab operations including dirty state checks
 * and confirmation dialogs before closing tabs with unsaved changes.
 */

import { ask } from "@tauri-apps/plugin-dialog";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useTabStore } from "@/stores/tabStore";
import { useDocumentStore } from "@/stores/documentStore";
import { useRecentFilesStore } from "@/stores/recentFilesStore";
import { getDirectory } from "@/utils/pathUtils";

/**
 * Get the folder path from any saved file in the same window.
 * Used as default location for Save dialog on untitled documents.
 */
export function getDefaultSaveFolder(windowLabel: string): string | undefined {
  const tabs = useTabStore.getState().tabs[windowLabel] ?? [];
  for (const tab of tabs) {
    const doc = useDocumentStore.getState().getDocument(tab.id);
    if (doc?.filePath) {
      const dir = getDirectory(doc.filePath);
      if (dir) return dir;
    }
  }
  return undefined;
}

/**
 * Close a tab with dirty check. If the document has unsaved changes,
 * prompts the user to save, don't save, or cancel.
 *
 * @returns true if tab was closed, false if user cancelled
 */
export async function closeTabWithDirtyCheck(
  windowLabel: string,
  tabId: string
): Promise<boolean> {
  const doc = useDocumentStore.getState().getDocument(tabId);
  const tab = useTabStore.getState().tabs[windowLabel]?.find((t) => t.id === tabId);

  if (!doc || !tab) return false;

  // If not dirty, close immediately
  if (!doc.isDirty) {
    useTabStore.getState().closeTab(windowLabel, tabId);
    useDocumentStore.getState().removeDocument(tabId);
    return true;
  }

  // Prompt user for dirty document
  const shouldSave = await ask(
    `Do you want to save changes to "${doc.filePath || tab.title}"?`,
    {
      title: "Unsaved Changes",
      kind: "warning",
      okLabel: "Save",
      cancelLabel: "Don't Save",
    }
  );

  // User pressed Escape - cancel close
  if (shouldSave === null) {
    return false;
  }

  // User chose "Don't Save" - close without saving
  if (!shouldSave) {
    useTabStore.getState().closeTab(windowLabel, tabId);
    useDocumentStore.getState().removeDocument(tabId);
    return true;
  }

  // User chose "Save"
  let path = doc.filePath;
  if (!path) {
    const defaultFolder = getDefaultSaveFolder(windowLabel);
    const newPath = await save({
      defaultPath: defaultFolder,
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (!newPath) {
      // User cancelled save dialog - cancel close
      return false;
    }
    path = newPath;
  }

  try {
    await writeTextFile(path, doc.content);
    useRecentFilesStore.getState().addFile(path);
    useTabStore.getState().closeTab(windowLabel, tabId);
    useDocumentStore.getState().removeDocument(tabId);
    return true;
  } catch (error) {
    console.error("Failed to save file:", error);
    const { message } = await import("@tauri-apps/plugin-dialog");
    await message(`Failed to save file: ${error}`, {
      title: "Error",
      kind: "error",
    });
    return false;
  }
}

/**
 * Close multiple tabs with dirty checks.
 * Prompts for each dirty tab. If user cancels any, stops and returns false.
 *
 * @returns true if all tabs were closed, false if user cancelled any
 */
export async function closeTabsWithDirtyCheck(
  windowLabel: string,
  tabIds: string[]
): Promise<boolean> {
  for (const tabId of tabIds) {
    const closed = await closeTabWithDirtyCheck(windowLabel, tabId);
    if (!closed) {
      return false; // User cancelled - stop closing
    }
  }
  return true;
}
