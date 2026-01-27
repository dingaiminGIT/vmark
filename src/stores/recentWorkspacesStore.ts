/**
 * Recent Workspaces Store
 *
 * Tracks recently opened workspace folders with persistence across sessions.
 * Syncs with native menu via Tauri command.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";
import { getFileName } from "@/utils/pathUtils";

export interface RecentWorkspace {
  path: string;       // Absolute path to workspace folder
  name: string;       // Folder name for display
  timestamp: number;  // Last opened time
}

interface RecentWorkspacesState {
  workspaces: RecentWorkspace[];
  maxWorkspaces: number;
  addWorkspace: (path: string) => void;
  removeWorkspace: (path: string) => void;
  clearAll: () => void;
  syncToNativeMenu: () => void;
}

// Helper to sync workspaces to native menu
async function updateNativeMenu(workspaces: RecentWorkspace[]) {
  try {
    await invoke("update_recent_workspaces", { workspaces: workspaces.map((w) => w.path) });
  } catch (error) {
    console.warn("[RecentWorkspaces] Failed to update native menu:", error);
  }
}

export const useRecentWorkspacesStore = create<RecentWorkspacesState>()(
  persist(
    (set, get) => ({
      workspaces: [],
      maxWorkspaces: 10,

      addWorkspace: (path: string) => {
        const { workspaces, maxWorkspaces } = get();
        const name = getFileName(path) || path;

        // Remove if already exists (will be re-added at top)
        const filtered = workspaces.filter((w) => w.path !== path);

        // Add to front
        const newWorkspaces = [
          { path, name, timestamp: Date.now() },
          ...filtered,
        ].slice(0, maxWorkspaces);

        set({ workspaces: newWorkspaces });
        updateNativeMenu(newWorkspaces);
      },

      removeWorkspace: (path: string) => {
        const newWorkspaces = get().workspaces.filter((w) => w.path !== path);
        set({ workspaces: newWorkspaces });
        updateNativeMenu(newWorkspaces);
      },

      clearAll: () => {
        set({ workspaces: [] });
        updateNativeMenu([]);
      },

      syncToNativeMenu: () => {
        updateNativeMenu(get().workspaces);
      },
    }),
    {
      name: "vmark-recent-workspaces",
    }
  )
);
