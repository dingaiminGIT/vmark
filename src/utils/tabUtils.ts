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
import { getDefaultSaveFolderWithFallback } from "@/utils/defaultSaveFolder";

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

  // Tab or document doesn't exist - treat as already closed
  if (!doc || !tab) return true;

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
    const defaultFolder = await getDefaultSaveFolderWithFallback(windowLabel);
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
