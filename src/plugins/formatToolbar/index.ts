/**
 * Format Toolbar Plugin
 *
 * Provides Cmd+E toggle for a context-aware floating toolbar in Milkdown.
 * Similar to source mode's format popup.
 *
 * Context detection priority (matches Source mode):
 * 1. Toggle if already open
 * 2. Code block → CODE toolbar
 * 3. Table → TABLE toolbar (merged)
 * 4. List → LIST toolbar (merged)
 * 5. Blockquote → BLOCKQUOTE toolbar (merged)
 * 6. Has selection → FORMAT toolbar
 * 7-10. Inline elements (link, image, math, footnote)
 * 11-12. Heading or paragraph line start → HEADING toolbar
 * 13-14. Word → FORMAT toolbar (auto-select)
 * 15-16. Blank line or otherwise → INSERT toolbar
 */

import { $prose } from "@milkdown/kit/utils";
import { Plugin, PluginKey, TextSelection } from "@milkdown/kit/prose/state";
import { keymap } from "@milkdown/kit/prose/keymap";
import type { EditorView } from "@milkdown/kit/prose/view";
import { useFormatToolbarStore, type HeadingInfo, type ContextMode, type CodeBlockInfo } from "@/stores/formatToolbarStore";
import { useTableToolbarStore } from "@/stores/tableToolbarStore";
import { isInTable, getTableInfo, getTableRect } from "@/plugins/tableUI/table-utils";
import { findWordAtCursor } from "@/plugins/syntaxReveal/marks";
import { FormatToolbarView } from "./FormatToolbarView";

export const formatToolbarPluginKey = new PluginKey("formatToolbar");

/**
 * Get code block info if cursor is inside a code block node.
 * Returns null if not in a code block.
 */
function getCodeBlockInfo(view: EditorView): CodeBlockInfo | null {
  const { $from } = view.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "code_block" || node.type.name === "fence") {
      return {
        language: node.attrs.language || "",
        nodePos: $from.before(d),
      };
    }
  }
  return null;
}

/**
 * Get heading info if cursor is inside a heading node.
 * Returns null if not in a heading.
 */
function getHeadingInfo(view: EditorView): HeadingInfo | null {
  const { $from } = view.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "heading") {
      return {
        level: node.attrs.level || 1,
        nodePos: $from.before(d),
      };
    }
  }
  return null;
}

/**
 * Check if cursor is inside a list node (bullet_list, ordered_list, task_list_item).
 */
function isInList(view: EditorView): boolean {
  const { $from } = view.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    const name = node.type.name;
    if (name === "bullet_list" || name === "ordered_list" || name === "list_item") {
      return true;
    }
  }
  return false;
}

/**
 * Check if cursor is inside a blockquote node.
 */
function isInBlockquote(view: EditorView): boolean {
  const { $from } = view.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "blockquote") {
      return true;
    }
  }
  return false;
}

/**
 * Check if cursor is at the start of a paragraph (not heading, list, blockquote, etc.)
 * For showing heading toolbar to convert paragraph to heading.
 */
