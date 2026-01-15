import type { EditorView } from "@codemirror/view";
import type { CursorInfo } from "@/types/cursorSync";
import { detectNodeType, stripMarkdownSyntax, isInsideCodeBlock } from "./markdown";
import { extractCursorContext } from "./matching";
import { MIN_CONTEXT_PATTERN_LENGTH } from "./pmHelpers";

/**
 * Extract cursor info from CodeMirror editor.
 * Uses actual source line number (1-indexed) for sync.
 */
export function getCursorInfoFromCodeMirror(view: EditorView): CursorInfo {
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  const column = pos - line.from;
  const lineText = line.text;

  // Source line number (1-indexed, matches remark parser)
  const sourceLine = line.number;
  const lineIndex = line.number - 1; // 0-based for array access

  const content = view.state.doc.toString();
  const lines = content.split("\n");

  // Detect node type
  let nodeType = detectNodeType(lineText);

  // Check if inside code block
  if (isInsideCodeBlock(lines, lineIndex)) {
    nodeType = "code_block";
  }

  // Strip markdown syntax for accurate text positioning
  const { text: strippedText, adjustedColumn } = stripMarkdownSyntax(lineText, column);

  // Extract word and context from stripped text
  const context = extractCursorContext(strippedText, adjustedColumn);

  // Calculate percentage position in the stripped text
  const percentInLine = strippedText.length > 0 ? adjustedColumn / strippedText.length : 0;

  return {
    sourceLine,
    wordAtCursor: context.word,
    offsetInWord: context.offsetInWord,
    nodeType,
    percentInLine,
    contextBefore: context.contextBefore,
    contextAfter: context.contextAfter,
  };
}

/**
 * Restore cursor position in CodeMirror from cursor info.
 * Uses sourceLine for direct line lookup - much simpler and more accurate.
 */
export function restoreCursorInCodeMirror(view: EditorView, cursorInfo: CursorInfo): void {
  const { sourceLine } = cursorInfo;

  // Clamp to valid line range
  const lineCount = view.state.doc.lines;
  const targetLine = Math.max(1, Math.min(sourceLine, lineCount));
  const docLine = view.state.doc.line(targetLine);
  const lineText = docLine.text;

  // Find column within the line using word/context matching (in stripped space)
  const strippedColumn = findColumnInLine(lineText, cursorInfo);

  // Map column from stripped text back to original line
  // Only leading markers (heading #, list -, blockquote >) affect position mapping
  const markerLength = getLeadingMarkerLength(lineText);
  const finalColumn = Math.min(strippedColumn + markerLength, lineText.length);

  const pos = Math.min(docLine.from + finalColumn, docLine.to);

  view.dispatch({
    selection: { anchor: pos },
    scrollIntoView: true,
  });
}

/**
 * Get the length of leading markdown markers (heading #, list -, blockquote >).
 * These are the only markers that affect position mapping.
 */
function getLeadingMarkerLength(lineText: string): number {
  // Check heading markers: # ## ### etc
  const headingMatch = lineText.match(/^(#{1,6})\s+/);
  if (headingMatch) {
    return headingMatch[0].length;
  }

  // Check list markers: - * + or numbered (with optional leading whitespace)
  const listMatch = lineText.match(/^(\s*)([-*+]|\d+\.)\s+/);
  if (listMatch) {
    return listMatch[0].length;
  }

  // Check blockquote markers: > (can be nested)
  const quoteMatch = lineText.match(/^(>\s*)+/);
  if (quoteMatch) {
    return quoteMatch[0].length;
  }

  return 0;
}

/**
 * Find the best column position in a line using word/context matching.
 */
function findColumnInLine(lineText: string, cursorInfo: CursorInfo): number {
  const { text: strippedText } = stripMarkdownSyntax(lineText, 0);

  // Strategy 1: Context match
  const pattern = cursorInfo.contextBefore + cursorInfo.contextAfter;
  if (pattern.length >= MIN_CONTEXT_PATTERN_LENGTH) {
    const idx = strippedText.indexOf(pattern);
    if (idx !== -1) {
      return idx + cursorInfo.contextBefore.length;
    }
  }

  // Strategy 2: Word match
  if (cursorInfo.wordAtCursor) {
    const idx = strippedText.indexOf(cursorInfo.wordAtCursor);
    if (idx !== -1) {
      return idx + cursorInfo.offsetInWord;
    }
  }

  // Strategy 3: Percentage fallback
  return Math.round(cursorInfo.percentInLine * strippedText.length);
}
