import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useEditorStore } from "@/stores/editorStore";
import { useUIStore } from "@/stores/uiStore";

export function useMenuEvents() {
  useEffect(() => {
    const unlisten: Promise<() => void>[] = [];

    // View menu events
    unlisten.push(
      listen("menu:focus-mode", () => {
        useEditorStore.getState().toggleFocusMode();
      })
    );

    unlisten.push(
      listen("menu:typewriter-mode", () => {
        useEditorStore.getState().toggleTypewriterMode();
      })
    );

    unlisten.push(
      listen("menu:sidebar", () => {
        useUIStore.getState().toggleSidebar();
      })
    );

    unlisten.push(
      listen("menu:outline", () => {
        useUIStore.getState().toggleOutline();
      })
    );

    // Cleanup
    return () => {
      Promise.all(unlisten).then((fns) => fns.forEach((fn) => fn()));
    };
  }, []);
}
