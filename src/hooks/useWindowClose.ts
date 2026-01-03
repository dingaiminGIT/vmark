import { useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useWindowLabel } from "../contexts/WindowContext";
import { useDocumentStore } from "../stores/documentStore";
import { useTabStore } from "../stores/tabStore";
import { useRecentFilesStore } from "../stores/recentFilesStore";
import { getDefaultSaveFolder } from "@/utils/tabUtils";

/**
 * Handle window close with save confirmation dialog.
 * Listens to both:
 * - menu:close (Cmd+W) - global event, checks if this window is focused
 * - window:close-requested (traffic light) - window-specific from Rust
 */
export function useWindowClose() {
  const windowLabel = useWindowLabel();
  // Prevent re-entry during close handling (avoids duplicate dialogs)
  const isClosingRef = useRef(false);

  const handleCloseRequest = useCallback(async () => {
    // Guard against duplicate close requests
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    try {
      // Get all tabs for this window
      const tabs = useTabStore.getState().tabs[windowLabel] ?? [];

      // Check if any tabs have unsaved changes
      const dirtyTabs = tabs.filter((tab) => {
        const doc = useDocumentStore.getState().getDocument(tab.id);
        return doc?.isDirty;
      });

      // If no dirty tabs, just close
      if (dirtyTabs.length === 0) {
        tabs.forEach((tab) => useDocumentStore.getState().removeDocument(tab.id));
        await invoke("close_window", { label: windowLabel });
        return;
      }

      const { ask, message } = await import("@tauri-apps/plugin-dialog");

      // Process each dirty tab - prompt user for each one
      for (const dirtyTab of dirtyTabs) {
        const doc = useDocumentStore.getState().getDocument(dirtyTab.id);
        if (!doc?.isDirty) continue; // May have been saved in a previous iteration

        const shouldSave = await ask(
          `Do you want to save changes to "${doc.filePath || dirtyTab.title}"?`,
          {
            title: "Unsaved Changes",
            kind: "warning",
            okLabel: "Save",
            cancelLabel: "Don't Save",
          }
        );

        // User closed dialog (Escape) - cancel window close entirely
        if (shouldSave === null) {
          return;
        }

        if (shouldSave) {
          let path = doc.filePath;
          if (!path) {
            const newPath = await save({
              defaultPath: getDefaultSaveFolder(windowLabel),
              filters: [{ name: "Markdown", extensions: ["md"] }],
            });
            if (!newPath) {
              // User cancelled save dialog - cancel window close
              return;
            }
            path = newPath;
          }

          try {
            await writeTextFile(path, doc.content);
            useRecentFilesStore.getState().addFile(path);
          } catch (error) {
            await message(`Failed to save file: ${error}`, {
              title: "Error",
              kind: "error",
            });
            return;
          }
        }
        // If shouldSave is false, user chose "Don't Save" - continue to next tab
      }

      // All dirty tabs handled - close the window
      tabs.forEach((tab) => useDocumentStore.getState().removeDocument(tab.id));
      await invoke("close_window", { label: windowLabel });
    } catch (error) {
      console.error("Failed to close window:", error);
    } finally {
      isClosingRef.current = false;
    }
  }, [windowLabel]);

  useEffect(() => {
    const currentWindow = getCurrentWebviewWindow();
    const unlisteners: (() => void)[] = [];

    const setup = async () => {
      // Listen to menu:close (Cmd+W) - only handle if this window is focused
      const unlistenMenu = await listen("menu:close", async () => {
        const isFocused = await currentWindow.isFocused();
        if (isFocused) {
          handleCloseRequest();
        }
      });
      unlisteners.push(unlistenMenu);

      // Listen to window:close-requested (traffic light button)
      // CRITICAL: Use window-specific listener
      const unlistenClose = await currentWindow.listen(
        "window:close-requested",
        handleCloseRequest
      );
      unlisteners.push(unlistenClose);
    };

    setup();

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, [windowLabel, handleCloseRequest]);
}
