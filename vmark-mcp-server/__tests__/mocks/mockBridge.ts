/**
 * MockBridge - Test double for Bridge interface.
 * Allows configuring responses and tracking requests for testing.
 */

import type {
  Bridge,
  BridgeRequest,
  BridgeResponse,
  Selection,
  CursorContext,
  DocumentMetadata,
  Heading,
  WindowInfo,
  SearchResult,
  ReplaceResult,
} from '../../src/bridge/types.js';

/**
 * Mock document state for testing.
 */
export interface MockDocumentState {
  content: string;
  selection: Selection;
  cursorPosition: number;
  metadata: DocumentMetadata;
  outline: Heading[];
}

/**
 * Mock window state for testing.
 */
export interface MockWindowState extends MockDocumentState {
  label: string;
  title: string;
  isFocused: boolean;
  isAiExposed: boolean;
}

/**
 * Configuration options for MockBridge.
 */
export interface MockBridgeConfig {
  /** Initial connected state */
  connected?: boolean;
  /** Simulated latency in ms */
  latency?: number;
  /** Whether to throw on send when disconnected */
  throwOnDisconnected?: boolean;
}

/**
 * Recorded request for verification.
 */
export interface RecordedRequest {
  request: BridgeRequest;
  timestamp: number;
}

/**
 * MockBridge implementation for testing.
 */
export class MockBridge implements Bridge {
  private connected: boolean;
  private latency: number;
  private throwOnDisconnected: boolean;
  private connectionCallbacks: Set<(connected: boolean) => void> = new Set();

  /** Recorded requests for verification */
  public readonly requests: RecordedRequest[] = [];

  /** Current mock state */
  private windows: Map<string, MockWindowState> = new Map();
  private focusedWindowLabel: string = 'main';

  /** Custom response handlers */
  private responseHandlers: Map<
    string,
    (request: BridgeRequest) => BridgeResponse
  > = new Map();

  /** Error to throw on next request */
  private nextError: Error | null = null;

  constructor(config: MockBridgeConfig = {}) {
    this.connected = config.connected ?? true;
    this.latency = config.latency ?? 0;
    this.throwOnDisconnected = config.throwOnDisconnected ?? true;

    // Initialize default window
    this.windows.set('main', this.createDefaultWindowState('main'));
  }

  private createDefaultWindowState(label: string): MockWindowState {
    return {
      label,
      title: 'Untitled',
      isFocused: label === this.focusedWindowLabel,
      isAiExposed: true,
      content: '',
      selection: { text: '', range: { from: 0, to: 0 }, isEmpty: true },
      cursorPosition: 0,
      metadata: {
        filePath: null,
        title: 'Untitled',
        wordCount: 0,
        characterCount: 0,
        isModified: false,
        lastModified: null,
      },
      outline: [],
    };
  }

  // ============ Bridge Interface Implementation ============

