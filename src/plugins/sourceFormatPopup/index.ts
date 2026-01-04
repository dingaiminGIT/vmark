/**
 * Source Format Popup Extension for CodeMirror
 *
 * Detects text selection and shows/hides the formatting popup.
 * Table popup is shown via keyboard shortcut, not automatically.
 * Uses debounce to avoid flicker during rapid selection changes.
 */

import { EditorView } from "@codemirror/view";
import { useSourceFormatStore, type ContextMode } from "@/stores/sourceFormatStore";
import { getSourceTableInfo } from "./tableDetection";
import { getHeadingInfo } from "./headingDetection";
import { getCodeFenceInfo } from "./codeFenceDetection";
import { getWordAtCursor } from "./wordSelection";
import { isAtParagraphLineStart } from "./paragraphDetection";
import { getBlockMathInfo } from "./blockMathDetection";
import { getListItemInfo } from "./listDetection";
import { getBlockquoteInfo } from "./blockquoteDetection";
import { getInlineElementAtCursor } from "./inlineDetection";

/**
 * Determine context mode for format popup based on cursor position.
 * - "format": text selected OR cursor in word
 * - "inline-insert": cursor not in word, not at blank line
 * - "block-insert": cursor at beginning of blank line
 */
function getContextModeSource(view: EditorView): ContextMode {
  const { from, to } = view.state.selection.main;

  // Has selection → format
  if (from !== to) return "format";

  // Check if cursor in word
  const wordRange = getWordAtCursor(view);
  if (wordRange) return "format";

  // Check if at blank line start
  const line = view.state.doc.lineAt(from);
  const atStart = from === line.from;
  const isEmpty = line.text.trim() === "";

  if (atStart && isEmpty) return "block-insert";

  return "inline-insert";
}

// Debounce timeout for showing popup
let showTimeout: ReturnType<typeof setTimeout> | null = null;

// Minimum selection length to show popup
const MIN_SELECTION_LENGTH = 1;

// Delay before showing popup (ms)
const SHOW_DELAY = 200;

/**
 * Check if position is inside a code fence content (not on opening line).
 */
function isInCodeFenceContent(view: EditorView, pos: number): boolean {
  const codeFenceInfo = getCodeFenceInfo(view);
  if (!codeFenceInfo) return false;

  // Check if cursor is inside the fence but NOT on the opening line
  const cursorLine = view.state.doc.lineAt(pos).number;
  return cursorLine > codeFenceInfo.startLine && cursorLine <= codeFenceInfo.endLine;
}

/**
 * Check if cursor is on the opening line of a code fence (after ```).
 */
function isOnCodeFenceOpeningLine(view: EditorView, pos: number): boolean {
  const codeFenceInfo = getCodeFenceInfo(view);
  if (!codeFenceInfo) return false;

  const cursorLine = view.state.doc.lineAt(pos).number;
  return cursorLine === codeFenceInfo.startLine;
}

/**
 * Clear any pending show timeout.
 */
function clearShowTimeout() {
  if (showTimeout) {
    clearTimeout(showTimeout);
    showTimeout = null;
  }
}

/**
 * Get the bounding rect for a selection range.
 */
function getSelectionRect(view: EditorView, from: number, to: number) {
  const fromCoords = view.coordsAtPos(from);
  const toCoords = view.coordsAtPos(to);

  if (!fromCoords || !toCoords) return null;

  return {
    top: Math.min(fromCoords.top, toCoords.top),
    left: Math.min(fromCoords.left, toCoords.left),
    bottom: Math.max(fromCoords.bottom, toCoords.bottom),
    right: Math.max(fromCoords.right, toCoords.right),
  };
}

/**
 * Get the bounding rect for current cursor position.
 */
function getCursorRect(view: EditorView, pos: number) {
  const coords = view.coordsAtPos(pos);
  if (!coords) return null;

  return {
    top: coords.top,
    left: coords.left,
    bottom: coords.bottom,
    right: coords.right,
  };
}

/**
 * CodeMirror extension that monitors selection and manages popup visibility.
 */
