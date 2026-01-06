/**
 * Cursor-Aware Node Decorations
 *
 * Adds node decorations to inline nodes when cursor is inside.
 * Works with NodeViews that have dual DOM (preview + contentDOM).
 *
 * Supported nodes:
 * - math_inline: $...$
 * - image: ![alt](url)
 * - footnote_reference: [^label]
 */

import { Decoration } from "@tiptap/pm/view";
import type { Node } from "@tiptap/pm/model";

// Node types that support cursor-aware editing
const CURSOR_AWARE_NODES = new Set([
  "math_inline",
  "image",
  "footnote_reference",
]);

/**
 * Add node decorations for cursor-aware editing.
 * Adds "editing" class to nodes when cursor is inside.
 */
export function addNodeDecorations(
  decorations: Decoration[],
  from: number,
  to: number,
  doc: Node
): void {
  doc.descendants((node, pos) => {
    if (!CURSOR_AWARE_NODES.has(node.type.name)) {
      return true; // Continue traversing
    }

    const nodeStart = pos;
    const nodeEnd = pos + node.nodeSize;

    // Check if cursor is inside or adjacent to this node
    // from >= nodeStart: cursor at or after node start
    // to <= nodeEnd: cursor at or before node end
    const cursorInside = from >= nodeStart && to <= nodeEnd;

    if (cursorInside) {
      decorations.push(
        Decoration.node(nodeStart, nodeEnd, {
          class: "editing",
        })
      );
    }

    return false; // Don't descend into these nodes
  });
}
