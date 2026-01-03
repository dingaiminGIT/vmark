import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useWorkspaceStore, type WorkspaceConfig } from "@/stores/workspaceStore";
import { useUIStore } from "@/stores/uiStore";
import { useTabStore } from "@/stores/tabStore";
import { useDocumentStore } from "@/stores/documentStore";

/**
 * Hook to handle workspace-related menu events
 * Extracted from useMenuEvents to keep file under 300 lines
 */
export function useWorkspaceMenuEvents() {
  const unlistenRefs = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    let cancelled = false;

    const setupListeners = async () => {
      // Clean up any existing listeners first
      unlistenRefs.current.forEach((fn) => fn());
      unlistenRefs.current = [];

      if (cancelled) return;

      // Open Folder
      const unlistenOpenFolder = await listen("menu:open-folder", async () => {
        try {
          const path = await invoke<string | null>("open_folder_dialog");
          if (!path) return;

          // Try to read existing config
          const existing = await invoke<WorkspaceConfig | null>(
            "read_workspace_config",
            { rootPath: path }
          );
          useWorkspaceStore.getState().openWorkspace(path, existing);
          // Show sidebar with files view
          useUIStore.getState().showSidebarWithView("files");

          // Restore tabs from lastOpenTabs if available
          if (existing?.lastOpenTabs && existing.lastOpenTabs.length > 0) {
            const windowLabel = getCurrentWebviewWindow().label;

            for (const filePath of existing.lastOpenTabs) {
              try {
                const content = await readTextFile(filePath);
                const tabId = useTabStore.getState().createTab(windowLabel, filePath);
                useDocumentStore.getState().initDocument(tabId, content, filePath);
              } catch {
                // File may have been moved/deleted - skip it
                console.warn(`[Workspace] Could not restore tab: ${filePath}`);
              }
            }
          }
        } catch (error) {
          console.error("Failed to open folder:", error);
        }
      });
      if (cancelled) {
        unlistenOpenFolder();
        return;
      }
      unlistenRefs.current.push(unlistenOpenFolder);

      // Close Workspace - save open tabs before closing
      const unlistenCloseWorkspace = await listen(
        "menu:close-workspace",
        async () => {
          const { rootPath, config, isWorkspaceMode } =
            useWorkspaceStore.getState();

          if (isWorkspaceMode && rootPath && config) {
            // Save current open tabs
            const windowLabel = getCurrentWebviewWindow().label;
            const tabs = useTabStore.getState().getTabsByWindow(windowLabel);
            const openPaths = tabs
              .filter((t) => t.filePath !== null)
              .map((t) => t.filePath as string);

            // Update and save config
            const updatedConfig = { ...config, lastOpenTabs: openPaths };
            try {
              await invoke("write_workspace_config", {
                rootPath,
                config: updatedConfig,
              });
            } catch (error) {
              console.error("Failed to save workspace config:", error);
            }
          }

          useWorkspaceStore.getState().closeWorkspace();
        }
      );
      if (cancelled) {
        unlistenCloseWorkspace();
        return;
      }
      unlistenRefs.current.push(unlistenCloseWorkspace);
    };

    setupListeners();

    return () => {
      cancelled = true;
      const fns = unlistenRefs.current;
      unlistenRefs.current = [];
      fns.forEach((fn) => fn());
    };
  }, []);
}
