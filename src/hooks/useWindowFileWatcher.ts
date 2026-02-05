import { useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useWindowLabel } from "@/contexts/WindowContext";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useTabStore } from "@/stores/tabStore";
import { useDocumentStore } from "@/stores/documentStore";
import { getDirectory } from "@/utils/pathUtils";

/**
 * Start/stop a filesystem watcher for the current window.
 * Uses the workspace root when available; otherwise falls back to
 * the active document's directory when it has a file path.
 */
export function useWindowFileWatcher(): void {
  const windowLabel = useWindowLabel();
  const isWorkspaceMode = useWorkspaceStore((state) => state.isWorkspaceMode);
  const rootPath = useWorkspaceStore((state) => state.rootPath);
  const activeTabId = useTabStore(
    (state) => state.activeTabId[windowLabel] ?? null
  );
  const activeFilePath = useDocumentStore((state) =>
    activeTabId ? state.documents[activeTabId]?.filePath ?? null : null
  );

  const watchPath = useMemo(() => {
    if (isWorkspaceMode && rootPath) return rootPath;
    if (activeFilePath) {
      const dir = getDirectory(activeFilePath);
      if (dir && !/^[A-Za-z]:$/.test(dir)) {
        return dir;
      }
    }
    return null;
  }, [isWorkspaceMode, rootPath, activeFilePath]);

  useEffect(() => {
    if (!watchPath) {
      invoke("stop_watching", { watchId: windowLabel }).catch((err) => {
        console.warn("[Watcher] Failed to stop watcher:", err);
      });
      return;
    }

    invoke("start_watching", { watchId: windowLabel, path: watchPath }).catch(
      (err) => {
        console.warn("[Watcher] Failed to start watcher:", err);
      }
    );

    return () => {
      invoke("stop_watching", { watchId: windowLabel }).catch((err) => {
        console.warn("[Watcher] Failed to stop watcher on cleanup:", err);
      });
    };
  }, [windowLabel, watchPath]);
}
