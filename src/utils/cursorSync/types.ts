import type { NodeType } from "@/stores/editorStore";

/**
 * Position information for a line in the editor
 */
export interface LineInfo {
  text: string;
  nodeType: NodeType;
  start: number;
  end: number;
}

/**
 * Result of finding word position
 */
export interface WordPosition {
  line: number;
  column: number;
}

/**
 * Context around cursor for better matching
 */
export interface CursorContext {
  word: string;
  offsetInWord: number;
  contextBefore: string;
  contextAfter: string;
}
