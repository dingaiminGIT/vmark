/**
 * Tab Indent Plugin for CodeMirror
 *
 * Fallback Tab handler that inserts spaces when Tab is not handled
 * by other keymaps (tab escape, indent in code, etc.).
 *
 * This prevents Tab from moving focus outside the editor.
 */

import { KeyBinding } from "@codemirror/view";
import { guardCodeMirrorKeyBinding } from "@/utils/imeGuard";
import { useSettingsStore } from "@/stores/settingsStore";

/**
 * Get the configured tab size (number of spaces).
 */
function getTabSize(): number {
  return useSettingsStore.getState().general.tabSize;
}

/**
 * Tab key handler: insert spaces when Tab is not handled by other keymaps.
 * This is a fallback to prevent focus from leaving the editor.
 */
export const tabIndentFallbackKeymap: KeyBinding = guardCodeMirrorKeyBinding({
  key: "Tab",
  run: (view) => {
    const { state } = view;
    const { from, to } = state.selection.main;
    const spaces = " ".repeat(getTabSize());

    // Insert spaces (replaces selection if any)
    view.dispatch({
      changes: { from, to, insert: spaces },
      selection: { anchor: from + spaces.length },
      scrollIntoView: true,
    });
    return true;
  },
});

/**
 * Shift+Tab key handler: outdent (remove up to tabSize spaces before cursor).
 * This is a fallback to prevent focus from leaving the editor.
 */
export const shiftTabIndentFallbackKeymap: KeyBinding = guardCodeMirrorKeyBinding({
  key: "Shift-Tab",
  run: (view) => {
    const { state } = view;
    const { from } = state.selection.main;

    // Find the start of the current line
    const line = state.doc.lineAt(from);
    const lineStart = line.from;
    const textBefore = state.doc.sliceString(lineStart, from);

    // Count leading spaces
    const leadingSpaces = textBefore.match(/^[ ]*/)?.[0].length ?? 0;
    if (leadingSpaces === 0) return true; // Nothing to outdent, but still handle the key

    // Remove up to tabSize spaces
    const spacesToRemove = Math.min(leadingSpaces, getTabSize());
    view.dispatch({
      changes: { from: lineStart, to: lineStart + spacesToRemove, insert: "" },
      scrollIntoView: true,
    });
    return true;
  },
});
