/**
 * Node Actions for Format Toolbar
 *
 * Handlers for node-specific actions (table, list, blockquote).
 * Used by the merged toolbar in Milkdown mode.
 */

import type { EditorView } from "@milkdown/kit/prose/view";
import type { Ctx } from "@milkdown/kit/ctx";
import { callCommand } from "@milkdown/kit/utils";
import {
  addRowBeforeCommand,
  addRowAfterCommand,
  addColBeforeCommand,
  addColAfterCommand,
  setAlignCommand,
} from "@milkdown/kit/preset/gfm";
import {
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  sinkListItemCommand,
  liftListItemCommand,
} from "@milkdown/kit/preset/commonmark";
import {
  deleteTableAtPos,
  deleteRow,
  deleteColumn,
  isInHeaderRow,
  alignAllColumns,
  formatTable,
  getTableInfo,
} from "@/plugins/tableUI/table-utils";
import type { NodeContext } from "@/stores/formatToolbarStore";

// Editor getter type for command execution
type EditorGetter = () => { action: (fn: (ctx: Ctx) => void) => void } | undefined;

/**
 * Execute a Milkdown command via editor action.
 */
function executeCommand<T>(
  view: EditorView,
  getEditor: EditorGetter,
  command: { key: unknown },
  payload?: T
) {
  const editor = getEditor();
  if (!editor) return;
  view.focus();
  editor.action(callCommand(command.key as never, payload as never));
}

// =============================================================================
// Table Actions
// =============================================================================

export function handleAddRowAbove(view: EditorView, getEditor: EditorGetter) {
  // Can't insert above header row in GFM tables - insert below instead
  if (isInHeaderRow(view)) {
    executeCommand(view, getEditor, addRowAfterCommand);
    return;
  }
  executeCommand(view, getEditor, addRowBeforeCommand);
}

export function handleAddRowBelow(view: EditorView, getEditor: EditorGetter) {
  executeCommand(view, getEditor, addRowAfterCommand);
}

export function handleAddColLeft(view: EditorView, getEditor: EditorGetter) {
  executeCommand(view, getEditor, addColBeforeCommand);
}

export function handleAddColRight(view: EditorView, getEditor: EditorGetter) {
  executeCommand(view, getEditor, addColAfterCommand);
}

export function handleDeleteRow(view: EditorView) {
  view.focus();
  deleteRow(view);
}

export function handleDeleteCol(view: EditorView) {
  view.focus();
  deleteColumn(view);
}

export function handleDeleteTable(view: EditorView, nodeContext: NodeContext): boolean {
  if (nodeContext?.type !== "table") return false;
  view.focus();
  return deleteTableAtPos(view, nodeContext.tablePos);
}

export function handleAlignColumn(
  view: EditorView,
  getEditor: EditorGetter,
  alignment: "left" | "center" | "right",
  allColumns: boolean
) {
  view.focus();
  if (allColumns) {
    alignAllColumns(view, alignment);
  } else {
    executeCommand(view, getEditor, setAlignCommand, alignment);
  }
}

export function handleFormatTable(view: EditorView) {
  view.focus();
  formatTable(view);
}

// =============================================================================
// List Actions
// =============================================================================

/**
 * Indent list item (sink deeper).
 */
export function handleListIndent(view: EditorView, getEditor: EditorGetter) {
  executeCommand(view, getEditor, sinkListItemCommand);
}

/**
 * Outdent list item (lift up).
 */
export function handleListOutdent(view: EditorView, getEditor: EditorGetter) {
  executeCommand(view, getEditor, liftListItemCommand);
}

/**
 * Convert list to bullet list.
 */
export function handleToBulletList(view: EditorView, getEditor: EditorGetter) {
  const { state } = view;
  const { $from } = state.selection;

  // Find list_item and its parent list
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "bullet_list") {
      // Already a bullet list
      view.focus();
      return;
    }
    if (node.type.name === "ordered_list") {
      // Convert ordered to bullet
      view.focus();
      convertListType(view, d, "bullet_list");
      return;
    }
  }

  // Not in a list - wrap in bullet list
  executeCommand(view, getEditor, wrapInBulletListCommand);
}

/**
 * Convert list to ordered list.
 */
export function handleToOrderedList(view: EditorView, getEditor: EditorGetter) {
  const { state } = view;
  const { $from } = state.selection;

  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "ordered_list") {
      // Already an ordered list
      view.focus();
      return;
    }
    if (node.type.name === "bullet_list") {
      // Convert bullet to ordered
      view.focus();
      convertListType(view, d, "ordered_list");
      return;
    }
  }

  // Not in a list - wrap in ordered list
  executeCommand(view, getEditor, wrapInOrderedListCommand);
}

/**
 * Toggle task list item.
 */
export function handleToggleTaskList(view: EditorView) {
  const { state, dispatch } = view;
  const { $from } = state.selection;

  // Find list_item
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "list_item") {
      const pos = $from.before(d);
      const isTask = node.attrs.checked !== null && node.attrs.checked !== undefined;

      // Toggle checked attribute
      const tr = state.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        checked: isTask ? null : false,
      });
      dispatch(tr);
      view.focus();
      return;
    }
  }
}

/**
 * Remove list - unwrap list items to paragraphs.
 */
