/**
 * Syntax Reveal Plugin - Node-based Syntax
 *
 * Handles block-level nodes: headings, code blocks, blockquotes, lists
 */

import { Decoration } from "@milkdown/kit/prose/view";
import type { ResolvedPos } from "@milkdown/kit/prose/model";
import { addWidgetDecoration } from "./utils";

/**
 * Add node-based syntax decorations
 */
export function addNodeSyntaxDecorations(
  decorations: Decoration[],
  $from: ResolvedPos
): void {
  const parent = $from.parent;
  const parentStart = $from.start();

  // Heading: # ## ### etc.
  if (parent.type.name === "heading") {
    const level = (parent.attrs.level as number) || 1;
    const marker = "#".repeat(level) + " ";
    addWidgetDecoration(decorations, parentStart, marker, "heading", -1);
    return; // Headings don't nest with other block types
  }

  // Code block: ```language
  if (parent.type.name === "code_block") {
    const language = (parent.attrs.language as string) || "";
    const openMarker = "```" + language;
    const closeMarker = "```";

    addWidgetDecoration(decorations, parentStart, openMarker, "codeblock-open", -1);
    // Close marker at the end of the code block content
    const contentEnd = parentStart + parent.content.size;
    addWidgetDecoration(decorations, contentEnd, closeMarker, "codeblock-close", 1);
    return;
  }

  // Walk up ancestors for blockquotes and lists
  addAncestorDecorations(decorations, $from);
}

/**
 * Add decorations for ancestor nodes (blockquote, lists)
 */
function addAncestorDecorations(
  decorations: Decoration[],
  $from: ResolvedPos
): void {
  // Track what we've already shown to avoid duplicates
  const shown = new Set<string>();

  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    const nodeStart = $from.start(depth);
    const nodeType = node.type.name;

    // Blockquote: >
    if (nodeType === "blockquote" && !shown.has("blockquote")) {
      addWidgetDecoration(decorations, nodeStart, "> ", "blockquote", -1);
      shown.add("blockquote");
    }

    // List item within a list
    if (nodeType === "list_item") {
      // Find parent list to determine marker type
      const parentDepth = depth - 1;
      if (parentDepth > 0) {
        const parentList = $from.node(parentDepth);
        const listType = parentList.type.name;

        if (listType === "bullet_list" && !shown.has("bullet")) {
          addWidgetDecoration(decorations, nodeStart, "- ", "list-bullet", -1);
          shown.add("bullet");
        } else if (listType === "ordered_list" && !shown.has("ordered")) {
          // Get the item index for ordered lists
          const index = getListItemIndex($from, depth, parentDepth);
          const marker = `${index}. `;
          addWidgetDecoration(decorations, nodeStart, marker, "list-ordered", -1);
          shown.add("ordered");
        }
      }
    }

    // Task list item: - [ ] or - [x]
    if (nodeType === "task_list_item" && !shown.has("task")) {
      const checked = node.attrs.checked as boolean;
      const marker = checked ? "- [x] " : "- [ ] ";
      addWidgetDecoration(decorations, nodeStart, marker, "list-task", -1);
      shown.add("task");
    }
  }
}

/**
 * Get the index of a list item within its parent ordered list
 */
function getListItemIndex(
  $from: ResolvedPos,
  itemDepth: number,
  listDepth: number
): number {
  const list = $from.node(listDepth);
  const listStart = $from.start(listDepth);
  const itemStart = $from.start(itemDepth);

  let index = 1;
  const startAttr = (list.attrs.start as number) || 1;

  // Count list items before current position
  list.forEach((child, offset) => {
    const childStart = listStart + offset;
    if (child.type.name === "list_item" && childStart < itemStart) {
      index++;
    }
  });

  return startAttr + index - 1;
}
