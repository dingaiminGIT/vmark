/**
 * CodeMirror Theme Configuration
 *
 * Styling for the Source mode editor.
 */

import { EditorView } from "@codemirror/view";

/**
 * Custom theme for the Source mode editor.
 * Uses CSS variables for theming compatibility.
 */
export const sourceEditorTheme = EditorView.theme({
  "&": {
    fontSize: "18px",
    height: "100%",
  },
  ".cm-content": {
    fontFamily: "var(--font-sans)",
    lineHeight: "1.8",
    caretColor: "var(--text-color)",
    padding: "0",
  },
  ".cm-line": {
    padding: "0",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "var(--selection-color, rgba(0, 122, 255, 0.2)) !important",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--text-color)",
    borderLeftWidth: "2px",
  },
  // Secondary cursors for multi-cursor
  ".cm-cursor-secondary": {
    borderLeftColor: "var(--primary-color)",
    borderLeftWidth: "2px",
  },
});
