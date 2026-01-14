import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { ask } from "@tauri-apps/plugin-dialog";
import { useDocumentStore } from "../stores/documentStore";
import { useWindowLabel } from "../contexts/WindowContext";

// Dev-only logging for debugging quit issues
const quitLog = import.meta.env.DEV
  ? (label: string, ...args: unknown[]) => console.log(`[AppQuit:${label}]`, ...args)
  : () => {};

// Re-entry guard for quit handling (prevents duplicate dialogs)
let isQuittingRef = false;

/**
 * Handle app quit request with confirmation for unsaved documents.
 * Only the main window handles quit confirmation to avoid duplicate dialogs.
 */
export function useAppQuit() {
  const windowLabel = useWindowLabel();

  useEffect(() => {
    quitLog(windowLabel, "useAppQuit effect running");
    // Only main window handles quit confirmation
    if (windowLabel !== "main") {
      quitLog(windowLabel, "not main window, skipping quit handling");
      return;
    }

    const handleQuitRequest = async () => {
      quitLog(windowLabel, "handleQuitRequest called");
      // Prevent re-entry (duplicate dialogs from rapid Cmd+Q)
      if (isQuittingRef) {
        quitLog(windowLabel, "already quitting, ignoring");
        return;
      }
      isQuittingRef = true;

      try {
        const dirtyTabs = useDocumentStore.getState().getAllDirtyDocuments();

        if (dirtyTabs.length === 0) {
          // No unsaved documents - quit immediately
          await invoke("force_quit");
          return;
        }

        // Ask user for confirmation
        const confirmed = await ask(
          `You have ${dirtyTabs.length} unsaved document(s). Quit without saving?`,
          {
            title: "Unsaved Changes",
            kind: "warning",
            okLabel: "Quit",
            cancelLabel: "Cancel",
          }
        );

        if (confirmed) {
          await invoke("force_quit");
        }
      } catch (error) {
        console.error("Failed to quit application:", error);
      } finally {
        isQuittingRef = false;
      }
    };

    // Global listen is fine for app-wide events
    const unlistenPromise = listen("app:quit-requested", handleQuitRequest);

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [windowLabel]);
}
