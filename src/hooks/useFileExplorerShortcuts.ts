import { useEffect } from "react";
import { useShortcutsStore } from "@/stores/shortcutsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { matchesShortcutEvent } from "@/utils/shortcutMatch";
import { isImeKeyEvent } from "@/utils/imeGuard";
import { toggleShowHiddenFiles } from "@/hooks/workspaceConfig";

export function useFileExplorerShortcuts() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isImeKeyEvent(event)) return;

      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }

      const { isWorkspaceMode, config } = useWorkspaceStore.getState();
      if (!isWorkspaceMode || !config) return;

      const shortcut = useShortcutsStore.getState().getShortcut("toggleHiddenFiles");
      if (matchesShortcutEvent(event, shortcut)) {
        event.preventDefault();
        void toggleShowHiddenFiles();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, []);
}
