/**
 * Format Toolbar Plugin
 *
 * Provides Cmd+E toggle for a context-aware floating toolbar in Milkdown.
 * Similar to source mode's format popup.
 *
 * Context detection:
 * - Table → triggers table toolbar
 * - Code block → shows format toolbar (language picker TBD)
 * - Heading → shows format toolbar (heading levels TBD)
 * - Regular text → shows format toolbar
 */

import { $prose } from "@milkdown/kit/utils";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { keymap } from "@milkdown/kit/prose/keymap";
import type { EditorView } from "@milkdown/kit/prose/view";
import { useFormatToolbarStore } from "@/stores/formatToolbarStore";
import { useTableToolbarStore } from "@/stores/tableToolbarStore";
import { isInTable, getTableInfo, getTableRect } from "@/plugins/tableUI/table-utils";
import { FormatToolbarView } from "./FormatToolbarView";

export const formatToolbarPluginKey = new PluginKey("formatToolbar");

/**
 * Check if cursor is inside a code block node.
 */
function isInCodeBlock(view: EditorView): boolean {
  const { $from } = view.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "code_block" || node.type.name === "fence") {
      return true;
    }
  }
  return false;
}

/**
 * Check if cursor is inside a heading node.
 */
function isInHeading(view: EditorView): boolean {
  const { $from } = view.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "heading") {
      return true;
    }
  }
  return false;
}

/**
 * Get cursor rect for positioning toolbar.
 */
function getCursorRect(view: EditorView) {
  const { from, to } = view.state.selection;
  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);

  return {
    top: Math.min(start.top, end.top),
    bottom: Math.max(start.bottom, end.bottom),
    left: Math.min(start.left, end.left),
    right: Math.max(start.right, end.right),
    width: Math.abs(end.left - start.left),
    height: Math.abs(end.bottom - start.top),
  };
}

/**
 * Context-aware toolbar toggle.
 * Routes to appropriate toolbar based on cursor location:
 * - Table → table toolbar
 * - Code block → format toolbar (language picker TBD)
 * - Heading → format toolbar (heading levels TBD)
 * - Regular text → format toolbar
 */
function toggleContextAwareToolbar(view: EditorView): boolean {
  const formatStore = useFormatToolbarStore.getState();
  const tableStore = useTableToolbarStore.getState();

  // If any toolbar is open, close it
  if (formatStore.isOpen) {
    formatStore.closeToolbar();
    view.focus();
    return true;
  }
  if (tableStore.isOpen) {
    tableStore.closeToolbar();
    view.focus();
    return true;
  }

  // 1. Check if in table → show table toolbar
  if (isInTable(view)) {
    const info = getTableInfo(view);
    if (info) {
      const rect = getTableRect(view, info.tablePos);
      if (rect) {
        tableStore.openToolbar({
          tablePos: info.tablePos,
          anchorRect: rect,
        });
        return true;
      }
    }
  }

  // 2. Check if in code block → show format toolbar (language picker TBD)
  // For now, just show format toolbar
  if (isInCodeBlock(view)) {
    const anchorRect = getCursorRect(view);
    formatStore.openToolbar(anchorRect, view);
    return true;
  }

  // 3. Check if in heading → show format toolbar (heading levels TBD)
  // For now, just show format toolbar
  if (isInHeading(view)) {
    const anchorRect = getCursorRect(view);
    formatStore.openToolbar(anchorRect, view);
    return true;
  }

  // 4. Regular text → show format toolbar
  const anchorRect = getCursorRect(view);
  formatStore.openToolbar(anchorRect, view);
  return true;
}

/**
 * Keymap plugin for Cmd+E context-aware toolbar toggle.
 */
export const formatToolbarKeymapPlugin = $prose(() =>
  keymap({
    "Mod-e": (_state, _dispatch, view) => {
      if (!view) return false;
      return toggleContextAwareToolbar(view);
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
