import { useEffect, useCallback, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { useWindowLabel } from "@/contexts/WindowContext";
import { useDocumentStore } from "@/stores/documentStore";
import { useTabStore } from "@/stores/tabStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useRecentFilesStore } from "@/stores/recentFilesStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { createSnapshot } from "@/hooks/useHistoryOperations";
import { isWindowFocused } from "@/hooks/useWindowFocus";
import { getDefaultSaveFolderWithFallback } from "@/hooks/useDefaultSaveFolder";
import { flushActiveWysiwygNow } from "@/utils/wysiwygFlush";
import { withReentryGuard } from "@/utils/reentryGuard";
import {
  resolveOpenAction,
  resolvePostSaveWorkspaceAction,
  resolveMissingFileSaveAction,
} from "@/utils/openPolicy";
import { createUntitledTab } from "@/utils/newFile";
import { getDirectory } from "@/utils/pathUtils";
import { normalizePath } from "@/utils/paths";

async function saveToPath(
  tabId: string,
  path: string,
  content: string,
  saveType: "manual" | "auto" = "manual"
): Promise<boolean> {
  try {
    await writeTextFile(path, content);
    useDocumentStore.getState().setFilePath(tabId, path);
    useDocumentStore.getState().markSaved(tabId);
    // Update tab path for title sync
    useTabStore.getState().updateTabPath(tabId, path);

    // Add to recent files
    useRecentFilesStore.getState().addFile(path);

    // Create history snapshot if enabled
    const { general } = useSettingsStore.getState();
    if (general.historyEnabled) {
      try {
        await createSnapshot(path, content, saveType, {
          maxSnapshots: general.historyMaxSnapshots,
          maxAgeDays: general.historyMaxAgeDays,
        });
      } catch (historyError) {
        console.warn("[History] Failed to create snapshot:", historyError);
        // Don't fail the save operation if history fails
      }
    }

    return true;
  } catch (error) {
    console.error("Failed to save file:", error);
    return false;
  }
}

/**
 * Find an existing tab for a file path in the current window.
 */
function findExistingTabForPath(windowLabel: string, filePath: string): string | null {
  const tabs = useTabStore.getState().getTabsByWindow(windowLabel);
  const normalizedTarget = normalizePath(filePath);

  for (const tab of tabs) {
    const doc = useDocumentStore.getState().getDocument(tab.id);
    if (doc?.filePath && normalizePath(doc.filePath) === normalizedTarget) {
      return tab.id;
    }
  }
  return null;
}

export function useFileOperations() {
  const windowLabel = useWindowLabel();

  /**
   * Open a file in a new tab. Always creates a new tab unless an existing
   * tab for the same file already exists (in which case it activates that tab).
   */
  const openFileInNewTab = useCallback(
    async (path: string): Promise<void> => {
      // Check for existing tab first
      const existingTabId = findExistingTabForPath(windowLabel, path);
      if (existingTabId) {
        useTabStore.getState().setActiveTab(windowLabel, existingTabId);
        return;
      }

      // Create new tab
      const tabId = useTabStore.getState().createTab(windowLabel, path);
      try {
        const content = await readTextFile(path);
        useDocumentStore.getState().initDocument(tabId, content, path);
        useRecentFilesStore.getState().addFile(path);
      } catch (error) {
        console.error("[FileOps] Failed to open file:", path, error);
      }
    },
    [windowLabel]
  );

  const handleOpen = useCallback(async () => {
    // Only respond if this window is focused
    if (!(await isWindowFocused())) return;

    await withReentryGuard(windowLabel, "open", async () => {
      const path = await open({
        filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }],
      });
      if (!path) return;

      // Use policy to decide where to open
      const { isWorkspaceMode, rootPath } = useWorkspaceStore.getState();
      const existingTabId = findExistingTabForPath(windowLabel, path);

      const decision = resolveOpenAction({
        filePath: path,
        workspaceRoot: rootPath,
        isWorkspaceMode,
        existingTabId,
      });

      switch (decision.action) {
        case "activate_tab":
          useTabStore.getState().setActiveTab(windowLabel, decision.tabId);
          break;
        case "create_tab":
          await openFileInNewTab(path);
          break;
        case "open_workspace_in_new_window":
          try {
            await invoke("open_workspace_in_new_window", {
              workspaceRoot: decision.workspaceRoot,
              filePath: decision.filePath,
            });
          } catch (error) {
            console.error("[FileOps] Failed to open workspace in new window:", error);
          }
          break;
        case "no_op":
          // Nothing to do
          break;
      }
    });
  }, [windowLabel, openFileInNewTab]);

  const handleSave = useCallback(async () => {
    // Only respond if this window is focused
    if (!(await isWindowFocused())) return;
    flushActiveWysiwygNow();

    await withReentryGuard(windowLabel, "save", async () => {
      const tabId = useTabStore.getState().activeTabId[windowLabel];
      if (!tabId) return;

      const doc = useDocumentStore.getState().getDocument(tabId);
      if (!doc) return;

      // Check missing file policy - block normal save if file was deleted externally
      const saveAction = resolveMissingFileSaveAction({
        isMissing: doc.isMissing,
        hasPath: Boolean(doc.filePath),
      });

      // Track whether file was untitled before save (for auto-workspace logic)
      const hadPathBeforeSave = Boolean(doc.filePath);
      let savedPath: string | null = null;

      // If file is missing, force Save As flow instead of normal save
      if (saveAction === "save_as_required" || !doc.filePath) {
        // Use workspace root, another saved file's folder, or home
        const defaultFolder = await getDefaultSaveFolderWithFallback(windowLabel);
        const path = await save({
          defaultPath: defaultFolder,
          filters: [{ name: "Markdown", extensions: ["md"] }],
        });
        if (path) {
          const success = await saveToPath(tabId, path, doc.content, "manual");
          if (success) {
            savedPath = path;
            // Clear missing state if file was missing
            if (doc.isMissing) {
              useDocumentStore.getState().clearMissing(tabId);
            }
          }
        }
      } else {
        // Normal save - file exists
        const success = await saveToPath(tabId, doc.filePath, doc.content, "manual");
        if (success) savedPath = doc.filePath;
      }

      // Auto-open workspace after first save of untitled file (if not already in workspace)
      if (savedPath) {
        const { isWorkspaceMode } = useWorkspaceStore.getState();
        const postSaveAction = resolvePostSaveWorkspaceAction({
          isWorkspaceMode,
          hadPathBeforeSave,
          savedFilePath: savedPath,
        });

        if (postSaveAction.action === "open_workspace") {
          try {
            await useWorkspaceStore.getState().openWorkspace(postSaveAction.workspaceRoot);
          } catch (error) {
            console.error("[FileOps] Failed to open workspace after save:", error);
          }
        }
      }
    });
  }, [windowLabel]);

  const handleSaveAs = useCallback(async () => {
    // Only respond if this window is focused
    if (!(await isWindowFocused())) return;
    flushActiveWysiwygNow();

    await withReentryGuard(windowLabel, "save", async () => {
      const tabId = useTabStore.getState().activeTabId[windowLabel];
      if (!tabId) return;

      const doc = useDocumentStore.getState().getDocument(tabId);
      if (!doc) return;

      // Use current file's folder or resolve default folder
      const defaultFolder = doc.filePath
        ? getDirectory(doc.filePath)
        : await getDefaultSaveFolderWithFallback(windowLabel);
      const path = await save({
        defaultPath: defaultFolder,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (path) {
        await saveToPath(tabId, path, doc.content, "manual");
      }
    });
  }, [windowLabel]);

  // menu:close now handled by useWindowClose hook via Rust window event

  // Handle opening file from FileExplorer - always opens in new tab
  const handleOpenFile = useCallback(
    async (event: { payload: { path: string } }) => {
      // Only respond if this window is focused
      if (!(await isWindowFocused())) return;

      const { path } = event.payload;

      // Check for existing tab and activate, otherwise create new
      const existingTabId = findExistingTabForPath(windowLabel, path);
      if (existingTabId) {
        useTabStore.getState().setActiveTab(windowLabel, existingTabId);
      } else {
        await openFileInNewTab(path);
      }
    },
    [openFileInNewTab, windowLabel]
  );

  const handleAppOpenFile = useCallback(
    async (event: { payload: string }) => {
      const filePath = event.payload;
      if (!filePath) return;

      // Use policy to decide where to open
      const { isWorkspaceMode, rootPath } = useWorkspaceStore.getState();
      const existingTabId = findExistingTabForPath(windowLabel, filePath);

      const decision = resolveOpenAction({
        filePath,
        workspaceRoot: rootPath,
        isWorkspaceMode,
        existingTabId,
      });

      switch (decision.action) {
        case "activate_tab":
          useTabStore.getState().setActiveTab(windowLabel, decision.tabId);
          break;
        case "create_tab":
          await openFileInNewTab(filePath);
          break;
        case "open_workspace_in_new_window":
          // Only the first window to handle this should open the new window
          // Other windows will get the same event but should ignore it
          // This is handled by the Rust side - we just attempt the operation
          try {
            await invoke("open_workspace_in_new_window", {
              workspaceRoot: decision.workspaceRoot,
              filePath: decision.filePath,
            });
          } catch (error) {
            console.error("[FileOps] Failed to open workspace in new window:", error);
          }
          break;
        case "no_op":
          break;
      }
    },
    [windowLabel, openFileInNewTab]
  );

  const handleNew = useCallback(async () => {
    // Only respond if this window is focused
    if (!(await isWindowFocused())) return;
    createUntitledTab(windowLabel);
  }, [windowLabel]);

  const unlistenRefs = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    let cancelled = false;

    const setupListeners = async () => {
      // Clean up any existing listeners first
      unlistenRefs.current.forEach((fn) => fn());
      unlistenRefs.current = [];

      if (cancelled) return;

      // menu:new creates a new tab in this window
      // menu:new-window (handled in Rust) creates a new window
      const unlistenNew = await listen("menu:new", handleNew);
      if (cancelled) { unlistenNew(); return; }
      unlistenRefs.current.push(unlistenNew);

      const unlistenOpen = await listen("menu:open", handleOpen);
      if (cancelled) { unlistenOpen(); return; }
      unlistenRefs.current.push(unlistenOpen);

      const unlistenSave = await listen("menu:save", handleSave);
      if (cancelled) { unlistenSave(); return; }
      unlistenRefs.current.push(unlistenSave);

      const unlistenSaveAs = await listen("menu:save-as", handleSaveAs);
      if (cancelled) { unlistenSaveAs(); return; }
      unlistenRefs.current.push(unlistenSaveAs);

      // Listen for open-file from FileExplorer
      const unlistenOpenFile = await listen<{ path: string }>(
        "open-file",
        handleOpenFile
      );
      if (cancelled) { unlistenOpenFile(); return; }
      unlistenRefs.current.push(unlistenOpenFile);

      const unlistenAppOpenFile = await listen<string>(
        "app:open-file",
        handleAppOpenFile
      );
      if (cancelled) { unlistenAppOpenFile(); return; }
      unlistenRefs.current.push(unlistenAppOpenFile);
    };

    setupListeners();

    return () => {
      cancelled = true;
      const fns = unlistenRefs.current;
      unlistenRefs.current = [];
      fns.forEach((fn) => fn());
    };
  }, [handleNew, handleOpen, handleSave, handleSaveAs, handleOpenFile, handleAppOpenFile]);
}
