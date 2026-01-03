/**
 * Source Format Popup Extension for CodeMirror
 *
 * Detects text selection and shows/hides the formatting popup.
 * Table popup is shown via keyboard shortcut, not automatically.
 * Uses debounce to avoid flicker during rapid selection changes.
 */

import { EditorView } from "@codemirror/view";
import { useSourceFormatStore } from "@/stores/sourceFormatStore";
import { getSourceTableInfo } from "./tableDetection";
import { getHeadingInfo } from "./headingDetection";
import { getCodeFenceInfo } from "./codeFenceDetection";
import { getWordAtCursor } from "./wordSelection";

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
 * Shows context-aware popup based on cursor location:
 * - Code fence: language picker
 * - Table: table actions
 * - Heading: heading levels
 * - Regular text: format buttons (auto-selects word if no selection)
 */
export function triggerFormatPopup(view: EditorView): boolean {
  const store = useSourceFormatStore.getState();
  const { from, to } = view.state.selection.main;

  // If popup is already open, close it
  if (store.isOpen) {
    store.closePopup();
    return true;
  }

  // 1. Check if in code fence
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

  // 2. Check if in table
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

  // 3. Check if in heading
  const headingInfo = getHeadingInfo(view);
  if (headingInfo) {
    // For headings, use selection rect if there's a selection, else cursor rect
    let rect;
    if (from !== to) {
      rect = getSelectionRect(view, from, to);
    } else {
      rect = getCursorRect(view, from);
    }
    if (!rect) return false;

    store.openHeadingPopup({
      anchorRect: rect,
      editorView: view,
      headingInfo,
    });
    return true;
  }

  // 4. Regular text - auto-select word if no selection
  let selFrom = from;
  let selTo = to;

  if (selFrom === selTo) {
    // No selection - try to select word at cursor
    const wordRange = getWordAtCursor(view);
    if (!wordRange) {
      return false; // No word to select, do nothing
    }

    // Select the word
    view.dispatch({
      selection: { anchor: wordRange.from, head: wordRange.to },
    });
    selFrom = wordRange.from;
    selTo = wordRange.to;
  }

  // Show format popup
  const rect = getSelectionRect(view, selFrom, selTo);
  if (!rect) return false;

  const selectedText = view.state.doc.sliceString(selFrom, selTo);
  store.openPopup({
    anchorRect: rect,
    selectedText,
    editorView: view,
  });

  return true;
}

// Re-export components
export { SourceFormatPopup } from "./SourceFormatPopup";
export { applyFormat, hasFormat, type FormatType } from "./formatActions";