function isAtParagraphLineStart(view: EditorView): boolean {
  const { $from } = view.state.selection;

  // Must be at start of text (offset 0 or only whitespace before)
  if ($from.parentOffset !== 0) {
    // Check if all text before cursor is whitespace
    const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
    if (textBefore.trim() !== "") {
      return false;
    }
  }

  // Parent must be a paragraph
  if ($from.parent.type.name !== "paragraph") {
    return false;
  }

  // Paragraph must not be empty (those show block-insert toolbar)
  if ($from.parent.textContent.trim() === "") {
    return false;
  }

  // Not in special containers (list, blockquote, table, code)
  for (let d = $from.depth - 1; d > 0; d--) {
    const ancestor = $from.node(d);
    const name = ancestor.type.name;
    if (
      name === "list_item" ||
      name === "bullet_list" ||
      name === "ordered_list" ||
      name === "blockquote" ||
      name === "table_cell" ||
      name === "table_header" ||
      name === "code_block" ||
      name === "fence"
    ) {
      return false;
    }
  }

  return true;
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
 * Determine context mode based on cursor position.
 * - "format": text selected OR cursor in word
 * - "inline-insert": cursor not in word, not at blank line
 * - "block-insert": cursor at beginning of blank line
 */
function getContextMode(view: EditorView): ContextMode {
  const { empty } = view.state.selection;

  // Has selection → format
  if (!empty) return "format";

  // Check if cursor in word
  const $from = view.state.selection.$from;
  const wordRange = findWordAtCursor($from);
  if (wordRange) return "format";

  // Check if at blank line start
  const parent = $from.parent;
  const atStart = $from.parentOffset === 0;
  const isEmpty = parent.textContent.trim() === "";

  if (atStart && isEmpty) return "block-insert";

  return "inline-insert";
}

/**
 * Context-aware toolbar toggle.
 * Routes to appropriate toolbar based on cursor location.
 * Priority order matches Source mode.
 */
function toggleContextAwareToolbar(view: EditorView): boolean {
  const formatStore = useFormatToolbarStore.getState();
  const tableStore = useTableToolbarStore.getState();
  const { empty } = view.state.selection;

  // 1. Toggle: if any toolbar is open, close it
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

  // 2. Code block → CODE toolbar (language picker)
  const codeBlockInfo = getCodeBlockInfo(view);
  if (codeBlockInfo) {
    const anchorRect = getCursorRect(view);
    formatStore.openCodeToolbar(anchorRect, view, codeBlockInfo);
    return true;
  }

  // 3. Table → TABLE toolbar (merged in Phase 2)
  // TODO: Phase 2 will merge table toolbar into format toolbar
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

  // 4. List → LIST toolbar (merged in Phase 2)
  // TODO: Phase 2 will add list-specific toolbar with format + list actions
  if (isInList(view)) {
    const anchorRect = getCursorRect(view);
    const contextMode = getContextMode(view);
    formatStore.openToolbar(anchorRect, view, contextMode);
    return true;
  }

  // 5. Blockquote → BLOCKQUOTE toolbar (merged in Phase 2)
  // TODO: Phase 2 will add blockquote-specific toolbar with format + quote actions
  if (isInBlockquote(view)) {
    const anchorRect = getCursorRect(view);
    const contextMode = getContextMode(view);
    formatStore.openToolbar(anchorRect, view, contextMode);
    return true;
  }

  // 6. Has selection → FORMAT toolbar
  if (!empty) {
    const anchorRect = getCursorRect(view);
    formatStore.openToolbar(anchorRect, view, "format");
    return true;
  }

  // 7-10. Inline elements (link, image, math, footnote)
  // TODO: Phase 4 will add inline element auto-selection

  // 11. Heading → HEADING toolbar
  const headingInfo = getHeadingInfo(view);
  if (headingInfo) {
    const anchorRect = getCursorRect(view);
    formatStore.openHeadingToolbar(anchorRect, view, headingInfo);
    return true;
  }

  // 12. Cursor at paragraph line start → HEADING toolbar
  if (isAtParagraphLineStart(view)) {
    const anchorRect = getCursorRect(view);
    formatStore.openHeadingToolbar(anchorRect, view, {
      level: 0, // paragraph
      nodePos: view.state.selection.$from.before(view.state.selection.$from.depth),
    });
    return true;
  }

  // 13-14. Cursor in word → FORMAT toolbar (auto-select word)
  const $from = view.state.selection.$from;
  const wordRange = findWordAtCursor($from);
  if (wordRange) {
    // Auto-select the word
    const tr = view.state.tr.setSelection(
      TextSelection.create(view.state.doc, wordRange.from, wordRange.to)
    );
    view.dispatch(tr);

    const anchorRect = getCursorRect(view);
    formatStore.openToolbar(anchorRect, view, "format");
    return true;
  }

  // 15-16. Blank line or otherwise → INSERT toolbar
  const anchorRect = getCursorRect(view);
  const contextMode = getContextMode(view);
  formatStore.openToolbar(anchorRect, view, contextMode);
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
