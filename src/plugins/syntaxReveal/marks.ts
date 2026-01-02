/**
 * Syntax Reveal Plugin - Mark-based Syntax
 *
 * Handles inline marks: bold, italic, code, strikethrough, link
 */

import type { Decoration } from "@milkdown/kit/prose/view";
import type { Node, Mark, ResolvedPos } from "@milkdown/kit/prose/model";
import { addWidgetDecoration } from "./utils";

// Mark type to syntax mapping
const MARK_SYNTAX: Record<string, { open: string; close: string }> = {
  strong: { open: "**", close: "**" },
  emphasis: { open: "*", close: "*" },
  inlineCode: { open: "`", close: "`" },
  strikethrough: { open: "~~", close: "~~" },
};

const LINK_MARK = "link";

export interface MarkRange {
  mark: Mark;
  from: number;
  to: number;
}

/**
 * Find all mark ranges that contain the given position
 */
function findMarksAtPosition(pos: number, $pos: ResolvedPos): MarkRange[] {
  const ranges: MarkRange[] = [];
  const parent = $pos.parent;
  const parentStart = $pos.start();

  parent.forEach((child, childOffset) => {
    const from = parentStart + childOffset;
    const to = from + child.nodeSize;

    if (pos >= from && pos <= to && child.isText) {
      child.marks.forEach((mark) => {
        const markRange = findMarkRange(pos, mark, parentStart, parent);
        if (markRange) {
          if (!ranges.some((r) => r.from === markRange.from && r.to === markRange.to)) {
            ranges.push(markRange);
          }
        }
      });
    }
  });

  return ranges;
}

/**
 * Find the full range of a mark using single-pass algorithm
 */
export function findMarkRange(
  pos: number,
  mark: Mark,
  parentStart: number,
  parent: Node
): MarkRange | null {
  let from = -1;
  let to = -1;

  parent.forEach((child, childOffset) => {
    const childFrom = parentStart + childOffset;
    const childTo = childFrom + child.nodeSize;

    if (child.isText && mark.isInSet(child.marks)) {
      if (from === -1) {
        from = childFrom;
      }
      to = childTo;
    } else if (from !== -1 && to !== -1) {
      if (pos >= from && pos <= to) {
        return;
      }
      from = -1;
      to = -1;
    }
  });

  if (from !== -1 && to !== -1 && pos >= from && pos <= to) {
    return { mark, from, to };
  }

  return null;
}

/**
 * Add mark-based syntax decorations
 */
export function addMarkSyntaxDecorations(
  decorations: Decoration[],
  pos: number,
  $from: ResolvedPos
): void {
  const markRanges = findMarksAtPosition(pos, $from);

  for (const { mark, from, to } of markRanges) {
    const syntax = MARK_SYNTAX[mark.type.name];

    if (syntax) {
      addWidgetDecoration(decorations, from, syntax.open, "open", -1);
      addWidgetDecoration(decorations, to, syntax.close, "close", 1);
    } else if (mark.type.name === LINK_MARK) {
      const href = mark.attrs.href || "";
      addWidgetDecoration(decorations, from, "[", "link-open", -1);
      addWidgetDecoration(decorations, to, `](${href})`, "link-close", 1);
    }
  }
}
