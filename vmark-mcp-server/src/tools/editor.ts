/**
 * Editor tools - Editor state operations (undo, redo, focus).
 */

import { VMarkMcpServer, resolveWindowId } from '../server.js';

/**
 * Register all editor tools on the server.
 */
export function registerEditorTools(server: VMarkMcpServer): void {
  // editor_undo - Undo the last action
  server.registerTool(
    {
      name: 'editor_undo',
      description:
        'Undo the last editing action. ' +
        'Restores the document to its previous state before the last change.',
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
        await server.sendBridgeRequest<null>({
          type: 'editor.undo',
          windowId,
        });

        return VMarkMcpServer.successResult('Undo completed');
      } catch (error) {
        return VMarkMcpServer.errorResult(
          `Failed to undo: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  // editor_redo - Redo the last undone action
  server.registerTool(
    {
      name: 'editor_redo',
      description:
        'Redo the last undone action. ' +
        'Re-applies a change that was previously undone.',
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
        await server.sendBridgeRequest<null>({
          type: 'editor.redo',
          windowId,
        });

        return VMarkMcpServer.successResult('Redo completed');
      } catch (error) {
        return VMarkMcpServer.errorResult(
          `Failed to redo: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  // editor_focus - Focus the editor
  server.registerTool(
    {
      name: 'editor_focus',
      description:
        'Focus the editor in the specified window. ' +
        'Brings the editor into focus, ready for input.',
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
        await server.sendBridgeRequest<null>({
          type: 'editor.focus',
          windowId,
        });

        return VMarkMcpServer.successResult('Editor focused');
      } catch (error) {
        return VMarkMcpServer.errorResult(
          `Failed to focus editor: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );
}
