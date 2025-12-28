// Re-export all cursor sync utilities

// Types
export type { LineInfo, WordPosition, CursorContext } from "./types";

// Markdown utilities
export {
  detectNodeType,
  stripMarkdownSyntax,
  stripInlineFormatting,
  isContentLine,
  isInsideCodeBlock,
  getContentLineIndex,
  getLineFromContentIndex,
} from "./markdown";

// Matching utilities
export { extractCursorContext, findBestPosition } from "./matching";

// CodeMirror functions
export {
  getCursorInfoFromCodeMirror,
  restoreCursorInCodeMirror,
} from "./codemirror";

// ProseMirror functions
export {
  getCursorInfoFromProseMirror,
  restoreCursorInProseMirror,
} from "./prosemirror";
