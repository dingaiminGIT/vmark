/**
 * Shared types for cursor synchronization between editors.
 */

/**
 * Node types for cursor sync.
 * Maps to block-level markdown structures.
 */
export type NodeType =
  | "paragraph"
  | "heading"
  | "list_item"
  | "code_block"
  | "table_cell"
  | "blockquote";

/**
 * Cursor position info for syncing between editors.
 * Uses sourceLine from remark parser for accurate line mapping.
 */
export interface CursorInfo {
  /**
   * Actual source line number (1-indexed, matches remark parser positions).
   * Used for cursor sync between Source and WYSIWYG modes.
   */
  sourceLine: number;
  /** Word at or near cursor for fine positioning */
  wordAtCursor: string;
  /** Character offset within the word */
  offsetInWord: number;
  /** Type of block the cursor is in */
  nodeType: NodeType;
  /** Cursor position as percentage (0-1) for fallback positioning */
  percentInLine: number;
  /** Characters before cursor for disambiguation */
  contextBefore: string;
  /** Characters after cursor for disambiguation */
  contextAfter: string;
}
