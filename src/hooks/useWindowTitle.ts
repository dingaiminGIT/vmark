import { useEffect } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useDocumentFilePath, useDocumentIsDirty } from "./useDocumentState";
import { useSettingsStore } from "@/stores/settingsStore";
import { getFileName } from "@/utils/pathUtils";

/**
 * Update window title based on document state and settings.
 * Format: [• ]filename - VMark (when showFilenameInTitlebar is enabled)
 * Format: VMark (when showFilenameInTitlebar is disabled)
 */
export function useWindowTitle() {
  const filePath = useDocumentFilePath();
  const isDirty = useDocumentIsDirty();
  // Default to false for undefined (localStorage migration)
  const showFilename = useSettingsStore((state) => state.appearance.showFilenameInTitlebar ?? false);

  useEffect(() => {
    const updateTitle = async () => {
      const window = getCurrentWebviewWindow();

      if (showFilename) {
        // Extract filename from path or use "Untitled"
        const filename = filePath ? getFileName(filePath) || "Untitled" : "Untitled";

        // Add dirty indicator
        const dirtyIndicator = isDirty ? "• " : "";
        const title = `${dirtyIndicator}${filename}`;

        await window.setTitle(title);
      } else {
        // Empty titlebar when setting is off
        await window.setTitle("");
      }
    };

    updateTitle();
  }, [filePath, isDirty, showFilename]);
}
