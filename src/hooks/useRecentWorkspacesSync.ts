/**
 * Hook to sync recent workspaces to native menu on app startup.
 *
 * The persist middleware's onRehydrateStorage runs before Tauri APIs are ready,
 * so we need this hook to sync after the app is fully loaded.
 */

import { useEffect } from "react";
import { useRecentWorkspacesStore } from "@/stores/recentWorkspacesStore";

export function useRecentWorkspacesSync() {
  useEffect(() => {
    // Sync recent workspaces to native menu on mount
    useRecentWorkspacesStore.getState().syncToNativeMenu();
  }, []);
}
