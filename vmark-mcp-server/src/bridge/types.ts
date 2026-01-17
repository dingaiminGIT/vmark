/**
 * Bridge types for communication between MCP server and VMark app.
 * This abstraction enables dependency injection for testing.
 */

/**
 * Window identifier for multi-window support.
 * Can be 'focused' for the currently focused window, or a specific window label.
 */
export type WindowId = 'focused' | string;

/**
 * Position in the document.
 */
export interface Position {
  /** Character offset from start of document */
  offset: number;
}

/**
 * Range in the document.
 */
export interface Range {
  /** Start position (inclusive) */
  from: number;
  /** End position (exclusive) */
  to: number;
}

/**
 * Text selection state.
 */
export interface Selection {
  /** Selected text content */
  text: string;
  /** Selection range */
  range: Range;
  /** Whether selection is empty (cursor only) */
  isEmpty: boolean;
}

/**
 * Cursor context - surrounding content for AI context.
 */
export interface CursorContext {
  /** Text before cursor (configurable lines) */
  before: string;
  /** Text after cursor (configurable lines) */
  after: string;
  /** Current line content */
  currentLine: string;
  /** Current paragraph content */
  currentParagraph: string;
}

/**
 * Document heading for outline.
 */
export interface Heading {
  /** Heading level (1-6) */
  level: number;
  /** Heading text */
  text: string;
  /** Position in document */
  position: number;
}

/**
 * Document metadata.
 */
export interface DocumentMetadata {
  /** File path (null for unsaved) */
  filePath: string | null;
  /** Document title (from first heading or filename) */
  title: string;
  /** Word count */
  wordCount: number;
  /** Character count */
  characterCount: number;
  /** Whether document has unsaved changes */
  isModified: boolean;
  /** Last modified timestamp */
  lastModified: Date | null;
}

/**
 * Window info for list_windows resource.
 */
export interface WindowInfo {
  /** Window label (unique identifier) */
  label: string;
  /** Window title */
  title: string;
  /** File path (null for unsaved) */
  filePath: string | null;
  /** Whether this is the focused window */
  isFocused: boolean;
  /** Whether document is exposed to AI */
  isAiExposed: boolean;
}

/**
 * Format types for toggle operations.
 */
export type FormatType = 'bold' | 'italic' | 'code' | 'strike' | 'underline';

/**
 * Block types for block operations.
 */
export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'heading5'
  | 'heading6'
  | 'codeBlock'
  | 'blockquote';

/**
 * List types.
 */
export type ListType = 'bullet' | 'ordered' | 'taskList';

/**
 * Bridge request types - commands that can be sent to VMark.
 */
export type BridgeRequest =
  | { type: 'document.getContent'; windowId?: WindowId }
  | { type: 'document.setContent'; content: string; windowId?: WindowId }
  | { type: 'document.insertAtCursor'; text: string; windowId?: WindowId }
  | { type: 'document.insertAtPosition'; text: string; position: number; windowId?: WindowId }
  | { type: 'document.search'; query: string; caseSensitive?: boolean; windowId?: WindowId }
  | { type: 'document.replace'; search: string; replace: string; all?: boolean; windowId?: WindowId }
  | { type: 'selection.get'; windowId?: WindowId }
  | { type: 'selection.set'; from: number; to: number; windowId?: WindowId }
  | { type: 'selection.replace'; text: string; windowId?: WindowId }
  | { type: 'selection.delete'; windowId?: WindowId }
  | { type: 'cursor.getContext'; linesBefore?: number; linesAfter?: number; windowId?: WindowId }
  | { type: 'cursor.setPosition'; position: number; windowId?: WindowId }
  | { type: 'format.toggle'; format: FormatType; windowId?: WindowId }
  | { type: 'format.setLink'; url: string; text?: string; windowId?: WindowId }
  | { type: 'format.removeLink'; windowId?: WindowId }
  | { type: 'format.clear'; windowId?: WindowId }
  | { type: 'block.setType'; blockType: BlockType; windowId?: WindowId }
  | { type: 'block.insertHorizontalRule'; windowId?: WindowId }
  | { type: 'list.toggle'; listType: ListType; windowId?: WindowId }
  | { type: 'list.increaseIndent'; windowId?: WindowId }
  | { type: 'list.decreaseIndent'; windowId?: WindowId }
  | { type: 'editor.undo'; windowId?: WindowId }
  | { type: 'editor.redo'; windowId?: WindowId }
  | { type: 'editor.focus'; windowId?: WindowId }
  | { type: 'metadata.get'; windowId?: WindowId }
  | { type: 'outline.get'; windowId?: WindowId }
  | { type: 'windows.list' }
  | { type: 'windows.getFocused' };

/**
 * Bridge response types - responses from VMark.
 */
export type BridgeResponse =
  | { success: true; data: unknown }
  | { success: false; error: string; code?: string };

/**
 * Bridge interface - abstracts communication with VMark.
 * Implement this interface for WebSocket connection or mocks.
 */
export interface Bridge {
  /**
   * Send a request to VMark and wait for response.
   * @param request The request to send
   * @returns Promise resolving to the response
   * @throws Error if connection fails or timeout
   */
  send<T = unknown>(request: BridgeRequest): Promise<BridgeResponse & { data: T }>;

  /**
   * Check if bridge is connected to VMark.
   */
  isConnected(): boolean;

  /**
   * Connect to VMark.
   * @throws Error if connection fails
   */
  connect(): Promise<void>;

  /**
   * Disconnect from VMark.
   */
  disconnect(): Promise<void>;

  /**
   * Subscribe to connection state changes.
   */
  onConnectionChange(callback: (connected: boolean) => void): () => void;
}

/**
 * Search match result.
 */
export interface SearchMatch {
  /** Match text */
  text: string;
  /** Match position */
  range: Range;
  /** Line number (1-indexed) */
  lineNumber: number;
}

/**
 * Search result.
 */
export interface SearchResult {
  /** Total matches found */
  count: number;
  /** Match details */
  matches: SearchMatch[];
}

/**
 * Replace result.
 */
export interface ReplaceResult {
  /** Number of replacements made */
  count: number;
}
