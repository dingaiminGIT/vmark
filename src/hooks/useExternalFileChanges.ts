/**
 * Hook for handling external file changes
 *
 * Listens to file system change events and applies the policy:
 * - Clean documents: auto-reload silently
 * - Dirty documents: prompt user to choose
 * - Deleted files: mark as missing
 *
 * @module hooks/useExternalFileChanges
 */
import { useEffect, useRef, useCallback } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { ask, save } from "@tauri-apps/plugin-dialog";
import { useWindowLabel } from "@/contexts/WindowContext";
import { useDocumentStore } from "@/stores/documentStore";
import { useTabStore } from "@/stores/tabStore";
import { resolveExternalChangeAction } from "@/utils/openPolicy";
import { normalizePath } from "@/utils/paths";
import { saveToPath } from "@/utils/saveToPath";

interface FsChangeEvent {
  watchId: string;
  rootPath: string;
  paths: string[];
  kind: "create" | "modify" | "remove";
}

/**
 * Hook to handle external file changes for documents in the current window.
 *
 * Policy:
 * - Clean docs auto-reload without prompt
 * - Dirty docs prompt with options: Keep current, Reload from disk
 * - Deleted files are marked as missing
 */
export function useExternalFileChanges(): void {
  const windowLabel = useWindowLabel();
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // Get tabs and their file paths for the current window
  const getOpenFilePaths = useCallback(() => {
    const tabs = useTabStore.getState().getTabsByWindow(windowLabel);
    const pathToTabId = new Map<string, string>();

    for (const tab of tabs) {
      const doc = useDocumentStore.getState().getDocument(tab.id);
      if (doc?.filePath) {
        pathToTabId.set(normalizePath(doc.filePath), tab.id);
      }
    }

    return pathToTabId;
  }, [windowLabel]);

  // Handle reload for a specific tab
  const handleReload = useCallback(async (tabId: string, filePath: string) => {
    try {
      const content = await readTextFile(filePath);
      useDocumentStore.getState().loadContent(tabId, content, filePath);
      useDocumentStore.getState().clearMissing(tabId);
    } catch (error) {
      console.error("[ExternalChange] Failed to reload file:", filePath, error);
      // File might have been deleted - mark as missing
      useDocumentStore.getState().markMissing(tabId);
    }
  }, []);

  // Handle dirty file change - two-step prompt with Save As option
  // Step 1: Offer to save current version first
  // Step 2: Ask whether to reload or keep
  // IMPORTANT: Cancel/dismiss at any step preserves user's changes (safe default)
  const handleDirtyChange = useCallback(
    async (tabId: string, filePath: string) => {
      const fileName = filePath.split("/").pop() || "file";
      const doc = useDocumentStore.getState().getDocument(tabId);

      // Step 1: Offer Save As first
      const wantsSaveAs = await ask(
        `"${fileName}" has been modified externally.\n\n` +
          "Do you want to save your current version to a different location first?",
        {
          title: "File Changed",
          kind: "warning",
          okLabel: "Save As...",
          cancelLabel: "Skip",
        }
      );

      if (wantsSaveAs && doc) {
        // Open Save As dialog
        const savePath = await save({
          title: "Save your version as...",
          defaultPath: filePath,
          filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
        });

        if (savePath) {
          const saved = await saveToPath(tabId, savePath, doc.content, "manual");
          if (saved) {
            useDocumentStore.getState().clearMissing(tabId);
            // Save As switches the document to the new path; no reload needed.
            return;
          }
        }
      }

      // Step 2: Ask whether to reload or keep
      const reloadFromDisk = await ask(
        `Reload "${fileName}" from disk?\n\n` +
          "This will replace your current version with the external changes.",
        {
          title: "Reload File?",
          kind: "warning",
          okLabel: "Reload from disk",
          cancelLabel: "Keep my changes",
        }
      );

      if (reloadFromDisk) {
        // User explicitly chose to reload - discard their changes
        try {
          const content = await readTextFile(filePath);
          useDocumentStore.getState().loadContent(tabId, content, filePath);
          // Clear missing flag in case file was previously deleted and recreated
          useDocumentStore.getState().clearMissing(tabId);
        } catch (error) {
          console.error("[ExternalChange] Failed to reload file:", filePath, error);
          useDocumentStore.getState().markMissing(tabId);
        }
      }
      // Cancel/dismiss = keep user's changes (safe default, no action needed)
    },
    []
  );

  // Handle file deletion
  const handleDeletion = useCallback((targetTabId: string) => {
    useDocumentStore.getState().markMissing(targetTabId);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const setupListener = async () => {
      if (cancelled) return;

      const unlisten = await listen<FsChangeEvent>("fs:changed", async (event) => {
        if (cancelled) return;

        const { kind, paths, watchId } = event.payload;

        // Only process events from this window's watcher (scoped by windowLabel)
        if (watchId !== windowLabel) return;

        const openPaths = getOpenFilePaths();

        for (const changedPath of paths) {
          const normalizedPath = normalizePath(changedPath);
          const tabId = openPaths.get(normalizedPath);

          if (!tabId) continue; // Not an open file

          const doc = useDocumentStore.getState().getDocument(tabId);
          if (!doc) continue;

          // Handle file deletion
          if (kind === "remove") {
            handleDeletion(tabId);
            continue;
          }

          // Handle file modification (create could be a recreation after delete)
          if (kind === "modify" || kind === "create") {
            const action = resolveExternalChangeAction({
              isDirty: doc.isDirty,
              hasFilePath: Boolean(doc.filePath),
            });

            switch (action) {
              case "auto_reload":
                await handleReload(tabId, changedPath);
                break;
              case "prompt_user":
                await handleDirtyChange(tabId, changedPath);
                break;
              case "no_op":
                // Should not happen for files with paths
                break;
            }
          }
        }
      });

      if (cancelled) {
        unlisten();
        return;
      }

      unlistenRef.current = unlisten;
    };

    setupListener();

    return () => {
      cancelled = true;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [windowLabel, getOpenFilePaths, handleReload, handleDirtyChange, handleDeletion]);
}
