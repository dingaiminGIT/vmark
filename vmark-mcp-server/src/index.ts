#!/usr/bin/env node
/**
 * VMark MCP Server - Main entry point.
 *
 * Exposes VMark's Tiptap editor APIs to AI assistants via MCP protocol.
 *
 * Usage:
 *   npx @vmark/mcp-server
 *   node dist/index.js
 *
 * The server communicates with VMark via WebSocket bridge on localhost:9224.
 */

// Re-export public API
export { VMarkMcpServer, resolveWindowId } from './server.js';
export type { VMarkMcpServerConfig } from './server.js';

export { registerDocumentTools } from './tools/document.js';
export { registerSelectionTools } from './tools/selection.js';
export { registerEditorTools } from './tools/editor.js';

export type {
  Bridge,
  BridgeRequest,
  BridgeResponse,
  WindowId,
  Position,
  Range,
  Selection,
  CursorContext,
  Heading,
  DocumentMetadata,
  WindowInfo,
  FormatType,
  BlockType,
  ListType,
  SearchResult,
  SearchMatch,
  ReplaceResult,
} from './bridge/types.js';

export type {
  ToolDefinition,
  ToolHandler,
  ResourceDefinition,
  ResourceHandler,
  ToolCallResult,
  ResourceReadResult,
  McpServerInterface,
} from './types.js';

import { VMarkMcpServer } from './server.js';
import { registerDocumentTools } from './tools/document.js';
import { registerSelectionTools } from './tools/selection.js';
import { registerEditorTools } from './tools/editor.js';
import type { Bridge } from './bridge/types.js';

/**
 * Create a fully configured VMark MCP server with all tools registered.
 */
export function createVMarkMcpServer(bridge: Bridge): VMarkMcpServer {
  const server = new VMarkMcpServer({ bridge });

  // Register all tool categories
  registerDocumentTools(server);
  registerSelectionTools(server);
  registerEditorTools(server);

  return server;
}

/**
 * List of all tool categories for documentation.
 */
export const TOOL_CATEGORIES = [
  {
    name: 'Document Tools',
    description: 'Read and write document content',
    tools: [
      'document_get_content',
      'document_set_content',
      'document_insert_at_cursor',
      'document_insert_at_position',
      'document_search',
      'document_replace',
    ],
  },
  {
    name: 'Selection Tools',
    description: 'Read and manipulate text selection',
    tools: [
      'selection_get',
      'selection_set',
      'selection_replace',
      'selection_delete',
      'cursor_get_context',
      'cursor_set_position',
    ],
  },
  {
    name: 'Editor Tools',
    description: 'Editor state operations',
    tools: ['editor_undo', 'editor_redo', 'editor_focus'],
  },
] as const;
