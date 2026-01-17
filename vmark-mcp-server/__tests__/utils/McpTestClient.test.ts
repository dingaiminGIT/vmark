/**
 * Tests for McpTestClient utility.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  McpTestClient,
  createMockMcpServer,
  registerMockTool,
  registerMockResource,
  type McpServerForTest,
  type ToolCallResult,
  type ResourceReadResult,
} from './McpTestClient.js';

describe('McpTestClient', () => {
  let server: McpServerForTest;
  let client: McpTestClient;

  beforeEach(() => {
    server = createMockMcpServer();
    client = new McpTestClient(server);
  });

  describe('tool operations', () => {
    it('should list available tools', () => {
      registerMockTool(
        server,
        {
          name: 'test_tool',
          description: 'A test tool',
          inputSchema: { type: 'object', properties: {} },
        },
        async () => ({ success: true, content: [{ type: 'text', text: 'ok' }] })
      );

      const tools = client.listTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test_tool');
    });

    it('should get tool definition by name', () => {
      registerMockTool(
        server,
        {
          name: 'my_tool',
          description: 'My tool description',
          inputSchema: {
            type: 'object',
            properties: { arg1: { type: 'string' } },
            required: ['arg1'],
          },
        },
        async () => ({ success: true, content: [] })
      );

      const tool = client.getTool('my_tool');

      expect(tool).toBeDefined();
      expect(tool?.description).toBe('My tool description');
      expect(tool?.inputSchema.required).toContain('arg1');
    });

    it('should return undefined for unknown tool', () => {
      const tool = client.getTool('nonexistent');
      expect(tool).toBeUndefined();
    });

    it('should call tool and return result', async () => {
      registerMockTool(
        server,
        {
          name: 'echo',
          description: 'Echo tool',
          inputSchema: {
            type: 'object',
            properties: { message: { type: 'string' } },
          },
        },
        async (args) => ({
          success: true,
          content: [{ type: 'text', text: args.message as string }],
        })
      );

      const result = await client.callTool('echo', { message: 'hello' });

      expect(result.success).toBe(true);
      expect(McpTestClient.getTextContent(result)).toBe('hello');
    });

    it('should record tool call history', async () => {
      registerMockTool(
        server,
        {
          name: 'test',
          description: 'Test',
          inputSchema: { type: 'object', properties: {} },
        },
        async () => ({ success: true, content: [] })
      );

      await client.callTool('test', { arg1: 'value1' });
      await client.callTool('test', { arg2: 'value2' });

      const history = client.getToolCallHistory();
      expect(history).toHaveLength(2);
      expect(history[0].args).toEqual({ arg1: 'value1' });
      expect(history[1].args).toEqual({ arg2: 'value2' });
    });

    it('should handle tool call errors', async () => {
      const result = await client.callTool('nonexistent', {});

      expect(result.success).toBe(false);
      expect(result.isError).toBe(true);
    });
  });

  describe('resource operations', () => {
    it('should list available resources', () => {
      registerMockResource(
        server,
        {
          uri: 'vmark://test',
          name: 'Test Resource',
          description: 'A test resource',
        },
        async () => ({ contents: [{ uri: 'vmark://test', text: 'content' }] })
      );

      const resources = client.listResources();

      expect(resources).toHaveLength(1);
      expect(resources[0].uri).toBe('vmark://test');
    });

    it('should get resource definition by URI', () => {
      registerMockResource(
        server,
        {
          uri: 'vmark://document',
          name: 'Document',
          description: 'Current document content',
          mimeType: 'text/markdown',
        },
        async () => ({ contents: [] })
      );

      const resource = client.getResource('vmark://document');

      expect(resource).toBeDefined();
      expect(resource?.name).toBe('Document');
      expect(resource?.mimeType).toBe('text/markdown');
    });

    it('should return undefined for unknown resource', () => {
      const resource = client.getResource('vmark://nonexistent');
      expect(resource).toBeUndefined();
    });

    it('should read resource and return result', async () => {
      registerMockResource(
        server,
        {
          uri: 'vmark://content',
          name: 'Content',
          description: 'Content resource',
        },
        async (uri) => ({
          contents: [{ uri, text: 'Hello, World!' }],
        })
      );

      const result = await client.readResource('vmark://content');

      expect(result.contents).toHaveLength(1);
      expect(McpTestClient.getResourceText(result)).toBe('Hello, World!');
    });

    it('should record resource read history', async () => {
      registerMockResource(
        server,
        {
          uri: 'vmark://doc',
          name: 'Doc',
          description: 'Doc',
        },
        async () => ({ contents: [{ uri: 'vmark://doc', text: 'text' }] })
      );

      await client.readResource('vmark://doc');
      await client.readResource('vmark://doc');

      const history = client.getResourceReadHistory();
      expect(history).toHaveLength(2);
    });

    it('should throw for unknown resource', async () => {
      await expect(client.readResource('vmark://unknown')).rejects.toThrow(
        'Unknown resource'
      );
    });
  });

  describe('assertions', () => {
    beforeEach(() => {
      registerMockTool(
        server,
        {
          name: 'action',
          description: 'Action tool',
          inputSchema: { type: 'object', properties: {} },
        },
        async () => ({ success: true, content: [] })
      );
      registerMockResource(
        server,
        {
          uri: 'vmark://data',
          name: 'Data',
          description: 'Data',
        },
        async () => ({ contents: [{ uri: 'vmark://data', text: '{}' }] })
      );
    });

    it('should pass assertToolCalled when tool was called', async () => {
      await client.callTool('action', { key: 'value' });

      expect(() => client.assertToolCalled('action')).not.toThrow();
    });

    it('should fail assertToolCalled when tool was not called', () => {
      expect(() => client.assertToolCalled('action')).toThrow(
        'Expected tool "action" to be called'
      );
    });

    it('should pass assertToolCalled with matching args', async () => {
      await client.callTool('action', { key: 'value', other: 123 });

      expect(() =>
        client.assertToolCalled('action', { key: 'value' })
      ).not.toThrow();
    });

    it('should fail assertToolCalled with non-matching args', async () => {
      await client.callTool('action', { key: 'different' });

      expect(() =>
        client.assertToolCalled('action', { key: 'value' })
      ).toThrow('Expected tool "action" to be called with');
    });

    it('should pass assertResourceRead when resource was read', async () => {
      await client.readResource('vmark://data');

      expect(() => client.assertResourceRead('vmark://data')).not.toThrow();
    });

    it('should fail assertResourceRead when resource was not read', () => {
      expect(() => client.assertResourceRead('vmark://data')).toThrow(
        'Expected resource "vmark://data" to be read'
      );
    });
  });

  describe('content helpers', () => {
    it('should extract text content from tool result', () => {
      const result: ToolCallResult = {
        success: true,
        content: [
          { type: 'text', text: 'Hello' },
          { type: 'text', text: 'World' },
        ],
      };

      expect(McpTestClient.getTextContent(result)).toBe('Hello');
    });

    it('should return empty string when no text content', () => {
      const result: ToolCallResult = {
        success: true,
        content: [{ type: 'image', data: 'base64...' }],
      };

      expect(McpTestClient.getTextContent(result)).toBe('');
    });

    it('should parse JSON content from tool result', () => {
      const result: ToolCallResult = {
        success: true,
        content: [{ type: 'text', text: '{"key": "value", "num": 42}' }],
      };

      const json = McpTestClient.getJsonContent<{ key: string; num: number }>(result);

      expect(json.key).toBe('value');
      expect(json.num).toBe(42);
    });

    it('should extract text from resource result', () => {
      const result: ResourceReadResult = {
        contents: [
          { uri: 'vmark://doc', text: 'Document content' },
        ],
      };

      expect(McpTestClient.getResourceText(result)).toBe('Document content');
    });

    it('should extract text from specific URI in resource result', () => {
      const result: ResourceReadResult = {
        contents: [
          { uri: 'vmark://first', text: 'First' },
          { uri: 'vmark://second', text: 'Second' },
        ],
      };

      expect(McpTestClient.getResourceText(result, 'vmark://second')).toBe('Second');
    });

    it('should parse JSON from resource result', () => {
      const result: ResourceReadResult = {
        contents: [
          { uri: 'vmark://data', text: '{"items": [1, 2, 3]}' },
        ],
      };

      const json = McpTestClient.getResourceJson<{ items: number[] }>(result);

      expect(json.items).toEqual([1, 2, 3]);
    });
  });

  describe('history management', () => {
    it('should clear history', async () => {
      registerMockTool(
        server,
        {
          name: 'tool',
          description: 'Tool',
          inputSchema: { type: 'object', properties: {} },
        },
        async () => ({ success: true, content: [] })
      );
      registerMockResource(
        server,
        {
          uri: 'vmark://res',
          name: 'Res',
          description: 'Res',
        },
        async () => ({ contents: [] })
      );

      await client.callTool('tool', {});
      await client.readResource('vmark://res');

      expect(client.getToolCallHistory()).toHaveLength(1);
      expect(client.getResourceReadHistory()).toHaveLength(1);

      client.clearHistory();

      expect(client.getToolCallHistory()).toHaveLength(0);
      expect(client.getResourceReadHistory()).toHaveLength(0);
    });
  });
});
