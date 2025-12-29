import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { ask } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useEditorStore } from "@/stores/editorStore";
import { useUIStore } from "@/stores/uiStore";
import { useRecentFilesStore } from "@/stores/recentFilesStore";
import { clearAllHistory } from "@/utils/historyUtils";
import { exportToHtml, exportToPdf, savePdf, copyAsHtml } from "@/utils/exportUtils";

export function useMenuEvents() {
  const unlistenRefs = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    let cancelled = false;

    const setupListeners = async () => {
      // Clean up any existing listeners first
      unlistenRefs.current.forEach((fn) => fn());
      unlistenRefs.current = [];

      if (cancelled) return;

      // View menu events
      const unlistenSourceMode = await listen("menu:source-mode", () => {
        useEditorStore.getState().toggleSourceMode();
      });
      if (cancelled) { unlistenSourceMode(); return; }
      unlistenRefs.current.push(unlistenSourceMode);

      const unlistenFocusMode = await listen("menu:focus-mode", () => {
        useEditorStore.getState().toggleFocusMode();
      });
      if (cancelled) { unlistenFocusMode(); return; }
      unlistenRefs.current.push(unlistenFocusMode);

      const unlistenTypewriterMode = await listen("menu:typewriter-mode", () => {
        useEditorStore.getState().toggleTypewriterMode();
      });
      if (cancelled) { unlistenTypewriterMode(); return; }
      unlistenRefs.current.push(unlistenTypewriterMode);

      const unlistenSidebar = await listen("menu:sidebar", () => {
        useUIStore.getState().toggleSidebar();
      });
      if (cancelled) { unlistenSidebar(); return; }
      unlistenRefs.current.push(unlistenSidebar);

      const unlistenOutline = await listen("menu:outline", () => {
        useUIStore.getState().toggleOutline();
      });
      if (cancelled) { unlistenOutline(); return; }
      unlistenRefs.current.push(unlistenOutline);

      const unlistenWordWrap = await listen("menu:word-wrap", () => {
        useEditorStore.getState().toggleWordWrap();
      });
      if (cancelled) { unlistenWordWrap(); return; }
      unlistenRefs.current.push(unlistenWordWrap);

      const unlistenPreferences = await listen("menu:preferences", async () => {
        // Check if settings window already exists
        const existing = await WebviewWindow.getByLabel("settings");
        if (existing) {
          await existing.setFocus();
          return;
        }
        // Create new settings window
        new WebviewWindow("settings", {
          url: "/settings",
          title: "Settings",
          width: 700,
          height: 500,
          minWidth: 500,
          minHeight: 400,
          center: true,
          resizable: true,
          hiddenTitle: true,
          titleBarStyle: "overlay",
        });
      });
      if (cancelled) { unlistenPreferences(); return; }
      unlistenRefs.current.push(unlistenPreferences);

      // History menu events
      const unlistenViewHistory = await listen("menu:view-history", () => {
        useUIStore.getState().showSidebarWithView("history");
      });
      if (cancelled) { unlistenViewHistory(); return; }
      unlistenRefs.current.push(unlistenViewHistory);

      const unlistenClearHistory = await listen("menu:clear-history", async () => {
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
            console.log("[History] All history cleared");
          } catch (error) {
            console.error("[History] Failed to clear history:", error);
          }
        }
      });
      if (cancelled) { unlistenClearHistory(); return; }
      unlistenRefs.current.push(unlistenClearHistory);

      // Clear Recent Files
      const unlistenClearRecent = await listen("menu:clear-recent", async () => {
        const { files } = useRecentFilesStore.getState();
        if (files.length === 0) return;

        const confirmed = await ask(
          "Clear the list of recently opened files?",
          {
            title: "Clear Recent Files",
            kind: "warning",
          }
        );
        if (confirmed) {
          useRecentFilesStore.getState().clearAll();
        }
      });
      if (cancelled) { unlistenClearRecent(); return; }
      unlistenRefs.current.push(unlistenClearRecent);

      // Open Recent File from menu
      const unlistenOpenRecent = await listen<number>("menu:open-recent-file", async (event) => {
        const index = event.payload;
        const { files } = useRecentFilesStore.getState();

        if (index < 0 || index >= files.length) return;

        const file = files[index];

        // Check for unsaved changes
        const { isDirty } = useEditorStore.getState();
        if (isDirty) {
          const confirmed = await ask("You have unsaved changes. Discard them?", {
            title: "Unsaved Changes",
            kind: "warning",
          });
          if (!confirmed) return;
        }

        try {
          const content = await readTextFile(file.path);
          useEditorStore.getState().loadContent(content, file.path);
          useRecentFilesStore.getState().addFile(file.path); // Move to top
        } catch (error) {
          console.error("Failed to open recent file:", error);
          const remove = await ask(
            "This file could not be opened. It may have been moved or deleted.\n\nRemove from recent files?",
            { title: "File Not Found", kind: "warning" }
          );
          if (remove) {
            useRecentFilesStore.getState().removeFile(file.path);
          }
        }
      });
      if (cancelled) { unlistenOpenRecent(); return; }
      unlistenRefs.current.push(unlistenOpenRecent);

      // Export menu events
      const unlistenExportHtml = await listen("menu:export-html", async () => {
        const { content, filePath } = useEditorStore.getState();
        const defaultName = filePath
          ? filePath.split("/").pop()?.replace(/\.[^.]+$/, "") || "document"
          : "document";
        await exportToHtml(content, defaultName);
      });
      if (cancelled) { unlistenExportHtml(); return; }
      unlistenRefs.current.push(unlistenExportHtml);

      const unlistenSavePdf = await listen("menu:save-pdf", async () => {
        const { content, filePath } = useEditorStore.getState();
        const defaultName = filePath
          ? filePath.split("/").pop()?.replace(/\.[^.]+$/, "") || "document"
          : "document";
        await savePdf(content, defaultName);
      });
      if (cancelled) { unlistenSavePdf(); return; }
      unlistenRefs.current.push(unlistenSavePdf);

      const unlistenExportPdf = await listen("menu:export-pdf", async () => {
        const { content, filePath } = useEditorStore.getState();
        const title = filePath
          ? filePath.split("/").pop()?.replace(/\.[^.]+$/, "") || "Document"
          : "Document";
        await exportToPdf(content, title);
      });
      if (cancelled) { unlistenExportPdf(); return; }
      unlistenRefs.current.push(unlistenExportPdf);

      const unlistenCopyHtml = await listen("menu:copy-html", async () => {
        const { content } = useEditorStore.getState();
        await copyAsHtml(content);
      });
      if (cancelled) { unlistenCopyHtml(); return; }
      unlistenRefs.current.push(unlistenCopyHtml);
    };

    setupListeners();

    return () => {
      cancelled = true;
      const fns = unlistenRefs.current;
      unlistenRefs.current = [];
      fns.forEach((fn) => fn());
    };
  }, []);
}
