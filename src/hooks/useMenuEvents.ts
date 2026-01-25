import { useEffect, useRef } from "react";
import { type UnlistenFn } from "@tauri-apps/api/event";
import { WebviewWindow, getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { LogicalPosition } from "@tauri-apps/api/dpi";
import { ask } from "@tauri-apps/plugin-dialog";
import { useDocumentStore } from "@/stores/documentStore";
import { useUIStore } from "@/stores/uiStore";
import { useTabStore } from "@/stores/tabStore";
import { clearAllHistory } from "@/hooks/useHistoryRecovery";
import { historyLog } from "@/utils/debug";
import { withReentryGuard } from "@/utils/reentryGuard";
import { runOrphanCleanup } from "@/utils/orphanAssetCleanup";

/**
 * Handles miscellaneous menu events: preferences, history, and cleanup.
 * View menu and recent files events are handled by separate hooks.
 */
export function useMenuEvents(): void {
  const unlistenRefs = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    let cancelled = false;

    const setupListeners = async (): Promise<void> => {
      unlistenRefs.current.forEach((fn) => fn());
      unlistenRefs.current = [];

      if (cancelled) return;

      const currentWindow = getCurrentWebviewWindow();
      const windowLabel = currentWindow.label;

      // Preferences - open Settings centered on this window
      const unlistenPreferences = await currentWindow.listen<string>("menu:preferences", async (event) => {
        if (event.payload !== windowLabel) return;

        const settingsWidth = 760;
        const settingsHeight = 540;

        // Calculate centered position with proper scale factor conversion
        // outerPosition/outerSize return physical pixels, but we need logical pixels
        const calculateCenteredPosition = async (): Promise<{ x: number; y: number } | null> => {
          try {
            const scaleFactor = await currentWindow.scaleFactor();
            const [position, size] = await Promise.all([
              currentWindow.outerPosition(),
              currentWindow.outerSize(),
            ]);
            // Convert physical pixels to logical pixels
            const x = Math.round(position.x / scaleFactor + (size.width / scaleFactor - settingsWidth) / 2);
            const y = Math.round(position.y / scaleFactor + (size.height / scaleFactor - settingsHeight) / 2);
            return { x, y };
          } catch {
            return null;
          }
        };

        // If Settings exists, reposition and focus it
        const existing = await WebviewWindow.getByLabel("settings");
        if (existing) {
          const pos = await calculateCenteredPosition();
          if (pos) {
            await existing.setPosition(new LogicalPosition(pos.x, pos.y));
          }
          await existing.setFocus();
          return;
        }

        // Create new Settings window
        const pos = await calculateCenteredPosition();
        new WebviewWindow("settings", {
          url: "/settings",
          title: "Settings",
          width: settingsWidth,
          height: settingsHeight,
          minWidth: 600,
          minHeight: 400,
          x: pos?.x,
          y: pos?.y,
          center: !pos, // Center on screen only if position unknown
          resizable: true,
          hiddenTitle: true,
          titleBarStyle: "overlay",
        });
      });
      if (cancelled) { unlistenPreferences(); return; }
      unlistenRefs.current.push(unlistenPreferences);

      // View History
      const unlistenViewHistory = await currentWindow.listen<string>("menu:view-history", (event) => {
        if (event.payload !== windowLabel) return;
        useUIStore.getState().showSidebarWithView("history");
      });
      if (cancelled) { unlistenViewHistory(); return; }
      unlistenRefs.current.push(unlistenViewHistory);

      // Clear History
      const unlistenClearHistory = await currentWindow.listen<string>("menu:clear-history", async (event) => {
        if (event.payload !== windowLabel) return;

        await withReentryGuard(windowLabel, "clear-history", async () => {
          const confirmed = await ask(
            "This will permanently delete all document history. This action cannot be undone.",
            {
              title: "Clear All History",
              kind: "warning",
            }
          );
          if (confirmed) {
            try {
              await clearAllHistory();
              historyLog("All history cleared");
            } catch (error) {
              console.error("[History] Failed to clear history:", error);
            }
          }
        });
      });
      if (cancelled) { unlistenClearHistory(); return; }
      unlistenRefs.current.push(unlistenClearHistory);

      // Clean up unused images
      const unlistenCleanupImages = await currentWindow.listen<string>("menu:cleanup-images", async (event) => {
        if (event.payload !== windowLabel) return;

        await withReentryGuard(windowLabel, "cleanup-images", async () => {
          const tabId = useTabStore.getState().activeTabId[windowLabel];
          if (!tabId) return;

          const doc = useDocumentStore.getState().getDocument(tabId);
          if (!doc) return;

          const { useSettingsStore } = await import("@/stores/settingsStore");
          const autoCleanupEnabled = useSettingsStore.getState().image.cleanupOrphansOnClose;

          await runOrphanCleanup(doc.filePath, doc.isDirty ? null : doc.content, autoCleanupEnabled);
        });
      });
      if (cancelled) { unlistenCleanupImages(); return; }
      unlistenRefs.current.push(unlistenCleanupImages);
    };

    setupListeners().catch((error) => {
      console.error("[useMenuEvents] Failed to setup listeners:", error);
    });

    return () => {
      cancelled = true;
      const fns = unlistenRefs.current;
      unlistenRefs.current = [];
      fns.forEach((fn) => fn());
    };
  }, []);
}
