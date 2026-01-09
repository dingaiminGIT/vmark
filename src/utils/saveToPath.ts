/**
 * Save document content to a path and update stores/history.
 *
 * Shared helper for manual/auto saves across file flows.
 */
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useDocumentStore } from "@/stores/documentStore";
import { useTabStore } from "@/stores/tabStore";
import { useRecentFilesStore } from "@/stores/recentFilesStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { createSnapshot } from "@/hooks/useHistoryOperations";

export async function saveToPath(
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
