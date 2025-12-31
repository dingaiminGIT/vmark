/**
 * Auto-Save Hook
 *
 * Automatically saves the document at configurable intervals when dirty.
 * Skips untitled documents (no filePath).
 * Also creates history snapshots when history is enabled.
 */

import { useEffect, useRef } from "react";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useWindowLabel } from "@/contexts/WindowContext";
import { useDocumentStore } from "@/stores/documentStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { createSnapshot } from "@/utils/historyUtils";
import { autoSaveLog } from "@/utils/debug";

export function useAutoSave() {
  const windowLabel = useWindowLabel();
  const autoSaveEnabled = useSettingsStore((s) => s.general.autoSaveEnabled);
  const autoSaveInterval = useSettingsStore((s) => s.general.autoSaveInterval);
  const lastSaveRef = useRef<number>(0);

  useEffect(() => {
    if (!autoSaveEnabled) return;

    const intervalMs = autoSaveInterval * 1000;

    const checkAndSave = async () => {
      const doc = useDocumentStore.getState().getDocument(windowLabel);

      // Skip if no document, not dirty, or no file path (untitled)
      if (!doc || !doc.isDirty || !doc.filePath) return;

      // Debounce: Prevent saves within 5 seconds of each other.
      // This guards against rapid successive saves when the interval
      // timer fires immediately after a manual save or content change.
      const DEBOUNCE_MS = 5000;
      const now = Date.now();
      if (now - lastSaveRef.current < DEBOUNCE_MS) return;

      try {
        await writeTextFile(doc.filePath, doc.content);
        useDocumentStore.getState().markAutoSaved(windowLabel);
        lastSaveRef.current = now;
        autoSaveLog("Saved:", doc.filePath);

        // Create history snapshot if enabled
        const { general } = useSettingsStore.getState();
        if (general.historyEnabled) {
          try {
            await createSnapshot(doc.filePath, doc.content, "auto", {
              maxSnapshots: general.historyMaxSnapshots,
              maxAgeDays: general.historyMaxAgeDays,
            });
          } catch (historyError) {
            console.warn("[AutoSave] Failed to create snapshot:", historyError);
          }
        }
      } catch (error) {
        console.error("[AutoSave] Failed:", error);
      }
    };

    const interval = setInterval(checkAndSave, intervalMs);

    return () => clearInterval(interval);
  }, [windowLabel, autoSaveEnabled, autoSaveInterval]);
}
