/**
 * Hook for handling drag-and-drop file opening
 *
 * Listens to Tauri's drag-drop events and opens dropped markdown files
 * in new tabs in the current window.
 *
 * @module hooks/useDragDropOpen
 */
import { useEffect, useRef } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useWindowLabel } from "@/contexts/WindowContext";
import { useTabStore } from "@/stores/tabStore";
import { useDocumentStore } from "@/stores/documentStore";
import { useRecentFilesStore } from "@/stores/recentFilesStore";
import { filterMarkdownPaths } from "@/utils/dropPaths";

/**
 * Opens a file in a new tab.
 *
 * @param windowLabel - The window to open the file in
 * @param path - The file path to open
 */
async function openFileInNewTab(windowLabel: string, path: string): Promise<void> {
  try {
    const content = await readTextFile(path);
    const tabId = useTabStore.getState().createTab(windowLabel, path);
    useDocumentStore.getState().initDocument(tabId, content, path);
    useRecentFilesStore.getState().addFile(path);
  } catch (error) {
    console.error("[DragDrop] Failed to open file:", path, error);
  }
}

/**
 * Hook to handle drag-and-drop file opening.
 *
 * When markdown files (.md, .markdown, .txt) are dropped onto the window,
 * they are opened in new tabs. Non-markdown files are silently ignored.
 *
 * @example
 * function DocumentWindow() {
 *   useDragDropOpen();
 *   return <Editor />;
 * }
 */
export function useDragDropOpen(): void {
  const windowLabel = useWindowLabel();
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    const setupDragDrop = async () => {
      const webview = getCurrentWebview();

      const unlisten = await webview.onDragDropEvent(async (event) => {
        if (cancelled) return;

        // Only handle drop events (not hover/leave)
        if (event.payload.type !== "drop") return;

        const paths = event.payload.paths;
        const markdownPaths = filterMarkdownPaths(paths);

        // Open each markdown file in a new tab (concurrently but tracked)
        await Promise.all(
          markdownPaths.map((path) => openFileInNewTab(windowLabel, path))
        );
      });

      if (cancelled) {
        unlisten();
        return;
      }

      unlistenRef.current = unlisten;
    };

    setupDragDrop();

    return () => {
      cancelled = true;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [windowLabel]);
}
