import type { EditorView } from "@milkdown/kit/prose/view";
import type { Node as PMNode } from "@milkdown/kit/prose/model";
import { TextSelection } from "@milkdown/kit/prose/state";
import type { CursorInfo, NodeType } from "@/stores/editorStore";
import { getContentLineIndex } from "./markdown";
import { extractCursorContext, findBestPosition } from "./matching";

/**
 * Get node type from ProseMirror node
 */
function getNodeTypeFromPM(node: PMNode): NodeType {
  const typeName = node.type.name;
  switch (typeName) {
    case "heading":
      return "heading";
    case "list_item":
    case "bullet_list":
    case "ordered_list":
      return "list_item";
    case "code_block":
      return "code_block";
    case "table_cell":
    case "table_header":
      return "table_cell";
    case "blockquote":
      return "blockquote";
    default:
      return "paragraph";
  }
}

interface LineInfo {
  text: string;
  start: number;
  end: number;
  nodeType: NodeType;
}

/**
 * Build lines array from ProseMirror document
 */
function buildLinesFromDoc(doc: PMNode): LineInfo[] {
  const lines: LineInfo[] = [];

  doc.descendants((node, nodePos) => {
    if (node.isBlock && node.isTextblock) {
      const lineText = node.textContent;
      const lineStart = nodePos + 1; // +1 for opening tag
      lines.push({
        text: lineText,
        start: lineStart,
        end: lineStart + node.content.size,
        nodeType: getNodeTypeFromPM(node),
      });
    }
    return true;
  });

  return lines;
}

/**
 * Extract cursor info from ProseMirror editor
 */
export function getCursorInfoFromProseMirror(view: EditorView): CursorInfo {
  const { state } = view;
  const { from } = state.selection;

  // Build lines with position info
  const lineInfos = buildLinesFromDoc(state.doc);
  const lines = lineInfos.map((l) => l.text);

  // Find which line the cursor is on
  let lineNumber = 0;
  let column = 0;
  let nodeType: NodeType = "paragraph";

  for (let i = 0; i < lineInfos.length; i++) {
    const info = lineInfos[i];
    if (from >= info.start && from <= info.end) {
      lineNumber = i;
      column = from - info.start;
      nodeType = info.nodeType;
      break;
    }
  }

  // Get content line index (skipping blank lines)
  const contentLineIndex = getContentLineIndex(lines, lineNumber);
  const lineText = lines[lineNumber] || "";

  // Extract word and context (ProseMirror text is already stripped of markdown syntax)
  const context = extractCursorContext(lineText, column);

  // Calculate percentage position
  const percentInLine = lineText.length > 0 ? column / lineText.length : 0;

  return {
    contentLineIndex,
    wordAtCursor: context.word,
    offsetInWord: context.offsetInWord,
    nodeType,
    percentInLine,
    contextBefore: context.contextBefore,
    contextAfter: context.contextAfter,
  };
}

/**
 * Restore cursor position in ProseMirror from cursor info
 */
export function restoreCursorInProseMirror(
  view: EditorView,
  cursorInfo: CursorInfo
): void {
  const { state } = view;

  // Build lines with position info
  const lineInfos = buildLinesFromDoc(state.doc);
  const lines = lineInfos.map((l) => l.text);

  // Find best position using matching strategies
  // Note: ProseMirror text is already stripped, so we don't need to adjust for markdown syntax
  const result = findBestPosition(
    lines,
    cursorInfo.contentLineIndex,
    {
      word: cursorInfo.wordAtCursor,
      offsetInWord: cursorInfo.offsetInWord,
      contextBefore: cursorInfo.contextBefore,
      contextAfter: cursorInfo.contextAfter,
    },
    cursorInfo.percentInLine
  );

  if (result.line < lineInfos.length) {
    const lineInfo = lineInfos[result.line];
    let pos = Math.min(lineInfo.start + result.column, lineInfo.end);

    // Handle cursor at line end: position after all inline nodes (e.g., footnotes)
    // percentInLine >= 0.99 indicates cursor was at/near end of line
    // lineInfo.end includes inline nodes, but result.column is based on textContent only
    if (cursorInfo.percentInLine >= 0.99) {
      pos = lineInfo.end;
    }

    // Clamp to valid range
    const clampedPos = Math.max(0, Math.min(pos, state.doc.content.size));

    try {
      const tr = state.tr.setSelection(
        TextSelection.near(state.doc.resolve(clampedPos))
      );
      view.dispatch(tr.scrollIntoView());
    } catch {
      // Fallback: set selection at start
      const tr = state.tr.setSelection(TextSelection.atStart(state.doc));
      view.dispatch(tr.scrollIntoView());
    }
  }
}
