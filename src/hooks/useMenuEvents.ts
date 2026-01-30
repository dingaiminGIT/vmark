import { useEffect, useRef } from "react";
import { type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { ask } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useDocumentStore } from "@/stores/documentStore";
import { useUIStore } from "@/stores/uiStore";
import { useTabStore } from "@/stores/tabStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { clearAllHistory } from "@/hooks/useHistoryRecovery";
import { historyLog } from "@/utils/debug";
import { withReentryGuard } from "@/utils/reentryGuard";
import { runOrphanCleanup } from "@/utils/orphanAssetCleanup";
import { openSettingsWindow } from "@/utils/settingsWindow";

const HELP_URL = "https://vmark.app/guide/";
const SHORTCUTS_URL = "https://vmark.app/guide/shortcuts";
const REPORT_ISSUE_URL = "https://github.com/xiaolai/vmark/issues/new";

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
        await openSettingsWindow();
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

          const autoCleanupEnabled = useSettingsStore.getState().image.cleanupOrphansOnClose;

          await runOrphanCleanup(doc.filePath, doc.isDirty ? null : doc.content, autoCleanupEnabled);
        });
      });
      if (cancelled) { unlistenCleanupImages(); return; }
      unlistenRefs.current.push(unlistenCleanupImages);

      // Help menu items
      const unlistenVMarkHelp = await currentWindow.listen<string>("menu:vmark-help", async (event) => {
        if (event.payload !== windowLabel) return;
        await openUrl(HELP_URL);
      });
      if (cancelled) { unlistenVMarkHelp(); return; }
      unlistenRefs.current.push(unlistenVMarkHelp);

      const unlistenKeyboardShortcuts = await currentWindow.listen<string>("menu:keyboard-shortcuts", async (event) => {
        if (event.payload !== windowLabel) return;
        await openUrl(SHORTCUTS_URL);
      });
      if (cancelled) { unlistenKeyboardShortcuts(); return; }
      unlistenRefs.current.push(unlistenKeyboardShortcuts);

      const unlistenReportIssue = await currentWindow.listen<string>("menu:report-issue", async (event) => {
        if (event.payload !== windowLabel) return;
        await openUrl(REPORT_ISSUE_URL);
      });
      if (cancelled) { unlistenReportIssue(); return; }
      unlistenRefs.current.push(unlistenReportIssue);
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