export const sourceFormatExtension = EditorView.updateListener.of((update) => {
  // Only handle selection changes
  if (!update.selectionSet) return;

  const { from, to } = update.view.state.selection.main;
  const hasSelection = to - from >= MIN_SELECTION_LENGTH;

  // Check if cursor is on code fence opening line (show language picker)
  if (!hasSelection && isOnCodeFenceOpeningLine(update.view, from)) {
    clearShowTimeout();
    showTimeout = setTimeout(() => {
      const codeFenceInfo = getCodeFenceInfo(update.view);
      if (!codeFenceInfo) return;

      const cursorLine = update.view.state.doc.lineAt(from).number;
      if (cursorLine !== codeFenceInfo.startLine) return;

      const rect = getCursorRect(update.view, from);
      if (!rect) return;

      useSourceFormatStore.getState().openCodePopup({
        anchorRect: rect,
        editorView: update.view,
        codeFenceInfo,
      });
    }, SHOW_DELAY);
    return;
  }

  if (hasSelection) {
    // Clear any pending timeout
    clearShowTimeout();

    // Schedule popup show with delay
    showTimeout = setTimeout(() => {
      // Re-check selection (might have changed during delay)
      const currentSelection = update.view.state.selection.main;
      const currentFrom = currentSelection.from;
      const currentTo = currentSelection.to;

      if (currentTo - currentFrom < MIN_SELECTION_LENGTH) {
        // No selection - close popup (table popup is triggered by shortcut)
        useSourceFormatStore.getState().closePopup();
        return;
      }

      // Don't show popup if selection is in code fence content
      if (isInCodeFenceContent(update.view, currentFrom) || isInCodeFenceContent(update.view, currentTo)) {
        useSourceFormatStore.getState().closePopup();
        return;
      }

      const rect = getSelectionRect(update.view, currentFrom, currentTo);
      if (!rect) return;

      // Check if selection is in a heading
      const headingInfo = getHeadingInfo(update.view);
      if (headingInfo) {
        useSourceFormatStore.getState().openHeadingPopup({
          anchorRect: rect,
          editorView: update.view,
          headingInfo,
        });
        return;
      }

      // Regular text selection - show format popup
      const selectedText = update.view.state.doc.sliceString(currentFrom, currentTo);

      useSourceFormatStore.getState().openPopup({
        anchorRect: rect,
        selectedText,
        editorView: update.view,
      });
    }, SHOW_DELAY);
  } else {
    // No selection - close popup (table popup is triggered by shortcut)
    clearShowTimeout();
    useSourceFormatStore.getState().closePopup();
  }
});

/**
 * Toggle table popup visibility. Called via keyboard shortcut.
 * Shows table popup if cursor is in a table, otherwise does nothing.
 */
export function toggleTablePopup(view: EditorView): boolean {
  const store = useSourceFormatStore.getState();

  // If table popup is already open, close it
  if (store.isOpen && store.mode === "table") {
    store.closePopup();
    return true;
  }

  // Check if cursor is in a table
  const tableInfo = getSourceTableInfo(view);
  if (!tableInfo) {
    return false; // Not in table, don't consume the key
  }

  // Show table popup
  const { from } = view.state.selection.main;
  const rect = getCursorRect(view, from);
  if (!rect) return false;

  store.openTablePopup({
    anchorRect: rect,
    editorView: view,
    tableInfo,
  });

  return true;
}

/**
 * Trigger format popup at cursor position via keyboard shortcut.
 * Shows context-aware popup based on cursor location following priority order:
 * 1. Toggle if already open
 * 2. Code fence → CODE toolbar
 * 3. Block math → MATH toolbar
 * 4. Table → TABLE toolbar (merged)
 * 5. List → LIST toolbar (merged)
 * 6. Blockquote → BLOCKQUOTE toolbar (merged)
 * 7. Has selection → FORMAT toolbar
 * 8-11. Inline elements (link, image, math, footnote)
 * 12-13. Heading or paragraph line start → HEADING toolbar
 * 14-15. Formatted range or word → FORMAT toolbar (auto-select)
 * 16-17. Blank line or otherwise → INSERT toolbar
 */
