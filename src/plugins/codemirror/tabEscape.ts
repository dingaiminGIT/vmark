/**
 * Tab Escape Plugin for CodeMirror
 *
 * Allows pressing Tab to:
 * 1. Navigate within markdown links: [text] -> (url) -> outside
 * 2. Jump over closing brackets, quotes, and markdown format chars.
 */

import { KeyBinding } from "@codemirror/view";
import { guardCodeMirrorKeyBinding } from "@/utils/imeGuard";
import { tabNavigateLink } from "./tabEscapeLink";

// Closing characters that Tab can jump over
const CLOSING_CHARS = new Set([
  ")", "]", "}", '"', "'", "`", ">",
  // Markdown format chars (single)
  "*", "_", "^",
  // CJK closing brackets
  "）", "】", "」", "』", "》", "〉",
  // Curly quotes
  "\u201D", "\u2019", // " '
]);

// Multi-char closing sequences that Tab can jump over
const CLOSING_SEQUENCES = ["~~", "=="];

/**
 * Tab key handler with multiple behaviors:
 * 1. Link navigation: [text] -> (url) -> outside
 * 2. Jump over closing bracket/quote if cursor is before one
 * Falls through to default Tab behavior (indent) otherwise.
 */
export const tabEscapeKeymap: KeyBinding = guardCodeMirrorKeyBinding({
  key: "Tab",
  run: (view) => {
    const { state } = view;
    const { from, to } = state.selection.main;

    // Only handle when no selection
    if (from !== to) return false;

    // Try link navigation first
    if (tabNavigateLink(view)) {
      return true;
    }

    // Check for multi-char closing sequences first (~~, ==)
    const nextTwo = state.doc.sliceString(from, from + 2);
    for (const seq of CLOSING_SEQUENCES) {
      if (nextTwo === seq) {
        view.dispatch({
          selection: { anchor: from + seq.length },
          scrollIntoView: true,
        });
        return true;
      }
    }

    // Check if next char is a closing bracket/quote
    const nextChar = state.doc.sliceString(from, from + 1);
    if (CLOSING_CHARS.has(nextChar)) {
      // Move cursor past the closing char
      view.dispatch({
        selection: { anchor: from + 1 },
        scrollIntoView: true,
      });
      return true;
    }

    return false; // Let default Tab handle it
  },
});
