// Re-export all cursor sync utilities

// Types
export type { CursorContext } from "./types";

// Markdown utilities
export {
  detectNodeType,
  stripMarkdownSyntax,
  stripInlineFormatting,
  isInsideCodeBlock,
} from "./markdown";

// Matching utilities
export { extractCursorContext } from "./matching";

// Shared ProseMirror helpers
export {
  getSourceLineFromPos,
  estimateSourceLine,
  findClosestSourceLine,
  findColumnInLine,
  END_OF_LINE_THRESHOLD,
  MIN_CONTEXT_PATTERN_LENGTH,
} from "./pmHelpers";

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
