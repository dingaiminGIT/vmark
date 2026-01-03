/**
 * Word Selection Utility
 *
 * Detects and selects words at cursor position for auto-selection
 * when triggering the format popup via keyboard shortcut.
 */

import type { EditorView } from "@codemirror/view";

/**
 * Word character pattern (alphanumeric + underscore).
 */
const WORD_CHAR = /[\w\u4e00-\u9fff\u3400-\u4dbf]/;

/**
 * Get word range at cursor position.
 * Returns the range of the word under cursor, or null if cursor is not in a word.
 *
 * Handles these cases:
 * - Cursor in middle of word: selects entire word
 * - Cursor at end of word: selects word before cursor
 * - Cursor at start of word: selects word after cursor
 * - Cursor in whitespace: returns null
 */
export function getWordAtCursor(
  view: EditorView
): { from: number; to: number } | null {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const lineText = line.text;
  const posInLine = from - line.from;

  // Check if cursor is at a word character or adjacent to one
  const charAtCursor = lineText[posInLine] ?? "";
  const charBefore = posInLine > 0 ? lineText[posInLine - 1] : "";

  const atWordChar = WORD_CHAR.test(charAtCursor);
  const afterWordChar = WORD_CHAR.test(charBefore);

  // If not at or after a word character, no word to select
  if (!atWordChar && !afterWordChar) {
    return null;
  }

  // Find word boundaries
  let start = posInLine;
  let end = posInLine;

  // Expand left
  while (start > 0 && WORD_CHAR.test(lineText[start - 1])) {
    start--;
  }

  // Expand right
  while (end < lineText.length && WORD_CHAR.test(lineText[end])) {
    end++;
  }

  // Convert to document positions
  const wordFrom = line.from + start;
  const wordTo = line.from + end;

  // Don't return empty range
  if (wordFrom === wordTo) {
    return null;
  }

  return { from: wordFrom, to: wordTo };
}

/**
 * Select word at cursor position.
 * Dispatches selection change to editor and returns the new range.
 * Returns null if no word was found.
 */
export function selectWordAtCursor(
  view: EditorView
): { from: number; to: number } | null {
  const range = getWordAtCursor(view);
  if (!range) return null;

  view.dispatch({
    selection: { anchor: range.from, head: range.to },
  });

  return range;
}
