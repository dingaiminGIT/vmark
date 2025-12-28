import type { EditorView } from "@codemirror/view";
import type { CursorInfo } from "@/stores/editorStore";
import {
  detectNodeType,
  stripMarkdownSyntax,
  getContentLineIndex,
  isInsideCodeBlock,
} from "./markdown";
import { extractCursorContext } from "./matching";
import { findBestPosition } from "./matching";

/**
 * Extract cursor info from CodeMirror editor
 */
export function getCursorInfoFromCodeMirror(view: EditorView): CursorInfo {
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  const lineNumber = line.number - 1; // 0-based
  const column = pos - line.from;
  const lineText = line.text;

  const content = view.state.doc.toString();
  const lines = content.split("\n");

  // Detect node type
  let nodeType = detectNodeType(lineText);

  // Check if inside code block
  if (isInsideCodeBlock(lines, lineNumber)) {
    nodeType = "code_block";
  }

  // Get content line index
  const contentLineIndex = getContentLineIndex(lines, lineNumber);

  // Strip markdown syntax for accurate text positioning
  const { text: strippedText, adjustedColumn } = stripMarkdownSyntax(
    lineText,
    column
  );

  // Extract word and context from stripped text
  const context = extractCursorContext(strippedText, adjustedColumn);

  // Calculate percentage position in the stripped text
  const percentInLine =
    strippedText.length > 0 ? adjustedColumn / strippedText.length : 0;

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
 * Restore cursor position in CodeMirror from cursor info
 */
export function restoreCursorInCodeMirror(
  view: EditorView,
  cursorInfo: CursorInfo
): void {
  const content = view.state.doc.toString();
  const lines = content.split("\n");

  // Find best position using matching strategies
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

  // For CodeMirror, we need to add back the markdown syntax offset
  const targetLineText = lines[result.line] || "";
  const { adjustedColumn } = stripMarkdownSyntax(targetLineText, 0);
  const syntaxOffset = targetLineText.length > 0 ? -adjustedColumn : 0;

  // Calculate the final column, accounting for markdown syntax
  let finalColumn = result.column;
  if (syntaxOffset < 0) {
    // There's markdown syntax at the start, add it back
    const { text: stripped } = stripMarkdownSyntax(targetLineText, 0);
    const markerLength = targetLineText.length - stripped.length;
    finalColumn = Math.min(result.column + markerLength, targetLineText.length);
  }

  // Get the actual position in the document
  const docLine = view.state.doc.line(result.line + 1); // 1-based
  const pos = Math.min(docLine.from + finalColumn, docLine.to);

  view.dispatch({
    selection: { anchor: pos },
    scrollIntoView: true,
  });
}
