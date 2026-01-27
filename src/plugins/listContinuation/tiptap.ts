import { Extension } from "@tiptap/core";
import { keymap } from "@tiptap/pm/keymap";
import { liftListItem, splitListItem } from "@tiptap/pm/schema-list";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import type { NodeType } from "@tiptap/pm/model";
import { guardProseMirrorCommand } from "@/utils/imeGuard";

function isListItemEmpty(state: EditorState, listItemType: NodeType): boolean {
  const { $from } = state.selection;

  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type === listItemType) {
      return node.textContent.trim() === "";
    }
  }
  return false;
}

/**
 * Check if the current list item is a task (has checked attribute).
 */
function isInTaskItem(state: EditorState, listItemType: NodeType): boolean {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type === listItemType) {
      const checked = node.attrs.checked;
      return checked === true || checked === false;
    }
  }
  return false;
}

/**
 * Custom splitListItem that resets checked to false for new task items.
 * When pressing Enter on a checked task, the new item should be unchecked.
 */
function splitTaskListItem(
  listItemType: NodeType,
  state: EditorState,
  dispatch?: (tr: Transaction) => void
): boolean {
  // Create a wrapper dispatch that modifies the transaction
  const wrappedDispatch = dispatch
    ? (tr: Transaction) => {
        // After split, the cursor is in the new list item
        // Find and reset its checked attribute to false
        const { $from } = tr.selection;
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d);
          if (node.type === listItemType) {
            const checked = node.attrs.checked;
            if (checked === true || checked === false) {
              const pos = $from.before(d);
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: false });
            }
            break;
          }
        }
        dispatch(tr);
      }
    : undefined;

  return splitListItem(listItemType)(state, wrappedDispatch);
}

function handleListEnter(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
  _view?: EditorView
): boolean {
  const listItemType = state.schema.nodes["listItem"] ?? state.schema.nodes["list_item"];
  if (!listItemType) return false;

  const { $from } = state.selection;

  let inListItem = false;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type === listItemType) {
      inListItem = true;
      break;
    }
  }

  if (!inListItem) return false;

  if (isListItemEmpty(state, listItemType)) {
    return liftListItem(listItemType)(state, dispatch);
  }

  // Use custom split for task items to reset checked state
  if (isInTaskItem(state, listItemType)) {
    return splitTaskListItem(listItemType, state, dispatch);
  }

  return splitListItem(listItemType)(state, dispatch);
}

export const listContinuationExtension = Extension.create({
  name: "listContinuation",
  priority: 1000,
  addProseMirrorPlugins() {
    return [
      keymap({
        Enter: guardProseMirrorCommand(handleListEnter),
      }),
    ];
  },
});
