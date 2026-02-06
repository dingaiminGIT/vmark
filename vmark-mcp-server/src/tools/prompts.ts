/**
 * Prompt tools — List, read, and invoke AI prompts.
 *
 * These tools allow AI assistants to discover available prompts,
 * read their templates, and invoke them against editor content.
 */

import { VMarkMcpServer, resolveWindowId, requireStringArg, getStringArg } from '../server.js';

interface PromptEntry {
  name: string;
  path: string;
  source: string;
  category: string | null;
}

interface PromptContent {
  metadata: {
    name: string;
    description: string;
    scope: string;
    category: string | null;
    icon: string | null;
    model: string | null;
  };
  template: string;
}

/**
 * Register all prompt tools on the server.
 */
export function registerPromptTools(server: VMarkMcpServer): void {
  // list_prompts — List available AI prompts
  server.registerTool(
    {
      name: 'list_prompts',
      description:
        'List all available AI prompts from global and workspace directories. ' +
        'Returns prompt names, categories, scopes, and file paths.',
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
        const result = await server.sendBridgeRequest<{ prompts: PromptEntry[] }>({
          type: 'prompts.list',
          windowId,
        });

        if (!result.prompts || result.prompts.length === 0) {
          return VMarkMcpServer.successResult('No prompts found');
        }

        return VMarkMcpServer.successResult(
          `Found ${result.prompts.length} prompt(s):\n` +
            JSON.stringify(result.prompts, null, 2)
        );
      } catch (error) {
        return VMarkMcpServer.errorResult(
          `Failed to list prompts: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  // read_prompt — Read a specific prompt's template
  server.registerTool(
    {
      name: 'read_prompt',
      description:
        'Read a specific AI prompt file and return its metadata and template. ' +
        'Use list_prompts first to discover available prompts and their file paths.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The file path of the prompt to read.',
          },
          windowId: {
            type: 'string',
            description: 'Optional window identifier. Defaults to focused window.',
          },
        },
        required: ['path'],
      },
    },
    async (args) => {
      const path = requireStringArg(args, 'path');
      const windowId = resolveWindowId(args.windowId as string | undefined);

      try {
        const result = await server.sendBridgeRequest<PromptContent>({
          type: 'prompts.read',
          windowId,
          path,
        });

        return VMarkMcpServer.successResult(
          `Prompt: ${result.metadata.name}\n` +
            `Description: ${result.metadata.description}\n` +
            `Scope: ${result.metadata.scope}\n` +
            `Category: ${result.metadata.category ?? 'none'}\n\n` +
            `Template:\n${result.template}`
        );
      } catch (error) {
        return VMarkMcpServer.errorResult(
          `Failed to read prompt: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  // invoke_prompt — Run a prompt against current editor content
  server.registerTool(
    {
      name: 'invoke_prompt',
      description:
        'Invoke an AI prompt against the current editor content. ' +
        'The prompt template will be filled with content based on the scope ' +
        '(selection, block, or document) and sent to the active AI provider.',
      inputSchema: {
        type: 'object',
        properties: {
          promptPath: {
            type: 'string',
            description: 'File path of the prompt to invoke.',
          },
          scope: {
            type: 'string',
            enum: ['selection', 'block', 'document'],
            description: 'Content scope: selection, block, or document.',
          },
          windowId: {
            type: 'string',
            description: 'Optional window identifier. Defaults to focused window.',
          },
        },
        required: ['promptPath'],
      },
    },
    async (args) => {
      const promptPath = requireStringArg(args, 'promptPath');
      const scope = getStringArg(args, 'scope') ?? 'selection';
      const windowId = resolveWindowId(args.windowId as string | undefined);

      try {
        const result = await server.sendBridgeRequest<{ status: string }>({
          type: 'prompts.invoke',
          windowId,
          promptPath,
          scope,
        });

        return VMarkMcpServer.successResult(
          `Prompt invoked: ${result.status}`
        );
      } catch (error) {
        return VMarkMcpServer.errorResult(
          `Failed to invoke prompt: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );
}
