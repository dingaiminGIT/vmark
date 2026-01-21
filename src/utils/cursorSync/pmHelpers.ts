/**
 * Shared ProseMirror cursor sync helpers.
 * Used by both Tiptap and ProseMirror cursor sync modules.
 */
import type { Node as PMNode, ResolvedPos } from "@tiptap/pm/model";
import type { CursorInfo } from "@/types/cursorSync";

/**
 * Threshold for detecting cursor at end of line.
 * When percentInLine >= this value, cursor is positioned at line end.
 */
export const END_OF_LINE_THRESHOLD = 0.99;

/**
 * Minimum pattern length for context matching.
 * Shorter patterns are too likely to match in wrong positions.
 */
export const MIN_CONTEXT_PATTERN_LENGTH = 3;

/**
 * Get sourceLine from the nearest ancestor block node.
 * Walks up the ancestor chain to find the first node with a sourceLine attribute.
 *
 * @param $pos - Resolved position in the document
 * @returns The source line number, or null if not found
 */
export function getSourceLineFromPos($pos: ResolvedPos): number | null {
  for (let d = $pos.depth; d >= 0; d--) {
    const node = $pos.node(d);
    const sourceLine = node.attrs.sourceLine as number | null | undefined;
    if (typeof sourceLine === "number") {
      return sourceLine;
    }
  }
  return null;
}

/**
 * Estimate source line from document position by counting nodes with sourceLine.
 * Used as fallback when the node at cursor doesn't have sourceLine.
 *
 * @param doc - The ProseMirror document
 * @param pos - Position in the document
 * @returns Best estimate of source line number (defaults to 1)
 */
export function estimateSourceLine(doc: PMNode, pos: number): number {
  let lastSourceLine = 1;
  doc.nodesBetween(0, pos, (node) => {
    const sourceLine = node.attrs.sourceLine as number | null | undefined;
    if (typeof sourceLine === "number") {
      lastSourceLine = sourceLine;
    }
    return true;
  });
  return lastSourceLine;
}

/**
 * Find the closest node by sourceLine when exact match not found.
 * Returns the textblock node with sourceLine closest to targetLine.
 * Prefers nodes BEFORE the target line to avoid jumping forward in the document.
 *
 * @param doc - The ProseMirror document
 * @param targetLine - The target source line to find
 * @returns Position and node of the closest match, or nulls if none found
 */
export function findClosestSourceLine(
  doc: PMNode,
  targetLine: number
): { pos: number | null; node: PMNode | null } {
  // Track best match before and after target
  let beforePos: number | null = null;
  let beforeNode: PMNode | null = null;
  let beforeLine = -Infinity;

  let afterPos: number | null = null;
  let afterNode: PMNode | null = null;
  let afterLine = Infinity;

  // Container node types that have sourceLine but aren't textblocks
  const containerTypes = new Set(["alertBlock", "detailsBlock"]);

  doc.descendants((node, pos) => {
    const sourceLine = node.attrs.sourceLine as number | null | undefined;
    if (typeof sourceLine !== "number") return true;

    // For textblocks, use directly
    if (node.isTextblock) {
      if (sourceLine <= targetLine && sourceLine > beforeLine) {
        beforeLine = sourceLine;
        beforePos = pos + 1;
        beforeNode = node;
      }
      if (sourceLine > targetLine && sourceLine < afterLine) {
        afterLine = sourceLine;
        afterPos = pos + 1;
        afterNode = node;
      }
    }
    // For containers, find first textblock child
    else if (containerTypes.has(node.type.name)) {
      let firstTextblockPos: number | null = null;
      let firstTextblockNode: PMNode | null = null;
      node.descendants((child, childPos) => {
        if (firstTextblockPos !== null) return false;
        if (child.isTextblock) {
          firstTextblockPos = pos + 1 + childPos + 1;
          firstTextblockNode = child;
          return false;
        }
        return true;
      });
      if (firstTextblockPos !== null && firstTextblockNode !== null) {
        if (sourceLine <= targetLine && sourceLine > beforeLine) {
          beforeLine = sourceLine;
          beforePos = firstTextblockPos;
          beforeNode = firstTextblockNode;
        }
        if (sourceLine > targetLine && sourceLine < afterLine) {
          afterLine = sourceLine;
          afterPos = firstTextblockPos;
          afterNode = firstTextblockNode;
        }
      }
    }
    return true;
  });

  // Prefer node before target (less jarring than jumping forward)
  // Only use after if before is much farther away (>10 lines difference)
  if (beforePos !== null) {
    const beforeDiff = targetLine - beforeLine;
    const afterDiff = afterLine - targetLine;
    if (afterPos !== null && afterDiff < beforeDiff && beforeDiff > 10) {
      return { pos: afterPos, node: afterNode };
    }
    return { pos: beforePos, node: beforeNode };
  }

  return { pos: afterPos, node: afterNode };
}

/**
 * Find the best column position in a line using word/context matching.
 * Tries multiple strategies in order of precision:
 * 1. Context match (using surrounding characters)
 * 2. Word match (finding the word at cursor)
 * 3. Percentage fallback
 *
 * @param lineText - The text content of the line
 * @param cursorInfo - Cursor info with context and position hints
 * @returns Column position within the line
 */
export function findColumnInLine(lineText: string, cursorInfo: CursorInfo): number {
  // Strategy 1: Context match
  const pattern = cursorInfo.contextBefore + cursorInfo.contextAfter;
  if (pattern.length >= MIN_CONTEXT_PATTERN_LENGTH) {
    const idx = lineText.indexOf(pattern);
    if (idx !== -1) {
      return idx + cursorInfo.contextBefore.length;
    }
  }

  // Strategy 2: Word match
  if (cursorInfo.wordAtCursor) {
    const idx = lineText.indexOf(cursorInfo.wordAtCursor);
    if (idx !== -1) {
      return idx + cursorInfo.offsetInWord;
    }
  }

  // Strategy 3: Percentage fallback
  return Math.round(cursorInfo.percentInLine * lineText.length);
}
