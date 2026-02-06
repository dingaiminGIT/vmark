/**
 * Prompt Shortcuts Hook
 *
 * Handles Cmd+Y keyboard shortcut and menu:ai-prompts event
 * to open the AI prompt picker.
 */

import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useShortcutsStore } from "@/stores/shortcutsStore";
import { usePromptPickerStore } from "@/stores/promptPickerStore";
import { matchesShortcutEvent } from "@/utils/shortcutMatch";
import { isImeKeyEvent } from "@/utils/imeGuard";

export function usePromptShortcuts() {
  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isImeKeyEvent(e)) return;

      const aiPromptsKey = useShortcutsStore.getState().getShortcut("aiPrompts");
      if (matchesShortcutEvent(e, aiPromptsKey)) {
        e.preventDefault();
        usePromptPickerStore.getState().openPicker();
      }
    };

    // Must fire before INPUT/TEXTAREA guard (global shortcut)
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Menu event
  useEffect(() => {
    const unlisten = listen("menu:ai-prompts", () => {
      usePromptPickerStore.getState().openPicker();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
}
