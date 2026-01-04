/**
 * Format Toolbar Plugin
 *
 * Provides Cmd+/ toggle for a floating format toolbar in Milkdown.
 * Similar to source mode's format popup.
 */

import { $prose } from "@milkdown/kit/utils";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { keymap } from "@milkdown/kit/prose/keymap";
import type { EditorView } from "@milkdown/kit/prose/view";
import { useFormatToolbarStore } from "@/stores/formatToolbarStore";
import { FormatToolbarView } from "./FormatToolbarView";

export const formatToolbarPluginKey = new PluginKey("formatToolbar");

/**
 * Toggle the format toolbar.
 * If open → close.
 * If closed → open at cursor position.
 */
function toggleFormatToolbar(view: EditorView): boolean {
  const store = useFormatToolbarStore.getState();

  if (store.isOpen) {
    // Close toolbar
    store.closeToolbar();
    view.focus();
    return true;
  }

  // Open toolbar at cursor position
  const { from, to } = view.state.selection;
  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);

  // Create anchor rect from selection
  const anchorRect = {
    top: Math.min(start.top, end.top),
    bottom: Math.max(start.bottom, end.bottom),
    left: Math.min(start.left, end.left),
    right: Math.max(start.right, end.right),
    width: Math.abs(end.left - start.left),
    height: Math.abs(end.bottom - start.top),
  };

  store.openToolbar(anchorRect, view);
  return true;
}

/**
 * Keymap plugin for Cmd+/ format toolbar toggle.
 */
export const formatToolbarKeymapPlugin = $prose(() =>
  keymap({
    "Mod-/": (_state, _dispatch, view) => {
      if (!view) return false;
      return toggleFormatToolbar(view);
    },
  })
);

/**
 * View plugin that creates and manages the toolbar DOM.
 */
export const formatToolbarViewPlugin = $prose(() =>
  new Plugin({
    key: formatToolbarPluginKey,
    view: (editorView) => {
      const toolbarView = new FormatToolbarView(editorView);
      return {
        destroy: () => toolbarView.destroy(),
      };
    },
  })
);

export { FormatToolbarView };