  async send<T = unknown>(
    request: BridgeRequest
  ): Promise<BridgeResponse & { data: T }> {
    // Record request
    this.requests.push({ request, timestamp: Date.now() });

    // Check for programmed error
    if (this.nextError) {
      const error = this.nextError;
      this.nextError = null;
      throw error;
    }

    // Check connection
    if (!this.connected && this.throwOnDisconnected) {
      throw new Error('Bridge not connected');
    }

    // Simulate latency
    if (this.latency > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latency));
    }

    // Check for custom handler
    const customHandler = this.responseHandlers.get(request.type);
    if (customHandler) {
      return customHandler(request) as BridgeResponse & { data: T };
    }

    // Handle request with default mock behavior
    return this.handleRequest(request) as BridgeResponse & { data: T };
  }

  isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    this.connected = true;
    this.notifyConnectionChange();
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    this.connected = false;
    this.notifyConnectionChange();
  }

  onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.connectionCallbacks.add(callback);
    return () => this.connectionCallbacks.delete(callback);
  }

  private notifyConnectionChange(): void {
    for (const callback of this.connectionCallbacks) {
      callback(this.connected);
    }
  }

  // ============ Mock State Management ============

  /**
   * Set document content for a window.
   */
  setContent(content: string, windowId: string = 'main'): void {
    const window = this.getOrCreateWindow(windowId);
    window.content = content;
    window.metadata.characterCount = content.length;
    window.metadata.wordCount = content
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
    window.metadata.isModified = true;
    this.updateOutline(window);
  }

  /**
   * Set selection for a window.
   */
  setSelection(from: number, to: number, windowId: string = 'main'): void {
    const window = this.getOrCreateWindow(windowId);
    const content = window.content;
    const len = content.length;

    // Bounds checking: clamp positions to valid range
    const clampedFrom = Math.max(0, Math.min(from, len));
    const clampedTo = Math.max(0, Math.min(to, len));

    // Ensure from <= to (swap if needed)
    const actualFrom = Math.min(clampedFrom, clampedTo);
    const actualTo = Math.max(clampedFrom, clampedTo);

    window.selection = {
      text: content.slice(actualFrom, actualTo),
      range: { from: actualFrom, to: actualTo },
      isEmpty: actualFrom === actualTo,
    };
    window.cursorPosition = actualTo;
  }

  /**
   * Set cursor position for a window.
   */
  setCursorPosition(position: number, windowId: string = 'main'): void {
    this.setSelection(position, position, windowId);
  }

  /**
   * Set metadata for a window.
   */
  setMetadata(
    metadata: Partial<DocumentMetadata>,
    windowId: string = 'main'
  ): void {
    const window = this.getOrCreateWindow(windowId);
    window.metadata = { ...window.metadata, ...metadata };
    if (metadata.title) {
      window.title = metadata.title;
    }
  }

  /**
   * Add a window.
   */
  addWindow(label: string, state?: Partial<MockWindowState>): void {
    const windowState = this.createDefaultWindowState(label);
    if (state) {
      Object.assign(windowState, state);
    }
    this.windows.set(label, windowState);
  }

  /**
   * Set focused window.
   */
  setFocusedWindow(label: string): void {
    if (!this.windows.has(label)) {
      throw new Error(`Window ${label} does not exist`);
    }
    this.focusedWindowLabel = label;
    for (const [windowLabel, state] of this.windows) {
      state.isFocused = windowLabel === label;
    }
  }

  /**
   * Get window state (for assertions).
   */
  getWindowState(windowId: string = 'main'): MockWindowState | undefined {
    return this.windows.get(windowId);
  }

  /**
   * Set a custom response handler for a request type.
   */
  setResponseHandler(
    requestType: string,
    handler: (request: BridgeRequest) => BridgeResponse
  ): void {
    this.responseHandlers.set(requestType, handler);
  }

  /**
   * Clear custom response handler.
   */
  clearResponseHandler(requestType: string): void {
    this.responseHandlers.delete(requestType);
  }

  /**
   * Program an error for the next request.
   */
  setNextError(error: Error): void {
    this.nextError = error;
  }

  /**
   * Clear all recorded requests.
   */
  clearRequests(): void {
    this.requests.length = 0;
  }

  /**
   * Get requests of a specific type.
   */
  getRequestsOfType(type: string): RecordedRequest[] {
    return this.requests.filter((r) => r.request.type === type);
  }

  /**
   * Reset mock to initial state.
   */
  reset(): void {
    this.windows.clear();
    this.windows.set('main', this.createDefaultWindowState('main'));
    this.focusedWindowLabel = 'main';
    this.requests.length = 0;
    this.responseHandlers.clear();
    this.nextError = null;
  }

  // ============ Private Helpers ============

  private getOrCreateWindow(windowId: string): MockWindowState {
    let window = this.windows.get(windowId);
    if (!window) {
      window = this.createDefaultWindowState(windowId);
      this.windows.set(windowId, window);
    }
    return window;
  }

  private resolveWindowId(windowId?: string): string {
    if (!windowId || windowId === 'focused') {
      return this.focusedWindowLabel;
    }
    return windowId;
  }

  private updateOutline(window: MockWindowState): void {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const outline: Heading[] = [];
    let match;

    while ((match = headingRegex.exec(window.content)) !== null) {
      outline.push({
        level: match[1].length,
        text: match[2],
        position: match.index,
      });
    }

    window.outline = outline;
  }

  private handleRequest(request: BridgeRequest): BridgeResponse {
    const windowId = this.resolveWindowId(
      'windowId' in request ? (request.windowId as string | undefined) : undefined
    );
    const window = this.windows.get(windowId);

    switch (request.type) {
      case 'document.getContent':
        if (!window) {
          return { success: false, error: `Window ${windowId} not found` };
        }
        return { success: true, data: window.content };

      case 'document.setContent':
        if (!window) {
          return { success: false, error: `Window ${windowId} not found` };
        }
        this.setContent(request.content, windowId);
        return { success: true, data: null };

      case 'document.insertAtCursor': {
        if (!window) {
          return { success: false, error: `Window ${windowId} not found` };
        }
        const pos = window.cursorPosition;
        const before = window.content.slice(0, pos);
        const after = window.content.slice(pos);
        this.setContent(before + request.text + after, windowId);
        this.setCursorPosition(pos + request.text.length, windowId);
        return { success: true, data: null };
      }

      case 'document.insertAtPosition': {
        if (!window) {
          return { success: false, error: `Window ${windowId} not found` };
        }
        // Bounds checking: clamp position to valid range
        const pos = Math.max(0, Math.min(request.position, window.content.length));
        const before = window.content.slice(0, pos);
        const after = window.content.slice(pos);
        this.setContent(before + request.text + after, windowId);
        return { success: true, data: null };
      }

      case 'document.search': {
        if (!window) {
          return { success: false, error: `Window ${windowId} not found` };
        }
        const result = this.searchDocument(
          window,
          request.query,
          request.caseSensitive ?? false
        );
        return { success: true, data: result };
      }

      case 'document.replace': {
        if (!window) {
          return { success: false, error: `Window ${windowId} not found` };
        }
        const result = this.replaceInDocument(
          window,
          windowId,
          request.search,
          request.replace,
          request.all ?? false
        );
        return { success: true, data: result };
      }

      case 'selection.get':
        if (!window) {
          return { success: false, error: `Window ${windowId} not found` };
        }
        return { success: true, data: window.selection };

      case 'selection.set':
        if (!window) {
          return { success: false, error: `Window ${windowId} not found` };
        }
        this.setSelection(request.from, request.to, windowId);
        return { success: true, data: null };

      case 'selection.replace': {
        if (!window) {
          return { success: false, error: `Window ${windowId} not found` };
        }
        const { from, to } = window.selection.range;
        const before = window.content.slice(0, from);
        const after = window.content.slice(to);
        this.setContent(before + request.text + after, windowId);
        this.setCursorPosition(from + request.text.length, windowId);
        return { success: true, data: null };
      }

      case 'selection.delete': {
        if (!window) {
          return { success: false, error: `Window ${windowId} not found` };
        }
        const { from, to } = window.selection.range;
        const before = window.content.slice(0, from);
        const after = window.content.slice(to);
        this.setContent(before + after, windowId);
        this.setCursorPosition(from, windowId);
        return { success: true, data: null };
      }

      case 'cursor.getContext': {
        if (!window) {
          return { success: false, error: `Window ${windowId} not found` };
        }
        const context = this.getCursorContext(
          window,
          request.linesBefore ?? 3,
          request.linesAfter ?? 3
        );
        return { success: true, data: context };
      }

      case 'cursor.setPosition':
        if (!window) {
          return { success: false, error: `Window ${windowId} not found` };
        }
        this.setCursorPosition(request.position, windowId);
        return { success: true, data: null };

      case 'metadata.get':
        if (!window) {
          return { success: false, error: `Window ${windowId} not found` };
        }
        return { success: true, data: window.metadata };

      case 'outline.get':
        if (!window) {
          return { success: false, error: `Window ${windowId} not found` };
        }
        return { success: true, data: window.outline };

      case 'windows.list': {
        const windowList: WindowInfo[] = [];
        for (const [label, state] of this.windows) {
          if (state.isAiExposed) {
            windowList.push({
              label,
              title: state.title,
              filePath: state.metadata.filePath,
              isFocused: state.isFocused,
              isAiExposed: state.isAiExposed,
            });
          }
        }
        return { success: true, data: windowList };
      }

      case 'windows.getFocused':
        return { success: true, data: this.focusedWindowLabel };

      case 'editor.undo':
      case 'editor.redo':
      case 'editor.focus':
      case 'format.toggle':
      case 'format.setLink':
      case 'format.removeLink':
      case 'format.clear':
      case 'block.setType':
      case 'block.insertHorizontalRule':
      case 'list.toggle':
      case 'list.increaseIndent':
      case 'list.decreaseIndent':
        // These operations are acknowledged but don't change mock state
        // In real implementation, these would modify the editor
        return { success: true, data: null };

      default:
        return {
          success: false,
          error: `Unknown request type: ${(request as BridgeRequest).type}`,
          code: 'UNKNOWN_REQUEST',
        };
    }
  }

  private searchDocument(
    window: MockWindowState,
    query: string,
    caseSensitive: boolean
  ): SearchResult {
    // Guard against empty query to prevent infinite loop
    if (!query || query.length === 0) {
      return { count: 0, matches: [] };
    }

    const content = caseSensitive
      ? window.content
      : window.content.toLowerCase();
    const searchQuery = caseSensitive ? query : query.toLowerCase();

    const matches: SearchResult['matches'] = [];
    let index = 0;

    while ((index = content.indexOf(searchQuery, index)) !== -1) {
      const lineNumber = window.content.slice(0, index).split('\n').length;
      matches.push({
        text: window.content.slice(index, index + query.length),
        range: { from: index, to: index + query.length },
        lineNumber,
      });
      index += query.length; // Move past the match to avoid overlapping matches
    }

    return { count: matches.length, matches };
  }

  private replaceInDocument(
    window: MockWindowState,
    windowId: string,
    search: string,
    replace: string,
    all: boolean
  ): ReplaceResult {
    let content = window.content;
    let count = 0;

    if (all) {
      const parts = content.split(search);
      count = parts.length - 1;
      content = parts.join(replace);
    } else {
      const index = content.indexOf(search);
      if (index !== -1) {
        content =
          content.slice(0, index) + replace + content.slice(index + search.length);
        count = 1;
      }
    }

    if (count > 0) {
      this.setContent(content, windowId);
    }

    return { count };
  }

  private getCursorContext(
    window: MockWindowState,
    linesBefore: number,
    linesAfter: number
  ): CursorContext {
    const content = window.content;
    const pos = window.cursorPosition;

    const lines = content.split('\n');
    const beforeContent = content.slice(0, pos);
    const currentLineIndex = beforeContent.split('\n').length - 1;

    const beforeLines = lines
      .slice(Math.max(0, currentLineIndex - linesBefore), currentLineIndex)
      .join('\n');
    const afterLines = lines
      .slice(currentLineIndex + 1, currentLineIndex + 1 + linesAfter)
      .join('\n');
    const currentLine = lines[currentLineIndex] || '';

    // Find current paragraph
    let paragraphStart = currentLineIndex;
    while (paragraphStart > 0 && lines[paragraphStart - 1].trim() !== '') {
      paragraphStart--;
    }
    let paragraphEnd = currentLineIndex;
    while (
      paragraphEnd < lines.length - 1 &&
      lines[paragraphEnd + 1].trim() !== ''
    ) {
      paragraphEnd++;
    }
    const currentParagraph = lines.slice(paragraphStart, paragraphEnd + 1).join('\n');

    return {
      before: beforeLines,
      after: afterLines,
      currentLine,
      currentParagraph,
    };
  }
}
