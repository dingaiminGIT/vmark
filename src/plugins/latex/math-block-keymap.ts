/**
 * Math Block Keymap Plugin
 *
 * Handles keyboard navigation into and out of math blocks.
 * ProseMirror can't naturally navigate into isolating nodes,
 * so we intercept arrow keys and create NodeSelection when appropriate.
 */

import { $prose } from "@milkdown/kit/utils";
import { Plugin, PluginKey, NodeSelection, Selection } from "@milkdown/kit/prose/state";
import type { Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
import { mathBlockId } from "./math-block-schema";

export const mathBlockKeymapKey = new PluginKey("mathBlockKeymap");

function isMathBlock(node: ProseMirrorNode | null | undefined): boolean {
  return node?.type.name === mathBlockId;
}

interface MathBlockResult {
  node: ProseMirrorNode;
  pos: number;
}

/**
 * Check if there's a math node (block or inline) after the cursor.
 */
function getMathAfter(doc: ProseMirrorNode, pos: number): MathBlockResult | null {
  const $pos = doc.resolve(pos);

  // Check the node immediately after current position
  const after = $pos.nodeAfter;
  if (isMathBlock(after)) {
    return { node: after!, pos };
  }

  // Find the block-level parent and check its next sibling
  for (let depth = $pos.depth; depth > 0; depth--) {
    const parent = $pos.node(depth - 1);
    const indexInParent = $pos.index(depth - 1);

    // Check if next sibling at this level is a math block
    if (indexInParent + 1 < parent.childCount) {
      const nextNode = parent.child(indexInParent + 1);
      if (isMathBlock(nextNode)) {
        // Calculate position of the next sibling
        const blockStart = $pos.before(depth);
        const currentBlock = $pos.node(depth);
        const nextBlockPos = blockStart + currentBlock.nodeSize;
        return { node: nextNode, pos: nextBlockPos };
      }
    }
  }

  return null;
}

/**
 * Check if there's a math node (block or inline) before the cursor.
 */
function getMathBefore(doc: ProseMirrorNode, pos: number): MathBlockResult | null {
  const $pos = doc.resolve(pos);

  // Check the node immediately before current position
  const before = $pos.nodeBefore;
  if (isMathBlock(before)) {
    return { node: before!, pos: pos - before!.nodeSize };
  }

  // Find the block-level parent and check its previous sibling
  for (let depth = $pos.depth; depth > 0; depth--) {
    const parent = $pos.node(depth - 1);
    const indexInParent = $pos.index(depth - 1);

    // Check if previous sibling at this level is a math block
    if (indexInParent > 0) {
      const prevNode = parent.child(indexInParent - 1);
      if (isMathBlock(prevNode)) {
        // Calculate position of the previous sibling
        const blockStart = $pos.before(depth);
        const prevBlockPos = blockStart - prevNode.nodeSize;
        return { node: prevNode, pos: prevBlockPos };
      }
    }
  }

  return null;
}

export const mathBlockKeymap = $prose(() => {
  return new Plugin({
    key: mathBlockKeymapKey,
    props: {
      handleKeyDown(view, event) {
        const { state } = view;
        const { selection } = state;

        // Only handle arrow keys
        if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(event.key)) {
          return false;
        }

        const isDown = event.key === "ArrowDown" || event.key === "ArrowRight";
        const isUp = event.key === "ArrowUp" || event.key === "ArrowLeft";

        // Handle navigation OUT of a math block when already selected
        if (selection instanceof NodeSelection && isMathBlock(selection.node)) {
          const nodePos = selection.from;
          const nodeSize = selection.node.nodeSize;

          if (isDown) {
            // Move cursor to after the node
            const afterPos = nodePos + nodeSize;
            const tr = state.tr.setSelection(Selection.near(state.doc.resolve(afterPos), 1));
            view.dispatch(tr);
            return true;
          }
          if (isUp) {
            // Move cursor to before the node
            const tr = state.tr.setSelection(Selection.near(state.doc.resolve(nodePos), -1));
            view.dispatch(tr);
            return true;
          }
          return false;
        }

        // For down/right: check if there's a math node after cursor
        if (isDown) {
          const mathAfter = getMathAfter(state.doc, selection.to);
          if (mathAfter) {
            const tr = state.tr.setSelection(NodeSelection.create(state.doc, mathAfter.pos));
            view.dispatch(tr);
            return true;
          }
        }

        // For up/left: check if there's a math node before cursor
        if (isUp) {
          const mathBefore = getMathBefore(state.doc, selection.from);
          if (mathBefore) {
            const tr = state.tr.setSelection(NodeSelection.create(state.doc, mathBefore.pos));
            view.dispatch(tr);
            return true;
          }
        }

        return false;
      },
    },
  });
});