export function triggerFormatPopup(view: EditorView): boolean {
  const store = useSourceFormatStore.getState();
  const { from, to } = view.state.selection.main;
  const hasSelection = from !== to;

  // 1. Toggle: if popup is already open, close it
  if (store.isOpen) {
    store.closePopup();
    return true;
  }

  // 2. Code fence → CODE toolbar
  const codeFenceInfo = getCodeFenceInfo(view);
  if (codeFenceInfo) {
    const rect = getCursorRect(view, from);
    if (!rect) return false;

    store.openCodePopup({
      anchorRect: rect,
      editorView: view,
      codeFenceInfo,
    });
    return true;
  }

  // 3. Block math ($$...$$) → MATH toolbar
  const blockMathInfo = getBlockMathInfo(view);
  if (blockMathInfo) {
    const rect = getCursorRect(view, from);
    if (!rect) return false;

    store.openMathPopup({
      anchorRect: rect,
      editorView: view,
      blockMathInfo,
    });
    return true;
  }

  // 4. Table → TABLE toolbar (merged with format)
  const tableInfo = getSourceTableInfo(view);
  if (tableInfo) {
    const rect = getCursorRect(view, from);
    if (!rect) return false;

    store.openTablePopup({
      anchorRect: rect,
      editorView: view,
      tableInfo,
    });
    return true;
  }

  // 5. List → LIST toolbar (merged with format)
  const listInfo = getListItemInfo(view);
  if (listInfo) {
    const rect = getCursorRect(view, from);
    if (!rect) return false;

    store.openListPopup({
      anchorRect: rect,
      editorView: view,
      listInfo,
    });
    return true;
  }

  // 6. Blockquote → BLOCKQUOTE toolbar (merged with format)
  const blockquoteInfo = getBlockquoteInfo(view);
  if (blockquoteInfo) {
    const rect = getCursorRect(view, from);
    if (!rect) return false;

    store.openBlockquotePopup({
      anchorRect: rect,
      editorView: view,
      blockquoteInfo,
    });
    return true;
  }

  // 7. Has selection → FORMAT toolbar (honor user's selection)
  if (hasSelection) {
    const rect = getSelectionRect(view, from, to);
    if (!rect) return false;

    const selectedText = view.state.doc.sliceString(from, to);
    store.openPopup({
      anchorRect: rect,
      selectedText,
      editorView: view,
      contextMode: "format",
    });
    return true;
  }

  // 8-11. Check inline elements (link, image, math, footnote)
  const inlineElement = getInlineElementAtCursor(view);
  if (inlineElement) {
    // 9. Image → Do nothing (has own popup on click)
    if (inlineElement.type === "image") {
      return false;
    }

    // 11. Footnote → FOOTNOTE toolbar
    if (inlineElement.type === "footnote") {
      const rect = getSelectionRect(view, inlineElement.from, inlineElement.to);
      if (!rect) return false;

      // Auto-select the footnote reference
      view.dispatch({
        selection: { anchor: inlineElement.contentFrom, head: inlineElement.contentTo },
      });

      store.openFootnotePopup({
        anchorRect: rect,
        editorView: view,
      });
      return true;
    }

    // 8, 10. Link or inline math → FORMAT toolbar (auto-select content)
    const rect = getSelectionRect(view, inlineElement.contentFrom, inlineElement.contentTo);
    if (!rect) return false;

    // Auto-select the content
    view.dispatch({
      selection: { anchor: inlineElement.contentFrom, head: inlineElement.contentTo },
    });

    const selectedText = view.state.doc.sliceString(
      inlineElement.contentFrom,
      inlineElement.contentTo
    );
    store.openPopup({
      anchorRect: rect,
      selectedText,
      editorView: view,
      contextMode: "format",
    });
    return true;
  }

  // 12. Heading → HEADING toolbar
  const headingInfo = getHeadingInfo(view);
  if (headingInfo) {
    const rect = getCursorRect(view, from);
    if (!rect) return false;

    store.openHeadingPopup({
      anchorRect: rect,
      editorView: view,
      headingInfo,
    });
    return true;
  }

  // 13. Cursor at paragraph line start → HEADING toolbar
  if (isAtParagraphLineStart(view)) {
    const rect = getCursorRect(view, from);
    if (!rect) return false;

    const line = view.state.doc.lineAt(from);
    store.openHeadingPopup({
      anchorRect: rect,
      editorView: view,
      headingInfo: {
        level: 0, // paragraph
        lineStart: line.from,
        lineEnd: line.to,
      },
    });
    return true;
  }

  // 14-15. Cursor in word → FORMAT toolbar (auto-select word)
  const wordRange = getWordAtCursor(view);
  if (wordRange) {
    const rect = getSelectionRect(view, wordRange.from, wordRange.to);
    if (!rect) return false;

    // Auto-select the word
    view.dispatch({
      selection: { anchor: wordRange.from, head: wordRange.to },
    });

    const selectedText = view.state.doc.sliceString(wordRange.from, wordRange.to);
    store.openPopup({
      anchorRect: rect,
      selectedText,
      editorView: view,
      contextMode: "format",
    });
    return true;
  }

  // 16-17. Blank line or otherwise → INSERT toolbar
  const contextMode = getContextModeSource(view);
  const rect = getCursorRect(view, from);
  if (!rect) return false;

  store.openPopup({
    anchorRect: rect,
    selectedText: "",
    editorView: view,
    contextMode,
  });

  return true;
}

// Re-export components
export { SourceFormatPopup } from "./SourceFormatPopup";
export { applyFormat, hasFormat, type FormatType } from "./formatActions";
