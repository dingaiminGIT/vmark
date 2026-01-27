/**
 * Suggestion tools - Manage AI-generated edit suggestions.
 *
 * These tools allow AI assistants to view and manage suggestions that are
 * pending user approval. When auto-approve is disabled, edits from tools like
 * document_insert_at_cursor return a suggestionId that can be managed here.
 */

import { VMarkMcpServer, resolveWindowId, requireStringArg } from '../server.js';
import type { SuggestionListResult } from '../bridge/types.js';

/**
 * Register all suggestion tools on the server.
 */
export function registerSuggestionTools(server: VMarkMcpServer): void {
  // suggestion_list - List all pending suggestions
  server.registerTool(
    {
      name: 'suggestion_list',
      description:
        'List all pending AI suggestions awaiting user approval. ' +
        'Returns details about each suggestion including its ID, type (insert/replace/delete), ' +
        'position, and content. Use this to check which edits are pending before accepting or rejecting.',
      inputSchema: {
        type: 'object',
        properties: {
          windowId: {
            type: 'string',
            description: 'Optional window identifier. Defaults to focused window.',
          },
        },
      },
    },
    async (args) => {
      const windowId = resolveWindowId(args.windowId as string | undefined);

      try {
        const result = await server.sendBridgeRequest<SuggestionListResult>({
          type: 'suggestion.list',
          windowId,
        });

        if (result.count === 0) {
          return VMarkMcpServer.successResult('No pending suggestions');
        }

        return VMarkMcpServer.successResult(
          `Found ${result.count} pending suggestion(s):\n` +
            JSON.stringify(result.suggestions, null, 2)
        );
      } catch (error) {
        return VMarkMcpServer.errorResult(
          `Failed to list suggestions: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  // suggestion_accept - Accept a specific suggestion
  server.registerTool(
    {
      name: 'suggestion_accept',
      description:
        'Accept a specific AI suggestion by its ID. ' +
        'This applies the suggested edit to the document. ' +
        'Get suggestion IDs from suggestion_list or from edit tool responses.',
      inputSchema: {
        type: 'object',
        properties: {
          suggestionId: {
            type: 'string',
            description: 'The ID of the suggestion to accept.',
          },
          windowId: {
            type: 'string',
            description: 'Optional window identifier. Defaults to focused window.',
          },
        },
        required: ['suggestionId'],
      },
    },
    async (args) => {
      const suggestionId = requireStringArg(args, 'suggestionId');
      const windowId = resolveWindowId(args.windowId as string | undefined);

      try {
        await server.sendBridgeRequest<{ message: string; suggestionId: string }>({
          type: 'suggestion.accept',
          suggestionId,
          windowId,
        });

        return VMarkMcpServer.successResult(`Suggestion ${suggestionId} accepted and applied`);
      } catch (error) {
        return VMarkMcpServer.errorResult(
          `Failed to accept suggestion: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  // suggestion_reject - Reject a specific suggestion
  server.registerTool(
    {
      name: 'suggestion_reject',
      description:
        'Reject a specific AI suggestion by its ID. ' +
        'This removes the suggestion without applying it to the document.',
      inputSchema: {
        type: 'object',
        properties: {
          suggestionId: {
            type: 'string',
            description: 'The ID of the suggestion to reject.',
          },
          windowId: {
            type: 'string',
            description: 'Optional window identifier. Defaults to focused window.',
          },
        },
        required: ['suggestionId'],
      },
    },
    async (args) => {
      const suggestionId = requireStringArg(args, 'suggestionId');
      const windowId = resolveWindowId(args.windowId as string | undefined);

      try {
        await server.sendBridgeRequest<{ message: string; suggestionId: string }>({
          type: 'suggestion.reject',
          suggestionId,
          windowId,
        });

        return VMarkMcpServer.successResult(`Suggestion ${suggestionId} rejected`);
      } catch (error) {
        return VMarkMcpServer.errorResult(
          `Failed to reject suggestion: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  // suggestion_accept_all - Accept all pending suggestions
  server.registerTool(
    {
      name: 'suggestion_accept_all',
      description:
        'Accept all pending AI suggestions at once. ' +
        'This applies all suggested edits to the document in order.',
      inputSchema: {
        type: 'object',
        properties: {
          windowId: {
            type: 'string',
            description: 'Optional window identifier. Defaults to focused window.',
          },
        },
      },
    },
    async (args) => {
      const windowId = resolveWindowId(args.windowId as string | undefined);

      try {
        const result = await server.sendBridgeRequest<{ message: string; count: number }>({
          type: 'suggestion.acceptAll',
          windowId,
        });

        return VMarkMcpServer.successResult(`Accepted ${result.count} suggestion(s)`);
      } catch (error) {
        return VMarkMcpServer.errorResult(
          `Failed to accept all suggestions: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  // suggestion_reject_all - Reject all pending suggestions
  server.registerTool(
    {
      name: 'suggestion_reject_all',
      description:
        'Reject all pending AI suggestions at once. ' +
        'This removes all suggestions without applying them.',
      inputSchema: {
        type: 'object',
        properties: {
          windowId: {
            type: 'string',
            description: 'Optional window identifier. Defaults to focused window.',
          },
        },
      },
    },
    async (args) => {
      const windowId = resolveWindowId(args.windowId as string | undefined);

      try {
        const result = await server.sendBridgeRequest<{ message: string; count: number }>({
          type: 'suggestion.rejectAll',
          windowId,
        });

        return VMarkMcpServer.successResult(`Rejected ${result.count} suggestion(s)`);
      } catch (error) {
        return VMarkMcpServer.errorResult(
          `Failed to reject all suggestions: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );
}
