/**
 * Editor Plugins
 *
 * Custom ProseMirror plugins for the Milkdown editor.
 * Extracted from Editor.tsx to keep file size manageable.
 */

import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { keymap } from "@milkdown/kit/prose/keymap";
import { $prose } from "@milkdown/kit/utils";
import { useUIStore } from "@/stores/uiStore";
import { useEditorStore } from "@/stores/editorStore";
import { getCursorInfoFromProseMirror } from "@/utils/cursorSync/prosemirror";

/**
 * Delay (ms) before enabling cursor tracking to allow restoration to complete.
 */
export const CURSOR_TRACKING_DELAY_MS = 200;

/**
 * Plugin key for cursor tracking plugin.
 */
export const cursorSyncPluginKey = new PluginKey("cursorSync");

/**
 * Keymap plugin to override Milkdown's default Mod-Shift-b (blockquote toggle).
 * Instead, this shortcut toggles the sidebar.
 */
export const overrideKeymapPlugin = $prose(() =>
  keymap({
    "Mod-Shift-b": () => {
      useUIStore.getState().toggleSidebar();
      return true;
    },
  })
);

/**
 * ProseMirror plugin to track cursor position for mode synchronization.
 * Stores cursor info in the editor store so it can be restored when
 * switching between WYSIWYG and Source modes.
 */
export const cursorSyncPlugin = $prose(() => {
  let trackingEnabled = false;

  // Delay tracking to allow cursor restoration to complete first
  setTimeout(() => {
    trackingEnabled = true;
  }, CURSOR_TRACKING_DELAY_MS);

  return new Plugin({
    key: cursorSyncPluginKey,
    view: () => ({
      update: (view, prevState) => {
        // Skip tracking until restoration is complete
        if (!trackingEnabled) return;
        // Track selection changes
        if (!view.state.selection.eq(prevState.selection)) {
          const cursorInfo = getCursorInfoFromProseMirror(view);
          useEditorStore.getState().setCursorInfo(cursorInfo);
        }
      },
    }),
  });
});