export function handleRemoveList(view: EditorView, getEditor: EditorGetter) {
  // Lift list item repeatedly until unwrapped
  const maxLifts = 10;
  for (let i = 0; i < maxLifts; i++) {
    const { state } = view;
    const { $from } = state.selection;

    // Check if still in a list
    let inList = false;
    for (let d = $from.depth; d > 0; d--) {
      const node = $from.node(d);
      if (node.type.name === "bullet_list" || node.type.name === "ordered_list") {
        inList = true;
        break;
      }
    }

    if (!inList) break;
    executeCommand(view, getEditor, liftListItemCommand);
  }
}

/**
 * Convert list type by replacing the parent list node.
 */
function convertListType(
  view: EditorView,
  listDepth: number,
  newListType: "bullet_list" | "ordered_list"
) {
  const { state, dispatch } = view;
  const { $from } = state.selection;

  const listNode = $from.node(listDepth);
  const listPos = $from.before(listDepth);
  const newType = state.schema.nodes[newListType];

  if (!newType) return;

  const tr = state.tr.setNodeMarkup(listPos, newType, listNode.attrs);
  dispatch(tr);
}

// =============================================================================
// Blockquote Actions
// =============================================================================

/**
 * Nest blockquote deeper (wrap in another blockquote).
 */
export function handleBlockquoteNest(view: EditorView) {
  const { state, dispatch } = view;
  const { $from } = state.selection;

  // Find innermost blockquote
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "blockquote") {
      const startPos = $from.before(d);
      const endPos = $from.after(d);

      // Wrap the content in another blockquote
      const blockquoteType = state.schema.nodes.blockquote;
      if (!blockquoteType) return;

      const tr = state.tr.wrap(
        state.tr.doc.resolve(startPos + 1).blockRange(state.tr.doc.resolve(endPos - 1))!,
        [{ type: blockquoteType }]
      );
      dispatch(tr);
      view.focus();
      return;
    }
  }
}

/**
 * Unnest blockquote (lift one level).
 */
export function handleBlockquoteUnnest(view: EditorView) {
  const { state, dispatch } = view;
  const { $from } = state.selection;

  // Find innermost blockquote
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "blockquote") {
      // Lift the blockquote content
      const range = $from.blockRange();
      if (range) {
        const tr = state.tr.lift(range, d - 1);
        dispatch(tr);
        view.focus();
      }
      return;
    }
  }
}

/**
 * Remove blockquote entirely.
 */
export function handleRemoveBlockquote(view: EditorView) {
  const { state, dispatch } = view;
  const { $from } = state.selection;

  // Find outermost blockquote and unwrap all levels
  let outermostDepth = -1;
  for (let d = 1; d <= $from.depth; d++) {
    const node = $from.node(d);
    if (node.type.name === "blockquote") {
      outermostDepth = d;
      break;
    }
  }

  if (outermostDepth === -1) return;

  const blockquotePos = $from.before(outermostDepth);
  const blockquoteNode = $from.node(outermostDepth);

  // Replace blockquote with its content
  const tr = state.tr.replaceWith(
    blockquotePos,
    blockquotePos + blockquoteNode.nodeSize,
    blockquoteNode.content
  );
  dispatch(tr);
  view.focus();
}

// =============================================================================
// Node Context Detection
// =============================================================================

/**
 * Get node context for the merged toolbar.
 */
export function getNodeContext(view: EditorView): NodeContext {
  const { $from } = view.state.selection;

  // Check nodes from innermost to outermost (prefer innermost)
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    const typeName = node.type.name;

    // Table
    if (typeName === "table") {
      const info = getTableInfo(view);
      if (info) {
        return {
          type: "table",
          tablePos: info.tablePos,
          rowIndex: info.rowIndex,
          colIndex: info.colIndex,
          numRows: info.numRows,
          numCols: info.numCols,
        };
      }
    }

    // List
    if (typeName === "bullet_list" || typeName === "ordered_list") {
      // Determine list type
      let listType: "bullet" | "ordered" | "task" = "bullet";
      if (typeName === "ordered_list") {
        listType = "ordered";
      } else {
        // Check if it's a task list (list_item with checked attribute)
        for (let dd = d + 1; dd <= $from.depth; dd++) {
          const childNode = $from.node(dd);
          if (childNode.type.name === "list_item") {
            if (childNode.attrs.checked !== null && childNode.attrs.checked !== undefined) {
              listType = "task";
            }
            break;
          }
        }
      }

      // Calculate nesting depth
      let depth = 0;
      for (let dd = 1; dd < d; dd++) {
        const ancestorName = $from.node(dd).type.name;
        if (ancestorName === "bullet_list" || ancestorName === "ordered_list") {
          depth++;
        }
      }

      return {
        type: "list",
        listType,
        nodePos: $from.before(d),
        depth,
      };
    }

    // Blockquote
    if (typeName === "blockquote") {
      // Calculate nesting depth
      let depth = 0;
      for (let dd = 1; dd < d; dd++) {
        if ($from.node(dd).type.name === "blockquote") {
          depth++;
        }
      }

      return {
        type: "blockquote",
        nodePos: $from.before(d),
        depth,
      };
    }
  }

  return null;
}
