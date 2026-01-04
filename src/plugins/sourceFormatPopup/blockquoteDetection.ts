/**
 * Blockquote Detection for Source Mode
 *
 * Detects if cursor is inside a markdown blockquote.
 */

import type { EditorView } from "@codemirror/view";

export interface BlockquoteInfo {
  /** Start position of the blockquote region */
  from: number;
  /** End position of the blockquote region */
  to: number;
  /** First line number of the blockquote */
  startLine: number;
  /** Last line number of the blockquote */
  endLine: number;
  /** Nesting level (1 = single >, 2 = >> etc.) */
  level: number;
  /** Current line's start position */
  lineStart: number;
  /** Current line's end position */
  lineEnd: number;
}

/**
 * Count the blockquote level of a line (number of > at start).
 */
function getQuoteLevel(text: string): number {
  const match = text.match(/^(\s*>)+/);
  if (!match) return 0;
  return (match[0].match(/>/g) || []).length;
}

/**
 * Check if a line is part of a blockquote.
 */
function isBlockquoteLine(text: string): boolean {
  return /^\s*>/.test(text);
}

/**
 * Detect if cursor is inside a blockquote and get its info.
 */
export function getBlockquoteInfo(view: EditorView): BlockquoteInfo | null {
  const { state } = view;
  const { from } = state.selection.main;
  const doc = state.doc;
  const currentLine = doc.lineAt(from);
  const lineText = currentLine.text;

  // Check if current line is a blockquote line
  if (!isBlockquoteLine(lineText)) {
    return null;
  }

  const currentLevel = getQuoteLevel(lineText);
  const currentLineNum = currentLine.number;

  // Find blockquote boundaries
  let startLine = currentLineNum;
  let endLine = currentLineNum;

  // Scan upward
  for (let lineNum = currentLineNum - 1; lineNum >= 1; lineNum--) {
    const line = doc.line(lineNum);
    if (!isBlockquoteLine(line.text)) {
      startLine = lineNum + 1;
      break;
    }
    startLine = lineNum;
  }

  // Scan downward
  const totalLines = doc.lines;
  for (let lineNum = currentLineNum + 1; lineNum <= totalLines; lineNum++) {
    const line = doc.line(lineNum);
    if (!isBlockquoteLine(line.text)) {
      endLine = lineNum - 1;
      break;
    }
    endLine = lineNum;
  }

  return {
    from: doc.line(startLine).from,
    to: doc.line(endLine).to,
    startLine,
    endLine,
    level: currentLevel,
    lineStart: currentLine.from,
    lineEnd: currentLine.to,
  };
}
