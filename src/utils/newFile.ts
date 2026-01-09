/**
 * Utility for creating new untitled files
 *
 * Creates a new tab and initializes an empty document for it.
 * Used by the menu:new handler to create files in the current window.
 *
 * @module utils/newFile
 */
import { useTabStore } from "@/stores/tabStore";
import { useDocumentStore } from "@/stores/documentStore";

/**
 * Create a new untitled tab with an empty document.
 *
 * @param windowLabel - The window label where the tab should be created
 * @returns The ID of the newly created tab
 *
 * @example
 * const tabId = createUntitledTab("main");
 * // Creates a new tab with empty content, no file path
 */
export function createUntitledTab(windowLabel: string): string {
  const tabId = useTabStore.getState().createTab(windowLabel, null);
  useDocumentStore.getState().initDocument(tabId, "", null);
  return tabId;
}
