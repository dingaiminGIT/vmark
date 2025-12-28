import type { EditorView as CMEditorView } from "@codemirror/view";
import type { EditorView as PMEditorView } from "@milkdown/kit/prose/view";
import { TextSelection } from "@milkdown/kit/prose/state";
import type { CursorInfo } from "@/stores/editorStore";

/**
 * Check if a line is content (not blank or HTML-only)
 */
function isContentLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === "") return false;
  // Skip HTML-only lines like <br />, <br/>, <hr />, etc.
  if (/^<\/?[a-z][^>]*\/?>$/i.test(trimmed)) return false;
  return true;
}

/**
 * Get content line index (skipping blank and HTML-only lines) from a line number
 */
function getContentLineIndex(lines: string[], lineNumber: number): number {
  let contentLineIndex = 0;
  for (let i = 0; i < lineNumber && i < lines.length; i++) {
    if (isContentLine(lines[i])) {
      contentLineIndex++;
    }
  }
  return contentLineIndex;
}

/**
 * Get line number from content line index (skipping blank and HTML-only lines)
 */
function getLineFromContentIndex(
  lines: string[],
  contentLineIndex: number
): number {
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (isContentLine(lines[i])) {
      if (count === contentLineIndex) {
        return i;
      }
      count++;
    }
  }
  // Return last content line if not found
  for (let i = lines.length - 1; i >= 0; i--) {
    if (isContentLine(lines[i])) {
      return i;
    }
  }
  return 0;
}

/**
 * Get word at position and offset within it
 */
function getWordAtPosition(
  text: string,
  pos: number
): { word: string; offsetInWord: number } {
  if (!text || pos < 0) {
    return { word: "", offsetInWord: 0 };
  }

  // Find word boundaries
  let start = pos;
  let end = pos;

  // Move start back to word boundary
  while (start > 0 && /\w/.test(text[start - 1])) {
    start--;
  }

  // Move end forward to word boundary
  while (end < text.length && /\w/.test(text[end])) {
    end++;
  }

  const word = text.slice(start, end);
  const offsetInWord = pos - start;

  return { word, offsetInWord };
}

/**
 * Find position of word in text, starting from approximate line
 */
function findWordPosition(
  lines: string[],
  contentLineIndex: number,
  word: string,
  offsetInWord: number
): { line: number; column: number } | null {
  const targetLine = getLineFromContentIndex(lines, contentLineIndex);
  const lineText = lines[targetLine] || "";

  if (word) {
    // Try to find word in target line
    const wordIndex = lineText.indexOf(word);
    if (wordIndex !== -1) {
      return { line: targetLine, column: wordIndex + offsetInWord };
    }

    // Search nearby lines
    for (let offset = 1; offset <= 3; offset++) {
      for (const delta of [-offset, offset]) {
        const searchLine = targetLine + delta;
        if (searchLine >= 0 && searchLine < lines.length) {
          const idx = lines[searchLine].indexOf(word);
          if (idx !== -1) {
            return { line: searchLine, column: idx + offsetInWord };
          }
        }
      }
    }
  }

  // Fallback: start of target line
  return { line: targetLine, column: 0 };
}

/**
 * Extract cursor info from CodeMirror editor
 */
export function getCursorInfoFromCodeMirror(view: CMEditorView): CursorInfo {
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  const lineNumber = line.number - 1; // 0-based
  const column = pos - line.from;

  const content = view.state.doc.toString();
  const lines = content.split("\n");
  const contentLineIndex = getContentLineIndex(lines, lineNumber);

  const lineText = line.text;
  const { word, offsetInWord } = getWordAtPosition(lineText, column);

  return {
    contentLineIndex,
    wordAtCursor: word,
    offsetInWord,
  };
}

/**
 * Restore cursor position in CodeMirror from cursor info
 */
export function restoreCursorInCodeMirror(
  view: CMEditorView,
  cursorInfo: CursorInfo
): void {
  const content = view.state.doc.toString();
  const lines = content.split("\n");

  const result = findWordPosition(
    lines,
    cursorInfo.contentLineIndex,
    cursorInfo.wordAtCursor,
    cursorInfo.offsetInWord
  );

  if (result) {
    const line = view.state.doc.line(result.line + 1); // 1-based
    const pos = Math.min(line.from + result.column, line.to);

    view.dispatch({
      selection: { anchor: pos },
      scrollIntoView: true,
    });
  }
}

/**
 * Extract cursor info from ProseMirror editor
 */
export function getCursorInfoFromProseMirror(view: PMEditorView): CursorInfo {
  const { state } = view;
  const { from } = state.selection;

  // Get text content line by line
  let lineNumber = 0;
  let column = 0;
  const lines: string[] = [];

  state.doc.descendants((node, nodePos) => {
    if (node.isBlock && node.isTextblock) {
      const lineText = node.textContent;
      lines.push(lineText);

      const lineStart = nodePos + 1; // +1 for opening tag
      const lineEnd = lineStart + node.content.size;

      if (from >= lineStart && from <= lineEnd) {
        lineNumber = lines.length - 1;
        column = from - lineStart;
      }
    }
    return true;
  });

  const contentLineIndex = getContentLineIndex(lines, lineNumber);
  const lineText = lines[lineNumber] || "";
  const { word, offsetInWord } = getWordAtPosition(lineText, column);

  return {
    contentLineIndex,
    wordAtCursor: word,
    offsetInWord,
  };
}

/**
 * Restore cursor position in ProseMirror from cursor info
 */
export function restoreCursorInProseMirror(
  view: PMEditorView,
  cursorInfo: CursorInfo
): void {
  const { state } = view;

  // Build lines array from document
  const lines: string[] = [];
  const linePositions: { start: number; end: number }[] = [];

  state.doc.descendants((node, nodePos) => {
    if (node.isBlock && node.isTextblock) {
      const lineText = node.textContent;
      lines.push(lineText);
      const lineStart = nodePos + 1;
      linePositions.push({
        start: lineStart,
        end: lineStart + node.content.size,
      });
    }
    return true;
  });

  const result = findWordPosition(
    lines,
    cursorInfo.contentLineIndex,
    cursorInfo.wordAtCursor,
    cursorInfo.offsetInWord
  );

  if (result && result.line < linePositions.length) {
    const lineInfo = linePositions[result.line];
    const pos = Math.min(lineInfo.start + result.column, lineInfo.end);

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
