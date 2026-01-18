/**
 * useUniversalToolbar - configurable toggle hook
 *
 * Listens for the configured shortcut to toggle the universal toolbar.
 * Works with both WYSIWYG and Source modes.
 *
 * @module hooks/useUniversalToolbar
 */
import { useEffect, useCallback } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useSearchStore } from "@/stores/searchStore";
import { useShortcutsStore } from "@/stores/shortcutsStore";
import { matchesShortcutEvent } from "@/utils/shortcutMatch";

/**
 * Hook to handle the universal toolbar toggle shortcut.
 *
 * Attaches a global keydown listener for the configured shortcut.
 *
 * @example
 * function App() {
 *   useUniversalToolbar();
 *   return <Editor />;
 * }
 */
export function useUniversalToolbar(): void {
  const toggleToolbar = useCallback(() => {
    const ui = useUIStore.getState();
    if (!ui.universalToolbarVisible) {
      // Opening UniversalToolbar: close StatusBar and FindBar
      ui.setStatusBarVisible(false);
      useSearchStore.getState().close();
    }
    ui.toggleUniversalToolbar();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && useUIStore.getState().universalToolbarVisible) {
        const activeEl = document.activeElement as HTMLElement | null;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable)) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        useUIStore.getState().setUniversalToolbarVisible(false);
        return;
      }
      const shortcut = useShortcutsStore.getState().getShortcut("formatToolbar");
      if (matchesShortcutEvent(e, shortcut)) {
        e.preventDefault();
        e.stopPropagation();
        toggleToolbar();
      }
    };

    // Use capture phase to intercept before editors
    document.addEventListener("keydown", handleKeyDown, { capture: true });

    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [toggleToolbar]);
}
