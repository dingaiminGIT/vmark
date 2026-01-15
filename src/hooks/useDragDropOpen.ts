/**
 * Hook for handling drag-and-drop file opening
 *
 * Listens to Tauri's drag-drop events and opens dropped markdown files.
 * Files within the current workspace open in new tabs; files outside
 * the workspace open in a new window with the file's folder as workspace.
 *
 * @module hooks/useDragDropOpen
 */
import { useEffect, useRef } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { useWindowLabel } from "@/contexts/WindowContext";
import { useTabStore } from "@/stores/tabStore";
import { useDocumentStore } from "@/stores/documentStore";
import { useRecentFilesStore } from "@/stores/recentFilesStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { filterMarkdownPaths } from "@/utils/dropPaths";
import { resolveOpenAction } from "@/utils/openPolicy";
import { getReplaceableTab, findExistingTabForPath } from "@/hooks/useReplaceableTab";

/**
 * Opens a file in a new tab (or activates existing tab if already open).
 *
 * @param windowLabel - The window to open the file in
 * @param path - The file path to open
 */
async function openFileInNewTab(windowLabel: string, path: string): Promise<void> {
  // Check for existing tab first
  const existingTabId = findExistingTabForPath(windowLabel, path);
  if (existingTabId) {
    useTabStore.getState().setActiveTab(windowLabel, existingTabId);
    return;
  }

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

        // Get current workspace state for policy decisions
        const { isWorkspaceMode, rootPath } = useWorkspaceStore.getState();

        // Check for replaceable tab (single clean untitled tab)
        const replaceableTab = getReplaceableTab(windowLabel);

        // Open each markdown file using the policy
        await Promise.all(
          markdownPaths.map(async (path) => {
            const existingTabId = findExistingTabForPath(windowLabel, path);

            const decision = resolveOpenAction({
              filePath: path,
              workspaceRoot: rootPath,
              isWorkspaceMode,
              existingTabId,
              replaceableTab,
            });

            switch (decision.action) {
              case "activate_tab":
                useTabStore.getState().setActiveTab(windowLabel, decision.tabId);
                break;
              case "create_tab":
                await openFileInNewTab(windowLabel, path);
                break;
              case "replace_tab":
                // Replace the clean untitled tab with the file content
                try {
                  const content = await readTextFile(path);
                  useTabStore.getState().updateTabPath(decision.tabId, decision.filePath);
                  useDocumentStore.getState().loadContent(decision.tabId, content, decision.filePath);
                  useWorkspaceStore.getState().openWorkspace(decision.workspaceRoot);
                  useRecentFilesStore.getState().addFile(path);
                } catch (error) {
                  console.error("[DragDrop] Failed to replace tab with file:", path, error);
                }
                break;
              case "open_workspace_in_new_window":
                try {
                  await invoke("open_workspace_in_new_window", {
                    workspaceRoot: decision.workspaceRoot,
                    filePath: decision.filePath,
                  });
                } catch (error) {
                  console.error("[DragDrop] Failed to open workspace in new window:", path, error);
                }
                break;
              case "no_op":
                break;
            }
          })
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
