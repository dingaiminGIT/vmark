/**
 * View Shortcuts Hook
 *
 * Handles keyboard shortcuts for view modes (configurable).
 * Menu accelerators don't always work reliably, so we listen directly.
 */

import { useEffect } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useShortcutsStore } from "@/stores/shortcutsStore";
import { useTerminalStore } from "@/stores/terminalStore";
import { flushActiveWysiwygNow } from "@/utils/wysiwygFlush";
import { isImeKeyEvent } from "@/utils/imeGuard";
import { matchesShortcutEvent } from "@/utils/shortcutMatch";

export function useViewShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isImeKeyEvent(e)) return;
      // Ignore if in input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }

      const shortcuts = useShortcutsStore.getState();
      const sourceModeKey = shortcuts.getShortcut("sourceMode");
      const focusModeKey = shortcuts.getShortcut("focusMode");
      const typewriterModeKey = shortcuts.getShortcut("typewriterMode");
      const wordWrapKey = shortcuts.getShortcut("wordWrap");

      if (matchesShortcutEvent(e, sourceModeKey)) {
        e.preventDefault();
        flushActiveWysiwygNow();
        useEditorStore.getState().toggleSourceMode();
        return;
      }

      if (matchesShortcutEvent(e, focusModeKey)) {
        e.preventDefault();
        useEditorStore.getState().toggleFocusMode();
        return;
      }

      if (matchesShortcutEvent(e, typewriterModeKey)) {
        e.preventDefault();
        useEditorStore.getState().toggleTypewriterMode();
        return;
      }

      if (matchesShortcutEvent(e, wordWrapKey)) {
        e.preventDefault();
        useEditorStore.getState().toggleWordWrap();
        return;
      }

      const terminalKey = shortcuts.getShortcut("toggleTerminal");
      if (matchesShortcutEvent(e, terminalKey)) {
        e.preventDefault();
        useTerminalStore.getState().toggle();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
